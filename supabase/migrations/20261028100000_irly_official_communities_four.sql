-- IRLY's official communities: a short list per space, the rest are the members'.
--
-- Owner decision: IRLY runs only these official communities; every other
-- community is created by members.
--   IRLY (Mixte): IRLY Expat, IRLY Sport, IRLY Network, IRLY Activité
--   IRLY Girl:    Girl Trip, Girl Expat, Girl Activité, Girl Sport
--                 (+ Girl CEO, reached from IRLY Network in IRLY Girl only)
--   IRLY Maman:   IRLY Maman
-- IRLY Network (Mixte) and Girl CEO (IRLY Girl) live inside the IRLY
-- Network section: the app lists them there, never as a second tile in the
-- community lists (official.ts NETWORK_OFFICIAL_TOPICS, network/hub.ts).
-- Names are stored once and shown as written in every language; the
-- descriptions are the owner's (English here, French in src/i18n/fr.ts,
-- like every official text).
--
-- Data-preserving, nothing is deleted or soft-deleted:
-- 1. Reused rows (same id, members, posts, groups, chat, cover): the closest
--    existing official community of each space is renamed through its topic
--    (ensure_official_communities() keeps names in step with the topics; the
--    chat title follows through communities_chat_title):
--      expats         IRLY Expats             -> IRLY Expat
--      sport          IRLY Sport              (unchanged)
--      network        IRLY Network            (unchanged)
--      lifestyle      IRLY Lifestyle          -> IRLY Activité (all outings; now also in Bali)
--      girl_trip      IRLY Girl Trip          -> Girl Trip
--      girl_newcomers IRLY Nouvelle Arrivante -> Girl Expat
--      girl_activity  IRLY Activité           -> Girl Activité
--      girl_network   IRLY Girl Networking    -> Girl CEO
--      moms           IRLY Moms               -> IRLY Maman
--    New, created once (communities_official_topic_city is unique):
--      girl_sport     Girl Sport (Dubai, like IRLY Girl's others)
-- 2. Every other official community is retired, not deleted: its topic is
--    no longer active (ensure_official_communities() never makes it again,
--    the recommendations never suggest it) and the row gets retired_at
--    (reversible: clear it and set the topic active again). It stays
--    official (only IRLY runs it: no owner can delete it or take it over)
--    and leaves the community lists, IRLY Girl's official list and the
--    group suggestions. Its members keep everything: membership, posts,
--    groups and chat, listed in « Mine » (member_communities), the page and
--    its chat as before. Help & Questions and the IRLY Family / IRLY Girl
--    space pages, built on their official community, keep working
--    (help_feed, help_groups and space_community read it by topic).
--      retired topics: newcomers, help, gym, football, running, wellness,
--      trip, beach, food, culture, nights, shopping, entrepreneurs, ecom,
--      tech, ai, families, girls, girl_francophone
-- 3. IRLY's four take over what the retired topics matched in the
--    onboarding answers, so « For you » still suggests something to everyone.
-- 4. Each official topic carries the owner's description, copied to its
--    communities (shown on their page with the welcome charter).
-- Community lists: IRLY's official ones first, then the members' (each
-- city first, as before). Members still create communities as before.

-- ───────── 1. The retired marker, the descriptions ─────────
alter table public.communities add column if not exists retired_at timestamptz;
comment on column public.communities.retired_at is
  'An official community IRLY no longer features (kept with its members, posts and chat). Null: listed as usual.';
alter table public.community_topics add column if not exists description text;

-- Members cannot set it (as official and topic): same guard, one more column.
drop trigger if exists communities_edit_guard on public.communities;
create trigger communities_edit_guard before update on public.communities
for each row execute function private.edit_guard('created_by', 'girl_only', 'created_at', 'official', 'topic', 'members_count', 'retired_at');

-- ───────── 2. The official topics of each space ─────────
-- The retired topics' answers move to IRLY's four (union, no duplicate).
create or replace function pg_temp.merged_tags(p_topic text, p_from text[]) returns text[]
language sql as $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(match_tags) x from public.community_topics where topic = p_topic or topic = any (p_from)
  ) s
$$;

update public.community_topics set name = 'IRLY Expat', intro_first = true, sort = 1,
  description = 'A community for expats, newcomers and people living in Dubai who want to grow their social circle. Members can introduce themselves, share their experiences, swap tips, discover the city and meet people who share their interests.',
  match_tags = pg_temp.merged_tags('expats', array['newcomers', 'help'])
where topic = 'expats';
update public.community_topics set name = 'IRLY Sport', sort = 2,
  description = 'A community to find sports partners, organise training sessions, do physical activities together and meet people who share the same goals.',
  match_tags = pg_temp.merged_tags('sport', array['gym', 'football', 'running', 'wellness', 'beach'])
where topic = 'sport';
update public.community_topics set name = 'IRLY Network', sort = 3,
  description = 'A community for entrepreneurs, executives, freelancers and professionals who want to grow their network, present their business, share their projects and create professional opportunities.',
  match_tags = pg_temp.merged_tags('network', array['entrepreneurs', 'ecom', 'tech', 'ai'])
where topic = 'network';
update public.community_topics set name = 'IRLY Activité', emoji = '✨', sort = 4,
  tagline = 'Outings to share: restaurants, cafés, beach, nights out, trips and more.',
  description = 'A community to suggest and discover outings and experiences to share: restaurants, cafés, the beach, beach clubs, shopping, nights out, trips, excursions and other leisure. Members can suggest their own activities and invite others to join.',
  match_tags = pg_temp.merged_tags('lifestyle', array['trip', 'food', 'culture', 'nights', 'shopping', 'families']),
  cities = (select array_agg(distinct c order by c) from unnest(cities || array['bali']) c)
where topic = 'lifestyle';

update public.community_topics set name = 'Girl Trip', sort = 1,
  description = 'A community for women who want to travel together, plan weekends, discover new destinations and share experiences.'
where topic = 'girl_trip';
update public.community_topics set name = 'Girl Expat', sort = 2,
  description = 'A community for women who are expats or newly arrived in Dubai and want to meet friends, swap tips and build their social circle.'
where topic = 'girl_newcomers';
update public.community_topics set name = 'Girl Activité', sort = 3,
  tagline = 'Outings between women: restaurants, cafés, beach clubs, shopping, nights out and more.',
  description = 'A community to organise outings between women: restaurants, cafés, the beach, beach clubs, shopping, nights out, discoveries and other activities.'
where topic = 'girl_activity';
-- No match tags (as IRLY Girl's others): IRLY Girl lists them with girl_official_communities().
insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort, active, description) values
  ('girl_sport', 'Girl Sport', 'Find sports partners and train together, between women.', '🎾',
    '{}', '{dubai}', true, false, 4, true,
    'A community for women who want to find sports partners, organise workouts, do physical activities together and share their goals.')
on conflict (topic) do nothing;
-- Girl CEO: IRLY Girl's business circle, inside IRLY Network (not in IRLY Girl's list).
update public.community_topics set name = 'Girl CEO', sort = 5 where topic = 'girl_network';

update public.community_topics set name = 'IRLY Maman',
  description = 'A community for moms who want to meet other moms, share their experiences, swap tips and organise activities that fit their family life. Members can introduce themselves, chat, share recommendations and suggest outings with their children.'
where topic = 'moms';

-- ───────── 3. Retired: no longer active, never made again ─────────
update public.community_topics set active = false
where topic in ('newcomers', 'help', 'gym', 'football', 'running', 'wellness', 'trip', 'beach', 'food', 'culture',
  'nights', 'shopping', 'entrepreneurs', 'ecom', 'tech', 'ai', 'families', 'girls', 'girl_francophone');

-- An official community of the catalog whose topic is retired: retired too
-- (its groups stay inside it, as they are).
create or replace function private.retire_official_communities() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.communities c set retired_at = now()
  where c.official and c.topic is not null and c.parent_id is null and c.deleted_at is null and c.retired_at is null
    and not exists (select 1 from public.community_topics t where t.topic = c.topic and t.active);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.retire_official_communities() from public, anon, authenticated;

-- One community (and its chat) per active topic and city; safe to run again.
-- A retired community is never made again, renamed or brought back: its
-- topic is inactive, and a topic's existing row (retired or not) blocks a
-- second one (communities_official_topic_city). Names, taglines and the
-- topic's description follow the catalog.
create or replace function private.ensure_official_communities() returns integer
language plpgsql security definer set search_path = public as $$
declare
  t public.community_topics;
  city text;
  cid uuid;
  gone timestamptz;
  conv uuid;
  made integer := 0;
begin
  for t in select * from public.community_topics where active loop
    foreach city in array t.cities loop
      select id, retired_at into cid, gone from public.communities
      where official and topic = t.topic and city_id = city and parent_id is null and deleted_at is null;
      if cid is null then
        insert into public.communities (city_id, name, tagline, description, category_id, girl_only, created_by, official, topic)
        values (city, t.name, t.tagline, t.description, null, t.girl_only, null, true, t.topic)
        returning id into cid;
        conv := private.ensure_conversation('community', cid, t.name);
        insert into public.messages (conversation_id, sender_id, kind, body)
        values (conv, null, 'system', 'Welcome to ' || t.name || ' 👋 Introduce yourself, post your questions, tips and plans, join members'' activities or suggest your own. Be kind and help others feel welcome.');
        made := made + 1;
      elsif gone is null then
        update public.communities set name = t.name, tagline = t.tagline, description = coalesce(t.description, description)
        where id = cid and (name <> t.name or tagline is distinct from t.tagline
          or (t.description is not null and description is distinct from t.description));
      end if;
      cid := null;
      gone := null;
    end loop;
  end loop;
  return made;
end $$;
revoke all on function private.ensure_official_communities() from public, anon, authenticated;

select private.retire_official_communities();
select private.ensure_official_communities();

-- For the record (deploy log): what each retired topic still holds, kept as is.
do $$
declare r record;
begin
  for r in
    select c.topic, count(*) as rows, sum(c.members_count) as members,
      (select count(*) from public.community_posts p join public.communities g on g.id = p.community_id
        where p.deleted_at is null and g.retired_at is not null and g.topic = c.topic) as posts,
      (select count(*) from public.community_posts p join public.communities g on g.id = p.community_id
        join public.communities par on par.id = g.parent_id
        where p.deleted_at is null and par.retired_at is not null and par.topic = c.topic) as group_posts
    from public.communities c
    where c.official and c.parent_id is null and c.retired_at is not null and c.deleted_at is null
    group by c.topic order by c.topic
  loop
    raise notice 'retired official topic %: % communities, % members, % posts, % posts in their groups (all kept)',
      r.topic, r.rows, r.members, r.posts, r.group_posts;
  end loop;
end $$;

-- ───────── 4. Lists ─────────
-- Main communities: retired ones are left out (their members find them in
-- « Mine »); in each city IRLY's official ones first, then the members'
-- (most members first, then the oldest).
create or replace function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only, c.members_count,
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
    and c.retired_at is null
  order by (c.city_id = p_city) desc, c.official desc, c.members_count desc, c.created_at, c.id
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- IRLY Girl's four, with the caller's membership: the same list on every
-- IRLY Girl page (Girl CEO is reached from IRLY Network, not listed here).
create or replace function public.girl_official_communities()
returns table (id uuid, topic text, name text, tagline text, emoji text, members integer, is_member boolean, city_id text, cover_path text)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select x.id, x.topic, x.name, x.tagline, x.emoji, x.members_count, private.i_belong(x.id), x.city_id, x.cover_path
  from (
    -- One per topic (Dubai's), in IRLY's order: Trip, Expat, Activité, Sport.
    select distinct on (t.sort) c.id, c.topic, c.name, c.tagline, coalesce(c.emoji, t.emoji) as emoji, c.members_count,
      c.city_id, c.cover_path, t.sort
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null and c.girl_only
      and c.topic in ('girl_trip', 'girl_newcomers', 'girl_activity', 'girl_sport')
    order by t.sort, c.city_id = 'dubai' desc, c.created_at
  ) x
  order by x.sort;
end $$;
revoke all on function public.girl_official_communities() from public, anon;
grant execute on function public.girl_official_communities() to authenticated;

-- Groups to join: as before, never a group of a retired community unless
-- the member is already in that community.
create or replace function public.suggest_groups(p_city text, p_limit integer default 8)
returns table (id uuid, name text, emoji text, parent_id uuid, parent_name text, members integer, posts_week integer, reason text)
language sql stable security invoker set search_path = public as $$
  with me as (
    select coalesce(interests, '{}') || coalesce(activity_prefs, '{}') || coalesce(sports, '{}') as likes
    from public.profiles where id = auth.uid()
  )
  select g.id, g.name, g.emoji, g.parent_id, par.name,
    (select count(*)::int from public.community_members m where m.community_id = g.id),
    (select count(*)::int from public.community_posts x where x.community_id = g.id and x.deleted_at is null and x.created_at > now() - interval '7 days'),
    case when private.i_belong(g.parent_id) then 'in_your_community' else 'your_interests' end
  from public.communities g
  join public.communities par on par.id = g.parent_id and par.deleted_at is null
  cross join me
  where g.deleted_at is null and g.parent_id is not null
    and g.city_id = any (private.city_scope(p_city))
    and not private.i_belong(g.id)
    and (par.retired_at is null or private.i_belong(g.parent_id))
    and (private.i_belong(g.parent_id) or g.subtopic = any (me.likes) or lower(g.name) = any (me.likes))
  order by private.i_belong(g.parent_id) desc, 7 desc, 6 desc
  limit least(greatest(p_limit, 1), 20)
$$;
revoke all on function public.suggest_groups(text, integer) from public, anon;
grant execute on function public.suggest_groups(text, integer) to authenticated;
