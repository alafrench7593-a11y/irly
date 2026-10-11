-- Engagement, from real activity only: today's activities, a feed from the
-- member's communities and people, group suggestions, badges earned by
-- what members really did, collective challenges with real counts, and a
-- recap of what was missed. No invented people, activities or numbers,
-- no streaks, no push to come back: these are read when the member opens IRLY.

create or replace function private.city_tz(p_city text) returns text
language sql immutable as $$
  select case when p_city = 'bali' then 'Asia/Makassar' else 'Asia/Dubai' end
$$;

-- Today in the city: activities starting later today (or started less than
-- two hours ago), the ones the member may see (read rules apply), with what
-- is useful: time, place, organiser, spots left, people going (a count).
create or replace function public.today_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, category_id text, starts_at timestamptz, ends_at timestamptz, area_id text, place_name text,
  organizer_id uuid, organizer_name text, going integer, capacity integer, spots_left integer, cover_path text, i_go boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.category_id, a.starts_at, a.ends_at, a.area_id, a.place_name,
    a.creator_id, p.first_name, private.going_count(a.id), a.capacity,
    case when a.capacity is null then null else greatest(a.capacity - private.going_count(a.id), 0) end,
    a.cover_path,
    exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid() and x.status = 'going')
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.cancelled_at is null
    and a.city_id = any (private.city_scope(p_city))
    and a.starts_at > now() - interval '2 hours'
    and (a.starts_at at time zone private.city_tz(a.city_id))::date = (now() at time zone private.city_tz(a.city_id))::date
  order by a.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;

-- For you: recent posts from the member's communities and groups, and from
-- people they follow or are friends with, most discussed first within a week.
create or replace function public.for_you_feed(p_limit integer default 20)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text, kind text,
  media_paths text[], media_kind text, created_at timestamptz, comments integer, likes integer, liked boolean, why text)
language sql stable security invoker set search_path = public as $$
  with mine as (
    select community_id from public.community_members where user_id = auth.uid()
  ), people as (
    select followee_id as uid from public.follows where follower_id = auth.uid()
    union select case when f.user_a = auth.uid() then f.user_b else f.user_a end from public.friendships f
      where f.status = 'accepted' and auth.uid() in (f.user_a, f.user_b)
  )
  select p.id, p.community_id, c.name, p.author_id, a.first_name, p.body, p.kind, p.media_paths, p.media_kind, p.created_at,
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    case when p.community_id in (select community_id from mine) then 'community' else 'people' end
  from public.community_posts p
  left join public.communities c on c.id = p.community_id
  left join public.profiles_public a on a.id = p.author_id
  where p.deleted_at is null and p.author_id <> auth.uid()
    and p.created_at > now() - interval '7 days'
    and (p.community_id in (select community_id from mine) or p.author_id in (select uid from people))
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'community_post' and h.target_id = p.id::text)
  order by (select count(*) from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null) * 2
    + (select count(*) from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text)
    - extract(epoch from now() - p.created_at) / 21600 desc
  limit least(greatest(p_limit, 1), 50)
$$;

-- Groups to join: in the member's communities first, then official groups
-- whose topic matches what they said they like; the most active first.
create or replace function public.suggest_groups(p_city text, p_limit integer default 8)
returns table (id uuid, name text, emoji text, parent_id uuid, parent_name text, members integer, posts_week integer, reason text)
language sql stable security invoker set search_path = public as $$
  with me as (
    select coalesce(interests, '{}') || coalesce(activity_prefs, '{}') || coalesce(sports, '{}') as likes
    from public.profiles where id = auth.uid()
  )
  select g.id, g.name, g.emoji, g.parent_id, par.name,
    (select count(*)::int from public.community_members m where m.community_id = g.id),
    (select count(*)::int from public.community_posts x where x.community_id = g.id and x.deleted_at is null and x.created_at > now() - interval '7 days'),
    case when private.i_belong(g.parent_id) then 'in_your_community' else 'your_interests' end
  from public.communities g
  join public.communities par on par.id = g.parent_id and par.deleted_at is null
  cross join me
  where g.deleted_at is null and g.parent_id is not null
    and g.city_id = any (private.city_scope(p_city))
    and not private.i_belong(g.id)
    and (private.i_belong(g.parent_id) or g.subtopic = any (me.likes) or lower(g.name) = any (me.likes))
  order by private.i_belong(g.parent_id) desc, 7 desc, 6 desc
  limit least(greatest(p_limit, 1), 20)
$$;

-- Badges a member earned by what they really did (shown on profiles).
create or replace function public.member_badges(p_user uuid)
returns table (badge text, level integer, count integer)
language plpgsql stable security definer set search_path = public as $$
declare
  organised integer;
  helped integer;
  joined integer;
begin
  if p_user is null or private.blocked_unchecked(auth.uid(), p_user) then return; end if;
  -- Activities they organised that happened with at least one other person.
  select count(*) into organised from public.activities a
  where a.creator_id = p_user and a.cancelled_at is null and a.starts_at < now()
    and exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id <> p_user and x.status = 'going');
  -- Answers in Help & Questions that someone found useful (liked).
  select count(*) into helped from public.comments k
  join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question' and q.deleted_at is null
  where k.author_id = p_user and k.deleted_at is null and q.author_id <> p_user
    and exists (select 1 from public.likes l where l.target_type = 'comment' and l.target_id = k.id::text and l.user_id <> p_user);
  -- Activities they went to (in the past).
  select count(*) into joined from public.activity_participants x join public.activities a on a.id = x.activity_id
  where x.user_id = p_user and x.status = 'going' and a.cancelled_at is null and a.starts_at < now() and a.creator_id <> p_user;
  if organised > 0 then return query select 'organizer', case when organised >= 20 then 3 when organised >= 5 then 2 else 1 end, organised; end if;
  if helped > 0 then return query select 'helper', case when helped >= 50 then 3 when helped >= 10 then 2 else 1 end, helped; end if;
  if joined > 0 then return query select 'explorer', case when joined >= 30 then 3 when joined >= 10 then 2 else 1 end, joined; end if;
end $$;

-- This month in the city, together: real counts against shared goals, and
-- the member's own part. Goals are fixed, the counts are what happened.
create or replace function public.city_challenges(p_city text)
returns table (challenge text, goal integer, done integer, mine integer)
language sql stable security definer set search_path = public as $$
  with month as (
    select date_trunc('month', now() at time zone private.city_tz(p_city)) at time zone private.city_tz(p_city) as start
  )
  select 'activities', 100,
    (select count(*)::int from public.activities a, month where a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now()
      and exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id <> a.creator_id and x.status = 'going')),
    (select count(*)::int from public.activity_participants x join public.activities a on a.id = x.activity_id, month
      where x.user_id = auth.uid() and x.status = 'going' and a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now())
  union all
  select 'places', 50,
    (select count(distinct coalesce(a.place_id::text, a.place_name))::int from public.activities a, month where a.city_id = p_city and a.cancelled_at is null
      and a.starts_at >= month.start and a.starts_at < now() and coalesce(a.place_id::text, a.place_name) is not null),
    (select count(distinct coalesce(a.place_id::text, a.place_name))::int from public.activity_participants x join public.activities a on a.id = x.activity_id, month
      where x.user_id = auth.uid() and x.status = 'going' and a.city_id = p_city and a.cancelled_at is null and a.starts_at >= month.start and a.starts_at < now()
      and coalesce(a.place_id::text, a.place_name) is not null)
  union all
  select 'answers', 200,
    (select count(*)::int from public.comments k join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question'
      join public.communities g on g.id = q.community_id, month
      where g.city_id = p_city and k.deleted_at is null and k.created_at >= month.start),
    (select count(*)::int from public.comments k join public.community_posts q on q.id::text = k.target_id and k.target_type = 'community_post' and q.kind = 'question', month
      where k.author_id = auth.uid() and k.deleted_at is null and k.created_at >= month.start)
$$;

-- What the member missed since a moment (their last visit, kept by the app):
-- discussions in their communities, their next activities, what is new in
-- their communities, and activities that match what they like.
create or replace function public.my_recap(p_city text, p_since timestamptz default null)
returns table (section text, ref_id uuid, title text, detail text, at timestamptz, n integer)
language sql stable security invoker set search_path = public as $$
  with since as (select greatest(coalesce(p_since, now() - interval '7 days'), now() - interval '30 days') as t),
  mine as (select community_id from public.community_members where user_id = auth.uid()),
  me as (select coalesce(interests, '{}') || coalesce(activity_prefs, '{}') as likes from public.profiles where id = auth.uid())
  (select 'discussion', p.id, left(p.body, 120), c.name, p.created_at,
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null and k.created_at > since.t)
  from public.community_posts p join public.communities c on c.id = p.community_id, since
  where p.deleted_at is null and p.community_id in (select community_id from mine) and p.author_id <> auth.uid()
    and (p.created_at > since.t or exists (select 1 from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.created_at > since.t))
  order by 6 desc, p.created_at desc limit 5)
  union all
  (select 'upcoming', a.id, a.title, a.place_name, a.starts_at, private.going_count(a.id)
  from public.activities a join public.activity_participants x on x.activity_id = a.id and x.user_id = auth.uid() and x.status = 'going'
  where a.cancelled_at is null and a.starts_at > now() and a.starts_at < now() + interval '7 days'
  order by a.starts_at limit 5)
  union all
  (select 'community', c.id, c.name, null,
    (select max(m.joined_at) from public.community_members m where m.community_id = c.id),
    (select count(*)::int from public.community_members m, since where m.community_id = c.id and m.joined_at > since.t and m.user_id <> auth.uid())
  from public.communities c
  where c.id in (select community_id from mine) and c.deleted_at is null
    and exists (select 1 from public.community_members m, since where m.community_id = c.id and m.joined_at > since.t and m.user_id <> auth.uid())
  order by 6 desc limit 3)
  union all
  (select 'for_you', a.id, a.title, a.place_name, a.starts_at, private.going_count(a.id)
  from public.activities a, me
  where a.cancelled_at is null and a.starts_at > now() and a.starts_at < now() + interval '7 days'
    and a.city_id = any (private.city_scope(p_city))
    and a.creator_id <> auth.uid()
    and (a.category_id = any (me.likes) or a.sub_id = any (me.likes) or a.catalog_activity_id = any (me.likes))
    and not exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid())
  order by a.starts_at limit 5)
$$;

revoke all on function public.today_activities(text, integer), public.for_you_feed(integer), public.suggest_groups(text, integer),
  public.member_badges(uuid), public.city_challenges(text), public.my_recap(text, timestamptz) from public, anon;
grant execute on function public.today_activities(text, integer), public.for_you_feed(integer), public.suggest_groups(text, integer),
  public.member_badges(uuid), public.city_challenges(text), public.my_recap(text, timestamptz) to authenticated;
