-- Friends are members who follow each other (owner request, 2026-11-06).
-- No friend request any more: a follow back makes two members friends,
-- an unfollow by either ends it. Every rule that says « friends » (profile,
-- Live and activity visibility, friends-only activities, invitations, who
-- may message you) keeps reading friendships through
-- private.friends_unchecked and public.friendships: this migration keeps
-- that table equal to the mutual follows, both ways, so nothing else has
-- to change.
--
--   1. follows ⇒ friendships: a follow whose reverse exists makes (or
--      accepts) the pair's friendship; deleting either follow ends an
--      accepted friendship. A pending request (an older app, IRLY Network's
--      « connect ») is left as it is: it is not a friendship.
--   2. friendships ⇒ follows: a friendship accepted another way (an older
--      app's add_friend, IRLY Network's pro_connect) makes both follows; an
--      accepted friendship removed by one of the two (remove_friend) is that
--      member's unfollow. A block already ends both (blocks_end_follows,
--      on_block); a deleted account takes its rows with it (cascade).
--   3. Existing data: accepted friendships get their two follows (both
--      members agreed to it), mutual follows get their friendship. Pending
--      requests stay as they are (kept, not converted).
--   4. follow_user: you may follow back someone who follows you even when
--      their profile is for friends only (else no such profile could ever
--      make a friend). Every other check is unchanged.
--   5. member_activities also says each activity's universe (Mixte, Girl,
--      Mom, Network: private.community_universe) and whether it is
--      women-only, so « My recap » shows each app space its own activities.
--      Same rows, same read rules (security invoker: activities' RLS).

-- ───────────────────────── 1. follows ⇒ friendships ─────────────────────────

create or replace function private.follow_makes_friends() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.follows f where f.follower_id = new.followee_id and f.followee_id = new.follower_id) then
    -- The first of the two to follow is the one who « asked » (requested_by):
    -- the friendship is not a request of the member following back.
    insert into public.friendships (user_a, user_b, requested_by, status, accepted_at)
    values (least(new.follower_id, new.followee_id), greatest(new.follower_id, new.followee_id), new.followee_id, 'accepted', now())
    on conflict (user_a, user_b) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, now())
      where public.friendships.status <> 'accepted';
  end if;
  return new;
end $$;
revoke all on function private.follow_makes_friends() from public, anon, authenticated;

create or replace function private.unfollow_ends_friends() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
  where user_a = least(old.follower_id, old.followee_id) and user_b = greatest(old.follower_id, old.followee_id)
    and status = 'accepted';
  return old;
end $$;
revoke all on function private.unfollow_ends_friends() from public, anon, authenticated;

-- ───────────────────────── 2. friendships ⇒ follows ─────────────────────────

create or replace function private.friends_follow_each_other() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from 'accepted')
     and not private.blocked_unchecked(new.user_a, new.user_b) then
    insert into public.follows (follower_id, followee_id)
    values (new.user_a, new.user_b), (new.user_b, new.user_a)
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.friends_follow_each_other() from public, anon, authenticated;

-- An accepted friendship removed by one of the two, directly (remove_friend,
-- not through an unfollow, a block or an account deletion): their unfollow.
create or replace function private.unfriend_unfollows() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if old.status = 'accepted' and pg_trigger_depth() = 1 and me is not null and me in (old.user_a, old.user_b) then
    delete from public.follows
    where follower_id = me and followee_id = case when old.user_a = me then old.user_b else old.user_a end;
  end if;
  return old;
end $$;
revoke all on function private.unfriend_unfollows() from public, anon, authenticated;

-- ───────────────────────── 3. Existing data ─────────────────────────

insert into public.follows (follower_id, followee_id, created_at)
select x.follower, x.followee, coalesce(fr.accepted_at, fr.created_at)
from public.friendships fr
cross join lateral (values (fr.user_a, fr.user_b), (fr.user_b, fr.user_a)) as x(follower, followee)
where fr.status = 'accepted'
  and not private.blocked_unchecked(fr.user_a, fr.user_b)
  and exists (select 1 from public.profiles p where p.id = fr.user_a and p.deleted_at is null)
  and exists (select 1 from public.profiles p where p.id = fr.user_b and p.deleted_at is null)
on conflict do nothing;

insert into public.friendships (user_a, user_b, requested_by, status, accepted_at, created_at)
select least(f.follower_id, f.followee_id), greatest(f.follower_id, f.followee_id),
  case when f.created_at <= r.created_at then f.follower_id else r.follower_id end,
  'accepted', greatest(f.created_at, r.created_at), least(f.created_at, r.created_at)
from public.follows f
join public.follows r on r.follower_id = f.followee_id and r.followee_id = f.follower_id
where f.follower_id < f.followee_id
on conflict (user_a, user_b) do update set status = 'accepted', accepted_at = coalesce(public.friendships.accepted_at, excluded.accepted_at)
  where public.friendships.status <> 'accepted';

drop trigger if exists follows_make_friends on public.follows;
create trigger follows_make_friends after insert on public.follows
for each row execute function private.follow_makes_friends();
drop trigger if exists follows_end_friends on public.follows;
create trigger follows_end_friends after delete on public.follows
for each row execute function private.unfollow_ends_friends();
drop trigger if exists friendships_follow_each_other on public.friendships;
create trigger friendships_follow_each_other after insert or update of status on public.friendships
for each row execute function private.friends_follow_each_other();
drop trigger if exists friendships_unfriend_unfollows on public.friendships;
create trigger friendships_unfriend_unfollows after delete on public.friendships
for each row execute function private.unfriend_unfollows();

-- ───────────────────────── 4. Follow back ─────────────────────────

create or replace function public.follow_user(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_user = me then raise exception 'you cannot follow yourself' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null)
     or private.blocked_unchecked(me, p_user) then
    raise exception 'this member is not available' using errcode = 'P0002';
  end if;
  -- Following back someone who follows you is always possible (it is how two
  -- members become friends); otherwise their profile must be visible to you.
  if not exists (select 1 from public.follows f where f.follower_id = p_user and f.followee_id = me)
     and not private.visible_to(me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user)) then
    raise exception 'this profile is private' using errcode = '42501';
  end if;
  insert into public.follows (follower_id, followee_id) values (me, p_user) on conflict do nothing;
  get diagnostics n = row_count;
  -- Follow, unfollow, follow again: one notification a day at most.
  if n > 0 and not exists (select 1 from public.notifications where user_id = p_user and kind = 'NEW_FOLLOWER'
                           and payload ->> 'from' = me::text and created_at > now() - interval '1 day') then
    insert into public.notifications (user_id, kind, payload) values (p_user, 'NEW_FOLLOWER', jsonb_build_object('from', me));
  end if;
  return true;
end $$;
revoke all on function public.follow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;

-- ───────────────────────── 5. Activities with their universe ─────────────────────────

-- An activity's universe: its community's, else women-only (Girl) or Mixte,
-- the same rule as private.conversation_universe for an activity's chat.
-- Only called on rows the caller already reads (member_activities is
-- security invoker): it says nothing more than the row's universe.
create or replace function private.activity_universe(p_activity uuid) returns text
language sql stable security definer set search_path = public, private as $$
  select case
    when a.community_id is not null then coalesce(private.community_universe(a.community_id), case when a.girl_only then 'girl' else 'mixte' end)
    when a.girl_only then 'girl'
    else 'mixte' end
  from public.activities a
  where a.id = p_activity
$$;
revoke all on function private.activity_universe(uuid) from public, anon;
grant execute on function private.activity_universe(uuid) to authenticated;

drop function if exists public.member_activities(uuid);
create function public.member_activities(p_user uuid)
returns table (id uuid, title text, category_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, cover_path text, going integer, role text, state text,
  universe text, girl_only boolean, community_id uuid)
language sql stable set search_path = public as $$
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
      when now() < coalesce(a.ends_at, a.starts_at + interval '2 hours') then 'live'
      else 'past' end,
    private.activity_universe(a.id), a.girl_only, a.community_id
  from mine m
  join public.activities a on a.id = m.id
  where auth.uid() is not null
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by (a.cancelled_at is null and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()) desc,
    case when coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() then a.starts_at end asc,
    a.starts_at desc
  limit 200
$$;
revoke all on function public.member_activities(uuid) from public, anon;
grant execute on function public.member_activities(uuid) to authenticated;
