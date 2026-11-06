-- Group chats in Messages are removed (owner decision of 2026-11-06,
-- migration 20261109050000_irly_no_group_chats): none is created, joined,
-- renamed or written to; the ones that existed leave the inbox, its unread
-- counts and every direct read, kept on the server. Private, community and
-- activity chats are untouched.
--   a1 Nina  friends with Theo, member of an old group chat (its admin)
--   a2 Theo  friends with Nina, member of the old group chat
--   a3 Rami  not in it
-- TEST accounts only, ids prefixed d0d10000-…. Everything is rolled back.
\set ON_ERROR_STOP 1

begin;

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
    raise exception 'FAIL no_group_chats: %', label;
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
insert into auth.users (id) values ('d0d10000-0000-0000-0000-0000000000a1'), ('d0d10000-0000-0000-0000-0000000000a2'), ('d0d10000-0000-0000-0000-0000000000a3');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d0d10000-0000-0000-0000-0000000000a1', 'Nina', '1994-01-01', 'woman', 'dubai'),
  ('d0d10000-0000-0000-0000-0000000000a2', 'Theo', '1992-02-02', 'man', 'dubai'),
  ('d0d10000-0000-0000-0000-0000000000a3', 'Rami', '1990-03-03', 'man', 'dubai');
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('d0d10000-0000-0000-0000-0000000000a1', 'd0d10000-0000-0000-0000-0000000000a2', 'accepted', 'd0d10000-0000-0000-0000-0000000000a1');

-- An old group chat, from before the decision (kept, listed as removed), with an unread message for Theo.
insert into public.conversations (id, kind, title) values ('d0d10000-0000-0000-0000-0000000000c1', 'group', 'd0d brunch crew');
insert into public.conversation_members (conversation_id, user_id, role) values
  ('d0d10000-0000-0000-0000-0000000000c1', 'd0d10000-0000-0000-0000-0000000000a1', 'admin'),
  ('d0d10000-0000-0000-0000-0000000000c1', 'd0d10000-0000-0000-0000-0000000000a2', 'member');
insert into public.messages (conversation_id, sender_id, body) values ('d0d10000-0000-0000-0000-0000000000c1', 'd0d10000-0000-0000-0000-0000000000a1', 'd0d brunch Friday?');
insert into private.removed_group_chats (conversation_id) values ('d0d10000-0000-0000-0000-0000000000c1');
-- Every group chat that existed at deploy is listed as removed.
select pg_temp.check(not exists (select 1 from public.conversations c where c.kind = 'group' and c.created_at < (select coalesce(min(removed_at), now()) from private.removed_group_chats)
    and not exists (select 1 from private.removed_group_chats g where g.conversation_id = c.id)), 'every group chat of the deploy is listed as removed');

-- A private chat, a community chat and an activity chat between Nina and Theo.
insert into public.conversations (id, kind) values ('d0d10000-0000-0000-0000-0000000000d1', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('d0d10000-0000-0000-0000-0000000000d1', 'd0d10000-0000-0000-0000-0000000000a1'), ('d0d10000-0000-0000-0000-0000000000d1', 'd0d10000-0000-0000-0000-0000000000a2');
insert into public.communities (id, city_id, name, created_by) values ('d0d10000-0000-0000-0000-0000000000f1', 'dubai', 'd0d book club', 'd0d10000-0000-0000-0000-0000000000a1');
insert into public.community_members (community_id, user_id, role) values
  ('d0d10000-0000-0000-0000-0000000000f1', 'd0d10000-0000-0000-0000-0000000000a1', 'owner'),
  ('d0d10000-0000-0000-0000-0000000000f1', 'd0d10000-0000-0000-0000-0000000000a2', 'member');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('d0d10000-0000-0000-0000-0000000000b1', 'd0d10000-0000-0000-0000-0000000000a1', 'd0d padel', 'sport', 'dubai', 'marina', now() + interval '2 days');
insert into public.activity_participants (activity_id, user_id, status) values ('d0d10000-0000-0000-0000-0000000000b1', 'd0d10000-0000-0000-0000-0000000000a2', 'going');
select id as k_id from public.conversations where community_id = 'd0d10000-0000-0000-0000-0000000000f1' \gset
select id as act_id from public.conversations where activity_id = 'd0d10000-0000-0000-0000-0000000000b1' \gset
-- Theo last read everything an hour ago (the messages below are new to him).
update public.conversation_members set last_read_at = now() - interval '1 hour' where user_id = 'd0d10000-0000-0000-0000-0000000000a2';

-- ───────── 1. No group chat is created ─────────
select pg_temp.as_user('d0d10000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$select public.create_group('d0d new crew', array['d0d10000-0000-0000-0000-0000000000a2']::uuid[])$q$) = '42501', 'Nina: create_group refused');
select pg_temp.check(pg_temp.fails($q$insert into public.conversations (kind, title) values ('group', 'd0d direct')$q$) is not null, 'Nina: nor a direct insert');
select pg_temp.check(pg_temp.fails($q$update public.conversations set kind = 'group' where id = 'd0d10000-0000-0000-0000-0000000000d1'$q$) is not null
  or (select kind from public.conversations where id = 'd0d10000-0000-0000-0000-0000000000d1') = 'direct', 'Nina: a private chat cannot become a group chat');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.conversations where kind = 'group' and title like 'd0d %' and id <> 'd0d10000-0000-0000-0000-0000000000c1'), 'no new group chat in the database');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'GROUP_ADDED' and user_id = 'd0d10000-0000-0000-0000-0000000000a2'), 'Theo is told nothing');

-- ───────── 2. The old one is gone from every list, kept ─────────
select pg_temp.as_user('d0d10000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id = 'd0d10000-0000-0000-0000-0000000000c1'), 'Theo: not in his inbox');
select pg_temp.check(coalesce((select sum(unread) from public.my_conversations() where kind = 'group'), 0) = 0, 'Theo: no unread count from it');
select pg_temp.check(not exists (select 1 from public.conversations where id = 'd0d10000-0000-0000-0000-0000000000c1'), 'Theo: an old link finds no chat');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'd0d10000-0000-0000-0000-0000000000c1'), 'Theo: nor its messages');
select pg_temp.check(not exists (select 1 from public.conversation_members where conversation_id = 'd0d10000-0000-0000-0000-0000000000c1'), 'Theo: nor its members');
select pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, body) values ('d0d10000-0000-0000-0000-0000000000c1', auth.uid(), 'd0d still on?')$q$) = '42501', 'Theo: cannot write there');
select pg_temp.check(pg_temp.fails($q$select public.leave_group('d0d10000-0000-0000-0000-0000000000c1')$q$) = '42501', 'Theo: leave_group refused (not reachable)');
select pg_temp.as_user('d0d10000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$select public.rename_group('d0d10000-0000-0000-0000-0000000000c1', 'd0d renamed')$q$) = '42501', 'Nina (its admin): rename refused');
select pg_temp.check(pg_temp.fails($q$select public.add_group_members('d0d10000-0000-0000-0000-0000000000c1', array['d0d10000-0000-0000-0000-0000000000a3']::uuid[])$q$) = '42501', 'Nina: adding someone refused');
select pg_temp.check(pg_temp.fails($q$insert into public.conversation_members (conversation_id, user_id) values ('d0d10000-0000-0000-0000-0000000000c1', 'd0d10000-0000-0000-0000-0000000000a3')$q$) is not null, 'Nina: nor added directly');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = 'd0d10000-0000-0000-0000-0000000000c1') = 2
  and exists (select 1 from public.messages where conversation_id = 'd0d10000-0000-0000-0000-0000000000c1' and body = 'd0d brunch Friday?')
  and exists (select 1 from public.conversations where id = 'd0d10000-0000-0000-0000-0000000000c1' and title = 'd0d brunch crew'),
  'the old group chat is kept as it was (members, history, name)');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = 'd0d10000-0000-0000-0000-0000000000c1'
    and payload ->> 'body' = 'd0d still on?'), 'no notification for a refused message');

-- ───────── 3. Private, community and activity chats are untouched ─────────
select pg_temp.as_user('d0d10000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, body) values
  ('d0d10000-0000-0000-0000-0000000000d1', auth.uid(), 'd0d hi Theo'),
  (:'k_id', auth.uid(), 'd0d club news'),
  (:'act_id', auth.uid(), 'd0d court 2');
select pg_temp.as_user('d0d10000-0000-0000-0000-0000000000a2');
select pg_temp.check((select count(*) from public.my_conversations() where conversation_id in ('d0d10000-0000-0000-0000-0000000000d1', :'k_id', :'act_id')) = 3,
  'Theo: his private, community and activity chats are in his inbox');
select pg_temp.check((select bool_and(unread >= 1) from public.my_conversations() where conversation_id in ('d0d10000-0000-0000-0000-0000000000d1', :'k_id', :'act_id')),
  'Theo: each counts its unread message');
select pg_temp.check((select count(*) from public.messages where body in ('d0d hi Theo', 'd0d club news', 'd0d court 2')) = 3, 'Theo: he reads all three');
insert into public.messages (conversation_id, sender_id, body) values ('d0d10000-0000-0000-0000-0000000000d1', auth.uid(), 'd0d hi Nina');
select pg_temp.check(exists (select 1 from public.messages where body = 'd0d hi Nina'), 'Theo: he answers in the private chat');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'd0d10000-0000-0000-0000-0000000000a1' and kind = 'MESSAGE_CREATED'
    and payload ->> 'conversation_id' = 'd0d10000-0000-0000-0000-0000000000d1'), 'Nina is notified of his private message');

select pg_temp.as_admin();
rollback;
