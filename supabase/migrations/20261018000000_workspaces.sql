-- Team workspaces: several people share one library of videos, links, leads,
-- analytics and integrations. Run after 20261017000800_plans.sql.
--
--   workspaces          a team (every account gets one of its own)
--   workspace_members   who is in a workspace, as owner, admin or member
--   workspace_invites   pending invites by email; only a hash of the token is stored
--
-- Every owned table gains workspace_id. A trigger fills it in from the creator's
-- active workspace (or from the video), so existing inserts keep working unchanged.
--
-- Who can do what:
--   member  sees everything in the workspace; edits and deletes only what they made
--   admin   also edits anything in the workspace, manages integrations and invites
--   owner   also changes roles; one per workspace (deleting a workspace is server-only)

/* --------------------------------- tables --------------------------------- */

create table if not exists public.workspaces (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(name) between 1 and 80),
    created_by uuid references auth.users (id) on delete set null,
    -- Members plus pending invites may not exceed this. Set by the server from the plan.
    seat_limit integer not null default 1 check (seat_limit between 1 and 1000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null default 'member' check (role in ('owner', 'admin', 'member')),
    invited_by uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now(),
    primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);
create unique index if not exists workspace_members_one_owner_idx on public.workspace_members (workspace_id) where role = 'owner';

create table if not exists public.workspace_invites (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
    role text not null default 'member' check (role in ('admin', 'member')),
    -- sha256 of the token in the invite link. The token itself is never stored.
    token_hash text not null unique check (char_length(token_hash) = 64),
    invited_by uuid references auth.users (id) on delete set null,
    expires_at timestamptz not null default now() + interval '7 days',
    accepted_at timestamptz,
    created_at timestamptz not null default now()
);

create index if not exists workspace_invites_workspace_idx on public.workspace_invites (workspace_id, created_at desc);
create unique index if not exists workspace_invites_one_pending_idx on public.workspace_invites (workspace_id, email) where accepted_at is null;

-- The workspace new videos and integrations go into. Null means the account's own workspace.
alter table public.profiles
    add column if not exists active_workspace_id uuid references public.workspaces (id) on delete set null;

-- Filled in and made required further down, once every account has a workspace.
alter table public.videos add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.share_links add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.lead_submissions add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.integrations add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;
alter table public.notification_events add column if not exists workspace_id uuid references public.workspaces (id) on delete cascade;

/* -------------------------------- helpers -------------------------------- */
-- security definer so policies can check membership without recursing into
-- workspace_members' own row-level security.

create or replace function public.workspace_role(p_workspace uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select m.role from public.workspace_members m
    where m.workspace_id = p_workspace and m.user_id = (select auth.uid());
$$;

create or replace function public.is_workspace_member(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select public.workspace_role(p_workspace) is not null;
$$;

create or replace function public.is_workspace_admin(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(public.workspace_role(p_workspace) in ('owner', 'admin'), false);
$$;

/* Can the signed-in user see this video (and its links, views and leads)? */
create or replace function public.can_read_video(p_video uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.videos v
        where v.id = p_video and public.is_workspace_member(v.workspace_id)
    );
$$;

/* Can the signed-in user change this video: its creator, or a workspace admin. */
create or replace function public.can_manage_video(p_video uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.videos v
        where v.id = p_video
          and public.is_workspace_member(v.workspace_id)
          and (v.owner_id = (select auth.uid()) or public.is_workspace_admin(v.workspace_id))
    );
$$;

/* The workspace a user's new things go into: their active one if they're still in it, else their own. */
create or replace function public.default_workspace_id(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select p.active_workspace_id from public.profiles p
         join public.workspace_members m on m.workspace_id = p.active_workspace_id and m.user_id = p.id
         where p.id = p_user),
        (select m.workspace_id from public.workspace_members m
         where m.user_id = p_user and m.role = 'owner'
         order by m.created_at limit 1)
    );
$$;

revoke all on function public.workspace_role(uuid), public.is_workspace_member(uuid), public.is_workspace_admin(uuid),
    public.can_read_video(uuid), public.can_manage_video(uuid), public.default_workspace_id(uuid) from public, anon;
grant execute on function public.workspace_role(uuid), public.is_workspace_member(uuid), public.is_workspace_admin(uuid),
    public.can_read_video(uuid), public.can_manage_video(uuid) to authenticated, service_role;
grant execute on function public.default_workspace_id(uuid) to service_role;

/* --------------------- one workspace for every account --------------------- */

create or replace function public.create_personal_workspace(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_id uuid;
    v_name text;
begin
    select m.workspace_id into v_id from public.workspace_members m
    where m.user_id = p_user and m.role = 'owner' order by m.created_at limit 1;
    if v_id is not null then
        return v_id;
    end if;

    select left(coalesce(nullif(btrim(p.display_name), ''), 'My') || '’s workspace', 80) into v_name
    from public.profiles p where p.id = p_user;

    insert into public.workspaces (name, created_by) values (coalesce(v_name, 'My workspace'), p_user)
    returning id into v_id;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_id, p_user, 'owner');
    return v_id;
end;
$$;

revoke all on function public.create_personal_workspace(uuid) from public, anon, authenticated;
grant execute on function public.create_personal_workspace(uuid) to service_role;

create or replace function public.create_workspace_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform public.create_personal_workspace(new.id);
    return new;
end;
$$;

-- Runs after on_auth_user_created_profile (triggers fire in name order), so the profile name is there.
drop trigger if exists on_auth_user_created_workspace on auth.users;
create trigger on_auth_user_created_workspace
    after insert on auth.users
    for each row execute procedure public.create_workspace_for_new_user();

select public.create_personal_workspace(u.id) from auth.users u;

/* ----------------------- workspace_id on owned tables ----------------------- */

update public.videos v set workspace_id = public.default_workspace_id(v.owner_id) where v.workspace_id is null;
update public.integrations i set workspace_id = public.default_workspace_id(i.owner_id) where i.workspace_id is null;
update public.share_links l set workspace_id = v.workspace_id from public.videos v where v.id = l.video_id and l.workspace_id is null;
update public.lead_submissions s set workspace_id = v.workspace_id from public.videos v where v.id = s.video_id and s.workspace_id is null;
update public.notification_events n set workspace_id = v.workspace_id from public.videos v where v.id = n.video_id and n.workspace_id is null;

alter table public.videos alter column workspace_id set not null;
alter table public.share_links alter column workspace_id set not null;
alter table public.lead_submissions alter column workspace_id set not null;
alter table public.integrations alter column workspace_id set not null;
alter table public.notification_events alter column workspace_id set not null;

create index if not exists videos_workspace_created_idx on public.videos (workspace_id, created_at desc);
create index if not exists share_links_workspace_idx on public.share_links (workspace_id);
create index if not exists lead_submissions_workspace_idx on public.lead_submissions (workspace_id, created_at desc);
create index if not exists integrations_workspace_idx on public.integrations (workspace_id, created_at);

/* Videos and integrations: the creator's active workspace when none is given. */
create or replace function public.fill_workspace_from_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.workspace_id is null then
        new.workspace_id := public.default_workspace_id(new.owner_id);
    end if;
    return new;
end;
$$;

/* Links, leads and notifications always belong to their video's workspace. */
create or replace function public.fill_workspace_from_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    select v.workspace_id into new.workspace_id from public.videos v where v.id = new.video_id;
    return new;
end;
$$;

/* A video moved to another workspace takes its links, leads and notifications with it. */
create or replace function public.move_video_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.share_links set workspace_id = new.workspace_id where video_id = new.id;
    update public.lead_submissions set workspace_id = new.workspace_id where video_id = new.id;
    update public.notification_events set workspace_id = new.workspace_id where video_id = new.id;
    return new;
end;
$$;

revoke all on function public.fill_workspace_from_owner(), public.fill_workspace_from_video(), public.move_video_children() from public, anon, authenticated;

drop trigger if exists videos_fill_workspace on public.videos;
create trigger videos_fill_workspace before insert on public.videos
    for each row execute procedure public.fill_workspace_from_owner();
drop trigger if exists integrations_fill_workspace on public.integrations;
create trigger integrations_fill_workspace before insert on public.integrations
    for each row execute procedure public.fill_workspace_from_owner();
drop trigger if exists share_links_fill_workspace on public.share_links;
create trigger share_links_fill_workspace before insert or update of video_id, workspace_id on public.share_links
    for each row execute procedure public.fill_workspace_from_video();
drop trigger if exists lead_submissions_fill_workspace on public.lead_submissions;
create trigger lead_submissions_fill_workspace before insert or update of video_id, workspace_id on public.lead_submissions
    for each row execute procedure public.fill_workspace_from_video();
drop trigger if exists notification_events_fill_workspace on public.notification_events;
create trigger notification_events_fill_workspace before insert or update of video_id, workspace_id on public.notification_events
    for each row execute procedure public.fill_workspace_from_video();
drop trigger if exists videos_move_children on public.videos;
create trigger videos_move_children after update of workspace_id on public.videos
    for each row when (old.workspace_id is distinct from new.workspace_id)
    execute procedure public.move_video_children();

/* ------------------------- row-level security: teams ------------------------- */

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;

revoke all on public.workspaces, public.workspace_members, public.workspace_invites from anon, authenticated;
-- Creating workspaces, inviting and changing roles go through the functions below.
grant select on public.workspaces, public.workspace_members to authenticated;
grant update (name, updated_at) on public.workspaces to authenticated;
-- Deleting a workspace deletes its videos, whose files live in R2, so only the server does it.
grant delete on public.workspace_members to authenticated;
grant select, delete on public.workspace_invites to authenticated;

drop policy if exists "Members read their workspaces" on public.workspaces;
create policy "Members read their workspaces"
    on public.workspaces for select to authenticated
    using (public.is_workspace_member(id));

drop policy if exists "Admins rename their workspace" on public.workspaces;
create policy "Admins rename their workspace"
    on public.workspaces for update to authenticated
    using (public.is_workspace_admin(id))
    with check (public.is_workspace_admin(id));

drop policy if exists "Members see who else is in the workspace" on public.workspace_members;
create policy "Members see who else is in the workspace"
    on public.workspace_members for select to authenticated
    using (public.is_workspace_member(workspace_id));

-- Admins remove members and admins; anyone but the owner can leave. The owner never leaves this way.
drop policy if exists "Admins remove members, members leave" on public.workspace_members;
create policy "Admins remove members, members leave"
    on public.workspace_members for delete to authenticated
    using (
        role <> 'owner'
        and (user_id = (select auth.uid()) or public.is_workspace_admin(workspace_id))
    );

drop policy if exists "Admins see and cancel invites" on public.workspace_invites;
create policy "Admins see and cancel invites"
    on public.workspace_invites for all to authenticated
    using (public.is_workspace_admin(workspace_id));

/* ------------------------ row-level security: content ------------------------ */

drop policy if exists "Owners manage their videos" on public.videos;
drop policy if exists "Members read workspace videos" on public.videos;
drop policy if exists "Members add videos to their workspace" on public.videos;
drop policy if exists "Creators and admins change videos" on public.videos;
drop policy if exists "Creators and admins delete videos" on public.videos;

create policy "Members read workspace videos"
    on public.videos for select to authenticated
    using (public.is_workspace_member(workspace_id));

create policy "Members add videos to their workspace"
    on public.videos for insert to authenticated
    with check (owner_id = (select auth.uid()) and public.is_workspace_member(workspace_id));

-- The check stops a video being moved into a workspace the editor isn't in, or handed to someone else.
create policy "Creators and admins change videos"
    on public.videos for update to authenticated
    using (public.is_workspace_member(workspace_id) and (owner_id = (select auth.uid()) or public.is_workspace_admin(workspace_id)))
    with check (public.is_workspace_member(workspace_id) and (owner_id = (select auth.uid()) or public.is_workspace_admin(workspace_id)));

create policy "Creators and admins delete videos"
    on public.videos for delete to authenticated
    using (public.is_workspace_member(workspace_id) and (owner_id = (select auth.uid()) or public.is_workspace_admin(workspace_id)));

-- owner_id stays whoever recorded the video; only the server (no signed-in user) may change it.
create or replace function public.keep_video_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.owner_id is distinct from old.owner_id and (select auth.uid()) is not null then
        raise exception 'a video’s creator can’t be changed' using errcode = '42501';
    end if;
    return new;
end;
$$;

drop trigger if exists videos_keep_owner on public.videos;
create trigger videos_keep_owner before update of owner_id on public.videos
    for each row execute procedure public.keep_video_owner();

drop policy if exists "Owners manage their share links" on public.share_links;
drop policy if exists "Members read workspace share links" on public.share_links;
drop policy if exists "Video managers manage share links" on public.share_links;

create policy "Members read workspace share links"
    on public.share_links for select to authenticated
    using (public.can_read_video(video_id));

-- owner_id on a link is whoever made it, which may be an admin on a teammate's video.
create policy "Video managers manage share links"
    on public.share_links for all to authenticated
    using (public.can_manage_video(video_id))
    with check (owner_id = (select auth.uid()) and public.can_manage_video(video_id));

drop policy if exists "Owners read views of their videos" on public.view_sessions;
drop policy if exists "Members read views of workspace videos" on public.view_sessions;
create policy "Members read views of workspace videos"
    on public.view_sessions for select to authenticated
    using (public.can_read_video(video_id));

drop policy if exists "Owners read view events of their videos" on public.view_events;
drop policy if exists "Members read view events of workspace videos" on public.view_events;
create policy "Members read view events of workspace videos"
    on public.view_events for select to authenticated
    using (public.can_read_video(video_id));

drop policy if exists "Owners read their leads" on public.lead_submissions;
drop policy if exists "Owners delete their leads" on public.lead_submissions;
drop policy if exists "Members read workspace leads" on public.lead_submissions;
drop policy if exists "Video managers delete leads" on public.lead_submissions;

create policy "Members read workspace leads"
    on public.lead_submissions for select to authenticated
    using (public.is_workspace_member(workspace_id));

create policy "Video managers delete leads"
    on public.lead_submissions for delete to authenticated
    using (public.can_manage_video(video_id));

drop policy if exists "Owners manage their integrations" on public.integrations;
drop policy if exists "Members read workspace integrations" on public.integrations;
drop policy if exists "Creators and admins manage integrations" on public.integrations;

create policy "Members read workspace integrations"
    on public.integrations for select to authenticated
    using (public.is_workspace_member(workspace_id));

create policy "Creators and admins manage integrations"
    on public.integrations for all to authenticated
    using (public.is_workspace_member(workspace_id) and (owner_id = (select auth.uid()) or public.is_workspace_admin(workspace_id)))
    with check (public.is_workspace_member(workspace_id) and (owner_id = (select auth.uid()) or public.is_workspace_admin(workspace_id)));

/* ----------------------------- team functions ----------------------------- */

/* A new, empty team workspace owned by the caller. Its seat limit comes from the server later. */
create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user uuid := (select auth.uid());
    v_id uuid;
begin
    if v_user is null then
        raise exception 'sign in first' using errcode = '42501';
    end if;
    if char_length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
        raise exception 'workspace names are 1 to 80 characters' using errcode = '22023';
    end if;
    -- Keeps one account from creating workspaces without end.
    if (select count(*) from public.workspace_members m where m.user_id = v_user and m.role = 'owner') >= 5 then
        raise exception 'you can own up to 5 workspaces' using errcode = '54000';
    end if;

    insert into public.workspaces (name, created_by) values (btrim(p_name), v_user) returning id into v_id;
    insert into public.workspace_members (workspace_id, user_id, role) values (v_id, v_user, 'owner');
    return v_id;
end;
$$;

/*
 * Invites an email address. Returns the token for the invite link; the server emails it.
 * Inviting the same address again replaces the earlier invite.
 */
create or replace function public.create_workspace_invite(p_workspace uuid, p_email text, p_role text default 'member')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user uuid := (select auth.uid());
    v_email text := lower(btrim(coalesce(p_email, '')));
    v_token text := encode(extensions.gen_random_bytes(24), 'hex');
    v_used integer;
    v_limit integer;
begin
    if not public.is_workspace_admin(p_workspace) then
        raise exception 'only workspace admins can invite people' using errcode = '42501';
    end if;
    if p_role not in ('admin', 'member') then
        raise exception 'role must be admin or member' using errcode = '22023';
    end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
        raise exception 'that email address isn’t valid' using errcode = '22023';
    end if;
    if exists (
        select 1 from public.workspace_members m join auth.users u on u.id = m.user_id
        where m.workspace_id = p_workspace and lower(u.email) = v_email
    ) then
        raise exception 'that person is already in the workspace' using errcode = '23505';
    end if;

    -- Locks the workspace row so two invites at once can't both take the last seat.
    select w.seat_limit into v_limit from public.workspaces w where w.id = p_workspace for update;
    delete from public.workspace_invites i where i.workspace_id = p_workspace and i.email = v_email and i.accepted_at is null;
    select (select count(*) from public.workspace_members m where m.workspace_id = p_workspace)
         + (select count(*) from public.workspace_invites i where i.workspace_id = p_workspace and i.accepted_at is null and i.expires_at > now())
      into v_used;
    if v_used >= v_limit then
        raise exception 'every seat in this workspace is taken' using errcode = '54000';
    end if;

    insert into public.workspace_invites (workspace_id, email, role, token_hash, invited_by)
    values (p_workspace, v_email, p_role, encode(extensions.digest(v_token, 'sha256'), 'hex'), v_user);
    return v_token;
end;
$$;

/* Joins the workspace an invite is for. The invite must be for the signed-in account's email. */
create or replace function public.accept_workspace_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user uuid := (select auth.uid());
    v_email text;
    v_invite public.workspace_invites;
    v_limit integer;
    v_members integer;
begin
    if v_user is null then
        raise exception 'sign in first' using errcode = '42501';
    end if;
    select lower(u.email) into v_email from auth.users u where u.id = v_user;

    select * into v_invite from public.workspace_invites i
    where i.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
      and i.accepted_at is null and i.expires_at > now()
    for update;
    if v_invite.id is null then
        raise exception 'this invite has expired or was already used' using errcode = 'P0002';
    end if;
    if v_invite.email <> v_email then
        raise exception 'this invite was sent to a different email address' using errcode = '42501';
    end if;

    if exists (select 1 from public.workspace_members m where m.workspace_id = v_invite.workspace_id and m.user_id = v_user) then
        update public.workspace_invites set accepted_at = now() where id = v_invite.id;
        return v_invite.workspace_id;
    end if;

    -- The invite already holds a seat, but the limit may have dropped since it was sent.
    select w.seat_limit into v_limit from public.workspaces w where w.id = v_invite.workspace_id for update;
    select count(*) into v_members from public.workspace_members m where m.workspace_id = v_invite.workspace_id;
    if v_members >= v_limit then
        raise exception 'every seat in this workspace is taken' using errcode = '54000';
    end if;

    insert into public.workspace_members (workspace_id, user_id, role, invited_by)
    values (v_invite.workspace_id, v_user, v_invite.role, v_invite.invited_by);
    update public.workspace_invites set accepted_at = now() where id = v_invite.id;
    return v_invite.workspace_id;
end;
$$;

/* Makes someone an admin or a member. Only the owner can, and the owner's own role can't change here. */
create or replace function public.set_workspace_member_role(p_workspace uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if public.workspace_role(p_workspace) is distinct from 'owner' then
        raise exception 'only the workspace owner can change roles' using errcode = '42501';
    end if;
    if p_role not in ('admin', 'member') then
        raise exception 'role must be admin or member' using errcode = '22023';
    end if;
    if p_user = (select auth.uid()) then
        raise exception 'the owner’s role can’t be changed' using errcode = '42501';
    end if;
    update public.workspace_members m set role = p_role
    where m.workspace_id = p_workspace and m.user_id = p_user and m.role <> 'owner';
    if not found then
        raise exception 'that person isn’t a member of this workspace' using errcode = 'P0002';
    end if;
end;
$$;

/* Chooses which workspace new videos and integrations go into. */
create or replace function public.set_active_workspace(p_workspace uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not public.is_workspace_member(p_workspace) then
        raise exception 'you aren’t a member of that workspace' using errcode = '42501';
    end if;
    update public.profiles set active_workspace_id = p_workspace, updated_at = now() where id = (select auth.uid());
end;
$$;

revoke all on function public.create_workspace(text), public.create_workspace_invite(uuid, text, text),
    public.accept_workspace_invite(text), public.set_workspace_member_role(uuid, uuid, text),
    public.set_active_workspace(uuid) from public, anon;
grant execute on function public.create_workspace(text), public.create_workspace_invite(uuid, text, text),
    public.accept_workspace_invite(text), public.set_workspace_member_role(uuid, uuid, text),
    public.set_active_workspace(uuid) to authenticated;

-- Profiles are updatable by their user, so this keeps active_workspace_id to workspaces they're in.
create or replace function public.check_active_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.active_workspace_id is not null
       and new.active_workspace_id is distinct from old.active_workspace_id
       and not exists (select 1 from public.workspace_members m where m.workspace_id = new.active_workspace_id and m.user_id = new.id) then
        raise exception 'you aren’t a member of that workspace' using errcode = '42501';
    end if;
    return new;
end;
$$;

revoke all on function public.check_active_workspace() from public, anon, authenticated;

drop trigger if exists profiles_check_active_workspace on public.profiles;
create trigger profiles_check_active_workspace before update of active_workspace_id on public.profiles
    for each row execute procedure public.check_active_workspace();
