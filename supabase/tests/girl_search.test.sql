-- IRLY Girl space search (20261024005000_irly_girl_search.sql): in the
-- IRLY Girl space the search finds women with IRLY Girl access only, and
-- women-only plans and communities only; a man, a suspended woman and
-- anonymous are refused; search_all (the IRLY search the installed apps
-- call) is unchanged.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed d5e00000-….
--
--   a1 Qzvlea  woman, IRLY Girl access (the viewer)
--   a2 Qzvada  woman, IRLY Girl access, hosts plans and communities
--   a3 Qzvtom  man, hosts an open plan and an open community
--   a4 Qzvzoe  woman whose IRLY Girl access was withdrawn (girl_suspensions)
--   a5 Qzvmia  woman, IRLY Girl access, profile visible to nobody
--   a6 Qzvkim  woman, IRLY Girl access, has blocked Qzvlea
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
    raise exception 'FAIL girl_search: %', label;
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

-- ───────── Accounts, plans and communities (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('d5e00000-0000-0000-0000-0000000000a1'), ('d5e00000-0000-0000-0000-0000000000a2'),
  ('d5e00000-0000-0000-0000-0000000000a3'), ('d5e00000-0000-0000-0000-0000000000a4'),
  ('d5e00000-0000-0000-0000-0000000000a5'), ('d5e00000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d5e00000-0000-0000-0000-0000000000a1', 'Qzvlea', '1994-03-03', 'woman', 'dubai'),
  ('d5e00000-0000-0000-0000-0000000000a2', 'Qzvada', '1993-05-05', 'woman', 'dubai'),
  ('d5e00000-0000-0000-0000-0000000000a3', 'Qzvtom', '1992-07-07', 'man', 'dubai'),
  ('d5e00000-0000-0000-0000-0000000000a4', 'Qzvzoe', '1991-09-09', 'woman', 'dubai'),
  ('d5e00000-0000-0000-0000-0000000000a5', 'Qzvmia', '1990-01-01', 'woman', 'dubai'),
  ('d5e00000-0000-0000-0000-0000000000a6', 'Qzvkim', '1995-02-02', 'woman', 'dubai');
insert into public.girl_suspensions (user_id, reason, created_by) values
  ('d5e00000-0000-0000-0000-0000000000a4', 'test', 'd5e00000-0000-0000-0000-0000000000a2');
insert into public.safety_settings (user_id, profile_visibility) values ('d5e00000-0000-0000-0000-0000000000a5', 'nobody')
  on conflict (user_id) do update set profile_visibility = excluded.profile_visibility;
insert into public.blocks (blocker_id, blocked_id) values
  ('d5e00000-0000-0000-0000-0000000000a6', 'd5e00000-0000-0000-0000-0000000000a1');

insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('d5e00000-0000-0000-0000-0000000000b1', 'd5e00000-0000-0000-0000-0000000000a2', 'Qzv girls brunch', 'food', 'dubai', 'marina', now() + interval '1 day', true, 'girls'),
  ('d5e00000-0000-0000-0000-0000000000b2', 'd5e00000-0000-0000-0000-0000000000a3', 'Qzv open dinner', 'food', 'dubai', 'marina', now() + interval '1 day', false, 'all');
insert into public.communities (id, city_id, name, girl_only, created_by) values
  ('d5e00000-0000-0000-0000-0000000000c1', 'dubai', 'Qzv girls club', true, 'd5e00000-0000-0000-0000-0000000000a2'),
  ('d5e00000-0000-0000-0000-0000000000c2', 'dubai', 'Qzv open club', false, 'd5e00000-0000-0000-0000-0000000000a3');

-- ───────── Qzvlea, a woman in the IRLY Girl space ─────────
select pg_temp.as_user('d5e00000-0000-0000-0000-0000000000a1');
create temp table g as select * from public.search_all_girl('qzv', 'dubai', 50);
select pg_temp.check(exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a2'),
  'Qzvlea, IRLY Girl: finds a woman with IRLY Girl access');
select pg_temp.check(not exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a3'),
  'Qzvlea, IRLY Girl: does not find a man');
select pg_temp.check(not exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a4'),
  'Qzvlea, IRLY Girl: does not find a woman whose IRLY Girl access was withdrawn');
select pg_temp.check(not exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a5'),
  'Qzvlea, IRLY Girl: profile visibility still applies (visible to nobody: not found)');
select pg_temp.check(not exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a6'),
  'Qzvlea, IRLY Girl: blocks still apply (a woman who blocked her: not found)');
select pg_temp.check(not exists (select 1 from g where g.kind = 'person' and g.id = 'd5e00000-0000-0000-0000-0000000000a1'),
  'Qzvlea, IRLY Girl: never finds herself');
select pg_temp.check((select bool_and(private.girl_eligible_unchecked(g.id::uuid)) from g where g.kind = 'person'),
  'Qzvlea, IRLY Girl: every person found is a woman with IRLY Girl access');
select pg_temp.check(exists (select 1 from g where g.kind = 'activity' and g.id = 'd5e00000-0000-0000-0000-0000000000b1'),
  'Qzvlea, IRLY Girl: finds the women-only plan');
select pg_temp.check(not exists (select 1 from g where g.kind = 'activity' and g.id = 'd5e00000-0000-0000-0000-0000000000b2'),
  'Qzvlea, IRLY Girl: does not find the open plan');
select pg_temp.check(exists (select 1 from g where g.kind = 'community' and g.id = 'd5e00000-0000-0000-0000-0000000000c1'),
  'Qzvlea, IRLY Girl: finds the women-only community');
select pg_temp.check(not exists (select 1 from g where g.kind = 'community' and g.id = 'd5e00000-0000-0000-0000-0000000000c2'),
  'Qzvlea, IRLY Girl: does not find the open community');
select pg_temp.check((select bool_and(a.girl_only) from g join public.activities a on a.id::text = g.id where g.kind = 'activity')
  and (select bool_and(c.girl_only) from g join public.communities c on c.id::text = g.id where g.kind = 'community'),
  'Qzvlea, IRLY Girl: every plan and community found is women only');
select pg_temp.check(exists (select 1 from public.search_all_girl('dubai', null, 50) s where s.kind = 'city' and s.id = 'dubai'),
  'Qzvlea, IRLY Girl: the city directory is still found');
select pg_temp.check(not exists (select 1 from public.search_all_girl('', 'dubai', 50)),
  'Qzvlea, IRLY Girl: an empty query finds nothing (as search_all)');
select pg_temp.check((select count(*) from public.search_all_girl('qzv', 'dubai', 2)) <= 2,
  'Qzvlea, IRLY Girl: p_limit is kept');
select pg_temp.check((select count(*) from g where g.kind = 'person') =
  (select count(*) from public.search_all('qzv', 'dubai', 50) s where s.kind = 'person' and private.girl_eligible_unchecked(s.id::uuid)),
  'Qzvlea, IRLY Girl: the people found are exactly the women IRLY search finds');
drop table g;

-- ───────── The IRLY search the installed apps call: unchanged ─────────
select pg_temp.check(exists (select 1 from public.search_all('qzv', 'dubai', 50) s where s.kind = 'person' and s.id = 'd5e00000-0000-0000-0000-0000000000a3')
  and exists (select 1 from public.search_all('qzv', 'dubai', 50) s where s.kind = 'activity' and s.id = 'd5e00000-0000-0000-0000-0000000000b2')
  and exists (select 1 from public.search_all('qzv', 'dubai', 50) s where s.kind = 'community' and s.id = 'd5e00000-0000-0000-0000-0000000000c2'),
  'Qzvlea, IRLY: search_all still finds everyone, the open plan and the open community');
select pg_temp.check(exists (select 1 from public.search_all('qzv') s where s.kind = 'person'),
  'Qzvlea, IRLY: search_all defaults still work');

-- ───────── Qzvtom, a man: refused ─────────
select pg_temp.as_user('d5e00000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select * from public.search_all_girl('qzv', 'dubai', 30)$$) = '42501', 'Qzvtom: search_all_girl is refused');
select pg_temp.check(not exists (select 1 from public.search_all('qzv', 'dubai', 50) s where s.id in ('d5e00000-0000-0000-0000-0000000000b1', 'd5e00000-0000-0000-0000-0000000000c1')),
  'Qzvtom, IRLY: search_all still never shows him a women-only plan or community');
select pg_temp.check(exists (select 1 from public.search_all('qzv', 'dubai', 50) s where s.kind = 'person' and s.id = 'd5e00000-0000-0000-0000-0000000000a2'),
  'Qzvtom, IRLY: search_all unchanged for him');

-- ───────── Qzvzoe, suspended: refused ─────────
select pg_temp.as_user('d5e00000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$select * from public.search_all_girl('qzv')$$) = '42501', 'Qzvzoe (access withdrawn): search_all_girl is refused');

-- ───────── Anonymous: no access ─────────
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.search_all_girl('qzv')$$) = '42501', 'anon: search_all_girl not executable');
reset role;
select pg_temp.check(not has_function_privilege('anon', 'public.search_all_girl(text, text, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.search_all_girl(text, text, integer)', 'execute'),
  'search_all_girl: executable by authenticated only');
select pg_temp.check((select not p.prosecdef from pg_proc p where p.oid = 'public.search_all_girl(text, text, integer)'::regprocedure),
  'search_all_girl: security invoker');
