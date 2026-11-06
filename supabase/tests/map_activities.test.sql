-- Activities on the Map tab (20261109300000_irly_map_activities.sql): every
-- plan a member may see is on the map, the same plans as the activities list,
-- at its meeting point (exact) or around its neighbourhood (never stacked).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9a50000-….
--
--   a1 Wafa  woman, IRLY Girl access (viewer)
--   a2 Marc  man, outsider (viewer)
--   a3 Kian  man, member of the community « Map Pin Runners » (viewer)
--   a4 Bob   man, blocked the host Hana (viewer)
--   a5 Hana  woman, host of most plans
--   a6 Fadi  man, Hana's friend (viewer)
--   a7 Omar  man, host of one open plan
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL map_activities: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- The test plans on a viewer's map, as a sorted list of titles.
create or replace function pg_temp.pins(p_girl boolean) returns text language plpgsql as $$
declare r text;
begin
  select coalesce(string_agg(m.title, ',' order by m.title collate "C"), '') into r
  from public.map_activity_pins('dubai', p_girl_only => p_girl) m where m.id::text like 'c9a50000-%';
  return r;
end $$;
-- The test plans of the activities list as the app reads it (the table under
-- its read rule, upcoming or happening now, one space at a time), same format.
create or replace function pg_temp.listed(p_girl boolean) returns text language plpgsql as $$
declare r text;
begin
  select coalesce(string_agg(a.title, ',' order by a.title collate "C"), '') into r
  from public.activities a
  where a.id::text like 'c9a50000-%' and a.city_id = any (private.city_scope('dubai'))
    and a.cancelled_at is null and a.starts_at >= now() - interval '2 hours'
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and a.girl_only = p_girl;
  return r;
end $$;

begin;
select pg_temp.as_admin();
insert into auth.users (id) values
  ('c9a50000-0000-0000-0000-0000000000a1'), ('c9a50000-0000-0000-0000-0000000000a2'), ('c9a50000-0000-0000-0000-0000000000a3'),
  ('c9a50000-0000-0000-0000-0000000000a4'), ('c9a50000-0000-0000-0000-0000000000a5'), ('c9a50000-0000-0000-0000-0000000000a6'),
  ('c9a50000-0000-0000-0000-0000000000a7');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('c9a50000-0000-0000-0000-0000000000a1', 'Wafa', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('c9a50000-0000-0000-0000-0000000000a2', 'Marc', '1993-01-01', 'man', 'dubai', 'marina'),
  ('c9a50000-0000-0000-0000-0000000000a3', 'Kian', '1992-01-01', 'man', 'dubai', 'jlt'),
  ('c9a50000-0000-0000-0000-0000000000a4', 'Bob', '1991-01-01', 'man', 'dubai', 'jlt'),
  ('c9a50000-0000-0000-0000-0000000000a5', 'Hana', '1990-01-01', 'woman', 'dubai', 'marina'),
  ('c9a50000-0000-0000-0000-0000000000a6', 'Fadi', '1989-01-01', 'man', 'dubai', 'downtown'),
  ('c9a50000-0000-0000-0000-0000000000a7', 'Omar', '1988-01-01', 'man', 'dubai', 'deira');
insert into public.blocks (blocker_id, blocked_id) values ('c9a50000-0000-0000-0000-0000000000a4', 'c9a50000-0000-0000-0000-0000000000a5');
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('c9a50000-0000-0000-0000-0000000000a5', 'c9a50000-0000-0000-0000-0000000000a6', 'c9a50000-0000-0000-0000-0000000000a5', 'accepted', now());
insert into public.communities (id, city_id, name, category_id, created_by) values
  ('c9a50000-0000-0000-0000-0000000000c1', 'dubai', 'Map Pin Runners', 'sport', 'c9a50000-0000-0000-0000-0000000000a5');
insert into public.community_members (community_id, user_id, role) values
  ('c9a50000-0000-0000-0000-0000000000c1', 'c9a50000-0000-0000-0000-0000000000a5', 'owner'),
  ('c9a50000-0000-0000-0000-0000000000c1', 'c9a50000-0000-0000-0000-0000000000a3', 'member')
on conflict do nothing;
-- A listed place with coordinates, and two listed places sharing one name.
insert into public.places (id, slug, city_id, area_id, name, kind, lat, lng) values
  ('c9a50000-0000-0000-0000-0000000000f1', 'c9a5-map-pin-court', 'dubai', 'jlt', 'Map Pin Court', 'court', 25.07100, 55.14100),
  ('c9a50000-0000-0000-0000-0000000000f2', 'c9a5-twin-cafe-1', 'dubai', 'marina', 'Map Twin Cafe', 'cafe', 25.08000, 55.14000),
  ('c9a50000-0000-0000-0000-0000000000f3', 'c9a5-twin-cafe-2', 'dubai', 'downtown', 'Map Twin Cafe', 'cafe', 25.19700, 55.27400);
commit;

-- ───────── The plans (created as their hosts, as the app does) ─────────
select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a5');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, place_name) values
  ('c9a50000-0000-0000-0000-0000000000b1', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin open walk', 'outdoor', 'dubai', 'marina', now() + interval '1 day', null),
  ('c9a50000-0000-0000-0000-0000000000b2', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin padel', 'sport', 'dubai', 'jlt', now() + interval '2 days', 'Map Pin Court, court 2'),
  ('c9a50000-0000-0000-0000-0000000000b9', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin open coffee', 'food', 'dubai', 'marina', now() + interval '3 days', 'Map Twin Cafe'),
  ('c9a50000-0000-0000-0000-0000000000ba', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin far away', 'culture', 'dubai', 'nowhere-known', now() + interval '3 days', null);
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('c9a50000-0000-0000-0000-0000000000b3', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin girls brunch', 'food', 'dubai', 'marina', now() + interval '1 day', true, 'girls');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, privacy) values
  ('c9a50000-0000-0000-0000-0000000000b4', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin members run', 'sport', 'dubai', 'marina', now() + interval '1 day',
    'c9a50000-0000-0000-0000-0000000000c1', 'community');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy) values
  ('c9a50000-0000-0000-0000-0000000000b5', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin friends dinner', 'food', 'dubai', 'downtown', now() + interval '1 day', 'friends'),
  ('c9a50000-0000-0000-0000-0000000000b6', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin invite only', 'food', 'dubai', 'downtown', now() + interval '1 day', 'invite'),
  ('c9a50000-0000-0000-0000-0000000000b7', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin cancelled', 'food', 'dubai', 'downtown', now() + interval '1 day', 'public');
update public.activities set cancelled_at = now() where id = 'c9a50000-0000-0000-0000-0000000000b7';
select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a7');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('c9a50000-0000-0000-0000-0000000000b8', 'c9a50000-0000-0000-0000-0000000000a7', 'Pin Omar quiz', 'entertainment', 'dubai', 'marina', now() + interval '1 day');
-- A plan already over (5 hours ago, for an hour).
select pg_temp.as_admin();
set session_replication_role = replica;
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, ends_at) values
  ('c9a50000-0000-0000-0000-0000000000bb', 'c9a50000-0000-0000-0000-0000000000a5', 'Pin finished', 'sport', 'dubai', 'marina', now() - interval '5 hours', now() - interval '4 hours');
set session_replication_role = origin;

-- ───────── Coordinates from the app's own place data ─────────
select pg_temp.check((select place_id = 'c9a50000-0000-0000-0000-0000000000f1' and geo_source = 'place' and lat = 25.071 from public.activities where id = 'c9a50000-0000-0000-0000-0000000000b2'),
  'a listed place typed by its name (with a detail) gives the plan its coordinates');
select pg_temp.check((select place_id is null and lat is null from public.activities where id = 'c9a50000-0000-0000-0000-0000000000b9'),
  'two listed places with that name: none is guessed');
select pg_temp.check((select place_id is null and lat is null from public.activities where id = 'c9a50000-0000-0000-0000-0000000000b1'),
  'no place: no coordinates stored on the plan (the map places it around its neighbourhood)');
select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a5');
update public.activities set place_name = 'map pin court' where id = 'c9a50000-0000-0000-0000-0000000000b9';
select pg_temp.check((select place_id = 'c9a50000-0000-0000-0000-0000000000f1' and lat = 25.071 from public.activities where id = 'c9a50000-0000-0000-0000-0000000000b9'),
  'renamed to a listed place (any case): it takes that place''s coordinates');
update public.activities set place_name = 'Map Twin Cafe' where id = 'c9a50000-0000-0000-0000-0000000000b9';
select pg_temp.check((select place_id is null and lat is null from public.activities where id = 'c9a50000-0000-0000-0000-0000000000b9'),
  'renamed away from it: the old point is dropped, never kept under another name');

-- ───────── Parity with the activities list, viewer by viewer ─────────
select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false), 'woman, IRLY map = her list: ' || pg_temp.pins(false));
select pg_temp.check(pg_temp.pins(false) = 'Pin Omar quiz,Pin far away,Pin open coffee,Pin open walk,Pin padel',
  'woman, IRLY map: open plans only (no members-only, friends, invite, cancelled, finished or women-only plan)');
select pg_temp.check(pg_temp.pins(true) = pg_temp.listed(true) and pg_temp.pins(true) = 'Pin girls brunch', 'woman, IRLY Girl map: the women-only plan, as in her IRLY Girl list');

select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false), 'man (outsider), IRLY map = his list');
select pg_temp.check(position('Pin girls brunch' in pg_temp.pins(false)) = 0 and position('Pin members run' in pg_temp.pins(false)) = 0,
  'man (outsider): no women-only plan, no members-only plan');
select pg_temp.check(pg_temp.fails('select * from public.map_activity_pins(''dubai'', p_girl_only => true)') = '42501', 'man: the IRLY Girl map is refused');
select pg_temp.check(not exists (select 1 from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000b3'),
  'man, no space given: still never the women-only plan');

select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false) and position('Pin members run' in pg_temp.pins(false)) > 0,
  'community member: the members-only plan is on his map, as in his list');
select pg_temp.check(exists (select 1 from public.map_activity_pins('dubai', p_community => 'c9a50000-0000-0000-0000-0000000000c1') m
  where m.id = 'c9a50000-0000-0000-0000-0000000000b4' and m.community_name = 'Map Pin Runners'), 'community filter, with the community''s name');

select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false) and pg_temp.pins(false) = 'Pin Omar quiz', 'blocked: none of Hana''s plans, Omar''s still');

select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a6');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false) and position('Pin friends dinner' in pg_temp.pins(false)) > 0
  and position('Pin invite only' in pg_temp.pins(false)) = 0, 'friend: the friends-only plan, never the invite-only one');

select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.pins(false) = pg_temp.listed(false) and position('Pin invite only' in pg_temp.pins(false)) > 0
  and position('Pin cancelled' in pg_temp.pins(false)) = 0 and position('Pin finished' in pg_temp.pins(false)) = 0,
  'host: her own private plans, never a cancelled or finished one');

-- ───────── Where the pins are ─────────
select pg_temp.as_user('c9a50000-0000-0000-0000-0000000000a2');
select pg_temp.check((select precise and abs(lat - 25.071) < 0.000001 and abs(lng - 55.141) < 0.000001 from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000b2'),
  'a plan at a listed place: its exact point');
select pg_temp.check((select not precise and address is null and area_id = 'marina'
    and abs(lat - 25.0805) between 0 and 0.004 and abs(lng - 55.1403) <= 0.005 and (lat, lng) <> (25.0805, 55.1403)
  from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000b1'),
  'no place: around its neighbourhood''s centre (a few hundred metres), never on it, flagged as approximate');
select pg_temp.check((select count(distinct (lat, lng)) = 2 from public.map_activity_pins('dubai')
  where id in ('c9a50000-0000-0000-0000-0000000000b1', 'c9a50000-0000-0000-0000-0000000000b8')), 'two plans of one neighbourhood never stack on one point');
select pg_temp.check((select lat from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000b1')
  = (select lat from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000b1'), 'the offset is fixed (the pin does not move between reads)');
select pg_temp.check((select not precise and lat between 24.5 and 25.5 and lng between 54.9 and 55.6 from public.map_activity_pins('dubai') where id = 'c9a50000-0000-0000-0000-0000000000ba'),
  'a neighbourhood with no known centre: around the middle of its city, never left off the map');
select pg_temp.check(exists (select 1 from public.map_activity_pins('dubai', p_lat => 25.0805, p_lng => 55.1403, p_km => 2) where id = 'c9a50000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.map_activity_pins('dubai', p_lat => 25.27, p_lng => 55.31, p_km => 2) where id = 'c9a50000-0000-0000-0000-0000000000b1'), 'distance filter on the pin');
select pg_temp.check(exists (select 1 from public.map_activity_pins('dubai', p_category => 'sport') where id = 'c9a50000-0000-0000-0000-0000000000b2')
  and not exists (select 1 from public.map_activity_pins('dubai', p_category => 'food') where id = 'c9a50000-0000-0000-0000-0000000000b2'), 'category filter');
select pg_temp.check(not exists (select 1 from public.map_activity_pins('dubai', p_to => now() + interval '12 hours') where id = 'c9a50000-0000-0000-0000-0000000000b1'), 'time filter (today)');
select pg_temp.check(not exists (select 1 from public.map_activity_pins('bali') where id = 'c9a50000-0000-0000-0000-0000000000b1'), 'another country: not on its map');

-- ───────── Nothing about people ─────────
select pg_temp.check(pg_get_function_result('public.map_activity_pins(text, timestamp with time zone, timestamp with time zone, text, uuid, double precision, double precision, double precision, integer, boolean)'::regprocedure)
  !~* '(creator|user|host|member|profile)', 'the pins name no member (meeting points only)');
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails('select * from public.map_activity_pins(''dubai'')') = '42501', 'visitors cannot read the pins');
select pg_temp.as_admin();

-- ───────── Clean up ─────────
delete from public.activities where id::text like 'c9a50000-%';
delete from public.communities where id = 'c9a50000-0000-0000-0000-0000000000c1';
delete from public.places where id::text like 'c9a50000-%';
delete from public.blocks where blocker_id = 'c9a50000-0000-0000-0000-0000000000a4';
delete from public.friendships where user_a = 'c9a50000-0000-0000-0000-0000000000a5';
delete from public.profiles where id::text like 'c9a50000-%';
delete from auth.users where id::text like 'c9a50000-%';
