create table if not exists public.ai_usage (
    user_id uuid not null references auth.users (id) on delete cascade,
    usage_date date not null default (now() at time zone 'utc')::date,
    used integer not null default 0 check (used >= 0),
    primary key (user_id, usage_date)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

create policy "Users can read their own AI usage"
    on public.ai_usage for select to authenticated
    using ((select auth.uid()) = user_id);
grant select on public.ai_usage to authenticated;

-- Atomically spends one AI credit for today (UTC). Returns remaining credits, or -1 when the daily limit is reached.
create or replace function public.consume_ai_credit(daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
    uid uuid := auth.uid();
    new_used integer;
begin
    if uid is null then
        raise exception 'not authenticated';
    end if;

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

-- Gives a credit back when the AI provider failed.
create or replace function public.refund_ai_credit()
returns void
language sql
security definer
set search_path = ''
as $$
    update public.ai_usage
    set used = greatest(used - 1, 0)
    where user_id = auth.uid() and usage_date = (now() at time zone 'utc')::date;
$$;

revoke all on function public.consume_ai_credit(integer) from public, anon;
revoke all on function public.refund_ai_credit() from public, anon;
grant execute on function public.consume_ai_credit(integer) to authenticated;
grant execute on function public.refund_ai_credit() to authenticated;
