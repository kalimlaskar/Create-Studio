create table if not exists public.subscriptions (
    user_id uuid primary key references auth.users (id) on delete cascade,
    razorpay_subscription_id text not null unique,
    razorpay_plan_id text not null,
    status text not null default 'created',
    current_period_end timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

-- Writes happen only server-side with the service-role key (checkout + verified webhooks).
create policy "Users can read their own subscription"
    on public.subscriptions for select to authenticated
    using ((select auth.uid()) = user_id);

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
              s.status = 'active'
              or (s.status in ('pending', 'cancelled') and s.current_period_end > now())
          )
    );
$$;
revoke all on function public.is_pro(uuid) from public, anon;
grant execute on function public.is_pro(uuid) to authenticated;

drop function if exists public.consume_ai_credit(integer);

-- Spends one AI credit. Free users get free_limit/day; Pro users get pro_limit/day (fair-use cap).
-- Returns remaining credits, or -1 when the limit is reached.
create or replace function public.consume_ai_credit(free_limit integer, pro_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    daily_limit integer;
    new_used integer;
begin
    if uid is null then
        raise exception 'not authenticated';
    end if;

    daily_limit := case when public.is_pro(uid) then pro_limit else free_limit end;

    insert into public.ai_usage (user_id, usage_date, used)
    values (uid, (now() at time zone 'utc')::date, 1)
    on conflict (user_id, usage_date)
    do update set used = public.ai_usage.used + 1
        where public.ai_usage.used < daily_limit
    returning used into new_used;

    if new_used is null then
        return -1;
    end if;
    return daily_limit - new_used;
end;
$$;
revoke all on function public.consume_ai_credit(integer, integer) from public, anon;
grant execute on function public.consume_ai_credit(integer, integer) to authenticated;
