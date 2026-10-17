-- IRLY Girl audit of 2026-10-21 (migration 20261021000000_irly_girl_audit).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh); ids use
-- the prefix f9000000-…. Each check raises if a rule does not hold.
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
    raise exception 'FAIL girl_audit: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('f9000000-0000-0000-0000-0000000000a1'), ('f9000000-0000-0000-0000-0000000000a2'),
  ('f9000000-0000-0000-0000-0000000000a3'), ('f9000000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f9000000-0000-0000-0000-0000000000a1', 'Ada', '1994-03-03', 'woman', 'dubai'),
  ('f9000000-0000-0000-0000-0000000000a2', 'Bo', '1993-05-05', 'woman', 'dubai'),
  ('f9000000-0000-0000-0000-0000000000a3', 'Cy', '1992-07-07', 'woman', 'dubai'),
  ('f9000000-0000-0000-0000-0000000000a6', 'Fox', '1989-01-01', 'man', 'dubai');


-- A. A plan with a man inside cannot become girl-only.
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('f9000000-0000-0000-0000-0000000000b1', 'f9000000-0000-0000-0000-0000000000a1', 'Open brunch', 'food', 'dubai', 'marina', now() + interval '3 days');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a6');
select public.join_activity('f9000000-0000-0000-0000-0000000000b1', 'going');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$update public.activities set girl_only = true, audience = 'girls' where id = 'f9000000-0000-0000-0000-0000000000b1'$q$) like '42501%', 'a plan a man joined cannot be turned girl-only');
select pg_temp.as_admin();
select pg_temp.check((select not girl_only from public.activities where id = 'f9000000-0000-0000-0000-0000000000b1'), '… and it stays open to everyone');
-- Without him, the host may still make it girl-only.
delete from public.activity_participants where activity_id = 'f9000000-0000-0000-0000-0000000000b1' and user_id = 'f9000000-0000-0000-0000-0000000000a6';
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$update public.activities set girl_only = true, audience = 'girls' where id = 'f9000000-0000-0000-0000-0000000000b1'$q$) is null, 'with only women inside, the host can make it girl-only');

-- B. A suspended host loses comments and likes on her girl-only plan, the others keep them.
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
values ('f9000000-0000-0000-0000-0000000000b2', 'f9000000-0000-0000-0000-0000000000a3', 'Girls run', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'girls');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a2');
select public.join_activity('f9000000-0000-0000-0000-0000000000b2', 'going');
insert into public.comments (author_id, target_type, target_id, body)
values ('f9000000-0000-0000-0000-0000000000a2', 'activity', 'f9000000-0000-0000-0000-0000000000b2', 'Bo: meet at gate 2');
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('f9000000-0000-0000-0000-0000000000a3', 'test');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a3');
select pg_temp.check((select count(*) = 0 from public.comments where target_id = 'f9000000-0000-0000-0000-0000000000b2'), 'a suspended host no longer reads the comments of her girl-only plan');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values ('f9000000-0000-0000-0000-0000000000a3', 'activity', 'f9000000-0000-0000-0000-0000000000b2', 'x')$q$) is not null, '… nor writes one');
select pg_temp.check(pg_temp.fails($q$select public.toggle_like('activity', 'f9000000-0000-0000-0000-0000000000b2')$q$) is not null, '… nor likes it');
select pg_temp.check((select count(*) = 1 from public.activities where id = 'f9000000-0000-0000-0000-0000000000b2'), '… but still sees the plan (so she can cancel it)');
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) = 1 from public.comments where target_id = 'f9000000-0000-0000-0000-0000000000b2'), 'a girl in the plan still reads its comments');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values ('f9000000-0000-0000-0000-0000000000a2', 'activity', 'f9000000-0000-0000-0000-0000000000b2', 'see you there')$q$) is null, '… and writes one');

-- C. Comments on plans open to everyone are untouched for men.
select pg_temp.as_user('f9000000-0000-0000-0000-0000000000a6');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('f9000000-0000-0000-0000-0000000000b3', 'f9000000-0000-0000-0000-0000000000a6', 'Padel open', 'sport', 'dubai', 'marina', now() + interval '3 days');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values ('f9000000-0000-0000-0000-0000000000a6', 'activity', 'f9000000-0000-0000-0000-0000000000b3', 'who plays?')$q$) is null, 'a man still comments on a plan open to everyone');

select pg_temp.as_admin();
\echo 'girl_audit: ALL CHECKS PASSED'
