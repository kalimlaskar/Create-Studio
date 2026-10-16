-- Billing and AI usage tables the code already relies on, plus one shared
-- "is this user paying" rule. Run after 20261007000100_billing_subscriptions.sql.
--
--   subscriptions     extra Razorpay fields written by the webhook and cancel route
--   payments          one row per successful charge (billing history)
--   razorpay_events   webhook event IDs, so retried events are processed once
--   ai_minutes_usage  monthly transcription and voiceover seconds per user
--   consume_ai_seconds / refund_ai_seconds   atomic monthly AI usage (lib/plans/server.ts)

/* ------------------------------ subscriptions ----------------------------- */

alter table public.subscriptions
    add column if not exists razorpay_customer_id text,
    add column if not exists current_period_start timestamptz,
    add column if not exists cancel_at_period_end boolean not null default false;

/*
 * Paid access, matching lib/plans/entitlement.ts:
 *   active or authenticated              -> paid
 *   pending or cancelled, period not over -> paid until current_period_end
 *   anything else                         -> free
 */
create or replace function public.is_pro(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.subscriptions s
        where s.user_id = uid
          and (
              s.status in ('active', 'authenticated')
              or (s.status in ('pending', 'cancelled') and s.current_period_end > now())
          )
    );
$$;
-- Only server-side functions need this; users shouldn't be able to probe other accounts.
revoke all on function public.is_pro(uuid) from public, anon, authenticated;
grant execute on function public.is_pro(uuid) to service_role;

/* --------------------------------- payments -------------------------------- */

create table if not exists public.payments (
    razorpay_payment_id text primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    razorpay_subscription_id text,
    amount integer,
    currency text,
    status text,
    paid_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id, paid_at desc);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

drop policy if exists "Users can read their own payments" on public.payments;
create policy "Users can read their own payments"
    on public.payments for select to authenticated
    using ((select auth.uid()) = user_id);

/* ----------------------------- webhook events ----------------------------- */

create table if not exists public.razorpay_events (
    event_id text primary key,
    event text,
    received_at timestamptz not null default now()
);

-- Written and read only by the server with the service role.
alter table public.razorpay_events enable row level security;
revoke all on public.razorpay_events from anon, authenticated;

/* ---------------------------- monthly AI usage ---------------------------- */

create table if not exists public.ai_minutes_usage (
    user_id uuid not null references auth.users (id) on delete cascade,
    period date not null,
    transcription_seconds integer not null default 0 check (transcription_seconds >= 0),
    voiceover_seconds integer not null default 0 check (voiceover_seconds >= 0),
    primary key (user_id, period)
);

alter table public.ai_minutes_usage enable row level security;
revoke all on public.ai_minutes_usage from anon, authenticated;
grant select on public.ai_minutes_usage to authenticated;

drop policy if exists "Users can read their own AI usage" on public.ai_minutes_usage;
create policy "Users can read their own AI usage"
    on public.ai_minutes_usage for select to authenticated
    using ((select auth.uid()) = user_id);

/*
 * Adds p_seconds of usage if it stays within p_limit seconds for this month.
 * The row is locked while checking, so parallel requests can't both slip under the limit.
 * Returns allowed and the seconds used this month.
 */
create or replace function public.consume_ai_seconds(p_user uuid, p_kind text, p_seconds integer, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_period date := date_trunc('month', now() at time zone 'utc')::date;
    v_used integer;
begin
    if p_kind not in ('transcription', 'voiceover') then
        raise exception 'unknown usage kind %', p_kind;
    end if;
    if p_seconds <= 0 then
        raise exception 'seconds must be positive';
    end if;

    insert into public.ai_minutes_usage (user_id, period) values (p_user, v_period)
    on conflict (user_id, period) do nothing;

    if p_kind = 'transcription' then
        select u.transcription_seconds into v_used from public.ai_minutes_usage u
        where u.user_id = p_user and u.period = v_period for update;
        if v_used + p_seconds > p_limit then
            return query select false, v_used;
            return;
        end if;
        update public.ai_minutes_usage u set transcription_seconds = u.transcription_seconds + p_seconds
        where u.user_id = p_user and u.period = v_period
        returning u.transcription_seconds into v_used;
    else
        select u.voiceover_seconds into v_used from public.ai_minutes_usage u
        where u.user_id = p_user and u.period = v_period for update;
        if v_used + p_seconds > p_limit then
            return query select false, v_used;
            return;
        end if;
        update public.ai_minutes_usage u set voiceover_seconds = u.voiceover_seconds + p_seconds
        where u.user_id = p_user and u.period = v_period
        returning u.voiceover_seconds into v_used;
    end if;

    return query select true, v_used;
end;
$$;

/* Gives seconds back when the AI call failed. Never goes below zero. */
create or replace function public.refund_ai_seconds(p_user uuid, p_kind text, p_seconds integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_period date := date_trunc('month', now() at time zone 'utc')::date;
begin
    if p_kind = 'transcription' then
        update public.ai_minutes_usage u set transcription_seconds = greatest(0, u.transcription_seconds - p_seconds)
        where u.user_id = p_user and u.period = v_period;
    elsif p_kind = 'voiceover' then
        update public.ai_minutes_usage u set voiceover_seconds = greatest(0, u.voiceover_seconds - p_seconds)
        where u.user_id = p_user and u.period = v_period;
    end if;
end;
$$;

-- Called only by the server with the service role (it passes the user id itself).
revoke all on function public.consume_ai_seconds(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_seconds(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_seconds(uuid, text, integer, integer) to service_role;
grant execute on function public.refund_ai_seconds(uuid, text, integer) to service_role;
