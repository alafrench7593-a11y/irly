-- IRLY's official communities: Dubai only, the owner's list (2026-11-06).
--
-- Owner decision: IRLY runs exactly these official communities, in Dubai:
--   IRLY Expat (expats), IRLY Activité (lifestyle), IRLY Sport (sport),
--   IRLY Running Club (running), IRLY Padel Club (padel, new),
--   IRLY Trip (trip), IRLY Network (network), IRLY Girl (girls, women only)
--   and Les Français à Dubaï (francais, new, open to everyone).
--   Girl CEO (girl_network) stays: it is IRLY Network's circle for women,
--   reached from the IRLY Network section, never a tile in the lists.
-- Every community created by a member stays as it is.
--
-- Data-preserving, nothing is deleted or soft-deleted (same rule as
-- 20261028100000_irly_official_communities_four):
-- 1. Every other official topic becomes inactive: girl_trip, girl_newcomers,
--    girl_activity, girl_sport, moms (and the topics already
--    retired). ensure_official_communities() never makes them again.
-- 2. Every official topic runs in Dubai only (cities = {dubai}). Its
--    communities in the other emirates and Bali (all without members on
--    2026-11-06, read-only census) are retired with them.
-- 3. A retired community keeps everything: membership, posts, groups and
--    chat. Its members still find it in « Mine », its page and its chat work
--    as before; it only leaves the lists and suggestions. Reversible: clear
--    retired_at and set the topic active again.
-- 4. IRLY Running, IRLY Trip and IRLY Girl were retired in Dubai on
--    2026-10-28: their Dubai rows come back (same id, members, posts, chat),
--    renamed through their topic. IRLY Padel Club and Les Français à Dubaï
--    are created once.
-- 5. IRLY Girl's official list (girl_official_communities) is now every
--    active women-only official topic, so it shows IRLY Girl.

-- ───────── 1. The owner's list ─────────
update public.community_topics set active = false
where topic not in ('expats', 'lifestyle', 'sport', 'running', 'padel', 'trip', 'network', 'girl_network', 'girls', 'francais');

update public.community_topics set active = true, cities = '{dubai}'
where topic in ('expats', 'lifestyle', 'sport', 'running', 'trip', 'network', 'girl_network', 'girls');

update public.community_topics set sort = 1 where topic = 'expats';
update public.community_topics set sort = 2 where topic = 'lifestyle';
update public.community_topics set sort = 3 where topic = 'sport';
update public.community_topics set name = 'IRLY Running Club', sort = 4,
  tagline = 'Run together in Dubai, from sunrise 5Ks to race days.',
  description = 'A community for runners of every level who want to find running partners, join group runs, discover new routes in Dubai and prepare races together.'
where topic = 'running';
update public.community_topics set name = 'IRLY Trip', sort = 6,
  tagline = 'Discover the Emirates and travel with others.',
  description = 'A community to plan trips, weekends and excursions together, discover the Emirates and beyond, and find travel companions.'
where topic = 'trip';
update public.community_topics set sort = 7 where topic = 'network';
-- IRLY Girl's space: IRLY Girl first, Girl CEO last (inside IRLY Network).
update public.community_topics set sort = 10 where topic = 'girl_network';
update public.community_topics set name = 'IRLY Girl', sort = 8,
  tagline = 'Women meeting women in Dubai: plans, advice and friendship.',
  description = 'A community for women who want to meet other women in Dubai, share plans and advice, organise outings and build real friendships.'
where topic = 'girls';

insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort, active, description) values
  ('padel', 'IRLY Padel Club', 'Find padel partners and play together in Dubai.', '🎾',
    '{activity:padel}', '{dubai}', false, false, 5, true,
    'A community for padel players of every level who want to find partners, organise games, share courts and progress together.'),
  ('francais', 'Les Français à Dubaï', 'French speakers in Dubai: meetups, tips and plans in French.', '🥐',
    '{}', '{dubai}', false, false, 9, true,
    'A community for French speakers living in Dubai or newly arrived, to meet, swap tips, share plans and help each other, in French.')
on conflict (topic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji,
  match_tags = excluded.match_tags, cities = excluded.cities, girl_only = excluded.girl_only, sort = excluded.sort,
  active = true, description = excluded.description;

-- ───────── 2. Back in Dubai: IRLY Running, IRLY Trip, IRLY Girl ─────────
update public.communities c set retired_at = null
where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is not null
  and c.city_id = 'dubai' and c.topic in ('running', 'trip', 'girls');

-- ───────── 3. Retired: inactive topics, and active ones outside their cities ─────────
create or replace function private.retire_official_communities() returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  update public.communities c set retired_at = now()
  where c.official and c.topic is not null and c.parent_id is null and c.deleted_at is null and c.retired_at is null
    and not exists (select 1 from public.community_topics t where t.topic = c.topic and t.active and c.city_id = any (t.cities));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.retire_official_communities() from public, anon, authenticated;

select private.retire_official_communities();
select private.ensure_official_communities();

-- ───────── 4. IRLY Girl's official list ─────────
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
    -- One per active women-only topic (Dubai's), in IRLY's order; Girl CEO stays in IRLY Network.
    select distinct on (t.sort, t.topic) c.id, c.topic, c.name, c.tagline, coalesce(c.emoji, t.emoji) as emoji, c.members_count,
      c.city_id, c.cover_path, t.sort
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active and t.girl_only
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null and c.girl_only
      and c.topic <> 'girl_network'
    order by t.sort, t.topic, c.city_id = 'dubai' desc, c.created_at
  ) x
  order by x.sort;
end $$;
revoke all on function public.girl_official_communities() from public, anon;
grant execute on function public.girl_official_communities() to authenticated;

-- For the record (deploy log): what stays listed, and what each retired topic still holds.
do $$
declare r record;
begin
  for r in
    select c.city_id, c.topic, c.name, c.members_count from public.communities c
    where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null
    order by c.city_id, c.topic
  loop
    raise notice 'official listed: % % (%), % members', r.city_id, r.name, r.topic, r.members_count;
  end loop;
  for r in
    select c.topic, count(*) as rows, sum(c.members_count) as members
    from public.communities c
    where c.official and c.parent_id is null and c.retired_at is not null and c.deleted_at is null
    group by c.topic order by c.topic
  loop
    raise notice 'retired official topic %: % communities, % members (all kept)', r.topic, r.rows, r.members;
  end loop;
end $$;
