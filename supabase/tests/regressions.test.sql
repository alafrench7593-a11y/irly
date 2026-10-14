-- Regression tests for the audit fixes of 2026-10-20 (migrations
-- 20261020000000 … 20261020000400). Runs after irly_test.sql on the same
-- database (scripts/test-db.sh); every person, chat and post here has its own
-- ids (prefix e5000000-…), so nothing depends on the other test files.
-- Each block raises if a rule does not hold.
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
    raise exception 'FAIL regressions: %', label;
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

select pg_temp.as_admin();

-- People: Ada (woman, IRLY Girl host), Bo, Cy, Di, Ed (women), Fox (man).
insert into auth.users (id) values
  ('e5000000-0000-0000-0000-0000000000a1'), ('e5000000-0000-0000-0000-0000000000a2'),
  ('e5000000-0000-0000-0000-0000000000a3'), ('e5000000-0000-0000-0000-0000000000a4'),
  ('e5000000-0000-0000-0000-0000000000a5'), ('e5000000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('e5000000-0000-0000-0000-0000000000a1', 'Ada', '1994-03-03', 'woman', 'dubai'),
  ('e5000000-0000-0000-0000-0000000000a2', 'Bo', '1993-05-05', 'woman', 'dubai'),
  ('e5000000-0000-0000-0000-0000000000a3', 'Cy', '1992-07-07', 'woman', 'dubai'),
  ('e5000000-0000-0000-0000-0000000000a4', 'Di', '1991-09-09', 'woman', 'dubai'),
  ('e5000000-0000-0000-0000-0000000000a5', 'Ed', '1990-11-11', 'woman', 'dubai'),
  ('e5000000-0000-0000-0000-0000000000a6', 'Fox', '1989-01-01', 'man', 'dubai');

-- ───────── 1. A sent message cannot be rewritten; deleting still works ─────────
insert into public.conversations (id, kind, title) values ('e5000000-0000-0000-0000-0000000000c1', 'group', 'Regression chat');
insert into public.conversation_members (conversation_id, user_id) values
  ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000a1'),
  ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000a2');
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
insert into public.messages (id, conversation_id, sender_id, body)
values ('e5000000-0000-0000-0000-0000000000d1', 'e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000a1', 'See you at 7');

do $$
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(
    pg_temp.fails($q$update public.messages set body = 'See you at 9' where id = 'e5000000-0000-0000-0000-0000000000d1'$q$) = '42501',
    'edit_guard: the sender cannot rewrite a sent message');
  perform pg_temp.as_admin();
  perform pg_temp.check((select body from public.messages where id = 'e5000000-0000-0000-0000-0000000000d1') = 'See you at 7',
    'edit_guard: the text is unchanged');

  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
  perform public.delete_my_message('e5000000-0000-0000-0000-0000000000d1');
  perform pg_temp.as_admin();
  perform pg_temp.check((select deleted_at is not null and body <> 'See you at 7' from public.messages where id = 'e5000000-0000-0000-0000-0000000000d1'),
    'delete_my_message still deletes (and erases) the sender''s message');
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check(not exists (select 1 from public.messages where id = 'e5000000-0000-0000-0000-0000000000d1'),
    'a deleted message is gone for the other member');
end $$;
select pg_temp.as_admin();

-- ───────── 2. A new member starts read up to now ─────────
-- Earlier history from Ada and Bo, then Cy joins: unread 0, not the whole history.
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, body)
select 'e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000a1', 'History ' || g from generate_series(1, 3) g;
select pg_temp.as_admin();
insert into public.conversation_members (conversation_id, user_id) values ('e5000000-0000-0000-0000-0000000000c1', 'e5000000-0000-0000-0000-0000000000a3');

do $$
begin
  perform pg_temp.check((select last_read_at is not null from public.conversation_members
                          where conversation_id = 'e5000000-0000-0000-0000-0000000000c1' and user_id = 'e5000000-0000-0000-0000-0000000000a3'),
    'a new conversation member starts with last_read_at set');
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a3');
  perform pg_temp.check((select unread from public.my_conversations() where conversation_id = 'e5000000-0000-0000-0000-0000000000c1') = 0,
    'a new member sees 0 unread in my_conversations, not the history');
  -- …and Bo, a member before those messages, does see them as unread.
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check((select unread from public.my_conversations() where conversation_id = 'e5000000-0000-0000-0000-0000000000c1') >= 3,
    'an earlier member still counts the new messages as unread');
end $$;
select pg_temp.as_admin();

-- ───────── 3. A suspended IRLY Girl host can cancel, not rename ─────────
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only)
values ('e5000000-0000-0000-0000-0000000000b1', 'e5000000-0000-0000-0000-0000000000a1', 'Regression girls brunch', 'food', 'dubai', 'marina', now() + interval '3 days', true);
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('e5000000-0000-0000-0000-0000000000a1', 'regression test');

do $$
declare
  err text;
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
  err := pg_temp.fails($q$update public.activities set title = 'Renamed brunch' where id = 'e5000000-0000-0000-0000-0000000000b1'$q$);
  perform pg_temp.check(err is not null, 'a suspended host cannot rename her girl-only activity (refused)');
  perform pg_temp.check((select title from public.activities where id = 'e5000000-0000-0000-0000-0000000000b1') = 'Regression girls brunch',
    'a suspended host cannot rename her girl-only activity (title unchanged)');
  perform pg_temp.check(
    pg_temp.fails($q$update public.activities set cancelled_at = now() where id = 'e5000000-0000-0000-0000-0000000000b1'$q$) is null,
    'a suspended host can cancel her girl-only activity (no error)');
  perform pg_temp.as_admin();
  perform pg_temp.check((select cancelled_at is not null and title = 'Regression girls brunch' from public.activities where id = 'e5000000-0000-0000-0000-0000000000b1'),
    'the girl-only activity is cancelled, its title unchanged');
end $$;
select pg_temp.as_admin();

-- A suspended host can cancel, but cannot change anything else, in the same
-- update or later (20261020000800).
do $$ begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a1');
  perform pg_temp.check(pg_temp.fails($q$update public.activities set title = 'Renamed after cancel' where id = 'e5000000-0000-0000-0000-0000000000b1'$q$) is not null,
    'a suspended host cannot rename her cancelled girl-only activity');
end $$;
select pg_temp.as_admin();

-- ───────── 4. A deleted activity takes its notifications with it ─────────
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('e5000000-0000-0000-0000-0000000000b2', 'e5000000-0000-0000-0000-0000000000a2', 'Regression run', 'sport', 'dubai', 'marina', now() + interval '2 days'),
       ('e5000000-0000-0000-0000-0000000000b3', 'e5000000-0000-0000-0000-0000000000a2', 'Regression swim', 'sport', 'dubai', 'marina', now() + interval '2 days');
insert into public.notifications (user_id, kind, payload) values
  ('e5000000-0000-0000-0000-0000000000a3', 'ACTIVITY_JOINED', jsonb_build_object('activity_id', 'e5000000-0000-0000-0000-0000000000b2', 'tag', 'reg-joined')),
  ('e5000000-0000-0000-0000-0000000000a3', 'ACTIVITY_UPDATED', jsonb_build_object('activity_id', 'e5000000-0000-0000-0000-0000000000b2', 'change', 'time', 'tag', 'reg-updated')),
  ('e5000000-0000-0000-0000-0000000000a3', 'ACTIVITY_UPDATED', jsonb_build_object('activity_id', 'e5000000-0000-0000-0000-0000000000b2', 'change', 'deleted', 'tag', 'reg-deleted')),
  ('e5000000-0000-0000-0000-0000000000a3', 'ACTIVITY_JOINED', jsonb_build_object('activity_id', 'e5000000-0000-0000-0000-0000000000b3', 'tag', 'reg-other'));
delete from public.activities where id = 'e5000000-0000-0000-0000-0000000000b2';

do $$
begin
  perform pg_temp.check(not exists (select 1 from public.notifications where payload ->> 'tag' in ('reg-joined', 'reg-updated')),
    'deleting an activity removes its joined / updated notifications');
  perform pg_temp.check(exists (select 1 from public.notifications where payload ->> 'tag' = 'reg-deleted'),
    'the "deleted" notice of that activity stays');
  perform pg_temp.check(exists (select 1 from public.notifications where payload ->> 'tag' = 'reg-other'),
    'notifications of another activity stay');
end $$;

-- ───────── 5. A long comment thread keeps showing the newest comment ─────────
-- 520 older comments (seeded without triggers: rate limits), then Cy comments.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy)
values ('e5000000-0000-0000-0000-0000000000b4', 'e5000000-0000-0000-0000-0000000000a2', 'Regression busy thread', 'sport', 'dubai', 'marina', now() + interval '2 days', 'public');
set session_replication_role = replica;
insert into public.comments (target_type, target_id, author_id, body, created_at)
select 'activity', 'e5000000-0000-0000-0000-0000000000b4', 'e5000000-0000-0000-0000-0000000000a2', 'Old comment ' || g, now() - interval '1 day' + g * interval '1 second'
from generate_series(1, 520) g;
set session_replication_role = default;
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a3');
insert into public.comments (id, target_type, target_id, author_id, body)
values ('e5000000-0000-0000-0000-0000000000e1', 'activity', 'e5000000-0000-0000-0000-0000000000b4', 'e5000000-0000-0000-0000-0000000000a3', 'Newest comment');
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
insert into public.comments (target_type, target_id, parent_id, author_id, body)
values ('activity', 'e5000000-0000-0000-0000-0000000000b4', 'e5000000-0000-0000-0000-0000000000e1', 'e5000000-0000-0000-0000-0000000000a2', 'Reply to the newest');

do $$
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(exists (select 1 from public.comment_thread('activity', 'e5000000-0000-0000-0000-0000000000b4') where id = 'e5000000-0000-0000-0000-0000000000e1'),
    'comment_thread shows the newest comment past 500 comments');
  perform pg_temp.check(exists (select 1 from public.comment_thread('activity', 'e5000000-0000-0000-0000-0000000000b4') where body = 'Reply to the newest'),
    'comment_thread shows the reply to the newest comment');
  perform pg_temp.check(not exists (select 1 from public.comment_thread('activity', 'e5000000-0000-0000-0000-0000000000b4') where body = 'Old comment 1'),
    'comment_thread leaves out the oldest conversations, not the newest');
  -- Still shown oldest first.
  perform pg_temp.check((select body from public.comment_thread('activity', 'e5000000-0000-0000-0000-0000000000b4') t where t.parent_id is null
                          order by t.created_at desc limit 1) = 'Newest comment',
    'comment_thread: the newest root is the last one');
end $$;
select pg_temp.as_admin();

-- ───────── 6. A category feed shows posts older than the 100 newest ─────────
insert into public.communities (id, city_id, name, created_by) values ('e5000000-0000-0000-0000-0000000000f1', 'dubai', 'Regression club', 'e5000000-0000-0000-0000-0000000000a2');
insert into public.community_members (community_id, user_id, role) values
  ('e5000000-0000-0000-0000-0000000000f1', 'e5000000-0000-0000-0000-0000000000a2', 'owner'),
  ('e5000000-0000-0000-0000-0000000000f1', 'e5000000-0000-0000-0000-0000000000a4', 'member');
insert into public.community_channels (community_id, slug, name) values ('e5000000-0000-0000-0000-0000000000f1', 'photos', 'Photos');
set session_replication_role = replica;
insert into public.community_posts (community_id, author_id, body, category, created_at) values
  ('e5000000-0000-0000-0000-0000000000f1', 'e5000000-0000-0000-0000-0000000000a2', 'Old photo post', 'photos', now() - interval '30 days');
insert into public.community_posts (community_id, author_id, body, created_at)
select 'e5000000-0000-0000-0000-0000000000f1', 'e5000000-0000-0000-0000-0000000000a2', 'General post ' || g, now() - interval '1 day' + g * interval '1 second'
from generate_series(1, 120) g;
set session_replication_role = default;

do $$
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(exists (select 1 from public.community_space_feed('e5000000-0000-0000-0000-0000000000f1', 'photos') where body = 'Old photo post'),
    'community_space_feed returns a category post older than the 100 newest posts');
  perform pg_temp.check(not exists (select 1 from public.community_space_feed('e5000000-0000-0000-0000-0000000000f1', 'photos') where body like 'General post%'),
    'community_space_feed: a category shows only its own posts');
  perform pg_temp.check((select count(*) from public.community_space_feed('e5000000-0000-0000-0000-0000000000f1', null, 30)) = 30,
    'community_space_feed: General still pages by the limit');
end $$;
select pg_temp.as_admin();

-- ───────── 7. Ask, cancel, ask again: one friend request ping a week ─────────
do $$
declare
  pings_before int;
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(public.add_friend('e5000000-0000-0000-0000-0000000000a5') = 'pending', 'add_friend: a request is pending');
  perform pg_temp.as_admin();
  perform pg_temp.check((select count(*) from public.notifications where user_id = 'e5000000-0000-0000-0000-0000000000a5'
                          and kind = 'FRIEND_REQUEST' and payload ->> 'from' = 'e5000000-0000-0000-0000-0000000000a4') = 1,
    'the first request pings once');
  perform pg_temp.check((select count(*) from private.friend_request_pings where from_id = 'e5000000-0000-0000-0000-0000000000a4'
                          and to_id = 'e5000000-0000-0000-0000-0000000000a5') = 1,
    'the ping is remembered in private.friend_request_pings');
  select count(*) into pings_before from public.notifications where kind = 'FRIEND_REQUEST';

  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform public.remove_friend('e5000000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(public.add_friend('e5000000-0000-0000-0000-0000000000a5') = 'pending', 'add_friend again after cancelling: pending');
  perform public.remove_friend('e5000000-0000-0000-0000-0000000000a5');
  perform pg_temp.check(public.add_friend('e5000000-0000-0000-0000-0000000000a5') = 'pending', 'add_friend a third time: pending');
  perform pg_temp.as_admin();
  perform pg_temp.check((select count(*) from public.notifications where user_id = 'e5000000-0000-0000-0000-0000000000a5'
                          and kind = 'FRIEND_REQUEST' and payload ->> 'from' = 'e5000000-0000-0000-0000-0000000000a4') = 0,
    'asking again within the week sends no new FRIEND_REQUEST ping');
  perform pg_temp.check((select count(*) from public.notifications where kind = 'FRIEND_REQUEST') <= pings_before,
    'no FRIEND_REQUEST notification was added by asking again');
  perform pg_temp.check((select count(*) from private.friend_request_pings where from_id = 'e5000000-0000-0000-0000-0000000000a4') = 1,
    'still one remembered ping for the pair');
end $$;

-- ───────── 8. A community co-member cannot read your profile row ─────────
-- Di and Ed share only the community chat of "Regression club"; Di and Bo share a group chat.
insert into public.community_members (community_id, user_id) values ('e5000000-0000-0000-0000-0000000000f1', 'e5000000-0000-0000-0000-0000000000a5');
insert into public.conversations (kind, community_id, title)
select 'community', 'e5000000-0000-0000-0000-0000000000f1', 'Regression club'
where not exists (select 1 from public.conversations where community_id = 'e5000000-0000-0000-0000-0000000000f1');
insert into public.conversation_members (conversation_id, user_id)
select v.id, u.id from public.conversations v
cross join (values ('e5000000-0000-0000-0000-0000000000a4'::uuid), ('e5000000-0000-0000-0000-0000000000a5'::uuid)) u (id)
where v.community_id = 'e5000000-0000-0000-0000-0000000000f1'
on conflict do nothing;
insert into public.conversations (id, kind, title) values ('e5000000-0000-0000-0000-0000000000c2', 'group', 'Regression duo');
insert into public.conversation_members (conversation_id, user_id) values
  ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-0000000000a4'),
  ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-0000000000a2');

do $$
begin
  perform pg_temp.check((select count(*) from public.conversation_members m join public.conversations v on v.id = m.conversation_id
                          where v.community_id = 'e5000000-0000-0000-0000-0000000000f1'
                            and m.user_id in ('e5000000-0000-0000-0000-0000000000a4', 'e5000000-0000-0000-0000-0000000000a5')) = 2,
    'setup: Di and Ed share the community chat');
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(not exists (select 1 from public.profiles where id = 'e5000000-0000-0000-0000-0000000000a5'),
    'a community co-member cannot select the profile row of someone she only shares a community chat with');
  perform pg_temp.check(exists (select 1 from public.profiles where id = 'e5000000-0000-0000-0000-0000000000a2'),
    'a group chat co-member can select the profile row');
end $$;
select pg_temp.as_admin();

-- ───────── 9. Analytics keep the server's clock ─────────
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
insert into public.analytics_events (user_id, name, created_at)
values ('e5000000-0000-0000-0000-0000000000a4', 'REGRESSION_BACKDATED', '2020-01-01T00:00:00Z');
select pg_temp.as_admin();
do $$
begin
  perform pg_temp.check((select bool_and(created_at > now() - interval '1 hour') from public.analytics_events where name = 'REGRESSION_BACKDATED')
    and exists (select 1 from public.analytics_events where name = 'REGRESSION_BACKDATED'),
    'analytics_events created_at is the server time, not the one sent');
end $$;

-- ───────── 10. Reading a chat with nothing new writes nothing ─────────
-- Ed joins the duo chat after its last message: nothing to read.
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-0000000000a2', 'Before Ed');
select pg_temp.as_admin();
insert into public.conversation_members (conversation_id, user_id) values ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-0000000000a5');
select xmin::text as ed_xmin_before from public.conversation_members
where conversation_id = 'e5000000-0000-0000-0000-0000000000c2' and user_id = 'e5000000-0000-0000-0000-0000000000a5' \gset
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a5');
select public.mark_conversation_read('e5000000-0000-0000-0000-0000000000c2');
select pg_temp.as_admin();
select pg_temp.check((select xmin::text from public.conversation_members
                       where conversation_id = 'e5000000-0000-0000-0000-0000000000c2' and user_id = 'e5000000-0000-0000-0000-0000000000a5') = :'ed_xmin_before',
  'mark_conversation_read performs no write when nothing is new (same xmin)');
-- A new message from Bo: now it writes.
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values ('e5000000-0000-0000-0000-0000000000c2', 'e5000000-0000-0000-0000-0000000000a2', 'After Ed joined');
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a5');
select public.mark_conversation_read('e5000000-0000-0000-0000-0000000000c2');
select pg_temp.as_admin();
select pg_temp.check((select xmin::text from public.conversation_members
                       where conversation_id = 'e5000000-0000-0000-0000-0000000000c2' and user_id = 'e5000000-0000-0000-0000-0000000000a5') <> :'ed_xmin_before',
  'mark_conversation_read writes when there is a new message');
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a5');
select pg_temp.check((select unread from public.my_conversations() where conversation_id = 'e5000000-0000-0000-0000-0000000000c2') = 0,
  'after reading, the chat shows 0 unread');
select pg_temp.as_admin();

-- ───────── 11. A Live keeps its media shape ─────────
select pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
insert into public.irl_posts (id, author_id, city_id, area_id, body, visibility, media_ratio)
values ('e5000000-0000-0000-0000-0000000000e2', 'e5000000-0000-0000-0000-0000000000a4', 'dubai', 'marina', 'Regression live', 'everyone', 0.75);
do $$
begin
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a4');
  perform pg_temp.check(pg_temp.fails($q$insert into public.irl_posts (author_id, city_id, area_id, body, visibility, media_ratio)
    values ('e5000000-0000-0000-0000-0000000000a4', 'dubai', 'marina', 'Too wide', 'everyone', 20)$q$) is not null,
    'irl_posts refuses a media_ratio out of range');
  perform pg_temp.as_user('e5000000-0000-0000-0000-0000000000a2');
  perform pg_temp.check((select media_ratio from public.irl_feed('dubai') where id = 'e5000000-0000-0000-0000-0000000000e2') = 0.75::real,
    'irl_feed returns media_ratio');
  perform pg_temp.as_admin();
  perform pg_temp.check(not has_function_privilege('anon', 'public.irl_feed(text)', 'execute'),
    'anon has no execute right on irl_feed');
  execute 'set role anon';
  perform pg_temp.check(pg_temp.fails($q$select * from public.irl_feed('dubai')$q$) = '42501',
    'anon cannot call irl_feed');
  execute 'reset role';
end $$;
select pg_temp.as_admin();

\echo 'REGRESSIONS PASSED'
