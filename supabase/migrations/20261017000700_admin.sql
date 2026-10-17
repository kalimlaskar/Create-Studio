-- Super-admin tools: content reports, takedowns, account bans and an audit log.
-- Run after 20261017000600_interactions.sql. Every table here is read and written
-- only by the server (service role); admins are decided by ADMIN_EMAILS on the server.

-- A video taken down by an admin stops playing everywhere. Nothing is deleted, so it can be restored.
alter table public.videos
    add column if not exists banned_at timestamptz,
    add column if not exists banned_reason text check (char_length(banned_reason) <= 300);

-- Accounts an admin has banned. Sign-in is also blocked in Supabase Auth.
create table if not exists public.account_bans (
    user_id uuid primary key references auth.users (id) on delete cascade,
    reason text not null check (char_length(reason) between 1 and 300),
    banned_by uuid references auth.users (id) on delete set null,
    banned_at timestamptz not null default now()
);

-- Reports from viewers about a shared video. Anyone can send one, without an account.
create table if not exists public.content_reports (
    id uuid primary key default gen_random_uuid(),
    video_id uuid not null references public.videos (id) on delete cascade,
    share_link_id uuid references public.share_links (id) on delete set null,
    reason text not null check (reason in ('nonconsensual', 'child_safety', 'sexual', 'harassment', 'violence', 'spam', 'copyright', 'other')),
    details text check (char_length(details) <= 1000),
    reporter_email text check (char_length(reporter_email) <= 254),
    ip_hash text check (char_length(ip_hash) <= 64),
    -- Intimate content shared without consent and child safety go to the top of the queue.
    urgent boolean not null default false,
    status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
    resolution text check (char_length(resolution) <= 300),
    resolved_by uuid references auth.users (id) on delete set null,
    resolved_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists content_reports_queue_idx on public.content_reports (status, urgent desc, created_at desc);
create index if not exists content_reports_ip_idx on public.content_reports (ip_hash, created_at desc);

-- Every admin action, including opening a reported video.
create table if not exists public.admin_audit_log (
    id bigint generated always as identity primary key,
    admin_id uuid references auth.users (id) on delete set null,
    admin_email text not null,
    action text not null check (char_length(action) <= 60),
    target_type text check (char_length(target_type) <= 30),
    target_id text check (char_length(target_id) <= 80),
    details jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log (created_at desc);

alter table public.account_bans enable row level security;
alter table public.content_reports enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.account_bans, public.content_reports, public.admin_audit_log from anon, authenticated;
