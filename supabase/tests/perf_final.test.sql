-- Speed (migration 20261027950000_irly_perf_final): search and the map
-- bound their activities by plain columns before the read rule runs, and the
-- members' read rule asks for IRLY Girl access once per query. Nothing anyone sees
-- changes: every edge of « not over yet » (no end, started under / over two
-- hours ago, several days long, ended) and every IRLY Girl visibility below
-- gives exactly what the original tests give.
-- Runs after irly_test.sql on the same database. TEST accounts only, ids 9e4f0000-….
--   …a1 Wren   woman, IRLY Girl access (viewer, creator)
--   …b1 Milo   man (viewer)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
    raise exception 'FAIL perf_final: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The test activities a search finds, as a sorted list of titles.
create or replace function pg_temp.found(girl boolean) returns text language plpgsql as $$
declare r text;
begin
  if girl then
    select coalesce(string_agg(s.title, ',' order by s.title), '') into r from public.search_all_girl('Perfx', 'dubai', 100) s where s.kind = 'activity';
  else
    select coalesce(string_agg(s.title, ',' order by s.title), '') into r from public.search_all('Perfx', 'dubai', 100) s where s.kind = 'activity';
  end if;
  return r;
end $$;
-- The test activities on the map from p_from on, as a sorted list of titles.
create or replace function pg_temp.mapped(p_from timestamptz, p_girl boolean) returns text language plpgsql as $$
declare r text;
begin
  select coalesce(string_agg(m.title, ',' order by m.title), '') into r
  from public.map_activities('dubai', p_from, null, null, null, null, null, null, 500, p_girl) m where m.title like 'Perfx%';
  return r;
end $$;

-- ───────── The migration is in place ─────────
select pg_temp.as_admin();
select pg_temp.check(position($b$a.starts_at >= now() - interval '2 hours' or a.ends_at >= now()$b$ in pg_get_functiondef('public.search_all(text,text,integer)'::regprocedure)) > 0, 'search_all bounds its activities by plain columns');
select pg_temp.check(position($b$a.starts_at >= now() - interval '2 hours' or a.ends_at >= now()$b$ in pg_get_functiondef('public.search_all_girl(text,text,integer)'::regprocedure)) > 0, 'search_all_girl bounds its activities by plain columns');
select pg_temp.check(position('or a.ends_at > greatest(now(), coalesce(p_from, now())))' in pg_get_functiondef(to_regprocedure('public.map_activities(text,timestamp with time zone,timestamp with time zone,text,uuid,double precision,double precision,double precision,integer,boolean)'))) > 0, 'map_activities bounds its activities by plain columns');
select pg_temp.check((select count(*) from pg_policy where polname = 'community_members_read' and pg_get_expr(polqual, polrelid) ~ 'SELECT private\.is_girl_eligible\(\)' and pg_get_expr(polqual, polrelid) !~ '(^|[^T] |[^ ])private\.is_girl_eligible\(\)') = 1, 'community members: IRLY Girl access asked once per query');
select pg_temp.check(to_regclass('public.activities_live_end_idx') is not null, 'index on the end of activities still to come');

-- ───────── Data ─────────
insert into auth.users (id) values ('9e4f0000-0000-0000-0000-0000000000a1'), ('9e4f0000-0000-0000-0000-0000000000b1');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('9e4f0000-0000-0000-0000-0000000000a1', 'Wren', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('9e4f0000-0000-0000-0000-0000000000b1', 'Milo', '1993-01-01', 'man', 'dubai', 'marina');
-- A listed place with a position (what puts a plan on the map).
insert into public.places (id, slug, city_id, name, kind, lat, lng) values
  ('9e4f0000-0000-0000-0003-000000000001', '9e4f-perf-beach', 'dubai', 'Perfx Beach', 'beach', 25.15800, 55.19700);
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, ends_at, privacy, girl_only, audience, place_id) values
  ('9e4f0000-0000-0000-0001-000000000001', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx soon', 'sport', 'dubai', 'marina', now() + interval '1 day', null, 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000002', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx started', 'sport', 'dubai', 'marina', now() - interval '1 hour', null, 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000003', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx over', 'sport', 'dubai', 'marina', now() - interval '3 hours', null, 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000004', '9e4f0000-0000-0000-0000-0000000000a1', 'trip', 'Perfx trip', 'sport', 'dubai', 'marina', now() - interval '3 days', now() + interval '1 day', 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000005', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx ended', 'sport', 'dubai', 'marina', now() - interval '5 hours', now() - interval '1 hour', 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000006', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx later', 'sport', 'dubai', 'marina', now() + interval '3 days', now() + interval '3 days 2 hours', 'public', false, 'all', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000007', '9e4f0000-0000-0000-0000-0000000000a1', 'trip', 'Perfx girls trip', 'sport', 'dubai', 'marina', now() - interval '3 days', now() + interval '1 day', 'public', true, 'girls', '9e4f0000-0000-0000-0003-000000000001'),
  ('9e4f0000-0000-0000-0001-000000000008', '9e4f0000-0000-0000-0000-0000000000a1', 'activity', 'Perfx girls ended', 'sport', 'dubai', 'marina', now() - interval '6 hours', now() - interval '2 hours', 'public', true, 'girls', '9e4f0000-0000-0000-0003-000000000001');
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('9e4f0000-0000-0000-0002-000000000001', 'dubai', 'Perfx girls circle', 'social', true, '9e4f0000-0000-0000-0000-0000000000a1'),
  ('9e4f0000-0000-0000-0002-000000000002', 'dubai', 'Perfx open circle', 'social', false, '9e4f0000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('9e4f0000-0000-0000-0002-000000000001', '9e4f0000-0000-0000-0000-0000000000a1', 'owner'),
  ('9e4f0000-0000-0000-0002-000000000002', '9e4f0000-0000-0000-0000-0000000000a1', 'owner'),
  ('9e4f0000-0000-0000-0002-000000000002', '9e4f0000-0000-0000-0000-0000000000b1', 'member')
on conflict do nothing;

-- ───────── Search: exactly the activities not over yet ─────────
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.found(false) = 'Perfx later,Perfx soon,Perfx started,Perfx trip', 'search: to come, started under 2 h ago and several days long are found; over and ended are not (' || pg_temp.found(false) || ')');
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.found(true) = 'Perfx girls trip', 'IRLY Girl search: the girls'' trip still going is found, the one ended is not (' || pg_temp.found(true) || ')');

-- ───────── Map: the same edges, from now and from a later day ─────────
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.mapped(null, false) = 'Perfx later,Perfx soon,Perfx started,Perfx trip', 'map from now: the same four (' || pg_temp.mapped(null, false) || ')');
select pg_temp.check(pg_temp.mapped(now() + interval '2 days', false) = 'Perfx later', 'map from a later day: only what is still on then (' || pg_temp.mapped(now() + interval '2 days', false) || ')');
select pg_temp.check(pg_temp.mapped(now() + interval '20 hours', false) = 'Perfx later,Perfx soon,Perfx trip', 'map from tomorrow: a plan without an end counts its first two hours (' || pg_temp.mapped(now() + interval '20 hours', false) || ')');
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.mapped(null, true) = 'Perfx girls trip', 'IRLY Girl map: the girls'' trip still going, not the one ended (' || pg_temp.mapped(null, true) || ')');

-- ───────── IRLY Girl rules: unchanged answers ─────────
-- (An owner still renames a community: the members' rule must not make the owners' rule recursive.)
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
update public.communities set tagline = 'Perfx tagline' where id = '9e4f0000-0000-0000-0002-000000000002';
select pg_temp.check((select tagline from public.communities where id = '9e4f0000-0000-0000-0002-000000000002') = 'Perfx tagline', 'an owner still edits their community');
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.communities where id::text like '9e4f0000-%') = 2, 'a woman with IRLY Girl access sees the women-only community');
select pg_temp.check((select count(*) from public.community_members where community_id = '9e4f0000-0000-0000-0002-000000000001') = 1, 'and its members');
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000b1');
select pg_temp.check((select array_agg(name) from public.communities where id::text like '9e4f0000-%') = '{Perfx open circle}', 'a man sees only the open community');
select pg_temp.check((select count(*) from public.community_members where community_id = '9e4f0000-0000-0000-0002-000000000001') = 0, 'and none of the women-only one''s members');
select pg_temp.check((select count(*) from public.community_members where community_id = '9e4f0000-0000-0000-0002-000000000002') = 2, 'the open community''s members stay visible');
-- Suspended from IRLY Girl: the answer, asked once per query, is still hers alone.
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('9e4f0000-0000-0000-0000-0000000000a1', 'perf test');
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
select pg_temp.check((select array_agg(name) from public.communities where id::text like '9e4f0000-%') = '{Perfx open circle}', 'suspended from IRLY Girl: the women-only community is hidden at once');
select pg_temp.check((select count(*) from public.community_members where community_id = '9e4f0000-0000-0000-0002-000000000001') = 0, 'and its members too');
select pg_temp.as_admin();

-- ───────── Members' file deletions: the app photos check reads a table they may not ─────────
select pg_temp.as_admin();
revoke all on public.app_photo_overrides from authenticated;
insert into public.app_photo_overrides (key, storage_path, version, updated_at) values ('perfx', '9e4f0000-0000-0000-0000-0000000000a1/perfx.jpg', 1, now());
select pg_temp.as_user('9e4f0000-0000-0000-0000-0000000000a1');
select pg_temp.check(private.app_photo_kept('9e4f0000-0000-0000-0000-0000000000a1/perfx.jpg') and not private.app_photo_kept('9e4f0000-0000-0000-0000-0000000000a1/other.jpg'),
  'the app photos delete rule can check its table for a member (who cannot read it herself)');
select pg_temp.as_admin();
delete from public.app_photo_overrides where key = 'perfx';
