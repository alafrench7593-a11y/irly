-- Server-side behaviour tests. Run with scripts/test-db.sh (plain PostgreSQL
-- plus tests/shim.sql). Each block raises if a rule does not hold.
\set ON_ERROR_STOP 1

-- Supabase grants table privileges to API roles; RLS decides the rows.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
-- …except the sensitive profile columns (migration 1300 narrows them again).
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function pg_temp.expect_denied(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'FAIL %: expected an error for: %', label, stmt;
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- People: three women, one man.
insert into auth.users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c'), ('00000000-0000-0000-0000-00000000000d');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.profiles (id, first_name, birthdate, gender, city_id, languages, is_admin)
values ('00000000-0000-0000-0000-00000000000a', 'Alice', '1996-04-02', 'woman', 'dubai', '{fr,en}', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.profiles (id, first_name, birthdate, gender, city_id, languages)
values ('00000000-0000-0000-0000-00000000000b', 'Bea', '1995-01-10', 'woman', 'dubai', '{fr}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.profiles (id, first_name, birthdate, gender, city_id)
values ('00000000-0000-0000-0000-00000000000c', 'Carl', '1990-06-01', 'man', 'dubai');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.profiles (id, first_name, birthdate, gender, city_id, languages)
values ('00000000-0000-0000-0000-00000000000d', 'Dina', '1985-09-09', 'woman', 'dubai', '{ar}');

-- Self-declared admin on signup is ignored.
select pg_temp.as_admin();
select pg_temp.check(not (select is_admin from public.profiles where first_name = 'Alice'), 'signup cannot grant admin');

-- Under 18 is refused.
select pg_temp.expect_denied($$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('00000000-0000-0000-0000-00000000000e', 'Kid', current_date - interval '15 years', 'woman', 'dubai')$$, 'minors refused');

-- ───── Women-only access, enforced server-side ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied('select public.irly_match_state()', 'man cannot enter IRLY Girl');
select pg_temp.expect_denied($$update public.profiles set gender = 'woman' where id = auth.uid()$$, 'gender locked after signup');
select pg_temp.expect_denied($$update public.profiles set is_admin = true where id = auth.uid()$$, 'cannot self-promote to admin');
select pg_temp.expect_denied('select * from public.irly_match_discover()', 'man cannot discover');
select pg_temp.expect_denied($$select private.is_girl_eligible('00000000-0000-0000-0000-00000000000a')$$, 'cannot probe another member''s eligibility');
select pg_temp.expect_denied($$select private.is_blocked('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$, 'cannot probe other people''s blocks');
select pg_temp.check(public.my_girl_access() = false, 'my_girl_access false for a man');

-- ───── Onboarding then profile ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(public.irly_match_state() = 'onboarding', 'onboarding comes first');
select pg_temp.expect_denied($$insert into public.irly_match_profiles (user_id, goals) values (auth.uid(), '{new_friends}')$$, 'no profile before onboarding');
select public.complete_irly_match_onboarding();
select pg_temp.check(public.irly_match_state() = 'profile', 'then the match profile');
insert into public.irly_match_profiles (user_id, goals, interests, sports, activities, languages, areas, availability, travel, lifestyle)
values (auth.uid(), '{new_friends,sports_friends}', '{brunch,travel,wellness}', '{padel,running}', '{coffee,beach}', '{fr,en}', '{marina,jlt}', '{weekend_morning}', '{oman}', '{"chronotype":-1,"social":1,"energy":1}');
select pg_temp.check(public.irly_match_state() = 'ready', 'ready after profile');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.complete_irly_match_onboarding();
insert into public.irly_match_profiles (user_id, goals, interests, sports, activities, languages, areas, availability, travel, lifestyle)
values (auth.uid(), '{new_friends}', '{brunch,travel}', '{padel}', '{coffee}', '{fr}', '{marina}', '{weekend_morning}', '{oman,bali}', '{"chronotype":-1,"social":1,"energy":0}');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.complete_irly_match_onboarding();
insert into public.irly_match_profiles (user_id, goals, interests, sports, languages, areas, lifestyle, hidden_fields)
values (auth.uid(), '{networking}', '{career}', '{gym}', '{ar}', '{downtown}', '{"chronotype":1,"social":-1}', '{age,areas}');

-- ───── Discovery and scoring ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.irly_match_profiles) = 1, 'match profiles of others are not readable directly');
select pg_temp.check((select count(*) from public.irly_match_discover()) = 2, 'discover lists the two other women');
select pg_temp.check(
  (select score from public.irly_match_discover() where first_name = 'Bea') > (select score from public.irly_match_discover() where first_name = 'Dina'),
  'Bea scores above Dina (more in common)');
-- Same numbers as scripts/check-compat.mts: on-device and server scores agree.
select pg_temp.check((select score from public.irly_match_discover() where first_name = 'Bea') = 80, 'Bea scores 80 (parity with app)');
select pg_temp.check((select score from public.irly_match_discover() where first_name = 'Dina') = 8, 'Dina scores 8 (parity with app)');
select pg_temp.check((select age is null and areas = '{}' from public.irly_match_discover() where first_name = 'Dina'), 'hidden fields stay hidden');
select pg_temp.check((select reasons -> 'sports' ? 'padel' from public.irly_match_discover() where first_name = 'Bea'), 'reasons list shared padel');
select pg_temp.check((select count(*) from public.irly_match_discover('{"sport":"gym"}')) = 1, 'sport filter');
select pg_temp.check((select count(*) from public.irly_match_discover('{"section":"nearby"}')) = 1, 'nearby uses shared areas, not hidden ones');
select string_agg(first_name || '=' || score, ', ') as scores from public.irly_match_discover();

-- ───── Like → match → one chat ─────
select pg_temp.check((select count(*) from public.irly_match_act('00000000-0000-0000-0000-00000000000b', 'like')) = 0, 'single like is not a match');
select pg_temp.check((select count(*) from public.irly_match_discover()) = 1, 'liked profile leaves discovery');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.irly_match_act('00000000-0000-0000-0000-00000000000a', 'like')) = 1, 'mutual like creates a match');
select pg_temp.check((select count(*) from public.irly_match_act('00000000-0000-0000-0000-00000000000a', 'like')) = 1, 'liking again returns the same match');
select pg_temp.check((select count(*) from public.irly_my_matches()) = 1, 'match listed for Bea');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.irly_matches) = 1, 'exactly one match row');
select pg_temp.check((select count(*) from public.conversations where kind = 'match') = 1, 'exactly one match chat');
select pg_temp.check((select count(*) from public.messages where kind in ('system', 'starter')) = 3, 'starters written');
select pg_temp.check((select count(*) from public.notifications where kind = 'MATCH_CREATED') = 2, 'both notified');

-- ───── Chat privacy ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.messages) = 3, 'Alice reads her match chat');
insert into public.messages (conversation_id, sender_id, body)
select id, auth.uid(), 'Padel Saturday?' from public.conversations where kind = 'match';
select pg_temp.check((select count(*) from public.profiles where first_name = 'Bea') = 1, 'Alice sees her match''s profile');
select pg_temp.check((select count(*) from public.profiles where first_name = 'Carl') = 0, 'but not strangers');
select pg_temp.expect_denied($$insert into public.messages (conversation_id, sender_id, kind, body) select id, auth.uid(), 'system', 'fake' from public.conversations limit 1$$, 'cannot forge system messages');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.messages) = 0, 'Dina cannot read their chat');
select pg_temp.check((select count(*) from public.conversations) = 0, 'Dina cannot see their conversation');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications n join public.profiles p on p.id = n.user_id where p.first_name = 'Bea' and n.kind = 'MESSAGE_CREATED') = 1, 'Bea notified of the message');

-- ───── Block ends everything ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.block_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.irly_my_matches()) = 0, 'block removes the match');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.conversations where kind = 'match') = 0, 'blocked: chat gone for Alice');
select pg_temp.check((select count(*) from public.irly_match_discover() where first_name = 'Bea') = 0, 'blocked: hidden from discovery');
select pg_temp.expect_denied($$select public.irly_match_act('00000000-0000-0000-0000-00000000000b', 'like')$$, 'cannot like someone who blocked you');

-- ───── Reports open a moderation case ─────
select public.report('profile', '00000000-0000-0000-0000-00000000000d', null, 'spam', 'test');
select pg_temp.check((select count(*) from public.moderation_cases) = 0, 'members cannot read moderation cases');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.moderation_cases where status = 'open') = 1, 'case opened for the report');

-- ───── Activities: capacity under joins, women-only ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, capacity)
values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Padel tonight', 'sport', 'dubai', 'marina', now() + interval '1 day', 2);
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only)
values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Girls brunch', 'food', 'dubai', 'marina', now() + interval '2 days', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(public.join_activity('10000000-0000-0000-0000-000000000001') = 'going', 'Dina joins');
select pg_temp.check((select count(*) from public.conversations where activity_id = '10000000-0000-0000-0000-000000000001') = 1, 'joining opens the activity chat');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.join_activity('10000000-0000-0000-0000-000000000001') = 'full', 'capacity enforced');
select pg_temp.check((select count(*) from public.activities where girl_only) = 0, 'man cannot see girl-only activity');
select pg_temp.expect_denied($$select public.join_activity('10000000-0000-0000-0000-000000000002')$$, 'man cannot join girl-only activity');
select pg_temp.expect_denied($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only) values (auth.uid(), 'Sneaky', 'food', 'dubai', 'marina', now() + interval '1 day', true)$$, 'man cannot create girl-only activity');

-- ───── Communities: join = chat ─────
select pg_temp.as_admin();
insert into public.communities (id, city_id, name, girl_only) values
  ('20000000-0000-0000-0000-000000000001', 'dubai', 'Dubai Padel', false),
  ('20000000-0000-0000-0000-000000000002', 'dubai', 'Girls Padel Dubai', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.join_community('20000000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.conversations where community_id = '20000000-0000-0000-0000-000000000001') = 1, 'community chat joined automatically');
select pg_temp.expect_denied($$select public.join_community('20000000-0000-0000-0000-000000000002')$$, 'man cannot join girl-only community');
select pg_temp.check((select count(*) from public.communities) = 1, 'girl-only community invisible to a man');

-- ───── Anonymous callers get nothing ─────
select pg_temp.as_admin();
set role anon;
select pg_temp.expect_denied('select public.irly_match_state()', 'anon cannot call match API');
select pg_temp.expect_denied('select count(*) from public.profiles', 'anon reads no profiles');
reset role;

-- ───── Members create communities; inbox ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_community('Marina Padel Girls', 'dubai', 'Padel twice a week', null, 'sport', true);
select pg_temp.check((select count(*) from public.my_conversations() where kind = 'community' and title = 'Marina Padel Girls') = 1, 'creator is in the new community chat');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied($$select public.create_community('Sneaky girls', 'dubai', null, null, null, true)$$, 'man cannot create a girls-only community');
select pg_temp.check((select count(*) from public.communities where name = 'Marina Padel Girls') = 0, 'girls-only community hidden from a man');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(not exists (select 1 from public.my_conversations() where kind = 'match'), 'blocked match chat not in inbox');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select unread from public.my_conversations() where kind = 'activity') >= 0, 'inbox lists the activity chat');
select public.mark_conversation_read((select conversation_id from public.my_conversations() where kind = 'activity'));
select pg_temp.check((select unread from public.my_conversations() where kind = 'activity') = 0, 'read state updates');

-- ───── Friends and IRL ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.add_friend('00000000-0000-0000-0000-00000000000d') = 'pending', 'friend request sent');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select incoming from public.my_friends() where first_name = 'Carl'), 'request shows as incoming');
select pg_temp.check(public.add_friend('00000000-0000-0000-0000-00000000000c') = 'accepted', 'accepting makes friends');
insert into public.irl_posts (author_id, city_id, area_id, body, visibility) values (auth.uid(), 'dubai', 'marina', 'Coffee at the Marina, anyone?', 'friends');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.irl_feed('dubai')) = 1, 'friend sees the friends-only IRL post');
select pg_temp.check((select first_name from public.irl_feed('dubai') limit 1) = 'Dina', 'with the author''s first name');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select count(*) from public.irl_feed('dubai')) = 0, 'non-friend does not');
select pg_temp.expect_denied($$select private.are_friends('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d')$$, 'cannot probe other people''s friendships');
select pg_temp.expect_denied($$insert into public.irl_posts (author_id, city_id, area_id, body, expires_at) values (auth.uid(), 'dubai', 'marina', 'forever', now() + interval '3 days')$$, 'IRL posts cannot outlive 4 hours');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications n where n.kind = 'IRLY_POST_CREATED') = 1, 'friend notified of the IRL post');

-- ───── Interactions: likes, comments, saves, shares ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.toggle_like('irl_post', (select id::text from public.irl_feed('dubai') limit 1)), 'friend likes the IRL post');
select pg_temp.check((select likes from public.engagement('irl_post', array[(select id::text from public.irl_feed('dubai') limit 1)])) = 1, 'like counted');
select pg_temp.check((select liked from public.engagement('irl_post', array[(select id::text from public.irl_feed('dubai') limit 1)])), 'and shown as mine');
select pg_temp.check(not public.toggle_like('irl_post', (select id::text from public.irl_feed('dubai') limit 1)), 'second tap unlikes');
select public.toggle_like('irl_post', (select id::text from public.irl_feed('dubai') limit 1));
insert into public.comments (target_type, target_id, author_id, body)
values ('irl_post', (select id::text from public.irl_feed('dubai') limit 1), auth.uid(), 'On my way!');
select pg_temp.check((select comments from public.engagement('irl_post', array[(select id::text from public.irl_feed('dubai') limit 1)])) = 1, 'comment counted');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.expect_denied($$select public.toggle_like('irl_post', (select id::text from public.irl_posts where body like 'Coffee%'))$$, 'stranger cannot like a friends-only post');
select pg_temp.expect_denied($$insert into public.comments (target_type, target_id, author_id, body) values ('irl_post', '00000000-0000-0000-0000-000000000000', auth.uid(), 'hi')$$, 'cannot comment on what you cannot see');
select pg_temp.check((select count(*) from public.comments) = 0, 'stranger sees none of the comments');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.comments (target_type, target_id, author_id, body, parent_id)
select target_type, target_id, auth.uid(), 'See you there', id from public.comments limit 1;
select pg_temp.check((select count(*) from public.comment_thread('irl_post', (select id::text from public.irl_posts limit 1)) where parent_id is not null) = 1, 'reply threaded under the comment');
select pg_temp.check(public.toggle_save('activity', '10000000-0000-0000-0000-000000000001'), 'save an activity');
select pg_temp.check(public.toggle_save('place', 'kite-beach'), 'save a place');
select pg_temp.check((select count(*) from public.saves) = 2, 'saved items listed');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.saves) = 0, 'saves are private');
select pg_temp.check((select saves from public.engagement('place', array['kite-beach'])) = 1, 'but the total is public');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'LIKE') = 1, 'author notified of the like (once)');
select pg_temp.check((select count(*) from public.notifications where kind = 'COMMENT_REPLY') = 1, 'commenter notified of the reply');
select pg_temp.check((select count(*) from public.notifications where kind = 'FRIEND_REQUEST') = 1, 'friend request has its own notification');

-- ───── Muted notifications, direct chat, share ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.notification_prefs (user_id, muted_kinds) values (auth.uid(), '{COMMENT}');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.comments (target_type, target_id, author_id, body)
values ('irl_post', (select id::text from public.irl_feed('dubai') limit 1), auth.uid(), 'Still there?');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'COMMENT') = 1, 'muted kinds are not delivered');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.open_direct('00000000-0000-0000-0000-00000000000d') = public.open_direct('00000000-0000-0000-0000-00000000000d'), 'one direct chat per pair');
select pg_temp.expect_denied($$select public.open_direct('00000000-0000-0000-0000-00000000000a')$$, 'no private message to a stranger');
select public.share_to_chat(public.open_direct('00000000-0000-0000-0000-00000000000d'), 'place', 'kite-beach', 'Kite Beach');
select pg_temp.check((select count(*) from public.messages where kind = 'share') = 1, 'share arrives in the chat');

-- ───── Calendar, search, recommendations ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.my_calendar() where title = 'Padel tonight') = 1, 'joined session in my calendar');
select pg_temp.check((select going from public.activity_detail('10000000-0000-0000-0000-000000000001')) = 2, 'detail counts participants');
select pg_temp.check((select conversation_id from public.activity_detail('10000000-0000-0000-0000-000000000001')) is not null, 'detail links my activity chat');
select pg_temp.check(exists (select 1 from public.search_all('padel', 'dubai') where kind = 'activity'), 'search finds the session');
select pg_temp.check(exists (select 1 from public.search_all('mall', 'dubai') where kind = 'place'), 'search finds places');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.search_all('brunch', 'dubai') where kind = 'activity'), 'search respects girl-only');
select pg_temp.check(exists (select 1 from public.search_all('Ali', null) where kind = 'person'), 'people are searchable by first name');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.safety_settings (user_id, profile_visibility) values (auth.uid(), 'nobody')
on conflict (user_id) do update set profile_visibility = 'nobody';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.search_all('Ali', null) where kind = 'person'), 'hidden profiles are not searchable');
update public.profiles set interests = '{sport}' where id = auth.uid();
select pg_temp.as_admin();
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at)
values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000a', 'Beach volley', 'sport', 'dubai', 'kitebeach', now() + interval '1 day');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select reason from public.recommend_activities('dubai') where title = 'Beach volley') = 'your_interests', 'recommended for my interests');
insert into public.hidden_items (user_id, target_type, target_id) values (auth.uid(), 'activity', '10000000-0000-0000-0000-000000000003');
select pg_temp.check(not exists (select 1 from public.recommend_activities('dubai') where title = 'Beach volley'), 'hidden items are not recommended');

-- ───── Participants hear about changes ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.activities set starts_at = starts_at + interval '1 hour' where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where kind = 'ACTIVITY_UPDATED') = 1, 'participant notified of the new time');

-- ───── Analytics and AI log ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.analytics_events (user_id, name, props) values (auth.uid(), 'ACTIVITY_VIEW', '{"category":"sport"}');
select pg_temp.check((select count(*) from public.analytics_events) = 0, 'members cannot read analytics');
select pg_temp.expect_denied($$insert into public.analytics_events (user_id, name) values ('00000000-0000-0000-0000-00000000000a', 'LOGIN')$$, 'cannot log events as someone else');
insert into public.ai_commands (user_id, input, intent, entities) values (auth.uid(), 'padel tomorrow', 'SEARCH', '{"activity":"padel"}');
select pg_temp.check((select count(*) from public.ai_commands) = 1, 'AI command logged for its owner');

-- ───── Repeated reports hide content ─────
select pg_temp.as_admin();
-- Escalation only counts established accounts (7 days): age the test accounts.
update public.profiles set created_at = now() - interval '30 days';
insert into public.reports (reporter_id, target_kind, target_id, category)
select u, 'irl_post', (select id from public.irl_posts limit 1), 'spam'
from unnest(array['00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c']::uuid[]) u;
select pg_temp.check((select expires_at <= now() from public.irl_posts limit 1), 'three reports take the IRL post down');

-- ───── Bali geography, guides, places, moms ─────
select pg_temp.as_admin();
set role anon;
select pg_temp.check((select admin_area_id from public.areas where city_id = 'bali' and id = 'berawa') = 'id-bali-badung', 'Berawa sits in Badung');
select pg_temp.check((select parent_area_id from public.areas where city_id = 'bali' and id = 'berawa') = 'canggu', 'and in Canggu for people searching');
select pg_temp.check((select count(*) from public.admin_areas where parent_id = 'id-bali') = 9, 'nine regencies and city of Bali');
select pg_temp.check((select count(*) from public.area_profiles where city_id = 'bali') >= 10, 'area profiles readable before sign-in');
select pg_temp.check(not exists (select 1 from public.guide_articles where kind = 'official' and source_url is null), 'official guides always cite a source');
select pg_temp.check(not exists (select 1 from public.guide_articles where destination = 'bali' and section = 'visa' and kind = 'official'
  and source_url !~ '^https://([a-z]+\.)*(imigrasi\.go\.id|baliprov\.go\.id)/'), 'Bali visa official entries come from government domains');
select pg_temp.check((select count(*) from public.guide_articles where destination = 'bali' and section = 'visa' and kind = 'official' and last_verified_at is not null) >= 10, 'Bali visa entries carry their verification date');
reset role;
select pg_temp.expect_denied($$insert into public.guide_articles (destination, section, title, body, kind) values ('bali', 'visa', 'Made up', 'x', 'official')$$, 'official info without a source is refused');
insert into public.places (slug, city_id, area_id, name, kind, cuisines, rating, review_count, price_level, provider, provider_place_id, fetched_at, amenities) values
  ('t-tiny', 'bali', 'canggu', 'Tiny 4.9', 'restaurant', '{italian}', 4.9, 12, 2, 'google', 't1', now(), '{}'),
  ('t-loved', 'bali', 'berawa', 'Loved 4.7', 'restaurant', '{italian}', 4.7, 3000, 2, 'google', 't2', now(), '{"good_for_children": true}');
set role anon;
select pg_temp.check((select slug from public.places_search('bali', null, 'restaurant', 'italian') limit 1) = 't-loved', 'ranking weighs review volume, not rating alone');
select pg_temp.check((select count(*) from public.places_search('bali', 'canggu', 'restaurant')) = 2, 'an area includes its neighbourhoods');
select pg_temp.check((select count(*) from public.places_search('bali', null, 'restaurant', null, null, null, null, true)) = 1, 'with kids filter');
select pg_temp.check((select count(*) from public.places_search('bali', null, 'restaurant', null, 4.8)) = 1, 'minimum rating filter');
reset role;

select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, place_id, activity_type, audience, girl_only)
values (auth.uid(), 'Mom brunch at Loved', 'food', 'bali', 'berawa', now() + interval '2 days', (select id from public.places where slug = 't-loved'), 'MOM_BRUNCH', 'moms', true);
select pg_temp.check((select count(*) from public.place_activities('t-loved')) = 1, 'restaurant shows who is going');
select pg_temp.check((select going from public.places_search('bali', 'berawa', 'restaurant')) = 1, 'and counts planned activities');
select pg_temp.expect_denied($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, audience) values (auth.uid(), 'Moms open', 'food', 'bali', 'canggu', now() + interval '1 day', 'moms')$$, 'moms activities are IRLY Girl activities');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.place_activities('t-loved')) = 0, 'a man does not see the moms brunch');
select pg_temp.expect_denied($$select * from public.girl_circle('bali')$$, 'a man cannot browse IRLY Girl circles');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.irly_match_profiles set destination = 'bali', destination_status = 'moving_soon', mom_mode = true, kids_age_groups = '{toddler}', looking_for = '{coworking}' where user_id = auth.uid();
select pg_temp.expect_denied($$update public.irly_match_profiles set kids_age_groups = '{Emma}' where user_id = auth.uid()$$, 'kids are age groups, never names');
insert into public.relocation_progress (user_id, destination, step_id) values (auth.uid(), 'bali', 'visa');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from public.girl_circle('bali', 'moving_soon')) = 1, 'women moving to Bali are discoverable');
select pg_temp.check((select count(*) from public.girl_circle('bali', null, true)) = 1, 'Mom mode filter');
select pg_temp.check((select count(*) from public.girl_circle('bali', null, false, null, 30, 'coworking')) = 1, 'filter by what she is looking for');
select pg_temp.check((select count(*) from public.girl_circle('bali', null, false, null, 30, 'sports')) = 0, 'and only that');
select pg_temp.check((select count(*) from public.relocation_progress) = 0, 'someone else''s move checklist is private');
select pg_temp.check((select count(*) from public.communities where city_id = 'bali' and name = 'Bali Moms') = 1, 'Bali Moms community exists for women');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.communities where name like '%Moms%') = 0, 'mom communities are hidden from men');
select pg_temp.expect_denied($$select private.friends_unchecked('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d')$$, 'private helpers are not callable by members');

-- ───── Community posts, polls, digest ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.join_community('20000000-0000-0000-0000-000000000001');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.community_posts (community_id, author_id, body) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'Padel Saturday 9am, who is in?');
insert into public.community_posts (community_id, author_id, body, poll) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'Best time?', '{"options":["Morning","Evening"]}');
select pg_temp.check((select count(*) from public.community_feed('20000000-0000-0000-0000-000000000001')) = 2, 'member posts appear in the feed');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select first_name from public.community_feed('20000000-0000-0000-0000-000000000001') limit 1) = 'Carl', 'with the author''s name');
insert into public.community_poll_votes (post_id, user_id, option) select id, auth.uid(), 1 from public.community_posts where body = 'Best time?';
select pg_temp.check((select poll_counts[2] from public.community_feed('20000000-0000-0000-0000-000000000001') where body = 'Best time?') = 1, 'poll vote counted');
select pg_temp.expect_denied($$insert into public.community_poll_votes (post_id, user_id, option) select id, auth.uid(), 4 from public.community_posts where body = 'Best time?'$$, 'one vote per member, existing options only');
select public.toggle_like('community_post', (select id::text from public.community_posts where body like 'Padel Saturday%'));
select pg_temp.check((select likes from public.community_feed('20000000-0000-0000-0000-000000000001') where body like 'Padel Saturday%') = 1, 'likes on community posts');
select pg_temp.check((select is_member from public.community_detail('20000000-0000-0000-0000-000000000001')), 'detail knows I am a member');
select pg_temp.check((select conversation_id from public.community_detail('20000000-0000-0000-0000-000000000001')) is not null, 'and links the community chat');
select pg_temp.check((select posts_week from public.community_digest('20000000-0000-0000-0000-000000000001')) = 2, 'digest counts the week');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000d' and kind = 'COMMUNITY_POST'), 'members are notified of new posts');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$insert into public.community_posts (community_id, author_id, body) values ('20000000-0000-0000-0000-000000000001', auth.uid(), 'not a member')$$, 'only members can post');
select pg_temp.expect_denied($$insert into public.community_poll_votes (post_id, user_id, option) select id, auth.uid(), 0 from public.community_posts where body = 'Best time?'$$, 'only members can vote');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.join_community((select id from public.communities where name = 'Marina Padel Girls'));
insert into public.community_posts (community_id, author_id, body) values ((select id from public.communities where name = 'Marina Padel Girls'), auth.uid(), 'Off-topic ad');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.community_posts set deleted_at = now() where body = 'Off-topic ad';
select pg_temp.check(not exists (select 1 from public.community_feed((select id from public.communities where name = 'Marina Padel Girls')) where body = 'Off-topic ad'), 'the owner can remove a post');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.community_posts set deleted_at = now() where body = 'Best time?' and author_id <> auth.uid();
select pg_temp.check((select count(*) from public.community_feed('20000000-0000-0000-0000-000000000001')) = 2, 'a member cannot remove someone else''s post');

-- ───── Bug hunt: security regressions ─────
-- Gender lock: no delete + re-insert as a woman.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
delete from public.profiles where id = auth.uid();
select pg_temp.check(exists (select 1 from public.profiles where id = auth.uid()), 'a member cannot delete their profile row (gender lock bypass)');
select pg_temp.check(not public.my_girl_access(), 'and stays out of IRLY Girl');
-- Sensitive columns of others are not readable, even with a shared chat.
select pg_temp.expect_denied($$select faith from public.profiles where first_name = 'Dina'$$, 'faith of others is not readable');
select pg_temp.expect_denied($$select birthdate from public.profiles$$, 'birthdates are not readable');
select pg_temp.check((select count(*) from public.profiles where first_name = 'Carl') = 1, 'own non-sensitive columns still readable');
-- Moderators remove, never rewrite; posts stay in their community.
select public.create_community('Carl Club', 'dubai') as carl_club \gset
insert into public.community_posts (community_id, author_id, body) values (:'carl_club', auth.uid(), 'Carl post');
select pg_temp.expect_denied($$update public.community_posts set author_id = '00000000-0000-0000-0000-00000000000d' where body = 'Carl post'$$, 'a post''s author cannot be changed');
select pg_temp.expect_denied($$update public.community_posts set community_id = '20000000-0000-0000-0000-000000000001' where body = 'Carl post'$$, 'a post cannot move to another community');
update public.community_posts set deleted_at = now() where body = 'Carl post';
select pg_temp.expect_denied($$update public.community_posts set deleted_at = null where body = 'Carl post'$$, 'a removed post cannot be restored by its author');
-- Messages: no moving into another chat, no fake system messages.
insert into public.messages (conversation_id, sender_id, body)
  values ((select id from public.conversations where community_id = :'carl_club'), auth.uid(), 'Carl message');
select pg_temp.expect_denied($$update public.messages set kind = 'system' where body = 'Carl message'$$, 'a message cannot become a system message');
select pg_temp.expect_denied($$update public.messages set conversation_id = (select id from public.conversations where kind = 'activity' limit 1) where body = 'Carl message'$$, 'a message cannot move to another chat');
-- Comments: removed ones are not readable by others and cannot be restored.
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at) values (auth.uid(), 'Carl public run', 'sport', 'dubai', 'marina', now() + interval '2 days');
insert into public.comments (target_type, target_id, author_id, body) select 'activity', id::text, auth.uid(), 'rude comment' from public.activities where title = 'Carl public run';
select id as rude_id from public.comments where body = 'rude comment' \gset
update public.comments set deleted_at = now() where body = 'rude comment';
select pg_temp.expect_denied($$update public.comments set deleted_at = null where id = '$$ || :'rude_id' || $$'$$, 'a removed comment cannot be restored');
select pg_temp.check((select body from public.comments where id = :'rude_id') = '—', 'a removed comment''s text is erased (kept for moderators only)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(not exists (select 1 from public.comments where body = 'rude comment'), 'removed comments'' text is not readable');
-- Notifications are not repeated by toggling.
select public.join_activity((select id from public.activities where title = 'Carl public run'), 'going');
select public.join_activity((select id from public.activities where title = 'Carl public run'), 'maybe');
select public.join_activity((select id from public.activities where title = 'Carl public run'), 'going');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select count(*) from public.notifications where kind = 'ACTIVITY_JOINED' and payload ->> 'activity_id' = (select id::text from public.activities where title = 'Carl public run')) = 1, 'going/maybe/going notifies the creator once');
-- Invite-only activities cannot be joined with the id alone.
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, privacy) values (auth.uid(), 'Carl invite only', 'sport', 'dubai', 'marina', now() + interval '2 days', 'invite');
select id as invite_act from public.activities where title = 'Carl invite only' \gset
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$select public.join_activity('$$ || :'invite_act' || $$')$$, 'an invite-only activity is not joinable by id');
-- Mentions: once, existing accounts only, only people who can see it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.comments (target_type, target_id, author_id, body, mentions)
select 'community_post', id::text, auth.uid(), 'address is 12B',
  array['00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111']::uuid[]
from public.community_posts where body = 'Best time?';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(not exists (select 1 from public.notifications where kind = 'MENTION' and payload ->> 'body' like 'address%'), 'no mention for someone who cannot see the post (and no failure on unknown ids)');
-- Hidden age never answers an age filter.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(not exists (select 1 from public.irly_match_discover('{"age_min":18,"age_max":120}') where first_name = 'Dina'), 'hidden age is not revealed by age filters');
-- Blocking ends the friendship (Carl and Dina are friends).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.block_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.my_friends() where first_name = 'Carl'), 'blocking ends the friendship');
select public.unblock_user('00000000-0000-0000-0000-00000000000c');

-- ───── Bug hunt 2: security regressions ─────
-- A hand-written message pointing at an invite-only activity is not an invite.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.create_community('Bea Club', 'dubai') as bea_club \gset
insert into public.messages (conversation_id, sender_id, kind, body, ref_type, ref_id)
  values ((select id from public.conversations where community_id = :'bea_club'), auth.uid(), 'share', 'x', 'activity', :'invite_act');
select pg_temp.expect_denied($$select public.join_activity('$$ || :'invite_act' || $$')$$, 'a forged share does not open an invite-only activity');
-- Server clock: backdating cannot beat rate limits or pin a feed.
insert into public.comments (target_type, target_id, author_id, body, created_at)
  select 'activity', id::text, auth.uid(), 'backdated', '2000-01-01' from public.activities where title = 'Carl public run';
select pg_temp.check((select created_at from public.comments where body = 'backdated') > now() - interval '1 minute', 'created_at is the server''s clock');
-- profiles_public hides people who blocked you.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(not exists (select 1 from public.profiles_public where first_name = 'Bea'), 'someone who blocked you is not listed');
-- Hidden match fields are not in reasons, nor in their facets.
select pg_temp.check(not exists (select 1 from public.irly_match_discover('{}') where first_name = 'Dina' and (coalesce(reasons -> 'areas', '[]') <> '[]' or coalesce(reasons -> 'facets', '{}') ? 'areas')), 'hidden areas never in match reasons');
select pg_temp.check(not exists (select 1 from public.irly_match_discover('{}') where jsonb_typeof(reasons -> 'languages') is distinct from 'array'), 'reasons always keep their lists (the app reads them)');
-- Communities: no posting into one you are not in; owner cannot flip girl-only.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied($$insert into public.irl_posts (author_id, city_id, area_id, body, visibility, community_id) values (auth.uid(), 'dubai', 'marina', 'hi moms', 'community', (select id from public.communities where name = 'Marina Padel Girls'))$$, 'no IRL post into a community you are not in');
select pg_temp.expect_denied($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id) values (auth.uid(), 'x', 'sport', 'dubai', 'marina', now() + interval '1 day', (select id from public.communities where name = 'Marina Padel Girls'))$$, 'no activity linked to a community you are not in');
select pg_temp.expect_denied($$update public.communities set girl_only = true where name = 'Carl Club'$$, 'an owner cannot change girl-only');
-- Polls are frozen once someone voted (Carl wrote "Best time?").
select pg_temp.expect_denied($$update public.community_posts set poll = '{"options":["Ban","Keep"]}' where body = 'Best time?'$$, 'a poll cannot change after votes');
-- Your own full profile, through my_profile().
select pg_temp.check((select gender from public.my_profile()) = 'man', 'my_profile returns your own full row');

-- ───── Bug hunt 3 ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
-- Reports: only what you can see, never yourself, once per item.
select pg_temp.expect_denied($$select public.report('irl_post', null, (select id from public.irl_posts where body like 'Coffee at the Marina%' limit 1), 'spam')$$, 'cannot report content you cannot see');
select pg_temp.expect_denied($$select public.report('comment', null, '$$ || :'rude_id' || $$', 'spam')$$, 'cannot report yourself');
select pg_temp.expect_denied($$insert into public.reports (reporter_id, target_kind, target_id, category) values (auth.uid(), 'comment', '$$ || :'rude_id' || $$', 'spam')$$, 'reports only through report()');
-- A removed comment is frozen for its author.
select pg_temp.expect_denied($$update public.comments set body = 'bad words again' where id = '$$ || :'rude_id' || $$'$$, 'a removed comment cannot be rewritten');
-- Notifications: only read_at changes.
select pg_temp.expect_denied($$update public.notifications set payload = '{}' where user_id = auth.uid()$$, 'notification content is fixed');
-- Girl-only stays girl-only once women joined.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only) values (auth.uid(), 'Dina girls run', 'sport', 'dubai', 'marina', now() + interval '2 days', true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.join_activity((select id from public.activities where title = 'Dina girls run'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_denied($$update public.activities set girl_only = false where title = 'Dina girls run'$$, 'a girl-only activity with women in it stays girl-only');
select pg_temp.expect_denied($$update public.activities set capacity = 0 where title = 'Dina girls run'$$, 'capacity cannot go below the people going');
select pg_temp.expect_denied($$update public.profiles set birthdate = '2000-01-01' where id = auth.uid()$$, 'birthdate is fixed after signup');

-- ───── Bug hunt 4 ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update public.comments set deleted_at = now() where id = :'rude_id';
select pg_temp.check(true, 'removing an already removed comment is a no-op, not an error');
select pg_temp.expect_denied($$select city_id from public.profiles where first_name = 'Dina'$$, 'others'' city is not readable from profiles');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.report('profile', '00000000-0000-0000-0000-00000000000a', null, 'harassment') is not null, 'someone you blocked can still be reported');
select pg_temp.check(public.report('activity', null, (select id from public.activities where title = 'Carl public run'), 'spam') is not null, 'an activity you can see can be reported');

-- ───── Bug hunt 5 ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.safety_settings (user_id, location_precision) values (auth.uid(), 'hidden')
  on conflict (user_id) do update set location_precision = 'hidden';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(not exists (select 1 from public.irly_match_discover('{"section":"interests"}') where first_name = 'Dina' and city_id is not null), 'hidden precision hides the city in discovery');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
update public.safety_settings set location_precision = 'area' where user_id = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.report('activity', null, (select id from public.activities where title = 'Carl public run'), 'spam') is not null, 'reporting again returns the same report');

-- ───── Activity photos ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values (auth.uid(), 'Borrowed photo', 'food', 'dubai', 'marina', now() + interval '1 day', '00000000-0000-0000-0000-00000000000a/x.jpg')$$, 'an activity cannot use someone else''s photo');
insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path)
  values (auth.uid(), 'Own photo', 'food', 'dubai', 'marina', now() + interval '1 day', '00000000-0000-0000-0000-00000000000b/cover.jpg');
select pg_temp.check((select cover_path from public.activities where title = 'Own photo') = '00000000-0000-0000-0000-00000000000b/cover.jpg', 'an activity can use its creator''s own photo');
select pg_temp.expect_denied($$update public.activities set cover_path = '../etc/passwd' where title = 'Own photo'$$, 'a photo path must be a plain file in your folder');

-- ───── activity_visibility ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.safety_settings (user_id, activity_visibility) values (auth.uid(), 'nobody')
  on conflict (user_id) do update set activity_visibility = 'nobody';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(not exists (select 1 from public.activity_participants x join public.activities a on a.id = x.activity_id
  where a.title = 'Carl public run' and x.user_id = '00000000-0000-0000-0000-00000000000d'), 'a member who hides her activities is not listed as going');
select pg_temp.check((select going from public.activity_detail((select id from public.activities where title = 'Carl public run'))) >= 1, 'the going count stays exact');
select pg_temp.check((select public.going(a) from public.activities a where a.title = 'Carl public run') >= 1, 'the computed going column stays exact');


-- ───── Every city: a session is a group chat, a community is a group chat ─────
-- Dubai, the six other emirates and Bali: same rules everywhere.
create or replace function pg_temp.sync_city(c text) returns void language plpgsql as $$
declare
  area text := (select id from public.areas where city_id = c order by id limit 1);
  aid uuid; gid uuid; mid uuid; cid uuid; gcid uuid; conv uuid;
begin
  if area is null then raise exception 'FAIL % has no areas', c; end if;
  -- Bea (IRLY Girl) creates a public session: its chat exists with her as admin.
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, currency)
  values (auth.uid(), 'Sync ' || c, 'sport', c, area, now() + interval '3 days', case when c = 'bali' then 'IDR' else 'AED' end)
  returning id into aid;
  select id into conv from public.conversations where activity_id = aid;
  perform pg_temp.check(conv is not null and exists (select 1 from public.conversation_members where conversation_id = conv and user_id = auth.uid() and role = 'admin'), c || ': a new session has its group chat, creator inside');
  -- Carl joins: he is in the chat, Bea is told.
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
  perform public.join_activity(aid);
  perform pg_temp.check(private.is_member(conv, auth.uid()), c || ': joining a session joins its chat');
  insert into public.messages (conversation_id, sender_id, body) values (conv, auth.uid(), 'On my way');
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  perform pg_temp.check(exists (select 1 from public.messages where conversation_id = conv and body = 'On my way'), c || ': the creator reads the group chat');
  -- Girls and moms sessions: IRLY Girl only, their chat too.
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, audience, girl_only)
  values (auth.uid(), 'Girls ' || c, 'wellness', c, area, now() + interval '3 days', 'girls', true) returning id into gid;
  insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, audience, girl_only)
  values (auth.uid(), 'Moms ' || c, 'family', c, area, now() + interval '3 days', 'moms', true) returning id into mid;
  perform pg_temp.check((select count(*) from public.conversations where activity_id in (gid, mid)) = 2, c || ': girls and moms sessions have their chats');
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
  perform public.join_activity(mid);
  perform pg_temp.check(private.is_member((select id from public.conversations where activity_id = mid), auth.uid()), c || ': a woman joins the moms chat');
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
  perform pg_temp.expect_denied(format('select public.join_activity(%L)', mid), c || ': a man cannot join a moms session');
  perform pg_temp.expect_denied(format('select public.join_activity(%L)', gid), c || ': a man cannot join a girls session');
  -- Communities: the creator is in its chat, joiners too; girl-only stays girl-only.
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
  cid := public.create_community('Sync club ' || c, c);
  perform pg_temp.check(private.is_member((select id from public.conversations where community_id = cid), auth.uid()), c || ': a new community has its group chat');
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
  perform public.join_community(cid);
  perform pg_temp.check(private.is_member((select id from public.conversations where community_id = cid), auth.uid()), c || ': joining a community joins its chat');
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
  gcid := public.create_community('Sync girls ' || c, c, null, null, null, true);
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
  perform pg_temp.expect_denied(format('select public.join_community(%L)', gcid), c || ': a man cannot join an IRLY Girl community');
  -- The daily limit on new communities is not what this test is about.
  perform pg_temp.as_admin();
  update public.communities set created_at = now() - interval '2 days' where created_by = '00000000-0000-0000-0000-00000000000d';
end $$;
select pg_temp.sync_city(c) from unnest(array['dubai', 'abudhabi', 'sharjah', 'ajman', 'rak', 'fujairah', 'uaq', 'bali']) as c;
select pg_temp.as_admin();

-- ───── Account deletion cascades ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where first_name = 'Dina'), 'deleting the account removes the profile');
select pg_temp.check(not exists (select 1 from public.irly_match_profiles where user_id = '00000000-0000-0000-0000-00000000000d'), 'and the match profile');
-- A member who sent messages can delete their account (sender_id → null cascade).
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where first_name = 'Carl'), 'a member with messages can delete the account');
select pg_temp.check(not exists (select 1 from public.messages where body = 'Carl message'), 'their messages go with the account (never shown as IRLY''s own)');
select pg_temp.check(exists (select 1 from public.community_members m join public.communities c on c.id = m.community_id where c.name = 'Carl Club' and m.role = 'owner') or not exists (select 1 from public.community_members m join public.communities c on c.id = m.community_id where c.name = 'Carl Club'), 'their communities keep an owner if anyone is left');

\echo 'ALL TESTS PASSED'
