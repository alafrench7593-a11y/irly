-- IRLY Girl security re-audit (20261027100000_irly_girl_security.sql, on top
-- of girl_isolation.test.sql): the attack matrix of the women-only space.
-- Who: an eligible woman, a man, a woman whose access ends (suspension, then
-- a gender corrected by staff), an anonymous session, and an eligible woman
-- who is not a member of a private IRLY Girl community or chat. What: IRLY
-- Network in IRLY Girl, reactions and read receipts, sharing into chats
-- (plan cards), a plan or community turned open, protected profile fields, direct reads by
-- id, join RPCs, notifications and pushes, Realtime's configuration.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed d7a10000-….
--
--   b1 Amal  woman, IRLY Girl access, member of the women-only community GS
--   b2 Bea   woman, IRLY Girl access, owns GS and its plans
--   b3 Cleo  woman, IRLY Girl access, in no IRLY Girl community or chat
--   b4 Dan   man (the attacker)
--   b5 Eva   woman, suspended from IRLY Girl by staff (girl_suspend) mid-test
--   b6 Fay   woman who owns the women-only community GF, gender corrected to
--            « man » by staff mid-test (memberships left in place)
--   b8 Staff an IRLY admin
--   anon     the anon role (no session)
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL girl_security: %', label;
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
-- The error message a statement fails with, or null when it succeeds.
create or replace function pg_temp.says(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlerrm;
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

-- ───────── Accounts and content (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('d7a10000-0000-0000-0000-0000000000b1'), ('d7a10000-0000-0000-0000-0000000000b2'), ('d7a10000-0000-0000-0000-0000000000b3'),
  ('d7a10000-0000-0000-0000-0000000000b4'), ('d7a10000-0000-0000-0000-0000000000b5'), ('d7a10000-0000-0000-0000-0000000000b6'),
  ('d7a10000-0000-0000-0000-0000000000b8');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('d7a10000-0000-0000-0000-0000000000b1', 'Amal', '1994-03-03', 'woman', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b2', 'Bea', '1993-05-05', 'woman', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b3', 'Cleo', '1995-06-06', 'woman', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b4', 'Dan', '1992-07-07', 'man', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b5', 'Eva', '1991-09-09', 'woman', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b6', 'Fay', '1990-10-10', 'woman', 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b8', 'Staff', '1990-01-01', 'man', 'dubai', 'marina');
insert into public.staff_roles (user_id, role) values ('d7a10000-0000-0000-0000-0000000000b8', 'admin');

-- Professional profiles (IRLY Network): three women and the man, all visible.
insert into public.pro_profiles (user_id, role, job_title, industries, city_id, area_id) values
  ('d7a10000-0000-0000-0000-0000000000b1', 'founder', 'GirlSec founder', array['tech'], 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b2', 'freelancer', 'GirlSec designer', array['design'], 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b4', 'employee', 'GirlSec sales', array['tech'], 'dubai', 'marina'),
  ('d7a10000-0000-0000-0000-0000000000b5', 'investor', 'GirlSec investor', array['fintech'], 'dubai', null);

-- Women-only community GS (Bea owner; Amal, Eva members), women-only community GF (Fay owner), an open club.
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('d7a10000-0000-0000-0000-0000000000c1', 'dubai', 'GirlSec Circle', 'girl', true, 'd7a10000-0000-0000-0000-0000000000b2'),
  ('d7a10000-0000-0000-0000-0000000000c2', 'dubai', 'GirlSec Fay Club', 'girl', true, 'd7a10000-0000-0000-0000-0000000000b6'),
  ('d7a10000-0000-0000-0000-0000000000c3', 'dubai', 'GirlSec Open Club', 'sport', false, 'd7a10000-0000-0000-0000-0000000000b2');
insert into public.community_members (community_id, user_id, role) values
  ('d7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000b2', 'owner'),
  ('d7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000b1', 'member'),
  ('d7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000b5', 'member'),
  ('d7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000b6', 'member'),
  ('d7a10000-0000-0000-0000-0000000000c2', 'd7a10000-0000-0000-0000-0000000000b6', 'owner'),
  ('d7a10000-0000-0000-0000-0000000000c3', 'd7a10000-0000-0000-0000-0000000000b2', 'owner')
on conflict do nothing;
insert into public.community_posts (id, community_id, author_id, body) values
  ('d7a10000-0000-0000-0000-0000000000d1', 'd7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec: secret brunch spot');
-- Plans: women-only open (GA), women-only for GS members only (GM), women-only by invitation (GI), an open run.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience, privacy, community_id) values
  ('d7a10000-0000-0000-0000-0000000000a1', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec padel', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'girls', 'public', null),
  ('d7a10000-0000-0000-0000-0000000000a2', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec members dinner', 'food', 'dubai', 'marina', now() + interval '4 days', true, 'girls', 'community', 'd7a10000-0000-0000-0000-0000000000c1'),
  ('d7a10000-0000-0000-0000-0000000000a3', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec invite-only spa', 'wellness', 'dubai', 'marina', now() + interval '5 days', true, 'girls', 'invite', null),
  ('d7a10000-0000-0000-0000-0000000000a4', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec open run', 'sport', 'dubai', 'marina', now() + interval '6 days', false, 'all', 'public', null);
insert into public.activity_participants (activity_id, user_id, status) values
  ('d7a10000-0000-0000-0000-0000000000a1', 'd7a10000-0000-0000-0000-0000000000b1', 'going');
-- The community's chat (opened by the server) with a message; two direct chats of Amal: with Dan, with Bea.
select id as gs_chat from public.conversations where community_id = 'd7a10000-0000-0000-0000-0000000000c1' \gset
select pg_temp.check(:'gs_chat' <> '', 'setup: the women-only community has its chat');
insert into public.messages (id, conversation_id, sender_id, body) values
  ('d7a10000-0000-0000-0000-000000000101', :'gs_chat', 'd7a10000-0000-0000-0000-0000000000b2', 'GirlSec: chat secret');
insert into public.conversations (id, kind) values
  ('d7a10000-0000-0000-0000-0000000000e1', 'direct'), ('d7a10000-0000-0000-0000-0000000000e2', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('d7a10000-0000-0000-0000-0000000000e1', 'd7a10000-0000-0000-0000-0000000000b1'), ('d7a10000-0000-0000-0000-0000000000e1', 'd7a10000-0000-0000-0000-0000000000b4'),
  ('d7a10000-0000-0000-0000-0000000000e2', 'd7a10000-0000-0000-0000-0000000000b1'), ('d7a10000-0000-0000-0000-0000000000e2', 'd7a10000-0000-0000-0000-0000000000b2');
-- Amal is friends with both (so each may write to the other).
insert into public.friendships (user_a, user_b, requested_by, status, accepted_at) values
  ('d7a10000-0000-0000-0000-0000000000b1', 'd7a10000-0000-0000-0000-0000000000b4', 'd7a10000-0000-0000-0000-0000000000b1', 'accepted', now()),
  ('d7a10000-0000-0000-0000-0000000000b1', 'd7a10000-0000-0000-0000-0000000000b2', 'd7a10000-0000-0000-0000-0000000000b1', 'accepted', now());
-- Phones (push tokens) for the man, Fay and Amal, so a push would be queued if a notification reached them.
insert into public.push_tokens (token, user_id, platform, lang) values
  ('ExponentPushToken[girlsec-dan]', 'd7a10000-0000-0000-0000-0000000000b4', 'ios', 'en'),
  ('ExponentPushToken[girlsec-fay]', 'd7a10000-0000-0000-0000-0000000000b6', 'ios', 'en'),
  ('ExponentPushToken[girlsec-amal]', 'd7a10000-0000-0000-0000-0000000000b1', 'ios', 'en');
select set_config('gs.chat', :'gs_chat', false);

-- ───────── 1. IRLY Network in IRLY Girl: women only, refused to anyone else ─────────
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b1');
select pg_temp.check(exists (select 1 from public.pro_discover_girl('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b2'), 'network girl, Amal: lists Bea');
select pg_temp.check(not exists (select 1 from public.pro_discover_girl('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b4'), 'network girl, Amal: never lists the man');
select pg_temp.check(not exists (select 1 from public.pro_discover_girl('dubai', '{"q":"GirlSec sales"}') where user_id = 'd7a10000-0000-0000-0000-0000000000b4'), 'network girl, Amal: a search for his job does not find him');
select pg_temp.check(exists (select 1 from public.pro_discover_girl('dubai', '{"industry":"design"}') where user_id = 'd7a10000-0000-0000-0000-0000000000b2'), 'network girl, Amal: filters work');
select pg_temp.check(exists (select 1 from public.pro_discover('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b4'), 'network mixte (unchanged, older apps): pro_discover still lists everyone');
select pg_temp.check((select count(*) from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b2')) = 1, 'network girl, Amal: opens Bea''s profile');
select pg_temp.check((select count(*) from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b1')) = 1, 'network girl, Amal: opens her own profile');
select pg_temp.check((select count(*) from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b4')) = 0, 'network girl, Amal: the man''s profile (by id, from a link) is not shown');
select pg_temp.check((select count(*) from public.pro_profile_of('d7a10000-0000-0000-0000-0000000000b4')) = 1, 'network mixte: pro_profile_of unchanged');
-- Positions: the centre of the chosen neighbourhood, never a personal position.
select pg_temp.check((select d.lat = a.lat and d.lng = a.lng from public.pro_discover_girl('dubai') d, public.areas a
  where d.user_id = 'd7a10000-0000-0000-0000-0000000000b2' and a.city_id = 'dubai' and a.id = 'marina'), 'network: lat/lng are the neighbourhood centre (public.areas)');
select pg_temp.check((select lat is null and lng is null from public.pro_discover('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b5'), 'network: no neighbourhood, no position');
select pg_temp.check(pg_get_function_result('public.pro_discover_girl(text,jsonb,integer)'::regprocedure) = pg_get_function_result('public.pro_discover(text,jsonb,integer)'::regprocedure)
  and pg_get_function_result('public.pro_profile_of_girl(uuid)'::regprocedure) = pg_get_function_result('public.pro_profile_of(uuid)'::regprocedure), 'network girl: same columns as the Mixte functions');
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b4');
select pg_temp.check(pg_temp.says($q$select * from public.pro_discover_girl('dubai')$q$) = 'IRLY Girl is reserved for women', 'network girl, man: pro_discover_girl refused');
select pg_temp.check(pg_temp.fails($q$select * from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b2')$q$) = '42501', 'network girl, man: pro_profile_of_girl refused');
select pg_temp.check(exists (select 1 from public.pro_discover('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b2'), 'network mixte, man: (control) Mixte Network works for him');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.fails($q$select * from public.pro_discover_girl('dubai')$q$) = '42501', 'network girl, anon: not callable');
select pg_temp.check(pg_temp.fails($q$select * from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b2')$q$) = '42501', 'network girl, anon: profile not callable');

-- ───────── 2. The eligible woman who is not a member (private IRLY Girl community chat, plans) ─────────
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b3');
select pg_temp.check(public.my_girl_access(), 'Cleo: IRLY Girl access');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversations where id = %L$q$, :'gs_chat')) = 0, 'Cleo (not a member): the community chat, by id');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, :'gs_chat')) = 0, 'Cleo (not a member): its messages');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversation_members where conversation_id = %L$q$, :'gs_chat')) = 0, 'Cleo (not a member): its members');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.chat_members(%L)$q$, :'gs_chat')) = 0, 'Cleo (not a member): chat_members');
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'hi')$q$, :'gs_chat')) is not null, 'Cleo (not a member): cannot write in it');
select pg_temp.check(pg_temp.fails(format($q$insert into public.conversation_members (conversation_id, user_id) values (%L, auth.uid())$q$, :'gs_chat')) is not null, 'Cleo (not a member): cannot add herself to it');
select pg_temp.check(pg_temp.fails($q$insert into public.message_reactions (message_id, user_id, emoji) values ('d7a10000-0000-0000-0000-000000000101', auth.uid(), '❤️')$q$) is not null, 'Cleo (not a member): cannot react to its messages');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('d7a10000-0000-0000-0000-0000000000a2', 'd7a10000-0000-0000-0000-0000000000a3')$q$) = 0, 'Cleo: the members-only and invite-only women plans, by id');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('d7a10000-0000-0000-0000-0000000000a2', 'going')$q$) = 'P0002', 'Cleo: cannot join the members-only plan');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('d7a10000-0000-0000-0000-0000000000a3', 'going')$q$) = 'P0002', 'Cleo: cannot join the invite-only plan without an invitation');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activity_detail('d7a10000-0000-0000-0000-0000000000a2')$q$) <= 0, 'Cleo: activity_detail of the members-only plan');
select pg_temp.check(pg_temp.fails($q$select * from public.community_people('d7a10000-0000-0000-0000-0000000000c1')$q$) is not null, 'Cleo: community_people (moderators only)');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'd7a10000-0000-0000-0000-0000000000a1'$q$) = 1, 'Cleo: (control) the open women-only plan is hers to see');
select pg_temp.check(pg_temp.fails($q$select public.join_community('d7a10000-0000-0000-0000-0000000000c1')$q$) is null, 'Cleo: (control) IRLY Girl communities are open to women: she joins GS');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, :'gs_chat')) >= 1, 'Cleo: once a member, she reads the community chat');

-- ───────── 3. The man: reads by id, joins, writes around the rules ─────────
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b4');
select pg_temp.check(not public.my_girl_access(), 'man: no IRLY Girl access');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('d7a10000-0000-0000-0000-0000000000a1', 'd7a10000-0000-0000-0000-0000000000a2', 'd7a10000-0000-0000-0000-0000000000a3')$q$) = 0, 'man: women-only plans, by id');
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id = 'd7a10000-0000-0000-0000-0000000000a4'$q$) = 1, 'man: (control) the open plan');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where id in ('d7a10000-0000-0000-0000-0000000000c1', 'd7a10000-0000-0000-0000-0000000000c2')$q$) = 0, 'man: women-only communities, by id');
select pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'd7a10000-0000-0000-0000-0000000000d1'$q$) = 0, 'man: the women-only post, by id');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.conversations where id = %L$q$, :'gs_chat')) = 0, 'man: the girl chat, by id');
select pg_temp.check(pg_temp.rows($q$select 1 from public.messages where id = 'd7a10000-0000-0000-0000-000000000101'$q$) = 0, 'man: the girl chat message, by id');
select pg_temp.check(pg_temp.fails($q$select public.join_activity('d7a10000-0000-0000-0000-0000000000a1', 'going')$q$) = '42501', 'man: cannot join the women-only plan');
select pg_temp.check(pg_temp.fails($q$select public.join_community('d7a10000-0000-0000-0000-0000000000c1')$q$) is not null, 'man: cannot join the women-only community');
select pg_temp.check(pg_temp.rows($q$select 1 from public.join_communities(array['d7a10000-0000-0000-0000-0000000000c1'::uuid]) n where n > 0$q$) = 0, 'man: join_communities skips the women-only community');
select pg_temp.check(pg_temp.fails($q$insert into public.message_reactions (message_id, user_id, emoji) values ('d7a10000-0000-0000-0000-000000000101', auth.uid(), '👍')$q$) is not null, 'man: cannot react to a girl chat message by its id');
select pg_temp.check(pg_temp.fails($q$insert into public.message_reads (message_id, user_id) values ('d7a10000-0000-0000-0000-000000000101', auth.uid())$q$) is not null, 'man: cannot mark a girl chat message read by its id');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values (auth.uid(), 'fake', 'sport', 'dubai', 'marina', now() + interval '1 day', true, 'girls')$q$) is not null, 'man: cannot create a women-only plan');
select pg_temp.check(pg_temp.fails($q$select public.create_community('GirlSec fake', 'dubai', null, null, 'girl', true)$q$) is not null, 'man: cannot create a women-only community');
select pg_temp.check(pg_temp.rows($q$select 1 from public.map_activities('dubai', p_girl_only => true)$q$) = -1, 'man: the IRLY Girl map of plans is refused');
select pg_temp.check(pg_temp.fails($q$select * from public.map_people('dubai', true)$q$) = '42501', 'man: the IRLY Girl map of people is refused');
select pg_temp.check(pg_temp.rows($q$select 1 from public.map_activities('dubai') where id in ('d7a10000-0000-0000-0000-0000000000a1', 'd7a10000-0000-0000-0000-0000000000a2')$q$) = 0, 'man: the IRLY map shows no women-only plan');

-- ───────── 4. Protected fields: never set by the member, by UPDATE or by RPC ─────────
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'woman' where id = auth.uid()$q$) = '42501', 'man: cannot change his gender');
select pg_temp.check(pg_temp.fails($q$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Dan', '1992-07-07', 'woman', 'dubai') on conflict (id) do update set gender = excluded.gender$q$) = '42501', 'man: … nor by an upsert of his profile');
select pg_temp.check(pg_temp.fails($q$update public.profiles set is_admin = true where id = auth.uid()$q$) = '42501', 'man: cannot make himself admin (profiles.is_admin)');
select pg_temp.check(pg_temp.fails($q$update public.profiles set verified_at = now() where id = auth.uid()$q$) = '42501', 'man: cannot verify himself');
select pg_temp.check(pg_temp.fails($q$update public.profiles set verified_photos = array['x'] where id = auth.uid()$q$) = '42501', 'man: cannot set his verified photos');
select pg_temp.check(pg_temp.fails($q$insert into public.staff_roles (user_id, role) values (auth.uid(), 'owner')$q$) is not null, 'man: cannot give himself a staff role');
select pg_temp.check(pg_temp.touched($q$update public.staff_roles set role = 'owner'$q$) <= 0, 'man: cannot change staff roles');
select pg_temp.check(pg_temp.fails($q$select public.staff_set_role(auth.uid(), 'admin')$q$) is not null, 'man: staff_set_role refused');
select pg_temp.check(pg_temp.fails($q$select public.decide_verification(auth.uid(), true, null)$q$) is not null, 'man: decide_verification refused');
select pg_temp.check(pg_temp.fails($q$select public.girl_suspend('d7a10000-0000-0000-0000-0000000000b1', 'x')$q$) = '42501', 'man: cannot suspend a woman from IRLY Girl');
select pg_temp.check(pg_temp.rows($q$select gender from public.profiles where id = 'd7a10000-0000-0000-0000-0000000000b1'$q$) = -1, 'man: cannot read a member''s gender');
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.fails($q$update public.profiles set gender = 'man' where id = auth.uid()$q$) = '42501', 'Amal: the gender is locked for her too (staff corrects it)');
select pg_temp.check(pg_temp.fails($q$select public.girl_reinstate('d7a10000-0000-0000-0000-0000000000b5')$q$) is not null, 'Amal: cannot lift a suspension (girl_reinstate)');

-- ───────── 5. Sharing IRLY Girl content into a chat with a man ─────────
select pg_temp.check(pg_temp.says($q$select public.share_to_chat('d7a10000-0000-0000-0000-0000000000e1', 'activity', 'd7a10000-0000-0000-0000-0000000000a1', 'GirlSec padel')$q$) = 'IRLY Girl content stays in IRLY Girl', 'share: a women-only plan into Amal''s chat with Dan is refused');
select pg_temp.check(pg_temp.fails($q$select public.share_to_chat('d7a10000-0000-0000-0000-0000000000e1', 'community_post', 'd7a10000-0000-0000-0000-0000000000d1', 'brunch')$q$) = '42501', 'share: a women-only post into the chat with Dan is refused');
select pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, kind, body, ref_type, ref_id) values ('d7a10000-0000-0000-0000-0000000000e1', auth.uid(), 'share', 'GirlSec padel', 'activity', 'd7a10000-0000-0000-0000-0000000000a1')$q$) is not null, 'share: … nor by writing the message directly');
select pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, kind, body, ref_id) values ('d7a10000-0000-0000-0000-0000000000e1', auth.uid(), 'activity', 'GirlSec padel', 'd7a10000-0000-0000-0000-0000000000a1')$q$) is not null, 'share: … nor as a plan card without ref_type (messages_girl_card)');
select pg_temp.check(pg_temp.fails($q$select public.share_to_chat('d7a10000-0000-0000-0000-0000000000e1', 'activity', 'd7a10000-0000-0000-0000-0000000000a4', 'GirlSec open run')$q$) is null, 'share: (control) an open plan goes to the chat with Dan');
select pg_temp.check(pg_temp.fails($q$insert into public.messages (conversation_id, sender_id, body) values ('d7a10000-0000-0000-0000-0000000000e1', auth.uid(), 'hello Dan')$q$) is null, 'share: (control) Amal still writes to Dan');
select pg_temp.check(pg_temp.fails($q$select public.share_to_chat('d7a10000-0000-0000-0000-0000000000e2', 'activity', 'd7a10000-0000-0000-0000-0000000000a1', 'GirlSec padel')$q$) = '42501', 'share: IRLY Girl content stays in girl chats (even a chat between two women)');
select pg_temp.check(pg_temp.fails(format($q$select public.share_to_chat(%L, 'community_post', 'd7a10000-0000-0000-0000-0000000000d1', 'brunch')$q$, :'gs_chat')) is null, 'share: … and into the girl chat itself');
select pg_temp.check(pg_temp.fails($q$insert into public.message_reactions (message_id, user_id, emoji) values ('d7a10000-0000-0000-0000-000000000101', auth.uid(), '❤️')$q$) is null, 'Amal: (control) reacts in her girl chat');
select pg_temp.check(pg_temp.fails($q$insert into public.message_reads (message_id, user_id) values ('d7a10000-0000-0000-0000-000000000101', auth.uid())$q$) is null, 'Amal: (control) marks it read');
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from public.messages where conversation_id = 'd7a10000-0000-0000-0000-0000000000e1' and body like 'GirlSec padel%'), 'share: no women-only title reached the chat with Dan');
select pg_temp.check(not exists (select 1 from public.push_outbox where user_id = 'd7a10000-0000-0000-0000-0000000000b4' and (title || ' ' || body) like '%GirlSec padel%'), 'share: … nor his phone');
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b4');
select pg_temp.check(pg_temp.rows($q$select 1 from public.message_reactions where message_id = 'd7a10000-0000-0000-0000-000000000101'$q$) = 0, 'man: reads no reaction of the girl chat');
select pg_temp.check(pg_temp.rows($q$select 1 from public.push_outbox$q$) <= 0, 'man: the push queue is not readable');

-- ───────── 6. A women-only plan or community never turns open ─────────
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b2');
select pg_temp.check(pg_temp.says($q$update public.activities set girl_only = false, audience = 'all' where id = 'd7a10000-0000-0000-0000-0000000000a1'$q$) = 'a women-only plan stays women-only', 'Bea: her women-only plan cannot become open');
select pg_temp.check(pg_temp.says($q$update public.activities set girl_only = false, audience = 'all' where id = 'd7a10000-0000-0000-0000-0000000000a3'$q$) = 'a women-only plan stays women-only', 'Bea: … nor the one nobody joined yet (activities_girl_keep)');
select pg_temp.check(pg_temp.fails($q$update public.communities set girl_only = false where id = 'd7a10000-0000-0000-0000-0000000000c1'$q$) is not null, 'Bea: her women-only community cannot become open');
select pg_temp.check(pg_temp.touched($q$update public.activities set title = 'GirlSec padel, court 2' where id = 'd7a10000-0000-0000-0000-0000000000a1'$q$) = 1, 'Bea: (control) edits her plan');
select pg_temp.check(pg_temp.touched($q$update public.communities set tagline = 'GirlSec: Sunday brunches' where id = 'd7a10000-0000-0000-0000-0000000000c1'$q$) = 1, 'Bea: (control) edits her community');
select pg_temp.as_admin();
select set_config('request.jwt.claim.sub', 'd7a10000-0000-0000-0000-0000000000b8', false);
select pg_temp.check(pg_temp.fails($q$update public.activities set girl_only = false, audience = 'all' where id = 'd7a10000-0000-0000-0000-0000000000a3'$q$) is null, 'staff: can correct a plan''s audience');
select pg_temp.as_admin();
update public.activities set girl_only = true, audience = 'girls' where id = 'd7a10000-0000-0000-0000-0000000000a3';

-- ───────── 7. Revocation: Eva suspended (girl_suspend), Fay's gender corrected ─────────
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b5');
select pg_temp.check(public.my_girl_access() and exists (select 1 from public.pro_discover_girl('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b1'), 'Eva, before: IRLY Girl Network');
select pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, :'gs_chat')) >= 1, 'Eva, before: reads the community chat');
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b6');
select pg_temp.check(public.my_girl_access(), 'Fay, before: IRLY Girl access');
select pg_temp.as_admin();
select set_config('request.jwt.claim.sub', 'd7a10000-0000-0000-0000-0000000000b8', false);
select public.girl_suspend('d7a10000-0000-0000-0000-0000000000b5', 'GirlSec test');
update public.profiles set gender = 'man' where id = 'd7a10000-0000-0000-0000-0000000000b6';
select pg_temp.as_admin();
select pg_temp.check((select gender = 'man' from public.profiles where id = 'd7a10000-0000-0000-0000-0000000000b6')
  and exists (select 1 from public.community_members where community_id = 'd7a10000-0000-0000-0000-0000000000c2' and user_id = 'd7a10000-0000-0000-0000-0000000000b6' and role = 'owner'),
  'setup: Fay is no longer a woman on her account, still owner of GF');

create or replace function pg_temp.revoked(uid uuid, who text) returns void language plpgsql as $f$
declare
  gs text := current_setting('gs.chat');
begin
  perform pg_temp.as_user(uid);
  perform pg_temp.check(not public.my_girl_access(), who || ': no IRLY Girl access');
  perform pg_temp.check(pg_temp.fails($q$select * from public.pro_discover_girl('dubai')$q$) = '42501', who || ': IRLY Girl Network refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b1')$q$) = '42501', who || ': an IRLY Girl Network profile refused');
  perform pg_temp.check(pg_temp.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, gs)) = 0, who || ': the community chat is closed');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.messages where id = 'd7a10000-0000-0000-0000-000000000101'$q$) = 0, who || ': its message, by id');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.community_posts where id = 'd7a10000-0000-0000-0000-0000000000d1'$q$) = 0, who || ': the women-only post, by id');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.activities where id in ('d7a10000-0000-0000-0000-0000000000a1', 'd7a10000-0000-0000-0000-0000000000a2')$q$) = 0, who || ': women-only plans, by id');
  perform pg_temp.check(pg_temp.fails($q$insert into public.message_reactions (message_id, user_id, emoji) values ('d7a10000-0000-0000-0000-000000000101', auth.uid(), '😈')$q$) is not null, who || ': cannot react in the girl chat');
  perform pg_temp.check(pg_temp.fails($q$select public.join_activity('d7a10000-0000-0000-0000-0000000000a1', 'going')$q$) = '42501', who || ': cannot join a women-only plan');
  perform pg_temp.check(pg_temp.fails($q$select * from public.girl_circle('dubai')$q$) is not null, who || ': girl_circle refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.irl_feed_girl('dubai')$q$) = '42501', who || ': irl_feed_girl refused');
  perform pg_temp.check(pg_temp.fails($q$select * from public.map_people('dubai', true)$q$) = '42501', who || ': IRLY Girl map of people refused');
  perform pg_temp.check(pg_temp.rows($q$select 1 from public.notifications where payload::text like '%d7a10000-0000-0000-0000-0000000000c1%' or payload::text like '%d7a10000-0000-0000-0000-0000000000a1%'$q$) = 0, who || ': no notification about IRLY Girl content');
end $f$;
select pg_temp.revoked('d7a10000-0000-0000-0000-0000000000b5', 'suspended Eva');
select pg_temp.revoked('d7a10000-0000-0000-0000-0000000000b6', 'corrected Fay');

-- The revoked owner: her community keeps its words (an UPDATE without WHERE reads no column).
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b6');
select pg_temp.check(pg_temp.touched($q$update public.communities set tagline = 'hacked'$q$) <= 0, 'corrected Fay: cannot rewrite the women-only community she owns');
select pg_temp.as_admin();
select pg_temp.check((select tagline is distinct from 'hacked' from public.communities where id = 'd7a10000-0000-0000-0000-0000000000c2'), 'revocation: GF unchanged');

-- Network: the others no longer list them.
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b1');
select pg_temp.check(not exists (select 1 from public.pro_discover_girl('dubai') where user_id = 'd7a10000-0000-0000-0000-0000000000b5'), 'network girl, Amal: suspended Eva is no longer listed');
select pg_temp.check((select count(*) from public.pro_profile_of_girl('d7a10000-0000-0000-0000-0000000000b5')) = 0, 'network girl, Amal: … nor her profile');

-- Notifications and pushes after revocation: Bea posts in GS and writes in its chat, where Fay is still a member.
select pg_temp.as_admin();
select coalesce(max(id), 0) as push_before from public.push_outbox \gset
select pg_temp.as_user('d7a10000-0000-0000-0000-0000000000b2');
insert into public.community_posts (community_id, author_id, body) values ('d7a10000-0000-0000-0000-0000000000c1', auth.uid(), 'GirlSec: after the revocation');
insert into public.messages (conversation_id, sender_id, body) values (:'gs_chat', auth.uid(), 'GirlSec: chat after the revocation');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.notifications where user_id = 'd7a10000-0000-0000-0000-0000000000b1' and kind = 'COMMUNITY_POST' and payload ->> 'body' like 'GirlSec: after%'),
  'notifications: (control) Amal is told of the new post');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'd7a10000-0000-0000-0000-0000000000b6' and payload ->> 'body' like 'GirlSec: after%'),
  'notifications: Fay (revoked, still listed as a member) is not');
select pg_temp.check(exists (select 1 from public.push_outbox where id > :push_before and user_id <> 'd7a10000-0000-0000-0000-0000000000b6'),
  'push: (control) pushes are queued for this post and message');
select pg_temp.check(not exists (select 1 from public.push_outbox where id > :push_before and user_id in ('d7a10000-0000-0000-0000-0000000000b6', 'd7a10000-0000-0000-0000-0000000000b5', 'd7a10000-0000-0000-0000-0000000000b4')),
  'push: nothing queued for the revoked members or the man after the revocation');
select pg_temp.check(not exists (select 1 from public.notifications where user_id = 'd7a10000-0000-0000-0000-0000000000b6' and kind = 'MESSAGE_CREATED'
    and payload ->> 'conversation_id' = :'gs_chat' and created_at >= (select max(created_at) from public.messages where body = 'GirlSec: chat after the revocation')),
  'notifications: Fay is not told of the girl chat''s new message');
select pg_temp.check((select bool_and(private.push_message(o) -> 'data' ?& array['url', 'notification_id']
    and (select count(*) from jsonb_object_keys(private.push_message(o) -> 'data')) = 2) from public.push_outbox o),
  'push: the payload''s data carries only the screen and the notification id (the app reads the rest under RLS)');

-- ───────── 8. Anonymous (no session) ─────────
select pg_temp.as_anon();
select pg_temp.check(pg_temp.rows($q$select 1 from public.activities where girl_only$q$) <= 0, 'anon: no women-only plan');
select pg_temp.check(pg_temp.rows($q$select 1 from public.communities where girl_only$q$) <= 0, 'anon: no women-only community');
select pg_temp.check(pg_temp.rows($q$select 1 from public.messages$q$) <= 0, 'anon: no message');
select pg_temp.check(pg_temp.rows($q$select 1 from public.notifications$q$) <= 0, 'anon: no notification');
select pg_temp.check(pg_temp.rows($q$select 1 from public.pro_profiles$q$) <= 0, 'anon: no professional profile');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) is not null, 'anon: girl_feed refused');
select pg_temp.check(pg_temp.fails($q$select * from public.my_girl_status()$q$) is not null, 'anon: my_girl_status not callable (IRLY Girl never open)');
select pg_temp.check(pg_temp.rows($q$select 1 from public.place_activities('marina') a join public.activities x on x.id = a.id where x.girl_only$q$) <= 0, 'anon: place_activities lists no women-only plan');
select pg_temp.as_admin();

-- ───────── 9. Realtime: configuration of what may be published ─────────
-- Realtime sends a change only to subscribers whose read rules (RLS, and
-- column privileges) let them select the row. Each table that can carry IRLY
-- Girl rows must have RLS on and a read rule.
select pg_temp.check(not exists (
  select 1 from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname
                and k.column_name in ('girl_only', 'app_scope', 'conversation_id', 'community_id', 'activity_id', 'target_id', 'message_id', 'match_id', 'post_id'))
    and (not c.relrowsecurity or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname and p.cmd in ('SELECT', 'ALL')))),
  'realtime: every table that can point at IRLY Girl content has RLS and a read rule');
-- The tables the migrations add to supabase_realtime (20261005000200, 000500, 000600, 001200, 20261008003500,
-- 20261009003000, 20261019000400, 20261020000500, 20261020000700).
select pg_temp.check(not exists (
  select 1 from unnest(array['messages', 'irly_matches', 'notifications', 'activity_participants', 'conversation_members', 'irl_posts', 'friendships',
    'likes', 'comments', 'community_posts', 'activities', 'community_poll_votes', 'communities', 'community_members', 'conversations', 'profiles',
    'saves', 'follows', 'community_activity_pins', 'community_channels', 'community_pins', 'message_removals', 'sync_signals']) t
  left join pg_class c on c.relname = t and c.relnamespace = 'public'::regnamespace
  where c.oid is null or not c.relrowsecurity
     or not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.cmd in ('SELECT', 'ALL'))),
  'realtime: each published table exists, with RLS on and a read rule');
select pg_temp.check(not exists (select 1 from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
    and c.relreplident = 'f' and not c.relrowsecurity),
  'realtime: tables published with their old rows (replica identity full) all have RLS (a delete then carries only the key)');
select pg_temp.check(not has_column_privilege('authenticated', 'public.profiles', 'gender', 'select'), 'realtime: profiles is published, but its gender column is not selectable (never sent)');
select pg_temp.check(not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('push_outbox', 'push_tokens') and cmd in ('SELECT', 'ALL') and qual not like '%auth.uid()%'),
  'push: no read rule on the push queue or tokens beyond the owner''s');
-- The restrictive IRLY Girl rules the published tables rely on are in place.
select pg_temp.check((select count(*) from pg_policies where schemaname = 'public' and permissive = 'RESTRICTIVE' and policyname in (
    'activities_girl_only', 'comments_girl_only', 'conversation_members_girl_chat', 'conversations_girl_chat', 'messages_girl_chat',
    'notifications_girl_only', 'message_removals_girl_chat', 'matches_girl_only', 'match_actions_girl_only',
    'messages_girl_card')) = 10,
  'realtime / writes: every restrictive IRLY Girl rule is present');

select pg_temp.as_admin();
\echo 'girl_security: ALL CHECKS PASSED'
