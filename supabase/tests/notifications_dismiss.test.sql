-- Opening a notification from the bell removes it (migration
-- 20261029300000_irly_notifications_dismiss; features/server/social.ts
-- dismissNotifications). Ids use the prefix f2503000-…. Each block raises if
-- a rule does not hold.
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
    raise exception 'FAIL notifications_dismiss: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values ('f2503000-0000-0000-0000-0000000000a1'), ('f2503000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f2503000-0000-0000-0000-0000000000a1', 'Ana', '1994-03-03', 'woman', 'dubai'),
  ('f2503000-0000-0000-0000-0000000000a2', 'Ben', '1993-05-05', 'man', 'dubai');
insert into public.notifications (id, user_id, kind, payload) values
  ('f2503000-0000-0000-0000-0000000000b1', 'f2503000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER', '{"from": "f2503000-0000-0000-0000-0000000000a2"}'),
  ('f2503000-0000-0000-0000-0000000000b2', 'f2503000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER', '{"from": "f2503000-0000-0000-0000-0000000000a2"}'),
  ('f2503000-0000-0000-0000-0000000000c1', 'f2503000-0000-0000-0000-0000000000a2', 'NEW_FOLLOWER', '{"from": "f2503000-0000-0000-0000-0000000000a1"}');

-- 1. Ana removes one of hers (the app's exact query): it is gone, her other one stays.
select pg_temp.as_user('f2503000-0000-0000-0000-0000000000a1');
delete from public.notifications where id in ('f2503000-0000-0000-0000-0000000000b1');
select pg_temp.as_admin();
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.notifications where id = 'f2503000-0000-0000-0000-0000000000b1'), 'a member deletes her own notification');
  perform pg_temp.check(exists (select 1 from public.notifications where id = 'f2503000-0000-0000-0000-0000000000b2'), 'her other notifications stay');
end $$;

-- 2. Ana cannot remove Ben's: the delete sees no row.
select pg_temp.as_user('f2503000-0000-0000-0000-0000000000a1');
delete from public.notifications where id = 'f2503000-0000-0000-0000-0000000000c1';
select pg_temp.as_admin();
do $$
begin
  perform pg_temp.check(exists (select 1 from public.notifications where id = 'f2503000-0000-0000-0000-0000000000c1'), 'nobody deletes another member''s notification');
end $$;

-- 3. Signed out: nothing.
reset role;
set role anon;
do $$
begin
  begin
    delete from public.notifications where id = 'f2503000-0000-0000-0000-0000000000b2';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$
begin
  perform pg_temp.check(exists (select 1 from public.notifications where id = 'f2503000-0000-0000-0000-0000000000b2'), 'signed out, nothing is deleted');
end $$;
