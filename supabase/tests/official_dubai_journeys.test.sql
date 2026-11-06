-- Journeys through IRLY's official communities, Dubai only (owner's list of
-- 2026-11-06, migration 20261108200000_irly_official_communities_dubai,
-- fix 20261108300000_irly_official_dubai_fixes): each persona plays its
-- screens end to end on the server.
--   a1 Marc   man, Dubai            a4 Rita  woman, Dubai, member of the retired
--   a2 Sami   man, Sharjah                   Girl Trip and IRLY Mom Community
--   a3 Lina   woman, Dubai          a5 Nour  woman, Sharjah, creates a community
--   a6 Cleo   content staff
-- TEST accounts only, ids prefixed d0b10000-…. Everything is rolled back.
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
    raise exception 'FAIL official_dubai_journeys: %', label;
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
insert into auth.users (id) values
  ('d0b10000-0000-0000-0000-0000000000a1'), ('d0b10000-0000-0000-0000-0000000000a2'), ('d0b10000-0000-0000-0000-0000000000a3'),
  ('d0b10000-0000-0000-0000-0000000000a4'), ('d0b10000-0000-0000-0000-0000000000a5'), ('d0b10000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d0b10000-0000-0000-0000-0000000000a1', 'Marc', '1991-02-02', 'man', 'dubai'),
  ('d0b10000-0000-0000-0000-0000000000a2', 'Sami', '1993-04-04', 'man', 'sharjah'),
  ('d0b10000-0000-0000-0000-0000000000a3', 'Lina', '1995-06-06', 'woman', 'dubai'),
  ('d0b10000-0000-0000-0000-0000000000a4', 'Rita', '1989-08-08', 'woman', 'dubai'),
  ('d0b10000-0000-0000-0000-0000000000a5', 'Nour', '1996-09-09', 'woman', 'sharjah'),
  ('d0b10000-0000-0000-0000-0000000000a6', 'Cleo', '1990-01-01', 'woman', 'dubai');
insert into public.staff_roles (user_id, role) values ('d0b10000-0000-0000-0000-0000000000a6', 'content');
-- The women have a verified profile (IRLY Girl's way in).
update public.profiles set verified_at = now() where id in
  ('d0b10000-0000-0000-0000-0000000000a3', 'd0b10000-0000-0000-0000-0000000000a4', 'd0b10000-0000-0000-0000-0000000000a5');

-- The rows the journeys use.
select id as padel_id from public.communities where official and topic = 'padel' and city_id = 'dubai' and parent_id is null and retired_at is null \gset
select id as fr_id from public.communities where official and topic = 'francais' and city_id = 'dubai' and parent_id is null and retired_at is null \gset
select id as girl_id from public.communities where official and topic = 'girls' and city_id = 'dubai' and parent_id is null and retired_at is null \gset
select id as trip_girl_id from public.communities where official and topic = 'girl_trip' and city_id = 'dubai' and parent_id is null \gset
select id as maman_id from public.communities where official and topic = 'moms' and city_id = 'dubai' and parent_id is null \gset

-- Rita joined Girl Trip and IRLY Mom Community before they were retired.
insert into public.community_members (community_id, user_id) values
  (:'trip_girl_id', 'd0b10000-0000-0000-0000-0000000000a4'), (:'maman_id', 'd0b10000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from public.conversation_members m join public.conversations v on v.id = m.conversation_id
    where v.community_id in (:'trip_girl_id', :'maman_id') and m.user_id = 'd0b10000-0000-0000-0000-0000000000a4') = 2, 'Rita: in both chats');

-- ───────── IRLY Running Club: the former IRLY Running, same row, same chat ─────────
select pg_temp.check((select count(*) from public.communities where official and topic = 'running' and city_id = 'dubai' and parent_id is null and deleted_at is null) = 1,
  'IRLY Running Club: one row in Dubai (the former IRLY Running, not a second one)');
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
    where c.official and c.topic = 'running' and c.city_id = 'dubai' and c.parent_id is null and c.retired_at is null
      and c.name = 'IRLY Running Club' and v.title = 'IRLY Running Club'
      and (select m.body from public.messages m where m.conversation_id = v.id order by m.created_at, m.id limit 1) like 'Welcome to IRLY Running %'),
  'IRLY Running Club keeps the former IRLY Running chat (first message), renamed');
select pg_temp.check(exists (select 1 from public.communities c join public.conversations v on v.community_id = c.id
    where c.official and c.topic = 'trip' and c.city_id = 'dubai' and c.retired_at is null and c.name = 'IRLY Trip'),
  'IRLY Trip is back in Dubai with its chat');

-- ───────── Marc, a man in Dubai ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a1');
select pg_temp.check((select array_agg(name order by name collate "C") from public.community_list('dubai') where official)
  = array['IRLY Activité', 'IRLY Expat', 'IRLY Network', 'IRLY Padel Club', 'IRLY Running Club', 'IRLY Sport', 'IRLY Trip', 'Les Français à Dubaï'],
  'Marc: the eight official communities, nothing else official');
select pg_temp.check((select array_agg(topic order by n) from public.community_list('dubai') with ordinality l(id, name, tagline, category_id, girl_only, members, is_member, posts_week, city_id, official, topic, emoji, created_at, n) where official)
  = array['expats', 'lifestyle', 'sport', 'running', 'padel', 'trip', 'network', 'francais'], 'Marc: in IRLY''s order');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where girl_only), 'Marc: no women-only community listed');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{newcomer,type:expat,activity:padel,activity:running,activity:football,goal:networking,interest:food,interest:travel,interest:family}', 20) r
    join public.communities c on c.id = r.id where c.retired_at is not null or c.girl_only),
  'Marc: recommendations hold no retired and no women-only community');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', '{activity:padel}', 6) where topic = 'padel'), 'Marc: padel players get IRLY Padel Club');
select pg_temp.check((select bool_and(not exists (select 1 from public.community_directory('dubai', s) d join public.communities c using (id) where c.retired_at is not null or d.girl_only))
    from unnest(array['members', 'active', 'recent', 'activities']) s),
  'Marc: every directory sort shows no retired and no women-only community');
select pg_temp.check((select bool_and((select count(*) from public.community_directory('dubai', s) d where d.official) = 8)
    from unnest(array['members', 'active', 'recent', 'activities']) s),
  'Marc: every directory sort shows the eight official communities');
select pg_temp.check(pg_temp.fails('select * from public.community_directory(''dubai'', ''popular'')') = '22023', 'Marc: an unknown sort is refused');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'Marc: girl_official_communities refused');
select pg_temp.check(pg_temp.fails('select * from public.girl_feed(''dubai'')') = '42501', 'Marc: girl_feed refused');
select pg_temp.check(not exists (select 1 from public.space_community('moms', 'dubai')), 'Marc: no IRLY Mom Community');
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', :'girl_id')) is not null, 'Marc: cannot join IRLY Girl');

-- Joins IRLY Padel Club and Les Français à Dubaï, posts, chats.
select public.join_community(:'padel_id') as padel_chat \gset
select pg_temp.check(:'padel_chat' is not null and exists (select 1 from public.conversation_members where conversation_id = :'padel_chat' and user_id = auth.uid()),
  'Marc: joins IRLY Padel Club, he is in its chat');
select pg_temp.check((public.community_header(:'padel_id') ->> 'members')::int >= 1, 'Marc: IRLY Padel Club header counts him');
insert into public.community_posts (community_id, author_id, body) values (:'padel_id', auth.uid(), 'd0b who plays at 8?');
select pg_temp.check(exists (select 1 from public.community_feed(:'padel_id') where body = 'd0b who plays at 8?'), 'Marc: posts in IRLY Padel Club');
insert into public.messages (conversation_id, sender_id, kind, body) values (:'padel_chat', auth.uid(), 'text', 'd0b court 3 booked');
select pg_temp.check(exists (select 1 from public.messages where conversation_id = :'padel_chat' and body = 'd0b court 3 booked'), 'Marc: writes in its chat');
select public.join_community(:'fr_id') as fr_chat \gset
select pg_temp.check(:'fr_chat' is not null, 'Marc: joins Les Français à Dubaï (open to everyone), its chat exists');
insert into public.community_posts (community_id, author_id, body) values (:'fr_id', auth.uid(), 'd0b apéro jeudi ?');
select pg_temp.check(exists (select 1 from public.community_feed(:'fr_id') where body = 'd0b apéro jeudi ?'), 'Marc: posts in Les Français à Dubaï');
select pg_temp.check((select count(*) from public.member_communities(auth.uid()) where id in (:'padel_id', :'fr_id')) = 2, 'Marc: both in « Mine »');
select public.leave_community(:'fr_id');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = :'fr_id' and is_member), 'Marc: leaves Les Français à Dubaï');

-- ───────── Sami, a man in Sharjah ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a2');
select pg_temp.check((select array_agg(name order by name collate "C") from public.community_list('sharjah') where official)
  = array['IRLY Activité', 'IRLY Expat', 'IRLY Network', 'IRLY Padel Club', 'IRLY Running Club', 'IRLY Sport', 'IRLY Trip', 'Les Français à Dubaï'],
  'Sami: from Sharjah, the eight Dubai ones (the emirates share their communities)');
select pg_temp.check(not exists (select 1 from public.community_list('sharjah') where official and city_id <> 'dubai'), 'Sami: no official community of Sharjah listed');
select pg_temp.check(not exists (select 1 from public.community_recommend('sharjah', '{newcomer,type:expat,activity:padel,activity:running,goal:networking,interest:food,interest:travel,interest:family,interest:sports}', 20) r
    join public.communities c on c.id = r.id where c.retired_at is not null),
  'Sami: no retired community recommended (Sharjah''s retired IRLY Expat, Sport…)');
select pg_temp.check((select array_agg(distinct city_id) from public.community_recommend('sharjah', '{newcomer,type:expat,activity:padel,goal:networking}', 20)) = array['dubai'],
  'Sami: recommended the Dubai ones');
select pg_temp.check(not exists (select 1 from public.community_directory('sharjah') d join public.communities c using (id) where c.retired_at is not null or d.girl_only),
  'Sami: directory, no retired and no women-only one');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'Sami: girl_official_communities refused');

-- ───────── Lina, a woman in Dubai ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a3');
select pg_temp.check((select array_agg(name order by ord) from public.girl_official_communities() with ordinality g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['IRLY Girl'], 'Lina: IRLY Girl''s official list is IRLY Girl');
select pg_temp.check((select city_id from public.girl_official_communities()) = 'dubai', '… in Dubai');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where topic = 'girl_network' and name = 'Girl CEO' and official and girl_only),
  'Lina: Girl CEO is reached as before (IRLY Network reads community_list)');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where id = :'girl_id'), 'Lina: IRLY Girl is in community_list');
select pg_temp.check(exists (select 1 from public.community_directory('dubai') where id = :'girl_id'), 'Lina: IRLY Girl is in the directory');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where topic in ('girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport', 'moms')),
  'Lina: the retired Girl Trip/Expat/Activité/Sport and IRLY Mom Community are not listed');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{newcomer,type:expat,interest:family,goal:irlygirl,activity:padel}', 20) r
    join public.communities c on c.id = r.id where c.retired_at is not null), 'Lina: no retired community recommended');
select public.join_community(:'girl_id') as girl_chat \gset
select pg_temp.check((select is_member from public.girl_official_communities()), 'Lina: joins IRLY Girl');
insert into public.community_posts (community_id, author_id, body) values (:'girl_id', auth.uid(), 'd0b brunch Friday girls?');
select pg_temp.check(exists (select 1 from public.community_feed(:'girl_id') where body = 'd0b brunch Friday girls?'), 'Lina: posts in IRLY Girl');
select pg_temp.check(exists (select 1 from public.girl_feed('dubai') where body = 'd0b brunch Friday girls?'), 'Lina: her post is in the IRLY Girl feed');
insert into public.messages (conversation_id, sender_id, kind, body) values (:'girl_chat', auth.uid(), 'text', 'd0b hi all');
select pg_temp.check(exists (select 1 from public.messages where conversation_id = :'girl_chat' and body = 'd0b hi all'), 'Lina: writes in IRLY Girl''s chat');
select public.leave_community(:'girl_id');
select pg_temp.check(not (select is_member from public.girl_official_communities()), 'Lina: leaves IRLY Girl');

-- ───────── Rita, a member of the retired Girl Trip and IRLY Mom Community ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a4');
select pg_temp.check((select count(*) from public.member_communities(auth.uid()) where id in (:'trip_girl_id', :'maman_id')) = 2, 'Rita: both retired communities in « Mine »');
select pg_temp.check(not exists (select 1 from public.girl_official_communities() where topic = 'girl_trip'), 'Rita: Girl Trip is no longer an official tile');
select pg_temp.check((public.community_header(:'trip_girl_id') ->> 'members')::int >= 1, 'Rita: Girl Trip''s page header loads');
insert into public.community_posts (community_id, author_id, body) values (:'trip_girl_id', auth.uid(), 'd0b Musandam in March?');
select pg_temp.check(exists (select 1 from public.community_feed(:'trip_girl_id') where body = 'd0b Musandam in March?'), 'Rita: posts and reads Girl Trip');
insert into public.messages (conversation_id, sender_id, kind, body)
  values ((select id from public.conversations where community_id = :'trip_girl_id'), auth.uid(), 'text', 'd0b still here');
select pg_temp.check(exists (select 1 from public.messages where body = 'd0b still here'), 'Rita: writes in Girl Trip''s chat');
insert into public.community_posts (community_id, author_id, body) values (:'maman_id', auth.uid(), 'd0b playdate at Safa Park');
select pg_temp.check(exists (select 1 from public.girl_feed('dubai', true) where body = 'd0b playdate at Safa Park'), 'Rita: her IRLY Mom Community post is in the Maman feed');
select pg_temp.check((select is_member from public.space_community('moms', 'dubai')) and (select id from public.space_community('moms', 'dubai')) = :'maman_id',
  'Rita: the Mom space still opens her IRLY Mom Community');

-- ───────── Nour, a woman in Sharjah, creates a community ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a5');
select public.create_community('d0b Sharjah sunset walks', 'sharjah', 'Evening walks on the corniche', null, null, false) as walk_id \gset
select pg_temp.as_admin();
select private.retire_official_communities();
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a5');
select pg_temp.check(exists (select 1 from public.community_list('sharjah') where id = :'walk_id' and not official and is_member), 'Nour: her Sharjah community is listed, hers');
select pg_temp.check(exists (select 1 from public.community_directory('sharjah') where id = :'walk_id'), 'Nour: … and in the directory');
select pg_temp.check((select array_agg(name order by ord) from public.girl_official_communities() with ordinality g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['IRLY Girl'], 'Nour: from Sharjah, IRLY Girl (Dubai)');

-- ───────── Cleo, content staff: the official order per space ─────────
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a6');
select pg_temp.check((select array_agg(topic order by sort) from public.admin_official_topics() where space = 'mixte')
  = array['expats', 'lifestyle', 'sport', 'running', 'padel', 'trip', 'network', 'francais'], 'Cleo: IRLY Mixte, the eight in order');
select pg_temp.check((select array_agg(topic order by sort) from public.admin_official_topics() where space = 'girl') = array['girls', 'girl_network'],
  'Cleo: IRLY Girl, IRLY Girl then Girl CEO');
select pg_temp.check(not exists (select 1 from public.admin_official_topics() where space = 'mom'), 'Cleo: IRLY Mom Community space is empty');
select pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mom', '{}', 'Nothing to order')$q$) is null, 'Cleo: the empty Mom space saves without an error');
select public.admin_official_reorder('mixte', array['francais', 'padel', 'running', 'expats', 'lifestyle', 'sport', 'trip', 'network'], 'French first this week');
select pg_temp.check((select topic from public.community_list('dubai') where official and not girl_only limit 1) = 'francais', 'Cleo: the list follows the new order');
select public.admin_official_reorder('girl', array['girl_network', 'girls'], 'Swap');
select pg_temp.check((select array_agg(topic order by sort) from public.admin_official_topics() where space = 'girl') = array['girl_network', 'girls'], 'Cleo: IRLY Girl''s order saves');
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a3');
select pg_temp.check((select array_agg(name) from public.girl_official_communities()) = array['IRLY Girl'], 'Lina: Girl CEO stays out of IRLY Girl''s official list whatever the order');
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a6');
select pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mixte', array['francais', 'padel', 'running', 'expats', 'lifestyle', 'sport', 'trip', 'network', 'moms'], 'Bring back')$q$) = '22023',
  'Cleo: a retired one cannot be put back in the order');

-- Les Français à Dubaï: recommended to French speakers only.
select pg_temp.as_admin();
select pg_temp.check((select match_tags from public.community_topics where topic = 'francais') = '{lang:fr}', 'Les Français à Dubaï matches French speakers');
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', '{lang:fr}', 20) where topic = 'francais'), 'Marc speaks French: Les Français à Dubaï is recommended');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{interest:sports}', 20) where topic = 'francais'), 'without French it is not');
select pg_temp.as_admin();

-- Every official community is reached from what signup asks (src/app/onboarding:
-- interests, activities, languages, « What are you looking for? »). One answer each.
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a1');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', array[x.tag], 20) where topic = x.topic), 'signup answer ' || x.tag || ' recommends ' || x.topic)
from (values ('expats', 'newcomer'), ('expats', 'goal:friends'), ('expats', 'interest:languages'),
  ('lifestyle', 'interest:food'), ('lifestyle', 'goal:nightlife'), ('lifestyle', 'goal:events'),
  ('sport', 'interest:sports'), ('sport', 'activity:gym'), ('sport', 'goal:sport'),
  ('running', 'activity:running'), ('running', 'goal:sport'),
  ('padel', 'activity:padel'), ('padel', 'goal:sport'), ('padel', 'interest:sports'),
  ('trip', 'interest:travel'), ('trip', 'goal:travel'), ('trip', 'activity:hiking'),
  ('network', 'interest:business'), ('network', 'goal:networking'), ('network', 'activity:networking'), ('network', 'interest:startups'),
  ('francais', 'lang:fr')) as x(topic, tag);
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{goal:irlygirl,goal:friends}', 20) where girl_only), 'Marc (a man) is never recommended IRLY Girl');
select pg_temp.as_user('d0b10000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', '{goal:irlygirl}', 20) where topic = 'girls'), 'Lina chose IRLY Girl at signup: IRLY Girl is recommended');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{newcomer,interest:sports,interest:business,interest:travel,goal:irlygirl,lang:fr}', 20) c
    join public.communities x on x.id = c.id where x.retired_at is not null or x.city_id <> 'dubai'), 'Lina: only listed Dubai communities, whatever she chose');

select pg_temp.as_admin();
rollback;
