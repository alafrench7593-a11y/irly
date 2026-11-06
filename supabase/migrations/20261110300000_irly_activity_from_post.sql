-- Activities made from a post (« Create an activity » on a post card), and
-- coherent times when an activity is moved.
--
-- 1. activities.source_post_id uuid, null by default, references
--    community_posts (id) (community posts and profile posts; a Live is an
--    irl_posts row and lasts 4 hours, it is not a source). on delete set
--    null: removing the post never removes the plan.
-- 2. A guard on every write by a member:
--      * the creator may only link a post she can see (the read rules of
--        community_posts apply: the trigger is security invoker), and not a
--        removed one;
--      * one activity per (post, creator) in a short window (2 minutes):
--        a double tap or a retry with a new request id is refused with
--        23505 ('an activity was just created from this post'); the app
--        then opens the one already created. Two concurrent inserts are
--        serialised on an advisory lock, so both cannot pass the check;
--      * a plan made from a community's post stays in that community (same
--        community_id, so the same universe: an IRLY Girl post never becomes
--        a Mixte plan); a profile post (no community) leaves it free;
--      * afterwards the link can be kept or removed, never moved to another
--        post, and a linked plan never moves to another community (the team
--        may correct either).
-- 3. public.post_activities(p_post uuid, p_limit integer default 5): the
--    plans made from a post that the caller may see, for display under the
--    post. Security invoker (the read rules of activities apply: privacy,
--    IRLY Girl, moderation), and on top of them, as for an event's page:
--    cancelled, removed by the team and finished plans are left out, women-
--    only plans only for women with IRLY Girl access, nobody blocked either
--    way, friends-only and invite-only plans only for their host. Signed
--    out: refused. Its own post must be readable by the caller.
-- 4. Moving an activity into the past is refused for members (5 minutes of
--    tolerance for a slow network): an edit can only keep the time or move
--    it to a time still to come. Creation is unchanged (a Live's plan starts
--    now; the app's picker refuses a past time).
-- 5. Reminders follow the time: private.send_activity_reminders keeps
--    reading starts_at (105 to 120 minutes before), and now remembers the
--    start each reminder was sent for: an activity moved to a later time
--    gets its reminder again for the new time, never twice for the same one.
--
-- Tests: supabase/tests/activity_from_post.test.sql.

-- ───────── 1. The link ─────────
alter table public.activities add column if not exists source_post_id uuid
  references public.community_posts (id) on delete set null;

create index if not exists activities_source_post_idx on public.activities (source_post_id, creator_id, created_at desc)
  where source_post_id is not null;

-- ───────── 2. The guard ─────────
create or replace function private.activity_source_post_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  post_community uuid;
begin
  if new.source_post_id is null then return new; end if;
  if auth.uid() is null or pg_trigger_depth() > 1 or private.i_am_staff() then return new; end if;
  if tg_op = 'UPDATE' then
    if new.source_post_id is distinct from old.source_post_id then
      raise exception 'an activity stays with the post it was made from' using errcode = '42501';
    end if;
    if new.community_id is distinct from old.community_id then
      raise exception 'an activity made from a post stays in its community' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Read under the creator's own rules: a post she cannot see is "not available".
  select p.community_id into post_community from public.community_posts p where p.id = new.source_post_id and p.deleted_at is null;
  if not found then
    raise exception 'this post is not available' using errcode = '42501';
  end if;
  if post_community is not null and new.community_id is distinct from post_community then
    raise exception 'an activity made from a post stays in its community' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('activity-from-post:' || new.creator_id::text || ':' || new.source_post_id::text, 0));
  if exists (
    select 1 from public.activities a
    where a.source_post_id = new.source_post_id and a.creator_id = new.creator_id
      and a.cancelled_at is null and a.created_at > now() - interval '2 minutes'
  ) then
    raise exception 'an activity was just created from this post' using errcode = '23505';
  end if;
  return new;
end $$;
revoke all on function private.activity_source_post_guard() from public, anon;
grant execute on function private.activity_source_post_guard() to authenticated;

drop trigger if exists activities_source_post_guard on public.activities;
create trigger activities_source_post_guard before insert or update of source_post_id, community_id on public.activities
for each row execute function private.activity_source_post_guard();

-- ───────── 3. The plans made from a post ─────────
create or replace function public.post_activities(p_post uuid, p_limit integer default 5)
returns table (id uuid, title text, category_id text, sub_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, capacity integer, going integer, girl_only boolean,
  community_id uuid, community_name text, creator_id uuid, creator_name text, cover_url text, my_status text)
language plpgsql stable security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  girl boolean;
  blocked uuid[];
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_post is null or not exists (select 1 from public.community_posts p where p.id = p_post and p.deleted_at is null) then
    return;
  end if;
  girl := private.is_girl_eligible();
  blocked := private.my_block_ids();
  return query
  select a.id, a.title, a.category_id, a.sub_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, g.name,
    a.creator_id, p.first_name,
    coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = me)
  from public.activities a
  left join public.communities g on g.id = a.community_id and g.deleted_at is null
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where a.source_post_id = p_post
    and a.cancelled_at is null
    and a.moderated_at is null
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and (not a.girl_only or girl)
    and not (a.creator_id = any (blocked))
    and (a.creator_id = me
      or a.privacy = 'public'
      or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id)))
  order by a.starts_at, a.id
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
end $$;
revoke all on function public.post_activities(uuid, integer) from public, anon;
grant execute on function public.post_activities(uuid, integer) to authenticated;

-- ───────── 4. Never moved into the past ─────────
create or replace function private.activity_time_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.i_am_staff() then return new; end if;
  if new.starts_at is distinct from old.starts_at and new.starts_at < now() - interval '5 minutes' then
    raise exception 'an activity cannot be moved into the past' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.activity_time_guard() from public, anon, authenticated;

drop trigger if exists activities_time_guard on public.activities;
create trigger activities_time_guard before update of starts_at on public.activities
for each row execute function private.activity_time_guard();

-- ───────── 5. Reminders follow the time ─────────
create or replace function private.send_activity_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ap.user_id, a.id, a.title, a.starts_at
    from public.activities a
    join public.activity_participants ap on ap.activity_id = a.id and ap.status = 'going'
    where a.cancelled_at is null
      and a.starts_at > now() + interval '105 minutes' and a.starts_at <= now() + interval '120 minutes'
      and not exists (
        select 1 from public.notifications x
        where x.user_id = ap.user_id and x.kind = 'ACTIVITY_REMINDER' and x.payload ->> 'activity_id' = a.id::text
          -- A reminder sent before this migration (no start recorded) counts for the activity as it was.
          and (not (x.payload ? 'starts_at') or (x.payload ->> 'starts_at')::timestamptz = a.starts_at))
  loop
    perform private.notify(r.user_id, 'ACTIVITY_REMINDER', jsonb_build_object('activity_id', r.id, 'title', r.title, 'starts_at', r.starts_at));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.send_activity_reminders() from public, anon, authenticated;
