-- Live + "Anyone can join" (20261020001500_irly_live_activity.sql): the Live
-- and its activity are saved together or not at all; a retry never makes a
-- second Live or a second activity; an abandoned Live can never land later;
-- rolling back an activity respects the people who joined it; and a publish
-- racing an abandon of the same Live is serialized (the first one wins).
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
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The error code a statement raises ('' when it succeeds).
create or replace function pg_temp.err(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return '';
exception when others then
  return sqlstate;
end $$;

create or replace function pg_temp.post(pid uuid, body text, with_activity boolean) returns jsonb language sql as $$
  select public.post_live(
    jsonb_build_object('id', pid, 'city_id', 'dubai', 'area_id', 'marina', 'place_name', 'Dubai Marina', 'body', body,
      'media_path', auth.uid()::text || '/' || pid::text || '.jpg', 'media_kind', 'photo', 'media_ratio', 0.8),
    case when with_activity then jsonb_build_object('title', left(body, 80), 'format', 'meetup', 'category_id', 'food', 'city_id', 'dubai',
      'area_id', 'marina', 'place_name', 'Dubai Marina', 'starts_at', now() + interval '30 minutes', 'privacy', 'public', 'currency', 'AED') end)
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('7f000000-0000-0000-0000-0000000000a1'), ('7f000000-0000-0000-0000-0000000000a2'), ('7f000000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('7f000000-0000-0000-0000-0000000000a1', 'Lina', '1992-03-03', 'woman', 'dubai'),
  ('7f000000-0000-0000-0000-0000000000a2', 'Karim', '1990-04-04', 'man', 'dubai'),
  ('7f000000-0000-0000-0000-0000000000a3', 'Rana', '1994-05-05', 'woman', 'dubai');

-- 1. Published together, once, and a retry gets the same row back.
do $$
declare
  pid uuid := '7f000000-0000-0000-0000-00000000b001';
  r1 jsonb;
  r2 jsonb;
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
  r1 := pg_temp.post(pid, 'Coffee at the Marina, join?', true);
  perform pg_temp.check((r1 ->> 'id')::uuid = pid and (r1 ->> 'activity_id') is not null and not (r1 ->> 'replayed')::boolean, 'Live and activity saved together');
  perform pg_temp.check(exists (select 1 from public.activities where id = (r1 ->> 'activity_id')::uuid and client_ref = pid and cancelled_at is null), 'the activity carries the Live id as its client_ref');
  -- Double tap / lost answer: the same request again.
  r2 := pg_temp.post(pid, 'Coffee at the Marina, join?', true);
  perform pg_temp.check((r2 ->> 'replayed')::boolean and r2 ->> 'activity_id' = r1 ->> 'activity_id', 'a retry returns the saved Live and the same activity');
  perform pg_temp.check((select count(*) from public.irl_posts where id = pid) = 1, 'one Live');
  perform pg_temp.check((select count(*) from public.activities where client_ref = pid) = 1, 'one activity');
  -- Abandoning a Live that landed changes nothing.
  perform pg_temp.check(public.abandon_live(pid) = 'published', 'abandon of a published Live answers published');
  perform pg_temp.check(exists (select 1 from public.activities where client_ref = pid and cancelled_at is null), 'its activity stays on');
  perform pg_temp.check(exists (select 1 from public.irl_posts where id = pid), 'the Live stays');
  -- Someone else's Live id: never touched.
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(public.abandon_live(pid) = 'not_mine', 'abandon of someone else''s Live is refused quietly');
  perform pg_temp.check(pg_temp.err(format('select public.post_live(%L::jsonb)', jsonb_build_object('id', pid, 'city_id', 'dubai', 'area_id', 'marina', 'body', 'x'))) <> '', 'someone else''s Live id cannot be reused');
  perform pg_temp.as_admin();
end $$;

-- 2. A refused Live leaves no activity behind (same transaction).
do $$
declare
  pid uuid := '7f000000-0000-0000-0000-00000000b002';
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a2');
  -- Text over 160 characters: the Live is refused after the activity insert.
  perform pg_temp.check(pg_temp.err(format('select pg_temp.post(%L, %L, true)', pid, repeat('x', 200))) <> '', 'an invalid Live is refused');
  perform pg_temp.check(not exists (select 1 from public.activities where client_ref = pid), 'its activity was not kept');
  perform pg_temp.check(not exists (select 1 from public.irl_posts where id = pid), 'no Live');
  -- Someone else's file: refused, no activity.
  perform pg_temp.check(pg_temp.err(format('select public.post_live(%L::jsonb, %L::jsonb)',
    jsonb_build_object('id', pid, 'city_id', 'dubai', 'area_id', 'marina', 'body', 'hi', 'media_path', '7f000000-0000-0000-0000-0000000000a1/x.jpg'),
    jsonb_build_object('title', 'hi there', 'starts_at', now() + interval '30 minutes'))) <> '', 'a Live pointing at someone else''s file is refused');
  perform pg_temp.check(not exists (select 1 from public.activities where client_ref = pid), 'and leaves no activity');
  -- Signed out: refused.
  perform pg_temp.as_admin();
  execute 'set role anon';
  perform pg_temp.check(pg_temp.err(format('select public.post_live(%L::jsonb)', jsonb_build_object('id', pid))) = '42501', 'signed out cannot post');
  perform pg_temp.check(pg_temp.err(format('select public.abandon_live(%L)', pid)) = '42501', 'signed out cannot abandon');
  perform pg_temp.as_admin();
end $$;

-- 3. Rate limit: the 13th Live of the hour is refused and its activity goes with it.
do $$
declare
  i int;
  pid uuid := '7f000000-0000-0000-0000-00000000b003';
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a3');
  for i in 1..12 loop
    insert into public.irl_posts (author_id, city_id, area_id, body) values (auth.uid(), 'dubai', 'marina', 'post ' || i);
  end loop;
  perform pg_temp.check(pg_temp.err(format('select pg_temp.post(%L, %L, true)', pid, 'One more, join?')) = '54000', 'rate limit refuses the Live');
  perform pg_temp.check(not exists (select 1 from public.activities where client_ref = pid), 'rate-limited Live leaves no activity');
  perform pg_temp.as_admin();
  delete from public.irl_posts where author_id = '7f000000-0000-0000-0000-0000000000a3';
end $$;

-- 4. Abandoned before it landed: a late copy of the request can never publish it.
do $$
declare
  pid uuid := '7f000000-0000-0000-0000-00000000b004';
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(public.abandon_live(pid) = 'abandoned', 'abandon of an unsent Live');
  perform pg_temp.check(public.abandon_live(pid) = 'abandoned', 'abandon twice is quiet');
  perform pg_temp.check(pg_temp.err(format('select pg_temp.post(%L, %L, true)', pid, 'Late arrival')) = '22023', 'a late publish of an abandoned Live is refused');
  perform pg_temp.check(not exists (select 1 from public.irl_posts where id = pid) and not exists (select 1 from public.activities where client_ref = pid), 'nothing of it exists');
  perform pg_temp.as_admin();
end $$;

-- 5. An activity made for the Live by an older app (same client_ref, Live never saved).
do $$
declare
  alone uuid := '7f000000-0000-0000-0000-00000000b005';
  joined uuid := '7f000000-0000-0000-0000-00000000b006';
  a_alone uuid;
  a_joined uuid;
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref, format)
  values (auth.uid(), 'Nobody came', 'food', 'dubai', 'marina', now() + interval '30 minutes', alone, 'meetup') returning id into a_alone;
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref, format)
  values (auth.uid(), 'Karim joined', 'food', 'dubai', 'marina', now() + interval '30 minutes', joined, 'meetup') returning id into a_joined;
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a2');
  perform public.join_activity(a_joined, 'going');
  -- Only its host can roll it back.
  perform pg_temp.check(public.abandon_live(alone) = 'abandoned', 'another member abandoning the id finds nothing of theirs');
  perform pg_temp.as_admin();
  perform pg_temp.check(exists (select 1 from public.activities where id = a_alone and cancelled_at is null), 'the host''s activity is untouched by someone else');
  delete from private.live_abandoned where post_id = alone;
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(public.abandon_live(alone) = 'deleted', 'nobody else in it: deleted');
  perform pg_temp.check(not exists (select 1 from public.activities where id = a_alone), 'gone');
  perform pg_temp.check(public.abandon_live(joined) = 'cancelled', 'someone joined: cancelled');
  perform pg_temp.as_admin();
  perform pg_temp.check(exists (select 1 from public.activities where id = a_joined and cancelled_at is not null), 'kept, called off, never deleted');
  perform pg_temp.check(exists (select 1 from public.activity_participants where activity_id = a_joined and user_id = '7f000000-0000-0000-0000-0000000000a2'), 'Karim keeps his place in its history');
end $$;

-- 6. An activity left from an earlier try is reused, not doubled.
do $$
declare
  pid uuid := '7f000000-0000-0000-0000-00000000b007';
  a uuid;
  r jsonb;
begin
  perform pg_temp.as_user('7f000000-0000-0000-0000-0000000000a2');
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref, format)
  values (auth.uid(), 'Started earlier', 'food', 'dubai', 'marina', now() + interval '30 minutes', pid, 'meetup') returning id into a;
  r := pg_temp.post(pid, 'Started earlier', true);
  perform pg_temp.check((r ->> 'activity_id')::uuid = a, 'the existing activity is linked');
  perform pg_temp.check((select count(*) from public.activities where client_ref = pid) = 1, 'still one activity');
  -- A Live without "anyone can join" makes no activity.
  r := pg_temp.post('7f000000-0000-0000-0000-00000000b008', 'Just me', false);
  perform pg_temp.check(r ->> 'activity_id' is null and not exists (select 1 from public.activities where client_ref = '7f000000-0000-0000-0000-00000000b008'), 'no activity unless asked');
  perform pg_temp.as_admin();
end $$;

-- 7. Concurrency (two sessions, when dblink is available): a publish and an
-- abandon of the same Live, and a double publish, are serialized.
do $$
begin
  create extension if not exists dblink;
exception when others then
  raise notice 'skip  dblink not available: concurrency checks skipped';
end $$;

create or replace function pg_temp.peer() returns boolean language plpgsql as $$
begin
  if not exists (select 1 from pg_extension where extname = 'dblink') then return false; end if;
  begin
    perform dblink_disconnect('peer');
  exception when others then null;
  end;
  perform dblink_connect('peer', format('dbname=%s user=postgres', current_database()));
  perform dblink_exec('peer', 'set role authenticated');
  perform * from dblink('peer', format('select set_config(%L, %L, false)', 'request.jwt.claim.sub', '7f000000-0000-0000-0000-0000000000a1')) as t(v text);
  return true;
exception when others then
  raise notice 'skip  second session not available (%): concurrency checks skipped', sqlerrm;
  return false;
end $$;

select pg_temp.peer() as peer \gset

\if :peer
-- 7a. Abandon holds the Live (uncommitted) while the other session publishes it.
begin;
select pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
select public.abandon_live('7f000000-0000-0000-0000-00000000b010');
select pg_temp.as_admin();
select dblink_send_query('peer', $q$select public.post_live('{"id":"7f000000-0000-0000-0000-00000000b010","city_id":"dubai","area_id":"marina","body":"Race"}'::jsonb, jsonb_build_object('title', 'Race', 'starts_at', now() + interval '30 minutes'))$q$);
select pg_sleep(0.4);
select pg_temp.check(dblink_is_busy('peer') = 1, 'a publish waits while the same Live is being abandoned');
commit;
select pg_temp.check(count(*) = 0, 'the waiting publish is refused once the abandon commits')
from dblink_get_result('peer', false) as t(r jsonb);
select pg_temp.check(dblink_error_message('peer') like '%abandoned%', 'refused because it was abandoned');
select * from dblink_get_result('peer', false) as t(r jsonb);
select pg_temp.check(not exists (select 1 from public.irl_posts where id = '7f000000-0000-0000-0000-00000000b010')
  and not exists (select 1 from public.activities where client_ref = '7f000000-0000-0000-0000-00000000b010'), 'nothing published after the race');

-- 7b. A publish holds the Live while the other session abandons it: the abandon sees it published.
begin;
select pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
select pg_temp.post('7f000000-0000-0000-0000-00000000b011', 'Race two', true);
select pg_temp.as_admin();
select dblink_send_query('peer', $q$select public.abandon_live('7f000000-0000-0000-0000-00000000b011')$q$);
select pg_sleep(0.4);
select pg_temp.check(dblink_is_busy('peer') = 1, 'an abandon waits while the same Live is being published');
commit;
select pg_temp.check(r = 'published', 'the waiting abandon sees the Live published and leaves it')
from dblink_get_result('peer') as t(r text);
select * from dblink_get_result('peer', false) as t(r text);
select pg_temp.check(exists (select 1 from public.activities where client_ref = '7f000000-0000-0000-0000-00000000b011' and cancelled_at is null), 'its activity stays on');

-- 7c. Double publish from two sessions: one Live, one activity.
begin;
select pg_temp.as_user('7f000000-0000-0000-0000-0000000000a1');
select pg_temp.post('7f000000-0000-0000-0000-00000000b012', 'Twice', true);
select pg_temp.as_admin();
select dblink_send_query('peer', $q$select public.post_live('{"id":"7f000000-0000-0000-0000-00000000b012","city_id":"dubai","area_id":"marina","body":"Twice"}'::jsonb, jsonb_build_object('title', 'Twice', 'starts_at', now() + interval '30 minutes'))$q$);
select pg_sleep(0.4);
commit;
select pg_temp.check((r ->> 'replayed')::boolean, 'the second publish gets the first one back')
from dblink_get_result('peer') as t(r jsonb);
select * from dblink_get_result('peer', false) as t(r jsonb);
select pg_temp.check((select count(*) from public.irl_posts where id = '7f000000-0000-0000-0000-00000000b012') = 1
  and (select count(*) from public.activities where client_ref = '7f000000-0000-0000-0000-00000000b012') = 1, 'one Live and one activity after a double publish');
select dblink_disconnect('peer');
\endif

select pg_temp.as_admin();
-- dblink was only for this test (its functions would fail the security audit's checks).
drop extension if exists dblink;
