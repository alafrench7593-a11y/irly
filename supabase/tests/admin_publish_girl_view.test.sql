-- The IRLY team publishes in its official communities signed « IRLY »
-- (migration 20261109100000_irly_admin_publish_girl_view). In IRLY Girl and Mom, only a
-- team member with IRLY Girl access of her own: being staff opens nothing
-- there, and IRLY Girl isolation holds for every man, staff or not, except
-- the read-only, journaled view of the one designated safety moderator.
-- Every check fails before that migration.
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- Ids a9b00000-….
\set ON_ERROR_STOP 1

begin;

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL admin_publish_girl_view: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with, or null when it runs.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

-- Rows a statement returns (0 when refused by RLS without an error).
create or replace function pg_temp.count_of(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute 'select count(*) from (' || stmt || ') x' into n;
  return n;
end $$;

select pg_temp.as_admin();

-- 01 Owen (owner of the back office, a man), 02 Ada (admin, verified woman),
-- 03 Cleo (content role, a man), 04 Mo (moderator, a man), 05 Nina
-- (verified woman, member of the IRLY Girl community), 06 Max (a man,
-- member of the mixte official community), 07 Wendy (content role,
-- verified woman), 08 Una (a man, owner of his own community).
insert into auth.users (id) select ('a9b00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 8) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a9b00000-0000-0000-0000-000000000001', 'Owen', '1985-01-01', 'man', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000002', 'Ada', '1985-01-01', 'woman', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000003', 'Cleo', '1985-01-01', 'man', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000004', 'Mo', '1985-01-01', 'man', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000005', 'Nina', '1992-01-01', 'woman', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000006', 'Max', '1990-01-01', 'man', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000007', 'Wendy', '1990-01-01', 'woman', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000008', 'Una', '1990-01-01', 'man', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'a9b00000-%';
update public.profiles set verified_at = now() where id in ('a9b00000-0000-0000-0000-000000000002', 'a9b00000-0000-0000-0000-000000000005', 'a9b00000-0000-0000-0000-000000000007');
insert into public.staff_roles (user_id, role) values
  ('a9b00000-0000-0000-0000-000000000001', 'owner'),
  ('a9b00000-0000-0000-0000-000000000002', 'admin'),
  ('a9b00000-0000-0000-0000-000000000003', 'content'),
  ('a9b00000-0000-0000-0000-000000000004', 'moderator'),
  ('a9b00000-0000-0000-0000-000000000007', 'content');

-- IRLY's own: M (mixte), G (IRLY Girl), W (Mom): official is the flag, never
-- a topic (topics are being replaced). U: Una's own.
insert into public.communities (id, city_id, name, official, created_by) values
  ('a9b00000-0000-0000-0000-0000000000c1', 'dubai', 'Test official mixte', true, null);
insert into public.communities (id, city_id, name, official, girl_only, created_by) values
  ('a9b00000-0000-0000-0000-0000000000c2', 'dubai', 'Test official girl', true, true, null),
  ('a9b00000-0000-0000-0000-0000000000c3', 'dubai', 'Test official mom', true, true, null);
insert into public.communities (id, city_id, name, created_by) values
  ('a9b00000-0000-0000-0000-0000000000c4', 'dubai', 'Una padel friends', 'a9b00000-0000-0000-0000-000000000008');
select 'a9b00000-0000-0000-0000-0000000000c3' as mom \gset
insert into public.community_members (community_id, user_id, role) values
  ('a9b00000-0000-0000-0000-0000000000c1', 'a9b00000-0000-0000-0000-000000000006', 'member'),
  ('a9b00000-0000-0000-0000-0000000000c2', 'a9b00000-0000-0000-0000-000000000005', 'member'),
  ('a9b00000-0000-0000-0000-0000000000c4', 'a9b00000-0000-0000-0000-000000000008', 'owner')
  on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.community_members (community_id, user_id, role) values (:'mom', 'a9b00000-0000-0000-0000-000000000005', 'member')
  on conflict (community_id, user_id) do nothing;
insert into public.community_posts (id, community_id, author_id, body) values
  ('a9b00000-0000-0000-0000-0000000000a1', 'a9b00000-0000-0000-0000-0000000000c2', 'a9b00000-0000-0000-0000-000000000005', 'Nina: brunch on Friday?'),
  ('a9b00000-0000-0000-0000-0000000000a2', 'a9b00000-0000-0000-0000-0000000000c1', 'a9b00000-0000-0000-0000-000000000006', 'Max: padel tonight');
select private.ensure_conversation('community', 'a9b00000-0000-0000-0000-0000000000c1', 'Test official mixte') as chat_m \gset
select private.ensure_conversation('community', 'a9b00000-0000-0000-0000-0000000000c2', 'Test official girl') as chat_g \gset
insert into public.conversation_members (conversation_id, user_id) values
  (:'chat_m', 'a9b00000-0000-0000-0000-000000000006'), (:'chat_g', 'a9b00000-0000-0000-0000-000000000005')
  on conflict do nothing;

-- ───────── 1. Publishing as IRLY ─────────
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'Welcome to the mixte community', 'a9b00000-0000-0000-0000-0000000000b1') as p_m \gset
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'Welcome to IRLY Girl')$$) = '42501',
  'the owner of the back office, a man, does not publish in IRLY Girl (isolation holds for staff)');
select pg_temp.check(pg_temp.fails(format('select public.irly_post(%L, %L)', :'mom', 'Welcome, moms')) = '42501', 'nor in Mom');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'Welcome to IRLY Girl', 'a9b00000-0000-0000-0000-0000000000b2') as p_g \gset
select public.irly_post(:'mom', 'Welcome, moms', 'a9b00000-0000-0000-0000-0000000000b3') as p_w \gset
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'Welcome to the mixte community', 'a9b00000-0000-0000-0000-0000000000b1')
  = 'a9b00000-0000-0000-0000-0000000000b1', 'a retry with the same id is the same post');
select pg_temp.as_admin();
select pg_temp.check((select as_irly and author_id = 'a9b00000-0000-0000-0000-000000000001' and kind = 'post' from public.community_posts where id = :'p_m'),
  'the owner publishes signed IRLY in the mixte official community (author kept for accountability)');
select pg_temp.check((select count(*) = 2 from public.community_posts
  where id in (:'p_g', :'p_w') and as_irly and author_id = 'a9b00000-0000-0000-0000-000000000002'),
  'an admin with IRLY Girl access publishes signed IRLY in the IRLY Girl and Mom official communities');
select pg_temp.check((select count(*) = 1 from private.admin_audit where action = 'irly.post' and actor = 'a9b00000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from private.admin_audit where action = 'irly.post' and actor = 'a9b00000-0000-0000-0000-000000000002'),
  'each IRLY post is in the staff journal');
select pg_temp.check((select count(*) = 1 from public.community_audit where action = 'irly.post' and target_id = :'p_m'),
  'and in the community journal');
select pg_temp.check(not exists (select 1 from public.community_members where user_id = 'a9b00000-0000-0000-0000-000000000001'),
  'publishing as IRLY joins nothing');

-- The notice to the members says IRLY, not the person.
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'a9b00000-0000-0000-0000-000000000006'
  and kind = 'COMMUNITY_POST' and payload ->> 'post_id' = :'p_m' and payload ->> 'as_irly' = 'true' and not payload ? 'from'),
  'the COMMUNITY_POST notice of an IRLY post has no person in it');

-- A photo post from the caller's own uploads.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'Photos of the meetup', null,
  array['a9b00000-0000-0000-0000-000000000003/1.jpg', 'a9b00000-0000-0000-0000-000000000003/2.jpg'], 'photo') as p_photo \gset
select pg_temp.check((select media_kind = 'photo' and cardinality(media_paths) = 2 and as_irly from public.community_posts where id = :'p_photo'),
  'the content role publishes photos signed IRLY in the mixte community');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'x', null, array['a9b00000-0000-0000-0000-000000000006/x.jpg'], 'photo')$$) = '42501',
  'only one''s own files');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'Hello girls')$$) = '42501',
  'the content role (a man) does not publish in IRLY Girl');

select pg_temp.as_user('a9b00000-0000-0000-0000-000000000007');
select pg_temp.check(public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'Hello from the team') is not null,
  'the content role with IRLY Girl access of her own publishes in IRLY Girl');

select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('a9b00000-0000-0000-0000-000000000002', 'test');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'Admins too')$$) = '42501',
  'the same admin with her IRLY Girl access paused is refused at once');
select pg_temp.as_admin();
delete from public.girl_suspensions where user_id = 'a9b00000-0000-0000-0000-000000000002';

-- Nobody else.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'Moderator here')$$) = '42501',
  'a moderator of the back office does not sign as IRLY');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'I am IRLY')$$) = '42501', 'a member: irly_post refused');
select pg_temp.check(pg_temp.fails($$select public.irly_announce('a9b00000-0000-0000-0000-0000000000c1', 'I am IRLY')$$) = '42501', 'a member: irly_announce refused');
select pg_temp.check(pg_temp.fails($$select public.irly_chat_message('a9b00000-0000-0000-0000-0000000000c1', 'I am IRLY')$$) = '42501', 'a member: irly_chat_message refused');
select pg_temp.check(pg_temp.fails($$select public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a2', true)$$) = '42501', 'a member: irly_pin_post refused');
select pg_temp.check(pg_temp.fails(format($$insert into public.community_posts (community_id, author_id, body, as_irly)
  values ('a9b00000-0000-0000-0000-0000000000c1', 'a9b00000-0000-0000-0000-000000000006', 'Signed IRLY', true)$$)) = '42501',
  'a member cannot write a post signed IRLY directly');
select pg_temp.check(pg_temp.fails($$update public.community_posts set as_irly = true where id = 'a9b00000-0000-0000-0000-0000000000a2'$$) = '42501',
  'nor turn his own post into one');
select pg_temp.check(pg_temp.fails(format($$insert into public.messages (conversation_id, sender_id, body, as_irly)
  values (%L, 'a9b00000-0000-0000-0000-000000000006', 'Signed IRLY', true)$$, :'chat_m')) = '42501',
  'nor a chat message signed IRLY');
select pg_temp.check(pg_temp.fails(format($$insert into public.messages (conversation_id, sender_id, body)
  values (%L, null, 'IRLY note')$$, :'chat_m')) is not null,
  'nor a message without a sender');

-- A member's own community: only the moderation that exists.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c4', 'Hello from IRLY')$$) = '42501',
  'no post signed IRLY in a community created by a member');
select pg_temp.check(pg_temp.fails($$select public.irly_chat_message('a9b00000-0000-0000-0000-0000000000c4', 'Hello from IRLY')$$) = '42501',
  'nor a chat message signed IRLY there');

-- Announcements: the community's quota holds, the notices say IRLY.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(public.irly_announce('a9b00000-0000-0000-0000-0000000000c1', 'Meetup on Saturday at the marina', 'event', true) = 1,
  'the content role announces in the mixte community (one member notified)');
select pg_temp.as_admin();
select id as ann from public.community_posts where community_id = 'a9b00000-0000-0000-0000-0000000000c1' and kind = 'announcement' \gset
select pg_temp.check((select as_irly from public.community_posts where id = :'ann')
  and exists (select 1 from public.community_pins where post_id = :'ann'),
  'the announcement is signed IRLY and pinned');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'a9b00000-0000-0000-0000-000000000006'
  and kind = 'COMMUNITY_ANNOUNCEMENT' and payload ->> 'post_id' = :'ann' and payload ->> 'as_irly' = 'true' and not payload ? 'from'),
  'its notice says IRLY');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($$select public.irly_announce('a9b00000-0000-0000-0000-0000000000c1', 'A second one so soon')$$) = 'P0001',
  'one announcement per hour, IRLY included');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.irly_announce('a9b00000-0000-0000-0000-0000000000c2', 'Girls brunch this Friday')$$) = '42501',
  'the owner (a man) does not announce in IRLY Girl');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(public.irly_announce('a9b00000-0000-0000-0000-0000000000c2', 'Girls brunch this Friday', 'announcement', false) = 1,
  'the woman admin announces in IRLY Girl');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'a9b00000-0000-0000-0000-000000000005' and kind = 'COMMUNITY_ANNOUNCEMENT'
  and payload ->> 'community_id' = 'a9b00000-0000-0000-0000-0000000000c2'), 'Nina is told');

-- Pins.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a2', true), 'the content role pins a member''s post of the mixte community');
select pg_temp.check(not public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a2', false), 'and unpins it');
select pg_temp.check(pg_temp.fails($$select public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a1', true)$$) = '42501',
  'not in IRLY Girl without IRLY Girl access');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a1', true)$$) = '42501', 'nor the owner (a man)');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a1', true), 'the woman admin pins a post of IRLY Girl');

-- The chat.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select public.irly_chat_message('a9b00000-0000-0000-0000-0000000000c1', 'Hello everyone, IRLY here') as msg_m \gset
select pg_temp.as_admin();
select pg_temp.check((select sender_id is null and as_irly and kind = 'text' from public.messages where id = :'msg_m'),
  'a chat message signed IRLY has no sender');
select pg_temp.check(not exists (select 1 from public.conversation_members where user_id = 'a9b00000-0000-0000-0000-000000000003'),
  'IRLY writes in the chat without joining it');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.count_of(format('select 1 from public.messages where id = %L', :'msg_m')) = 1, 'the members read it');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(public.irly_pin_message(:'msg_m', true), 'the content role pins a chat message');
select pg_temp.check(not public.irly_pin_message(:'msg_m', false), 'and unpins it');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.irly_chat_message('a9b00000-0000-0000-0000-0000000000c2', 'Hello')$$) = '42501',
  'the owner (a man) does not write in the IRLY Girl chat');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select public.irly_chat_message('a9b00000-0000-0000-0000-0000000000c2', 'Welcome to the IRLY Girl chat') as msg_g \gset
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000005');
select pg_temp.check(pg_temp.count_of(format('select 1 from public.messages where id = %L and sender_id is null', :'msg_g')) = 1,
  'the woman admin writes in the IRLY Girl chat as IRLY; Nina reads it');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(public.irly_pin_message(:'msg_g', true), 'and pins it');

-- Rights, as the app reads them.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check((public.community_my_rights('a9b00000-0000-0000-0000-0000000000c1') ->> 'can_irly')::boolean,
  'community_my_rights: the content role may speak as IRLY in the mixte community');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(not (public.community_my_rights('a9b00000-0000-0000-0000-0000000000c1') ->> 'can_irly')::boolean, 'a member may not');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(not (public.community_my_rights('a9b00000-0000-0000-0000-0000000000c2') ->> 'can_irly')::boolean, 'the owner (a man) may not in IRLY Girl');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check((public.community_my_rights('a9b00000-0000-0000-0000-0000000000c2') ->> 'can_irly')::boolean, 'the woman admin may');
select pg_temp.check(not (public.community_my_rights('a9b00000-0000-0000-0000-0000000000c4') ->> 'can_irly')::boolean,
  'nobody speaks as IRLY in a member''s community');

-- Restrictions hold for the team member who writes.
select pg_temp.as_admin();
insert into public.community_restrictions (community_id, user_id, until, reason)
values ('a9b00000-0000-0000-0000-0000000000c1', 'a9b00000-0000-0000-0000-000000000003', now() + interval '1 day', 'test');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c1', 'While restricted')$$) = '42501',
  'a restriction in the community stops the team member too');
select pg_temp.as_admin();
delete from public.community_restrictions where user_id = 'a9b00000-0000-0000-0000-000000000003';

-- A non-staff man: refused on every road.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'a man: girl_official_communities refused');
select pg_temp.check(pg_temp.fails($$select * from public.community_posts_page('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'a man: the feed refused');
select pg_temp.check(pg_temp.fails($$select * from public.community_members_list('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'a man: the members refused');
select pg_temp.check(pg_temp.count_of($$select 1 from public.communities where id = 'a9b00000-0000-0000-0000-0000000000c2'$$) = 0, 'a man: the community row is not readable');
select pg_temp.check(pg_temp.count_of($$select 1 from public.community_posts where community_id = 'a9b00000-0000-0000-0000-0000000000c2'$$) = 0, 'a man: its posts are not readable');
select pg_temp.check(pg_temp.count_of(format('select 1 from public.messages where conversation_id = %L', :'chat_g')) = 0, 'a man: its chat is not readable');
select pg_temp.check(pg_temp.fails($$select public.join_community('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'a man: join refused');

-- ───────── 2. IRLY Girl isolation holds for a man on the staff ─────────
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.count_of($$select 1 from public.community_posts where community_id = 'a9b00000-0000-0000-0000-0000000000c2'$$) = 0,
  'the owner (a man) reads nothing of IRLY Girl');
select pg_temp.check(pg_temp.count_of(format('select 1 from public.messages where conversation_id = %L', :'chat_g')) = 0, 'nor its chat directly');
select pg_temp.check(pg_temp.fails($$select public.join_community('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'the owner cannot join IRLY Girl');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (community_id, author_id, body)
  values ('a9b00000-0000-0000-0000-0000000000c2', 'a9b00000-0000-0000-0000-000000000001', 'As myself')$$) = '42501',
  'nor post there as himself');
select pg_temp.check(pg_temp.fails(format($$insert into public.messages (conversation_id, sender_id, body)
  values (%L, 'a9b00000-0000-0000-0000-000000000001', 'As myself')$$, :'chat_g')) = '42501', 'nor message its chat as himself');
select pg_temp.check(pg_temp.fails($$insert into public.likes (user_id, target_type, target_id)
  values ('a9b00000-0000-0000-0000-000000000001', 'community_post', 'a9b00000-0000-0000-0000-0000000000a1')$$) = '42501',
  'nor react to a post');
-- An UPDATE that reads no column (no WHERE) skips the read rules and reaches
-- every row the admin rules allow, IRLY Girl's included: the guard stops it.
select pg_temp.check(pg_temp.fails($$update public.community_posts set body = 'Rewritten by staff'$$) = '42501',
  'nor rewrite the posts of IRLY Girl (an update without WHERE reaches them through the admin rules)');
select pg_temp.check(pg_temp.fails($$update public.community_posts set body = body || ' (edited)'
  where id = 'a9b00000-0000-0000-0000-0000000000a1'$$) is null, 'a targeted update reaches nothing there (read rules)');
select pg_temp.as_admin();
select pg_temp.check((select body from public.community_posts where id = 'a9b00000-0000-0000-0000-0000000000a1') = 'Nina: brunch on Friday?', 'Nina''s words are untouched');
select pg_temp.check(not exists (select 1 from public.community_members m where m.user_id in (
    'a9b00000-0000-0000-0000-000000000001', 'a9b00000-0000-0000-0000-000000000002')),
  'the staff appear in no member list');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(not public.irly_pin_post('a9b00000-0000-0000-0000-0000000000a1', false), 'the woman admin unpins in IRLY Girl');

-- ───────── 3. The IRLY Girl safety moderator: one person, read-only, journaled ─────────
select pg_temp.as_admin();
-- The staff journal lines of an action by a person (read as the server).
create or replace function pg_temp.journal_count(p_actor uuid, p_action text) returns integer language plpgsql security definer as $$
declare n integer;
begin
  select count(*) into n from private.admin_audit where actor = p_actor and action = p_action;
  return n;
end $$;

-- Nobody is designated: the owner himself (a man) is refused.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(not public.my_girl_moderation(), 'nobody designated: the owner is not the moderator');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'a non-designated owner is refused the view');
select pg_temp.check(public.admin_girl_moderator() = '{}'::jsonb, 'nobody designated yet');

-- Only the owner designates; a reason is needed; the person must be on the team.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000002', 'myself')$$) = '42501',
  'an admin cannot designate (herself or anyone)');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000004', '')$$) = '22023', 'a reason is needed');
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000006', 'a member')$$) = '42501',
  'a member who is not on the team cannot be designated');
select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000004', 'Safety reviews of IRLY Girl');
select pg_temp.check(public.admin_girl_moderator() ->> 'user_id' = 'a9b00000-0000-0000-0000-000000000004', 'the owner designates Mo (a man, moderator)');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.journal_count('a9b00000-0000-0000-0000-000000000001', 'girl.moderator_set') = 1, 'the designation is in the staff journal');
select pg_temp.check(pg_temp.fails($$insert into private.girl_moderator (user_id) values ('a9b00000-0000-0000-0000-000000000003')$$) = '23505',
  'one moderator at most, even written by hand on the server');

-- Mo reads IRLY Girl through the view, each read journaled.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000004');
select pg_temp.check(public.my_girl_moderation(), 'Mo is told he is the moderator');
select public.staff_girl_communities() as girl_list \gset
select pg_temp.check(:'girl_list'::jsonb @> '[{"id": "a9b00000-0000-0000-0000-0000000000c2"}]'
  and not (:'girl_list'::jsonb @> '[{"id": "a9b00000-0000-0000-0000-0000000000c1"}]'),
  'the moderator lists the IRLY Girl communities (and only them)');
select public.staff_girl_community('a9b00000-0000-0000-0000-0000000000c2') as girl_page \gset
select pg_temp.check((:'girl_page'::jsonb -> 'posts') @> '[{"id": "a9b00000-0000-0000-0000-0000000000a1"}]'
  and (:'girl_page'::jsonb -> 'members') @> '[{"first_name": "Nina"}]'
  and (:'girl_page'::jsonb -> 'posts') @> '[{"first_name": "IRLY", "as_irly": true}]',
  'and opens one: posts (IRLY''s signed IRLY), members');
select pg_temp.check(jsonb_array_length(public.staff_girl_chat('a9b00000-0000-0000-0000-0000000000c2')) >= 1, 'its chat (IRLY''s own community)');
select pg_temp.check(jsonb_typeof(public.staff_girl_activities()) = 'array', 'IRLY Girl activities');
select pg_temp.check(pg_temp.fails($$select public.staff_girl_community('a9b00000-0000-0000-0000-0000000000c1')$$) = '22023',
  'the view is for IRLY Girl communities only');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.journal_count('a9b00000-0000-0000-0000-000000000004', 'girl.view') = 4, 'each of the four reads wrote one journal line');
select pg_temp.check(exists (select 1 from private.admin_audit where actor = 'a9b00000-0000-0000-0000-000000000004' and action = 'girl.view'
  and details ->> 'kind' = 'community' and details ->> 'id' = 'a9b00000-0000-0000-0000-0000000000c2' and at <= now()),
  'with who, what and when');

-- Read-only: the designation opens nothing else.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.count_of($$select 1 from public.community_posts where community_id = 'a9b00000-0000-0000-0000-0000000000c2'$$) = 0,
  'the moderator reads no IRLY Girl table directly (every read is journaled)');
select pg_temp.check(pg_temp.fails($$select public.join_community('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'the moderator cannot join');
select pg_temp.check(pg_temp.fails($$insert into public.community_posts (community_id, author_id, body)
  values ('a9b00000-0000-0000-0000-0000000000c2', 'a9b00000-0000-0000-0000-000000000004', 'Hi')$$) = '42501', 'nor post');
select pg_temp.check(pg_temp.fails(format($$insert into public.messages (conversation_id, sender_id, body)
  values (%L, 'a9b00000-0000-0000-0000-000000000004', 'Hi')$$, :'chat_g')) = '42501', 'nor message');
select pg_temp.check(pg_temp.fails($$insert into public.likes (user_id, target_type, target_id)
  values ('a9b00000-0000-0000-0000-000000000004', 'community_post', 'a9b00000-0000-0000-0000-0000000000a1')$$) = '42501', 'nor react');
select pg_temp.check(pg_temp.fails($$select public.irly_post('a9b00000-0000-0000-0000-0000000000c2', 'As IRLY')$$) = '42501',
  'nor publish as IRLY there (he is not of the content team, and has no IRLY Girl access)');
select pg_temp.check(not private.girl_eligible_unchecked('a9b00000-0000-0000-0000-000000000004'), 'the designation gives no IRLY Girl access (never matched or listed)');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.community_members where user_id = 'a9b00000-0000-0000-0000-000000000004'), 'he appears in no member list');

-- Everyone else stays refused: a second staff man, the owner.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'a second staff man is refused');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails($$select public.staff_girl_community('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'the owner, not designated, is refused');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'a member man is refused');
select pg_temp.check(pg_temp.fails('select public.admin_girl_moderator()') = '42501', 'and cannot see who the moderator is');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.journal_count('a9b00000-0000-0000-0000-000000000003', 'girl.view') = 0
  and pg_temp.journal_count('a9b00000-0000-0000-0000-000000000001', 'girl.view') = 0, 'refused reads write nothing');

-- Changing the moderator: the previous one loses the view at once; leaving the team ends it too.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000001', 'The owner takes it over');
select pg_temp.check(jsonb_typeof(public.staff_girl_communities()) = 'array', 'the owner, once designated, opens the view');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'Mo, replaced, is refused');
select pg_temp.as_admin();
select pg_temp.check((select count(*) = 1 from private.girl_moderator), 'still one designation');
select pg_temp.check(pg_temp.journal_count('a9b00000-0000-0000-0000-000000000001', 'girl.moderator_removed') = 1, 'the replacement is journaled');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select public.admin_set_girl_moderator('a9b00000-0000-0000-0000-000000000003', 'Cleo for the reviews');
select pg_temp.as_admin();
delete from public.staff_roles where user_id = 'a9b00000-0000-0000-0000-000000000003';
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails('select public.staff_girl_communities()') = '42501', 'a moderator who leaves the team loses the view');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000001');
select public.admin_set_girl_moderator(null, 'Nobody for now');
select pg_temp.check(public.admin_girl_moderator() = '{}'::jsonb, 'the owner removes the designation');

-- ───────── 4. Selfie verification: off until IRLY Girl has its threshold of members ─────────
select pg_temp.as_admin();
delete from private.girl_settings;
insert into auth.users (id) values ('a9b00000-0000-0000-0000-000000000009'), ('a9b00000-0000-0000-0000-000000000010');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('a9b00000-0000-0000-0000-000000000009', 'Uma', '1995-01-01', 'woman', 'dubai'),
  ('a9b00000-0000-0000-0000-000000000010', 'Vera', '1995-01-01', 'woman', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id in ('a9b00000-0000-0000-0000-000000000009', 'a9b00000-0000-0000-0000-000000000010');
-- Unverified (irly_test.sql, run before on the same database, verifies every new woman by itself).
delete from public.verification_requests where user_id in ('a9b00000-0000-0000-0000-000000000009', 'a9b00000-0000-0000-0000-000000000010');
update public.profiles set verified_at = null where id in ('a9b00000-0000-0000-0000-000000000009', 'a9b00000-0000-0000-0000-000000000010');
select pg_temp.check(not private.identity_verified('a9b00000-0000-0000-0000-000000000009'), 'Uma and Vera are not verified');
-- Below the threshold (auto): an unverified woman is admitted, a man is not.
insert into private.girl_settings (key, value) values ('selfie_threshold', (private.girl_member_count() + 2)::text);
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000009');
select pg_temp.check(not public.girl_selfie_required(), 'auto, below the threshold: selfie verification not required');
select pg_temp.check(public.my_girl_status() = 'open', 'an unverified woman is admitted below the threshold');
select pg_temp.check(public.join_community('a9b00000-0000-0000-0000-0000000000c2') is not null, 'and joins an IRLY Girl community');
select pg_temp.check(pg_temp.count_of($$select 1 from public.community_posts where id = 'a9b00000-0000-0000-0000-0000000000a1'$$) = 1, 'and reads it');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'girl.unverified_joined'
  and target_user = 'a9b00000-0000-0000-0000-000000000009' and details ->> 'id' = 'a9b00000-0000-0000-0000-0000000000c2'),
  'her admission is in the staff journal for the safety moderator');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(public.my_girl_status() = 'not_eligible' and not private.is_girl_eligible(), 'a man is refused (auto, below the threshold)');
select pg_temp.check(pg_temp.fails($$select public.join_community('a9b00000-0000-0000-0000-0000000000c2')$$) = '42501', 'and cannot join');

-- The threshold is reached: required from now on, latched.
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000010');
select public.join_community('a9b00000-0000-0000-0000-0000000000c2');
select pg_temp.check(public.girl_selfie_required(), 'the threshold reached: selfie verification required');
select pg_temp.check(public.my_girl_status() = 'needs_verification', 'Vera, unverified, is asked to verify (not an error)');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000009');
select pg_temp.check(public.my_girl_status() = 'needs_verification' and not private.is_girl_eligible(), 'so is Uma, who was admitted before');
select pg_temp.check(pg_temp.count_of($$select 1 from public.community_posts where id = 'a9b00000-0000-0000-0000-0000000000a1'$$) = 0, 'and she reads nothing until verified');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000005');
select pg_temp.check(public.my_girl_status() = 'open', 'a verified woman is not affected');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'girl.selfie_required'), 'the switch is journaled');
delete from public.community_members where user_id = 'a9b00000-0000-0000-0000-000000000010';
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000009');
select pg_temp.check(public.girl_selfie_required(), 'members leaving do not switch it off again');

-- Overrides, by IRLY admins only.
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_selfie_mode('off')$$) = '42501', 'a member cannot change the mode');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000003');
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_selfie_mode('off')$$) = '42501', 'nor the content role');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select public.admin_set_girl_selfie_mode('off');
select pg_temp.check((public.admin_girl_selfie() ->> 'mode') = 'off', 'an admin turns it off');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000009');
select pg_temp.check(public.my_girl_status() = 'open', 'off: the unverified woman is admitted again');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(not private.is_girl_eligible(), 'off: a man is still refused');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select public.admin_set_girl_selfie_mode('on');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000009');
select pg_temp.check(public.my_girl_status() = 'needs_verification', 'on: she is asked to verify');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000006');
select pg_temp.check(not private.is_girl_eligible(), 'on: a man is refused');
select pg_temp.as_user('a9b00000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.fails($$select public.admin_set_girl_selfie_mode('maybe')$$) = '22023', 'auto, on or off only');
select pg_temp.as_admin();
select pg_temp.check((select count(*) = 2 from private.admin_audit where action = 'girl.selfie_mode' and actor = 'a9b00000-0000-0000-0000-000000000002'),
  'each change of mode is journaled');

rollback;
