-- QA performance fixes (20261103300000_irly_qa_fix_perf.sql). The faster
-- feeds, chats and read rules give exactly the same answers:
--  1. Feeds (community_feed, community_space_feed, girl_feed, for_you_feed,
--     today_activities, help_feed, comment_thread) still hide the name of a
--     member who keeps her profile to herself, and never show a member blocked
--     either way; and they look up each author by id instead of checking every
--     profile of the app for each post (PERF-01).
--  2. A join does not wait for the messages being sent in that chat, and holds
--     the community row for its commit only (PERF-02).
--  3. A message notifies the same members as before (PERF-03) and never moves
--     the chat's last_message_at back in time (PERF-07).
--  4. The read rules of plans, posts and comments keep every block and
--     participation case, without one blocks lookup per row (PERF-04); the map
--     lists the same plans in the same order; likes are counted as before.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed d7e50000-….
--   a1 Viv  woman, IRLY Girl access (the viewer)
--   a2 Pia  woman, profile open to everyone (her name shows)
--   a3 Bea  woman, profile visible to nobody (her name never shows to Viv)
--   a4 Kat  woman, blocked by Viv
--   a5 Uma  woman, has blocked Viv
--   a6 Max  man, joins and writes in the open club
--   a7 Noa  woman, IRLY Girl access, member of the chats
--   a8 Ida  woman whose IRLY Girl access was withdrawn (girl_suspensions)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

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
    raise exception 'FAIL perf_qa_fixes: %', label;
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
-- How many times a function ran for one statement (this transaction's counter).
set track_functions = 'all';
create or replace function pg_temp.calls_of(fn regproc, stmt text) returns bigint language plpgsql as $$
declare
  before bigint := coalesce(pg_stat_get_xact_function_calls(fn), 0);
begin
  execute stmt;
  return coalesce(pg_stat_get_xact_function_calls(fn), 0) - before;
end $$;

-- ───────── Accounts ─────────
select pg_temp.as_admin();
insert into auth.users (id) select ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid from generate_series(1, 8) k;
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('d7e50000-0000-0000-0000-0000000000a1', 'Viv', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a2', 'Pia', '1993-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a3', 'Bea', '1992-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a4', 'Kat', '1991-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a5', 'Uma', '1990-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a6', 'Max', '1990-01-01', 'man', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a7', 'Noa', '1995-01-01', 'woman', 'dubai', 'marina'),
  ('d7e50000-0000-0000-0000-0000000000a8', 'Ida', '1996-01-01', 'woman', 'dubai', 'marina');
-- The women's identity was checked by IRLY (IRLY Girl access); Ida's access was withdrawn.
insert into public.verification_requests (user_id, gesture, status, decided_at)
select ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid, 'peace', 'approved', now() from unnest(array[1, 2, 3, 4, 5, 7, 8]) k;
insert into public.girl_suspensions (user_id, reason, created_by) values
  ('d7e50000-0000-0000-0000-0000000000a8', 'test', 'd7e50000-0000-0000-0000-0000000000a2');
insert into public.safety_settings (user_id, profile_visibility) values ('d7e50000-0000-0000-0000-0000000000a3', 'nobody')
on conflict (user_id) do update set profile_visibility = 'nobody';
insert into public.blocks (blocker_id, blocked_id) values
  ('d7e50000-0000-0000-0000-0000000000a1', 'd7e50000-0000-0000-0000-0000000000a4'),
  ('d7e50000-0000-0000-0000-0000000000a5', 'd7e50000-0000-0000-0000-0000000000a1');
-- Viv follows Pia and Bea (For you lists their posts; following someone shows nothing of a hidden profile).
insert into public.follows (follower_id, followee_id) values
  ('d7e50000-0000-0000-0000-0000000000a1', 'd7e50000-0000-0000-0000-0000000000a2'),
  ('d7e50000-0000-0000-0000-0000000000a1', 'd7e50000-0000-0000-0000-0000000000a3');

-- ───────── Communities, posts, comments, plans ─────────
-- Club: open, Viv is a member with Kat and Uma; Bea posted there and left.
-- Circle: IRLY Girl, Viv is not a member (Pia, Bea, Kat, Uma post there).
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('d7e50000-0000-0000-0001-000000000001', 'dubai', 'D7e5 open club', 'social', false, 'd7e50000-0000-0000-0000-0000000000a2'),
  ('d7e50000-0000-0000-0001-000000000002', 'dubai', 'D7e5 girls circle', 'social', true, 'd7e50000-0000-0000-0000-0000000000a2');
insert into public.community_members (community_id, user_id)
select 'd7e50000-0000-0000-0001-000000000001', ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid from unnest(array[1, 3, 4, 5, 7, 8]) k
on conflict do nothing;
insert into public.community_members (community_id, user_id)
select 'd7e50000-0000-0000-0001-000000000002', ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid from unnest(array[3, 4, 5, 7]) k
on conflict do nothing;
insert into public.community_posts (id, community_id, author_id, body) values
  ('d7e50000-0000-0000-0002-000000000001', 'd7e50000-0000-0000-0001-000000000001', 'd7e50000-0000-0000-0000-0000000000a2', 'd7e5 club Pia'),
  ('d7e50000-0000-0000-0002-000000000002', 'd7e50000-0000-0000-0001-000000000001', 'd7e50000-0000-0000-0000-0000000000a3', 'd7e5 club Bea'),
  ('d7e50000-0000-0000-0002-000000000003', 'd7e50000-0000-0000-0001-000000000001', 'd7e50000-0000-0000-0000-0000000000a4', 'd7e5 club Kat'),
  ('d7e50000-0000-0000-0002-000000000004', 'd7e50000-0000-0000-0001-000000000001', 'd7e50000-0000-0000-0000-0000000000a5', 'd7e5 club Uma'),
  ('d7e50000-0000-0000-0002-000000000011', 'd7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a2', 'd7e5 circle Pia'),
  ('d7e50000-0000-0000-0002-000000000012', 'd7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a3', 'd7e5 circle Bea'),
  ('d7e50000-0000-0000-0002-000000000013', 'd7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a4', 'd7e5 circle Kat'),
  ('d7e50000-0000-0000-0002-000000000014', 'd7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a5', 'd7e5 circle Uma');
-- Bea leaves the club: she shares nothing with Viv any more.
delete from public.community_members where community_id = 'd7e50000-0000-0000-0001-000000000001' and user_id = 'd7e50000-0000-0000-0000-0000000000a3';
-- Help: questions in the Dubai visa group.
select g.id as help_group from public.communities g join public.communities h on h.id = g.parent_id
where h.official and h.topic = 'help' and h.city_id = 'dubai' and h.deleted_at is null and g.subtopic = 'visa' and g.deleted_at is null limit 1 \gset
insert into public.community_posts (id, community_id, author_id, body)
select ('d7e50000-0000-0000-0002-00000000002' || k)::uuid, :'help_group', ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid, 'd7e5help question ' || k
from unnest(array[2, 3, 4, 5]) k;
-- Comments under Pia's circle post.
insert into public.comments (target_type, target_id, author_id, body)
select 'community_post', 'd7e50000-0000-0000-0002-000000000011', ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid, 'd7e5 comment ' || k
from unnest(array[2, 3, 4, 5]) k;
-- Likes on Pia's club post: Pia, Kat (blocked by Viv) and Noa; every like counts.
insert into public.likes (user_id, target_type, target_id)
select ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid, 'community_post', 'd7e50000-0000-0000-0002-000000000001' from unnest(array[2, 4, 7]) k;
-- Plans today.
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, privacy, girl_only, audience)
select ('d7e50000-0000-0000-0003-00000000000' || k)::uuid, ('d7e50000-0000-0000-0000-0000000000a' || k)::uuid, 'activity',
  'D7e5 today ' || k, 'sport', 'dubai', 'marina', now() + interval '1 minute', 'public', false, 'all'
from unnest(array[2, 3, 4, 5]) k;

-- ───────── 1. Feeds: hidden and blocked profiles stay hidden ─────────
-- name_of(rows): the name a feed shows for an author, '-' when the author is
-- listed without a name, null when nothing of hers is listed.
create or replace function pg_temp.names(stmt text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select string_agg(coalesce(n, %L), %L order by n nulls last) from (select distinct n from (%s) x (n)) y', '-', ',', stmt) into r;
  return r;
end $$;

select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
create temp table d7e5_feed (rpc text, author uuid, name text);
insert into d7e5_feed select 'community_feed', author_id, first_name from public.community_feed('d7e50000-0000-0000-0001-000000000001', 100, null);
insert into d7e5_feed select 'community_space_feed', author_id, first_name from public.community_space_feed('d7e50000-0000-0000-0001-000000000001', null, 100, null);
insert into d7e5_feed select 'girl_feed', author_id, first_name from public.girl_feed('dubai', false, 60, null) where body like 'd7e5%';
insert into d7e5_feed select 'for_you_feed', author_id, first_name from public.for_you_feed(50) where body like 'd7e5%';
insert into d7e5_feed select 'today_activities', organizer_id, organizer_name from public.today_activities('dubai', 50) where title like 'D7e5%';
insert into d7e5_feed select 'help_feed', author_id, first_name from public.help_feed('dubai', 'visa', 'd7e5help', null, 100, null);
insert into d7e5_feed select 'comment_thread', author_id, first_name from public.comment_thread('community_post', 'd7e50000-0000-0000-0002-000000000011');

select pg_temp.check((select count(distinct rpc) from d7e5_feed where author = 'd7e50000-0000-0000-0000-0000000000a2' and name = 'Pia') = 7,
  'feeds: an open profile shows its name in all 7 feeds');
select pg_temp.check((select count(distinct rpc) from d7e5_feed where author = 'd7e50000-0000-0000-0000-0000000000a3') = 7
  and not exists (select 1 from d7e5_feed where author = 'd7e50000-0000-0000-0000-0000000000a3' and name is not null),
  'feeds: a profile visible to nobody is listed without its name in all 7 feeds');
select pg_temp.check(not exists (select 1 from d7e5_feed where author in ('d7e50000-0000-0000-0000-0000000000a4', 'd7e50000-0000-0000-0000-0000000000a5')),
  'feeds: members blocked either way are not listed at all');
select pg_temp.check(not exists (select 1 from d7e5_feed where name in ('Bea', 'Kat', 'Uma')),
  'feeds: hidden and blocked names never appear');
-- The same as the open feeds the client reads directly.
select pg_temp.check((select count(*) from public.community_posts where body like 'd7e5 club%') = 2
  and (select count(*) from public.comments where body like 'd7e5 comment%') = 2
  and (select count(*) from public.activities where title like 'D7e5 today%') = 2,
  'read rules: posts, comments and plans of members blocked either way stay hidden');
select pg_temp.check((select likes from public.community_feed('d7e50000-0000-0000-0001-000000000001', 100, null) where id = 'd7e50000-0000-0000-0002-000000000001') = 3,
  'likes: a post counts every like (as read through likes_read)');
select pg_temp.check((select likes from public.community_feed('d7e50000-0000-0000-0001-000000000001', 100, null) where id = 'd7e50000-0000-0000-0002-000000000001')
  = (select count(*) from public.likes where target_type = 'community_post' and target_id = 'd7e50000-0000-0000-0002-000000000001'),
  'likes: the feed count equals what the caller can read');

-- Once unblocked and back in the club, the names come back.
select pg_temp.as_admin();
delete from public.blocks where blocker_id = 'd7e50000-0000-0000-0000-0000000000a1' and blocked_id = 'd7e50000-0000-0000-0000-0000000000a4';
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
select pg_temp.check((select first_name from public.community_feed('d7e50000-0000-0000-0001-000000000001', 100, null) where author_id = 'd7e50000-0000-0000-0000-0000000000a4' limit 1) = 'Kat',
  'feeds: unblocked, Kat and her name show again');
select pg_temp.as_admin();
insert into public.blocks (blocker_id, blocked_id) values ('d7e50000-0000-0000-0000-0000000000a1', 'd7e50000-0000-0000-0000-0000000000a4');

-- PERF-01: each author is looked up by id. Before, every profile of the app went
-- through private.profile_visible for each post (1000 more profiles here).
begin;
insert into auth.users (id) select ('d7e50000-0000-0000-0009-' || lpad(k::text, 12, '0'))::uuid from generate_series(1, 1000) k;
insert into public.profiles (id, first_name, birthdate, gender, city_id)
select ('d7e50000-0000-0000-0009-' || lpad(k::text, 12, '0'))::uuid, 'Extra', '1990-01-01', 'woman', 'dubai' from generate_series(1, 1000) k;
analyze public.profiles;
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.community_feed('d7e50000-0000-0000-0001-000000000001', 100, null)$q$) <= 10,
  'community_feed: one profile check per post, not per profile of the app');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.community_space_feed('d7e50000-0000-0000-0001-000000000001', null, 100, null)$q$) <= 10,
  'community_space_feed: one profile check per post');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.girl_feed('dubai', false, 10, null)$q$) <= 20,
  'girl_feed: one profile check per post');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.for_you_feed(10)$q$) <= 20,
  'for_you_feed: one profile check per post');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.today_activities('dubai', 10)$q$) <= 20,
  'today_activities: one profile check per plan');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.help_feed('dubai', 'visa', 'd7e5help', null, 10, null)$q$) <= 20,
  'help_feed: one profile check per question');
select pg_temp.check(pg_temp.calls_of('private.profile_visible', $q$select * from public.comment_thread('community_post', 'd7e50000-0000-0000-0002-000000000011')$q$) <= 10,
  'comment_thread: one profile check per comment');
-- PERF-04: the read rules ask for the caller's blocks once per query, not once per row.
select pg_temp.check(pg_temp.calls_of('private.is_blocked', $q$select count(*) from public.activities$q$) = 0,
  'activities: no blocks lookup per plan');
select pg_temp.check(pg_temp.calls_of('private.is_blocked', $q$select count(*) from public.community_posts$q$) = 0,
  'community posts: no blocks lookup per post');
select pg_temp.check(pg_temp.calls_of('private.i_participate', $q$select count(*) from public.activities$q$) = 0,
  'activities: no participation lookup per plan');
select pg_temp.as_admin();
rollback;

-- ───────── 2. Joins do not wait for the chat (PERF-02) ─────────
select pg_temp.as_admin();
create schema if not exists d7e5_dblink;
create extension if not exists dblink schema d7e5_dblink;
select extnamespace::regnamespace::text as dbl from pg_extension where extname = 'dblink' \gset
select :dbl.dblink_connect('d7e5_noa', format('dbname=%s user=postgres', current_database()));
select :dbl.dblink_exec('d7e5_noa', 'set role authenticated');
select * from :dbl.dblink('d7e5_noa', $q$select set_config('request.jwt.claim.sub', 'd7e50000-0000-0000-0000-0000000000a7', false)$q$) as t (v text);
select id as club_chat from public.conversations where community_id = 'd7e50000-0000-0000-0001-000000000001' \gset
-- Noa is sending a message in the club chat (her transaction is still open)…
select :dbl.dblink_exec('d7e5_noa', 'begin');
select :dbl.dblink_exec('d7e5_noa', format('insert into public.messages (conversation_id, sender_id, body) values (%L, %L, %L)',
  :'club_chat', 'd7e50000-0000-0000-0000-0000000000a7', 'd7e5 slow sender'));
-- … Max joins the club meanwhile: no waiting for Noa.
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a6');
set lock_timeout = '3s';
select pg_temp.check(pg_temp.fails($q$select public.join_community('d7e50000-0000-0000-0001-000000000001')$q$) is null,
  'join_community does not wait for a message being sent in the chat');
reset lock_timeout;
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.conversation_members where conversation_id = :'club_chat' and user_id = 'd7e50000-0000-0000-0000-0000000000a6'),
  'join_community: Max is in the club chat');
select :dbl.dblink_exec('d7e5_noa', 'commit');

-- A join holds the community row only while it commits: Max's open join does
-- not keep moderation (or another join) waiting.
select :dbl.dblink_connect('d7e5_max', format('dbname=%s user=postgres', current_database()));
select :dbl.dblink_exec('d7e5_max', 'set role authenticated');
select * from :dbl.dblink('d7e5_max', $q$select set_config('request.jwt.claim.sub', 'd7e50000-0000-0000-0000-0000000000a6', false)$q$) as t (v text);
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('d7e50000-0000-0000-0001-000000000003', 'dubai', 'D7e5 second club', 'social', false, 'd7e50000-0000-0000-0000-0000000000a2');
select :dbl.dblink_exec('d7e5_max', 'begin');
select * from :dbl.dblink('d7e5_max', $q$select public.join_community('d7e50000-0000-0000-0001-000000000003')::text$q$) as t (v text);
set lock_timeout = '3s';
select pg_temp.check(pg_temp.fails($q$update public.communities set tagline = 'd7e5 checked' where id = 'd7e50000-0000-0000-0001-000000000003'$q$) is null,
  'an open join does not hold the community row');
reset lock_timeout;
select :dbl.dblink_exec('d7e5_max', 'commit');
select pg_temp.check((select members_count from public.communities where id = 'd7e50000-0000-0000-0001-000000000003') >= 1
  and (select members_count from public.communities where id = 'd7e50000-0000-0000-0001-000000000003') = (select count(*) from public.community_members where community_id = 'd7e50000-0000-0000-0001-000000000003')
  and exists (select 1 from public.community_members where community_id = 'd7e50000-0000-0000-0001-000000000003' and user_id = 'd7e50000-0000-0000-0000-0000000000a6'),
  'members_count: counted at commit (Max included)');
select pg_temp.check((select members_count from public.communities where id = 'd7e50000-0000-0000-0001-000000000001')
  = (select count(*) from public.community_members where community_id = 'd7e50000-0000-0000-0001-000000000001'),
  'members_count: still the real number of members after joins and a leave');
select :dbl.dblink_disconnect('d7e5_noa');
select :dbl.dblink_disconnect('d7e5_max');

-- ───────── 3. Message notifications and last_message_at ─────────
-- In the IRLY Girl circle chat: Noa writes; Pia is muted; Kat blocked… nobody
-- here; Uma blocked Viv (not Noa). Ida (access withdrawn) is a member too.
select pg_temp.as_admin();
insert into public.community_members (community_id, user_id) values
  ('d7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a1'),
  ('d7e50000-0000-0000-0001-000000000002', 'd7e50000-0000-0000-0000-0000000000a8')
on conflict do nothing;
select id as circle_chat from public.conversations where community_id = 'd7e50000-0000-0000-0001-000000000002' \gset
update public.conversation_members set muted = true where conversation_id = :'circle_chat' and user_id = 'd7e50000-0000-0000-0000-0000000000a2';
insert into public.blocks (blocker_id, blocked_id) values ('d7e50000-0000-0000-0000-0000000000a3', 'd7e50000-0000-0000-0000-0000000000a7');
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a7');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('d7e50000-0000-0000-0004-000000000001', :'circle_chat', 'd7e50000-0000-0000-0000-0000000000a7', 'd7e5 hello circle');
select pg_temp.as_admin();
select pg_temp.check((select string_agg(p.first_name, ',' order by p.first_name) from public.notifications n join public.profiles p on p.id = n.user_id
  where n.kind = 'MESSAGE_CREATED' and n.payload ->> 'message_id' = 'd7e50000-0000-0000-0004-000000000001') = 'Kat,Uma,Viv',
  'message: every member but the sender, the muted one, the one in a block with the sender and the one without IRLY Girl access');

-- last_message_at only moves forward: a message stamped earlier (its sender's
-- transaction started first) does not take the chat back in time.
update public.conversations set last_message_at = null where id = :'circle_chat';
insert into public.messages (conversation_id, sender_id, body, created_at) values
  (:'circle_chat', 'd7e50000-0000-0000-0000-0000000000a7', 'd7e5 later', now());
insert into public.messages (conversation_id, sender_id, body, created_at) values
  (:'circle_chat', 'd7e50000-0000-0000-0000-0000000000a7', 'd7e5 stamped earlier', now() - interval '1 minute');
select pg_temp.check((select last_message_at from public.conversations where id = :'circle_chat')
  = (select max(created_at) from public.messages where conversation_id = :'circle_chat'),
  'last_message_at is the newest message, not the last one committed');

-- ───────── 4. Read rules and the map ─────────
-- Invite-only plan of Kat (blocked by Viv) that Viv still takes part in: the
-- participation keeps it readable, as before; a blocked creator's public plan
-- stays hidden; Viv's own plan stays readable once cancelled.
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, privacy, girl_only, audience) values
  ('d7e50000-0000-0000-0003-000000000011', 'd7e50000-0000-0000-0000-0000000000a4', 'activity', 'D7e5 invite Kat', 'sport', 'dubai', 'marina', now() + interval '2 days', 'invite', false, 'all'),
  ('d7e50000-0000-0000-0003-000000000012', 'd7e50000-0000-0000-0000-0000000000a1', 'activity', 'D7e5 mine cancelled', 'sport', 'dubai', 'marina', now() + interval '2 days', 'public', false, 'all');
insert into public.activity_participants (activity_id, user_id, status) values
  ('d7e50000-0000-0000-0003-000000000011', 'd7e50000-0000-0000-0000-0000000000a1', 'maybe');
update public.activities set cancelled_at = now() where id = 'd7e50000-0000-0000-0003-000000000012';
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.activities where id = 'd7e50000-0000-0000-0003-000000000011'),
  'activities: a plan she takes part in stays readable');
select pg_temp.check(exists (select 1 from public.activities where id = 'd7e50000-0000-0000-0003-000000000012'),
  'activities: her own cancelled plan stays readable');
select pg_temp.check(not exists (select 1 from public.activities where id = 'd7e50000-0000-0000-0003-000000000004'),
  'activities: a public plan of someone she blocked stays hidden');
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a6');
select pg_temp.check(not exists (select 1 from public.activities where id = 'd7e50000-0000-0000-0003-000000000011'),
  'activities: an invite-only plan stays hidden from others');

-- The map lists plans by start time, page after page of time windows: a
-- running trip first, then the next hours, days and months, cut at the limit.
select pg_temp.as_admin();
insert into public.places (id, slug, city_id, name, kind, lat, lng) values
  ('d7e50000-0000-0000-0005-000000000001', 'd7e5-map-beach', 'dubai', 'D7e5 Beach', 'beach', 25.15800, 55.19700);
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, ends_at, privacy, girl_only, audience, place_id)
select ('d7e50000-0000-0000-0006-0000000000' || lpad(k::text, 2, '0'))::uuid, 'd7e50000-0000-0000-0000-0000000000a2',
  case when e is null then 'activity' else 'trip' end, 'D7e5map ' || lpad(k::text, 2, '0'), 'sport', 'dubai', 'marina', s, e, 'public', false, 'all',
  'd7e50000-0000-0000-0005-000000000001'
from (values
  (1, now() - interval '3 days', now() + interval '1 day'),   -- running trip
  (2, now() - interval '1 hour', null),                        -- started an hour ago
  (3, now() - interval '3 hours', null),                       -- over
  (4, now() + interval '5 hours', null),
  (5, now() + interval '4 days', null),
  (6, now() + interval '20 days', null),
  (7, now() + interval '90 days', null),
  (8, now() + interval '300 days', null)) v (k, s, e);
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
select pg_temp.check((select string_agg(title, ',' order by n) from (
    select m.title, row_number() over () n from public.map_activities('dubai', null, null, null, null, null, null, null, 500, null) m where m.title like 'D7e5map%') x)
  = 'D7e5map 01,D7e5map 02,D7e5map 04,D7e5map 05,D7e5map 06,D7e5map 07,D7e5map 08',
  'map: every plan not over yet, in start order');
select pg_temp.check((select string_agg(title, ',' order by n) from (
    select m.title, row_number() over () n from public.map_activities('dubai', now() + interval '1 day', now() + interval '100 days', null, null, null, null, null, 500, null) m where m.title like 'D7e5map%') x)
  = 'D7e5map 05,D7e5map 06,D7e5map 07',
  'map: a date window keeps its plans in start order');
select pg_temp.check((select count(*) from public.map_activities('dubai', null, null, null, null, null, null, null, 2, null)) = 2,
  'map: the limit cuts the list');

-- ───────── ACT-05: a leftover 'maybe' row does not skip the privacy check ─────────
-- A plan for the club's members only. Bea left the club but still has a
-- 'maybe' row from when she was in it; Noa is a member; Viv is already going.
select pg_temp.as_admin();
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, privacy, girl_only, audience, community_id) values
  ('d7e50000-0000-0000-0003-000000000021', 'd7e50000-0000-0000-0000-0000000000a2', 'activity', 'D7e5 club only', 'sport', 'dubai', 'marina',
   now() + interval '3 days', 'community', false, 'all', 'd7e50000-0000-0000-0001-000000000001');
insert into public.activity_participants (activity_id, user_id, status) values
  ('d7e50000-0000-0000-0003-000000000021', 'd7e50000-0000-0000-0000-0000000000a3', 'maybe'),
  ('d7e50000-0000-0000-0003-000000000021', 'd7e50000-0000-0000-0000-0000000000a1', 'going');
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('d7e50000-0000-0000-0003-000000000021', 'going')$q$) = 'P0002',
  'ACT-05: a non-member with a leftover maybe row is refused going');
select pg_temp.as_admin();
select pg_temp.check((select status from public.activity_participants where activity_id = 'd7e50000-0000-0000-0003-000000000021'
  and user_id = 'd7e50000-0000-0000-0000-0000000000a3') = 'maybe', 'ACT-05: her row stays maybe');
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a7');
select pg_temp.check(public.join_activity('d7e50000-0000-0000-0003-000000000021', 'going') = 'going', 'ACT-05: a member still joins');
select pg_temp.as_user('d7e50000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.join_activity('d7e50000-0000-0000-0003-000000000021', 'going') = 'going', 'ACT-05: someone already going stays going');
select pg_temp.as_admin();
