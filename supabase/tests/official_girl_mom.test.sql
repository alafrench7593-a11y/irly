-- IRLY Girl and IRLY Mom Community mirror IRLY's official list, groups are
-- removed everywhere (owner decisions of 2026-11-06, migration
-- 20261109000000_irly_official_girl_mom_no_groups).
--   a1 Omar  man, Dubai
--   a2 Jade  woman, Dubai (verified)
--   a3 Sara  woman, Dubai (verified), a mom (« Family & kids » at signup)
--   a4 Lou   woman, Dubai, member of a group that was removed
--   a5 Ines  woman, Dubai, member of the retired IRLY Girl community
--   a6 Kim   content staff
-- TEST accounts only, ids prefixed d0c10000-…. Everything is rolled back.
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
    raise exception 'FAIL official_girl_mom: %', label;
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

-- What each space lists, by topic (official, top level, not retired, not deleted).
create or replace function pg_temp.listed(p_space text) returns text[] language sql as $$
  select coalesce(array_agg(c.topic order by t.sort, c.topic), '{}')
  from public.communities c join public.community_topics t on t.topic = c.topic
  where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null
    and private.topic_space(t.topic, t.girl_only) = p_space
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('d0c10000-0000-0000-0000-0000000000a1'), ('d0c10000-0000-0000-0000-0000000000a2'), ('d0c10000-0000-0000-0000-0000000000a3'),
  ('d0c10000-0000-0000-0000-0000000000a4'), ('d0c10000-0000-0000-0000-0000000000a5'), ('d0c10000-0000-0000-0000-0000000000a6');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('d0c10000-0000-0000-0000-0000000000a1', 'Omar', '1990-02-02', 'man', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a2', 'Jade', '1994-03-03', 'woman', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a3', 'Sara', '1988-04-04', 'woman', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a4', 'Lou', '1993-05-05', 'woman', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a5', 'Ines', '1991-06-06', 'woman', 'dubai'),
  ('d0c10000-0000-0000-0000-0000000000a6', 'Kim', '1987-07-07', 'woman', 'dubai');
update public.profiles set verified_at = now() where id in
  ('d0c10000-0000-0000-0000-0000000000a2', 'd0c10000-0000-0000-0000-0000000000a3', 'd0c10000-0000-0000-0000-0000000000a4', 'd0c10000-0000-0000-0000-0000000000a5');
insert into public.staff_roles (user_id, role) values ('d0c10000-0000-0000-0000-0000000000a6', 'content');

-- ───────── 1. The exact official set of each space, Dubai only ─────────
select pg_temp.check(pg_temp.listed('mixte') = array['expats', 'lifestyle', 'sport', 'running', 'padel', 'trip', 'network', 'francais'],
  'IRLY: its eight, IRLY Network included');
select pg_temp.check(pg_temp.listed('girl')
    = array['girl_newcomers', 'girl_activity', 'girl_sport', 'girl_running', 'girl_padel', 'girl_trip', 'girl_network', 'girl_francaise'],
  'IRLY Girl: its seven and Girl CEO');
select pg_temp.check(pg_temp.listed('mom')
    = array['mom_expat', 'mom_activity', 'mom_sport', 'mom_running', 'mom_padel', 'mom_trip', 'mom_network', 'mom_francaise'],
  'IRLY Mom Community: its eight, Mom CEO included');
select pg_temp.check((select array_agg(c.name order by t.sort) from public.communities c join public.community_topics t using (topic)
    where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null and private.topic_space(t.topic, t.girl_only) = 'girl')
  = array['Girl Expat', 'Girl Activité', 'Girl Sport', 'Girl Running Club', 'Girl Padel Club', 'Girl Trip', 'Girl CEO', 'Les Françaises à Dubaï'],
  'IRLY Girl: the owner''s names');
select pg_temp.check((select array_agg(c.name order by t.sort) from public.communities c join public.community_topics t using (topic)
    where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null and private.topic_space(t.topic, t.girl_only) = 'mom')
  = array['Mom Expat', 'Mom Activité', 'Mom Sport', 'Mom Running Club', 'Mom Padel Club', 'Mom Trip', 'Mom CEO', 'Les Mamans françaises à Dubaï'],
  'IRLY Mom Community: the owner''s names');
select pg_temp.check(not exists (select 1 from public.communities where official and parent_id is null and deleted_at is null and retired_at is null and city_id <> 'dubai'),
  'every listed official community is in Dubai');
select pg_temp.check((select count(*) from public.communities where official and parent_id is null and deleted_at is null and retired_at is null) = 24,
  'one row per topic, 24 in all');
select pg_temp.check((select bool_and(c.girl_only) from public.communities c join public.community_topics t using (topic)
    where c.official and c.parent_id is null and private.topic_space(t.topic, t.girl_only) in ('girl', 'mom')),
  'every Girl and Mom official community is women only');
select pg_temp.check((select bool_and(description is not null and tagline is not null) from public.communities
    where official and parent_id is null and deleted_at is null and retired_at is null and topic <> 'girl_network'),
  'each one has its tagline and description');
select pg_temp.check((select count(*) from public.conversations v join public.communities c on c.id = v.community_id
    where c.official and c.parent_id is null and c.retired_at is null and (c.topic like 'mom\_%' or c.topic in ('girl_running', 'girl_padel', 'girl_francaise'))) = 11,
  'each new one has its chat');
-- The Girl four came back: same rows as before (made once, no second one).
select pg_temp.check((select count(*) from public.communities where official and parent_id is null and deleted_at is null
    and topic in ('girl_newcomers', 'girl_activity', 'girl_sport', 'girl_trip') and city_id = 'dubai') = 4, 'Girl Expat, Activité, Sport and Trip: one row each');
-- Twins share their mixte twin's answers.
select pg_temp.check((select bool_and(g.match_tags = m.match_tags) from public.community_topics g join public.community_topics m
    on (g.topic, m.topic) in (('girl_newcomers', 'expats'), ('girl_activity', 'lifestyle'), ('girl_sport', 'sport'), ('girl_running', 'running'),
      ('girl_padel', 'padel'), ('girl_trip', 'trip'), ('girl_francaise', 'francais'), ('mom_expat', 'expats'), ('mom_sport', 'sport'),
      ('mom_running', 'running'), ('mom_padel', 'padel'), ('mom_francaise', 'francais'))),
  'Girl and Mom topics match their mixte twin''s answers');
select pg_temp.check((select bool_and(require_tags = '{goal:family,interest:family}') from public.community_topics where topic like 'mom\_%'),
  'Mom topics need « Family & kids »');

-- Retired and removed rows are kept.
select pg_temp.check((select count(*) from public.communities where official and topic = 'girls' and parent_id is null and deleted_at is null and retired_at is not null) >= 1
  and not exists (select 1 from public.communities where official and topic = 'girls' and parent_id is null and retired_at is null),
  'IRLY Girl (general) is retired, every row kept');
select pg_temp.check(not exists (select 1 from public.communities where official and topic = 'moms' and parent_id is null and retired_at is null)
  and exists (select 1 from public.communities where official and topic = 'moms' and city_id = 'dubai' and deleted_at is null),
  'IRLY Mom Community (moms) stays retired, kept');
select pg_temp.check(not exists (select 1 from public.community_topics where active and topic in ('girls', 'moms')), 'girls and moms topics are inactive');

-- ───────── 2. Groups are gone, kept ─────────
select pg_temp.check(not exists (select 1 from public.communities where parent_id is not null and deleted_at is null
    and (official or created_at < (select min(removed_at) from private.removed_groups))), 'no group is left');
select pg_temp.check((select count(*) from private.removed_groups) > 300, 'IRLY''s automatic groups are listed as removed');
select pg_temp.check(not exists (select 1 from private.removed_groups r join public.communities c on c.id = r.community_id where c.parent_id is null),
  'only groups were removed, never a top-level community');
select pg_temp.check(not exists (select 1 from private.removed_groups r left join public.communities c on c.id = r.community_id where c.id is null or c.deleted_at is null),
  'every removed group is kept, soft-deleted');
select pg_temp.check(exists (select 1 from public.communities g join public.communities h on h.id = g.parent_id
    where h.topic = 'help' and h.city_id = 'dubai' and g.name = 'Visa & paperwork' and g.deleted_at is not null), 'Visa & paperwork is removed, kept');
select pg_temp.check(not exists (select 1 from public.community_subtopics where active), 'the group catalog is off');
select pg_temp.check(private.ensure_official_subgroups() = 0, 'ensure_official_subgroups makes nothing');
select pg_temp.check(private.ensure_official_communities() = 0, 'ensure_official_communities makes nothing');
select pg_temp.check(private.retire_official_communities() = 0, 'retire_official_communities changes nothing more');
select pg_temp.check(not exists (select 1 from public.communities where parent_id is not null and deleted_at is null
    and (official or created_at < (select min(removed_at) from private.removed_groups))), '… and still no group');
select pg_temp.check(not exists (select 1 from public.communities where official and parent_id is null and deleted_at is not null
    and topic in (select topic from public.community_topics where active)), 'no official community was deleted');

-- A member's top-level community is untouched, and stays without groups.
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a2');
select public.create_community('d0c Book Club', 'dubai', 'Books and coffee', null, 'culture', false) as club_id \gset
select pg_temp.check(exists (select 1 from public.community_list('dubai') where id = :'club_id' and not official), 'Jade: her community is listed');
select pg_temp.check(pg_temp.fails(format('select public.create_subgroup(%L, %L)', :'club_id', 'Poetry')) = '42501', 'Jade: she cannot add a group to it');
select pg_temp.check(pg_temp.fails(format('insert into public.communities (city_id, name, parent_id, created_by) values (%L, %L, %L, auth.uid())', 'dubai', 'Sneaky', :'club_id')) is not null,
  'Jade: nor insert one directly');
select pg_temp.check(not exists (select 1 from public.suggest_groups('dubai', 20)), 'Jade: no group is suggested');
select pg_temp.check(not exists (select 1 from public.community_subgroups(:'club_id')), 'Jade: her community lists no group');

-- ───────── 3. Omar, a man: no Girl or Mom community on any road ─────────
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a1');
select pg_temp.check(not exists (select 1 from public.communities where girl_only), 'Omar: no women-only community on a direct read');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where girl_only), 'Omar: none in community_list');
select pg_temp.check(not exists (select 1 from public.community_directory('dubai') where girl_only), 'Omar: none in the directory');
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai',
    '{newcomer,type:expat,activity:padel,activity:running,activity:gym,goal:networking,interest:food,interest:travel,interest:family,goal:family,lang:fr}', 20) where girl_only),
  'Omar: none recommended, whatever he answered');
select pg_temp.check(not exists (select 1 from (
      select * from public.search_all('Girl', 'dubai') union all select * from public.search_all('Mom', 'dubai')
      union all select * from public.search_all('françaises', 'dubai')) s
    where s.kind = 'community' and s.title = any (array['Girl Expat', 'Girl Activité', 'Girl Sport', 'Girl Running Club', 'Girl Padel Club', 'Girl Trip', 'Girl CEO',
      'Les Françaises à Dubaï', 'Mom Expat', 'Mom Activité', 'Mom Sport', 'Mom Running Club', 'Mom Padel Club', 'Mom Trip', 'Mom CEO', 'Les Mamans françaises à Dubaï'])),
  'Omar: none in search');
select pg_temp.check(pg_temp.fails('select * from public.girl_official_communities()') = '42501', 'Omar: girl_official_communities refused');
select pg_temp.check(pg_temp.fails('select * from public.mom_official_communities()') = '42501', 'Omar: mom_official_communities refused');
select pg_temp.check(pg_temp.fails('select * from public.girl_feed(''dubai'', true)') = '42501', 'Omar: the Mom feed refused');
select pg_temp.as_admin();
select id as mom_padel_id from public.communities where official and topic = 'mom_padel' and city_id = 'dubai' and parent_id is null \gset
select id as girl_padel_id from public.communities where official and topic = 'girl_padel' and city_id = 'dubai' and parent_id is null \gset
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', :'mom_padel_id')) is not null, 'Omar: cannot join Mom Padel Club');
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', :'girl_padel_id')) is not null, 'Omar: cannot join Girl Padel Club');
select pg_temp.check(pg_temp.fails(format('insert into public.community_posts (community_id, author_id, body) values (%L, auth.uid(), %L)', :'girl_padel_id', 'd0c hi')) is not null,
  'Omar: cannot post in Girl Padel Club');
select pg_temp.check(not exists (select 1 from public.space_community('moms', 'dubai')), 'Omar: no Mom space');

-- ───────── 4. Jade, a woman: IRLY Girl's list, recommendations from signup ─────────
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a2');
select pg_temp.check((select array_agg(topic order by ord) from public.girl_official_communities() with ordinality g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['girl_newcomers', 'girl_activity', 'girl_sport', 'girl_running', 'girl_padel', 'girl_trip', 'girl_francaise'],
  'Jade: IRLY Girl lists its seven in IRLY''s order, never Girl CEO');
select pg_temp.check((select array_agg(topic order by ord) from public.mom_official_communities() with ordinality g(id, topic, name, tagline, emoji, members, is_member, city_id, cover_path, ord))
  = array['mom_expat', 'mom_activity', 'mom_sport', 'mom_running', 'mom_padel', 'mom_trip', 'mom_francaise'],
  'Jade: IRLY Mom Community lists its seven, never Mom CEO');
select pg_temp.check(exists (select 1 from public.community_list('dubai') where topic = 'girl_network' and name = 'Girl CEO')
  and exists (select 1 from public.community_list('dubai') where topic = 'mom_network' and name = 'Mom CEO'),
  'Jade: Girl CEO and Mom CEO are read by IRLY Network (community_list)');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where topic in ('girls', 'moms')), 'Jade: the retired ones are not listed');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', array[x.tag], 20) where topic = x.topic), 'Jade: ' || x.tag || ' recommends ' || x.topic)
from (values ('girl_newcomers', 'newcomer'), ('girl_activity', 'interest:food'), ('girl_sport', 'activity:gym'), ('girl_running', 'activity:running'),
  ('girl_padel', 'activity:padel'), ('girl_trip', 'interest:travel'), ('girl_francaise', 'lang:fr')) as x(topic, tag);
select pg_temp.check(not exists (select 1 from public.community_recommend('dubai', '{newcomer,activity:running,activity:padel,interest:travel,lang:fr}', 20) where topic like 'mom\_%'),
  'Jade, no « Family & kids »: no Mom community recommended');
select pg_temp.check((select array_agg(topic order by n) from public.community_recommend('dubai', '{activity:running}', 20) with ordinality r(id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member, score, city_id, n)
    where topic in ('running', 'girl_running')) = array['running', 'girl_running'],
  'Jade: on a tie IRLY''s community comes before its Girl twin');
select public.join_community(:'girl_padel_id') as girl_padel_chat \gset
insert into public.community_posts (community_id, author_id, body) values (:'girl_padel_id', auth.uid(), 'd0c doubles Sunday?');
select pg_temp.check(exists (select 1 from public.girl_feed('dubai') where body = 'd0c doubles Sunday?'), 'Jade: her Girl Padel Club post is in the IRLY Girl feed');
select pg_temp.check(not exists (select 1 from public.girl_feed('dubai', true) where body = 'd0c doubles Sunday?'), '… not in the Mom feed');

-- ───────── 5. Sara, a mom ─────────
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a3');
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', array['goal:family', x.tag], 20) where topic = x.topic), 'Sara: Family & kids + ' || x.tag || ' recommends ' || x.topic)
from (values ('mom_expat', 'newcomer'), ('mom_activity', 'interest:food'), ('mom_sport', 'activity:gym'), ('mom_running', 'activity:running'),
  ('mom_padel', 'activity:padel'), ('mom_trip', 'interest:travel'), ('mom_francaise', 'lang:fr')) as x(topic, tag);
select pg_temp.check(exists (select 1 from public.community_recommend('dubai', '{interest:family}', 20) where topic = 'mom_activity'),
  'Sara: « Family & kids » alone recommends Mom Activité');
select public.join_community(:'mom_padel_id');
insert into public.community_posts (community_id, author_id, body) values (:'mom_padel_id', auth.uid(), 'd0c padel after school drop-off?');
select pg_temp.check(exists (select 1 from public.girl_feed('dubai', true) where body = 'd0c padel after school drop-off?'), 'Sara: her Mom Padel Club post is in the Mom feed');
select pg_temp.check((select is_member from public.mom_official_communities() where topic = 'mom_padel'), 'Sara: a member of Mom Padel Club');

-- ───────── 6. Lou, a member of a group that was removed ─────────
select pg_temp.as_admin();
select g.id as group_id, g.parent_id as group_parent from public.communities g join public.communities p on p.id = g.parent_id
where p.official and p.topic = 'sport' and p.city_id = 'dubai' and g.subtopic = 'padel' \gset
insert into public.community_members (community_id, user_id) values (:'group_id', 'd0c10000-0000-0000-0000-0000000000a4') on conflict do nothing;
select private.ensure_conversation('community', :'group_id', 'Padel') as group_chat \gset
insert into public.conversation_members (conversation_id, user_id) values (:'group_chat', 'd0c10000-0000-0000-0000-0000000000a4') on conflict do nothing;
insert into public.messages (conversation_id, sender_id, kind, body) values (:'group_chat', null, 'system', 'd0c old group history');
insert into public.community_posts (community_id, author_id, body) values (:'group_id', 'd0c10000-0000-0000-0000-0000000000a4', 'd0c old group post');
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a4');
select pg_temp.check(private.i_belong(:'group_parent'), 'Lou: still a member of IRLY Sport');
select pg_temp.check(not exists (select 1 from public.member_communities(auth.uid()) where id = :'group_id'), 'Lou: the removed group is not in « Mine »');
select pg_temp.check(not exists (select 1 from public.communities where id = :'group_id'), 'Lou: the removed group no longer opens');
select pg_temp.check(not exists (select 1 from public.community_detail(:'group_id')), 'Lou: its page says it is not available (no detail)');
select pg_temp.check(not exists (select 1 from public.community_subgroups(:'group_parent')), 'Lou: IRLY Sport lists no group');
select pg_temp.check(not exists (select 1 from public.my_conversations() where conversation_id = :'group_chat'), 'Lou: its chat left her inbox');
select pg_temp.check(pg_temp.fails(format('insert into public.messages (conversation_id, sender_id, kind, body) values (%L, auth.uid(), %L, %L)', :'group_chat', 'text', 'd0c anyone?')) = '42501',
  'Lou: its chat takes no new message');
select pg_temp.check(pg_temp.fails(format('select public.join_community(%L)', :'group_id')) is not null, 'Lou: cannot join it again');
select pg_temp.check(pg_temp.fails(format('select count(*) from public.community_feed(%L)', :'group_parent')) is null
  and not exists (select 1 from public.community_feed(:'group_parent') where body = 'd0c old group post'), 'Lou: IRLY Sport''s feed loads, without the removed group''s posts');
select public.leave_community(:'group_parent');
select pg_temp.as_admin();
select pg_temp.check(exists (select 1 from public.community_members where community_id = :'group_id' and user_id = 'd0c10000-0000-0000-0000-0000000000a4'),
  'Lou left IRLY Sport: her membership of the removed group is kept (restorable)');
select pg_temp.check(exists (select 1 from public.messages where conversation_id = :'group_chat' and body = 'd0c old group history')
  and exists (select 1 from public.community_posts where community_id = :'group_id' and body = 'd0c old group post' and deleted_at is null), 'the group''s chat history and posts are kept');

-- ───────── 7. Ines, a member of the retired IRLY Girl ─────────
select id as girls_id from public.communities where official and topic = 'girls' and city_id = 'dubai' and parent_id is null \gset
insert into public.community_members (community_id, user_id) values (:'girls_id', 'd0c10000-0000-0000-0000-0000000000a5') on conflict do nothing;
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a5');
select pg_temp.check(exists (select 1 from public.member_communities(auth.uid()) where id = :'girls_id'), 'Ines: IRLY Girl stays in « Mine »');
select pg_temp.check(not exists (select 1 from public.girl_official_communities() where topic = 'girls'), 'Ines: it is no longer an official tile');
select pg_temp.check(not exists (select 1 from public.community_list('dubai') where id = :'girls_id'), 'Ines: nor in the lists');
insert into public.community_posts (community_id, author_id, body) values (:'girls_id', auth.uid(), 'd0c still here');
select pg_temp.check(exists (select 1 from public.community_feed(:'girls_id') where body = 'd0c still here'), 'Ines: she still posts and reads it');

-- ───────── 8. Kim, content staff: each space orders its own ─────────
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a6');
select pg_temp.check((select count(*) from public.admin_official_topics() where space = 'mixte') = 8
  and (select count(*) from public.admin_official_topics() where space = 'girl') = 8
  and (select count(*) from public.admin_official_topics() where space = 'mom') = 8, 'Kim: eight per space');
select pg_temp.check((select array_agg(topic order by topic) from public.admin_official_topics() where in_network) = array['girl_network', 'mom_network', 'network'],
  'Kim: IRLY Network, Girl CEO and Mom CEO live in IRLY Network');
select pg_temp.check(pg_temp.fails($q$select public.admin_official_reorder('mom', array['mom_expat'], 'Only one')$q$) = '22023', 'Kim: a Mom order needs all eight');
select public.admin_official_reorder('mom', array['mom_francaise', 'mom_expat', 'mom_activity', 'mom_sport', 'mom_running', 'mom_padel', 'mom_trip', 'mom_network'], 'French first');
select pg_temp.as_user('d0c10000-0000-0000-0000-0000000000a3');
select pg_temp.check((select topic from public.mom_official_communities() limit 1) = 'mom_francaise', 'Sara: the Mom list follows the new order');

select pg_temp.as_admin();
rollback;
