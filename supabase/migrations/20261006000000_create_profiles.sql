create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_display_name_length check (char_length(display_name) <= 80)
);

alter table public.profiles enable row level security;

grant select, update on public.profiles to authenticated;

create policy "Users can read their own profile"
    on public.profiles
    for select
    to authenticated
    using ((select auth.uid()) = id);

create policy "Users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

insert into public.profiles (id, display_name)
select
    users.id,
    left(
        coalesce(
            nullif(btrim(users.raw_user_meta_data ->> 'display_name'), ''),
            nullif(split_part(users.email, '@', 1), ''),
            'Cliprame creator'
        ),
        80
    )
from auth.users as users
on conflict (id) do nothing;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id, display_name)
    values (
        new.id,
        left(
            coalesce(
                nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
                nullif(split_part(new.email, '@', 1), ''),
                'Cliprame creator'
            ),
            80
        )
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute procedure public.create_profile_for_new_user();