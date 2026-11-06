-- Messages by universe (migration 20261110100000_irly_chat_universe): the
-- inbox tells each chat's universe (Mixte, Girl, Mom, Network) and side
-- (women-only or not); a private chat has none and stays ONE chat for both
-- members, in every universe; nothing is copied; IRLY Girl chats stay out of
-- the inbox of anyone without IRLY Girl access; unread counts per universe add
-- up to the inbox's.
--   a1 Lina   woman, Mixte + IRLY Girl: runners (Mixte), girls padel (Girl),
--             mums (Mom), founders (Network, Mixte side), women founders
--             (Network, Girl side); a Mixte plan, a girls-only plan, a plan of
--             the girls padel community; a private chat with Omar
--   a2 Omar   man, Mixte: runners, founders, the Mixte plan, the private chat
--   a3 Sara   mom: girls padel, mums, the girls-only plans
--   a4 Karim  network member (man): founders
-- TEST accounts only, ids prefixed c4a10000-…. Everything is rolled back.
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
    raise exception 'FAIL chat_universe: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values ('c4a10000-0000-0000-0000-0000000000a1'), ('c4a10000-0000-0000-0000-0000000000a2'),
  ('c4a10000-0000-0000-0000-0000000000a3'), ('c4a10000-0000-0000-0000-0000000000a4');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c4a10000-0000-0000-0000-0000000000a1', 'Lina', '1994-01-01', 'woman', 'dubai'),
  ('c4a10000-0000-0000-0000-0000000000a2', 'Omar', '1990-01-01', 'man', 'dubai'),
  ('c4a10000-0000-0000-0000-0000000000a3', 'Sara', '1991-01-01', 'woman', 'dubai'),
  ('c4a10000-0000-0000-0000-0000000000a4', 'Karim', '1989-01-01', 'man', 'dubai');
insert into public.communities (id, city_id, name, created_by, girl_only, topic, category_id) values
  ('c4a10000-0000-0000-0000-0000000000f1', 'dubai', 'c4a runners', 'c4a10000-0000-0000-0000-0000000000a2', false, null, 'sport'),
  ('c4a10000-0000-0000-0000-0000000000f2', 'dubai', 'c4a girls padel', 'c4a10000-0000-0000-0000-0000000000a1', true, 'girls', 'sport'),
  ('c4a10000-0000-0000-0000-0000000000f3', 'dubai', 'c4a mums marina', 'c4a10000-0000-0000-0000-0000000000a3', true, 'moms', null),
  ('c4a10000-0000-0000-0000-0000000000f4', 'dubai', 'c4a founders', 'c4a10000-0000-0000-0000-0000000000a4', false, null, 'networking'),
  ('c4a10000-0000-0000-0000-0000000000f5', 'dubai', 'c4a women founders', 'c4a10000-0000-0000-0000-0000000000a1', true, null, 'networking');
insert into public.community_members (community_id, user_id, role) values
  ('c4a10000-0000-0000-0000-0000000000f1', 'c4a10000-0000-0000-0000-0000000000a2', 'owner'),
  ('c4a10000-0000-0000-0000-0000000000f1', 'c4a10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4a10000-0000-0000-0000-0000000000f2', 'c4a10000-0000-0000-0000-0000000000a1', 'owner'),
  ('c4a10000-0000-0000-0000-0000000000f2', 'c4a10000-0000-0000-0000-0000000000a3', 'member'),
  ('c4a10000-0000-0000-0000-0000000000f3', 'c4a10000-0000-0000-0000-0000000000a3', 'owner'),
  ('c4a10000-0000-0000-0000-0000000000f3', 'c4a10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4a10000-0000-0000-0000-0000000000f4', 'c4a10000-0000-0000-0000-0000000000a4', 'owner'),
  ('c4a10000-0000-0000-0000-0000000000f4', 'c4a10000-0000-0000-0000-0000000000a1', 'member'),
  ('c4a10000-0000-0000-0000-0000000000f4', 'c4a10000-0000-0000-0000-0000000000a2', 'member'),
  ('c4a10000-0000-0000-0000-0000000000f5', 'c4a10000-0000-0000-0000-0000000000a1', 'owner');
-- Plans: a Mixte one without community, a girls-only one without community, one of the girls padel community.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, community_id) values
  ('c4a10000-0000-0000-0000-0000000000b1', 'c4a10000-0000-0000-0000-0000000000a2', 'c4a sunset run', 'sport', 'dubai', 'marina', now() + interval '2 days', false, null),
  ('c4a10000-0000-0000-0000-0000000000b2', 'c4a10000-0000-0000-0000-0000000000a1', 'c4a girls brunch', 'food', 'dubai', 'marina', now() + interval '3 days', true, null),
  ('c4a10000-0000-0000-0000-0000000000b3', 'c4a10000-0000-0000-0000-0000000000a1', 'c4a padel night', 'sport', 'dubai', 'marina', now() + interval '4 days', true, 'c4a10000-0000-0000-0000-0000000000f2');
insert into public.activity_participants (activity_id, user_id, status) values
  ('c4a10000-0000-0000-0000-0000000000b1', 'c4a10000-0000-0000-0000-0000000000a1', 'going'),
  ('c4a10000-0000-0000-0000-0000000000b2', 'c4a10000-0000-0000-0000-0000000000a3', 'going'),
  ('c4a10000-0000-0000-0000-0000000000b3', 'c4a10000-0000-0000-0000-0000000000a3', 'going');
-- The private chat between Lina and Omar (friends).
insert into public.friendships (user_a, user_b, status, requested_by) values
  ('c4a10000-0000-0000-0000-0000000000a1', 'c4a10000-0000-0000-0000-0000000000a2', 'accepted', 'c4a10000-0000-0000-0000-0000000000a1');
insert into public.conversations (id, kind) values ('c4a10000-0000-0000-0000-0000000000d1', 'direct');
insert into public.conversation_members (conversation_id, user_id) values
  ('c4a10000-0000-0000-0000-0000000000d1', 'c4a10000-0000-0000-0000-0000000000a1'), ('c4a10000-0000-0000-0000-0000000000d1', 'c4a10000-0000-0000-0000-0000000000a2');

select id as k_mixte from public.conversations where community_id = 'c4a10000-0000-0000-0000-0000000000f1' \gset
select id as k_girl from public.conversations where community_id = 'c4a10000-0000-0000-0000-0000000000f2' \gset
select id as k_mom from public.conversations where community_id = 'c4a10000-0000-0000-0000-0000000000f3' \gset
select id as k_net from public.conversations where community_id = 'c4a10000-0000-0000-0000-0000000000f4' \gset
select id as k_netg from public.conversations where community_id = 'c4a10000-0000-0000-0000-0000000000f5' \gset
select id as a_mixte from public.conversations where activity_id = 'c4a10000-0000-0000-0000-0000000000b1' \gset
select id as a_girl from public.conversations where activity_id = 'c4a10000-0000-0000-0000-0000000000b2' \gset
select id as a_padel from public.conversations where activity_id = 'c4a10000-0000-0000-0000-0000000000b3' \gset
-- Everyone has read everything an hour ago: what follows is new.
update public.conversation_members set last_read_at = now() - interval '1 hour' where user_id::text like 'c4a10000-%';
select count(*) as messages_before from public.messages \gset

-- New messages: Omar in runners, founders, the Mixte plan and the private chat; Sara in girls padel, mums and both girls-only plans; Karim in founders.
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a2');
insert into public.messages (conversation_id, sender_id, body) values
  (:'k_mixte', auth.uid(), 'c4a 7am?'), (:'k_net', auth.uid(), 'c4a pitch night'), (:'a_mixte', auth.uid(), 'c4a meet at the pier'),
  ('c4a10000-0000-0000-0000-0000000000d1', auth.uid(), 'c4a hi Lina');
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a3');
insert into public.messages (conversation_id, sender_id, body) values
  (:'k_girl', auth.uid(), 'c4a court 3'), (:'k_mom', auth.uid(), 'c4a playdate'), (:'a_girl', auth.uid(), 'c4a table for 6'), (:'a_padel', auth.uid(), 'c4a rackets');
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a4');
insert into public.messages (conversation_id, sender_id, body) values (:'k_net', auth.uid(), 'c4a welcome all');

-- ───────── 1. Lina: every chat once, each in its universe ─────────
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a1');
create temp table lina as select * from public.my_conversations();
select pg_temp.check((select count(*) from lina) = 9 and (select count(distinct conversation_id) from lina) = 9, 'Lina: 9 chats, each listed once (no copy per universe)');
select pg_temp.check((select universe from lina where conversation_id = :'k_mixte') = 'mixte', 'runners: Mixte');
select pg_temp.check((select universe from lina where conversation_id = :'k_girl') = 'girl', 'girls padel: Girl');
select pg_temp.check((select universe from lina where conversation_id = :'k_mom') = 'mom', 'mums: Mom');
select pg_temp.check((select universe = 'network' and not women_only from lina where conversation_id = :'k_net'), 'founders: Network, Mixte side');
select pg_temp.check((select universe = 'network' and women_only from lina where conversation_id = :'k_netg'), 'women founders: Network, Girl side');
select pg_temp.check((select universe = 'mixte' and not women_only from lina where conversation_id = :'a_mixte'), 'the Mixte plan: Mixte');
select pg_temp.check((select universe = 'girl' and women_only from lina where conversation_id = :'a_girl'), 'the girls-only plan without community: Girl');
select pg_temp.check((select universe = 'girl' and women_only and ref_topic = 'girls' from lina where conversation_id = :'a_padel'), 'a plan of girls padel: its community''s universe (Girl)');
select pg_temp.check((select universe is null and not women_only from lina where conversation_id = 'c4a10000-0000-0000-0000-0000000000d1'), 'the private chat: no universe (every universe)');
select pg_temp.check((select ref_category = 'sport' and ref_topic is null from lina where conversation_id = :'k_mixte')
  and (select ref_category = 'food' from lina where conversation_id = :'a_girl'), 'what the picture needs: topic and category');
select pg_temp.check((select unread from lina where conversation_id = :'k_net') = 2 and (select unread from lina where conversation_id = :'k_girl') = 1,
  'unread counts are unchanged (founders 2, girls padel 1)');
-- The app's rule (src/features/universe): the Mixte app shows Mixte + Network (not women-only) + private chats; the Girl app Girl + Mom + Network (women-only) + private chats.
select pg_temp.check((select sum(unread) from lina where universe is null or universe = 'mixte' or (universe = 'network' and not women_only)) = 5,
  'Lina, Mixte app: 5 unread (runners 1, founders 2, Mixte plan 1, private 1)');
select pg_temp.check((select sum(unread) from lina where universe is null or universe in ('girl', 'mom') or (universe = 'network' and women_only)) = 5,
  'Lina, Girl app: 5 unread (girls padel 1, mums 1, two girls plans 2, private 1)');
select pg_temp.check((select sum(unread) from lina) = 9, 'Lina: 9 unread in all, the private chat counted once (5 + 5 - 1)');

-- ───────── 2. Omar (man) and Karim (network): the same private chat, no IRLY Girl chat ─────────
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a2');
create temp table omar as select * from public.my_conversations();
select pg_temp.check((select count(*) from omar) = 4, 'Omar: runners, founders, the Mixte plan, the private chat');
select pg_temp.check(not exists (select 1 from omar where universe in ('girl', 'mom') or women_only), 'Omar: no Girl, Mom or women-only chat');
select pg_temp.check(exists (select 1 from omar where conversation_id = 'c4a10000-0000-0000-0000-0000000000d1' and universe is null and title = 'Lina'),
  'Omar: the same private chat as Lina (one conversation)');
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) = 1 and bool_and(universe = 'network' and not women_only) from public.my_conversations()), 'Karim: founders only, Network (Mixte side)');

-- ───────── 3. Sara (mom) ─────────
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a3');
select pg_temp.check((select array_agg(universe order by universe) from public.my_conversations()) = array['girl', 'girl', 'girl', 'mom'],
  'Sara: girls padel, two girls plans (Girl) and mums (Mom)');

-- ───────── 4. Access ended: IRLY Girl chats leave the inbox, the rest stays ─────────
select pg_temp.as_admin();
insert into public.girl_suspensions (user_id, reason) values ('c4a10000-0000-0000-0000-0000000000a1', 'chat universe test');
select pg_temp.as_user('c4a10000-0000-0000-0000-0000000000a1');
select pg_temp.check((select array_agg(conversation_id::text order by conversation_id) from public.my_conversations())
  = (select array_agg(x order by x) from unnest(array[:'k_mixte', :'k_net', :'a_mixte', 'c4a10000-0000-0000-0000-0000000000d1']) x),
  'Lina suspended: only runners, founders, the Mixte plan and the private chat');
select pg_temp.as_admin();
delete from public.girl_suspensions where user_id = 'c4a10000-0000-0000-0000-0000000000a1';

-- ───────── 5. Nothing was copied ─────────
select pg_temp.check((select count(*) from public.messages) = :messages_before + 9, 'nine messages written, nine stored (no copy)');
select pg_temp.check((select count(*) from public.conversations where id = 'c4a10000-0000-0000-0000-0000000000d1' or community_id::text like 'c4a10000-%' or activity_id::text like 'c4a10000-%') = 9,
  'one conversation per chat: 5 communities, 3 plans, 1 private');
select pg_temp.check((select count(*) from public.conversations where kind = 'direct' and id = 'c4a10000-0000-0000-0000-0000000000d1') = 1, 'one private chat');
select pg_temp.check(not has_function_privilege('anon', 'public.my_conversations()', 'execute'), 'anon cannot read an inbox');

rollback;
