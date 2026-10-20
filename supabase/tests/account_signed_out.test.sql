-- Delete account without a signed-in member: the app only calls
-- delete_my_account() with a session, but a request whose session already
-- ended (expired, revoked, signed out elsewhere) reaches the server with no
-- user. It must be refused with a clear "sign in required" (42501, which the
-- app reads as "your session has ended") and delete nothing; anon cannot call
-- it at all. Nobody can delete someone else's account through it.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return sqlstate;
  end;
  return null;
end $$;

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values ('a5000000-0000-0000-0000-0000000000a1'), ('a5000000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a5000000-0000-0000-0000-0000000000a1', 'Ines', '1993-02-02', 'woman', 'dubai'),
  ('a5000000-0000-0000-0000-0000000000a2', 'Karim', '1991-04-04', 'man', 'dubai');

-- A request whose session ended: role authenticated, no user id.
select pg_temp.as_user('');
select pg_temp.check(pg_temp.fails($$select public.delete_my_account()$$) = '42501', 'no signed-in member: delete is refused (sign in required)');
select pg_temp.check(pg_temp.fails($$select public.my_account_exists()$$) is not null, 'no signed-in member: the confirmation is refused, never "deleted"');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from auth.users where id in ('a5000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-0000000000a2')) = 2, 'no signed-in member: no sign-in account deleted');
select pg_temp.check((select count(*) from public.profiles where id in ('a5000000-0000-0000-0000-0000000000a1', 'a5000000-0000-0000-0000-0000000000a2')) = 2, 'no signed-in member: no profile deleted');

-- Anon (no session at all) cannot even call it.
select pg_temp.check(not has_function_privilege('anon', 'public.delete_my_account()', 'execute'), 'anon: delete_my_account is not callable');

-- Ines deletes her account: only hers goes, Karim stays.
select pg_temp.as_user('a5000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.check(not public.my_account_exists(), 'Ines: confirmed deleted');
select pg_temp.as_user('a5000000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.my_account_exists(), 'Karim: still there');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from auth.users where id = 'a5000000-0000-0000-0000-0000000000a1'), 'Ines: her sign-in account is gone');
select pg_temp.check(exists (select 1 from public.profiles where id = 'a5000000-0000-0000-0000-0000000000a2'), 'Karim: his profile is untouched');

-- Clean up for the next test files.
delete from public.profiles where id = 'a5000000-0000-0000-0000-0000000000a2';
delete from auth.users where id = 'a5000000-0000-0000-0000-0000000000a2';
do $$ begin raise notice 'ok  account deletion: refused without a signed-in member, own account only'; end $$;
