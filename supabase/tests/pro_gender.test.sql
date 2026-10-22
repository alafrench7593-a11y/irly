-- IRLY Network in French with the right gender (migration
-- 20261029500000_irly_network_gender): pro_genders_of gives the declared
-- gender of professionals exactly where their professional profile is
-- readable (yours, or visible, not blocked either way, profile visibility),
-- never of a member without a professional profile, never to anon. Runs
-- after irly_test.sql on the same database (scripts/test-db.sh); ids use the
-- prefix 6e400000-…
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
    raise exception 'FAIL pro_gender: %', label;
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

-- What a member reads for these ids, as 'id:gender' sorted.
create or replace function pg_temp.seen(ids uuid[]) returns text language sql as $$
  select coalesce(string_agg(right(user_id::text, 2) || ':' || gender, ',' order by user_id), '') from public.pro_genders_of(ids)
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('6e400000-0000-0000-0000-0000000000a1'), ('6e400000-0000-0000-0000-0000000000a2'),
  ('6e400000-0000-0000-0000-0000000000a3'), ('6e400000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('6e400000-0000-0000-0000-0000000000a1', 'Salma', '1990-02-02', 'woman', 'dubai'),
  ('6e400000-0000-0000-0000-0000000000a2', 'Hugo', '1989-04-04', 'man', 'dubai'),
  ('6e400000-0000-0000-0000-0000000000a3', 'Sam', '1994-06-06', 'other', 'dubai'),
  ('6e400000-0000-0000-0000-0000000000a4', 'Lina', '1992-09-09', 'woman', 'dubai');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values
  ('6e400000-0000-0000-0000-0000000000a1', 'founder', 'Fondatrice', '{ai}', 'dubai'),
  ('6e400000-0000-0000-0000-0000000000a2', 'investor', 'Angel', '{fintech}', 'dubai'),
  ('6e400000-0000-0000-0000-0000000000a3', 'employee', 'Designer', '{design}', 'dubai');
-- a4 (Lina) has no professional profile.

-- 1. Each professional's declared gender; none for someone without a professional profile.
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a1', '6e400000-0000-0000-0000-0000000000a2',
  '6e400000-0000-0000-0000-0000000000a3', '6e400000-0000-0000-0000-0000000000a4']::uuid[]) = 'a1:woman,a2:man,a3:other',
  'woman, man, other; nothing for a member without a professional profile');
select pg_temp.check(pg_temp.seen(null) = '' and pg_temp.seen('{}') = '', 'no ids: nothing');

-- 2. Hidden from Networking: only the owner.
select pg_temp.as_admin();
update public.pro_profiles set visible = false where user_id = '6e400000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a1']::uuid[]) = '', 'a hidden profile: others read nothing');
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a1']::uuid[]) = 'a1:woman', 'a hidden profile: the owner reads hers');
select pg_temp.as_admin();
update public.pro_profiles set visible = true where user_id = '6e400000-0000-0000-0000-0000000000a1';

-- 3. Blocked either way: nothing.
insert into public.blocks (blocker_id, blocked_id) values ('6e400000-0000-0000-0000-0000000000a1', '6e400000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a1']::uuid[]) = '', 'blocked: the blocked member reads nothing');
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a2']::uuid[]) = '', 'blocked: the blocker reads nothing');
select pg_temp.as_admin();
delete from public.blocks where blocker_id = '6e400000-0000-0000-0000-0000000000a1' and blocked_id = '6e400000-0000-0000-0000-0000000000a2';

-- 4. Profile visible to nobody: nothing.
insert into public.safety_settings (user_id, profile_visibility) values ('6e400000-0000-0000-0000-0000000000a3', 'nobody')
on conflict (user_id) do update set profile_visibility = 'nobody';
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.seen(array['6e400000-0000-0000-0000-0000000000a3']::uuid[]) = '', 'profile visible to nobody: nothing');

-- 5. Signed out: no call at all; the gender column itself stays unreadable.
select pg_temp.as_admin();
set role anon;
select pg_temp.check(pg_temp.fails($$select * from public.pro_genders_of(array['6e400000-0000-0000-0000-0000000000a1']::uuid[])$$) = '42501', 'anon cannot call pro_genders_of');
reset role;
select pg_temp.as_user('6e400000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select gender from public.profiles where id = '6e400000-0000-0000-0000-0000000000a1'$$) = '42501', 'profiles.gender is still not readable directly');

select pg_temp.as_admin();
delete from public.safety_settings where user_id = '6e400000-0000-0000-0000-0000000000a3';
delete from public.pro_profiles where user_id::text like '6e400000-%';
