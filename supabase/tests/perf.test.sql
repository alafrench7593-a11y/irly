-- Speed (migration 20261020001100_irly_perf): irl_feed, activity_detail and
-- recommend_activities return exactly what they returned before, for a
-- viewer with friends, a stranger, a blocked member, a deleted member, a
-- hidden post, an expired post, a friends-only post and friends going.
-- The previous definitions are kept here as pg_temp copies and compared row
-- for row. Runs after irly_test.sql on the same database; every id here
-- starts with beef0000-, so nothing depends on the other test files.
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL perf: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- ───────── The definitions before this migration ─────────
create function pg_temp.old_irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer, media_ratio real)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds,
    i.media_ratio
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  left join public.activities a on a.id = i.activity_id
  where i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
    -- IRLY's Live only, since 20261024009300_irly_girl_spaces (IRLY Girl's posts are listed by irl_feed_girl).
    and i.app_scope = 'irly'
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
  order by i.created_at desc
  limit 100
$$;

create function pg_temp.old_activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer,
  currency text, capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text,
  my_status text, conversation_id uuid, cancelled boolean, sub_id text)
language sql stable set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null,
    a.sub_id
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.id = p_id
$$;

create function pg_temp.old_recommend(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text, city_id text)
language sql stable set search_path = public as $$
  with me as (
    select coalesce(p.interests, '{}') || coalesce(p.sports, '{}') || coalesce(p.activity_prefs, '{}') as tastes
    from public.profiles p where p.id = auth.uid()
  ),
  liked_cats as (
    select distinct a.category_id from public.activities a
    join (select target_id from public.likes where user_id = auth.uid() and target_type = 'activity'
          union select target_id from public.saves where user_id = auth.uid() and target_type = 'activity') t
      on t.target_id = a.id::text
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at, a.city_id,
      private.going_count(a.id) as going,
      (select count(*)::int from public.activity_participants x
        where x.activity_id = a.id and x.status = 'going' and private.are_friends(auth.uid(), x.user_id)) as friends_going,
      (a.category_id = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select tastes from me), '{}'))) as taste,
      a.category_id in (select category_id from liked_cats) as liked_before
    from public.activities a
    where a.city_id = any (private.city_scope(p_city)) and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      and not private.i_participate(a.id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or private.going_count(a.id) < a.capacity)
  )
  select s.id, s.title, s.format, s.category_id, s.area_id, s.starts_at, s.going, s.friends_going,
    (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
      + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10)
      + case when s.city_id = p_city then 12 else 0 end)::int,
    case when s.friends_going > 0 then 'friends_going' when s.taste then 'your_interests'
      when s.liked_before then 'you_liked_similar' when s.starts_at < now() + interval '2 days' then 'soon' else 'popular' end,
    s.city_id
  from scored s
  order by 9 desc, s.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;

-- ───────── Members and what they posted ─────────
select pg_temp.as_admin();
-- v: the viewer; f1, f2: v's friends; s: a stranger; b: blocked by v; d: deleted later; p: a friend of v whose
-- participations are private (activity_visibility nobody).
insert into auth.users (id) values
  ('beef0000-0000-0000-0000-0000000000a1'), ('beef0000-0000-0000-0000-0000000000a2'),
  ('beef0000-0000-0000-0000-0000000000a3'), ('beef0000-0000-0000-0000-0000000000a4'),
  ('beef0000-0000-0000-0000-0000000000a5'), ('beef0000-0000-0000-0000-0000000000a6'),
  ('beef0000-0000-0000-0000-0000000000a7');
insert into public.profiles (id, first_name, birthdate, gender, city_id, interests) values
  ('beef0000-0000-0000-0000-0000000000a1', 'Beefview', '1990-01-01', 'woman', 'dubai', '{sport}'),
  ('beef0000-0000-0000-0000-0000000000a2', 'Beeffriend', '1990-01-01', 'woman', 'dubai', '{}'),
  ('beef0000-0000-0000-0000-0000000000a3', 'Beeftwo', '1990-01-01', 'man', 'dubai', '{}'),
  ('beef0000-0000-0000-0000-0000000000a4', 'Beefstranger', '1990-01-01', 'man', 'dubai', '{}'),
  ('beef0000-0000-0000-0000-0000000000a5', 'Beefblocked', '1990-01-01', 'man', 'dubai', '{}'),
  ('beef0000-0000-0000-0000-0000000000a6', 'Beefgone', '1990-01-01', 'woman', 'dubai', '{}'),
  ('beef0000-0000-0000-0000-0000000000a7', 'Beefprivate', '1990-01-01', 'woman', 'dubai', '{}');
insert into public.safety_settings (user_id, activity_visibility) values ('beef0000-0000-0000-0000-0000000000a7', 'nobody')
on conflict (user_id) do update set activity_visibility = excluded.activity_visibility;
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('beef0000-0000-0000-0000-0000000000a1', 'beef0000-0000-0000-0000-0000000000a2', 'beef0000-0000-0000-0000-0000000000a1', 'accepted', now()),
  ('beef0000-0000-0000-0000-0000000000a1', 'beef0000-0000-0000-0000-0000000000a3', 'beef0000-0000-0000-0000-0000000000a3', 'accepted', now()),
  ('beef0000-0000-0000-0000-0000000000a1', 'beef0000-0000-0000-0000-0000000000a7', 'beef0000-0000-0000-0000-0000000000a1', 'accepted', now()),
  -- a request, not a friendship
  ('beef0000-0000-0000-0000-0000000000a1', 'beef0000-0000-0000-0000-0000000000a4', 'beef0000-0000-0000-0000-0000000000a4', 'pending', null);
insert into public.blocks (blocker_id, blocked_id) values ('beef0000-0000-0000-0000-0000000000a1', 'beef0000-0000-0000-0000-0000000000a5');

-- Activities in the coming days (the creator is its first participant, by trigger).
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, capacity, privacy) values
  ('beef0000-0000-0000-0000-0000000000b1', 'beef0000-0000-0000-0000-0000000000a4', 'Beef padel', 'sport', 'dubai', 'marina', now() + interval '1 day', null, 'public'),
  ('beef0000-0000-0000-0000-0000000000b2', 'beef0000-0000-0000-0000-0000000000a4', 'Beef brunch', 'food', 'sharjah', 'marina', now() + interval '5 days', 3, 'public'),
  ('beef0000-0000-0000-0000-0000000000b3', 'beef0000-0000-0000-0000-0000000000a5', 'Beef blocked run', 'sport', 'dubai', 'marina', now() + interval '2 days', null, 'public'),
  ('beef0000-0000-0000-0000-0000000000b4', 'beef0000-0000-0000-0000-0000000000a6', 'Beef gone walk', 'sport', 'dubai', 'marina', now() + interval '3 days', null, 'public'),
  ('beef0000-0000-0000-0000-0000000000b5', 'beef0000-0000-0000-0000-0000000000a2', 'Beef friends only', 'sport', 'dubai', 'marina', now() + interval '4 days', null, 'friends');
insert into public.activity_participants (activity_id, user_id) values
  ('beef0000-0000-0000-0000-0000000000b1', 'beef0000-0000-0000-0000-0000000000a2'),
  ('beef0000-0000-0000-0000-0000000000b1', 'beef0000-0000-0000-0000-0000000000a3'),
  ('beef0000-0000-0000-0000-0000000000b1', 'beef0000-0000-0000-0000-0000000000a7'),
  ('beef0000-0000-0000-0000-0000000000b2', 'beef0000-0000-0000-0000-0000000000a2'),
  ('beef0000-0000-0000-0000-0000000000b4', 'beef0000-0000-0000-0000-0000000000a3');
insert into public.activity_participants (activity_id, user_id, status) values
  ('beef0000-0000-0000-0000-0000000000b2', 'beef0000-0000-0000-0000-0000000000a3', 'maybe');

-- Live posts: friends-only by a friend, everyone and friends-only by the stranger, by the blocked
-- and the deleted member, mine, a hidden one, an expired one, one pointing at an activity.
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility, activity_id, created_at, expires_at) values
  ('beef0000-0000-0000-0000-0000000000c1', 'beef0000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'beef friend', 'friends', null, now() - interval '1 minute', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c2', 'beef0000-0000-0000-0000-0000000000a4', 'sharjah', 'marina', 'beef stranger', 'everyone', 'beef0000-0000-0000-0000-0000000000b1', now() - interval '2 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c3', 'beef0000-0000-0000-0000-0000000000a4', 'dubai', 'marina', 'beef stranger friends', 'friends', null, now() - interval '3 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c4', 'beef0000-0000-0000-0000-0000000000a5', 'dubai', 'marina', 'beef blocked', 'everyone', null, now() - interval '4 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c5', 'beef0000-0000-0000-0000-0000000000a6', 'dubai', 'marina', 'beef gone', 'everyone', null, now() - interval '5 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c6', 'beef0000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'beef mine', 'friends', null, now() - interval '6 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c7', 'beef0000-0000-0000-0000-0000000000a3', 'dubai', 'marina', 'beef hidden', 'everyone', null, now() - interval '7 minutes', now() + interval '3 hours'),
  ('beef0000-0000-0000-0000-0000000000c8', 'beef0000-0000-0000-0000-0000000000a3', 'dubai', 'marina', 'beef expired', 'everyone', null, now() - interval '5 hours', now() - interval '1 hour');
insert into public.hidden_items (user_id, target_type, target_id) values
  ('beef0000-0000-0000-0000-0000000000a1', 'irl_post', 'beef0000-0000-0000-0000-0000000000c7');
update public.profiles set deleted_at = now() where id = 'beef0000-0000-0000-0000-0000000000a6';

-- ───────── Same rows as before, for each viewer ─────────
create or replace function pg_temp.same_everywhere(who text) returns void language plpgsql as $$
declare a uuid; c text;
begin
  foreach c in array array['dubai', 'sharjah', 'bali'] loop
    perform pg_temp.check(not exists (
      (select * from pg_temp.old_irl_feed(c) except all select * from public.irl_feed(c))
      union all (select * from public.irl_feed(c) except all select * from pg_temp.old_irl_feed(c))),
      format('irl_feed(%s) as %s: same rows as before', c, who));
    perform pg_temp.check(not exists (
      (select * from pg_temp.old_recommend(c, 50) except all select * from public.recommend_activities(c, 50))
      union all (select * from public.recommend_activities(c, 50) except all select * from pg_temp.old_recommend(c, 50))),
      format('recommend_activities(%s) as %s: same rows as before', c, who));
    perform pg_temp.check(
      (select array_agg(r.id order by r.ord) from (select x.id, row_number() over () ord from pg_temp.old_recommend(c, 50) x) r)
        is not distinct from (select array_agg(r.id order by r.ord) from (select x.id, row_number() over () ord from public.recommend_activities(c, 50) x) r),
      format('recommend_activities(%s) as %s: same order as before', c, who));
  end loop;
  -- Every one of them, also those this viewer may not see (no row, before and after).
  foreach a in array array['beef0000-0000-0000-0000-0000000000b1', 'beef0000-0000-0000-0000-0000000000b2', 'beef0000-0000-0000-0000-0000000000b3',
                           'beef0000-0000-0000-0000-0000000000b4', 'beef0000-0000-0000-0000-0000000000b5']::uuid[] loop
    perform pg_temp.check(not exists (
      (select * from pg_temp.old_activity_detail(a) except all select * from public.activity_detail(a))
      union all (select * from public.activity_detail(a) except all select * from pg_temp.old_activity_detail(a))),
      format('activity_detail(%s) as %s: same row as before', right(a::text, 2), who));
  end loop;
end $$;

select pg_temp.as_user('beef0000-0000-0000-0000-0000000000a1');
select pg_temp.same_everywhere('the viewer');
-- What the viewer gets, spelled out (not only "same as before").
select pg_temp.check((select array_agg(body order by created_at desc) from public.irl_feed('dubai') where body like 'beef%')
  = array['beef friend', 'beef stranger', 'beef mine'], 'Live: friends-only of a friend, everyone posts and mine; never the blocked, deleted, hidden, expired or friends-only of a stranger');
select pg_temp.check((select activity_title from public.irl_feed('dubai') where id = 'beef0000-0000-0000-0000-0000000000c2') = 'Beef padel', 'Live: the post names its activity');
select pg_temp.check((select friend from public.irl_feed('dubai') where id = 'beef0000-0000-0000-0000-0000000000c1'), 'Live: a friend''s post says friend');
select pg_temp.check((select friends_going from public.recommend_activities('dubai', 50) where id = 'beef0000-0000-0000-0000-0000000000b1') = 2,
  'recommended: two friends going (a private participation and a non-friend are not counted)');
select pg_temp.check((select reason from public.recommend_activities('dubai', 50) where id = 'beef0000-0000-0000-0000-0000000000b1') = 'friends_going', 'recommended because friends are going');
select pg_temp.check((select friends_going from public.recommend_activities('dubai', 50) where id = 'beef0000-0000-0000-0000-0000000000b2') = 1,
  'recommended: a friend who only says maybe is not going');
select pg_temp.check(not exists (select 1 from public.recommend_activities('dubai', 50) where id = 'beef0000-0000-0000-0000-0000000000b3'), 'recommended: never a blocked member''s activity');
select pg_temp.check((select creator_name from public.activity_detail('beef0000-0000-0000-0000-0000000000b1')) = 'Beefstranger', 'activity page: the creator''s first name');
select pg_temp.check((select creator_name is null and title = 'Beef gone walk' from public.activity_detail('beef0000-0000-0000-0000-0000000000b4')), 'activity page: a deleted creator has no name, the activity still shows');

select pg_temp.as_user('beef0000-0000-0000-0000-0000000000a4');
select pg_temp.same_everywhere('a stranger');
select pg_temp.as_user('beef0000-0000-0000-0000-0000000000a2');
select pg_temp.same_everywhere('a friend');
select pg_temp.as_user('beef0000-0000-0000-0000-0000000000a5');
select pg_temp.same_everywhere('the blocked member');

select pg_temp.as_admin();
\echo perf tests passed
