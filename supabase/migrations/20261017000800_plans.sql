-- Packages (plans) managed from the admin dashboard (/admin/plans).
-- Run after 20261017000700_admin.sql. Seeds Free, Creator and Studio with today's limits,
-- so nothing changes for users until an admin edits them. Read and written only by the server.

create table if not exists public.plans (
    id text primary key check (id ~ '^[a-z][a-z0-9_-]{1,30}$'),
    name text not null check (char_length(name) between 1 and 40),
    description text check (char_length(description) <= 200),
    price_usd numeric(10, 2) not null default 0 check (price_usd >= 0),
    price_inr integer not null default 0 check (price_inr >= 0),
    -- The Razorpay plan new subscriptions use. Creator and Studio fall back to the
    -- RAZORPAY_PLAN_ID_* settings while this is empty.
    razorpay_plan_id text unique,
    -- Razorpay plans used before a price change; their subscribers stay on this package.
    legacy_razorpay_plan_ids text[] not null default '{}',
    is_public boolean not null default true,
    archived boolean not null default false,
    sort_order integer not null default 0,
    -- exportSeconds, watermark, transcriptionMinutes, voiceoverMinutes, hostedVideos,
    -- aiDailyRequests, embedDomains, protection, forms, maxIntegrations
    limits jsonb not null check (jsonb_typeof(limits) = 'object'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.plans (id, name, price_usd, price_inr, sort_order, limits) values
    ('free', 'Free', 0, 0, 0, '{"exportSeconds":60,"watermark":true,"transcriptionMinutes":10,"voiceoverMinutes":2,"hostedVideos":5,"aiDailyRequests":12,"embedDomains":false,"protection":true,"forms":true,"maxIntegrations":20}'),
    ('creator', 'Creator', 15, 1500, 1, '{"exportSeconds":300,"watermark":false,"transcriptionMinutes":90,"voiceoverMinutes":30,"hostedVideos":100,"aiDailyRequests":200,"embedDomains":true,"protection":true,"forms":true,"maxIntegrations":20}'),
    ('studio', 'Studio', 35, 3500, 2, '{"exportSeconds":900,"watermark":false,"transcriptionMinutes":250,"voiceoverMinutes":100,"hostedVideos":500,"aiDailyRequests":200,"embedDomains":true,"protection":true,"forms":true,"maxIntegrations":20}')
on conflict (id) do nothing;

alter table public.plans enable row level security;
revoke all on public.plans from anon, authenticated;
