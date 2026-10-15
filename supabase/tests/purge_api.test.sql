-- Storage purge through the REST API (migration 20261021000000_irly_purge_api):
-- only the project's server key (service_role) can call the purge queue; a
-- visitor or a member cannot, even though the functions live in public.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL purge_api: %', label;
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

-- 1. Who may call what.
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.storage_purge_sweep(integer)', 'public.storage_purge_claim(integer, integer)',
    'public.storage_purge_done(text, text[])', 'public.storage_purge_failed(text, text[], text)',
    'public.storage_purge_status()'
  ] loop
    perform pg_temp.check(has_function_privilege('service_role', f, 'execute'), format('%s: the server key can call it', f));
    perform pg_temp.check(not has_function_privilege('anon', f, 'execute'), format('%s: a visitor cannot', f));
    perform pg_temp.check(not has_function_privilege('authenticated', f, 'execute'), format('%s: a member cannot', f));
  end loop;
end $$;

-- 2. As the API roles: refused for a visitor and a member, served for the server key.
reset role;
insert into private.storage_cleanup (bucket_id, name, user_id, reason)
values ('profile-photos', 'fa000000-0000-0000-0000-0000000000a1/purge-api.jpg', 'fa000000-0000-0000-0000-0000000000a1', 'account_deleted');

set role anon;
select pg_temp.check(pg_temp.fails($q$select * from public.storage_purge_claim(10, 0)$q$) = '42501', 'a visitor cannot claim purge work through the API');
select pg_temp.check(pg_temp.fails($q$select public.storage_purge_status()$q$) = '42501', 'a visitor cannot read the purge status');
reset role;
set role authenticated;
select pg_temp.check(pg_temp.fails($q$select * from public.storage_purge_claim(10, 0)$q$) = '42501', 'a member cannot claim purge work through the API');
select pg_temp.check(pg_temp.fails($q$select public.storage_purge_failed('profile-photos', array['x'], 'e')$q$) = '42501', 'a member cannot mark purge work');
reset role;

set role service_role;
create temp table api_claim as select * from public.storage_purge_claim(100, 900) where name like '%/purge-api.jpg';
select pg_temp.check((select count(*) from api_claim) = 1, 'the server key claims queued work through the wrapper');
select pg_temp.check(public.storage_purge_failed('profile-photos', array['fa000000-0000-0000-0000-0000000000a1/purge-api.jpg'], 'storage 500') = 1, 'the server key records a failed delete');
select pg_temp.check((public.storage_purge_status() ->> 'waiting') is not null, 'the server key reads the status (counts only)');
reset role;

delete from private.storage_cleanup where name like '%/purge-api.jpg';
