-- IRLY's official communities (20261028100000_irly_official_communities_four.sql):
-- the exact set per space with their names (IRLY 4, IRLY Girl 4 + Girl CEO
-- reached from IRLY Network only, IRLY Maman 1), the existing rows reused (same
-- ids, members, chat), every other official community retired (never
-- deleted, never listed or recommended, never made again) while its members
-- keep reading and posting, members still create communities (listed after
-- IRLY's), and IRLY Girl's / IRLY Maman's ones stay hidden from anyone
-- without IRLY Girl access.
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed c9a10000-….
--
--   a1 Ana  woman, IRLY Girl access
--   a2 Tom  man
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
    raise exception 'FAIL official_communities_four: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values ('c9a10000-0000-0000-0000-0000000000a1'), ('c9a10000-0000-0000-0000-0000000000a2');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('c9a10000-0000-0000-0000-0000000000a1', 'Ana', '1994-03-03', 'woman', 'dubai'),
  ('c9a10000-0000-0000-0000-0000000000a2', 'Tom', '1992-05-05', 'man', 'dubai');

-- The featured official communities: official, not retired, top level.
create temp view featured as
  select c.id, c.topic, c.name, c.city_id, c.girl_only from public.communities c
  where c.official and c.retired_at is null and c.parent_id is null and c.deleted_at is null;

-- ───────── 1. The exact official set of each space ─────────
select pg_temp.check((select array_agg(distinct topic collate "C" order by topic collate "C") from featured)
  = array['expats', 'girl_activity', 'girl_network', 'girl_newcomers', 'girl_sport', 'girl_trip', 'lifestyle', 'moms', 'network', 'sport'],
  'ten official topics in all: IRLY 4, IRLY Girl 4 + Girl CEO, IRLY Maman 1');
select pg_temp.check((select array_agg(name order by name collate "C") from featured where city_id = 'dubai' and not girl_only)
  = array['IRLY Activité', 'IRLY Expat', 'IRLY Network', 'IRLY Sport'], 'IRLY Dubai: IRLY Expat, Sport, Network, Activité');
select pg_temp.check(not exists (select 1 from featured where not girl_only group by city_id having count(*) <> 4)
  and (select count(distinct city_id) from featured where not girl_only) = 8, 'IRLY: the same four in each of its eight cities (Bali too)');
select pg_temp.check((select array_agg(name order by name collate "C") from featured where girl_only and topic like 'girl\_%')
  = array['Girl Activité', 'Girl CEO', 'Girl Expat', 'Girl Sport', 'Girl Trip'], 'IRLY Girl: Girl Trip, Expat, Activité, Sport, and Girl CEO (Dubai)');
select pg_temp.check((select array_agg(distinct name) from featured where topic = 'moms') = array['IRLY Mom Community'], 'IRLY Mom Community: one community, named IRLY Mom Community in every city');
select pg_temp.check(not exists (select 1 from featured where topic = 'moms' group by city_id having count(*) <> 1)
  and (select bool_and(girl_only) from featured where topic = 'moms'), 'IRLY Maman: one per city, women only');
select pg_temp.check(not exists (select 1 from public.communities where name ~* 'IRLY (Moms|Mama)\M' and official and deleted_at is null and retired_at is null),
  'no official community called IRLY Moms or IRLY Mama');
select pg_temp.check((select bool_and(girl_only) from featured where topic like 'girl\_%'), 'IRLY Girl: all women only');
select pg_temp.check((select description from public.communities where official and topic = 'lifestyle' and city_id = 'dubai') like 'A community to suggest and discover outings%',
  'IRLY Activité carries the owner''s description');
select pg_temp.check(not exists (select 1 from featured f join public.communities c using (id) where c.description is null and f.topic <> 'girl_network'),
  'every official community has its description');

-- ───────── 2. Reused rows: same community, same chat ─────────
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
  join public.messages m on m.conversation_id = v.id
  where c.official and c.topic = 'expats' and c.city_id = 'dubai' and c.name = 'IRLY Expat' and v.title = 'IRLY Expat' and m.body like 'Welcome to IRLY Expats %'),
  'IRLY Expat is the former IRLY Expats (its first chat message), chat renamed');
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
  join public.messages m on m.conversation_id = v.id
  where c.official and c.topic = 'moms' and c.city_id = 'dubai' and c.name = 'IRLY Mom Community' and v.title = 'IRLY Mom Community' and m.body like 'Welcome to IRLY Moms %'),
  'IRLY Mom Community is the former IRLY Moms (then IRLY Maman), chat renamed');
select pg_temp.check(exists (select 1 from public.communities c
  where c.official and c.topic = 'moms' and c.city_id = 'dubai' and exists (select 1 from public.communities g where g.parent_id = c.id and g.subtopic = 'toddlers')),
  '… with its groups');
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
  join public.messages m on m.conversation_id = v.id
  where c.official and c.topic = 'girl_network' and c.name = 'Girl CEO' and m.body like 'Welcome to IRLY Girl Networking %'),
  'Girl CEO is the former IRLY Girl Networking (same row, same chat)');
select pg_temp.check((select count(*) from public.communities where official and topic = 'girl_newcomers' and name = 'Girl Expat' and deleted_at is null) = 1,
  'Girl Expat is the former IRLY Nouvelle Arrivante, once');
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
  join public.messages m on m.conversation_id = v.id
  where c.official and c.topic = 'girl_sport' and m.kind = 'system' and m.body like 'Welcome to Girl Sport %suggest your own%'), 'a new one opens with its chat and welcome');

-- ───────── 3. Retired, never deleted ─────────
select pg_temp.check((select count(*) from public.communities where official and topic = 'gym' and parent_id is null and deleted_at is null)
  = (select cardinality(cities) from public.community_topics where topic = 'gym'), 'retired IRLY Gym: every row still there (no delete)');
select pg_temp.check(not exists (select 1 from public.communities where official and parent_id is null and deleted_at is null and retired_at is null
  and topic in ('newcomers', 'help', 'gym', 'football', 'running', 'wellness', 'trip', 'beach', 'food', 'culture', 'nights', 'shopping',
      'entrepreneurs', 'ecom', 'tech', 'ai', 'families', 'girls', 'girl_francophone')), 'every other official community is retired');
select pg_temp.check((select bool_and(official) from public.communities where retired_at is not null), 'retired ones stay official (only IRLY runs them)');
select pg_temp.check(not exists (select 1 from public.community_topics where active and topic in ('newcomers', 'help', 'gym', 'girls', 'girl_francophone', 'families')),
  'their topics are no longer active');
select pg_temp.check(not exists (select 1 from public.communities where retired_at is not null and parent_id is not null), 'groups are left as they are');

-- ensure_official_communities: idempotent, never brings a retired one back.
create temp table before_ensure as select id, name, retired_at from public.communities where official and parent_id is null and deleted_at is null;
select pg_temp.check(private.ensure_official_communities() = 0, 'ensure_official_communities: nothing to make');
select pg_temp.check(private.ensure_official_communities() = 0, '… again: nothing');
select pg_temp.check((select count(*) from public.communities where official and parent_id is null and deleted_at is null) = (select count(*) from before_ensure)
  and not exists (select 1 from before_ensure b join public.communities c using (id) where c.name <> b.name or c.retired_at is distinct from b.retired_at),
  '… same rows, names and retired marks');
select pg_temp.check(private.retire_official_communities() = 0, 'retiring again changes nothing');

-- ───────── 4. Lists and recommendations ─────────
select pg_temp.as_user('c9a10000-0000-0000-0000-0000000000a2');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') l join public.communities c using (id) where c.retired_at is not null), 'Tom: no retired community in the lists');
select pg_temp.check((select array_agg(name order by name collate "C") from public.community_list('dubai') where official and city_id = 'dubai')
  = array['IRLY Activité', 'IRLY Expat', 'IRLY Network', 'IRLY Sport'], 'Tom: Dubai''s official ones are the four of IRLY');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where girl_only), 'Tom: no women-only community listed');
select pg_temp.check((select array_agg(distinct topic collate "C" order by topic collate "C") from public.community_recommend('dubai', '{newcomer,type:expat,activity:gym,activity:football,goal:networking,interest:food,interest:family,goal:irlygirl}', 20))
  <@ array['expats', 'lifestyle', 'network', 'sport'], 'Tom: only the four of IRLY are recommended');

-- Members still create communities; IRLY's own come first in their city.
select public.create_community('c9a Book Club', 'dubai', 'Books and coffee', null, 'culture', false) as club_id \gset
select pg_temp.check(exists (select 1 from public.community_list('dubai') where id = :'club_id' and not official and is_member), 'Tom created a community: listed, his');
select pg_temp.check((select max(n) from public.community_list('dubai') with ordinality l(id, name, tagline, category_id, girl_only, members, is_member, posts_week, city_id, official, topic, emoji, created_at, n)
    where official and city_id = 'dubai')
  < (select min(n) from public.community_list('dubai') with ordinality l(id, name, tagline, category_id, girl_only, members, is_member, posts_week, city_id, official, topic, emoji, created_at, n)
    where not official and city_id = 'dubai'), 'official ones first, then the members''');
select pg_temp.check(pg_temp.fails(format('update public.communities set retired_at = now() where id = %L', :'club_id')) = '42501', 'an owner cannot retire (hide) a community');

-- Women-only official ones: invisible to Tom whatever the road.
select pg_temp.check(not exists (select 1 from public.communities where topic in ('girl_trip', 'girl_newcomers', 'girl_sport', 'girl_network', 'girl_activity', 'moms')),
  'Tom: no IRLY Girl or IRLY Maman official community on a direct read (Girl CEO included)');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'Tom: girl_official_communities refused');

-- ───────── 5. A retired community's members keep everything ─────────
select pg_temp.as_admin();
select id as gym_id from public.communities where official and topic = 'gym' and city_id = 'dubai' and parent_id is null \gset
select pg_temp.as_user('c9a10000-0000-0000-0000-0000000000a1');
select public.join_community(:'gym_id') as gym_chat \gset
insert into public.community_posts (community_id, author_id, body) values (:'gym_id', auth.uid(), 'c9a leg day at 7');
select pg_temp.check(exists (select 1 from public.communities where id = :'gym_id'), 'Ana: the retired IRLY Gym still opens');
select pg_temp.check(exists (select 1 from public.community_feed(:'gym_id') where body = 'c9a leg day at 7'), 'Ana: she posts and reads its feed');
select pg_temp.check(exists (select 1 from public.member_communities(auth.uid()) where id = :'gym_id'), 'Ana: it is in « Mine »');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = :'gym_id'), '… but not in the lists');
select pg_temp.check(exists (select 1 from public.messages where conversation_id = :'gym_chat'), 'Ana: its chat history reads');

-- IRLY Girl and IRLY Maman for Ana.
select pg_temp.check((select array_agg(topic order by ord) from public.girl_official_communities() with ordinality g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport'], 'Ana: IRLY Girl lists its four (Trip, Expat, Activité, Sport), never Girl CEO');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where topic = 'girl_network' and name = 'Girl CEO' and official and girl_only),
  'Ana: Girl CEO is still read by IRLY Network (community_list), women only');
select pg_temp.check((select count(*) from public.communities where official and retired_at is null and parent_id is null and city_id = 'dubai'
  and topic = 'moms') = 1, 'Ana: reads IRLY Maman');
select id as maman_id from public.communities where official and topic = 'moms' and city_id = 'dubai' and parent_id is null \gset
select public.join_community(:'maman_id');
insert into public.community_posts (community_id, author_id, body) values (:'maman_id', auth.uid(), 'c9a stroller walk Saturday');
select pg_temp.check(exists (select 1 from public.girl_feed('dubai', true) where body = 'c9a stroller walk Saturday'), 'Ana: a post in IRLY Maman is in the Maman feed');
select pg_temp.check(not exists (select 1 from public.suggest_groups('dubai', 20) s join public.communities p on p.id = s.parent_id where p.retired_at is not null and not private.i_belong(p.id)),
  'no group of a retired community is suggested to someone outside it');

select pg_temp.as_admin();
delete from public.community_posts where body like 'c9a %';
