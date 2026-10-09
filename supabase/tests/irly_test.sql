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
select pg_temp.check((select count(*) from public.messages m join public.conversations v on v.id = m.conversation_id where v.kind = 'match' and m.kind in ('system', 'starter')) = 3, 'starters written');
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
select pg_temp.check((select count(*) from public.communities where not official) = 1, 'girl-only community invisible to a man');
select pg_temp.check(not exists (select 1 from public.communities where girl_only), 'official girls-only communities invisible to a man too');

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

-- ───── One country: the seven emirates see each other, Bali stays apart ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check((select count(*) from public.recommend_activities('dubai', 50) where city_id = 'sharjah') >= 1, 'from Dubai: Sharjah sessions are recommended');
select pg_temp.check((select count(*) from public.recommend_activities('dubai', 50) where city_id = 'bali') = 0, 'from Dubai: no Bali sessions');
select pg_temp.check((select count(*) from public.community_list('dubai') where city_id = 'fujairah') >= 1, 'from Dubai: Fujairah communities are listed');
select pg_temp.check((select city_id from public.community_list('ajman') limit 1) = 'ajman', 'own emirate first in communities');
select pg_temp.check((select count(*) from public.community_list('bali') where city_id <> 'bali') = 0, 'from Bali: only Bali communities');
select pg_temp.check((select count(*) from public.search_all('Sync', 'dubai') where kind = 'activity' and city_id = 'rak') >= 1, 'search from Dubai finds a RAK session');
select pg_temp.check(private.city_scope('uaq') @> array['dubai', 'abudhabi', 'sharjah', 'ajman', 'rak', 'fujairah', 'uaq'] and not ('bali' = any (private.city_scope('uaq'))), 'UAE scope is the seven emirates');
select pg_temp.as_admin();

-- ───── Networking, professional side ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.pro_profiles (user_id, role, job_title, company, industries, skills, project, intents, city_id, area_id)
values (auth.uid(), 'founder', '  Founder ', 'Nova', '{ai,saas}', '{Python, python ,"  ",Sales}', 'AI for clinics', '{partners,investors,partners}', 'dubai', 'marina');
select pg_temp.check((select skills from public.pro_profiles where user_id = auth.uid()) = '{Python,Sales}', 'pro skills are trimmed and deduplicated');
select pg_temp.check((select job_title from public.pro_profiles where user_id = auth.uid()) = 'Founder', 'pro job title is trimmed');
select pg_temp.expect_denied($$insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values ('00000000-0000-0000-0000-00000000000c', 'founder', 'CEO', '{ai}', 'dubai')$$, 'nobody writes someone else''s pro profile');
select pg_temp.expect_denied($$update public.pro_profiles set industries = '{astrology}' where user_id = auth.uid()$$, 'industries come from the list');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
insert into public.pro_profiles (user_id, role, job_title, industries, skills, intents, city_id, area_id)
values (auth.uid(), 'investor', 'Angel investor', '{ai,fintech}', '{Fundraising}', '{opportunities}', 'sharjah', 'nowhere');
select pg_temp.check((select area_id from public.pro_profiles where user_id = auth.uid()) is null, 'an unknown neighbourhood is dropped');
select pg_temp.check(not exists (select 1 from public.pro_profiles where user_id <> auth.uid()), 'others'' pro rows are not readable directly');
select pg_temp.check(exists (select 1 from public.pro_discover('dubai') where first_name = 'Bea' and lat is not null), 'from Sharjah: a Dubai founder is discoverable, with her area');
select pg_temp.check(exists (select 1 from public.pro_discover('sharjah', '{"industry":"saas"}') where first_name = 'Bea'), 'industry filter');
select pg_temp.check(not exists (select 1 from public.pro_discover('sharjah', '{"industry":"food"}') where first_name = 'Bea'), 'industry filter excludes');
select pg_temp.check(exists (select 1 from public.pro_discover('sharjah', '{"role":"founder","intent":"investors"}')), 'role + looking for filters');
select pg_temp.check(exists (select 1 from public.pro_discover('sharjah', '{"q":"pyth"}') where first_name = 'Bea'), 'search by skill');
select pg_temp.check(not exists (select 1 from public.pro_discover('sharjah', '{"city":"ajman"}')), 'city filter');
select pg_temp.check(not exists (select 1 from public.pro_discover('bali')), 'Bali does not see the Emirates');
select pg_temp.check(not exists (select 1 from public.pro_discover('dubai') where user_id = auth.uid()), 'I am not in my own list');
select pg_temp.check((select connection from public.pro_discover('dubai') where first_name = 'Bea') = 'none', 'not connected yet');
select public.add_friend('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select connection from public.pro_profile_of('00000000-0000-0000-0000-00000000000b')) = 'requested', 'Connect sends a request');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select connection from public.pro_discover('dubai') where first_name = 'Carl') = 'incoming', 'she sees the incoming request');
select public.add_friend('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select connection from public.pro_profile_of('00000000-0000-0000-0000-00000000000c')) = 'connected', 'accepting connects them');
select pg_temp.check(public.open_direct('00000000-0000-0000-0000-00000000000c') is not null, 'connected professionals can message');
update public.pro_profiles set visible = false where user_id = auth.uid();
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.pro_discover('dubai') where first_name = 'Bea'), 'a hidden pro profile leaves discovery');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.pro_profiles (user_id, role, job_title, industries, city_id) values (auth.uid(), 'freelancer', 'Designer', '{design}', 'dubai');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.pro_discover('dubai') where first_name = 'Alice'), 'profile visibility "nobody" also hides the pro profile');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.pro_profiles set visible = true where user_id = auth.uid();
select pg_temp.as_admin();

-- ───── Networking connections and phone notifications ─────
create or replace function pg_temp.error_of(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.register_push_token('ExponentPushToken[dina-test-0001]', 'ios', 'fr');
select pg_temp.check((select count(*) from public.push_tokens) = 1, 'my phone is registered (and I only see my own)');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.push_tokens), 'nobody reads someone else''s phone token');
select pg_temp.check(public.pro_connect('00000000-0000-0000-0000-00000000000d') = 'pending', 'Connect from Networking sends a request');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000d' and kind = 'PRO_CONNECT_REQUEST' and payload ->> 'from' = '00000000-0000-0000-0000-00000000000c'), 'she gets a Networking request notification');
select pg_temp.check(exists (select 1 from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000d' and body = 'Carl veut entrer en contact avec toi' and url = '/network/00000000-0000-0000-0000-00000000000c'), 'and a push in French that opens his professional profile');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.remove_friend('00000000-0000-0000-0000-00000000000d');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000d' and kind = 'PRO_CONNECT_REQUEST'), 'a withdrawn request takes its notification with it');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.pro_connect('00000000-0000-0000-0000-00000000000d');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000d' and kind = 'PRO_CONNECT_REQUEST'), 'asking again the same day does not notify twice');
select pg_temp.check((select count(*) from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000d' and url like '/network/%') = 1, 'nor push twice');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(public.pro_connect('00000000-0000-0000-0000-00000000000c') = 'accepted', 'Connect back accepts');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'PRO_CONNECT_ACCEPTED'), 'he is told she accepted');
-- Messages: a push with the text, then a busy chat stays quiet for a minute.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.open_direct('00000000-0000-0000-0000-00000000000d');
insert into public.messages (conversation_id, sender_id, body) select public.open_direct('00000000-0000-0000-0000-00000000000d'), auth.uid(), 'Coffee tomorrow?';
insert into public.messages (conversation_id, sender_id, body) select public.open_direct('00000000-0000-0000-0000-00000000000d'), auth.uid(), 'At 10?';
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000d' and title = 'Carl' and body = 'Coffee tomorrow?' and url like '/messages/%'), 'a message pushes its text, titled with the sender');
select pg_temp.check((select count(*) from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000d' and url like '/messages/%') = 1, 'a second message within a minute does not push again');
-- Push off: notifications still arrive in the app, nothing goes to the phone.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into public.notification_prefs (user_id, push_enabled) values (auth.uid(), false) on conflict (user_id) do update set push_enabled = false;
select pg_temp.as_admin();
delete from public.push_outbox;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.remove_friend('00000000-0000-0000-0000-00000000000d');
select pg_temp.as_admin();
insert into public.pro_connect_log (user_id, target, created_at) select '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', now() - interval '2 days';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.pro_connect('00000000-0000-0000-0000-00000000000c');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'PRO_CONNECT_REQUEST'), 'with push off on her side, he still gets the request');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.pro_connect('00000000-0000-0000-0000-00000000000d');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.push_outbox where user_id = '00000000-0000-0000-0000-00000000000d'), 'push off: nothing queued for her phone');
-- A phone that switches accounts follows the new account.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.register_push_token('ExponentPushToken[dina-test-0001]', 'ios', 'en');
select pg_temp.as_admin();
select pg_temp.check((select user_id from public.push_tokens where token = 'ExponentPushToken[dina-test-0001]') = '00000000-0000-0000-0000-00000000000b', 'a phone that switched accounts pushes to the new one');
-- 30 requests a day at most.
insert into public.pro_connect_log (user_id, target) select '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a' from generate_series(1, 30);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(pg_temp.error_of($$select public.pro_connect('00000000-0000-0000-0000-00000000000d')$$) like '%many requests today%', 'the 31st request of the day is refused');
select pg_temp.check(pg_temp.error_of($$select public.pro_connect('00000000-0000-0000-0000-0000000000ff')$$) is not null, 'connecting to nobody fails');
select pg_temp.as_admin();

-- ───── Audit: blocking, inbox, data rights, message deletion, reports ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(public.pro_connect('00000000-0000-0000-0000-00000000000b') in ('pending', 'accepted'), 'Dina asks Bea');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.block_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(not exists (select 1 from public.friendships where '00000000-0000-0000-0000-00000000000d' in (user_a, user_b) and '00000000-0000-0000-0000-00000000000b' in (user_a, user_b)), 'blocking ends the request or connection');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = auth.uid() and payload ->> 'from' = '00000000-0000-0000-0000-00000000000d'), 'and removes their requests from my notifications');
select pg_temp.check(exists (select 1 from public.my_blocks() where user_id = '00000000-0000-0000-0000-00000000000d'), 'she is in my blocked list');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(pg_temp.error_of($$select public.pro_connect('00000000-0000-0000-0000-00000000000b')$$) is not null, 'a blocked member cannot ask again');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.unblock_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(not exists (select 1 from public.my_blocks() where user_id = '00000000-0000-0000-0000-00000000000d'), 'unblocking removes her from the list');
-- Inbox: a direct chat with someone I block disappears, and comes back when I unblock.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(public.pro_connect('00000000-0000-0000-0000-00000000000d') in ('pending', 'accepted'), 'Carl asks Dina again');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.pro_connect('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(exists (select 1 from public.my_conversations() where other_user_id = '00000000-0000-0000-0000-00000000000c'), 'our chat is in my inbox');
select public.block_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.my_conversations() where other_user_id = '00000000-0000-0000-0000-00000000000c'), 'blocking hides our chat from my inbox');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.my_conversations() where other_user_id = '00000000-0000-0000-0000-00000000000d'), 'and from his');
select pg_temp.expect_denied($$insert into public.messages (conversation_id, sender_id, body) select c.id, auth.uid(), 'hi?' from public.conversations c join public.conversation_members a on a.conversation_id = c.id and a.user_id = auth.uid() join public.conversation_members b on b.conversation_id = c.id and b.user_id = '00000000-0000-0000-0000-00000000000d' where c.kind = 'direct'$$, 'he cannot write to her any more');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.unblock_user('00000000-0000-0000-0000-00000000000c');
-- Deleting my own message, not someone else's.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
create temp table gone as select id from public.messages where body = 'At 10?';
select public.delete_my_message((select id from gone));
select pg_temp.check(not exists (select 1 from public.messages where body = 'At 10?'), 'I can delete my message: its text is gone');
select pg_temp.as_admin();
select pg_temp.check((select deleted_at from public.messages where id = (select id from gone)) is not null, 'it is marked deleted on the server');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(pg_temp.error_of($$select public.delete_my_message((select id from public.messages where body = 'Coffee tomorrow?'))$$) is not null, 'but not someone else''s');
-- Reports: the new categories, and a report stays private to its author.
select pg_temp.check(public.report('message', null, (select id from public.messages where body = 'Coffee tomorrow?'), 'scam', 'asked for money') is not null, 'reporting a message as a scam');
select pg_temp.check(public.report('profile', '00000000-0000-0000-0000-00000000000c', null, 'threats', null) is not null, 'reporting a profile for threats');
select pg_temp.expect_denied($$select public.report('profile', '00000000-0000-0000-0000-00000000000c', null, 'astrology', null)$$, 'unknown report categories are refused');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.reports where reporter_id = '00000000-0000-0000-0000-00000000000d'), 'nobody reads reports about them');
-- Export: my data, not others'.
select pg_temp.check((public.export_my_data() -> 'profile' ->> 'first_name') = 'Carl', 'export contains my profile');
select pg_temp.check(public.export_my_data() -> 'profile' ->> 'is_admin' is null, 'export leaves out internal flags');
select pg_temp.check(not (public.export_my_data()::text like '%Coffee tomorrow?%' and false), 'export runs');
select pg_temp.check(jsonb_array_length(public.export_my_data() -> 'messages_sent') >= 1, 'export contains my messages');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.check(public.export_my_data()::text not like '%Coffee tomorrow?%', 'her export does not contain his messages');
select pg_temp.as_admin();
select pg_temp.expect_denied($$select public.export_my_data()$$, 'export needs a signed-in member');

-- ───── Support requests ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.support_requests (user_id, kind, body, platform) values (auth.uid(), 'problem', 'The map does not load', 'ios');
select pg_temp.expect_denied($$insert into public.support_requests (user_id, kind, body) values ('00000000-0000-0000-0000-00000000000c', 'problem', 'pretending to be Carl')$$, 'a request is always sent as myself');
select pg_temp.check(not exists (select 1 from public.support_requests), 'members cannot read support requests (even their own)');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.support_requests) = 1, 'the team receives it');

-- ───── Edit profile ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update public.profiles set first_name = 'Béa', bio = 'Padel and brunch', languages = '{fr,en}', interests = '{sports}', country = 'France', city_id = 'abudhabi' where id = auth.uid();
select pg_temp.check((select first_name from public.my_profile()) = 'Béa', 'I can edit my name, bio, languages and interests');
select pg_temp.as_admin();
select pg_temp.check((select city_id from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = 'abudhabi', 'and my city');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$update public.profiles set birthdate = '2015-01-01' where id = auth.uid()$$, 'birth date cannot be changed after signup (minimum age)');
select pg_temp.expect_denied($$update public.profiles set gender = 'man' where id = auth.uid()$$, 'gender cannot be changed by the member');
update public.profiles set first_name = 'Mallory' where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_admin();
select pg_temp.check((select first_name from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'Carl', 'nobody edits someone else''s profile');
update public.profiles set first_name = 'Bea', city_id = 'dubai' where id = '00000000-0000-0000-0000-00000000000b';

-- ───── Retention ─────
select pg_temp.as_admin();
insert into private.removed_content (source, id, body, removed_at) values ('messages', gen_random_uuid(), 'old', now() - interval '13 months'), ('messages', gen_random_uuid(), 'recent', now());
insert into public.support_requests (user_id, kind, body, created_at) values (null, 'question', 'very old question', now() - interval '25 months');
-- (triggers off for this back-dating only: updated_at is normally set to now)
set session_replication_role = replica;
update public.moderation_cases set status = 'dismissed', updated_at = now() - interval '13 months'
  where report_id = (select id from public.reports where category = 'threats' limit 1);
set session_replication_role = origin;
select private.purge_retention();
select pg_temp.check(not exists (select 1 from private.removed_content where body = 'old') and exists (select 1 from private.removed_content where body = 'recent'), 'removed text is kept 12 months');
select pg_temp.check(not exists (select 1 from public.support_requests where body = 'very old question'), 'support requests are kept 24 months');
select pg_temp.check(not exists (select 1 from public.reports where category = 'threats'), 'closed reports go 12 months after closing');
select pg_temp.check(exists (select 1 from public.reports where category = 'scam'), 'open reports stay until handled');

-- ───── Waitlist (website) ─────
set role anon;
select pg_temp.check(public.join_waitlist('  New.Person@Example.com ', 'fr', 'site') = 'ok', 'a visitor joins the waitlist');
select pg_temp.check(public.join_waitlist('new.person@example.com') = 'ok', 'joining twice answers the same (no address probing)');
select pg_temp.check(pg_temp.error_of($$select public.join_waitlist('not-an-email')$$) like '%invalid email%', 'an invalid address is refused');
select pg_temp.check(pg_temp.error_of($$select public.join_waitlist('a@b')$$) like '%invalid email%', 'an address without a domain is refused');
select pg_temp.check(not exists (select 1 from public.waitlist), 'visitors cannot read the waitlist');
select pg_temp.expect_denied($$insert into public.waitlist (email) values ('direct@example.com')$$, 'visitors cannot write the table directly');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(not exists (select 1 from public.waitlist), 'members cannot read the waitlist');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.waitlist) = 1 and (select lang from public.waitlist) = 'fr' and (select email from public.waitlist) = 'new.person@example.com', 'stored once, lower-cased, with its language');
insert into public.waitlist (email, created_at) values ('old@example.com', now() - interval '25 months');
select private.purge_retention();
select pg_temp.check(not exists (select 1 from public.waitlist where email = 'old@example.com'), 'waitlist addresses are kept 24 months');

-- ───── Own photos for communities and chats ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.set_community_cover((select id from public.communities where name = 'Marina Padel Girls'), '00000000-0000-0000-0000-00000000000a/cover.jpg');
select pg_temp.check((select cover_path from public.communities where name = 'Marina Padel Girls') = '00000000-0000-0000-0000-00000000000a/cover.jpg', 'the owner sets the community photo');
select pg_temp.expect_denied($$select public.set_community_cover((select id from public.communities where name = 'Marina Padel Girls'), '00000000-0000-0000-0000-00000000000b/x.jpg')$$, 'a photo must be your own upload');
select pg_temp.expect_denied($$update public.communities set cover_path = '00000000-0000-0000-0000-00000000000b/x.jpg' where name = 'Marina Padel Girls'$$, 'no direct update to someone else''s upload');
select public.set_conversation_photo((select conversation_id from public.my_conversations() where kind = 'community' and title = 'Marina Padel Girls'), '00000000-0000-0000-0000-00000000000a/chat.jpg');
select pg_temp.check((select photo_path from public.conversations where title = 'Marina Padel Girls') = '00000000-0000-0000-0000-00000000000a/chat.jpg', 'the community owner sets the chat photo');
select public.set_community_cover((select id from public.communities where name = 'Marina Padel Girls'), null);
select pg_temp.check((select cover_path from public.communities where name = 'Marina Padel Girls') is null, 'back to the app photo');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$select public.set_community_cover((select id from public.communities where name = 'Marina Padel Girls'), '00000000-0000-0000-0000-00000000000b/x.jpg')$$, 'a non-owner cannot change the community photo');
select pg_temp.expect_denied($$select public.set_conversation_photo((select id from public.conversations where title = 'Marina Padel Girls'), '00000000-0000-0000-0000-00000000000b/x.jpg')$$, 'a non-admin cannot change the chat photo');
select pg_temp.as_admin();

-- ───── IRLY Community: official communities ─────
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.communities where official and topic = 'gym' and city_id = 'dubai') = 1, 'one official IRLY Gym in Dubai');
select pg_temp.check(private.ensure_official_communities() = 0, 'creating official communities again makes no duplicate');
select pg_temp.check(exists (select 1 from public.messages m join public.conversations v on v.id = m.conversation_id join public.communities c on c.id = v.community_id where c.official and c.topic = 'newcomers' and m.kind = 'system'), 'official chats open with a welcome');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select topic from public.community_recommend('dubai', '{newcomer,activity:gym,goal:networking}') limit 1) in ('newcomers', 'gym'), 'recommendations follow the answers');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{newcomer}') where topic = 'football'), 'nothing recommended without a matching answer');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{}')), 'no answers, no recommendations');
select pg_temp.check((select count(*) from public.community_recommend('sharjah', '{activity:gym}')) = 1, 'a city without its own gets the nearest one, once');
select pg_temp.check(public.join_communities(array(select id from public.community_recommend('dubai', '{newcomer,activity:gym}'))) = 2, 'join all');
select pg_temp.check((select count(*) from public.community_recommend('dubai', '{newcomer,activity:gym}') where is_member) = 2, 'joined communities show as joined');
select pg_temp.check(exists (select 1 from public.messages m join public.conversations v on v.id = m.conversation_id join public.communities c on c.id = v.community_id where c.topic = 'gym' and c.city_id = 'dubai' and m.kind = 'system' and m.body like '% just joined 👋%'), 'a new member is announced in the chat');
select pg_temp.expect_denied($$insert into public.communities (city_id, name, official, topic, created_by) values ('dubai', 'Fake IRLY Gym', true, 'gym', '00000000-0000-0000-0000-00000000000b')$$, 'members cannot create official communities');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{goal:irlygirl,goal:friends}') where topic = 'girls'), 'IRLY Girls is not recommended to men');
select pg_temp.as_admin();

-- ───── Sync: one source of truth (chat membership, names, cancel, delete, one tap = one object) ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, place_name, starts_at, client_ref)
values ('30000000-0000-0000-0000-0000000000f1', auth.uid(), 'Sync padel', 'sport', 'dubai', 'marina', 'Court 1', now() + interval '2 days', '40000000-0000-0000-0000-000000000001');
select pg_temp.expect_denied($$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, client_ref) values (auth.uid(), 'Sync padel', 'sport', 'dubai', 'marina', now() + interval '2 days', '40000000-0000-0000-0000-000000000001')$$, 'a double tap creates one activity');
select pg_temp.check((select count(*) from public.conversations where activity_id = '30000000-0000-0000-0000-0000000000f1') = 1, 'one chat per activity');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.join_activity('30000000-0000-0000-0000-0000000000f1');
select public.join_activity('30000000-0000-0000-0000-0000000000f1');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.activity_participants where activity_id = '30000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-00000000000c') = 1, 'joining twice is one participation');
select pg_temp.check(exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id where c.activity_id = '30000000-0000-0000-0000-0000000000f1' and cm.user_id = '00000000-0000-0000-0000-00000000000c'), 'a participant is in the activity chat');
delete from public.activity_participants where activity_id = '30000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check(not exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id where c.activity_id = '30000000-0000-0000-0000-0000000000f1' and cm.user_id = '00000000-0000-0000-0000-00000000000c'), 'a participant removed by any path leaves the chat');
insert into public.activity_participants (activity_id, user_id, status) values ('30000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000c', 'going');
select pg_temp.check(exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id where c.activity_id = '30000000-0000-0000-0000-0000000000f1' and cm.user_id = '00000000-0000-0000-0000-00000000000c'), 'a participant added by any path joins the chat');
update public.activity_participants set status = 'maybe' where activity_id = '30000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.check(not exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id where c.activity_id = '30000000-0000-0000-0000-0000000000f1' and cm.user_id = '00000000-0000-0000-0000-00000000000c'), 'participants and chat members never differ ("maybe" is not in the chat)');
update public.activity_participants set status = 'going' where activity_id = '30000000-0000-0000-0000-0000000000f1' and user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.activities set title = 'Sync padel night' where id = '30000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select title from public.conversations where activity_id = '30000000-0000-0000-0000-0000000000f1') = 'Sync padel night', 'renaming an activity renames its chat');
update public.activities set place_name = 'Court 7' where id = '30000000-0000-0000-0000-0000000000f1';
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'ACTIVITY_UPDATED' and payload ->> 'activity_id' = '30000000-0000-0000-0000-0000000000f1') = 1, 'people going hear about a new place, once');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied($$select public.delete_activity('30000000-0000-0000-0000-0000000000f1')$$, 'only the host deletes an activity');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.activities set cancelled_at = now() where id = '30000000-0000-0000-0000-0000000000f1';
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.messages m join public.conversations c on c.id = m.conversation_id where c.activity_id = '30000000-0000-0000-0000-0000000000f1' and m.body like '%cancelled%'), 'a cancelled plan says so in its chat');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.delete_activity('30000000-0000-0000-0000-0000000000f1');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.activities where id = '30000000-0000-0000-0000-0000000000f1') and not exists (select 1 from public.conversations where activity_id = '30000000-0000-0000-0000-0000000000f1'), 'a deleted activity disappears with its chat');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check(public.create_community('Sync Club', 'dubai') = public.create_community('Sync Club', 'dubai'), 'a double tap creates one community');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.communities where name = 'Sync Club') = 1 and (select count(*) from public.conversations c join public.communities m on m.id = c.community_id where m.name = 'Sync Club') = 1, 'one community, one chat');
select pg_temp.check(exists (select 1 from public.conversation_members cm join public.conversations c on c.id = cm.conversation_id join public.communities m on m.id = c.community_id where m.name = 'Sync Club' and cm.user_id = '00000000-0000-0000-0000-00000000000a' and cm.role = 'admin'), 'the owner is the chat admin');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.join_community((select id from public.communities where name = 'Sync Club'));
select pg_temp.check(exists (select 1 from public.my_conversations() where kind = 'community' and title = 'Sync Club'), 'a new member finds the community chat in the inbox');
select public.leave_community((select id from public.communities where name = 'Sync Club'));
select pg_temp.check(not exists (select 1 from public.my_conversations() where kind = 'community' and title = 'Sync Club'), 'leaving the community leaves its chat');
select public.join_community((select id from public.communities where name = 'Sync Club'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
update public.communities set name = 'Sync Club Dubai' where name = 'Sync Club';
select pg_temp.check((select title from public.conversations c join public.communities m on m.id = c.community_id where m.name = 'Sync Club Dubai') = 'Sync Club Dubai', 'renaming a community renames its chat');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied($$select public.delete_community((select id from public.communities where name = 'Sync Club Dubai'))$$, 'only the owner deletes a community');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.delete_community((select c.id from public.communities c where c.name = 'Sync Club Dubai'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where name = 'Sync Club Dubai'), 'a deleted community leaves every list');
select pg_temp.check(not exists (select 1 from public.my_conversations() where title = 'Sync Club Dubai'), 'and every inbox');
select pg_temp.as_admin();

-- ───── Coming soon services: "tell me when it opens" ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.set_service_interest('visa');
select public.set_service_interest('visa');
select public.set_service_interest('location', true);
select pg_temp.check((select count(*) from public.service_interest where user_id = auth.uid()) = 2, 'asking twice is one request; one row per service');
select pg_temp.expect_denied($$select public.set_service_interest('casino')$$, 'only the four planned services');
select pg_temp.expect_denied($$insert into public.service_interest (user_id, service) values (auth.uid(), 'pro')$$, 'no direct writes, only the RPC');
select public.set_service_interest('location', false);
select pg_temp.check(not exists (select 1 from public.service_interest where user_id = auth.uid() and service = 'location'), 'a member can withdraw');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(not exists (select 1 from public.service_interest), 'members never see each other''s requests');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.service_interest) = 1, 'the team sees every request');

-- ───── IRLY Girl / Moms: feed and moderation ─────
select pg_temp.as_admin();
alter table public.profiles disable trigger profiles_guard;
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000a';
alter table public.profiles enable trigger profiles_guard;
insert into public.communities (id, city_id, name, category_id, girl_only) values
  ('40000000-0000-0000-0000-0000000000a1', 'dubai', 'Feed Girls Dubai', 'girl', true),
  ('40000000-0000-0000-0000-0000000000a2', 'dubai', 'Feed Moms Dubai', 'family', true),
  ('40000000-0000-0000-0000-0000000000a3', 'dubai', 'Feed Open Club', 'food', false);
insert into public.community_members (community_id, user_id, role) values
  ('40000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('40000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'member'),
  ('40000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-00000000000b', 'member');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.community_posts (community_id, author_id, body) values
  ('40000000-0000-0000-0000-0000000000a1', auth.uid(), 'Girls brunch on Saturday?'),
  ('40000000-0000-0000-0000-0000000000a2', auth.uid(), 'Park meetup with the kids'),
  ('40000000-0000-0000-0000-0000000000a3', auth.uid(), 'Open club post');
select pg_temp.check((select count(*) from public.girl_feed('dubai')) = 2, 'the Girl feed holds the women-only communities, not the open ones');
select pg_temp.check((select count(*) from public.girl_feed('dubai', true)) = 1 and (select body from public.girl_feed('dubai', true)) = 'Park meetup with the kids', 'the Moms feed holds the family communities');
select pg_temp.check((select is_member from public.girl_feed('dubai', true)), 'the feed says when you are a member');
select pg_temp.check(public.my_girl_status() = 'open', 'a woman sees IRLY Girl open');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.expect_denied($$select * from public.girl_feed('dubai')$$, 'a man cannot read the Girl feed');
select pg_temp.check(not exists (select 1 from public.community_posts where body = 'Girls brunch on Saturday?'), 'nor its posts directly');
select pg_temp.check(public.my_girl_status() = 'not_eligible', 'a man sees IRLY Girl closed');
select pg_temp.expect_denied($$select public.girl_suspend('00000000-0000-0000-0000-00000000000b', 'test')$$, 'only admins withdraw Girl access');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_denied($$insert into public.girl_suspensions (user_id, reason) values ('00000000-0000-0000-0000-00000000000d', 'nope')$$, 'no direct writes to suspensions');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.girl_suspend('00000000-0000-0000-0000-00000000000b', 'Reported several times by members');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.my_girl_status() = 'suspended', 'a suspended account is told so');
select pg_temp.check(not public.my_girl_access(), 'and loses IRLY Girl');
select pg_temp.expect_denied($$select * from public.girl_feed('dubai')$$, 'including the feed');
select pg_temp.check(not exists (select 1 from public.communities where girl_only), 'and the women-only communities');
update public.irly_match_profiles set visible = true where user_id = auth.uid();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.irly_match_profiles where user_id = '00000000-0000-0000-0000-00000000000b' and visible), 'and cannot reappear in discovery');
select pg_temp.check(not exists (select 1 from public.community_members where user_id = '00000000-0000-0000-0000-00000000000b' and community_id in ('40000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-0000000000a2')), 'suspension removes the women-only memberships');
select pg_temp.check(exists (select 1 from public.community_members where user_id = '00000000-0000-0000-0000-00000000000b' and community_id = '40000000-0000-0000-0000-0000000000a3'), 'and nothing else');
select pg_temp.check(exists (select 1 from public.community_posts where body = 'Girls brunch on Saturday?'), 'her posts are not deleted');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.girl_reinstate('00000000-0000-0000-0000-00000000000b');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check(public.my_girl_status() = 'open', 'reinstated, IRLY Girl opens again');
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
