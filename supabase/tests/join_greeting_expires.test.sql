-- "X just joined 👋 Say hello!" goes 5 minutes after it was posted
-- (migration 20261030000100_irly_join_greeting_expires); other IRLY lines and
-- members' messages stay. Ids use the prefix f3005000-….
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL join_greeting_expires: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

reset role;
insert into auth.users (id) values ('f3005000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('f3005000-0000-0000-0000-0000000000a1', 'Ana', '1994-03-03', 'woman', 'dubai');
insert into public.conversations (id, kind) values ('f3005000-0000-0000-0000-0000000000c1', 'group');
insert into public.messages (id, conversation_id, sender_id, kind, body, created_at) values
  ('f3005000-0000-0000-0000-0000000000d1', 'f3005000-0000-0000-0000-0000000000c1', null, 'system', 'Sara just joined 👋 Say hello!', now() - interval '6 minutes'),
  ('f3005000-0000-0000-0000-0000000000d2', 'f3005000-0000-0000-0000-0000000000c1', null, 'system', 'Lina just joined 👋 Say hello!', now() - interval '2 minutes'),
  ('f3005000-0000-0000-0000-0000000000d3', 'f3005000-0000-0000-0000-0000000000c1', null, 'system', 'Welcome to the community', now() - interval '1 day'),
  ('f3005000-0000-0000-0000-0000000000d4', 'f3005000-0000-0000-0000-0000000000c1', 'f3005000-0000-0000-0000-0000000000a1', 'text', 'Sara just joined 👋 Say hello!', now() - interval '1 day');

select private.purge_join_greetings();
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.messages where id = 'f3005000-0000-0000-0000-0000000000d1'), 'a greeting older than 5 minutes is gone');
  perform pg_temp.check(exists (select 1 from public.messages where id = 'f3005000-0000-0000-0000-0000000000d2'), 'a greeting of 2 minutes stays');
  perform pg_temp.check(exists (select 1 from public.messages where id = 'f3005000-0000-0000-0000-0000000000d3'), 'other IRLY lines stay');
  perform pg_temp.check(exists (select 1 from public.messages where id = 'f3005000-0000-0000-0000-0000000000d4'), 'a member''s message with the same words stays');
end $$;

delete from public.conversations where id = 'f3005000-0000-0000-0000-0000000000c1';
delete from public.profiles where id = 'f3005000-0000-0000-0000-0000000000a1';
delete from auth.users where id = 'f3005000-0000-0000-0000-0000000000a1';
