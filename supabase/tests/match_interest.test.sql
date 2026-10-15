-- "Tell me when it opens" for Match IRLY: 'match' is stored and removed like
-- any coming-soon service; earlier ids still work, unknown ids are refused,
-- and signed-out callers cannot write.
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

select pg_temp.as_admin();

insert into auth.users (id) values ('7e000000-0000-0000-0000-0000000000f1');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('7e000000-0000-0000-0000-0000000000f1', 'Milo', '1991-02-02', 'man', 'dubai');

do $$
begin
  perform pg_temp.as_user('7e000000-0000-0000-0000-0000000000f1');
  if public.set_service_interest('match', true) is not true then
    raise exception 'FAIL match interest: turning on did not answer true';
  end if;
  -- Twice is quiet.
  perform public.set_service_interest('match', true);
  if (select count(*) from public.service_interest where user_id = '7e000000-0000-0000-0000-0000000000f1' and service = 'match') <> 1 then
    raise exception 'FAIL match interest: not stored once';
  end if;
  -- Existing ids still accepted.
  perform public.set_service_interest('pro', true);
  perform public.set_service_interest('dest_bali', true);
  -- Unknown id refused.
  begin
    perform public.set_service_interest('nope', true);
    raise exception 'FAIL match interest: unknown service accepted';
  exception when sqlstate '22023' then null;
  end;
  -- Turning off removes it.
  if public.set_service_interest('match', false) is not false then
    raise exception 'FAIL match interest: turning off did not answer false';
  end if;
  if exists (select 1 from public.service_interest where user_id = '7e000000-0000-0000-0000-0000000000f1' and service = 'match') then
    raise exception 'FAIL match interest: still stored after turning off';
  end if;
  -- Signed out: refused.
  perform pg_temp.as_admin();
  execute 'set role anon';
  begin
    perform public.set_service_interest('match', true);
    raise exception 'FAIL match interest: anon could write';
  exception when insufficient_privilege then null;
  end;
  perform pg_temp.as_admin();
  raise notice 'ok  match interest: stored, removed, unknown ids refused';
end $$;

select pg_temp.as_admin();
