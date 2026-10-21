-- IRLY Girl isolation (20261025000100_irly_girl_isolation.sql and every
-- earlier IRLY Girl rule): nobody without IRLY Girl access reads or writes
-- IRLY Girl data by any road (table reads by id, RPCs with a forged space,
-- Realtime's read rules, storage files, notifications, saves, search,
-- counts, chats), and an access that ends mid-session closes all of it.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed ca000000-….
--
--   a1 Ines  woman, IRLY Girl access
--   a2 Jade  woman, IRLY Girl access, owns the women-only community and plan
--   a3 Marc  man (the attacker)
--   a4 Alex  gender « other » (not declared as a woman)
--   a5 Sara  woman suspended from IRLY Girl, deliberately left inside
--   a6 Lea   woman, moderator of the community, whose gender is corrected to
--            « man » by staff mid-test (the revocation)
--   a7 Noor  signed in, no profile yet
--   a8 Staff an IRLY admin (staff role) who corrects Lea's gender
--   a9 Anon  an anonymous session (is_anonymous in its JWT)
--   aa Dina  woman whose account is closed (deleted_at), left inside
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL girl_isolation: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;
-- Rows a statement touches (0 when RLS hides them all, -1 when it fails).
create or replace function pg_temp.touched(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;
-- Rows a query returns as the current role (-1 when it is refused).
create or replace function pg_temp.rows(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*) from (%s) x', q) into n;
  return n;
exception when others then
  return -1;
end $$;

-- ───────── Accounts and IRLY Girl content (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('ca000000-0000-0000-0000-0000000000a1'), ('ca000000-0000-0000-0000-0000000000a2'), ('ca000000-0000-0000-0000-0000000000a3'),
  ('ca000000-0000-0000-0000-0000000000a4'), ('ca000000-0000-0000-0000-0000000000a5'), ('ca000000-0000-0000-0000-0000000000a6'),
  ('ca000000-0000-0000-0000-0000000000a7'), ('ca000000-0000-0000-0000-0000000000a8'), ('ca000000-0000-0000-0000-0000000000a9'),
  ('ca000000-0000-0000-0000-0000000000aa');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ca000000-0000-0000-0000-0000000000a1', 'Ines', '1994-03-03', 'woman', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a2', 'Jade', '1993-05-05', 'woman', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a3', 'Marc', '1992-07-07', 'man', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a4', 'Alex', '1991-08-08', 'other', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a5', 'Sara', '1991-09-09', 'woman', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a6', 'Lea', '1995-10-10', 'woman', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a8', 'Staff', '1990-01-01', 'man', 'dubai'),
  ('ca000000-0000-0000-0000-0000000000aa', 'Dina', '1996-11-11', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values ('ca000000-0000-0000-0000-0000000000a8', 'admin');

-- Women-only community GC (Jade owner; Ines, Lea moderator, Sara and Dina inside), its subgroup, an open community.
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('ca000000-0000-0000-0000-0000000000c1', 'dubai', 'Isolation Girls Circle', 'girl', true, 'ca000000-0000-0000-0000-0000000000a2'),
  ('ca000000-0000-0000-0000-0000000000c3', 'dubai', 'Isolation Open Club', 'sport', false, 'ca000000-0000-0000-0000-0000000000a2');
insert into public.communities (id, city_id, name, category_id, created_by, parent_id) values
  ('ca000000-0000-0000-0000-0000000000c2', 'dubai', 'Isolation Girls Sub', 'girl', 'ca000000-0000-0000-0000-0000000000a2', 'ca000000-0000-0000-0000-0000000000c1');
insert into public.community_members (community_id, user_id, role) values
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a2', 'owner'),
  ('ca000000-0000-0000-0000-0000000000c2', 'ca000000-0000-0000-0000-0000000000a2', 'owner'),
  ('ca000000-0000-0000-0000-0000000000c3', 'ca000000-0000-0000-0000-0000000000a2', 'owner'),
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a1', 'member'),
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a6', 'moderator'),
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a5', 'member'),
  ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000aa', 'member');
-- A post with a poll and a photo, a comment and a reply, likes.
insert into public.community_posts (id, community_id, author_id, body, media_paths, media_kind, poll) values
  ('ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a2',
   'Isolation: rooftop brunch Friday?', array['ca000000-0000-0000-0000-0000000000a2/iso-post.jpg'], 'photo', '{"options":["yes","no"]}');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('ca000000-0000-0000-0000-0000000000e1', 'community_post', 'ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000a1', 'Isolation: count me in');
insert into public.comments (id, target_type, target_id, author_id, body, parent_id) values
  ('ca000000-0000-0000-0000-0000000000e2', 'community_post', 'ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation: great, 11am', 'ca000000-0000-0000-0000-0000000000e1');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('ca000000-0000-0000-0000-0000000000e3', 'community_post', 'ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000a6', 'Isolation: Lea was here');
insert into public.likes (target_type, target_id, user_id) values
  ('community_post', 'ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000a1'),
  ('comment', 'ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000a2');
-- Women-only plan GA (Jade; Ines, Lea, Sara going), a women-only plan Lea hosts, an open plan.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation girls padel', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'girls'),
  ('ca000000-0000-0000-0000-0000000000b3', 'ca000000-0000-0000-0000-0000000000a6', 'Isolation Lea sunset', 'sport', 'dubai', 'marina', now() + interval '5 days', true, 'girls');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('ca000000-0000-0000-0000-0000000000b2', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation open run', 'sport', 'dubai', 'marina', now() + interval '4 days');
insert into public.activity_participants (activity_id, user_id, status) values
  ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000a1', 'going'),
  ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000a6', 'going'),
  ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000a5', 'going');
-- A past women-only plan Jade organised with Ines (her badge and the city's challenge count it).
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('ca000000-0000-0000-0000-0000000000b4', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation girls breakfast', 'food', 'dubai', 'marina', now() + interval '1 day', true, 'girls');
insert into public.activity_participants (activity_id, user_id, status) values
  ('ca000000-0000-0000-0000-0000000000b4', 'ca000000-0000-0000-0000-0000000000a1', 'going');
update public.activities set starts_at = now() - interval '1 minute' where id = 'ca000000-0000-0000-0000-0000000000b4';
-- The chats the server opened, with a message (and a photo) in each.
select id as gc_chat from public.conversations where community_id = 'ca000000-0000-0000-0000-0000000000c1' \gset
select id as ga_chat from public.conversations where activity_id = 'ca000000-0000-0000-0000-0000000000b1' \gset
select pg_temp.check(:'gc_chat' <> '' and :'ga_chat' <> '', 'setup: the women-only community and plan have their chats');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('ca000000-0000-0000-0000-000000000101', :'gc_chat', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation: GC chat secret'),
  ('ca000000-0000-0000-0000-000000000102', :'ga_chat', 'ca000000-0000-0000-0000-0000000000a2', 'Isolation: GA chat secret');
insert into public.messages (id, conversation_id, sender_id, body, kind, media_path) values
  ('ca000000-0000-0000-0000-000000000103', :'gc_chat', 'ca000000-0000-0000-0000-0000000000a2', 'Photo', 'photo', 'ca000000-0000-0000-0000-0000000000a2/iso-chat.jpg');
insert into public.message_reactions (message_id, user_id, emoji) values
  ('ca000000-0000-0000-0000-000000000101', 'ca000000-0000-0000-0000-0000000000a1', '❤️');
insert into public.message_removals (message_id, conversation_id) values ('ca000000-0000-0000-0000-000000000102', :'ga_chat');
-- IRLY Girl Match: Ines and Lea matched; Ines liked Jade. Jade, Ines and Sara have visible Match profiles.
insert into public.irly_matches (id, user_a, user_b, score, reasons) values
  ('ca000000-0000-0000-0000-000000000201', 'ca000000-0000-0000-0000-0000000000a1', 'ca000000-0000-0000-0000-0000000000a6', 80, '{}');
insert into public.irly_match_actions (actor_id, target_id, action) values
  ('ca000000-0000-0000-0000-0000000000a1', 'ca000000-0000-0000-0000-0000000000a2', 'like'),
  ('ca000000-0000-0000-0000-0000000000a6', 'ca000000-0000-0000-0000-0000000000a1', 'like');
insert into public.irly_match_onboarding (user_id) values
  ('ca000000-0000-0000-0000-0000000000a1'), ('ca000000-0000-0000-0000-0000000000a2'), ('ca000000-0000-0000-0000-0000000000a5');
insert into public.irly_match_profiles (user_id, visible, goals, photo_paths, destination) values
  ('ca000000-0000-0000-0000-0000000000a1', true, '{new_friends}', array['ca000000-0000-0000-0000-0000000000a1/m1.jpg'], 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a2', true, '{new_friends}', array['ca000000-0000-0000-0000-0000000000a2/m1.jpg'], 'dubai'),
  ('ca000000-0000-0000-0000-0000000000a5', true, '{new_friends}', array['ca000000-0000-0000-0000-0000000000a5/m1.jpg'], 'dubai');
-- Sara's IRLY Girl access is withdrawn (left inside on purpose); Dina's account is closed (left inside too).
insert into public.girl_suspensions (user_id, reason) values ('ca000000-0000-0000-0000-0000000000a5', 'isolation test');
update public.profiles set deleted_at = now() where id = 'ca000000-0000-0000-0000-0000000000aa';

-- Ines posts one Live in each space; Lea posts one in IRLY Girl.
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select public.post_live('{"id":"ca000000-0000-0000-0000-0000000000f1","city_id":"dubai","area_id":"marina","body":"Isolation girl live","visibility":"everyone","scope":"girl","media_path":"ca000000-0000-0000-0000-0000000000a1/iso-live.jpg"}'::jsonb);
select public.post_live('{"id":"ca000000-0000-0000-0000-0000000000f2","city_id":"dubai","area_id":"marina","body":"Isolation irly live","visibility":"everyone"}'::jsonb);
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a6');
select public.post_live('{"id":"ca000000-0000-0000-0000-0000000000f3","city_id":"dubai","area_id":"marina","body":"Isolation Lea girl live","visibility":"everyone","scope":"girl"}'::jsonb);

-- Notifications made by the app's own roads: an announcement in GC, a comment, a plan moved.
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a2');
select public.announce('ca000000-0000-0000-0000-0000000000c1', 'Isolation: brunch moved to the terrace');
update public.activities set place_name = 'Isolation court 2' where id = 'ca000000-0000-0000-0000-0000000000b1';
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
insert into public.comments (author_id, target_type, target_id, body) values
  ('ca000000-0000-0000-0000-0000000000a1', 'activity', 'ca000000-0000-0000-0000-0000000000b1', 'Isolation: rackets on me');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a6' and kind = 'COMMUNITY_ANNOUNCEMENT'
  and payload ->> 'community_id' = 'ca000000-0000-0000-0000-0000000000c1'), 'setup: Lea (still with access) got the announcement');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a6' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1'), 'setup: Lea got the plan''s change');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a5'
  and kind in ('COMMUNITY_ANNOUNCEMENT', 'ACTIVITY_UPDATED')),
  'notifications: suspended Sara, still listed, gets neither the announcement nor the plan''s change');
-- Written by the server for people without access (they must be dropped, not stored).
insert into public.notifications (user_id, kind, payload) values
  ('ca000000-0000-0000-0000-0000000000a3', 'LIKE', '{"from":"ca000000-0000-0000-0000-0000000000a2","target_type":"comment","target_id":"ca000000-0000-0000-0000-0000000000e1"}'),
  ('ca000000-0000-0000-0000-0000000000a3', 'GROUP_ADDED', jsonb_build_object('from', 'ca000000-0000-0000-0000-0000000000a2', 'conversation_id', :'gc_chat', 'title', 'Isolation Girls Circle')),
  ('ca000000-0000-0000-0000-0000000000a3', 'ACTIVITY_REMINDER', '{"activity_id":"ca000000-0000-0000-0000-0000000000b1","title":"Isolation girls padel"}'),
  ('ca000000-0000-0000-0000-0000000000a4', 'COMMUNITY_JOINED', '{"community_id":"ca000000-0000-0000-0000-0000000000c1"}'),
  ('ca000000-0000-0000-0000-0000000000a5', 'MATCH_CREATED', '{"match_id":"ca000000-0000-0000-0000-000000000201"}'),
  ('ca000000-0000-0000-0000-0000000000a3', 'IRLY_POST_CREATED', '{"post_id":"ca000000-0000-0000-0000-0000000000f1","from":"ca000000-0000-0000-0000-0000000000a1","body":"Isolation girl live"}');
select pg_temp.check(not exists (select 1 from public.notifications where user_id in ('ca000000-0000-0000-0000-0000000000a3', 'ca000000-0000-0000-0000-0000000000a4', 'ca000000-0000-0000-0000-0000000000a5')
  and kind in ('LIKE', 'GROUP_ADDED', 'ACTIVITY_REMINDER', 'COMMUNITY_JOINED', 'MATCH_CREATED', 'IRLY_POST_CREATED')),
  'notifications about IRLY Girl content are never stored for a man, an undeclared or a suspended member');
insert into public.notifications (user_id, kind, payload) values
  ('ca000000-0000-0000-0000-0000000000a3', 'ACTIVITY_REMINDER', '{"activity_id":"ca000000-0000-0000-0000-0000000000b2","title":"Isolation open run"}');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a3' and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b2'),
  'notifications: (control) a reminder for an open plan reaches the man');

select pg_temp.check((select girl_only from public.communities where id = 'ca000000-0000-0000-0000-0000000000c2'), 'setup: a subgroup of a women-only community is women only');
select pg_temp.check(private.girl_target('comment', 'ca000000-0000-0000-0000-0000000000e1'), 'a comment on IRLY Girl content is IRLY Girl content');
select pg_temp.check(not private.girl_target('comment', gen_random_uuid()::text), '… an unknown comment is not');
select pg_temp.check(private.notification_is_girl('IRLY_POST_CREATED', '{"post_id":"ca000000-0000-0000-0000-0000000000f1"}')
  and not private.notification_is_girl('IRLY_POST_CREATED', '{"post_id":"ca000000-0000-0000-0000-0000000000f2"}'),
  'notification_is_girl: an IRLY Girl Live is, an IRLY Live is not');

-- ───────── 1. Everyone without access: man, undeclared, suspended, closed account, no profile ─────────
-- One block of checks, run for each of them (the same reads and writes, by id, as the API role).
create or replace function pg_temp.outsider(uid uuid, who text) returns void language plpgsql as $f$
declare
  gc text := current_setting('iso.gc_chat');
  ga text := current_setting('iso.ga_chat');
begin
  perform pg_temp.as_user(uid);
  -- Direct table reads by id (the same rules Realtime applies to each change).
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000b3', 'ca000000-0000-0000-0000-0000000000b4') and creator_id <> auth.uid()$q$) = 0, who || ': girl-only plans (not their own), read by id');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'ca000000-0000-0000-0000-0000000000b2'$q$) = 1, who || ': (control) the open plan is readable');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.activity_participants where activity_id = 'ca000000-0000-0000-0000-0000000000b1'$q$) = 0, who || ': participants of a girl-only plan');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.communities where id in ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c2')$q$) = 0, who || ': the girl-only community and its subgroup');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_members where community_id = 'ca000000-0000-0000-0000-0000000000c1'$q$) = 0, who || ': members of the girl-only community');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'ca000000-0000-0000-0000-0000000000d1'$q$) = 0, who || ': the girl-only post');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.comments where id in ('ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000e2', 'ca000000-0000-0000-0000-0000000000e3')$q$) = 0, who || ': comments and replies on it');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.likes where target_id in ('ca000000-0000-0000-0000-0000000000d1', 'ca000000-0000-0000-0000-0000000000e1') and user_id <> auth.uid()$q$) = 0, who || ': likes on it and on its comments');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_poll_votes where post_id = 'ca000000-0000-0000-0000-0000000000d1'$q$) = 0, who || ': its poll votes');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.irl_posts where id in ('ca000000-0000-0000-0000-0000000000f1', 'ca000000-0000-0000-0000-0000000000f3') and author_id <> auth.uid()$q$) = 0, who || ': IRLY Girl Lives (not their own)');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversations where id in (%L, %L)$q$, gc, ga)) = 0, who || ': girl chats');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversation_members where conversation_id in (%L, %L)$q$, gc, ga)) = 0, who || ': girl chat members');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id in (%L, %L)$q$, gc, ga)) = 0, who || ': girl chat messages');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.message_reactions where message_id = 'ca000000-0000-0000-0000-000000000101'$q$) = 0, who || ': reactions in a girl chat');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.message_removals where conversation_id in (%L, %L)$q$, gc, ga)) = 0, who || ': removals in a girl chat');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.irly_matches where id = 'ca000000-0000-0000-0000-000000000201'$q$) = 0, who || ': IRLY Girl matches');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.irly_match_profiles where user_id::text like 'ca000000-%'$q$) = 0, who || ': Match profiles');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where payload::text like '%ca000000-0000-0000-0000-0000000000b1%' or payload::text like '%ca000000-0000-0000-0000-0000000000c1%'$q$) = 0, who || ': notifications about IRLY Girl content');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.notifications where payload ->> 'conversation_id' in (%L, %L)$q$, gc, ga)) = 0, who || ': notifications of girl chat messages');
  -- RPCs, including a forged space.
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', who || ': girl_feed refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.irl_feed_girl('dubai')$q$) = '42501', who || ': irl_feed_girl refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.search_all_girl('Isolation')$q$) = '42501', who || ': search_all_girl refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.recommend_activities_girl('dubai')$q$) = '42501', who || ': recommend_activities_girl refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_official_communities()$q$) = '42501', who || ': girl_official_communities refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_circle('dubai')$q$) is not null, who || ': girl_circle refused');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.member_lives('ca000000-0000-0000-0000-0000000000a1', 'irly_girl')$q$) <= 0, who || ': member_lives with p_scope irly_girl returns nothing');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.member_lives('ca000000-0000-0000-0000-0000000000a1', 'girl')$q$) <= 0, who || ': … nor with p_scope girl');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.irl_feed('dubai') where id in ('ca000000-0000-0000-0000-0000000000f1', 'ca000000-0000-0000-0000-0000000000f3')$q$) <= 0, who || ': IRLY Live shows no IRLY Girl Live');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.search_all('Isolation', 'dubai', 50) where id in ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000b4', 'ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c2')$q$) <= 0, who || ': search_all finds no girl-only plan or community');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.engagement('community_post', array['ca000000-0000-0000-0000-0000000000d1'])$q$) <= 0, who || ': engagement (counts) of the girl-only post');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.engagement('irl_post', array['ca000000-0000-0000-0000-0000000000f1'])$q$) <= 0, who || ': engagement of the IRLY Girl Live');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.comment_thread('community_post', 'ca000000-0000-0000-0000-0000000000d1')$q$) <= 0, who || ': comment_thread of the girl-only post');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.activity_detail('ca000000-0000-0000-0000-0000000000b1')$q$) <= 0, who || ': activity_detail of the girl-only plan');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_detail('ca000000-0000-0000-0000-0000000000c1')$q$) <= 0, who || ': community_detail of the girl-only community');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_feed('ca000000-0000-0000-0000-0000000000c1')$q$) <= 0, who || ': community_feed of the girl-only community');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.chat_members(%L)$q$, gc)) <= 0, who || ': chat_members of the girl chat');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.my_conversations() where conversation_id in (%L, %L)$q$, gc, ga)) <= 0, who || ': girl chats are not in the inbox');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.member_communities('ca000000-0000-0000-0000-0000000000a2') where id in ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c2')$q$) <= 0, who || ': member_communities hides the girl-only community');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_rights('ca000000-0000-0000-0000-0000000000c1')$q$) <= 0, who || ': community_rights says nothing of the girl-only community');
  perform pg_temp.check(pg_temp.fails($q$select * from public.community_people('ca000000-0000-0000-0000-0000000000c1')$q$) is not null, who || ': community_people refused');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.member_badges('ca000000-0000-0000-0000-0000000000a2') where badge = 'organizer'$q$) <= 0, who || ': member_badges does not count a girl-only plan');
  perform pg_temp.check(pg_temp.fails($q$select public.report('community_post', null, 'ca000000-0000-0000-0000-0000000000d1', 'spam')$q$) is not null, who || ': cannot report (so probe) the girl-only post');
  -- Writes.
  perform pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values (auth.uid(), 'community_post', 'ca000000-0000-0000-0000-0000000000d1', 'hi')$q$) is not null, who || ': cannot comment');
  perform pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body, parent_id) values (auth.uid(), 'community_post', 'ca000000-0000-0000-0000-0000000000d1', 'hi', 'ca000000-0000-0000-0000-0000000000e1')$q$) is not null, who || ': cannot reply');
  perform pg_temp.check(pg_temp.fails($q$select public.toggle_like('comment', 'ca000000-0000-0000-0000-0000000000e1')$q$) is not null, who || ': cannot like a comment of it');
  perform pg_temp.check(pg_temp.fails($q$select public.toggle_like('irl_post', 'ca000000-0000-0000-0000-0000000000f1')$q$) is not null, who || ': cannot like an IRLY Girl Live');
  perform pg_temp.check(pg_temp.fails($q$select public.toggle_save('community_post', 'ca000000-0000-0000-0000-0000000000d1')$q$) is not null, who || ': cannot save the girl-only post');
  perform pg_temp.check(pg_temp.fails($q$select public.toggle_save('activity', 'ca000000-0000-0000-0000-0000000000b1')$q$) is not null, who || ': cannot save the girl-only plan');
  perform pg_temp.check(pg_temp.fails($q$insert into public.community_poll_votes (post_id, user_id, option) values ('ca000000-0000-0000-0000-0000000000d1', auth.uid(), 0)$q$) is not null, who || ': cannot vote in its poll');
  perform pg_temp.check(pg_temp.touched($q$update public.community_posts set body = 'hacked' where id = 'ca000000-0000-0000-0000-0000000000d1'$q$) <= 0, who || ': cannot edit the post');
  perform pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'hi')$q$, gc)) is not null, who || ': cannot write in the girl chat');
  perform pg_temp.check(pg_temp.fails(format($q$insert into public.conversation_members (conversation_id, user_id) values (%L, auth.uid())$q$, ga)) is not null, who || ': cannot add themself to the plan''s chat');
  perform pg_temp.check(pg_temp.fails($q$select public.hide_message_for_me('ca000000-0000-0000-0000-000000000101')$q$) is not null, who || ': hide_message_for_me says nothing of a girl chat message');
  perform pg_temp.check(pg_temp.fails($q$select public.join_activity('ca000000-0000-0000-0000-0000000000b1', 'going')$q$) is not null, who || ': cannot join the girl-only plan');
  perform pg_temp.check(pg_temp.fails($q$select public.join_community('ca000000-0000-0000-0000-0000000000c2')$q$) is not null, who || ': cannot join the subgroup');
  perform pg_temp.check(pg_temp.fails($q$select public.post_live(jsonb_build_object('id', gen_random_uuid(), 'city_id', 'dubai', 'area_id', 'marina', 'body', 'x', 'scope', 'irly_girl'))$q$) is not null, who || ': cannot post a Live in IRLY Girl (forged scope)');
  perform pg_temp.check(pg_temp.fails($q$select public.edit_live_post('ca000000-0000-0000-0000-0000000000f1', 'hacked')$q$) is not null, who || ': cannot edit an IRLY Girl Live');
  perform pg_temp.check(pg_temp.fails($q$select public.set_community_cover('ca000000-0000-0000-0000-0000000000c1', null)$q$) is not null, who || ': cannot change the community''s cover');
  perform pg_temp.check(pg_temp.fails($q$select public.set_community_role('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a1', 'moderator')$q$) is not null, who || ': cannot change roles in it');
  perform pg_temp.check(pg_temp.fails(format($q$select public.set_conversation_photo(%L, null)$q$, gc)) is not null, who || ': cannot change the girl chat''s photo');
  perform pg_temp.check(pg_temp.fails($q$select public.announce('ca000000-0000-0000-0000-0000000000c1', 'Isolation: fake announcement')$q$) is not null, who || ': cannot announce in it');
end $f$;
select set_config('iso.gc_chat', :'gc_chat', false), set_config('iso.ga_chat', :'ga_chat', false);

select pg_temp.outsider('ca000000-0000-0000-0000-0000000000a3', 'man');
select pg_temp.outsider('ca000000-0000-0000-0000-0000000000a4', 'undeclared');
select pg_temp.outsider('ca000000-0000-0000-0000-0000000000a5', 'suspended');
select pg_temp.outsider('ca000000-0000-0000-0000-0000000000aa', 'closed account');
select pg_temp.outsider('ca000000-0000-0000-0000-0000000000a7', 'no profile');

-- The man, specifically: the eligibility data is not his to read or set.
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a3');
select pg_temp.check(not public.my_girl_access() and public.my_girl_status() = 'not_eligible', 'man: no IRLY Girl access');
select pg_temp.check(pg_temp.fails($q$select gender from public.profiles where id = 'ca000000-0000-0000-0000-0000000000a1'$q$) = '42501', 'man: cannot read a member''s gender');
select pg_temp.check(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles_public' and column_name = 'gender'), 'profiles_public has no gender');
select pg_temp.check(pg_get_function_result('public.public_profile(uuid)'::regprocedure) not like '%gender%'
  and pg_get_function_result('public.search_all(text, text, integer)'::regprocedure) not like '%gender%'
  and pg_get_function_result('public.chat_members(uuid)'::regprocedure) not like '%gender%',
  'public_profile, search_all and chat_members return no gender');
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'woman' where id = 'ca000000-0000-0000-0000-0000000000a3'$q$) = '42501', 'man: cannot declare himself a woman');
select pg_temp.check(pg_temp.fails($q$update public.profiles set deleted_at = null, verified_at = now() where id = 'ca000000-0000-0000-0000-0000000000a3'$q$) is not null, 'man: cannot verify himself');
select pg_temp.check(pg_temp.touched($q$delete from public.girl_suspensions where user_id = 'ca000000-0000-0000-0000-0000000000a5'$q$) <= 0, 'man: cannot lift a suspension');
select pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values ('ca000000-0000-0000-0000-0000000000a3', 'admin')$q$) is not null, 'man: cannot make himself staff');
select pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where user_id = auth.uid() and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b2'$q$) = 1, 'man: (control) his notification about an open plan is readable');
-- The suspended woman keeps out of the Circle and Match that other women see (the predicate, not the gender column).
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.girl_circle('dubai') where user_id = 'ca000000-0000-0000-0000-0000000000a2'), 'Ines: the Circle lists Jade');
select pg_temp.check(not exists (select 1 from public.girl_circle('dubai') where user_id = 'ca000000-0000-0000-0000-0000000000a5'), 'Ines: the Circle no longer lists suspended Sara');

-- An anonymous session cannot create a profile (and so declare a gender).
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a9');
select set_config('request.jwt.claims', '{"sub":"ca000000-0000-0000-0000-0000000000a9","role":"authenticated","is_anonymous":true}', false);
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('ca000000-0000-0000-0000-0000000000a9', 'Anon', '1995-01-01', 'woman', 'dubai')$q$) = '42501', 'anonymous: cannot create a profile as a woman');
select pg_temp.check(not public.my_girl_access(), 'anonymous: no IRLY Girl access');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where id = 'ca000000-0000-0000-0000-0000000000c1'$q$) = 0, 'anonymous: the girl-only community is invisible');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', 'anonymous: girl_feed refused');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where id = 'ca000000-0000-0000-0000-0000000000a9'), 'anonymous: no profile was written');

-- Counts: the city's challenge counts girl-only plans for women only.
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a3');
select done as man_done from public.city_challenges('dubai') where challenge = 'activities' \gset
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select done as woman_done from public.city_challenges('dubai') where challenge = 'activities' \gset
select pg_temp.as_admin();
select count(*) as girl_done from public.activities a
where a.city_id = 'dubai' and a.girl_only and a.cancelled_at is null and a.starts_at < now()
  and a.starts_at >= date_trunc('month', now() at time zone private.city_tz('dubai')) at time zone private.city_tz('dubai')
  and exists (select 1 from public.activity_participants x where x.activity_id = a.id and x.user_id <> a.creator_id and x.status = 'going') \gset
select pg_temp.check(:girl_done >= 1 and :woman_done - :man_done = :girl_done, 'city_challenges: the man''s count leaves out exactly the girl-only plans');

-- ───────── 2. Women with access use everything normally ─────────
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_access(), 'Ines: IRLY Girl access');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('ca000000-0000-0000-0000-0000000000b1', 'ca000000-0000-0000-0000-0000000000b3')$q$) = 2, 'Ines: reads the girl-only plans');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activity_participants where activity_id = 'ca000000-0000-0000-0000-0000000000b1'$q$) >= 3, 'Ines: reads the plan''s participants');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where id in ('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000c2')$q$) = 2, 'Ines: reads the community and its subgroup');
select pg_temp.check(pg_temp.rows($q$select 1 from public.comments where id in ('ca000000-0000-0000-0000-0000000000e1', 'ca000000-0000-0000-0000-0000000000e2')$q$) = 2, 'Ines: reads the comment and the reply');
select pg_temp.check(pg_temp.rows($q$select 1 from public.comment_thread('community_post', 'ca000000-0000-0000-0000-0000000000d1')$q$) = 3, 'Ines: comment_thread');
select pg_temp.check((select likes >= 1 from public.engagement('community_post', array['ca000000-0000-0000-0000-0000000000d1'])), 'Ines: engagement counts');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) >= 3, 'Ines: reads her girl chats');
select pg_temp.check(pg_temp.rows($q$select 1 from public.message_reactions where message_id = 'ca000000-0000-0000-0000-000000000101'$q$) = 1, 'Ines: reads reactions');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.message_removals where conversation_id = %L$q$, :'ga_chat')) = 1, 'Ines: reads removals in her girl chat');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.chat_members(%L)$q$, :'gc_chat')) >= 4, 'Ines: chat_members of the girl chat');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.my_conversations() where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 2, 'Ines: both girl chats in her inbox');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_matches where id = 'ca000000-0000-0000-0000-000000000201'$q$) = 1, 'Ines: reads her match');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_match_actions where actor_id = auth.uid()$q$) = 1, 'Ines: reads her Match decisions');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irl_posts where id in ('ca000000-0000-0000-0000-0000000000f1', 'ca000000-0000-0000-0000-0000000000f3')$q$) = 2, 'Ines: reads the IRLY Girl Lives');
select pg_temp.check(exists (select 1 from public.irl_feed_girl('dubai') where id = 'ca000000-0000-0000-0000-0000000000f3'), 'Ines: irl_feed_girl shows Lea''s Live');
select pg_temp.check(exists (select 1 from public.search_all_girl('Isolation') where id = 'ca000000-0000-0000-0000-0000000000c1'), 'Ines: search_all_girl finds the community');
select pg_temp.check(exists (select 1 from public.member_communities('ca000000-0000-0000-0000-0000000000a2') where id = 'ca000000-0000-0000-0000-0000000000c1'), 'Ines: member_communities lists it');
select pg_temp.check(exists (select 1 from public.member_badges('ca000000-0000-0000-0000-0000000000a2') where badge = 'organizer'), 'Ines: Jade''s organiser badge counts the girl-only plan');
select pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where user_id = auth.uid() and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1'$q$) >= 1, 'Ines: reads her notifications about the plan');
select pg_temp.check(pg_temp.fails($q$insert into public.community_poll_votes (post_id, user_id, option) values ('ca000000-0000-0000-0000-0000000000d1', auth.uid(), 0)$q$) is null, 'Ines: votes in the poll');
select pg_temp.check(pg_temp.fails($q$select public.toggle_save('community_post', 'ca000000-0000-0000-0000-0000000000d1')$q$) is null, 'Ines: saves the post');
select pg_temp.check(pg_temp.fails($q$select public.toggle_like('comment', 'ca000000-0000-0000-0000-0000000000e2')$q$) is null, 'Ines: likes the reply');
select pg_temp.check(pg_temp.touched($q$update public.comments set body = 'Isolation: count me in!' where id = 'ca000000-0000-0000-0000-0000000000e1'$q$) = 1, 'Ines: edits her comment');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Isolation: on my way')$q$, :'gc_chat')) is null, 'Ines: writes in the girl chat');
select pg_temp.check(pg_temp.fails($q$select public.hide_message_for_me('ca000000-0000-0000-0000-000000000101')$q$) is null, 'Ines: hides a message for herself');
select pg_temp.check(pg_temp.fails($q$select public.edit_live_post('ca000000-0000-0000-0000-0000000000f1', 'Isolation girl live, edited')$q$) is null, 'Ines: edits her IRLY Girl Live');
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a2');
select pg_temp.check((select is_owner and can_moderate from public.community_rights('ca000000-0000-0000-0000-0000000000c1')), 'Jade: community_rights of her community');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_people('ca000000-0000-0000-0000-0000000000c1')$q$) >= 4, 'Jade: community_people');
select pg_temp.check(pg_temp.fails($q$select public.set_community_role('ca000000-0000-0000-0000-0000000000c1', 'ca000000-0000-0000-0000-0000000000a1', 'member')$q$) is null, 'Jade: sets a role');
select pg_temp.check(pg_temp.fails($q$select public.set_community_cover('ca000000-0000-0000-0000-0000000000c1', null)$q$) is null, 'Jade: resets the cover');
select pg_temp.check(pg_temp.fails(format($q$select public.set_conversation_photo(%L, null)$q$, :'gc_chat')) is null, 'Jade: resets the chat photo');
select pg_temp.check(pg_temp.touched($q$update public.community_posts set body = 'Isolation: rooftop brunch Friday, 11am?' where id = 'ca000000-0000-0000-0000-0000000000d1'$q$) = 1, 'Jade: edits her post');

-- ───────── 3. Revocation: Lea's gender is corrected by staff mid-session ─────────
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a6');
select pg_temp.check(public.my_girl_access(), 'Lea, before: IRLY Girl access');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'ca000000-0000-0000-0000-0000000000b1'$q$) = 1, 'Lea, before: reads the plan she joined');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, :'gc_chat')) >= 2, 'Lea, before: reads the community chat');
select pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where user_id = auth.uid() and (payload ->> 'community_id' = 'ca000000-0000-0000-0000-0000000000c1' or payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1')$q$) >= 2, 'Lea, before: reads her notifications about them');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_matches where id = 'ca000000-0000-0000-0000-000000000201'$q$) = 1, 'Lea, before: reads her match');
-- Staff (an IRLY admin) corrects the gender; the profile guard lets only staff do it.
select pg_temp.as_admin();
select set_config('request.jwt.claim.sub', 'ca000000-0000-0000-0000-0000000000a8', false);
update public.profiles set gender = 'man' where id = 'ca000000-0000-0000-0000-0000000000a6';
select pg_temp.as_admin();
select pg_temp.check((select gender = 'man' from public.profiles where id = 'ca000000-0000-0000-0000-0000000000a6'), 'revocation: Lea''s gender is corrected');
select pg_temp.check(exists (select 1 from public.community_members where community_id = 'ca000000-0000-0000-0000-0000000000c1' and user_id = 'ca000000-0000-0000-0000-0000000000a6' and role = 'moderator')
  and exists (select 1 from public.activity_participants where activity_id = 'ca000000-0000-0000-0000-0000000000b1' and user_id = 'ca000000-0000-0000-0000-0000000000a6'),
  'revocation: she is still listed as moderator and participant (the worst case)');
select pg_temp.outsider('ca000000-0000-0000-0000-0000000000a6', 'revoked');
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a6');
select pg_temp.check(not public.my_girl_access(), 'revoked: no IRLY Girl access');
select pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where user_id = auth.uid() and (payload ->> 'community_id' = 'ca000000-0000-0000-0000-0000000000c1' or payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1')$q$) = 0, 'revoked: her old notifications about IRLY Girl content are hidden');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_match_actions where actor_id = auth.uid()$q$) = 0, 'revoked: her Match decisions are hidden');
select pg_temp.check(pg_temp.touched($q$update public.comments set body = 'hacked'$q$) <= 0, 'revoked: an UPDATE without WHERE does not rewrite her comment on IRLY Girl content');
select pg_temp.check(pg_temp.touched(format($q$update public.conversation_members set archived_at = now() where conversation_id = %L$q$, :'gc_chat')) <= 0, 'revoked: cannot change her membership of the girl chat');
select pg_temp.check(pg_temp.fails($q$select public.edit_live_post('ca000000-0000-0000-0000-0000000000f3', 'hacked')$q$) = '42501', 'revoked: cannot edit her own IRLY Girl Live');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irl_posts where id = 'ca000000-0000-0000-0000-0000000000f3'$q$) = 1, 'revoked: still sees her own Live (she may delete it)');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'ca000000-0000-0000-0000-0000000000b3'$q$) = 1, 'revoked: still sees the girl-only plan she hosts');
select pg_temp.check(pg_temp.touched($q$update public.activities set cancelled_at = now() where id = 'ca000000-0000-0000-0000-0000000000b3'$q$) = 1, '… and can only call it off');
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a2');
update public.activities set place_name = 'Isolation court 3' where id = 'ca000000-0000-0000-0000-0000000000b1';
select pg_temp.as_admin();
select pg_temp.check((select comment_ok and post_ok from (select
    (select body from public.comments where id = 'ca000000-0000-0000-0000-0000000000e3') = 'Isolation: Lea was here' as comment_ok,
    (select body from public.community_posts where id = 'ca000000-0000-0000-0000-0000000000d1') = 'Isolation: rooftop brunch Friday, 11am?' as post_ok) x),
  'revocation: none of her tries changed IRLY Girl content');
select pg_temp.check((select count(*) from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a6' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1') = 1, 'revocation: the plan''s next change is not sent to her (the earlier notice is kept, hidden)');
select pg_temp.check((select role = 'member' from public.community_members where community_id = 'ca000000-0000-0000-0000-0000000000c1' and user_id = 'ca000000-0000-0000-0000-0000000000a1'),
  'revocation: her role change was refused');
select pg_temp.check((select count(*) from public.notifications where user_id = 'ca000000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'ca000000-0000-0000-0000-0000000000b1') = 2, '… while Ines, with access, is told of both changes');
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_matches where id = 'ca000000-0000-0000-0000-000000000201'$q$) = 1, 'Ines: still reads her own match row');

-- ───────── 4. Realtime: every published table that can carry IRLY Girl rows has its read rule on ─────────
select pg_temp.as_admin();
select pg_temp.check(not exists (
  select 1 from unnest(array['messages', 'irly_matches', 'notifications', 'activity_participants', 'conversation_members', 'irl_posts',
    'likes', 'comments', 'community_posts', 'activities', 'community_poll_votes', 'communities', 'community_members', 'conversations',
    'saves', 'community_activity_pins', 'community_channels', 'community_pins', 'message_removals', 'message_reactions', 'irly_match_actions']) t
  join pg_class c on c.relname = t and c.relnamespace = 'public'::regnamespace
  where not c.relrowsecurity
     or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd in ('SELECT', 'ALL'))),
  'realtime: RLS is on, with a read rule, for each table Realtime may publish');

-- ───────── 5. Storage (irl-media, post-media, chat-media, activity-photos, match-photos), on a stand-in ─────────
-- Plain PostgreSQL has no storage schema, so the migrations skipped their
-- storage policies. A stand-in storage.objects gets the same policies (text
-- copied from 20261017000100 irl_media_read, 20261018000000 post_media_read,
-- 20261009003000 chat_media_read, 20261009005200 activity_photos_read,
-- 20261020001000 match_photos_read) inside a transaction that is rolled back.
-- A signed URL is only issued for an object its reader may select.
begin;
create schema storage;
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)]
$$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create policy irl_media_read on storage.objects for select to authenticated
  using (bucket_id = 'irl-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.irl_posts p where p.media_path = name or p.thumb_path = name)
  ));
create policy post_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.community_posts p where p.deleted_at is null and (name = any (p.media_paths) or p.thumb_path = name))
  ));
create policy chat_media_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = name and m.deleted_at is null and private.is_member(m.conversation_id))
  ));
create policy activity_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'activity-photos' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or exists (select 1 from public.activities a where a.cover_path = objects.name)
    or exists (select 1 from public.communities c where c.cover_path = objects.name)
    or exists (select 1 from public.conversations v where v.photo_path = objects.name)
  ));
create policy match_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'match-photos' and private.can_read_match_photo(name));
insert into storage.objects (bucket_id, name) values
  ('irl-media', 'ca000000-0000-0000-0000-0000000000a1/iso-live.jpg'),
  ('post-media', 'ca000000-0000-0000-0000-0000000000a2/iso-post.jpg'),
  ('chat-media', 'ca000000-0000-0000-0000-0000000000a2/iso-chat.jpg'),
  ('activity-photos', 'ca000000-0000-0000-0000-0000000000a2/iso-plan.jpg'),
  ('match-photos', 'ca000000-0000-0000-0000-0000000000a2/m1.jpg');
alter table public.activities disable trigger user;
update public.activities set cover_path = 'ca000000-0000-0000-0000-0000000000a2/iso-plan.jpg' where id = 'ca000000-0000-0000-0000-0000000000b1';
alter table public.activities enable trigger user;
create or replace function pg_temp.storage_out(uid uuid, who text) returns void language plpgsql as $f$
begin
  perform pg_temp.as_user(uid);
  perform pg_temp.check((select count(*) from storage.objects where name like 'ca000000-0000-0000-0000-0000000000a1/%' or name like 'ca000000-0000-0000-0000-0000000000a2/%') = 0,
    who || ': storage lists no IRLY Girl file (Live, post photo, chat photo, plan cover, Match photo)');
end $f$;
select pg_temp.storage_out('ca000000-0000-0000-0000-0000000000a3', 'storage, man');
select pg_temp.storage_out('ca000000-0000-0000-0000-0000000000a4', 'storage, undeclared');
select pg_temp.storage_out('ca000000-0000-0000-0000-0000000000a5', 'storage, suspended');
select pg_temp.storage_out('ca000000-0000-0000-0000-0000000000a6', 'storage, revoked');
select pg_temp.as_user('ca000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from storage.objects where name like 'ca000000-0000-0000-0000-0000000000a%') = 5, 'storage, Ines: reads all five files');
select pg_temp.as_admin();
rollback;

select pg_temp.as_admin();
\echo 'girl_isolation: ALL CHECKS PASSED'
