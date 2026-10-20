-- IRLY Girl is women only, enforced by the server (RLS, security definer
-- checks, triggers), never by the app. Runs after irly_test.sql on the same
-- database (scripts/test-db.sh). TEST accounts only, ids prefixed b9170000-….
--
--   a1 Wen  woman, IRLY Girl access (the legit path)
--   a2 Gia  woman, hosts the women-only community, plan and Match profile
--   a3 Max  man (the attacker)
--   a4 Sue  woman whose IRLY Girl access was withdrawn (girl_suspensions),
--           deliberately left inside the women-only community and plan
--   a5 Noa  signed in, no profile yet (no gender declared)
--   a6 Ivy  a brand-new sign-in account creating her profile
--
-- Every attack is made as the API role (authenticated + a JWT subject) with
-- the table grants Supabase gives API roles. Each check raises if it fails.
\set ON_ERROR_STOP 1

-- Supabase grants table privileges to API roles; RLS decides the rows (as in irly_test.sql).
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
    raise exception 'FAIL girl_parity_security: %', label;
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
-- Rows a statement touches (0 when RLS hides them all, -1 when it fails).
create or replace function pg_temp.touched(stmt text) returns integer language plpgsql as $$
declare n integer;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
exception when others then
  return -1;
end $$;
-- Rows a query returns as the current role (-1 when it is refused).
create or replace function pg_temp.rows(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*) from (%s) x', q) into n;
  return n;
exception when others then
  return -1;
end $$;

-- ───────── Test accounts and IRLY Girl content (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('b9170000-0000-0000-0000-0000000000a1'), ('b9170000-0000-0000-0000-0000000000a2'),
  ('b9170000-0000-0000-0000-0000000000a3'), ('b9170000-0000-0000-0000-0000000000a4'),
  ('b9170000-0000-0000-0000-0000000000a5'), ('b9170000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('b9170000-0000-0000-0000-0000000000a1', 'Wen', '1994-03-03', 'woman', 'dubai'),
  ('b9170000-0000-0000-0000-0000000000a2', 'Gia', '1993-05-05', 'woman', 'dubai'),
  ('b9170000-0000-0000-0000-0000000000a3', 'Max', '1992-07-07', 'man', 'dubai'),
  ('b9170000-0000-0000-0000-0000000000a4', 'Sue', '1991-09-09', 'woman', 'dubai');

-- Women-only community GC (Gia owner; Wen and Sue members), an open community OC.
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('b9170000-0000-0000-0000-0000000000c1', 'dubai', 'Parity Girls Circle', 'girl', true, 'b9170000-0000-0000-0000-0000000000a2'),
  ('b9170000-0000-0000-0000-0000000000c2', 'dubai', 'Parity Girls Second', 'girl', true, 'b9170000-0000-0000-0000-0000000000a2'),
  ('b9170000-0000-0000-0000-0000000000c3', 'dubai', 'Parity Open Club', 'sport', false, 'b9170000-0000-0000-0000-0000000000a2');
insert into public.community_members (community_id, user_id, role) values
  ('b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000a2', 'owner'),
  ('b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000a1', 'member'),
  ('b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000a4', 'member'),
  ('b9170000-0000-0000-0000-0000000000c2', 'b9170000-0000-0000-0000-0000000000a2', 'owner'),
  ('b9170000-0000-0000-0000-0000000000c3', 'b9170000-0000-0000-0000-0000000000a2', 'owner');
insert into public.community_posts (id, community_id, author_id, body, media_paths, media_kind) values
  ('b9170000-0000-0000-0000-0000000000d1', 'b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000a2',
   'Parity: girls brunch on Friday', array['b9170000-0000-0000-0000-0000000000a2/brunch.jpg'], 'photo');
-- Women-only plans GA (Wen and Sue going) and GB (nobody yet), an open plan OA.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000a2', 'Parity girls padel', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'girls'),
  ('b9170000-0000-0000-0000-0000000000b2', 'b9170000-0000-0000-0000-0000000000a2', 'Parity girls yoga', 'sport', 'dubai', 'marina', now() + interval '4 days', true, 'girls'),
  ('b9170000-0000-0000-0000-0000000000b3', 'b9170000-0000-0000-0000-0000000000a2', 'Parity open run', 'sport', 'dubai', 'marina', now() + interval '4 days', false, 'all');
insert into public.activity_participants (activity_id, user_id, status) values
  ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000a1', 'going'),
  ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000a4', 'going');
insert into public.comments (id, target_type, target_id, author_id, body) values
  ('b9170000-0000-0000-0000-0000000000e1', 'activity', 'b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000a1', 'Parity: I bring rackets'),
  ('b9170000-0000-0000-0000-0000000000e2', 'community_post', 'b9170000-0000-0000-0000-0000000000d1', 'b9170000-0000-0000-0000-0000000000a1', 'Parity: count me in');
insert into public.likes (target_type, target_id, user_id) values
  ('activity', 'b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000a1'),
  ('community_post', 'b9170000-0000-0000-0000-0000000000d1', 'b9170000-0000-0000-0000-0000000000a1');
-- The chats the server opened for GC and GA, each with a message.
select id as gc_chat from public.conversations where community_id = 'b9170000-0000-0000-0000-0000000000c1' \gset
select id as ga_chat from public.conversations where activity_id = 'b9170000-0000-0000-0000-0000000000b1' \gset
select pg_temp.check(:'gc_chat' <> '' and :'ga_chat' <> '', 'setup: the women-only community and plan have their chats');
insert into public.messages (conversation_id, sender_id, body) values
  (:'gc_chat', 'b9170000-0000-0000-0000-0000000000a2', 'Parity: GC chat secret'),
  (:'ga_chat', 'b9170000-0000-0000-0000-0000000000a2', 'Parity: GA chat secret');
-- IRLY Match: Gia and Wen have verified Match profiles with photos.
update public.profiles set
  photo_paths = array[id::text || '/1.jpg', id::text || '/2.jpg', id::text || '/3.jpg'],
  verified_at = now(), verified_photos = array[id::text || '/1.jpg', id::text || '/2.jpg', id::text || '/3.jpg']
where id in ('b9170000-0000-0000-0000-0000000000a1', 'b9170000-0000-0000-0000-0000000000a2');
insert into public.irly_match_onboarding (user_id) values
  ('b9170000-0000-0000-0000-0000000000a1'), ('b9170000-0000-0000-0000-0000000000a2');
insert into public.irly_match_profiles (user_id, visible, goals, photo_paths, destination) values
  ('b9170000-0000-0000-0000-0000000000a1', true, '{new_friends}', array['b9170000-0000-0000-0000-0000000000a1/m1.jpg'], 'dubai'),
  ('b9170000-0000-0000-0000-0000000000a2', true, '{new_friends}', array['b9170000-0000-0000-0000-0000000000a2/m1.jpg'], 'dubai');
-- Sue's IRLY Girl access is withdrawn; she is left inside GC and GA on purpose
-- (the worst case: the rules must hold even for someone still listed there).
insert into public.girl_suspensions (user_id, reason) values ('b9170000-0000-0000-0000-0000000000a4', 'parity test');

-- ───────── 1. The man (Max) reads nothing of IRLY Girl ─────────
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a3');
select pg_temp.check(not public.my_girl_access(), 'man: my_girl_access is false');
select pg_temp.check(public.my_girl_status() = 'not_eligible', 'man: my_girl_status is not_eligible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000b2')$q$) = 0, 'man: girl-only activities are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'b9170000-0000-0000-0000-0000000000b3'$q$) = 1, 'man: (control) the open activity is visible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activity_participants where activity_id = 'b9170000-0000-0000-0000-0000000000b1'$q$) = 0, 'man: girl-only activity participants are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where girl_only and id::text like 'b9170000%'$q$) = 0, 'man: girl-only communities are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_members where community_id = 'b9170000-0000-0000-0000-0000000000c1'$q$) = 0, 'man: girl-only community members are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where community_id = 'b9170000-0000-0000-0000-0000000000c1'$q$) = 0, 'man: girl-only community posts are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'b9170000-0000-0000-0000-0000000000d1'$q$) = 0, 'man: a girl-only post read by id is invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.comments where id::text like 'b9170000%'$q$) = 0, 'man: comments on girl-only content are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.likes where target_id in ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000d1')$q$) = 0, 'man: likes on girl-only content are invisible');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', 'man: girl_feed is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai', true)$q$) = '42501', 'man: girl_feed (Moms) is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_circle('dubai')$q$) is not null, 'man: girl_circle is refused');
select pg_temp.check(pg_temp.fails($q$select public.irly_match_state()$q$) is not null, 'man: irly_match_state is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.irly_match_discover('{}'::jsonb, 20, 0)$q$) is not null, 'man: irly_match_discover is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.irly_my_matches()$q$) is not null, 'man: irly_my_matches is refused');
select pg_temp.check(pg_temp.fails($q$select public.irly_match_act('b9170000-0000-0000-0000-0000000000a1', 'like')$q$) is not null, 'man: irly_match_act is refused');
select pg_temp.check(pg_temp.fails($q$select public.complete_irly_match_onboarding()$q$) is not null, 'man: complete_irly_match_onboarding is refused');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_match_profiles$q$) = 0, 'man: no Girl Match profile is readable');
select pg_temp.check(pg_temp.fails($q$insert into public.irly_match_onboarding (user_id) values ('b9170000-0000-0000-0000-0000000000a3')$q$) is not null, 'man: cannot mark himself through Match onboarding');
select pg_temp.check(pg_temp.fails($q$insert into public.irly_match_profiles (user_id, visible, goals) values ('b9170000-0000-0000-0000-0000000000a3', true, '{new_friends}')$q$) is not null, 'man: cannot create a Girl Match profile');
select pg_temp.check(not private.can_read_match_photo('b9170000-0000-0000-0000-0000000000a2/m1.jpg'), 'man: cannot read a Girl Match photo (storage rule)');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversations where id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 0, 'man: girl-only chats are invisible');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 0, 'man: girl-only chat messages are invisible');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversation_members where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 0, 'man: girl-only chat members are invisible');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.chat_members(%L)$q$, :'gc_chat')) <= 0, 'man: chat_members of a girl-only chat returns nothing');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.my_conversations() where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 0, 'man: girl-only chats are not in his inbox');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, 'b9170000-0000-0000-0000-0000000000a3', 'hi')$q$, :'gc_chat')) is not null, 'man: cannot post into a girl-only community chat');
select pg_temp.check(pg_temp.fails(format($q$insert into public.conversation_members (conversation_id, user_id) values (%L, 'b9170000-0000-0000-0000-0000000000a3')$q$, :'ga_chat')) is not null, 'man: cannot add himself to a girl-only activity chat');

-- ───────── 2. The man cannot create or join IRLY Girl content ─────────
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
  values ('b9170000-0000-0000-0000-0000000000a3', 'Fake girls night', 'food', 'dubai', 'marina', now() + interval '2 days', true, 'girls')$q$) is not null, 'man: cannot create a girl-only activity');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
  values ('b9170000-0000-0000-0000-0000000000a3', 'Fake girls night', 'food', 'dubai', 'marina', now() + interval '2 days', false, 'girls')$q$) is not null, 'man: cannot create a girls-audience activity that is not girl-only');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, community_id)
  values ('b9170000-0000-0000-0000-0000000000a3', 'Into their circle', 'food', 'dubai', 'marina', now() + interval '2 days', 'b9170000-0000-0000-0000-0000000000c1')$q$) is not null, 'man: cannot create an activity inside a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.communities (city_id, name, category_id, girl_only, created_by)
  values ('dubai', 'Fake girls club', 'girl', true, 'b9170000-0000-0000-0000-0000000000a3')$q$) is not null, 'man: cannot create a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.communities (city_id, name, category_id, created_by, parent_id)
  values ('dubai', 'Fake subgroup', 'girl', 'b9170000-0000-0000-0000-0000000000a3', 'b9170000-0000-0000-0000-0000000000c1')$q$) is not null, 'man: cannot create a subgroup inside a girl-only community');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('b9170000-0000-0000-0000-0000000000b2', 'going')$q$) is not null, 'man: cannot join a girl-only activity');
select pg_temp.check(pg_temp.fails($q$select public.join_community('b9170000-0000-0000-0000-0000000000c2')$q$) is not null, 'man: cannot join a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.community_members (community_id, user_id, role) values ('b9170000-0000-0000-0000-0000000000c2', 'b9170000-0000-0000-0000-0000000000a3', 'member')$q$) is not null, 'man: cannot insert himself into a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.activity_participants (activity_id, user_id, status) values ('b9170000-0000-0000-0000-0000000000b2', 'b9170000-0000-0000-0000-0000000000a3', 'going')$q$) is not null, 'man: cannot insert himself into a girl-only activity');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values ('b9170000-0000-0000-0000-0000000000a3', 'activity', 'b9170000-0000-0000-0000-0000000000b1', 'hello')$q$) is not null, 'man: cannot comment on a girl-only activity');
select pg_temp.check(pg_temp.fails($q$select public.toggle_like('community_post', 'b9170000-0000-0000-0000-0000000000d1')$q$) is not null
  or pg_temp.rows($q$select 1 from public.likes where user_id = 'b9170000-0000-0000-0000-0000000000a3'$q$) = 0, 'man: cannot like a girl-only post');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (community_id, author_id, body) values ('b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000a3', 'hi girls')$q$) is not null, 'man: cannot post in a girl-only community');
-- Control: the open community and open plan stay open to him.
select pg_temp.check(pg_temp.fails($q$select public.join_community('b9170000-0000-0000-0000-0000000000c3')$q$) is null, 'man: (control) can join an open community');

-- ───────── 3. The gender lock and every eligibility column ─────────
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'woman' where id = 'b9170000-0000-0000-0000-0000000000a3'$q$) = '42501', 'man: cannot switch his own gender to woman');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('b9170000-0000-0000-0000-0000000000a3', 'Max', '1992-07-07', 'woman', 'dubai')
  on conflict (id) do update set gender = excluded.gender$q$) = '42501', 'man: an upsert cannot switch his gender either');
select pg_temp.check(pg_temp.touched($q$delete from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a3'$q$) <= 0, 'man: cannot delete his profile to declare again');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('b9170000-0000-0000-0000-0000000000a3', 'Maxine', '1992-07-07', 'woman', 'dubai')$q$) is not null, 'man: cannot insert a second profile as a woman');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('b9170000-0000-0000-0000-0000000000a5', 'Noa', '1992-07-07', 'woman', 'dubai')$q$) is not null, 'man: cannot create a woman''s profile for another sign-in account');
select pg_temp.check(pg_temp.fails($q$update public.profiles set verified_at = now(), verified_photos = photo_paths where id = 'b9170000-0000-0000-0000-0000000000a3'$q$) = '42501', 'man: cannot verify himself');
select pg_temp.check(pg_temp.fails($q$update public.profiles set is_admin = true where id = 'b9170000-0000-0000-0000-0000000000a3'$q$) is not null, 'man: cannot make himself admin');
select pg_temp.check(pg_temp.touched($q$update public.profiles set gender = 'woman' where id = 'b9170000-0000-0000-0000-0000000000a1'$q$) <= 0, 'man: cannot change a woman''s profile');
select pg_temp.check(pg_temp.fails($q$insert into public.girl_suspensions (user_id, reason) values ('b9170000-0000-0000-0000-0000000000a1', 'sabotage')$q$) is not null, 'man: cannot suspend a woman from IRLY Girl');
select pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values ('b9170000-0000-0000-0000-0000000000a3', 'admin')$q$) is not null, 'man: cannot give himself a staff role');

-- ───────── 4. Admin and staff functions ─────────
select pg_temp.check(not public.am_i_admin(), 'man: am_i_admin is false');
select pg_temp.check(pg_temp.fails($q$select public.girl_suspend('b9170000-0000-0000-0000-0000000000a1', 'sabotage')$q$) = '42501', 'man: girl_suspend is refused');
select pg_temp.check(pg_temp.fails($q$select public.girl_reinstate('b9170000-0000-0000-0000-0000000000a4')$q$) = '42501', 'man: girl_reinstate is refused');
select pg_temp.check(pg_temp.fails($q$select public.staff_set_role('b9170000-0000-0000-0000-0000000000a3', 'admin')$q$) is not null, 'man: staff_set_role is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.staff_list()$q$) is not null, 'man: staff_list is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.mod_users('', 20)$q$) is not null, 'man: mod_users is refused');
select pg_temp.check(pg_temp.fails($q$select public.mod_dashboard()$q$) is not null, 'man: mod_dashboard is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.verification_queue()$q$) is not null, 'man: verification_queue is refused');
select pg_temp.check(pg_temp.fails($q$select public.decide_verification(gen_random_uuid(), true, null)$q$) is not null, 'man: decide_verification is refused');

-- ───────── 5. Other people's private profile columns ─────────
select pg_temp.check(pg_temp.fails($q$select gender from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a1'$q$) = '42501', 'man: cannot read a woman''s gender column');
select pg_temp.check(pg_temp.fails($q$select birthdate from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a1'$q$) = '42501', 'man: cannot read a birthdate column');
select pg_temp.check(pg_temp.fails($q$select is_admin from public.profiles$q$) = '42501', 'man: cannot read is_admin');
select pg_temp.check(pg_temp.rows($q$select 1 from public.my_profile() where id <> 'b9170000-0000-0000-0000-0000000000a3'$q$) = 0, 'man: my_profile only returns his own row');
select pg_temp.check(pg_temp.rows($q$select 1 from public.girl_suspensions where user_id <> 'b9170000-0000-0000-0000-0000000000a3'$q$) = 0, 'man: cannot read who is suspended from IRLY Girl');

-- After every attempt nothing changed: he is still a man without IRLY Girl.
select pg_temp.as_admin();
select pg_temp.check((select gender = 'man' and not is_admin and verified_at is null and deleted_at is null from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a3'), 'after the attacks: Max is still a man, not admin, not verified');
select pg_temp.check((select count(*) = 1 from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a3'), 'after the attacks: Max still has exactly one profile');
select pg_temp.check(not exists (select 1 from public.community_members where user_id = 'b9170000-0000-0000-0000-0000000000a3' and community_id in ('b9170000-0000-0000-0000-0000000000c1', 'b9170000-0000-0000-0000-0000000000c2'))
  and not exists (select 1 from public.activity_participants where user_id = 'b9170000-0000-0000-0000-0000000000a3' and activity_id in ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000b2')),
  'after the attacks: Max is in no girl-only community or activity');
select pg_temp.check(not exists (select 1 from public.staff_roles where user_id = 'b9170000-0000-0000-0000-0000000000a3')
  and not exists (select 1 from public.girl_suspensions where user_id = 'b9170000-0000-0000-0000-0000000000a1')
  and not exists (select 1 from public.irly_match_profiles where user_id = 'b9170000-0000-0000-0000-0000000000a3'),
  'after the attacks: no staff role, no suspension of Wen, no Match profile for Max');
select pg_temp.check((select gender = 'woman' from public.profiles where id = 'b9170000-0000-0000-0000-0000000000a1'), 'after the attacks: Wen''s profile is untouched');
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a3');
select pg_temp.check(not public.my_girl_access(), 'after the attacks: Max still has no IRLY Girl access');

-- ───────── 6. The eligible woman (Wen) uses IRLY Girl normally ─────────
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.my_girl_access(), 'woman: my_girl_access is true');
select pg_temp.check(public.my_girl_status() = 'open', 'woman: my_girl_status is open');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('b9170000-0000-0000-0000-0000000000b1', 'b9170000-0000-0000-0000-0000000000b2')$q$) = 2, 'woman: sees the girl-only activities');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where girl_only and id::text like 'b9170000%'$q$) = 2, 'woman: sees the girl-only communities');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_members where community_id = 'b9170000-0000-0000-0000-0000000000c1'$q$) >= 2, 'woman: sees the girl-only community members');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'b9170000-0000-0000-0000-0000000000d1'$q$) = 1, 'woman: reads the girl-only post');
select pg_temp.check(pg_temp.rows($q$select 1 from public.girl_feed('dubai') where id = 'b9170000-0000-0000-0000-0000000000d1'$q$) = 1, 'woman: the post is in girl_feed');
select pg_temp.check(pg_temp.rows($q$select 1 from public.comments where id::text like 'b9170000%'$q$) = 2, 'woman: reads comments on girl-only content');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 2, 'woman: reads her girl-only chats');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, 'b9170000-0000-0000-0000-0000000000a1', 'Parity: see you')$q$, :'gc_chat')) is null, 'woman: writes in the girl-only community chat');
select pg_temp.check(pg_temp.fails($q$insert into public.comments (author_id, target_type, target_id, body) values ('b9170000-0000-0000-0000-0000000000a1', 'community_post', 'b9170000-0000-0000-0000-0000000000d1', 'Parity: yes!')$q$) is null, 'woman: comments on a girl-only post');
select pg_temp.check(pg_temp.fails($q$select public.toggle_like('activity', 'b9170000-0000-0000-0000-0000000000b2')$q$) is null, 'woman: likes a girl-only activity');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('b9170000-0000-0000-0000-0000000000b2', 'going')$q$) is null, 'woman: joins a girl-only activity');
select pg_temp.check(pg_temp.fails($q$select public.join_community('b9170000-0000-0000-0000-0000000000c2')$q$) is null, 'woman: joins a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
  values ('b9170000-0000-0000-0000-0000000000b4', 'b9170000-0000-0000-0000-0000000000a1', 'Parity girls sunset', 'sport', 'dubai', 'marina', now() + interval '2 days', true, 'girls')$q$) is null, 'woman: creates a girl-only activity');
select pg_temp.check(pg_temp.fails($q$insert into public.communities (id, city_id, name, category_id, girl_only, created_by)
  values ('b9170000-0000-0000-0000-0000000000c4', 'dubai', 'Parity Wen Circle', 'girl', true, 'b9170000-0000-0000-0000-0000000000a1')$q$) is null, 'woman: creates a girl-only community');
select pg_temp.check(pg_temp.fails($q$select public.irly_match_state()$q$) is null, 'woman: irly_match_state answers');
select pg_temp.check(pg_temp.rows($q$select 1 from public.irly_match_profiles where user_id = 'b9170000-0000-0000-0000-0000000000a1'$q$) = 1, 'woman: reads her own Match profile');
select pg_temp.check(private.can_read_match_photo('b9170000-0000-0000-0000-0000000000a2/m1.jpg'), 'woman: reads another woman''s Match photo (storage rule)');
select pg_temp.check(private.can_read_match_photo('b9170000-0000-0000-0000-0000000000a1/m1.jpg'), 'woman: reads her own Match photo');
select pg_temp.check(not private.can_read_match_photo('b9170000-0000-0000-0000-0000000000a2/not-in-profile.jpg'), 'woman: no Match photo that is not on a Match profile');
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'man' where id = 'b9170000-0000-0000-0000-0000000000a1'$q$) = '42501', 'woman: her gender is locked too');

-- ───────── 7. The suspended woman (Sue) is out, even while still listed ─────────
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a4');
select pg_temp.check(not public.my_girl_access(), 'suspended: my_girl_access is false');
select pg_temp.check(public.my_girl_status() = 'suspended', 'suspended: my_girl_status says suspended');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', 'suspended: girl_feed is refused');
select pg_temp.check(pg_temp.fails($q$select public.irly_match_state()$q$) is not null, 'suspended: Match is refused');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where girl_only and id::text like 'b9170000%'$q$) = 0, 'suspended: girl-only communities are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'b9170000-0000-0000-0000-0000000000d1'$q$) = 0, 'suspended: girl-only posts are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.comments where id::text like 'b9170000%'$q$) = 0, 'suspended: comments on girl-only content are invisible');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id in (%L, %L)$q$, :'gc_chat', :'ga_chat')) = 0, 'suspended: her girl-only chats are unreadable although she is still listed');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, 'b9170000-0000-0000-0000-0000000000a4', 'still here')$q$, :'gc_chat')) is not null, 'suspended: cannot write in a girl-only chat');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('b9170000-0000-0000-0000-0000000000b2', 'going')$q$) is not null, 'suspended: cannot join a girl-only activity');
select pg_temp.check(pg_temp.fails($q$select public.join_community('b9170000-0000-0000-0000-0000000000c2')$q$) is not null, 'suspended: cannot join a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience)
  values ('b9170000-0000-0000-0000-0000000000a4', 'Sue girls night', 'food', 'dubai', 'marina', now() + interval '2 days', true, 'girls')$q$) is not null, 'suspended: cannot create a girl-only activity');
select pg_temp.check(pg_temp.fails($q$insert into public.communities (city_id, name, category_id, girl_only, created_by)
  values ('dubai', 'Sue girls club', 'girl', true, 'b9170000-0000-0000-0000-0000000000a4')$q$) is not null, 'suspended: cannot create a girl-only community');
select pg_temp.check(not private.can_read_match_photo('b9170000-0000-0000-0000-0000000000a2/m1.jpg'), 'suspended: cannot read Match photos');
select pg_temp.check(pg_temp.touched($q$delete from public.girl_suspensions where user_id = 'b9170000-0000-0000-0000-0000000000a4'$q$) <= 0, 'suspended: cannot lift her own suspension');
select pg_temp.check(not public.my_girl_access(), 'suspended: still suspended afterwards');

-- ───────── 8. Signed in without a profile (no gender declared) ─────────
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a5');
select pg_temp.check(not public.my_girl_access(), 'no gender: my_girl_access is false');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', 'no gender: girl_feed is refused');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'b9170000-0000-0000-0000-0000000000b1'$q$) = 0, 'no gender: girl-only activities are invisible');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where girl_only and id::text like 'b9170000%'$q$) = 0, 'no gender: girl-only communities are invisible');
select pg_temp.check(pg_temp.fails($q$select public.join_community('b9170000-0000-0000-0000-0000000000c2')$q$) is not null, 'no gender: cannot join a girl-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.communities (city_id, name, category_id, girl_only, created_by)
  values ('dubai', 'Noa girls club', 'girl', true, 'b9170000-0000-0000-0000-0000000000a5')$q$) is not null, 'no gender: cannot create a girl-only community');

-- ───────── 9. Sign-up: a new account's profile row ─────────
-- No database trigger creates profiles: the app inserts its own row at sign-up
-- (features/auth/account.ts writeProfile). The row must be the caller's own id,
-- carry the declared gender, and nothing the server alone decides.
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a6');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('b9170000-0000-0000-0000-0000000000a5', 'Ivy', '1996-01-01', 'woman', 'dubai')$q$) is not null, 'signup: cannot create the profile of another account');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id, is_admin, verified_at, verified_photos, created_at)
  values ('b9170000-0000-0000-0000-0000000000a6', 'Ivy', '1996-01-01', 'woman', 'dubai', true, now(), array['x/1.jpg'], now() - interval '3 years')
  on conflict (id) do nothing$q$) is null, 'signup: the new account inserts its own profile');
select pg_temp.check((select id = 'b9170000-0000-0000-0000-0000000000a6' from public.my_profile()), 'signup: the profile row has the account''s own id');
select pg_temp.check((select gender = 'woman' from public.my_profile()), 'signup: the declared gender is stored');
select pg_temp.check(public.my_girl_access(), 'signup: the declared gender feeds IRLY Girl eligibility');
select pg_temp.check((select not is_admin from public.my_profile()), 'signup: admin cannot be self-granted at signup');
select pg_temp.check((select verified_at is null and verified_photos is null from public.my_profile()), 'signup: verification cannot be self-granted at signup');
select pg_temp.check((select created_at > now() - interval '1 hour' from public.my_profile()), 'signup: the account age cannot be backdated at signup');
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'man' where id = 'b9170000-0000-0000-0000-0000000000a6'$q$) = '42501', 'signup: the gender is locked right after signup');
select pg_temp.check(pg_temp.fails($q$update public.profiles set created_at = now() - interval '3 years' where id = 'b9170000-0000-0000-0000-0000000000a6'$q$) = '42501', 'signup: the account age cannot be backdated afterwards');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('b9170000-0000-0000-0000-0000000000a6', 'Ivy', '1996-01-01', 'man', 'dubai')
  on conflict (id) do nothing$q$) is null and (select gender = 'woman' from public.my_profile()), 'signup: publishing the profile again (retry) changes nothing');

-- ───────── 10. Storage (match-photos, post-media, chat-media), on a stand-in ─────────
-- Plain PostgreSQL has no storage schema, so the migrations skipped their
-- storage policies. A stand-in storage.objects gets the same policies (their
-- text copied from 20261005000200 photos_own_write, 20261020001000
-- match_photos_read, 20261018000000 post_media_read, 20261009003000
-- chat_media_read) inside a transaction that is rolled back.
select pg_temp.as_admin();
begin;
create schema storage;
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)]
$$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create policy photos_own_write on storage.objects for insert to authenticated
  with check (bucket_id in ('profile-photos', 'match-photos', 'irl-media') and (storage.foldername(name))[1] = auth.uid()::text
    and (bucket_id <> 'match-photos' or private.is_girl_eligible(auth.uid())));
create policy match_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'match-photos' and private.can_read_match_photo(name));
create policy post_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.community_posts p where p.deleted_at is null and (name = any (p.media_paths) or p.thumb_path = name))
  ));
create policy chat_media_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = name and m.deleted_at is null and private.is_member(m.conversation_id))
  ));
insert into storage.objects (bucket_id, name) values
  ('match-photos', 'b9170000-0000-0000-0000-0000000000a2/m1.jpg'),
  ('post-media', 'b9170000-0000-0000-0000-0000000000a2/brunch.jpg'),
  ('chat-media', 'b9170000-0000-0000-0000-0000000000a2/chat1.jpg');
insert into public.messages (conversation_id, sender_id, body, kind, media_path)
values (:'gc_chat', 'b9170000-0000-0000-0000-0000000000a2', 'Photo', 'photo', 'b9170000-0000-0000-0000-0000000000a2/chat1.jpg');

select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a3');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'match-photos') = 0, 'storage, man: lists no Match photo');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'post-media' and name like 'b9170000%') = 0, 'storage, man: cannot read a girl-only post''s photo');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'chat-media' and name like 'b9170000%') = 0, 'storage, man: cannot read a photo sent in a girl-only chat');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('match-photos', 'b9170000-0000-0000-0000-0000000000a3/me.jpg')$q$) is not null, 'storage, man: cannot upload into match-photos');
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'match-photos') = 0, 'storage, suspended: lists no Match photo');
select pg_temp.check((select count(*) from storage.objects where bucket_id in ('post-media', 'chat-media') and name like 'b9170000%') = 0, 'storage, suspended: no girl-only post or chat photo');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('match-photos', 'b9170000-0000-0000-0000-0000000000a4/me.jpg')$q$) is not null, 'storage, suspended: cannot upload into match-photos');
select pg_temp.as_user('b9170000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'match-photos') = 1, 'storage, woman: reads the Match photo');
select pg_temp.check((select count(*) from storage.objects where bucket_id in ('post-media', 'chat-media') and name like 'b9170000%') = 2, 'storage, woman: reads the girl-only post and chat photos');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('match-photos', 'b9170000-0000-0000-0000-0000000000a1/new.jpg')$q$) is null, 'storage, woman: uploads into her match-photos folder');
select pg_temp.check(pg_temp.fails($q$insert into storage.objects (bucket_id, name) values ('match-photos', 'b9170000-0000-0000-0000-0000000000a2/fake.jpg')$q$) is not null, 'storage, woman: never into another member''s folder');
select pg_temp.as_admin();
rollback;

select pg_temp.as_admin();
\echo 'girl_parity_security: ALL CHECKS PASSED'
