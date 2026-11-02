-- QA fixes, activities (20261103400000_irly_qa_fix_activities.sql):
-- ACT-01 the daily limit holds under parallel creates, ACT-02 a community's
-- ended plans stay for its « Past » tab (their chat goes as before), ACT-03 a
-- Live's plan ends with the Live, ACT-04 the host is always going, ACT-06 no
-- « uncancel », ACT-07 no moving a plan into the past, ACT-08 new plans are
-- validated, ACT-09 a removed plan's files are queued for the storage purge,
-- ACT-10 leaving a community leaves its members-only plans.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed e7a00000-….
--
--   a1 Hana  woman, hosts the plans
--   a2 Mo    man, community member
--   a3 Wia   woman, participant
--   a5 Rae   woman, creates plans in parallel (ACT-01)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

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
    raise exception 'FAIL activities_qa_fixes: %', label;
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

select pg_temp.as_admin();
insert into auth.users (id) values ('e7a00000-0000-0000-0000-0000000000a1'), ('e7a00000-0000-0000-0000-0000000000a2'),
  ('e7a00000-0000-0000-0000-0000000000a3'), ('e7a00000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('e7a00000-0000-0000-0000-0000000000a1', 'Hana', '1994-02-02', 'woman', 'dubai'),
  ('e7a00000-0000-0000-0000-0000000000a2', 'Mo', '1993-03-03', 'man', 'dubai'),
  ('e7a00000-0000-0000-0000-0000000000a3', 'Wia', '1995-04-04', 'woman', 'dubai'),
  ('e7a00000-0000-0000-0000-0000000000a5', 'Rae', '1996-05-05', 'woman', 'dubai');
insert into public.communities (id, city_id, name, created_by) values
  ('e7a00000-0000-0000-0000-0000000000c1', 'dubai', 'e7a Runners', 'e7a00000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('e7a00000-0000-0000-0000-0000000000c1', 'e7a00000-0000-0000-0000-0000000000a1', 'owner'),
  ('e7a00000-0000-0000-0000-0000000000c1', 'e7a00000-0000-0000-0000-0000000000a2', 'member');

-- ───────── ACT-08. New plans are validated ─────────
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a1');
create temp table bad (label text, stmt text);
grant all on bad to authenticated;
insert into bad values
  ('a start three days ago', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'e7a past', 'sport', 'bali', 'canggu', now() - interval '3 days')$q$),
  ('a start in 2199', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'e7a far', 'sport', 'bali', 'canggu', '2199-01-01T10:00:00Z')$q$),
  ('a plan of 401 days', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, ends_at) values (auth.uid(), 'e7a long', 'sport', 'bali', 'canggu', now() + interval '1 day', now() + interval '402 days')$q$),
  ('a price of 21 million AED', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, price_minor) values (auth.uid(), 'e7a dear', 'sport', 'bali', 'canggu', now() + interval '1 day', 2147483647)$q$),
  ('a made-up currency', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, currency) values (auth.uid(), 'e7a money', 'sport', 'bali', 'canggu', now() + interval '1 day', 'XYZ!!')$q$),
  ('an unknown category', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'e7a what', 'nonsense', 'bali', 'canggu', now() + interval '1 day')$q$),
  ('a blank title', $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), '    ', 'sport', 'bali', 'canggu', now() + interval '1 day')$q$);
do $$
declare
  r record;
  accepted text[] := '{}';
begin
  for r in select * from bad loop
    if pg_temp.fails(r.stmt) is null then accepted := accepted || r.label; end if;
  end loop;
  perform pg_temp.check(cardinality(accepted) = 0, 'ACT-08 each of the 7 bad plans is refused (accepted: ' || array_to_string(accepted, ', ') || ')');
end $$;
select pg_temp.check(pg_temp.fails($q$insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, ends_at, price_minor, currency, capacity)
  values ('e7a00000-0000-0000-0000-0000000000b1', auth.uid(), 'e7a Sunday run', 'sport', 'bali', 'canggu', now() + interval '2 days', now() + interval '2 days 2 hours', 5000, 'AED', 5)$q$) is null,
  'ACT-08 a normal plan is still created');

-- ───────── ACT-04. The host is always going ─────────
select pg_temp.check(pg_temp.fails($q$select public.join_activity('e7a00000-0000-0000-0000-0000000000b1', 'not_going')$q$) is not null, 'ACT-04 the host cannot set herself not going');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('e7a00000-0000-0000-0000-0000000000b1', 'maybe')$q$) is not null, 'ACT-04 nor maybe');
select pg_temp.check((select status from public.activity_participants where activity_id = 'e7a00000-0000-0000-0000-0000000000b1' and user_id = auth.uid()) = 'going',
  'ACT-04 the host is still going');

-- ───────── ACT-07. No moving a plan into the past ─────────
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a3');
select pg_temp.check(public.join_activity('e7a00000-0000-0000-0000-0000000000b1') = 'going', 'Wia joins the plan');
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$update public.activities set starts_at = now() - interval '7 days', ends_at = null where id = 'e7a00000-0000-0000-0000-0000000000b1'$q$) = '22023',
  'ACT-07 a plan cannot be moved a week back');
select pg_temp.check(pg_temp.fails($q$update public.activities set ends_at = now() - interval '1 hour' where id = 'e7a00000-0000-0000-0000-0000000000b1'$q$) is not null,
  'ACT-07 nor given an end in the past');
select pg_temp.check(pg_temp.fails($q$update public.activities set starts_at = now() + interval '3 days', ends_at = now() + interval '3 days 2 hours', title = 'e7a Monday run' where id = 'e7a00000-0000-0000-0000-0000000000b1'$q$) is null,
  'ACT-07 moving it later still works');

-- ───────── ACT-06. A cancelled plan stays cancelled ─────────
select pg_temp.check(pg_temp.fails($q$update public.activities set cancelled_at = now() where id = 'e7a00000-0000-0000-0000-0000000000b1'$q$) is null, 'ACT-06 the host cancels');
select pg_temp.check(pg_temp.fails($q$update public.activities set cancelled_at = null where id = 'e7a00000-0000-0000-0000-0000000000b1'$q$) = '42501', 'ACT-06 and cannot uncancel');
select pg_temp.as_admin();
select pg_temp.check((select cancelled_at is not null from public.activities where id = 'e7a00000-0000-0000-0000-0000000000b1'), 'ACT-06 still cancelled');
select pg_temp.check((select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
  where c.activity_id = 'e7a00000-0000-0000-0000-0000000000b1' and m.kind = 'system' and m.body = 'This plan was cancelled by the host.') = 1,
  'ACT-06 one cancellation notice in the chat');

-- ───────── ACT-03. A Live's plan lasts as long as the Live ─────────
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"e7a00000-0000-0000-0000-0000000000d1","city_id":"bali","area_id":"canggu","body":"e7a coffee at the marina","visibility":"everyone"}'::jsonb,
  jsonb_build_object('format', 'meetup', 'title', 'e7a coffee at the marina', 'category_id', 'food', 'city_id', 'bali', 'area_id', 'canggu',
    'place_name', 'Marina', 'starts_at', now() + interval '30 minutes', 'timezone', 'Asia/Makassar', 'price_minor', 0, 'currency', 'IDR', 'privacy', 'public'));
select pg_temp.as_admin();
select pg_temp.check((select a.ends_at = i.expires_at from public.irl_posts i join public.activities a on a.id = i.activity_id
  where i.id = 'e7a00000-0000-0000-0000-0000000000d1'), 'ACT-03 the Live''s plan ends when the Live does');
-- Three hours later (as time would): still joinable, still there after the purge.
set session_replication_role = replica;
update public.irl_posts set created_at = created_at - interval '3 hours', expires_at = expires_at - interval '3 hours' where id = 'e7a00000-0000-0000-0000-0000000000d1';
update public.activities a set starts_at = a.starts_at - interval '3 hours', ends_at = a.ends_at - interval '3 hours'
  from public.irl_posts i where i.id = 'e7a00000-0000-0000-0000-0000000000d1' and a.id = i.activity_id;
set session_replication_role = origin;
select private.purge_ended_activities();
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a3');
select pg_temp.check(public.join_activity((select activity_id from public.irl_posts where id = 'e7a00000-0000-0000-0000-0000000000d1')) = 'going',
  'ACT-03 three hours on, the Live''s plan is still joinable');

-- ───────── ACT-10. Leaving a community leaves its members-only plans ─────────
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id) values
  ('e7a00000-0000-0000-0000-0000000000b2', auth.uid(), 'e7a members run', 'sport', 'bali', 'canggu', now() + interval '1 day', 'community', 'e7a00000-0000-0000-0000-0000000000c1'),
  ('e7a00000-0000-0000-0000-0000000000b3', auth.uid(), 'e7a open run', 'sport', 'bali', 'canggu', now() + interval '1 day', 'public', 'e7a00000-0000-0000-0000-0000000000c1');
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.join_activity('e7a00000-0000-0000-0000-0000000000b2') = 'going', 'Mo joins the members-only plan');
select pg_temp.check(public.join_activity('e7a00000-0000-0000-0000-0000000000b3') = 'going', 'Mo joins the open plan');
select public.leave_community('e7a00000-0000-0000-0000-0000000000c1');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.activity_participants where activity_id = 'e7a00000-0000-0000-0000-0000000000b2' and user_id = 'e7a00000-0000-0000-0000-0000000000a2'),
  'ACT-10 leaving the community leaves its members-only plan');
select pg_temp.check(not exists (select 1 from public.conversation_members m join public.conversations c on c.id = m.conversation_id
  where c.activity_id = 'e7a00000-0000-0000-0000-0000000000b2' and m.user_id = 'e7a00000-0000-0000-0000-0000000000a2'), 'ACT-10 and its chat');
select pg_temp.check(exists (select 1 from public.activity_participants where activity_id = 'e7a00000-0000-0000-0000-0000000000b3' and user_id = 'e7a00000-0000-0000-0000-0000000000a2' and status = 'going'),
  'ACT-10 a plan open to everyone is kept');
select pg_temp.check(exists (select 1 from public.activity_participants where activity_id = 'e7a00000-0000-0000-0000-0000000000b2' and user_id = 'e7a00000-0000-0000-0000-0000000000a1' and status = 'going'),
  'ACT-10 the host keeps her plan');

-- ───────── ACT-02 and ACT-09. The purge: Past tab kept, files queued ─────────
select pg_temp.as_admin();
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, cover_path) values
  ('e7a00000-0000-0000-0000-0000000000e1', 'e7a00000-0000-0000-0000-0000000000a1', 'e7a community yesterday', 'sport', 'bali', 'canggu', now() + interval '1 day', 'e7a00000-0000-0000-0000-0000000000c1', 'e7a00000-0000-0000-0000-0000000000a1/e1.jpg'),
  ('e7a00000-0000-0000-0000-0000000000e2', 'e7a00000-0000-0000-0000-0000000000a1', 'e7a plain yesterday', 'sport', 'bali', 'canggu', now() + interval '1 day', null, 'e7a00000-0000-0000-0000-0000000000a1/e2.jpg'),
  ('e7a00000-0000-0000-0000-0000000000e3', 'e7a00000-0000-0000-0000-0000000000a1', 'e7a community long ago', 'sport', 'bali', 'canggu', now() + interval '1 day', 'e7a00000-0000-0000-0000-0000000000c1', null),
  ('e7a00000-0000-0000-0000-0000000000e4', 'e7a00000-0000-0000-0000-0000000000a1', 'e7a reported yesterday', 'sport', 'bali', 'canggu', now() + interval '1 day', null, 'e7a00000-0000-0000-0000-0000000000a1/e4.jpg');
insert into public.reports (reporter_id, target_kind, target_id, category) values
  ('e7a00000-0000-0000-0000-0000000000a3', 'activity', 'e7a00000-0000-0000-0000-0000000000e4', 'spam');
insert into public.messages (conversation_id, sender_id, kind, body, media_path)
select c.id, 'e7a00000-0000-0000-0000-0000000000a1', 'photo', 'Photo', 'e7a00000-0000-0000-0000-0000000000a1/chat-e1.jpg'
from public.conversations c where c.activity_id = 'e7a00000-0000-0000-0000-0000000000e1';
insert into public.messages (conversation_id, sender_id, kind, body, media_path)
select c.id, 'e7a00000-0000-0000-0000-0000000000a1', 'photo', 'Photo', 'e7a00000-0000-0000-0000-0000000000a1/chat-e2.jpg'
from public.conversations c where c.activity_id = 'e7a00000-0000-0000-0000-0000000000e2';
set session_replication_role = replica;
update public.activities set starts_at = now() - interval '1 day' where id in ('e7a00000-0000-0000-0000-0000000000e1', 'e7a00000-0000-0000-0000-0000000000e2', 'e7a00000-0000-0000-0000-0000000000e4');
update public.activities set starts_at = now() - interval '61 days' where id = 'e7a00000-0000-0000-0000-0000000000e3';
set session_replication_role = origin;
select private.purge_ended_activities();

select pg_temp.check(exists (select 1 from public.activities where id = 'e7a00000-0000-0000-0000-0000000000e1'), 'ACT-02 an ended community plan stays for the Past tab');
select pg_temp.check(not exists (select 1 from public.conversations where activity_id = 'e7a00000-0000-0000-0000-0000000000e1'), 'ACT-02 its chat goes at the usual time');
select pg_temp.check(not exists (select 1 from public.activities where id = 'e7a00000-0000-0000-0000-0000000000e2'), 'ACT-02 a plan outside a community is purged as before');
select pg_temp.check(not exists (select 1 from public.activities where id = 'e7a00000-0000-0000-0000-0000000000e3'), 'ACT-02 a community plan older than 60 days is purged');
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.community_activities('e7a00000-0000-0000-0000-0000000000c1', true) where id = 'e7a00000-0000-0000-0000-0000000000e1'),
  'ACT-02 the Past tab lists it');
select pg_temp.as_user('e7a00000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.community_activities('e7a00000-0000-0000-0000-0000000000c1', true) where id = 'e7a00000-0000-0000-0000-0000000000b2'),
  'ACT-02 nothing new is visible: a members-only plan stays hidden from a former member');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.storage_cleanup where bucket_id = 'activity-photos' and name = 'e7a00000-0000-0000-0000-0000000000a1/e2.jpg' and done_at is null),
  'ACT-09 a purged plan''s cover is queued for the storage purge');
select pg_temp.check(exists (select 1 from private.storage_cleanup where bucket_id = 'chat-media' and name = 'e7a00000-0000-0000-0000-0000000000a1/chat-e2.jpg'),
  'ACT-09 so are its chat photos');
select pg_temp.check(exists (select 1 from private.storage_cleanup where bucket_id = 'chat-media' and name = 'e7a00000-0000-0000-0000-0000000000a1/chat-e1.jpg'),
  'ACT-09 and the photos of a kept community plan''s chat');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name = 'e7a00000-0000-0000-0000-0000000000a1/e1.jpg'),
  'ACT-09 the cover of a kept plan is not queued');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name = 'e7a00000-0000-0000-0000-0000000000a1/e4.jpg'),
  'ACT-09 a reported plan''s cover is kept for the team');

-- ───────── ACT-01. The daily limit holds under parallel creates ─────────
-- Two sessions create Rae's 20th and 21st plan at the same time: one is
-- refused. Needs dblink back to this database (skipped, with a notice, where
-- it is not available).
select pg_temp.as_admin();
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at)
select 'e7a00000-0000-0000-0000-0000000000a5', 'e7a rae ' || g, 'sport', 'bali', 'canggu', now() + interval '1 day' from generate_series(1, 19) g;
do $$
declare
  who text := $q$begin; set local role authenticated; set local request.jwt.claim.sub = 'e7a00000-0000-0000-0000-0000000000a5';$q$;
  ins text := $q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values ('e7a00000-0000-0000-0000-0000000000a5', 'e7a rae parallel', 'sport', 'bali', 'canggu', now() + interval '1 day') returning id::text$q$;
  cs text := 'dbname=' || current_database();
  n integer;
begin
  begin
    create extension if not exists dblink;
    perform dblink_connect('e7a_one', cs);
    perform dblink_connect('e7a_two', cs);
  exception when others then
    raise notice 'skip ACT-01 parallel check: dblink unavailable (%)', sqlerrm;
    return;
  end;
  perform dblink_exec('e7a_one', who);
  perform dblink_exec('e7a_two', who);
  -- The 20th, not committed yet; the 21st sent meanwhile from the other session.
  perform * from dblink('e7a_one', ins) as t(id text);
  perform dblink_send_query('e7a_two', ins);
  perform pg_sleep(1);
  perform dblink_exec('e7a_one', 'commit');
  -- The second one finishes: refused (limit held) or created (limit broken).
  perform * from dblink_get_result('e7a_two', false) as t(id text);
  perform * from dblink_get_result('e7a_two', false) as t(id text);
  perform dblink_exec('e7a_two', 'commit');
  perform dblink_disconnect('e7a_one');
  perform dblink_disconnect('e7a_two');
  select count(*) into n from public.activities where creator_id = 'e7a00000-0000-0000-0000-0000000000a5';
  perform pg_temp.check(n = 20, 'ACT-01 two parallel creates at the limit: 20 plans, not ' || n);
end $$;
