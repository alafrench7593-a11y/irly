-- IRLY Map (20261026000000_irly_map_audit.sql): who appears on the map, to
-- whom, and at what precision; activities one space at a time.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed cb000000-….
--
--   b1 Mia   woman, IRLY Girl access (viewer)
--   b2 Tom   man (viewer), on the IRLY map
--   c1 Lina  woman, on both maps, Marina
--   c2 Omar  man, on the IRLY map, JBR
--   c3 Nora  woman, never opted in (hosts an open plan)
--   c4 Rita  woman, opted in but location « City only »
--   c5 Sami  man, opted in, profile visible to nobody
--   c6 Ben   man, opted in, blocked by Tom
--   c7 Lou   woman, on the IRLY Girl map, suspended from IRLY Girl
--   c8 Zed   man, opted in, suspended by moderators
--   c9 Del   man, opted in, account closed
--   ca Ana   woman, on the IRLY Girl map only
--   cb Kim   man, opted in, no neighbourhood
--   cc Ari   woman, on both maps, in Bali (another country)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
    raise exception 'FAIL map_audit: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- The people a viewer gets on a map, as a sorted list of first names.
create or replace function pg_temp.people(p_city text, p_girl boolean) returns text language plpgsql as $$
declare r text;
begin
  select coalesce(string_agg(m.first_name, ',' order by m.first_name), '') into r from public.map_people(p_city, p_girl) m
  where m.user_id::text like 'cb000000-%';
  return r;
end $$;

begin;
select pg_temp.as_admin();
insert into auth.users (id) values
  ('cb000000-0000-0000-0000-0000000000b1'), ('cb000000-0000-0000-0000-0000000000b2'),
  ('cb000000-0000-0000-0000-0000000000c1'), ('cb000000-0000-0000-0000-0000000000c2'), ('cb000000-0000-0000-0000-0000000000c3'),
  ('cb000000-0000-0000-0000-0000000000c4'), ('cb000000-0000-0000-0000-0000000000c5'), ('cb000000-0000-0000-0000-0000000000c6'),
  ('cb000000-0000-0000-0000-0000000000c7'), ('cb000000-0000-0000-0000-0000000000c8'), ('cb000000-0000-0000-0000-0000000000c9'),
  ('cb000000-0000-0000-0000-0000000000ca'), ('cb000000-0000-0000-0000-0000000000cb'), ('cb000000-0000-0000-0000-0000000000cc');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('cb000000-0000-0000-0000-0000000000b1', 'Mia', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000b2', 'Tom', '1993-01-01', 'man', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c1', 'Lina', '1995-02-02', 'woman', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c2', 'Omar', '1992-03-03', 'man', 'dubai', 'jbr'),
  ('cb000000-0000-0000-0000-0000000000c3', 'Nora', '1991-04-04', 'woman', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c4', 'Rita', '1990-05-05', 'woman', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c5', 'Sami', '1989-06-06', 'man', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c6', 'Ben', '1988-07-07', 'man', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c7', 'Lou', '1996-08-08', 'woman', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c8', 'Zed', '1987-09-09', 'man', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000c9', 'Del', '1986-10-10', 'man', 'dubai', 'marina'),
  ('cb000000-0000-0000-0000-0000000000ca', 'Ana', '1997-11-11', 'woman', 'dubai', 'jbr'),
  ('cb000000-0000-0000-0000-0000000000cb', 'Kim', '1985-12-12', 'man', 'dubai', null),
  ('cb000000-0000-0000-0000-0000000000cc', 'Ari', '1998-01-02', 'woman', 'bali', 'canggu');
insert into public.safety_settings (user_id, profile_visibility, location_precision, map_visible, map_visible_girl) values
  ('cb000000-0000-0000-0000-0000000000b2', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000c1', 'everyone', 'area', true, true),
  ('cb000000-0000-0000-0000-0000000000c2', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000c4', 'everyone', 'city', true, true),
  ('cb000000-0000-0000-0000-0000000000c5', 'nobody', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000c6', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000c7', 'everyone', 'area', false, true),
  ('cb000000-0000-0000-0000-0000000000c8', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000c9', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000ca', 'everyone', 'area', false, true),
  ('cb000000-0000-0000-0000-0000000000cb', 'everyone', 'area', true, false),
  ('cb000000-0000-0000-0000-0000000000cc', 'everyone', 'area', true, true)
on conflict (user_id) do update set profile_visibility = excluded.profile_visibility, location_precision = excluded.location_precision,
  map_visible = excluded.map_visible, map_visible_girl = excluded.map_visible_girl;
insert into public.blocks (blocker_id, blocked_id) values ('cb000000-0000-0000-0000-0000000000b2', 'cb000000-0000-0000-0000-0000000000c6');
insert into public.girl_suspensions (user_id, reason) values ('cb000000-0000-0000-0000-0000000000c7', 'map test');
insert into public.sanctions (user_id, kind, reason) values ('cb000000-0000-0000-0000-0000000000c8', 'suspension', 'map test');
update public.profiles set deleted_at = now() where id = 'cb000000-0000-0000-0000-0000000000c9';

-- ───────── Opt-in is off by default ─────────
select pg_temp.check((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'safety_settings' and column_name = 'map_visible') = 'false'
  and (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'safety_settings' and column_name = 'map_visible_girl') = 'false',
  'nobody is on the map until they choose to be');

-- ───────── Never coordinates: the neighbourhood at most ─────────
select pg_temp.check(pg_get_function_result('public.map_people(text, boolean, integer)'::regprocedure) !~* '(lat|lng|lon|coord|address|place)',
  'map_people returns no coordinates, address or venue');

-- ───────── IRLY map ─────────
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.people('dubai', false) = 'Lina,Omar',
  'IRLY map, Tom: only members who opted in, at neighbourhood precision, visible to him, not blocked, not sanctioned, open, with a neighbourhood');
select pg_temp.check((select area_id from public.map_people('dubai') where user_id = 'cb000000-0000-0000-0000-0000000000c1') = 'marina', 'IRLY map: the neighbourhood is given');
select pg_temp.check(pg_temp.people('bali', false) = 'Ari' and position('Ari' in pg_temp.people('dubai', false)) = 0, 'IRLY map: each country shows its own members');
select pg_temp.check(pg_temp.fails('select * from public.map_people(''dubai'', true)') = '42501', 'IRLY Girl map refused to a man');
-- Another member's opt-in is not readable directly.
select pg_temp.check((select count(*) from public.safety_settings where user_id = 'cb000000-0000-0000-0000-0000000000c1') = 0, 'opt-ins of others are not readable');
select pg_temp.check(pg_temp.fails('select area_id from public.profiles where id = ''cb000000-0000-0000-0000-0000000000c1''') = '42501', 'profiles.area_id stays unreadable');

select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.people('dubai', false) = 'Ben,Lina,Omar,Tom', 'IRLY map, Mia: Ben shows (only Tom blocked him)');

-- A block goes both ways.
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000c6');
select pg_temp.check(pg_temp.people('dubai', false) = 'Lina,Omar', 'IRLY map: a blocked member does not see the one who blocked him');

-- ───────── IRLY Girl map ─────────
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.people('dubai', true) = 'Ana,Lina', 'IRLY Girl map, Mia: women with IRLY Girl access who chose it (not Lou, suspended; not Rita, city only)');
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000c7');
select pg_temp.check(pg_temp.fails('select * from public.map_people(''dubai'', true)') = '42501', 'IRLY Girl map refused to a suspended woman');

-- An access withdrawn later takes her off the IRLY Girl map at once.
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('cb000000-0000-0000-0000-0000000000ca', 'map test later');
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.people('dubai', true) = 'Lina', 'IRLY Girl map: a withdrawn access leaves it');

-- Opting out takes effect at once.
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000c2');
update public.safety_settings set map_visible = false where user_id = 'cb000000-0000-0000-0000-0000000000c2';
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.people('dubai', false) = 'Lina', 'IRLY map: opting out leaves the map');

-- Closed or sanctioned viewers see nobody; visitors cannot ask.
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000c8');
select pg_temp.check(pg_temp.people('dubai', false) = '', 'a suspended member sees nobody');
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails('select * from public.map_people(''dubai'')') = '42501', 'visitors cannot call map_people');
select pg_temp.as_admin();

-- ───────── Activities: one space at a time, shown whoever goes ─────────
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('cb000000-0000-0000-0000-0000000000d1', 'cb000000-0000-0000-0000-0000000000c3', 'Map open run', 'sport', 'dubai', 'marina', now() + interval '2 days'),
  ('cb000000-0000-0000-0000-0000000000d3', 'cb000000-0000-0000-0000-0000000000c6', 'Map Ben quiz', 'social', 'dubai', 'marina', now() + interval '2 days');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('cb000000-0000-0000-0000-0000000000d2', 'cb000000-0000-0000-0000-0000000000c1', 'Map girls padel', 'sport', 'dubai', 'marina', now() + interval '2 days', true, 'girls');
insert into public.activity_participants (activity_id, user_id, status) values
  ('cb000000-0000-0000-0000-0000000000d1', 'cb000000-0000-0000-0000-0000000000c2', 'maybe'),
  ('cb000000-0000-0000-0000-0000000000d1', 'cb000000-0000-0000-0000-0000000000c5', 'going')
on conflict do nothing;
select set_config('irly.geo_collect', 'on', false);
update public.activities set lat = 25.080000, lng = 55.140000, geo_source = 'geocoded', geo_status = 'ok'
  where id in ('cb000000-0000-0000-0000-0000000000d1', 'cb000000-0000-0000-0000-0000000000d2', 'cb000000-0000-0000-0000-0000000000d3');
select set_config('irly.geo_collect', 'off', false);

select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b2');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'cb000000-0000-0000-0000-0000000000d1'),
  'IRLY map: an open plan shows even though its host and participants are not on the map');
select pg_temp.check((select going from public.map_activities('dubai', p_girl_only => false) where id = 'cb000000-0000-0000-0000-0000000000d1') = 2,
  'IRLY map: « going » counts only those going (host and Sami, not Omar who said maybe)');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai') where id = 'cb000000-0000-0000-0000-0000000000d2'), 'IRLY map: a man never gets a women-only plan');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai') where id = 'cb000000-0000-0000-0000-0000000000d3'), 'IRLY map: a blocked member''s plan is not shown');
select pg_temp.check(pg_temp.fails('select * from public.map_activities(''dubai'', p_girl_only => true)') = '42501', 'IRLY Girl map of plans refused to a man');

select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b1');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'cb000000-0000-0000-0000-0000000000d2')
  and exists (select 1 from public.map_activities('dubai', p_girl_only => false) where id = 'cb000000-0000-0000-0000-0000000000d1'),
  'IRLY map, Mia: IRLY plans only, no IRLY Girl plan');
select pg_temp.check(exists (select 1 from public.map_activities('dubai', p_girl_only => true) where id = 'cb000000-0000-0000-0000-0000000000d2')
  and not exists (select 1 from public.map_activities('dubai', p_girl_only => true) where id = 'cb000000-0000-0000-0000-0000000000d1'),
  'IRLY Girl map, Mia: IRLY Girl plans only');
select pg_temp.check((select count(*) from public.map_activities('dubai') where id in ('cb000000-0000-0000-0000-0000000000d1', 'cb000000-0000-0000-0000-0000000000d2')) = 2,
  'older apps (no space given) keep the old answer');

-- Edited, cancelled, deleted: the map follows.
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000c3');
update public.activities set title = 'Map open run, edited' where id = 'cb000000-0000-0000-0000-0000000000d1';
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b2');
select pg_temp.check((select title from public.map_activities('dubai', p_girl_only => false) where id = 'cb000000-0000-0000-0000-0000000000d1') = 'Map open run, edited', 'an edit shows on the map');
select pg_temp.as_admin();
update public.activities set cancelled_at = now() where id = 'cb000000-0000-0000-0000-0000000000d1';
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b2');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai') where id = 'cb000000-0000-0000-0000-0000000000d1'), 'a cancelled plan leaves the map');
select pg_temp.as_admin();
delete from public.activities where id = 'cb000000-0000-0000-0000-0000000000d2';
select pg_temp.as_user('cb000000-0000-0000-0000-0000000000b1');
select pg_temp.check(not exists (select 1 from public.map_activities('dubai', p_girl_only => true) where id = 'cb000000-0000-0000-0000-0000000000d2'), 'a deleted plan leaves the map');

select pg_temp.as_admin();
rollback;

select pg_temp.as_admin();
\echo 'map_audit: ALL CHECKS PASSED'
