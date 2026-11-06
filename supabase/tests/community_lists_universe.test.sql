-- Community lists and their photos, universes and members' autonomy
-- (migration 20261110200000_irly_community_list_covers):
--   1. every list RPC the app reads returns each community's own photo
--      (cover_path), with the real value, never a generic one;
--   2. a man never gets an IRLY Girl, Mom or women-only Network community,
--      whatever he asks directly (lists, detail, header, members, chat,
--      activities, join, a profile's communities, a direct select);
--   3. any member (not only the hosts) of a Mixte, IRLY Girl or Mom
--      community posts, talks in its chat, sees its members and creates an
--      activity that stays linked to it; a non-member does not.
-- Runs in one transaction rolled back at the end: later files see nothing of it.
-- TEST accounts only, ids b2c00000-….
--
--   01 Nina  woman, IRLY Girl access: a plain member everywhere
--   02 Ada   woman, IRLY Girl access: owns the communities
--   03 Max   man: a member of the Mixte community only
--   04 Bea   woman, IRLY Girl access: a member of none
--   05 Eve   woman, IRLY Girl access: owns the two Network communities
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
  if not coalesce(ok, false) then raise exception 'FAIL community_lists_universe: %', label; end if;
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
-- How many rows a query returns (-1 when it fails).
create or replace function pg_temp.rows(q text) returns integer language plpgsql as $$
declare n integer;
begin
  execute format('select count(*) from (%s) x', q) into n;
  return n;
exception when others then
  return -1;
end $$;

-- ───────── 1. Every list RPC the app reads says the photo ─────────
-- The community lists of the app (communities.tsx, data.ts, directory.ts,
-- official.ts, network/hub.ts, profile/member.ts, girl/GirlOfficial.tsx).
select pg_temp.check(pg_get_function_result(p.oid) ~ '\mcover_path text\M', 'list RPC returns cover_path: ' || p.oid::regprocedure::text)
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('community_list', 'community_directory', 'community_recommend', 'member_communities',
    'girl_official_communities', 'mom_official_communities');
select pg_temp.check((select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('community_list', 'community_directory', 'community_recommend', 'member_communities',
      'girl_official_communities', 'mom_official_communities')) = 6,
  'the six community list RPCs exist, once each');
select pg_temp.check(not has_function_privilege('anon', 'public.community_list(text)', 'execute')
    and not has_function_privilege('anon', 'public.community_directory(text, text, text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.community_recommend(text, text[], integer)', 'execute')
    and has_function_privilege('authenticated', 'public.community_list(text)', 'execute')
    and has_function_privilege('authenticated', 'public.community_directory(text, text, text, integer)', 'execute')
    and has_function_privilege('authenticated', 'public.community_recommend(text, text[], integer)', 'execute'),
  'same grants as before: signed-in members only');

-- ───────── Accounts and communities (server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) select ('b2c00000-0000-0000-0000-0000000000' || lpad(g::text, 2, '0'))::uuid from generate_series(1, 5) g;
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('b2c00000-0000-0000-0000-000000000001', 'Nina', '1992-01-01', 'woman', 'dubai'),
  ('b2c00000-0000-0000-0000-000000000002', 'Ada', '1991-01-01', 'woman', 'dubai'),
  ('b2c00000-0000-0000-0000-000000000003', 'Max', '1990-01-01', 'man', 'dubai'),
  ('b2c00000-0000-0000-0000-000000000004', 'Bea', '1993-01-01', 'woman', 'dubai'),
  ('b2c00000-0000-0000-0000-000000000005', 'Eve', '1994-01-01', 'woman', 'dubai');
update public.profiles set created_at = now() - interval '90 days' where id::text like 'b2c00000-%';
update public.profiles set verified_at = now() where gender = 'woman' and id::text like 'b2c00000-%';

-- Ada and Eve create them as the app does (owners, with their chat; at most 3 a day each).
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000002');
insert into ids values
  ('mixte', public.create_community('B2c Marina Runners', 'dubai', 'Runs at 6', 'Mixed runs on the beach', 'sport', false)),
  ('girl', public.create_community('B2c Girls Brunch', 'dubai', 'Sunday brunch', 'Women only brunch club', 'food', true)),
  ('mom', public.create_community('B2c Mom Picnics', 'dubai', 'With the kids', 'Moms meet in the park', 'family', true));
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000005');
insert into ids values
  ('netw', public.create_community('B2c Women Founders', 'dubai', 'Founders', 'Women founders meet', 'networking', true)),
  ('netm', public.create_community('B2c Founders Mixed', 'dubai', 'Founders', 'Founders meet', 'networking', false));
select pg_temp.as_admin();
-- A Mom community is one with a Mom topic (universe.ts / private.community_universe).
update public.communities set topic = 'mom_sport' where id = (select v from ids where k = 'mom');
-- Their own photos, uploaded by Ada.
update public.communities set cover_path = 'b2c00000-0000-0000-0000-000000000002/' || k || '.jpg'
from ids where communities.id = ids.v and k in ('mixte', 'girl', 'mom', 'netw');
-- One with no photo of its own: the app shows IRLY's photo of its subject (null here, never a generic path).
select pg_temp.check((select cover_path from public.communities where id = (select v from ids where k = 'netm')) is null, 'setup: one community without a photo');

select pg_temp.check(private.community_universe((select v from ids where k = 'mixte')) = 'mixte'
    and private.community_universe((select v from ids where k = 'girl')) = 'girl'
    and private.community_universe((select v from ids where k = 'mom')) = 'mom'
    and private.community_universe((select v from ids where k = 'netw')) = 'network'
    and private.community_universe((select v from ids where k = 'netm')) = 'network',
  'universes: Mixte, Girl, Mom, Network (women-only and mixed)');

-- ───────── 1b. The real photo, in every list ─────────
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
select pg_temp.check((select cover_path from public.community_list('dubai') where id = (select v from ids where k = 'girl')) = 'b2c00000-0000-0000-0000-000000000002/girl.jpg'
    and (select cover_path from public.community_list('dubai') where id = (select v from ids where k = 'mixte')) = 'b2c00000-0000-0000-0000-000000000002/mixte.jpg'
    and (select cover_path from public.community_list('dubai') where id = (select v from ids where k = 'netm')) is null,
  'community_list: each community''s own photo (null when it has none)');
select pg_temp.check((select cover_path from public.community_directory('dubai', 'members', null, 200) where id = (select v from ids where k = 'mom')) = 'b2c00000-0000-0000-0000-000000000002/mom.jpg'
    and (select cover_path from public.community_directory('dubai', 'recent', 'B2c Women', 50) where id = (select v from ids where k = 'netw')) = 'b2c00000-0000-0000-0000-000000000002/netw.jpg',
  'community_directory: the photo, sorted and searched alike');
select pg_temp.check((select bool_and(r.cover_path is not distinct from c.cover_path)
    from public.community_recommend('dubai', array['interest:sport', 'interest:padel', 'newcomer'], 20) r
    join public.communities c on c.id = r.id),
  'community_recommend: the photo of each recommended community, as stored');
select pg_temp.as_admin();
update public.communities set cover_path = 'b2c00000-0000-0000-0000-000000000002/irly-sport.jpg'
where official and topic = 'sport' and city_id = 'dubai' and deleted_at is null;
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', array['interest:sport', 'activity:running', 'newcomer'], 20) r
    where r.topic = 'sport' and r.cover_path = 'b2c00000-0000-0000-0000-000000000002/irly-sport.jpg'),
  'community_recommend: an official community with a photo set by IRLY shows it');

-- ───────── 2. A man, whatever he asks ─────────
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000003');
select pg_temp.check((select count(*) from public.community_list('dubai') where girl_only) = 0
    and exists (select 1 from public.community_list('dubai') where id = (select v from ids where k = 'mixte') and cover_path = 'b2c00000-0000-0000-0000-000000000002/mixte.jpg'),
  'man, community_list: no women-only community, the Mixte one with its photo');
select pg_temp.check((select count(*) from public.community_directory('dubai', 'members', null, 200) where girl_only) = 0
    and (select count(*) from public.community_directory('dubai', 'recent', 'B2c', 200)) = 2,
  'man, community_directory: no women-only community, even searched by name');
select pg_temp.check((select count(*) from public.community_recommend('dubai', array['interest:sport', 'interest:food', 'type:family', 'goal:network', 'newcomer', 'lang:fr'], 20) where girl_only) = 0,
  'man, community_recommend: no Girl or Mom twin');
select pg_temp.check((select count(*) from public.communities where id in (select v from ids where k in ('girl', 'mom', 'netw'))) = 0,
  'man, direct select: no women-only community row');
select pg_temp.check((select count(*) from public.member_communities('b2c00000-0000-0000-0000-000000000002') where girl_only) = 0,
  'man, a woman''s profile: none of her women-only communities');
select pg_temp.check(pg_temp.rows(format('select * from public.community_detail(%L)', (select v from ids where k = k2.k))) <= 0, 'man, community_detail: nothing for ' || k2.k)
from (values ('girl'), ('mom'), ('netw')) k2 (k);
select pg_temp.check(pg_temp.fails(format('select public.community_header(%L)', (select v from ids where k = k2.k))) is not null, 'man, community_header: refused for ' || k2.k)
from (values ('girl'), ('mom'), ('netw')) k2 (k);
select pg_temp.check(pg_temp.rows(format('select * from public.community_members_list(%L)', (select v from ids where k = k2.k))) <= 0, 'man, community_members_list: nothing for ' || k2.k)
from (values ('girl'), ('mom'), ('netw')) k2 (k);
select pg_temp.check(pg_temp.rows(format('select * from public.community_activities(%L)', (select v from ids where k = k2.k))) <= 0, 'man, community_activities: nothing for ' || k2.k)
from (values ('girl'), ('mom'), ('netw')) k2 (k);
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', (select v from ids where k = k2.k))) is not null, 'man, join_community: refused for ' || k2.k)
from (values ('girl'), ('mom'), ('netw')) k2 (k);
select pg_temp.check(pg_temp.fails($$select * from public.girl_official_communities()$$) is not null
    and pg_temp.fails($$select * from public.mom_official_communities()$$) is not null,
  'man, IRLY Girl and Mom official lists: refused');
select pg_temp.check((select count(*) from public.conversations where community_id in (select v from ids where k in ('girl', 'mom', 'netw'))) = 0,
  'man, direct select: none of their chats');

-- ───────── 3. Members, not only hosts ─────────
-- Nina joins all five as the app does; Max joins the Mixte one.
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
select public.join_community(v) from ids;
select pg_temp.check((select count(*) from public.community_members m join ids on ids.v = m.community_id
    where m.user_id = 'b2c00000-0000-0000-0000-000000000001' and m.role = 'member') = 5,
  'Nina is a plain member of all five (no role)');
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000003');
select public.join_community((select v from ids where k = 'mixte'));

-- As the app's « Create an activity » from a community (activities insert, community_id set).
create or replace function pg_temp.create_in(who uuid, cid uuid, girl boolean, title text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(who);
  return pg_temp.fails(format($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, girl_only, community_id, client_ref)
    values (%L, %L, 'sport', 'dubai', 'jumeirah', now() + interval '2 days', %L, %L, gen_random_uuid())$q$, who, title, girl, cid));
end $$;

select pg_temp.check(pg_temp.create_in('b2c00000-0000-0000-0000-000000000001', (select v from ids where k = k2.k), k2.k <> 'mixte' and k2.k <> 'netm', 'B2c plan ' || k2.k) is null,
  'a plain member creates an activity in the ' || k2.k || ' community')
from (values ('mixte'), ('girl'), ('mom'), ('netw'), ('netm')) k2 (k);
select pg_temp.check(pg_temp.create_in('b2c00000-0000-0000-0000-000000000003', (select v from ids where k = 'mixte'), false, 'B2c Max plan') is null,
  'a man who is a member creates an activity in the Mixte community');
select pg_temp.check(pg_temp.create_in('b2c00000-0000-0000-0000-000000000004', (select v from ids where k = 'mixte'), false, 'B2c Bea plan') = '42501',
  'a non-member cannot create an activity in a community');
select pg_temp.check(pg_temp.create_in('b2c00000-0000-0000-0000-000000000003', (select v from ids where k = 'girl'), false, 'B2c Max girl plan') = '42501',
  'a man cannot create an activity in an IRLY Girl community');

select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.activities a join ids on ids.v = a.community_id and a.title = 'B2c plan ' || ids.k) = 5,
  'each activity is linked to the community it was created in');
select pg_temp.check((select bool_and(a.girl_only) from public.activities a join ids on ids.v = a.community_id
    where ids.k in ('girl', 'mom', 'netw') and a.title like 'B2c plan %'),
  'activities of IRLY Girl, Mom and women-only Network communities are women only');
-- The owners (Ada, Eve) see them in the community's Activities.
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000002');
select pg_temp.check(exists (select 1 from public.community_activities((select v from ids where k = k2.k)) x where x.title = 'B2c plan ' || k2.k),
  'the owner sees the member''s activity in the ' || k2.k || ' community')
from (values ('mixte'), ('girl'), ('mom')) k2 (k);
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000005');
select pg_temp.check(exists (select 1 from public.community_activities((select v from ids where k = k2.k)) x where x.title = 'B2c plan ' || k2.k),
  'the owner sees the member''s activity in the ' || k2.k || ' community')
from (values ('netw'), ('netm')) k2 (k);
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
-- Edited by its creator: still linked to its community.
update public.activities set title = 'B2c plan mom, edited' where title = 'B2c plan mom';
select pg_temp.as_admin();
select pg_temp.check((select community_id from public.activities where title = 'B2c plan mom, edited') = (select v from ids where k = 'mom'),
  'an edited activity stays linked to its community');

-- Posts, chat, members, search: every member.
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
select pg_temp.check(pg_temp.fails(format($q$insert into public.community_posts (community_id, author_id, body) values (%L, 'b2c00000-0000-0000-0000-000000000001', 'Hello from Nina')$q$, v)) is null,
  'a plain member posts in the ' || k || ' community')
from ids;
select pg_temp.check(pg_temp.fails(format($q$insert into public.messages (conversation_id, sender_id, body)
    values ((select conversation_id from public.community_detail(%L)), 'b2c00000-0000-0000-0000-000000000001', 'Hi all')$q$, v)) is null,
  'a plain member talks in the ' || k || ' community chat')
from ids;
select pg_temp.check(pg_temp.rows(format('select * from public.community_members_list(%L)', v)) >= 2,
  'a plain member sees the members of the ' || k || ' community')
from ids;
select pg_temp.check(pg_temp.rows(format($q$select * from public.community_search(%L, 'Hello', 'all', 20, null)$q$, v)) >= 0,
  'a plain member searches in the ' || k || ' community')
from ids;
select pg_temp.check(pg_temp.fails(format($q$insert into public.community_posts (community_id, author_id, body) values (%L, 'b2c00000-0000-0000-0000-000000000004', 'Not a member')$q$, (select v from ids where k = 'mixte'))) is not null,
  'a member cannot post in another member''s name');
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails(format($q$insert into public.community_posts (community_id, author_id, body) values (%L, 'b2c00000-0000-0000-0000-000000000004', 'Not a member')$q$, (select v from ids where k = 'girl'))) is not null,
  'a non-member cannot post in a community');

-- ───────── 4. The member keeps every membership; each app lists its own ─────────
select pg_temp.as_user('b2c00000-0000-0000-0000-000000000001');
select pg_temp.check((select count(*) from public.member_communities('b2c00000-0000-0000-0000-000000000001') m join ids on ids.v = m.id) = 5,
  'Nina keeps all five memberships (the app splits them by universe, nothing is moved)');
select pg_temp.as_admin();
select pg_temp.check((select array_agg(private.community_universe(m.community_id) order by private.community_universe(m.community_id))
    from public.community_members m join ids on ids.v = m.community_id
    where m.user_id = 'b2c00000-0000-0000-0000-000000000001') = array['girl', 'mixte', 'mom', 'network', 'network'],
  'her memberships span the four universes');

rollback;
