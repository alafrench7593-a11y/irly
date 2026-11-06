-- The IRLY team publishes in its official communities signed « IRLY »
-- (migration 20261109100000_irly_admin_publish). In IRLY Girl and Mom, only a
-- team member with IRLY Girl access of her own: being staff opens nothing
-- there, and IRLY Girl isolation holds for every man, staff or not.
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
  if not coalesce(ok, false) then raise exception 'FAIL admin_publish: %', label; end if;
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

rollback;
