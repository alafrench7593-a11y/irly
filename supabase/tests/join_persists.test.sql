-- Joining an activity is saved by the server, not only shown by the app:
-- after join_activity the participation row exists, the count every list
-- reads (activities.going, activity_detail) includes the new member, the
-- activity chat has her, and it is all still there in a new session. A man
-- cannot join a women-only (IRLY Girl) activity and the count stays as it was.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed a7e10000-….
--
--   a1 Hana  woman, hosts the women-only activity b1 (capacity 3)
--   a2 Rita  woman, joins it
--   a3 Omar  man, tries to join it
--   a4 Lou   woman, fills the last spot; a5 Kim woman then finds it full
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
    raise exception 'FAIL join_persists: %', label;
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

-- ───────── Accounts and the women-only activity (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('a7e10000-0000-0000-0000-0000000000a1'), ('a7e10000-0000-0000-0000-0000000000a2'),
  ('a7e10000-0000-0000-0000-0000000000a3'), ('a7e10000-0000-0000-0000-0000000000a4'),
  ('a7e10000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a7e10000-0000-0000-0000-0000000000a1', 'Hana', '1994-02-02', 'woman', 'dubai'),
  ('a7e10000-0000-0000-0000-0000000000a2', 'Rita', '1995-04-04', 'woman', 'dubai'),
  ('a7e10000-0000-0000-0000-0000000000a3', 'Omar', '1992-06-06', 'man', 'dubai'),
  ('a7e10000-0000-0000-0000-0000000000a4', 'Lou', '1996-08-08', 'woman', 'dubai'),
  ('a7e10000-0000-0000-0000-0000000000a5', 'Kim', '1993-10-10', 'woman', 'dubai');

-- Created by its host through the API, as the app does (girl_only checked by the server).
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, capacity, girl_only, audience)
values ('a7e10000-0000-0000-0000-0000000000b1', 'a7e10000-0000-0000-0000-0000000000a1', 'Girls padel 2v2', 'sport', 'dubai', 'jlt',
  now() + interval '1 day', 3, true, 'girls');
select pg_temp.check((select going from public.activity_detail('a7e10000-0000-0000-0000-0000000000b1')) = 1, 'host: her new activity counts her (1 going)');

-- ───────── A woman joins ─────────
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.join_activity('a7e10000-0000-0000-0000-0000000000b1', 'going') = 'going', 'woman: join_activity answers going');

-- A new session (another request): everything is read back from the tables.
select pg_temp.as_admin();
select pg_temp.check(exists (
  select 1 from public.activity_participants
  where activity_id = 'a7e10000-0000-0000-0000-0000000000b1' and user_id = 'a7e10000-0000-0000-0000-0000000000a2' and status = 'going'
), 'server: her participation row is stored (status going)');
select pg_temp.check(private.going_count('a7e10000-0000-0000-0000-0000000000b1') = 2, 'server: going count is 2');
select pg_temp.check(exists (
  select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id
  where c.activity_id = 'a7e10000-0000-0000-0000-0000000000b1' and cm.user_id = 'a7e10000-0000-0000-0000-0000000000a2'
), 'server: she is in the activity chat');
select pg_temp.check(exists (
  select 1 from public.notifications where user_id = 'a7e10000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_JOINED'
    and payload ->> 'activity_id' = 'a7e10000-0000-0000-0000-0000000000b1' and payload ->> 'user_id' = 'a7e10000-0000-0000-0000-0000000000a2'
), 'server: the host is told she joined');

select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a2');
select pg_temp.check((select my_status from public.activity_detail('a7e10000-0000-0000-0000-0000000000b1')) = 'going', 'woman: the activity page reads her as going');
select pg_temp.check((select going from public.activity_detail('a7e10000-0000-0000-0000-0000000000b1')) = 2, 'woman: the activity page counts 2 going');
-- What the Home lists read (useServerActivities: the computed column going + her own participant row).
select pg_temp.check((select a.going from public.activities a where a.id = 'a7e10000-0000-0000-0000-0000000000b1') = 2, 'woman: the list count (activities.going) is 2');
select pg_temp.check(exists (
  select 1 from public.activity_participants where activity_id = 'a7e10000-0000-0000-0000-0000000000b1'
    and user_id = 'a7e10000-0000-0000-0000-0000000000a2' and status = 'going'
), 'woman: the list sees her own participation (joined)');
-- Joining again changes nothing (one row per person).
select pg_temp.check(public.join_activity('a7e10000-0000-0000-0000-0000000000b1', 'going') = 'going', 'woman: joining twice is accepted');
select pg_temp.as_admin();
select pg_temp.check(private.going_count('a7e10000-0000-0000-0000-0000000000b1') = 2, 'server: joining twice still counts her once');

-- The host sees the new count too.
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a1');
select pg_temp.check((select a.going from public.activities a where a.id = 'a7e10000-0000-0000-0000-0000000000b1') = 2, 'host: sees 2 going');

-- ───────── A man cannot ─────────
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('a7e10000-0000-0000-0000-0000000000b1', 'going')$q$) is not null, 'man: join_activity is refused');
select pg_temp.check(pg_temp.fails($q$insert into public.activity_participants (activity_id, user_id, status) values ('a7e10000-0000-0000-0000-0000000000b1', 'a7e10000-0000-0000-0000-0000000000a3', 'going')$q$) is not null, 'man: cannot insert a participation row directly');
select pg_temp.as_admin();
select pg_temp.check(not exists (
  select 1 from public.activity_participants where activity_id = 'a7e10000-0000-0000-0000-0000000000b1' and user_id = 'a7e10000-0000-0000-0000-0000000000a3'
), 'server: no participation row for him');
select pg_temp.check(private.going_count('a7e10000-0000-0000-0000-0000000000b1') = 2, 'server: the count is unchanged (2)');

-- ───────── Capacity: the last spot, then full ─────────
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a4');
select pg_temp.check(public.join_activity('a7e10000-0000-0000-0000-0000000000b1', 'going') = 'going', 'woman: takes the last spot');
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_activity('a7e10000-0000-0000-0000-0000000000b1', 'going') = 'full', 'woman: the next one is told it is full');
select pg_temp.as_admin();
select pg_temp.check(private.going_count('a7e10000-0000-0000-0000-0000000000b1') = 3, 'server: full at 3, never over capacity');
select pg_temp.check(not exists (
  select 1 from public.activity_participants where activity_id = 'a7e10000-0000-0000-0000-0000000000b1' and user_id = 'a7e10000-0000-0000-0000-0000000000a5'
), 'server: no row for the one who found it full');

-- ───────── Leaving is saved too ─────────
select pg_temp.as_user('a7e10000-0000-0000-0000-0000000000a2');
select public.leave_activity('a7e10000-0000-0000-0000-0000000000b1');
select pg_temp.as_admin();
select pg_temp.check(private.going_count('a7e10000-0000-0000-0000-0000000000b1') = 2, 'server: after she leaves the count is 2');

-- ───────── Clean up ─────────
delete from public.activities where id = 'a7e10000-0000-0000-0000-0000000000b1';
delete from public.profiles where id::text like 'a7e10000-%';
delete from auth.users where id::text like 'a7e10000-%';
