alter table public.profiles
    add column if not exists username text,
    add column if not exists avatar_path text;

alter table public.profiles
    add constraint profiles_username_format
        check (username is null or username ~ '^[a-z0-9_]{3,20}$'),
    add constraint profiles_avatar_path_length
        check (avatar_path is null or char_length(avatar_path) <= 128);

create unique index profiles_username_unique on public.profiles (lower(username))
    where username is not null;

create or replace function public.is_profile_username_available(requested_username text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        (select auth.uid()) is not null
        and requested_username ~ '^[a-z0-9_]{3,20}$'
        and not exists (
            select 1
            from public.profiles
            where lower(username) = lower(requested_username)
              and id <> (select auth.uid())
        );
$$;

revoke all on function public.is_profile_username_available(text) from public;
grant execute on function public.is_profile_username_available(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload their own profile avatars"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "Users can replace their own profile avatars"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

create policy "Users can delete their own profile avatars"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'profile-avatars'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );
