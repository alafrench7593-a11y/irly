-- A group chat is created once (20261029100000_irly_create_group_once.sql): Create
-- sent twice (a double tap, a retry after a lost answer) answers with the group
-- already made, its people notified once; another title, other people, another
-- creator or a later try is a new group.
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

-- ───────── 1. Create sent twice: one group ─────────
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a1');
select public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3']::uuid[]) as g1 \gset
select public.create_group(' d29 crew ', array['d2900000-0000-0000-0000-0000000000a3', 'd2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a2']::uuid[]) as g2 \gset
select pg_temp.check(:'g1' = :'g2', 'Ana taps Create twice (same name, same people, any order): the same group');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversations where kind = 'group' and title = 'd29 crew') = 1, '… one group in the database');
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = :'g1') = 3, '… with Ana, Ben and Eve once each');
select pg_temp.check((select count(*) from public.notifications where kind = 'GROUP_ADDED' and payload ->> 'conversation_id' = :'g1') = 2, '… Ben and Eve are told once each');
select pg_temp.check((select role from public.conversation_members where conversation_id = :'g1' and user_id = 'd2900000-0000-0000-0000-0000000000a1') = 'admin', '… Ana is its admin');

-- ───────── 2. Anything different is a new group ─────────
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a2']::uuid[]) <> :'g1', 'the same name with other people: a new group');
select pg_temp.check(public.create_group('d29 brunch', array['d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3']::uuid[]) <> :'g1', 'the same people under another name: a new group');
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a1', 'd2900000-0000-0000-0000-0000000000a3']::uuid[]) <> :'g1', 'Ben makes the same group himself: his own group (Ana is not its admin)');
select pg_temp.as_admin();
update public.conversations set created_at = now() - interval '3 minutes' where id = :'g1';
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.create_group('d29 crew', array['d2900000-0000-0000-0000-0000000000a2', 'd2900000-0000-0000-0000-0000000000a3']::uuid[]) <> :'g1', 'the same group made again minutes later: a new group (a choice, not a retry)');

-- ───────── 3. Its checks still hold ─────────
select pg_temp.as_admin();
insert into auth.users (id) values ('d2900000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('d2900000-0000-0000-0000-0000000000a4', 'Cat', '1996-06-06', 'woman', 'dubai');
insert into public.safety_settings (user_id, who_can_message) values ('d2900000-0000-0000-0000-0000000000a4', 'nobody');
select pg_temp.as_user('d2900000-0000-0000-0000-0000000000a1');
do $$
begin
  perform public.create_group('d29 closed', array['d2900000-0000-0000-0000-0000000000a4']::uuid[]);
  raise exception 'FAIL create_group_once: a group still only adds people who accept your messages';
exception when insufficient_privilege then
  raise notice 'ok  a group still only adds people who accept your messages';
end $$;
