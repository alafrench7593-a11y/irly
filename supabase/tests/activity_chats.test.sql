-- Activities proposed in communities, shared into chats as live cards, and
-- their own chats (20261028200000_irly_activity_chats + what it reuses).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c0ac0000-….
--
--   a1 Lina   woman: owns « Marina Padel Crew » (Mixte) and « Marina Girls Yoga » (IRLY Girl), organises
--   a2 Omar   man: member of the Mixte community, joins and leaves
--   a3 Sara   woman: member of both communities
--   a4 Theo   man: in no community (the unauthorised account)
--   a5 Yara   woman: in the Mixte community, finds the plan full
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
    raise exception 'FAIL activity_chats: %', label;
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
-- Rows a statement changed (0 when row level security hid every row).
create or replace function pg_temp.changed(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────── Test accounts (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('c0ac0000-0000-0000-0000-0000000000a1'), ('c0ac0000-0000-0000-0000-0000000000a2'),
  ('c0ac0000-0000-0000-0000-0000000000a3'), ('c0ac0000-0000-0000-0000-0000000000a4'),
  ('c0ac0000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c0ac0000-0000-0000-0000-0000000000a1', 'Lina', '1992-02-02', 'woman', 'dubai'),
  ('c0ac0000-0000-0000-0000-0000000000a2', 'Omar', '1990-04-04', 'man', 'dubai'),
  ('c0ac0000-0000-0000-0000-0000000000a3', 'Sara', '1994-06-06', 'woman', 'dubai'),
  ('c0ac0000-0000-0000-0000-0000000000a4', 'Theo', '1989-08-08', 'man', 'dubai'),
  ('c0ac0000-0000-0000-0000-0000000000a5', 'Yara', '1996-10-10', 'woman', 'dubai');
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ───────── Two communities, as the app makes them ─────────
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
insert into ids values ('mixte', public.create_community('Marina Padel Crew', 'dubai', 'Padel at the Marina', null, 'sport', false));
insert into ids values ('girl', public.create_community('Marina Girls Yoga', 'dubai', 'Sunrise yoga', null, 'sport', true));
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select public.join_community((select v from ids where k = 'mixte'));
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select public.join_community((select v from ids where k = 'mixte'));
select public.join_community((select v from ids where k = 'girl'));
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select public.join_community((select v from ids where k = 'mixte'));
select pg_temp.as_admin();
insert into ids values ('mixte_chat', (select id from public.conversations where community_id = (select v from ids where k = 'mixte')));
insert into ids values ('girl_chat', (select id from public.conversations where community_id = (select v from ids where k = 'girl')));

-- ═════════════ B. Proposed from a community: one record, linked ═════════════
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
-- « + Propose an activity » in the community: the Create form, attached to it (privacy 'community').
insert into public.activities (id, creator_id, title, description, category_id, city_id, area_id, place_name, starts_at, ends_at,
  price_minor, currency, capacity, privacy, community_id, client_ref)
values ('c0ac0000-0000-0000-0000-0000000000b1', 'c0ac0000-0000-0000-0000-0000000000a1', 'Padel doubles', 'Two courts booked', 'sport', 'dubai', 'marina',
  'Marina Padel Club', date_trunc('day', now() + interval '3 days') + interval '14 hours', date_trunc('day', now() + interval '3 days') + interval '16 hours',
  5000, 'AED', 3, 'community', (select v from ids where k = 'mixte'), 'c0ac0000-0000-0000-0000-0000000000e1');
select pg_temp.check((select community_id from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1') = (select v from ids where k = 'mixte'),
  'link: the activity names its origin community (one record, community_id)');
select pg_temp.check((select count(*) from public.activities where title = 'Padel doubles') = 1, 'link: one central record, no copy');
select pg_temp.check((select timezone from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1') = 'Asia/Dubai'
  and (select to_char(starts_at at time zone 'Asia/Dubai', 'HH24:MI') from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1') = '18:00',
  'time zone: 14:00 UTC is stored as an instant and reads 18:00 in Dubai');
select pg_temp.check(exists (select 1 from public.community_activity_cards((select v from ids where k = 'mixte'))
  where id = 'c0ac0000-0000-0000-0000-0000000000b1' and community_name = 'Marina Padel Crew' and status = 'upcoming' and going = 1 and capacity = 3
    and price_minor = 5000 and creator_name = 'Lina' and place_name = 'Marina Padel Club' and my_status = 'going' and conversation_id is not null),
  'community feed: the organiser sees its card (photo, place, price, organiser, 1/3 going, open, her chat)');
select pg_temp.check(exists (select 1 from public.community_activities((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1'),
  'Activities tab: listed');
-- Someone outside the community cannot attach a plan to it.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values ('c0ac0000-0000-0000-0000-0000000000a4', 'Gatecrash', 'sport', 'dubai', 'marina', now() + interval '2 days', (select v from ids where k = 'mixte'))$$) = '42501',
  'link: a non-member cannot attach an activity to the community');
-- From the general Create form: a member attaches an existing plan to her community later (activity_guard checks membership).
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy)
values ('c0ac0000-0000-0000-0000-0000000000b2', 'c0ac0000-0000-0000-0000-0000000000a3', 'Beach volley', 'sport', 'dubai', 'jumeirah', now() + interval '4 days', 'public');
select pg_temp.check(pg_temp.changed($$update public.activities set community_id = (select v from ids where k = 'mixte') where id = 'c0ac0000-0000-0000-0000-0000000000b2'$$) = 1,
  'general section: a member attaches her own plan to her community');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('c0ac0000-0000-0000-0000-0000000000b9', 'c0ac0000-0000-0000-0000-0000000000a4', 'Theo run', 'sport', 'dubai', 'jumeirah', now() + interval '4 days')$$) is null
  and pg_temp.fails($$update public.activities set community_id = (select v from ids where k = 'mixte') where id = 'c0ac0000-0000-0000-0000-0000000000b9'$$) = '42501',
  'general section: a non-member cannot attach his plan to the community');

-- Visibility: community members see it (feed, central list), others do not (direct link, API, cards).
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1'), 'member: in the central activities (API)');
select pg_temp.check(exists (select 1 from public.activity_detail('c0ac0000-0000-0000-0000-0000000000b1')), 'member: the activity page opens');
select pg_temp.check(exists (select 1 from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1' and my_status is null and conversation_id is null),
  'member: the card in the community feed, not joined, no chat yet');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1'), 'outsider: not in the activities (API)');
select pg_temp.check(not exists (select 1 from public.activity_detail('c0ac0000-0000-0000-0000-0000000000b1')), 'outsider: direct link shows nothing');
select pg_temp.check(not exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b1'::uuid])), 'outsider: no card');
select pg_temp.check(not exists (select 1 from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1')
  and exists (select 1 from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b2'),
  'outsider: in the community feed, the members-only plan is hidden, the public one shows');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0ac0000-0000-0000-0000-0000000000b1')$$) = 'P0002', 'outsider: cannot join by id');

-- ═════════════ C. Joining: once, capacity, the activity chat ═════════════
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(public.join_activity('c0ac0000-0000-0000-0000-0000000000b1') = 'going', 'Omar: joins');
select pg_temp.check(public.join_activity('c0ac0000-0000-0000-0000-0000000000b1') = 'going', 'Omar: a second tap is harmless');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.activity_participants where activity_id = 'c0ac0000-0000-0000-0000-0000000000b1'
  and user_id = 'c0ac0000-0000-0000-0000-0000000000a2') = 1, 'no duplicate participation: one row');
select pg_temp.check(pg_temp.fails($$insert into public.activity_participants (activity_id, user_id) values ('c0ac0000-0000-0000-0000-0000000000b1', 'c0ac0000-0000-0000-0000-0000000000a2')$$) = '23505',
  'no duplicate participation: the primary key refuses a second row');
select pg_temp.check((select count(*) from public.notifications where user_id = 'c0ac0000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_JOINED'
  and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1') = 1, 'join confirmation: the organiser is told once');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check(public.join_activity('c0ac0000-0000-0000-0000-0000000000b1') = 'going', 'Sara: joins (3/3)');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_activity('c0ac0000-0000-0000-0000-0000000000b1') = 'full', 'capacity: Yara finds it full');
select pg_temp.check((select going = 3 and capacity = 3 and my_status is null from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b1'::uuid])),
  'capacity: the card says 3/3 (full) and Yara is not in');
select pg_temp.check(not exists (select 1 from public.conversations where activity_id = 'c0ac0000-0000-0000-0000-0000000000b1'),
  'capacity: Yara does not get the activity chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.conversations where activity_id = 'c0ac0000-0000-0000-0000-0000000000b1') = 1, 'activity chat: exactly one');
select pg_temp.check(pg_temp.fails($$insert into public.conversations (kind, activity_id, title) values ('activity', 'c0ac0000-0000-0000-0000-0000000000b1', 'Second')$$) = '23505',
  'activity chat: unique per activity (a second one is refused)');
insert into ids values ('act_chat', (select id from public.conversations where activity_id = 'c0ac0000-0000-0000-0000-0000000000b1'));
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = (select v from ids where k = 'act_chat')) = 3,
  'activity chat: organiser + the two going');
-- The Activities tab counts like the page (it counted only the rows the reader could see).
insert into public.safety_settings (user_id, activity_visibility) values ('c0ac0000-0000-0000-0000-0000000000a3', 'nobody')
on conflict (user_id) do update set activity_visibility = 'nobody';
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select pg_temp.check((select going from public.community_activities((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1') = 3,
  'Activities tab: 3 going, Sara who hides her plans included (same count as the page)');
select pg_temp.check((select going from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1') = 3,
  'community feed card: 3 going too');

-- Participant-only chat access (RLS).
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, kind, body) values ((select v from ids where k = 'act_chat'), 'c0ac0000-0000-0000-0000-0000000000a2', 'text', 'I bring the balls');
select pg_temp.check(exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'act_chat') and body = 'I bring the balls'), 'participant: writes and reads the activity chat');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = (select v from ids where k = 'act_chat')::text) = 2
  and not exists (select 1 from public.notifications where kind = 'MESSAGE_CREATED' and payload ->> 'conversation_id' = (select v from ids where k = 'act_chat')::text
    and user_id in ('c0ac0000-0000-0000-0000-0000000000a2', 'c0ac0000-0000-0000-0000-0000000000a5', 'c0ac0000-0000-0000-0000-0000000000a4')),
  'activity chat message: notified to the other participants only (not the sender, not Yara, not Theo)');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select pg_temp.check(not exists (select 1 from public.conversations where id = (select v from ids where k = 'act_chat')), 'not a participant: the chat is invisible');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'act_chat')), 'not a participant: its messages are invisible');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, kind, body) values ((select v from ids where k = 'act_chat'), 'c0ac0000-0000-0000-0000-0000000000a5', 'text', 'let me in')$$) is not null,
  'not a participant: cannot write into it');
select pg_temp.check(pg_temp.fails($$insert into public.conversation_members (conversation_id, user_id) values ((select v from ids where k = 'act_chat'), 'c0ac0000-0000-0000-0000-0000000000a5')$$) is not null,
  'not a participant: cannot add herself to it');

-- Leaving the activity removes that chat only, never the community chat.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select public.leave_activity('c0ac0000-0000-0000-0000-0000000000b1');
select pg_temp.check(not exists (select 1 from public.conversations where id = (select v from ids where k = 'act_chat')), 'left: the activity chat is gone for Omar');
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'act_chat')), 'left: its messages too');
select pg_temp.check(exists (select 1 from public.conversations where id = (select v from ids where k = 'mixte_chat')), 'left: the community chat stays');
select pg_temp.check((select my_status is null and conversation_id is null and going = 2 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b1'::uuid])),
  'left: the card says not joined, no chat, 2 going');
-- Yara takes the spot that was released.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select pg_temp.check(public.join_activity('c0ac0000-0000-0000-0000-0000000000b1') = 'going', 'capacity: the released spot can be taken');

-- ═════════════ D. Shared into a chat: a live card ═════════════
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
insert into ids values ('share1', public.share_to_chat((select v from ids where k = 'mixte_chat'), 'activity', 'c0ac0000-0000-0000-0000-0000000000b1', 'Padel doubles'));
select pg_temp.check((select kind = 'share' and ref_type = 'activity' and ref_id = 'c0ac0000-0000-0000-0000-0000000000b1' from public.messages where id = (select v from ids where k = 'share1')),
  'share: a structured message pointing at the activity id');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(exists (select 1 from public.messages where id = (select v from ids where k = 'share1')), 'share: Omar receives it in the community chat');
select pg_temp.check((select title = 'Padel doubles' from public.activity_cards(array[(select ref_id from public.messages where id = (select v from ids where k = 'share1'))])),
  'share: the card reads the live activity');
-- Theo cannot share what he cannot see, and cannot see the card.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.check(pg_temp.fails($$select public.share_to_chat((select v from ids where k = 'mixte_chat'), 'activity', 'c0ac0000-0000-0000-0000-0000000000b1', 'x')$$) is not null,
  'share: someone who cannot see the activity cannot share it');
-- A friends-only plan shared into a group: the members who are not her friends see « not available ».
select pg_temp.as_admin();
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('c0ac0000-0000-0000-0000-0000000000a1', 'c0ac0000-0000-0000-0000-0000000000a3', 'c0ac0000-0000-0000-0000-0000000000a1', 'accepted', now());
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy)
values ('c0ac0000-0000-0000-0000-0000000000b3', 'c0ac0000-0000-0000-0000-0000000000a1', 'Friends dinner', 'food', 'dubai', 'marina', now() + interval '5 days', 'friends');
select public.share_to_chat((select v from ids where k = 'mixte_chat'), 'activity', 'c0ac0000-0000-0000-0000-0000000000b3', 'Friends dinner');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b3'::uuid])), 'friends-only: her friend Sara sees the card');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b3'::uuid])), 'friends-only: Omar gets no card (« not available »)');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0ac0000-0000-0000-0000-0000000000b3')$$) = 'P0002', 'friends-only: and cannot join it from the chat');

-- IRLY Girl: a women-only plan never reaches anyone without IRLY Girl access.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy, community_id)
values ('c0ac0000-0000-0000-0000-0000000000b4', 'c0ac0000-0000-0000-0000-0000000000a1', 'Sunrise yoga', 'sport', 'dubai', 'marina', now() + interval '2 days', 'community',
  (select v from ids where k = 'girl'));
select pg_temp.check((select girl_only from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b4'), 'Girl community: its activity is women-only (server)');
select pg_temp.check(pg_temp.fails($$update public.activities set girl_only = false where id = 'c0ac0000-0000-0000-0000-0000000000b4'$$) = '42501',
  'Girl community: the organiser cannot open it to everyone');
select pg_temp.check(pg_temp.fails($$select public.share_to_chat((select v from ids where k = 'mixte_chat'), 'activity', 'c0ac0000-0000-0000-0000-0000000000b4', 'Sunrise yoga')$$) = '42501',
  'Girl: cannot be shared into a Mixte chat (men in it)');
select pg_temp.check(pg_temp.fails($$insert into public.messages (conversation_id, sender_id, kind, body, ref_id) values ((select v from ids where k = 'mixte_chat'),
  'c0ac0000-0000-0000-0000-0000000000a1', 'activity', 'Sunrise yoga', 'c0ac0000-0000-0000-0000-0000000000b4')$$) = '42501',
  'Girl: nor written into it as a plan card through the API');
insert into ids values ('girlshare', public.share_to_chat((select v from ids where k = 'girl_chat'), 'activity', 'c0ac0000-0000-0000-0000-0000000000b4', 'Sunrise yoga'));
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.messages where id = (select v from ids where k = 'girlshare'))
  and exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b4'::uuid]) where girl_only),
  'Girl: shared in the IRLY Girl community chat, Sara sees the message and the card');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b4'::uuid])), 'Girl: Omar gets no card (API)');
select pg_temp.check(not exists (select 1 from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b4'), 'Girl: Omar cannot read it (API)');
select pg_temp.check(not exists (select 1 from public.activity_detail('c0ac0000-0000-0000-0000-0000000000b4')), 'Girl: Omar, direct link: nothing');
select pg_temp.check(not exists (select 1 from public.messages where id = (select v from ids where k = 'girlshare')), 'Girl: Omar cannot read the share message');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0ac0000-0000-0000-0000-0000000000b4')$$) is not null, 'Girl: Omar cannot join');
-- Even a man left inside an IRLY Girl chat (a membership from before a rule) reads neither the message nor the card.
select pg_temp.as_admin();
insert into public.conversation_members (conversation_id, user_id) values ((select v from ids where k = 'girl_chat'), 'c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a4');
select pg_temp.check(not exists (select 1 from public.messages where id = (select v from ids where k = 'girlshare'))
  and not exists (select 1 from public.messages where conversation_id = (select v from ids where k = 'girl_chat')),
  'Girl: a non-eligible member of the Girl chat reads no message there');
select pg_temp.check(not exists (select 1 from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b4'::uuid])), 'Girl: and no card');
select pg_temp.as_admin();
delete from public.conversation_members where conversation_id = (select v from ids where k = 'girl_chat') and user_id = 'c0ac0000-0000-0000-0000-0000000000a4';

-- ═════════════ E. Edits and cancellation, everywhere, notified once ═════════════
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.changed($$update public.activities set place_name = 'Hijack' where id = 'c0ac0000-0000-0000-0000-0000000000b1'$$) = 0, 'non-organiser: cannot edit (0 rows)');
select pg_temp.check(pg_temp.changed($$update public.activities set cancelled_at = now() where id = 'c0ac0000-0000-0000-0000-0000000000b1'$$) = 0, 'non-organiser: cannot cancel (0 rows)');
select pg_temp.check(pg_temp.fails($$select public.delete_activity('c0ac0000-0000-0000-0000-0000000000b1')$$) = 'P0002', 'non-organiser: cannot delete');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.changed($$update public.activities set starts_at = starts_at + interval '1 hour' where id = 'c0ac0000-0000-0000-0000-0000000000b1'$$) = 0,
  'a participant: cannot move it either');

select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
update public.activities set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour' where id = 'c0ac0000-0000-0000-0000-0000000000b1';
update public.activities set place_name = 'Marina Padel Club, court 3' where id = 'c0ac0000-0000-0000-0000-0000000000b1';
update public.activities set price_minor = 6000 where id = 'c0ac0000-0000-0000-0000-0000000000b1';
select pg_temp.as_admin();
select pg_temp.check((select count(*) filter (where read_at is null) = 1 and count(*) = 2 from public.notifications where kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1' and user_id = 'c0ac0000-0000-0000-0000-0000000000a3'),
  'notifications: a time change then a place change: each one noticed, one unread for Sara (the earlier one superseded)');
select pg_temp.check((select count(*) filter (where read_at is null) from public.notifications where kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1' and user_id = 'c0ac0000-0000-0000-0000-0000000000a5') = 1,
  'notifications: one unread for Yara');
select pg_temp.check((select count(*) from public.notifications where kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1') = 4,
  'notifications: the price change alone notifies nobody (only date, time and place do)');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1'
  and user_id in ('c0ac0000-0000-0000-0000-0000000000a1', 'c0ac0000-0000-0000-0000-0000000000a2', 'c0ac0000-0000-0000-0000-0000000000a4')),
  'notifications: never to the organiser, to Omar who left, or to Theo');
select pg_temp.check((select (payload ->> 'starts_at')::timestamptz from public.notifications where kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1' and user_id = 'c0ac0000-0000-0000-0000-0000000000a3' and read_at is null)
  = (select starts_at from public.activities where id = 'c0ac0000-0000-0000-0000-0000000000b1'), 'notifications: the unread notice carries the latest time');
-- Opened (read), then changed again: a new unread notice (it is news again).
update public.notifications set read_at = now() where kind = 'ACTIVITY_UPDATED' and user_id = 'c0ac0000-0000-0000-0000-0000000000a3';
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
update public.activities set ends_at = ends_at + interval '30 minutes' where id = 'c0ac0000-0000-0000-0000-0000000000b1';
update public.activities set area_id = 'jbr' where id = 'c0ac0000-0000-0000-0000-0000000000b1';
select pg_temp.as_admin();
select pg_temp.check((select count(*) filter (where read_at is null) = 1 and count(*) = 4 from public.notifications where kind = 'ACTIVITY_UPDATED'
  and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1' and user_id = 'c0ac0000-0000-0000-0000-0000000000a3'),
  'notifications: later changes (end time, area) are news again, still one unread');
-- Preferences: a member who muted activity updates hears nothing.
insert into public.notification_prefs (user_id, muted_kinds) values ('c0ac0000-0000-0000-0000-0000000000a5', array['ACTIVITY_UPDATED'])
on conflict (user_id) do update set muted_kinds = excluded.muted_kinds;
delete from public.notifications where user_id = 'c0ac0000-0000-0000-0000-0000000000a5' and kind = 'ACTIVITY_UPDATED';

-- Everywhere: the card in the chat, the feed and the page read the new version.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check((select place_name = 'Marina Padel Club, court 3' and price_minor = 6000 and area_id = 'jbr' from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b1'::uuid])),
  'edit: the chat card reads the new place, area and price');
select pg_temp.check((select place_name = 'Marina Padel Club, court 3' from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1'),
  'edit: the community feed card too');
select pg_temp.check((select place_name = 'Marina Padel Club, court 3' from public.activity_detail('c0ac0000-0000-0000-0000-0000000000b1')), 'edit: and the page');

-- Cancel: the state everywhere, one notice, history kept.
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
update public.activities set cancelled_at = now() where id = 'c0ac0000-0000-0000-0000-0000000000b1';
update public.activities set cancelled_at = now() + interval '1 second' where id = 'c0ac0000-0000-0000-0000-0000000000b1';
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1'
  and payload ->> 'cancelled' = 'true' and user_id = 'c0ac0000-0000-0000-0000-0000000000a3') = 1, 'cancel: Sara is told once');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = 'c0ac0000-0000-0000-0000-0000000000b1'
  and user_id = 'c0ac0000-0000-0000-0000-0000000000a5'), 'cancel: Yara muted activity updates: nothing');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check((select status from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b1'::uuid])) = 'cancelled', 'cancel: the card says cancelled');
select pg_temp.check((select status from public.community_activity_cards((select v from ids where k = 'mixte')) where id = 'c0ac0000-0000-0000-0000-0000000000b1') = 'cancelled',
  'cancel: the community feed card says cancelled');
select pg_temp.check((select count(*) from public.messages where conversation_id = (select v from ids where k = 'act_chat')) = 2,
  'cancel: the activity chat keeps its history (the message + the cancellation note)');
select pg_temp.check(exists (select 1 from public.messages where id = (select v from ids where k = 'share1')), 'cancel: the share message stays in the community chat');
select pg_temp.check(pg_temp.fails($$select public.join_activity('c0ac0000-0000-0000-0000-0000000000b1')$$) = 'P0002', 'cancel: nobody joins a cancelled plan');

-- ═════════════ F. « Contact the organiser » follows her messaging settings ═════════════
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a1');
select pg_temp.check(not (select can_message_host from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b4'::uuid])), 'organiser: no « contact the organiser » to herself');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a3');
select pg_temp.check((select can_message_host from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b4'::uuid])), 'her friend Sara may message her');
select pg_temp.as_user('c0ac0000-0000-0000-0000-0000000000a5');
select pg_temp.check(not (select can_message_host from public.activity_cards(array['c0ac0000-0000-0000-0000-0000000000b2'::uuid])),
  'Yara (no friendship, no match): may not message Sara, the button is hidden');
select pg_temp.check(pg_temp.fails($$select public.open_direct('c0ac0000-0000-0000-0000-0000000000a3')$$) = '42501', 'and the server refuses it the same way');
