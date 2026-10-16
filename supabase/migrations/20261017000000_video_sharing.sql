-- Hosted videos, share links and viewer analytics.
-- Video files live in Cloudflare R2; these tables hold metadata and engagement.
-- Owners read and manage their own rows through row-level security. Viewer
-- sessions and events are written only by the server (service role) from /api/track.

create table if not exists public.videos (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    title text not null default 'Untitled video' check (char_length(title) between 1 and 160),
    status text not null default 'uploading' check (status in ('uploading', 'ready')),
    storage_key text not null,
    poster_key text,
    content_type text not null check (content_type in ('video/mp4', 'video/webm')),
    size_bytes bigint not null check (size_bytes > 0),
    duration_ms integer not null default 0 check (duration_ms >= 0),
    -- [{ "title": "Pricing", "startMs": 42000 }], sorted by startMs, first at 0.
    chapters jsonb not null default '[]'::jsonb check (jsonb_typeof(chapters) = 'array'),
    cta_label text check (char_length(cta_label) <= 40),
    cta_url text check (char_length(cta_url) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists videos_owner_created_idx on public.videos (owner_id, created_at desc);

create table if not exists public.share_links (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos (id) on delete cascade,
    owner_id uuid not null references auth.users (id) on delete cascade,
    slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{10,32}$'),
    -- Set for links made for one person, so their views are attributed to them.
    recipient_name text check (char_length(recipient_name) <= 120),
    recipient_email text check (char_length(recipient_email) <= 254),
    recipient_company text check (char_length(recipient_company) <= 120),
    is_default boolean not null default false,
    revoked_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists share_links_video_idx on public.share_links (video_id);
create unique index if not exists share_links_one_default_idx on public.share_links (video_id) where is_default;

create table if not exists public.view_sessions (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos (id) on delete cascade,
    share_link_id uuid references public.share_links (id) on delete set null,
    -- Random per-browser id kept by the share page; never an account id.
    viewer_key text not null check (char_length(viewer_key) between 8 and 64),
    started_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    watched_ms integer not null default 0 check (watched_ms >= 0),
    max_position_ms integer not null default 0 check (max_position_ms >= 0),
    -- Index = second of the video, value = how many times that second was played.
    seconds_watched integer[] not null default '{}',
    completed boolean not null default false,
    cta_clicked boolean not null default false,
    device text check (char_length(device) <= 20),
    country text check (char_length(country) <= 2)
);

create index if not exists view_sessions_video_idx on public.view_sessions (video_id, started_at desc);
create index if not exists view_sessions_link_idx on public.view_sessions (share_link_id);

create table if not exists public.view_events (
    id bigint generated always as identity primary key,
    session_id uuid not null references public.view_sessions (id) on delete cascade,
    video_id uuid not null references public.videos (id) on delete cascade,
    type text not null check (type in ('play', 'pause', 'seek', 'ended', 'chapter', 'cta')),
    position_ms integer not null default 0 check (position_ms >= 0),
    detail text check (char_length(detail) <= 120),
    created_at timestamptz not null default now()
);

create index if not exists view_events_session_idx on public.view_events (session_id, created_at);

/* ----------------------------- row-level security ----------------------------- */

alter table public.videos enable row level security;
alter table public.share_links enable row level security;
alter table public.view_sessions enable row level security;
alter table public.view_events enable row level security;

revoke all on public.videos, public.share_links, public.view_sessions, public.view_events from anon;
revoke all on public.view_sessions, public.view_events from authenticated;
grant select, insert, update, delete on public.videos, public.share_links to authenticated;
grant select on public.view_sessions, public.view_events to authenticated;

create policy "Owners manage their videos"
    on public.videos for all to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);

create policy "Owners manage their share links"
    on public.share_links for all to authenticated
    using ((select auth.uid()) = owner_id)
    with check (
        (select auth.uid()) = owner_id
        and exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid()))
    );

create policy "Owners read views of their videos"
    on public.view_sessions for select to authenticated
    using (exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid())));

create policy "Owners read view events of their videos"
    on public.view_events for select to authenticated
    using (exists (select 1 from public.videos v where v.id = video_id and v.owner_id = (select auth.uid())));
