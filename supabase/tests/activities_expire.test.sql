-- Ended activities are removed (migration 20261029600000_irly_activities_expire):
-- two hours after their end, or six hours after their start without an end;
-- upcoming and running ones stay. Ids use the prefix f2504000-…. Each block
-- raises if a rule does not hold.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL activities_expire: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

reset role;
insert into auth.users (id) values ('f2504000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f2504000-0000-0000-0000-0000000000a1', 'Ana', '1994-03-03', 'woman', 'dubai');
-- Made upcoming (the app refuses a past start), then moved into the past as time would.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, ends_at) values
  ('f2504000-0000-0000-0000-0000000000b1', 'f2504000-0000-0000-0000-0000000000a1', 'Ended with an end', 'sport', 'dubai', 'jlt', now() + interval '1 day', now() + interval '1 day 2 hours'),
  ('f2504000-0000-0000-0000-0000000000b2', 'f2504000-0000-0000-0000-0000000000a1', 'Ended, no end', 'sport', 'dubai', 'jlt', now() + interval '1 day', null),
  ('f2504000-0000-0000-0000-0000000000b3', 'f2504000-0000-0000-0000-0000000000a1', 'Just ended', 'sport', 'dubai', 'jlt', now() + interval '1 day', now() + interval '1 day 1 hour'),
  ('f2504000-0000-0000-0000-0000000000b4', 'f2504000-0000-0000-0000-0000000000a1', 'Running now', 'sport', 'dubai', 'jlt', now() + interval '1 day', null),
  ('f2504000-0000-0000-0000-0000000000b5', 'f2504000-0000-0000-0000-0000000000a1', 'Tomorrow', 'sport', 'dubai', 'jlt', now() + interval '1 day', null);
set session_replication_role = replica;
update public.activities set starts_at = now() - interval '5 hours', ends_at = now() - interval '3 hours' where id = 'f2504000-0000-0000-0000-0000000000b1';
update public.activities set starts_at = now() - interval '7 hours' where id = 'f2504000-0000-0000-0000-0000000000b2';
update public.activities set starts_at = now() - interval '2 hours', ends_at = now() - interval '1 hour' where id = 'f2504000-0000-0000-0000-0000000000b3';
update public.activities set starts_at = now() - interval '1 hour' where id = 'f2504000-0000-0000-0000-0000000000b4';
set session_replication_role = origin;

select private.purge_ended_activities();
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'f2504000-0000-0000-0000-0000000000b1'), 'removed two hours after its end');
  perform pg_temp.check(not exists (select 1 from public.activities where id = 'f2504000-0000-0000-0000-0000000000b2'), 'without an end: removed six hours after its start');
  perform pg_temp.check(exists (select 1 from public.activities where id = 'f2504000-0000-0000-0000-0000000000b3'), 'ended an hour ago: still there (thank-you time)');
  perform pg_temp.check(exists (select 1 from public.activities where id = 'f2504000-0000-0000-0000-0000000000b4'), 'running: still there');
  perform pg_temp.check(exists (select 1 from public.activities where id = 'f2504000-0000-0000-0000-0000000000b5'), 'upcoming: still there');
end $$;

-- Only the database runs it.
do $$
begin
  perform pg_temp.check(not has_function_privilege('authenticated', 'private.purge_ended_activities(integer)', 'execute'), 'members cannot call the purge');
  perform pg_temp.check(not has_function_privilege('anon', 'private.purge_ended_activities(integer)', 'execute'), 'signed out cannot call the purge');
end $$;
