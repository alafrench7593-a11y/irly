-- Notifications audit (owner's spec, section 16), with migration
-- 20261110100000_irly_chat_universe. For each notification: who gets it (once),
-- who never does (no Girl content for someone without IRLY Girl access, nothing
-- for a muted chat or a community turned off), its push (one per phone, none
-- for a phone that signed out or changed account, where it opens), its
-- universe, and what happens once its subject is removed.
-- Real delivery by Apple or Google cannot run here (no pg_net, no phone): the
-- push copies (push_outbox) are what would be sent.
--   a1 Lina   woman, Mixte + IRLY Girl (phone in French)
--   a2 Omar   man, Mixte (phone in English)
--   a3 Sara   mom (girls padel, mums)
--   a4 Karim  network member (founders)
-- TEST accounts only, ids prefixed c4b10000-…. Everything is rolled back.
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
    raise exception 'FAIL notifications_audit: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
-- Stored notifications and push copies of one member (read as the server).
create or replace function pg_temp.notes(uid uuid, k text) returns integer language sql security definer as $$
  select count(*)::int from public.notifications where user_id = uid and kind = k
$$;
create or replace function pg_temp.pushes(uid uuid, k text) returns integer language sql security definer as $$
  select count(*)::int from public.push_outbox o join public.notifications n on n.id = o.notification_id where o.user_id = uid and n.kind = k
$$;
create or replace function pg_temp.last_push(uid uuid, k text) returns public.push_outbox language sql security definer as $$
  select o.* from public.push_outbox o join public.notifications n on n.id = o.notification_id
  where o.user_id = uid and n.kind = k order by o.id desc limit 1
$$;

select pg_temp.as_admin();
insert into auth.users (id) values ('c4b10000-0000-0000-0000-0000000000a1'), ('c4b10000-0000-0000-0000-0000000000a2'),
  ('c4b10000-0000-0000-0000-0000000000a3'), ('c4b10000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c4b10000-0000-0000-0000-0000000000a1', 'Lina', '1994-01-01', 'woman', 'dubai'),
  ('c4b10000-0000-0000-0000-0000000000a2', 'Omar', '1990-01-01', 'man', 'dubai'),
  ('c4b10000-0000-0000-0000-0000000000a3', 'Sara', '1991-01-01', 'woman', 'dubai'),
  ('c4b10000-0000-0000-0000-0000000000a4', 'Karim', '1989-01-01', 'man', 'dubai');
insert into public.push_tokens (token, user_id, platform, lang) values
  ('ExponentPushToken[c4b-lina]', 'c4b10000-0000-0000-0000-0000000000a1', 'ios', 'fr'),
  ('ExponentPushToken[c4b-omar]', 'c4b10000-0000-0000-0000-0000000000a2', 'android', 'en'),
  ('ExponentPushToken[c4b-sara]', 'c4b10000-0000-0000-0000-0000000000a3', 'ios', 'en'),
  ('ExponentPushToken[c4b-karim]', 'c4b10000-0000-0000-0000-0000000000a4', 'ios', 'en');
insert into public.communities (id, city_id, name, created_by, girl_only, topic, category_id) values
  ('c4b10000-0000-0000-0000-0000000000f1', 'dubai', 'c4b runners', 'c4b10000-0000-0000-0000-0000000000a2', false, null, 'sport'),
  ('c4b10000-0000-0000-0000-0000000000f2', 'dubai', 'c4b girls padel', 'c4b10000-0000-0000-0000-0000000000a1', true, 'girls', 'sport'),
  ('c4b10000-0000-0000-0000-0000000000f3', 'dubai', 'c4b mums marina', 'c4b10000-0000-0000-0000-0000000000a3', true, 'moms', null),
  ('c4b10000-0000-0000-0000-0000000000f4', 'dubai', 'c4b founders', 'c4b10000-0000-0000-0000-0000000000a4', false, null, 'networking');
insert into public.community_members (community_id, user_id, role) values
  ('c4b10000-0000-0000-0000-0000000000f1', 'c4b10000-0000-0000-0000-0000000000a2', 'owner'),
  ('c4b10000-0000-0000-0000-0000000000f1', 'c4b10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4b10000-0000-0000-0000-0000000000f2', 'c4b10000-0000-0000-0000-0000000000a1', 'owner'),
  ('c4b10000-0000-0000-0000-0000000000f2', 'c4b10000-0000-0000-0000-0000000000a3', 'member'),
  ('c4b10000-0000-0000-0000-0000000000f3', 'c4b10000-0000-0000-0000-0000000000a3', 'owner'),
  ('c4b10000-0000-0000-0000-0000000000f3', 'c4b10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4b10000-0000-0000-0000-0000000000f4', 'c4b10000-0000-0000-0000-0000000000a4', 'owner'),
  ('c4b10000-0000-0000-0000-0000000000f4', 'c4b10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4b10000-0000-0000-0000-0000000000f4', 'c4b10000-0000-0000-0000-0000000000a2', 'member');
select id as k_mixte from public.conversations where community_id = 'c4b10000-0000-0000-0000-0000000000f1' \gset
select id as k_girl from public.conversations where community_id = 'c4b10000-0000-0000-0000-0000000000f2' \gset
select id as k_mom from public.conversations where community_id = 'c4b10000-0000-0000-0000-0000000000f3' \gset

-- ───────── 1. A community chat's new message ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mixte', auth.uid(), 'c4b 7am at the pier?');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED') = 1, 'runners message: Lina is told once');
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a2', 'MESSAGE_CREATED') = 0, 'never the one who wrote');
select pg_temp.check((select url = '/messages/' || :'k_mixte' and body like '%c4b 7am at the pier?' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED')),
  'its push opens that chat and quotes the message');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mixte', auth.uid(), 'c4b or 8am');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED') = 2
  and pg_temp.pushes('c4b10000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED') = 1, 'a second message within the minute: listed, not pushed twice');
-- A muted chat says nothing.
update public.conversation_members set muted = true where conversation_id = :'k_mixte' and user_id = 'c4b10000-0000-0000-0000-0000000000a1';
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mixte', auth.uid(), 'c4b muted one');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'MESSAGE_CREATED') = 2, 'Lina muted the runners chat: nothing more');
update public.conversation_members set muted = false where conversation_id = :'k_mixte' and user_id = 'c4b10000-0000-0000-0000-0000000000a1';
-- A girls padel message reaches Lina, never Omar; after her IRLY Girl access ends, not her either.
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a3');
insert into public.messages (conversation_id, sender_id, body) values (:'k_girl', auth.uid(), 'c4b court 3 tonight');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'MESSAGE_CREATED'
  and payload ->> 'conversation_id' = :'k_girl'), 'girls padel message: Lina is told');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a2'
  and payload ->> 'conversation_id' in (:'k_girl', :'k_mom')), 'Omar: never a girls chat notification');
insert into public.girl_suspensions (user_id, reason) values ('c4b10000-0000-0000-0000-0000000000a1', 'notifications audit');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a3');
insert into public.messages (conversation_id, sender_id, body) values (:'k_girl', auth.uid(), 'c4b secret girls plan');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.push_outbox where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and body like '%c4b secret girls plan%')
  and (select count(*) from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and payload ->> 'conversation_id' = :'k_girl') = 1,
  'Lina suspended: no notification, no push of a girls chat');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.check(not exists (select 1 from public.notifications where payload ->> 'conversation_id' = :'k_girl'), 'Lina suspended: her earlier girls notification is no longer readable');
select pg_temp.as_admin();
delete from public.girl_suspensions where user_id = 'c4b10000-0000-0000-0000-0000000000a1';

-- ───────── 2. A community's new post, and a mention ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.community_posts (id, community_id, author_id, body) values
  ('c4b10000-0000-0000-0000-0000000000e1', 'c4b10000-0000-0000-0000-0000000000f1', auth.uid(), 'c4b new route this week');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'COMMUNITY_POST') = 1, 'runners post: Lina is told once');
select pg_temp.check((select title = 'c4b runners' and url = '/c/c4b10000-0000-0000-0000-0000000000f1' and body = 'Omar: c4b new route this week'
  from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'COMMUNITY_POST')), 'its push: the community''s name, opening the community');
-- Posts turned off for runners: nothing.
insert into public.community_notification_prefs (user_id, community_id, posts) values ('c4b10000-0000-0000-0000-0000000000a1', 'c4b10000-0000-0000-0000-0000000000f1', false);
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.community_posts (community_id, author_id, body) values ('c4b10000-0000-0000-0000-0000000000f1', auth.uid(), 'c4b second post');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'COMMUNITY_POST') = 1, 'posts turned off for runners: no notification');
-- A mention is one notification (MENTION), not two.
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a4');
insert into public.community_posts (community_id, author_id, body, mentions) values
  ('c4b10000-0000-0000-0000-0000000000f4', auth.uid(), 'c4b welcome @Lina', array['c4b10000-0000-0000-0000-0000000000a1']::uuid[]);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'MENTION') = 1
  and not exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'COMMUNITY_POST'
                  and payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f4'), 'mentioned: Lina gets the mention only');
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a2' and kind = 'COMMUNITY_POST'
  and payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f4'), 'Omar (not mentioned) gets the post');
select pg_temp.check((select url = '/c/c4b10000-0000-0000-0000-0000000000f4' and title = 'c4b founders' and body like 'Karim t’a mentionné·e%'
  from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'MENTION')), 'the mention''s push: in French on Lina''s phone, opening founders');

-- ───────── 3. A community's new activity ─────────
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, privacy) values
  ('c4b10000-0000-0000-0000-0000000000b1', 'c4b10000-0000-0000-0000-0000000000a2', 'c4b long run', 'sport', 'dubai', 'marina', now() + interval '3 days',
   'c4b10000-0000-0000-0000-0000000000f1', 'public');
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'ACTIVITY_CREATED') = 1
  and (select url = '/a/c4b10000-0000-0000-0000-0000000000b1' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'ACTIVITY_CREATED')),
  'runners plan: Lina is told once, its push opens the plan');
insert into public.community_notification_prefs (user_id, community_id, activities) values ('c4b10000-0000-0000-0000-0000000000a1', 'c4b10000-0000-0000-0000-0000000000f4', false);
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, community_id, privacy) values
  ('c4b10000-0000-0000-0000-0000000000b2', 'c4b10000-0000-0000-0000-0000000000a4', 'c4b pitch night', 'networking', 'dubai', 'marina', now() + interval '3 days',
   'c4b10000-0000-0000-0000-0000000000f4', 'public');
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'ACTIVITY_CREATED') = 1
  and exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_CREATED'
              and payload ->> 'activity_id' = 'c4b10000-0000-0000-0000-0000000000b2'), 'founders plans turned off by Lina: not her, Omar yes');

-- ───────── 4. A pinned message notifies nobody ─────────
select count(*) as before_pin from public.notifications \gset
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
select public.pin_message((select id from public.messages where body = 'c4b 7am at the pier?'), true, null);
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications) = :before_pin, 'a pinned message: no notification (shown in the chat''s pinned banner)');

-- ───────── 5. Activities: join, change, cancel, reminder ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select public.join_activity('c4b10000-0000-0000-0000-0000000000b1', 'going');
select public.join_activity('c4b10000-0000-0000-0000-0000000000b1', 'maybe');
select public.join_activity('c4b10000-0000-0000-0000-0000000000b1', 'going');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a2', 'ACTIVITY_JOINED') = 1
  and (select url = '/a/c4b10000-0000-0000-0000-0000000000b1' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a2', 'ACTIVITY_JOINED')),
  'Lina joins (twice): Omar is told once, opening the plan');
update public.activities set starts_at = starts_at + interval '1 hour' where id = 'c4b10000-0000-0000-0000-0000000000b1';
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'ACTIVITY_UPDATED') = 1
  and (select url = '/a/c4b10000-0000-0000-0000-0000000000b1' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'ACTIVITY_UPDATED')),
  'new time: Lina (going) is told, opening the plan');
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a2', 'ACTIVITY_UPDATED') = 0, 'never the organiser');
update public.activities set cancelled_at = now() where id = 'c4b10000-0000-0000-0000-0000000000b1';
update public.activities set place_name = 'c4b elsewhere' where id = 'c4b10000-0000-0000-0000-0000000000b1';
select pg_temp.check((select count(*) from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_UPDATED'
  and payload ->> 'cancelled' = 'true') = 1, 'cancelled: Lina is told once');
-- Reminders: once, and never for a cancelled plan.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, privacy) values
  ('c4b10000-0000-0000-0000-0000000000b3', 'c4b10000-0000-0000-0000-0000000000a2', 'c4b soon', 'sport', 'dubai', 'marina', now() + interval '110 minutes', 'public'),
  ('c4b10000-0000-0000-0000-0000000000b4', 'c4b10000-0000-0000-0000-0000000000a2', 'c4b soon off', 'sport', 'dubai', 'marina', now() + interval '110 minutes', 'public');
insert into public.activity_participants (activity_id, user_id, status) values
  ('c4b10000-0000-0000-0000-0000000000b3', 'c4b10000-0000-0000-0000-0000000000a1', 'going'),
  ('c4b10000-0000-0000-0000-0000000000b4', 'c4b10000-0000-0000-0000-0000000000a1', 'going');
update public.activities set cancelled_at = now() where id = 'c4b10000-0000-0000-0000-0000000000b4';
select private.send_activity_reminders();
select private.send_activity_reminders();
select pg_temp.check((select count(*) from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_REMINDER') = 1
  and exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'ACTIVITY_REMINDER'
              and payload ->> 'activity_id' = 'c4b10000-0000-0000-0000-0000000000b3'), 'reminder: once, never for the cancelled plan');

-- ───────── 6. Followers, and following back ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
select public.follow_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER') = 1
  and (select url = '/person/c4b10000-0000-0000-0000-0000000000a2' and body = 'Omar s’est abonné·e à toi' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER')),
  'Omar follows Lina: she is told (French), opening his profile');
select pg_temp.check((select not (payload ? 'mutual') from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'NEW_FOLLOWER'),
  'not mutual yet');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select public.follow_user('c4b10000-0000-0000-0000-0000000000a2');
select pg_temp.as_admin();
select pg_temp.check((select payload ->> 'mutual' = 'true' from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a2' and kind = 'NEW_FOLLOWER')
  and (select body = 'Lina followed you back' and url = '/person/c4b10000-0000-0000-0000-0000000000a1' from pg_temp.last_push('c4b10000-0000-0000-0000-0000000000a2', 'NEW_FOLLOWER')),
  'Lina follows back: Omar is told « Lina followed you back »');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
select public.unfollow_user('c4b10000-0000-0000-0000-0000000000a1');
select public.follow_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'NEW_FOLLOWER') = 1, 'unfollow and follow again: no second notification');

-- ───────── 7. A phone that signed out or changed account ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select public.unregister_push_token('ExponentPushToken[c4b-lina]');
select pg_temp.as_admin();
select count(*) as lina_pushes from public.push_outbox where user_id = 'c4b10000-0000-0000-0000-0000000000a1' \gset
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mixte', auth.uid(), 'c4b after sign-out');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and kind = 'MESSAGE_CREATED'
    and payload ->> 'message_id' = (select id::text from public.messages where body = 'c4b after sign-out'))
  and (select count(*) from public.push_outbox where user_id = 'c4b10000-0000-0000-0000-0000000000a1') = :lina_pushes,
  'Lina signed out on her phone: the notification waits in the app, nothing is pushed to that phone');
-- Omar's phone now used by Karim (account switch): Omar's notifications never reach it, Karim's do.
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a4');
select public.register_push_token('ExponentPushToken[c4b-omar]', 'android', 'en');
select pg_temp.as_admin();
select pg_temp.check((select user_id from public.push_tokens where token = 'ExponentPushToken[c4b-omar]') = 'c4b10000-0000-0000-0000-0000000000a4', 'the phone now belongs to Karim');
select pg_temp.check(not exists (select 1 from public.push_outbox where token = 'ExponentPushToken[c4b-omar]' and user_id = 'c4b10000-0000-0000-0000-0000000000a2' and handled_at is null),
  'Omar''s pushes still waiting for that phone are dropped');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mixte', auth.uid(), 'c4b for Omar only');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a2' and kind = 'MESSAGE_CREATED'
    and payload ->> 'message_id' = (select id::text from public.messages where body = 'c4b for Omar only'))
  and not exists (select 1 from public.push_outbox where token = 'ExponentPushToken[c4b-omar]' and body like '%c4b for Omar only%'),
  'a message for Omar is not pushed to the phone Karim now uses');

-- ───────── 8. Each notification's universe (read by its owner) ─────────
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.check((select bool_and(public.notification_universe(n) = 'mixte') from public.notifications n
  where n.kind in ('COMMUNITY_POST', 'ACTIVITY_CREATED') or (n.kind = 'MESSAGE_CREATED' and n.payload ->> 'conversation_id' = :'k_mixte')), 'runners: Mixte');
select pg_temp.check((select bool_and(public.notification_universe(n) = 'girl' and public.notification_women_only(n)) from public.notifications n
  where n.payload ->> 'conversation_id' = :'k_girl'), 'girls padel chat: Girl, women-only');
select pg_temp.check((select public.notification_universe(n) = 'network' and not public.notification_women_only(n) from public.notifications n where n.kind = 'MENTION'),
  'the founders mention: Network, Mixte side');
select pg_temp.check((select bool_and(public.notification_universe(n) = 'mixte') from public.notifications n where n.kind in ('ACTIVITY_UPDATED', 'ACTIVITY_REMINDER')),
  'plans without a Girl community: Mixte');
select pg_temp.check((select public.notification_universe(n) is null and not public.notification_women_only(n) from public.notifications n where n.kind = 'NEW_FOLLOWER'),
  'a follower: no universe (every universe)');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a3');
insert into public.messages (conversation_id, sender_id, body) values (:'k_mom', auth.uid(), 'c4b playdate Friday');
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.check((select public.notification_universe(n) = 'mom' from public.notifications n where n.payload ->> 'conversation_id' = :'k_mom'), 'mums chat: Mom');
select pg_temp.as_admin();
select pg_temp.check(not has_function_privilege('anon', 'public.notification_universe(public.notifications)', 'execute'), 'anon cannot call it');

-- ───────── 9. Removed subjects ─────────
-- A removed post takes its notifications with it.
update public.community_posts set deleted_at = now() where id = 'c4b10000-0000-0000-0000-0000000000e1';
select pg_temp.check(pg_temp.notes('c4b10000-0000-0000-0000-0000000000a1', 'COMMUNITY_POST') = 0, 'removed post: its notification is gone');
-- A message deleted for everyone: its notifications and their pushes too.
update public.messages set deleted_at = now() where body = 'c4b 7am at the pier?';
select pg_temp.check(not exists (select 1 from public.notifications n where n.payload ->> 'message_id' = (select id::text from public.messages where body = 'c4b 7am at the pier?'))
  and not exists (select 1 from public.push_outbox where body like '%c4b 7am at the pier?%'), 'deleted message: notification and push copy gone');
-- A removed community: its notifications are kept, no longer listed.
select count(*) as founders_notes from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1' and payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f4' \gset
update public.communities set deleted_at = now() where id = 'c4b10000-0000-0000-0000-0000000000f4';
select pg_temp.as_user('c4b10000-0000-0000-0000-0000000000a1');
select pg_temp.check(not exists (select 1 from public.notifications where payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f4'),
  'removed community: Lina no longer sees its notifications');
select pg_temp.check(exists (select 1 from public.notifications where payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f1'), 'the other communities'' still listed');
select pg_temp.as_admin();
select pg_temp.check(:founders_notes > 0 and (select count(*) from public.notifications where user_id = 'c4b10000-0000-0000-0000-0000000000a1'
  and payload ->> 'community_id' = 'c4b10000-0000-0000-0000-0000000000f4') = :founders_notes, 'kept on the server (nothing deleted)');

rollback;
