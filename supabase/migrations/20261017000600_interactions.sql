-- In-video forms, buttons and booking embeds, and the leads they collect.
-- Run after 20261017000500_integrations.sql.

alter table public.videos
    -- [{ id, type: 'form'|'button'|'booking', placement: 'start'|'time'|'end', atMs, ... }]
    -- Destinations and hidden-field templates live here too; the server strips them
    -- before anything is sent to a viewer's browser.
    add column if not exists interactions jsonb not null default '[]'::jsonb check (jsonb_typeof(interactions) = 'array');

-- Viewer events for the new elements: a form submitted, a call booked.
alter table public.view_events drop constraint if exists view_events_type_check;
alter table public.view_events add constraint view_events_type_check
    check (type in ('play', 'pause', 'seek', 'ended', 'chapter', 'cta', 'form', 'booking'));

-- New moments integrations can be told about.
alter table public.notification_events drop constraint if exists notification_events_type_check;
alter table public.notification_events add constraint notification_events_type_check
    check (type in ('video.viewed', 'video.completed', 'cta.clicked', 'form.submitted', 'call.booked'));
alter table public.integrations alter column events set default '{video.viewed,video.completed,cta.clicked,form.submitted,call.booked}';
-- Existing integrations hear about the new moments too.
update public.integrations set events = array(select distinct unnest(events || '{form.submitted,call.booked}'::text[]));

-- One row per form submission. Written only by the server; owners read their own.
create table if not exists public.lead_submissions (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos (id) on delete cascade,
    owner_id uuid not null references auth.users (id) on delete cascade,
    share_link_id uuid references public.share_links (id) on delete set null,
    interaction_id text not null check (char_length(interaction_id) <= 40),
    form_title text check (char_length(form_title) <= 120),
    -- What the viewer typed, keyed by field name.
    fields jsonb not null default '{}'::jsonb,
    -- Hidden values filled in by the server (UTM parameters, referrer, ...).
    hidden jsonb not null default '{}'::jsonb,
    email text check (char_length(email) <= 254),
    viewer_key text check (char_length(viewer_key) <= 64),
    ip_hash text check (char_length(ip_hash) <= 64),
    -- Forwarding to the creator's own form backend (HubSpot or a URL).
    forward_status text check (forward_status in ('ok', 'failed', 'skipped')),
    forward_error text check (char_length(forward_error) <= 300),
    created_at timestamptz not null default now()
);

create index if not exists lead_submissions_video_idx on public.lead_submissions (video_id, created_at desc);
create index if not exists lead_submissions_ip_idx on public.lead_submissions (ip_hash, created_at desc);

alter table public.lead_submissions enable row level security;
revoke all on public.lead_submissions from anon;
revoke all on public.lead_submissions from authenticated;
grant select, delete on public.lead_submissions to authenticated;

create policy "Owners read their leads"
    on public.lead_submissions for select to authenticated
    using ((select auth.uid()) = owner_id);

create policy "Owners delete their leads"
    on public.lead_submissions for delete to authenticated
    using ((select auth.uid()) = owner_id);
