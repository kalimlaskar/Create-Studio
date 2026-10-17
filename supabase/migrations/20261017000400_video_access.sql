-- Optional viewer verification before a shared or embedded video plays: a PIN, a
-- password, or a one-time code sent by email. Run after 20261017000300_video_embeds.sql.
-- The playback URL is only handed out after /api/unlock accepts the viewer.

alter table public.videos
    add column if not exists access_mode text not null default 'public' check (access_mode in ('public', 'pin', 'password', 'email')),
    -- scrypt hash of the PIN or password ("scrypt$<salt>$<hash>"). Never sent to the browser.
    add column if not exists access_secret_hash text check (char_length(access_secret_hash) <= 200),
    -- For email codes: addresses or "@company.com" domains allowed to unlock. Empty means any address.
    add column if not exists access_emails text[] not null default '{}',
    -- Bumped whenever the protection changes, which signs every earlier viewer out.
    add column if not exists access_version integer not null default 1;

-- The address a viewer verified with an email code, so analytics can name them.
alter table public.view_sessions add column if not exists viewer_email text check (char_length(viewer_email) <= 254);

-- One-time codes sent by email. Only the server (service role) reads or writes these.
create table if not exists public.video_access_codes (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos (id) on delete cascade,
    email text not null check (char_length(email) <= 254),
    code_hash text not null,
    attempts integer not null default 0,
    expires_at timestamptz not null,
    used_at timestamptz,
    ip_hash text check (char_length(ip_hash) <= 64),
    created_at timestamptz not null default now()
);

create index if not exists video_access_codes_lookup_idx on public.video_access_codes (video_id, email, created_at desc);
create index if not exists video_access_codes_ip_idx on public.video_access_codes (ip_hash, created_at desc);

-- Wrong PINs and passwords, to slow down guessing.
create table if not exists public.video_access_failures (
    id bigint generated always as identity primary key,
    video_id uuid not null references public.videos (id) on delete cascade,
    ip_hash text check (char_length(ip_hash) <= 64),
    created_at timestamptz not null default now()
);

create index if not exists video_access_failures_video_idx on public.video_access_failures (video_id, created_at desc);
create index if not exists video_access_failures_ip_idx on public.video_access_failures (video_id, ip_hash, created_at desc);

alter table public.video_access_codes enable row level security;
alter table public.video_access_failures enable row level security;
revoke all on public.video_access_codes, public.video_access_failures from anon, authenticated;
