-- Server-side behaviour tests. Run with scripts/test-db.sh (plain PostgreSQL
-- plus tests/shim.sql). Each block raises if a rule does not hold.
\set ON_ERROR_STOP 1

-- Supabase grants table privileges to API roles; RLS decides the rows.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

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
select pg_temp.check((select count(*) from public.profiles) = 0, 'anon reads no profiles');
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

-- ───── Account deletion cascades ─────
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.profiles where first_name = 'Dina'), 'deleting the account removes the profile');
select pg_temp.check(not exists (select 1 from public.irly_match_profiles where user_id = '00000000-0000-0000-0000-00000000000d'), 'and the match profile');

\echo 'ALL TESTS PASSED'
