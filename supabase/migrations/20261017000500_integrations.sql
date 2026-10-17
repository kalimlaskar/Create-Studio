-- Notifications to other tools when someone watches a video: signed webhooks,
-- Slack and HubSpot. Run after 20261017000400_video_access.sql.

create table if not exists public.integrations (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    kind text not null check (kind in ('webhook', 'slack', 'hubspot')),
    name text not null check (char_length(name) between 1 and 80),
    -- Webhook/Slack URL or HubSpot token, AES-GCM encrypted by the server. Never sent to the browser.
    target_encrypted text not null check (char_length(target_encrypted) <= 4000),
    -- A safe preview of the target for the settings page, e.g. "hooks.slack.com/…/x7Qa".
    target_hint text not null check (char_length(target_hint) <= 120),
    -- Webhook signing secret, encrypted. Null for Slack and HubSpot.
    secret_encrypted text check (char_length(secret_encrypted) <= 500),
    events text[] not null default '{video.viewed,video.completed,cta.clicked}',
    -- Only notify about viewers we can name (personal links or verified emails).
    identified_only boolean not null default false,
    enabled boolean not null default true,
    last_status text check (last_status in ('ok', 'failed')),
    last_error text check (char_length(last_error) <= 300),
    last_delivered_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists integrations_owner_idx on public.integrations (owner_id, created_at);

-- One row per session and event, so each moment is announced once even if
-- analytics reports arrive twice. Written only by the server.
create table if not exists public.notification_events (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users (id) on delete cascade,
    video_id uuid not null references public.videos (id) on delete cascade,
    session_id uuid not null references public.view_sessions (id) on delete cascade,
    type text not null check (type in ('video.viewed', 'video.completed', 'cta.clicked')),
    created_at timestamptz not null default now(),
    unique (session_id, type)
);

create index if not exists notification_events_owner_idx on public.notification_events (owner_id, created_at desc);

alter table public.integrations enable row level security;
alter table public.notification_events enable row level security;

revoke all on public.integrations, public.notification_events from anon;
revoke all on public.notification_events from authenticated;
grant select, insert, update, delete on public.integrations to authenticated;

create policy "Owners manage their integrations"
    on public.integrations for all to authenticated
    using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);
