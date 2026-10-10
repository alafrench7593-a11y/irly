-- Profile v2: a social profile built on the data IRLY already has.
--
-- 1. @username: unique, lowercase, 3 to 24 characters (letters, digits, dot,
--    underscore), optional; reserved names refused. Members choose it in
--    Edit profile; username_available() answers before saving.
-- 2. public_profile also returns the username and the number of friends
--    (accepted friendships), counted on the server like followers.
-- 3. member_activities(): the activities a member created or joined, as the
--    viewer may see them. Security invoker: the activity read rule and the
--    member's activity_visibility (participant rows) decide; nothing is
--    copied into a new table.
-- 4. member_lives(): their IRL posts (the live feature). Invoker too: others
--    see only live posts within their audience; the author also sees past ones.

-- ───────── 1. Username ─────────
alter table public.profiles add column if not exists username text;
do $$
begin
  alter table public.profiles add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$');
exception when duplicate_object then null;
end $$;
create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;

create or replace function private.username_reserved(u text) returns boolean
language sql immutable as $$
  select u in ('irly', 'irlyofficial', 'admin', 'administrator', 'support', 'help', 'moderator', 'mod', 'staff', 'team',
    'official', 'security', 'privacy', 'legal', 'system', 'root', 'null', 'undefined', 'me', 'settings', 'profile')
    or u like 'irly%' and u <> 'irly'
$$;

create or replace function private.username_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  new.username := nullif(lower(btrim(new.username)), '');
  if new.username is not null and (tg_op = 'INSERT' or new.username is distinct from old.username)
     and private.username_reserved(new.username) then
    raise exception 'this username is reserved' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists profiles_username_guard on public.profiles;
create trigger profiles_username_guard before insert or update of username on public.profiles
for each row execute function private.username_guard();

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and lower(btrim(p_username)) ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
    and not private.username_reserved(lower(btrim(p_username)))
    and not exists (select 1 from public.profiles where username = lower(btrim(p_username)) and id <> auth.uid())
$$;
revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

-- The new column is readable like the other public profile columns.
select private.restrict_profile_columns();

-- ───────── 2. Profile header ─────────
drop function if exists public.public_profile(uuid);
create function public.public_profile(p_user uuid)
returns table (id uuid, first_name text, photo_path text, bio text, city_id text, interests text[], languages text[],
  visible boolean, followers integer, following integer, i_follow boolean, follows_me boolean, can_message boolean,
  direct_id uuid, is_me boolean, friend_status text, username text, friends integer)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  vis boolean;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null)
     or (p_user <> me and private.blocked_unchecked(me, p_user)) then
    return;
  end if;
  vis := p_user = me or private.visible_to(me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user));
  return query
  select p.id, p.first_name, p.photo_paths[1],
    case when vis then p.bio end,
    case when vis then p.city_id end,
    case when vis then p.interests else '{}'::text[] end,
    case when vis then p.languages else '{}'::text[] end,
    vis,
    (select count(*)::int from public.follows f where f.followee_id = p.id),
    (select count(*)::int from public.follows f where f.follower_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = me),
    p.id <> me and (private.may_message(p.id) or exists (
      select 1 from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id))),
    (select c.id from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id)
      limit 1),
    p.id = me,
    case when p.id = me then 'none' else private.friend_status(me, p.id) end,
    p.username,
    (select count(*)::int from public.friendships f
      join public.profiles o on o.id = case when f.user_a = p.id then f.user_b else f.user_a end and o.deleted_at is null
      where f.status = 'accepted' and p.id in (f.user_a, f.user_b))
  from public.profiles p where p.id = p_user;
end $$;
revoke all on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

-- ───────── 3. Activities on a profile ─────────
create or replace function public.member_activities(p_user uuid)
returns table (id uuid, title text, category_id text, city_id text, area_id text, place_name text, starts_at timestamptz,
  ends_at timestamptz, cover_path text, going integer, role text, state text)
language sql stable security invoker set search_path = public as $$
  with mine as (
    select a.id, 'created'::text as role from public.activities a where a.creator_id = p_user
    union
    select x.activity_id, 'joined' from public.activity_participants x
    join public.activities a on a.id = x.activity_id
    where x.user_id = p_user and x.status = 'going' and a.creator_id <> p_user
  )
  select a.id, a.title, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.cover_path,
    private.going_count(a.id), m.role,
    case
      when a.cancelled_at is not null then 'cancelled'
      when now() < a.starts_at then 'upcoming'
      when now() < coalesce(a.ends_at, a.starts_at + interval '3 hours') then 'live'
      else 'past' end
  from mine m
  join public.activities a on a.id = m.id
  where auth.uid() is not null
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by (a.cancelled_at is null and coalesce(a.ends_at, a.starts_at + interval '3 hours') > now()) desc,
    case when coalesce(a.ends_at, a.starts_at + interval '3 hours') > now() then a.starts_at end asc,
    a.starts_at desc
  limit 200
$$;
revoke all on function public.member_activities(uuid) from public, anon;
grant execute on function public.member_activities(uuid) to authenticated;

-- ───────── 4. Lives (IRL posts) on a profile ─────────
create or replace function public.member_lives(p_user uuid)
returns table (id uuid, body text, media_path text, area_id text, place_name text, created_at timestamptz, expires_at timestamptz, live boolean)
language sql stable security invoker set search_path = public as $$
  select i.id, i.body, i.media_path, i.area_id, i.place_name, i.created_at, i.expires_at, i.expires_at > now()
  from public.irl_posts i
  where i.author_id = p_user and auth.uid() is not null
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by i.created_at desc
  limit 60
$$;
revoke all on function public.member_lives(uuid) from public, anon;
grant execute on function public.member_lives(uuid) to authenticated;

-- ───────── 5. Friends list (yours, or a visible member's) ─────────
create or replace function public.friend_list(p_user uuid)
returns table (id uuid, first_name text, photo_path text, username text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  select o.id, o.first_name, o.photo_paths[1], o.username,
    exists (select 1 from public.follows x where x.follower_id = auth.uid() and x.followee_id = o.id)
  from public.friendships f
  join public.profiles o on o.id = case when f.user_a = p_user then f.user_b else f.user_a end and o.deleted_at is null
  where f.status = 'accepted' and p_user in (f.user_a, f.user_b)
    and auth.uid() is not null
    and not private.blocked_unchecked(auth.uid(), o.id)
    and (p_user = auth.uid() or (not private.blocked_unchecked(auth.uid(), p_user)
      and private.visible_to(auth.uid(), p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
    and (o.id = auth.uid() or private.visible_to(auth.uid(), o.id, (select s.profile_visibility from public.safety_settings s where s.user_id = o.id)))
  order by o.first_name
  limit 500
$$;
revoke all on function public.friend_list(uuid) from public, anon;
grant execute on function public.friend_list(uuid) to authenticated;

-- ───────── 6. Communities on a profile: created or joined ─────────
drop function if exists public.member_communities(uuid);
create function public.member_communities(p_user uuid)
returns table (id uuid, name text, city_id text, cover_path text, members integer, tagline text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city_id, c.cover_path, (select count(*)::int from public.community_members x where x.community_id = c.id),
    c.tagline, case when c.created_by = p_user or m.role = 'owner' then 'created' else 'joined' end
  from public.community_members m
  join public.communities c on c.id = m.community_id and c.deleted_at is null
  where m.user_id = p_user
    and (not c.girl_only or private.girl_eligible_unchecked(auth.uid()))
    and (p_user = auth.uid() or (not private.blocked_unchecked(auth.uid(), p_user)
      and private.visible_to(auth.uid(), p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
  order by (c.created_by = p_user or m.role = 'owner') desc, c.name
  limit 100
$$;
revoke all on function public.member_communities(uuid) from public, anon;
grant execute on function public.member_communities(uuid) to authenticated;
