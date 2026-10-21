-- Sign-up answers kept on the server (migration 20261027500000_irly_member_types):
-- the "Who are you?" answer is published with the profile, comes back to its
-- owner through my_profile() (a new phone restores it), only takes the known
-- values (at most 3), stays private (other members cannot read it) and only
-- its owner changes it. Also checks the sign-up publish itself: a member
-- creates only their own profile, once (a second publish changes nothing).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); ids use
-- the prefix e9270000-…
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
    raise exception 'FAIL member_types: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with (null when it succeeds).
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();
-- Supabase grants table privileges to API roles; RLS decides the rows (as irly_test.sql),
-- then the sensitive profile columns are narrowed again, as in production.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();
insert into auth.users (id) values
  ('e9270000-0000-0000-0000-0000000000a1'), ('e9270000-0000-0000-0000-0000000000a2');

-- 0. Additive: existing profiles get an empty answer, nothing else changes.
select pg_temp.check((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
  and column_name = 'member_types' and is_nullable = 'NO' and column_default like '''{}''%') = 1, 'member_types: not null, empty by default');

-- 1. Sign-up publish (account.ts writeProfile → toRow): the member's own row, with the answer.
select pg_temp.as_user('e9270000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, first_name, birthdate, gender, city_id, interests, intentions, arrived_at, member_types, onboarded_at)
values ('e9270000-0000-0000-0000-0000000000a1', 'Lina', '1994-01-01', 'woman', 'dubai', '{sports,food,art}', '{friends}', current_date - 10, '{expat,entrepreneur}', now());
select pg_temp.check((select member_types = '{expat,entrepreneur}' and interests = '{sports,food,art}' and arrived_at = current_date - 10 from public.my_profile()),
  'my_profile gives the sign-up answers back (restore on a new phone)');

-- 2. A second publish of the same sign-up (two taps, a retry after a lost answer) changes nothing (upsert ignoreDuplicates).
insert into public.profiles (id, first_name, birthdate, gender, city_id, member_types)
values ('e9270000-0000-0000-0000-0000000000a1', 'Other', '1990-01-01', 'man', 'dubai', '{tourist}')
on conflict (id) do nothing;
select pg_temp.check((select first_name = 'Lina' and gender = 'woman' and member_types = '{expat,entrepreneur}' from public.my_profile()),
  'a repeated publish never overwrites the profile');

-- 3. Nobody publishes a profile for another account.
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id)
  values ('e9270000-0000-0000-0000-0000000000a2', 'Fake', '1990-01-01', 'man', 'dubai')$q$) = '42501', 'no profile for another account');

-- 4. Only known answers, at most three.
select pg_temp.check(pg_temp.fails($q$update public.profiles set member_types = '{astronaut}' where id = auth.uid()$q$) = '23514', 'an unknown answer is refused');
select pg_temp.check(pg_temp.fails($q$update public.profiles set member_types = '{expat,local,tourist,student}' where id = auth.uid()$q$) = '23514', 'more than three answers are refused');
update public.profiles set member_types = '{student}' where id = auth.uid();
select pg_temp.check((select member_types = '{student}' from public.my_profile()), 'the owner changes the answer');

-- 5. Private: another member cannot read it, nor change it.
select pg_temp.as_admin();
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values ('e9270000-0000-0000-0000-0000000000a2', 'Omar', '1990-02-02', 'man', 'dubai');
select pg_temp.as_user('e9270000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($q$select member_types from public.profiles where id = 'e9270000-0000-0000-0000-0000000000a1'$q$) = '42501', 'another member cannot read it');
update public.profiles set member_types = '{tourist}' where id = 'e9270000-0000-0000-0000-0000000000a1';
select pg_temp.as_admin();
select pg_temp.check((select member_types = '{student}' from public.profiles where id = 'e9270000-0000-0000-0000-0000000000a1'), 'another member cannot change it');

select pg_temp.as_admin();
delete from auth.users where id::text like 'e9270000-%';
