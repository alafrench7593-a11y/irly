-- A group chat was created once (20261029100000_irly_create_group_once.sql); since
-- 20261109050000 (owner decision of 2026-11-06) no group chat is created at all.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed d2900000-….
--
--   a1 Ana  friends with Ben and Eve
--   a2 Ben  friends with Ana and Eve
--   a3 Eve  friends with Ana and Ben
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
    raise exception 'FAIL create_group_once: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) select ('d2900000-0000-0000-0000-0000000000a' || n)::uuid from generate_series(1, 3) n;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d2900000-0000-0000-0000-0000000000a1', 'Ana', '1995-02-02', 'woman', 'dubai'),
  ('d2900000-0000-0000-0000-0000000000a2', 'Ben', '1993-04-04', 'man', 'dubai'),
  ('d2900000-0000-0000-0000-0000000000a3', 'Eve', '1994-05-05', 'woman', 'dubai');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('d2900000-0000-0000-0000-0000000000a1', 'd2900000-0000-0000-0000-0000000000a2', 'accepted', 'd2900000-0000-0000-0000-0000000000a1'),
  ('d2900000-0000-0000-0000-0000000000a1', 'd2900000-0000-0000-0000-0000000000a3', 'accepted', 'd2900000-0000-0000-0000-0000000000a1'),
  ('d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3', 'accepted', 'd2900000-0000-0000-0000-0000000000a2');

-- Group chats were removed on 2026-11-06 (20261109050000_irly_no_group_chats): Create,
-- sent once or twice, is refused and makes nothing; nobody is notified.
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a1');
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $f$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $f$;
select pg_temp.check(pg_temp.fails($q$select public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3']::uuid[])$q$) = '42501',
  'Ana taps Create: refused (group chats were removed)');
select pg_temp.check(pg_temp.fails($q$select public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3']::uuid[])$q$) = '42501',
  '… and again');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.conversations where kind = 'group' and title like 'd29%'), 'no group chat in the database');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'GROUP_ADDED' and user_id in ('d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3')),
  'nobody is told they were added');
