-- Realtime at scale (20261120000000_irly_realtime_scale):
--   1. a join or a changed answer signals the host, and only the host;
--   2. the filters the app now listens with name every row the read rules
--      would have delivered to that member: follows and friendships by their
--      two parties, chats, messages and removals by the member's own list of
--      chats. Nothing a member could hear before is outside her filters.
-- Test accounts only (ids 5ca1e000-…), removed at the end.
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

select pg_temp.as_admin();
-- As on Supabase (table privileges for the API roles; row-level security decides the rows).
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- Hana hosts, Bea and Cleo attend, Dina is nobody's contact, Emil is a man.
insert into auth.users (id) values
  ('5ca1e000-0000-0000-0000-0000000000a1'), ('5ca1e000-0000-0000-0000-0000000000a2'),
  ('5ca1e000-0000-0000-0000-0000000000a3'), ('5ca1e000-0000-0000-0000-0000000000a4'),
  ('5ca1e000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('5ca1e000-0000-0000-0000-0000000000a1', 'Hana', '1994-03-03', 'woman', 'dubai'),
  ('5ca1e000-0000-0000-0000-0000000000a2', 'Bea', '1993-05-05', 'woman', 'dubai'),
  ('5ca1e000-0000-0000-0000-0000000000a3', 'Cleo', '1992-07-07', 'woman', 'dubai'),
  ('5ca1e000-0000-0000-0000-0000000000a4', 'Dina', '1991-08-08', 'woman', 'dubai'),
  ('5ca1e000-0000-0000-0000-0000000000a5', 'Emil', '1990-09-09', 'man', 'dubai');

-- Where the signals stood before each step (each statement is its own transaction:
-- one signal per member, kind and plan per transaction).
create temp table rt_mark (at bigint not null);
grant select on rt_mark to authenticated;
insert into rt_mark values (coalesce((select max(id) from public.sync_signals), 0));
create or replace function pg_temp.mark() returns void language sql as $$
  update rt_mark set at = coalesce((select max(id) from public.sync_signals), 0)
$$;
create or replace function pg_temp.since(who uuid, plan uuid) returns bigint language sql as $$
  select count(*) from public.sync_signals s
  where s.id > (select at from rt_mark) and s.user_id = who and s.kind = 'activities' and s.ref = plan::text
$$;
-- (About plans: leaving a plan's chat, as a changed answer can, has its own 'inbox' signal for that person.)
create or replace function pg_temp.since_all() returns bigint language sql as $$
  select count(*) from public.sync_signals s where s.id > (select at from rt_mark) and s.kind = 'activities'
$$;

-- ───────── 1. Who hears a join ─────────

-- Creating a plan writes the host's own participation: hers to hear, no signal.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000a1', 'Scale walk', 'sport', 'dubai', 'marina', now() + interval '1 day');
select pg_temp.check(exists (select 1 from public.activity_participants where activity_id = '5ca1e000-0000-0000-0000-0000000000f1' and user_id = '5ca1e000-0000-0000-0000-0000000000a1'),
  'the host takes part in her own plan');
select pg_temp.check(pg_temp.since_all() = 0, 'creating a plan signals nobody');

-- Bea joins: the host is told, once, about that plan; Bea hears her own row instead.
select pg_temp.mark();
insert into public.activity_participants (activity_id, user_id) values ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1, 'a join signals the host once');
select pg_temp.check(pg_temp.since_all() = 1, 'a join signals nobody but the host');

-- Cleo joins: again the host only, never the other attendee.
select pg_temp.mark();
insert into public.activity_participants (activity_id, user_id) values ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1, 'a second join signals the host');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a2', '5ca1e000-0000-0000-0000-0000000000f1') = 0, 'a join does not signal the other attendees');
select pg_temp.check(pg_temp.since_all() = 1, 'a second join signals nobody else');

-- A changed answer is a change the host sees; the same answer again is not.
select pg_temp.mark();
update public.activity_participants set status = 'maybe'
where activity_id = '5ca1e000-0000-0000-0000-0000000000f1' and user_id = '5ca1e000-0000-0000-0000-0000000000a2';
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1 and pg_temp.since_all() = 1, 'a changed answer signals the host only');
select pg_temp.mark();
update public.activity_participants set status = 'maybe'
where activity_id = '5ca1e000-0000-0000-0000-0000000000f1' and user_id = '5ca1e000-0000-0000-0000-0000000000a2';
select pg_temp.check(pg_temp.since_all() = 0, 'the same answer again signals nobody');

-- Two joins in one transaction are one signal for the host.
select pg_temp.mark();
delete from public.activity_participants where activity_id = '5ca1e000-0000-0000-0000-0000000000f1' and user_id <> '5ca1e000-0000-0000-0000-0000000000a1';
select pg_temp.mark();
insert into public.activity_participants (activity_id, user_id) values
  ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000a2'),
  ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1 and pg_temp.since_all() = 1, 'two joins in one transaction are one signal');

-- The signal names the plan, never the person, and only the host reads it.
select pg_temp.check(not exists (
  select 1 from public.sync_signals s
  where s.id > (select at from rt_mark) and (s.ref is distinct from '5ca1e000-0000-0000-0000-0000000000f1' or s.kind <> 'activities')
), 'the signal carries the plan and nothing about who joined');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.sync_signals s where s.id > (select at from rt_mark)) = 0, 'an attendee cannot read the host''s signal');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from public.sync_signals s where s.id > (select at from rt_mark)) = 0, 'an outsider cannot read the host''s signal');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from public.sync_signals s where s.id > (select at from rt_mark)) = 1, 'the host reads her signal');
-- The host may read what the signal makes her reload: her plan's participants.
select pg_temp.check((select count(*) from public.activity_participants where activity_id = '5ca1e000-0000-0000-0000-0000000000f1') = 3, 'the host reads her plan''s participants');

-- Through the app's own join (the server function), as the member herself.
select pg_temp.as_admin();
select pg_temp.mark();
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a4');
select public.join_activity('5ca1e000-0000-0000-0000-0000000000f1', 'going');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1, 'join_activity signals the host');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a4', '5ca1e000-0000-0000-0000-0000000000f1') = 0, 'join_activity does not signal the person who joined');

-- A women-only plan: its join is told to its host alone; a man hears nothing of it.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
values ('5ca1e000-0000-0000-0000-0000000000f2', '5ca1e000-0000-0000-0000-0000000000a1', 'Scale brunch', 'food', 'dubai', 'marina', now() + interval '2 days', true, 'girls');
select pg_temp.mark();
insert into public.activity_participants (activity_id, user_id) values ('5ca1e000-0000-0000-0000-0000000000f2', '5ca1e000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f2') = 1 and pg_temp.since_all() = 1, 'a women-only join signals its host only');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a5');
select pg_temp.check((select count(*) from public.sync_signals) = 0, 'a man reads no signal of a women-only plan');
select pg_temp.check((select count(*) from public.activity_participants where activity_id = '5ca1e000-0000-0000-0000-0000000000f2') = 0, 'a man still reads no participant of a women-only plan');
select pg_temp.as_admin();

-- Leaves are told as before (person, host, the other attendees of a small plan).
select pg_temp.mark();
delete from public.activity_participants where activity_id = '5ca1e000-0000-0000-0000-0000000000f1' and user_id = '5ca1e000-0000-0000-0000-0000000000a3';
select pg_temp.check(
  pg_temp.since('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000f1') = 1
  and pg_temp.since('5ca1e000-0000-0000-0000-0000000000a2', '5ca1e000-0000-0000-0000-0000000000f1') = 1
  and pg_temp.since('5ca1e000-0000-0000-0000-0000000000a3', '5ca1e000-0000-0000-0000-0000000000f1') = 1,
  'a leave still signals the person, the host and the attendees');

-- Clients can neither call the trigger function nor write signals; nothing else moved.
select pg_temp.check(not has_function_privilege('authenticated', 'private.sync_signal_activity_joined()', 'execute')
  and not has_function_privilege('anon', 'private.sync_signal_activity_joined()', 'execute'), 'clients cannot call the join signal');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a2');
do $$
begin
  begin
    insert into public.sync_signals (user_id, kind, ref) values ('5ca1e000-0000-0000-0000-0000000000a1', 'activities', '5ca1e000-0000-0000-0000-0000000000f1');
    raise exception 'FAIL a client wrote a signal';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok  clients still cannot write signals';
end $$;
select pg_temp.as_admin();
select pg_temp.check((select count(*) from pg_policy where polrelid = 'public.sync_signals'::regclass) = 1
  and (select count(*) from pg_policy where polrelid = 'public.activity_participants'::regclass) = 1, 'no policy was added or removed');
select pg_temp.check((select relreplident from pg_class where oid = 'public.activity_participants'::regclass) = 'i', 'leaves still carry no key (replica identity unchanged)');

-- ───────── 2. The app's filters name everything the read rules deliver ─────────

-- Hana and Bea follow each other (friends); Cleo follows Dina.
insert into public.follows (follower_id, followee_id) values
  ('5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000a2'),
  ('5ca1e000-0000-0000-0000-0000000000a2', '5ca1e000-0000-0000-0000-0000000000a1'),
  ('5ca1e000-0000-0000-0000-0000000000a3', '5ca1e000-0000-0000-0000-0000000000a4')
on conflict do nothing;
-- A private chat Hana–Bea with a message and a removal; another one Cleo–Dina.
insert into public.conversations (id, kind) values
  ('5ca1e000-0000-0000-0000-0000000000c1', 'direct'), ('5ca1e000-0000-0000-0000-0000000000c2', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('5ca1e000-0000-0000-0000-0000000000c1', '5ca1e000-0000-0000-0000-0000000000a1'),
  ('5ca1e000-0000-0000-0000-0000000000c1', '5ca1e000-0000-0000-0000-0000000000a2'),
  ('5ca1e000-0000-0000-0000-0000000000c2', '5ca1e000-0000-0000-0000-0000000000a3'),
  ('5ca1e000-0000-0000-0000-0000000000c2', '5ca1e000-0000-0000-0000-0000000000a4');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('5ca1e000-0000-0000-0000-0000000000d1', '5ca1e000-0000-0000-0000-0000000000c1', '5ca1e000-0000-0000-0000-0000000000a1', 'Coffee on Saturday?'),
  ('5ca1e000-0000-0000-0000-0000000000d2', '5ca1e000-0000-0000-0000-0000000000c1', '5ca1e000-0000-0000-0000-0000000000a2', 'Yes'),
  ('5ca1e000-0000-0000-0000-0000000000d3', '5ca1e000-0000-0000-0000-0000000000c2', '5ca1e000-0000-0000-0000-0000000000a3', 'Hello Dina');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a1');
select public.delete_my_message('5ca1e000-0000-0000-0000-0000000000d1');
-- Bea clears the chat: the inbox no longer lists it, yet its next message must be heard.
select pg_temp.as_admin();
update public.conversation_members set cleared_at = now()
where conversation_id = '5ca1e000-0000-0000-0000-0000000000c1' and user_id = '5ca1e000-0000-0000-0000-0000000000a2';

do $$
declare
  who uuid;
  mine uuid[];
begin
  foreach who in array array[
    '5ca1e000-0000-0000-0000-0000000000a1', '5ca1e000-0000-0000-0000-0000000000a2', '5ca1e000-0000-0000-0000-0000000000a3',
    '5ca1e000-0000-0000-0000-0000000000a4', '5ca1e000-0000-0000-0000-0000000000a5']::uuid[] loop
    perform pg_temp.as_user(who);
    -- What the app asks to name her chats (src/features/server/chat.ts).
    mine := array(select conversation_id from public.conversation_members where user_id = who);
    if exists (select 1 from public.follows f where who not in (f.follower_id, f.followee_id)) then
      raise exception 'FAIL % reads a follow she is not part of (the follows filters would miss it)', who;
    end if;
    if exists (select 1 from public.friendships f where who not in (f.user_a, f.user_b)) then
      raise exception 'FAIL % reads a friendship she is not part of (the friendships filters would miss it)', who;
    end if;
    if exists (select 1 from public.conversations c where c.id <> all (mine)) then
      raise exception 'FAIL % reads a chat her list does not name', who;
    end if;
    if exists (select 1 from public.messages m where m.conversation_id <> all (mine)) then
      raise exception 'FAIL % reads a message of a chat her list does not name', who;
    end if;
    if exists (select 1 from public.message_removals r where r.conversation_id <> all (mine)) then
      raise exception 'FAIL % reads a removal of a chat her list does not name', who;
    end if;
    if exists (select 1 from public.activity_participants p
               where p.user_id = who and not exists (select 1 from public.activity_participants x where x.activity_id = p.activity_id and x.user_id = who)) then
      raise exception 'FAIL % cannot read her own participation', who;
    end if;
  end loop;
  perform pg_temp.as_admin();
  raise notice 'ok  follows, friendships, chats, messages and removals: nothing readable is outside the member''s filters';
end $$;

select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a1');
select pg_temp.check((select bool_or(conversation_id = '5ca1e000-0000-0000-0000-0000000000c1') and not bool_or(conversation_id = '5ca1e000-0000-0000-0000-0000000000c2')
  from public.conversation_members where user_id = '5ca1e000-0000-0000-0000-0000000000a1'), 'a member lists her chats, and only hers');
select pg_temp.check((select count(*) from public.follows) = 2 and (select count(*) from public.friendships) = 1, 'she reads her follows and her friendship');
select pg_temp.check((select count(*) from public.message_removals) = 1, 'she reads the removal in her chat');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.my_conversations() c where c.conversation_id = '5ca1e000-0000-0000-0000-0000000000c1'), 'a cleared chat is not in the inbox');
select pg_temp.check(exists (select 1 from public.conversation_members where user_id = '5ca1e000-0000-0000-0000-0000000000a2' and conversation_id = '5ca1e000-0000-0000-0000-0000000000c1'),
  'a cleared chat is still in the list the app listens with (its next message is heard)');
select pg_temp.as_user('5ca1e000-0000-0000-0000-0000000000a5');
select pg_temp.check((select count(*) from public.conversation_members where user_id = '5ca1e000-0000-0000-0000-0000000000a5') = 0
  and (select count(*) from public.messages) = 0 and (select count(*) from public.follows) = 0, 'someone in no chat names none and reads none');

-- The columns the filters are written on exist (a renamed column would silence a listener).
select pg_temp.as_admin();
select pg_temp.check((
  select count(*) from information_schema.columns
  where table_schema = 'public' and (table_name, column_name) in (
    ('activity_participants', 'user_id'), ('activity_participants', 'activity_id'),
    ('follows', 'follower_id'), ('follows', 'followee_id'),
    ('friendships', 'user_a'), ('friendships', 'user_b'),
    ('conversations', 'id'), ('messages', 'conversation_id'), ('message_removals', 'conversation_id'),
    ('community_pins', 'community_id'), ('sync_signals', 'user_id'))
) = 11, 'every filtered column exists');

-- ───────── Clean up ─────────
delete from public.conversations where id in ('5ca1e000-0000-0000-0000-0000000000c1', '5ca1e000-0000-0000-0000-0000000000c2');
delete from public.activities where id in ('5ca1e000-0000-0000-0000-0000000000f1', '5ca1e000-0000-0000-0000-0000000000f2');
delete from auth.users where id::text like '5ca1e000-%';
select pg_temp.check(not exists (select 1 from public.profiles where id::text like '5ca1e000-%'), 'test accounts removed');
drop table rt_mark;
