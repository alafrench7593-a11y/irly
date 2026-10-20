-- Private messaging end to end (20261024009700_irly_messaging_audit.sql): "Message"
-- from a profile (open_direct) opens one chat per pair, even when both tap at the
-- same moment, and never one the other member does not accept; a message sent
-- twice (a retry) is one message; reads, archive and "delete for me" are the
-- actor's only; someone who left a group, community or activity reads nothing
-- new; a chat's context matches its kind.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9700000-….
--
--   a1 Ana  friends with Ben, Dan, Eve and Fay
--   a2 Ben  friends with Ana and Eve
--   a3 Cat  accepts messages from nobody
--   a4 Dan  Ana's friend, blocked by Ana
--   a5 Eve  friends with Ana and Ben
--   a6 Fay  Ana's friend, account closed
--   a7 Gus  accepts messages from friends only (not Ana's friend)
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
    raise exception 'FAIL messaging_audit: %', label;
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
-- The private chats between two members (as the database holds them).
create or replace function pg_temp.directs(a uuid, b uuid) returns integer language sql as $$
  select count(*)::int from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = a)
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = b)
$$;

select pg_temp.as_admin();
insert into auth.users (id) select ('c9700000-0000-0000-0000-0000000000a' || n)::uuid from generate_series(1, 7) n;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9700000-0000-0000-0000-0000000000a1', 'Ana', '1995-02-02', 'woman', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a2', 'Ben', '1993-04-04', 'man', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a3', 'Cat', '1996-06-06', 'woman', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a4', 'Dan', '1992-03-03', 'man', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a5', 'Eve', '1994-05-05', 'woman', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a6', 'Fay', '1997-07-07', 'woman', 'dubai'),
  ('c9700000-0000-0000-0000-0000000000a7', 'Gus', '1991-01-01', 'man', 'dubai');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a2', 'accepted', 'c9700000-0000-0000-0000-0000000000a1'),
  ('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a4', 'accepted', 'c9700000-0000-0000-0000-0000000000a1'),
  ('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a5', 'accepted', 'c9700000-0000-0000-0000-0000000000a1'),
  ('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a6', 'accepted', 'c9700000-0000-0000-0000-0000000000a1'),
  ('c9700000-0000-0000-0000-0000000000a2', 'c9700000-0000-0000-0000-0000000000a5', 'accepted', 'c9700000-0000-0000-0000-0000000000a2');
insert into public.safety_settings (user_id, who_can_message) values
  ('c9700000-0000-0000-0000-0000000000a3', 'nobody'), ('c9700000-0000-0000-0000-0000000000a7', 'friends');
insert into public.blocks (blocker_id, blocked_id) values ('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a4');
update public.profiles set deleted_at = now() where id = 'c9700000-0000-0000-0000-0000000000a6';

-- ───────── 1. "Message" from a profile: one chat per pair ─────────
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select public.open_direct('c9700000-0000-0000-0000-0000000000a2') as x_id \gset
select pg_temp.check(public.open_direct('c9700000-0000-0000-0000-0000000000a2') = :'x_id', 'Ana taps Message twice: the same chat');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.open_direct('c9700000-0000-0000-0000-0000000000a1') = :'x_id', 'Ben taps Message on Ana: the same chat');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a2') = 1
  and (select count(*) from public.conversation_members where conversation_id = :'x_id') = 2, '… one private chat, with the two of them');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check((select other_user_id = 'c9700000-0000-0000-0000-0000000000a1' and other_name = 'Ana' and kind = 'direct'
  from public.my_conversations() where conversation_id = :'x_id'), 'the new chat is in Ben''s inbox at once, with Ana''s name and id');

-- Ben and Eve tap Message on each other at the same moment (two sessions): one chat.
select pg_temp.as_admin();
create schema c97_dblink;
create extension dblink schema c97_dblink;
select c97_dblink.dblink_connect('c97_ben', 'dbname=' || current_database());
select c97_dblink.dblink_connect('c97_eve', 'dbname=' || current_database());
select c97_dblink.dblink_exec('c97_ben', 'begin');
select c97_dblink.dblink_exec('c97_ben', $$set request.jwt.claim.sub = 'c9700000-0000-0000-0000-0000000000a2'$$);
select c97_dblink.dblink_exec('c97_ben', 'set role authenticated');
select c97_dblink.dblink_exec('c97_eve', 'begin');
select c97_dblink.dblink_exec('c97_eve', $$set request.jwt.claim.sub = 'c9700000-0000-0000-0000-0000000000a5'$$);
select c97_dblink.dblink_exec('c97_eve', 'set role authenticated');
-- Ben's call is done but not committed yet; Eve's starts meanwhile.
select id as ben_conv from c97_dblink.dblink('c97_ben', $$select public.open_direct('c9700000-0000-0000-0000-0000000000a5')::text$$) as t (id text) \gset
select c97_dblink.dblink_send_query('c97_eve', $$select public.open_direct('c9700000-0000-0000-0000-0000000000a2')::text$$);
select pg_sleep(0.3);
select pg_temp.check(c97_dblink.dblink_is_busy('c97_eve') = 1, 'Eve''s call waits for Ben''s (the pair lock), it does not make a second chat');
select c97_dblink.dblink_exec('c97_ben', 'commit');
select id as eve_conv from c97_dblink.dblink_get_result('c97_eve') as t (id text) \gset
select count(*) = 0 as eve_done from c97_dblink.dblink_get_result('c97_eve') as t (id text); -- the end of her answer
select c97_dblink.dblink_exec('c97_eve', 'commit');
select c97_dblink.dblink_disconnect('c97_ben');
select c97_dblink.dblink_disconnect('c97_eve');
drop extension dblink;
drop schema c97_dblink;
select pg_temp.check(:'ben_conv' = :'eve_conv', 'Ben and Eve at the same moment: both open the same chat');
select pg_temp.check(pg_temp.directs('c9700000-0000-0000-0000-0000000000a2', 'c9700000-0000-0000-0000-0000000000a5') = 1, '… and only one exists');

-- Not allowed: no chat is ever made.
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a3')$$) = '42501', 'Cat accepts messages from nobody: Ana cannot open a chat');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a7')$$) = '42501', 'Gus accepts friends only: Ana (not his friend) cannot open a chat');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a4')$$) = 'P0002', 'Dan, Ana''s friend she blocked: no chat');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a1')$$) = 'P0002', '… nor from Dan''s side');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a6')$$) = 'P0002', 'Fay closed her account: no chat, though she is Ana''s friend');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c9700000-0000-0000-0000-0000000000a1')$$) = 'P0002', 'no chat with yourself');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a3') = 0
  and pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a7') = 0
  and pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a4') = 0
  and pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a6') = 0, '… and none of those refusals left a chat behind');

-- ───────── 2. Send, retry, limits ─────────
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
insert into public.messages (id, conversation_id, sender_id, body, created_at)
  values ('c9700000-0000-0000-0000-0000000000e1', :'x_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 hello Ben 👋', '2001-01-01');
select pg_temp.check(pg_temp.fails($$insert into public.messages (id, conversation_id, sender_id, body) values ('c9700000-0000-0000-0000-0000000000e1', '$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', 'c97 hello Ben 👋')$$) = '23505',
  'a retry with the same id is refused as already there (the app counts it sent)');
select pg_temp.check((select count(*) from public.messages where id = 'c9700000-0000-0000-0000-0000000000e1') = 1, '… one message, not two');
select pg_temp.check((select created_at > now() - interval '1 minute' from public.messages where id = 'c9700000-0000-0000-0000-0000000000e1'),
  'a message is dated by the server (a phone''s clock cannot reorder the chat)');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', repeat('😀', 4000))$$) is null,
  '4000 emoji fit in one message (the app''s 4000 UTF-16 limit is never over the server''s)');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', repeat('a', 4001))$$) = '23514', '4001 characters are refused');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', '')$$) = '23514', 'an empty message is refused');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a2', 'c97 as Ben')$$) = '42501', 'nobody writes as someone else');

-- Ben now accepts messages from nobody: Ana's chat stays, but she cannot write until he does.
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
insert into public.safety_settings (user_id, who_can_message) values (auth.uid(), 'nobody')
  on conflict (user_id) do update set who_can_message = 'nobody';
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.open_direct('c9700000-0000-0000-0000-0000000000a2') = :'x_id', 'an existing chat still opens when he changes his settings');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', 'c97 still there?')$$) = '42501', '… but Ana cannot write in it');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values (:'x_id', 'c9700000-0000-0000-0000-0000000000a2', 'c97 hi Ana');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a1', 'c97 hi again')$$) is null, 'once Ben wrote, Ana can reply');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
update public.safety_settings set who_can_message = 'matches' where user_id = auth.uid();

-- ───────── 3. Read state ─────────
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check((select unread from public.my_conversations() where conversation_id = :'x_id') = 3, 'Ben has 3 unread (Ana''s three messages, not his own)');
select public.mark_conversation_read(:'x_id');
select pg_temp.check((select unread from public.my_conversations() where conversation_id = :'x_id') = 0, 'read: 0 unread');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check((select unread from public.my_conversations() where conversation_id = :'x_id') = 1, 'Ben''s read is his own: Ana still has his message unread');

-- ───────── 4. Archive, delete for me, hide ─────────
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select public.set_conversation_archived(:'x_id', true);
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(not (select archived from public.my_conversations() where conversation_id = :'x_id'), 'Ben archives: Ana''s list is unchanged');
insert into public.messages (conversation_id, sender_id, body) values (:'x_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 are you there');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check((select archived and unread = 1 from public.my_conversations() where conversation_id = :'x_id'), 'a new message keeps it archived for Ben, with its unread count');
select public.remove_conversation_for_me(:'x_id');
select pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id = :'x_id'), 'Ben deletes the chat for himself: gone from his list');
select pg_temp.check((select count(*) from public.messages where conversation_id = :'x_id') = 0, '… and its history from his reads');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.messages where conversation_id = :'x_id') = 5, 'Ana keeps every message');
insert into public.messages (id, conversation_id, sender_id, body) values ('c9700000-0000-0000-0000-0000000000e2', :'x_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 new start');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check((select unread = 1 and last_body = 'c97 new start' and not archived from public.my_conversations() where conversation_id = :'x_id'),
  'Ana writes again: the chat is back in Ben''s list with the new message only');
select pg_temp.check((select array_agg(id) from public.messages where conversation_id = :'x_id') = array['c9700000-0000-0000-0000-0000000000e2'::uuid], '… his thread shows that one message');
select public.hide_message_for_me('c9700000-0000-0000-0000-0000000000e2');
select pg_temp.check(not exists (select 1 from public.messages where id = 'c9700000-0000-0000-0000-0000000000e2'), 'Ben hides it: gone for him');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.messages where id = 'c9700000-0000-0000-0000-0000000000e2'), '… Ana still has it');
select pg_temp.check(pg_temp.fails($$select public.set_conversation_archived('$$ || :'ben_conv' || $$', true)$$) = 'P0002', 'Ana cannot archive a chat she is not in');

-- ───────── 5. Left a group, community or activity: nothing new reaches you ─────────
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
select public.create_group('c97 group', array['c9700000-0000-0000-0000-0000000000a2'::uuid]) as g_id \gset
select pg_temp.as_admin();
insert into public.communities (id, city_id, name) values ('c9700000-0000-0000-0000-0000000000f1', 'dubai', 'c97 club');
insert into public.community_members (community_id, user_id, role) values
  ('c9700000-0000-0000-0000-0000000000f1', 'c9700000-0000-0000-0000-0000000000a1', 'owner'),
  ('c9700000-0000-0000-0000-0000000000f1', 'c9700000-0000-0000-0000-0000000000a2', 'member');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('c9700000-0000-0000-0000-0000000000b1', 'c9700000-0000-0000-0000-0000000000a1', 'c97 padel', 'sport', 'dubai', 'marina', now() + interval '2 days');
-- (Ana, its organiser, is in it from the start.)
insert into public.activity_participants (activity_id, user_id, status) values ('c9700000-0000-0000-0000-0000000000b1', 'c9700000-0000-0000-0000-0000000000a2', 'going');
select id as k_id from public.conversations where community_id = 'c9700000-0000-0000-0000-0000000000f1' \gset
select id as act_id from public.conversations where activity_id = 'c9700000-0000-0000-0000-0000000000b1' \gset
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.my_conversations() where conversation_id in (:'g_id', :'k_id', :'act_id')) = 3, 'Ben is in the group, the community chat and the activity chat');
select public.leave_group(:'g_id');
select public.leave_community('c9700000-0000-0000-0000-0000000000f1');
select public.leave_activity('c9700000-0000-0000-0000-0000000000b1');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, body) values
  (:'g_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 group news'),
  (:'k_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 club news'),
  (:'act_id', 'c9700000-0000-0000-0000-0000000000a1', 'c97 padel news');
select pg_temp.as_user('c9700000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id in (:'g_id', :'k_id', :'act_id')),
  'Ben left: he reads no message there (Realtime uses the same read rule, so none is pushed to him)');
select pg_temp.check(not exists (select 1 from public.conversations where id in (:'g_id', :'k_id', :'act_id')), '… nor the chats themselves (the app sees it is out)');
select pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id in (:'g_id', :'k_id', :'act_id')), '… and they leave his inbox');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'g_id' || $$', 'c9700000-0000-0000-0000-0000000000a2', 'c97 back?')$$) = '42501'
  and pg_temp.fails($$insert into public.messages (conversation_id, sender_id, body) values ('$$ || :'k_id' || $$', 'c9700000-0000-0000-0000-0000000000a2', 'c97 back?')$$) = '42501', '… and cannot write there');

-- ───────── 6. A chat's context matches its kind ─────────
select pg_temp.as_admin();
select pg_temp.check((select convalidated from pg_constraint where conname = 'conversations_context_shape'), 'every existing chat matches its kind (constraint validated)');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, title) values ('community', 'c97 no club')$$) = '23514', 'a community chat without its community is refused');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, activity_id) values ('group', 'c9700000-0000-0000-0000-0000000000b1')$$) = '23514', 'a group cannot carry an activity');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, community_id) values ('community', 'c9700000-0000-0000-0000-0000000000f1')$$) = '23505', 'a community has one chat');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, activity_id) values ('activity', 'c9700000-0000-0000-0000-0000000000b1')$$) = '23505', 'an activity has one chat');
insert into public.conversations (id, kind) values ('c9700000-0000-0000-0000-0000000000d2', 'direct');
insert into public.conversation_members (conversation_id, user_id) values ('c9700000-0000-0000-0000-0000000000d2', 'c9700000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($$insert into public.conversation_members (conversation_id, user_id) values ('c9700000-0000-0000-0000-0000000000d2', 'c9700000-0000-0000-0000-0000000000a2')$$) = '23505',
  'a second private chat for Ana and Ben is refused by the database itself');
select pg_temp.check(pg_temp.fails($$insert into public.conversation_members (conversation_id, user_id) values ('$$ || :'x_id' || $$', 'c9700000-0000-0000-0000-0000000000a5')$$) = '23514', 'a private chat never gets a third member');
delete from public.conversations where id = 'c9700000-0000-0000-0000-0000000000d2';
select pg_temp.check(pg_temp.directs('c9700000-0000-0000-0000-0000000000a1', 'c9700000-0000-0000-0000-0000000000a2') = 1, 'Ana and Ben still have exactly one private chat');
