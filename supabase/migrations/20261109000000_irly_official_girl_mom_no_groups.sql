-- IRLY Girl and IRLY Mom Community mirror IRLY's official list; groups are
-- removed everywhere (owner decisions, 2026-11-06).
--
-- 1. IRLY Girl = IRLY (Mixte) with « Girl » names, Dubai only, women only:
--      girl_newcomers Girl Expat          (twin: expats, IRLY Expat)
--      girl_activity  Girl Activité       (twin: lifestyle, IRLY Activité)
--      girl_sport     Girl Sport          (twin: sport, IRLY Sport)
--      girl_running   Girl Running Club   (twin: running, new)
--      girl_padel     Girl Padel Club     (twin: padel, new)
--      girl_trip      Girl Trip           (twin: trip, IRLY Trip)
--      girl_network   Girl CEO            (twin: network; inside IRLY Network, never a tile)
--      girl_francaise Les Françaises à Dubaï (twin: francais, new)
--    The retired Dubai rows of girl_newcomers, girl_activity, girl_sport and
--    girl_trip come back (same id, members, posts, chat). The general IRLY
--    Girl community (girls) is retired again: kept, its members keep it in
--    « Mine », it only leaves the lists.
-- 2. IRLY Mom Community = the same mirror for moms, Dubai only, women only:
--      mom_expat Mom Expat, mom_activity Mom Activité (outings with the kids),
--      mom_sport Mom Sport, mom_running Mom Running Club, mom_padel Mom Padel
--      Club, mom_trip Mom Trip (family outings and weekends), mom_network Mom
--      CEO (inside IRLY Network, like Girl CEO), mom_francaise Les Mamans
--      françaises à Dubaï.
--    The retired « IRLY Mom Community » rows (moms) stay retired, as they
--    are: re-topicing them would move their chat, history and the code that
--    reads the 'moms' topic (spaces, feeds, back office) for no member gain.
--    Same eligibility as the moms space: women only (girl_only, read through
--    private.is_girl_eligible by the communities' row security).
--    Recommendations: each Girl and Mom topic matches its mixte twin's
--    answers (and lang:fr for the French ones); a Mom topic is recommended
--    only to a member who answered « Family & kids » (require_tags).
-- 3. Spaces: private.topic_space says 'mom' for every mom_* topic, so the
--    back office lists and reorders each space's official communities;
--    private.community_space follows. girl_official_communities() lists
--    IRLY Girl's seven (never Girl CEO, never a Mom one);
--    mom_official_communities() lists the Mom Community's seven (never Mom
--    CEO). girl_feed(…, true) reads the mom_* communities too.
-- 4. Groups (communities with a parent) are removed everywhere: every one,
--    IRLY's automatic ones and the ones members made, gets deleted_at (rows,
--    members, posts and chats kept; private.removed_groups lists them, so
--    clearing deleted_at for those ids restores them). The group catalog is
--    switched off and private.ensure_official_subgroups() makes nothing any
--    more; members cannot create a group (create_subgroup refuses, and so
--    does a direct insert), suggest_groups suggests nothing, the chats of the
--    removed groups leave the inbox and take no new message. Leaving a
--    community no longer erases the kept memberships of its removed groups.
-- Every community created by a member at the top level stays as it is.
-- Idempotent: running the file again changes nothing more.

-- ───────── 0. Recommendations that need an answer ─────────
alter table public.community_topics add column if not exists require_tags text[];
comment on column public.community_topics.require_tags is
  'Null: recommended from match_tags alone. Otherwise the member''s answers must also hold one of these tags (Mom topics: Family & kids).';

-- ───────── 1. IRLY Girl's topics ─────────
update public.community_topics set active = true, cities = '{dubai}', girl_only = true, sort = 1, emoji = '🌍',
  tagline = 'Living abroad, between women: tips, friends and a sense of home.',
  description = 'A community for women who are expats, newly arrived or living in Dubai and want to grow their social circle. Members can introduce themselves, share their experiences, swap tips, discover the city and meet women who share their interests.',
  match_tags = (select match_tags from public.community_topics where topic = 'expats')
where topic = 'girl_newcomers';
update public.community_topics set active = true, cities = '{dubai}', girl_only = true, sort = 2,
  tagline = 'Outings between women: restaurants, cafés, beach clubs, shopping, nights out and more.',
  description = 'A community to suggest and discover outings and experiences to share between women: restaurants, cafés, the beach, beach clubs, shopping, nights out, trips, excursions and other leisure. Members can suggest their own activities and invite other women to join.',
  match_tags = (select match_tags from public.community_topics where topic = 'lifestyle')
where topic = 'girl_activity';
update public.community_topics set active = true, cities = '{dubai}', girl_only = true, sort = 3, emoji = '🏅',
  tagline = 'Play, train and stay active together, between women.',
  description = 'A community for women who want to find sports partners, organise training sessions, do physical activities together and meet women who share the same goals.',
  match_tags = (select match_tags from public.community_topics where topic = 'sport')
where topic = 'girl_sport';
update public.community_topics set active = true, cities = '{dubai}', girl_only = true, sort = 6,
  tagline = 'Discover the Emirates and travel together, between women.',
  description = 'A community for women who want to plan trips, weekends and excursions together, discover the Emirates and beyond, and find travel companions.',
  match_tags = (select match_tags from public.community_topics where topic = 'trip')
where topic = 'girl_trip';
update public.community_topics set active = true, cities = '{dubai}', girl_only = true, sort = 7
where topic = 'girl_network';

insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort, active, description) values
  ('girl_running', 'Girl Running Club', 'Run together in Dubai, between women, from sunrise 5Ks to race days.', '🏃‍♀️',
    (select match_tags from public.community_topics where topic = 'running'), '{dubai}', true, false, 4, true,
    'A community for women runners of every level who want to find running partners, join group runs, discover new routes in Dubai and prepare races together.'),
  ('girl_padel', 'Girl Padel Club', 'Find padel partners and play together in Dubai, between women.', '🎾',
    (select match_tags from public.community_topics where topic = 'padel'), '{dubai}', true, false, 5, true,
    'A community for women padel players of every level who want to find partners, organise games, share courts and progress together.'),
  ('girl_francaise', 'Les Françaises à Dubaï', 'French-speaking women in Dubai: meetups, tips and plans in French.', '🥐',
    '{lang:fr}', '{dubai}', true, false, 8, true,
    'A community for French-speaking women living in Dubai or newly arrived, to meet, swap tips, share plans and help each other, in French.')
on conflict (topic) do nothing;

-- The general IRLY Girl community: retired again (kept, with its members).
update public.community_topics set active = false where topic = 'girls';

-- ───────── 2. IRLY Mom Community's topics ─────────
insert into public.community_topics (topic, name, tagline, emoji, match_tags, require_tags, cities, girl_only, intro_first, sort, active, description) values
  ('mom_expat', 'Mom Expat', 'Moms new to Dubai or living here: schools, tips and a sense of home.', '🌍',
    (select match_tags from public.community_topics where topic = 'expats'), '{goal:family,interest:family}', '{dubai}', true, false, 1, true,
    'A community for moms who are expats, newly arrived or living in Dubai and want to grow their circle. Members can introduce themselves, share their family''s experience, swap tips on schools, nurseries and daily life with kids, and meet other moms.'),
  ('mom_activity', 'Mom Activité', 'Outings with the kids: parks, play areas, the beach, workshops and more.', '🧸',
    (select array(select distinct x from unnest((select match_tags from public.community_topics where topic = 'lifestyle') || '{goal:family,interest:family}'::text[]) x order by x)),
    '{goal:family,interest:family}', '{dubai}', true, false, 2, true,
    'A community to suggest and discover outings to share with children: parks, play areas, the beach, kids'' workshops, family-friendly restaurants and cafés. Members can suggest their own activities and invite other moms and their kids to join.'),
  ('mom_sport', 'Mom Sport', 'Stay active between moms, with or without the kids.', '🏅',
    (select match_tags from public.community_topics where topic = 'sport'), '{goal:family,interest:family}', '{dubai}', true, false, 3, true,
    'A community for moms who want to find sports partners, organise workouts that fit family life, do physical activities together and share their goals.'),
  ('mom_running', 'Mom Running Club', 'Run together between moms in Dubai, strollers welcome.', '🏃‍♀️',
    (select match_tags from public.community_topics where topic = 'running'), '{goal:family,interest:family}', '{dubai}', true, false, 4, true,
    'A community for moms who run, at every level, to find running partners, join group runs that fit school hours, discover family-friendly routes in Dubai and prepare races together.'),
  ('mom_padel', 'Mom Padel Club', 'Find padel partners between moms, around school hours.', '🎾',
    (select match_tags from public.community_topics where topic = 'padel'), '{goal:family,interest:family}', '{dubai}', true, false, 5, true,
    'A community for moms who play padel, at every level, to find partners, organise games around family life, share courts and progress together.'),
  ('mom_trip', 'Mom Trip', 'Family outings and weekends: discover the Emirates with the kids.', '🚗',
    (select array(select distinct x from unnest((select match_tags from public.community_topics where topic = 'trip') || '{goal:family,interest:family}'::text[]) x order by x)),
    '{goal:family,interest:family}', '{dubai}', true, false, 6, true,
    'A community for moms who want to plan family outings, weekends and trips together, discover the Emirates and beyond with their children, and find other families to travel with.'),
  ('mom_network', 'Mom CEO', 'Moms in business: entrepreneurship, opportunities and your network.', '💼',
    '{}', '{goal:family,interest:family}', '{dubai}', true, false, 7, true,
    'A community for moms who are entrepreneurs, executives, freelancers or professionals and want to grow their network, present their business, share their projects and balance work and family life.'),
  ('mom_francaise', 'Les Mamans françaises à Dubaï', 'French-speaking moms in Dubai: schools, tips and family plans in French.', '🥐',
    '{lang:fr}', '{goal:family,interest:family}', '{dubai}', true, false, 8, true,
    'A community for French-speaking moms living in Dubai or newly arrived, to meet, swap tips on schools and family life, share plans with the kids and help each other, in French.')
on conflict (topic) do nothing;

-- ───────── 3. Back in Dubai, then made once; IRLY Girl retired ─────────
update public.communities c set retired_at = null
where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is not null
  and c.city_id = 'dubai' and c.topic in ('girl_newcomers', 'girl_activity', 'girl_sport', 'girl_trip');

select private.retire_official_communities();
select private.ensure_official_communities();

-- ───────── 4. Spaces ─────────
create or replace function private.topic_space(p_topic text, p_girl boolean) returns text
language sql immutable as $$
  select case when p_topic = 'moms' or p_topic like 'mom\_%' then 'mom' when p_girl then 'girl' else 'mixte' end
$$;

create or replace function private.community_space(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when private.topic_space(c.topic, false) = 'mom' or private.topic_space(pc.topic, false) = 'mom' then 'mom'
    when c.girl_only then 'girl'
    else 'mixte' end
  from public.communities c left join public.communities pc on pc.id = c.parent_id
  where c.id = p_id
$$;
revoke all on function private.community_space(uuid) from public, anon, authenticated;

-- Same as in 20261029700000, with Mom CEO inside IRLY Network too.
create or replace function public.admin_official_topics()
returns table (topic text, name text, space text, sort integer, tagline text, description text, emoji text,
  communities bigint, members bigint, in_network boolean)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  return query
    select t.topic, t.name, private.topic_space(t.topic, t.girl_only), t.sort, t.tagline, t.description, t.emoji,
      (select count(*) from public.communities c where c.official and c.topic = t.topic and c.deleted_at is null and c.parent_id is null),
      (select coalesce(sum(c.members_count), 0)::bigint from public.communities c
        where c.official and c.topic = t.topic and c.deleted_at is null and c.parent_id is null),
      t.topic in ('network', 'girl_network', 'mom_network')
    from public.community_topics t
    where t.active
    order by private.topic_space(t.topic, t.girl_only), t.sort, t.topic;
end $$;
revoke all on function public.admin_official_topics() from public, anon;
grant execute on function public.admin_official_topics() to authenticated;

-- ───────── 5. Official lists of IRLY Girl and IRLY Mom Community ─────────
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
    -- One per active IRLY Girl topic (Dubai's), in IRLY's order; Girl CEO stays in IRLY Network.
    select distinct on (t.sort, t.topic) c.id, c.topic, c.name, c.tagline, coalesce(c.emoji, t.emoji) as emoji, c.members_count,
      c.city_id, c.cover_path, t.sort
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active and t.girl_only
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null and c.girl_only
      and private.topic_space(t.topic, t.girl_only) = 'girl'
      and c.topic <> 'girl_network'
    order by t.sort, t.topic, c.city_id = 'dubai' desc, c.created_at
  ) x
  order by x.sort, x.topic;
end $$;
revoke all on function public.girl_official_communities() from public, anon;
grant execute on function public.girl_official_communities() to authenticated;

/** IRLY Mom Community's official communities, in IRLY's order (Mom CEO stays in IRLY Network). Women only. */
create or replace function public.mom_official_communities()
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
    select distinct on (t.sort, t.topic) c.id, c.topic, c.name, c.tagline, coalesce(c.emoji, t.emoji) as emoji, c.members_count,
      c.city_id, c.cover_path, t.sort
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active and t.girl_only
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null and c.girl_only
      and private.topic_space(t.topic, t.girl_only) = 'mom'
      and c.topic <> 'mom_network'
    order by t.sort, t.topic, c.city_id = 'dubai' desc, c.created_at
  ) x
  order by x.sort, x.topic;
end $$;
revoke all on function public.mom_official_communities() from public, anon;
grant execute on function public.mom_official_communities() to authenticated;

-- IRLY Mom Community's feed: its official communities' posts too (and the retired moms ones, for their members).
create or replace function public.girl_feed(p_city text, p_moms boolean default false, p_limit integer default 30,
  p_before timestamptz default null)
returns table (id uuid, community_id uuid, community_name text, author_id uuid, first_name text, body text, activity_id uuid,
  activity_title text, activity_starts_at timestamptz, likes integer, comments integer, liked boolean, created_at timestamptz,
  mine boolean, is_member boolean, media_paths text[], media_kind text, thumb_path text, media_seconds integer)
language plpgsql stable set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select p.id, c.id, c.name, p.author_id,
    (select pp.first_name from public.profiles_public pp where pp.id = p.author_id),
    p.body, p.activity_id, act.title, act.starts_at,
    private.like_count('community_post', p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds
  from public.community_posts p
  join public.communities c on c.id = p.community_id and c.deleted_at is null and c.girl_only
  left join public.activities act on act.id = p.activity_id
  where p.deleted_at is null
    and c.city_id = any (private.city_scope(p_city))
    and (not p_moms or c.category_id = 'family'
      or private.topic_space(coalesce(c.topic, (select t.topic from public.communities t where t.id = c.parent_id)), true) = 'mom')
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 60);
end $$;

-- ───────── 6. Recommendations: a Mom topic needs « Family & kids » ─────────
-- Same as in 20261108300000, with require_tags (and groups never recommended).
create or replace function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean, members integer, is_member boolean, score integer, city_id text)
language sql stable set search_path = public as $$
  with mine as (select distinct unnest(coalesce(p_tags, '{}')) as tag),
  cand as (
    select c.id, t.topic, c.name, c.tagline, t.emoji, c.girl_only, t.intro_first, c.city_id, t.sort,
      c.members_count as members,
      private.i_belong(c.id) as is_member,
      (select coalesce(sum(case
          when m.tag = 'newcomer' then 3
          when m.tag like 'interest:%' then 3
          when m.tag like 'activity:%' or m.tag like 'goal:%' then 2
          when m.tag like 'type:%' then 1
          when m.tag like 'lang:%' then 3
          else 0 end), 0)::int
        from mine m where m.tag = any (t.match_tags)) as base
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.deleted_at is null and c.retired_at is null and c.parent_id is null
      and c.city_id = any (private.city_scope(p_city))
      and (t.require_tags is null or coalesce(p_tags, '{}') && t.require_tags)
  ),
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id
  from best
  -- A tie between an IRLY community and its Girl or Mom twin: IRLY's first (the twin follows).
  order by score desc, sort, girl_only, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;

-- ───────── 7. Groups: removed everywhere, kept ─────────
create table if not exists private.removed_groups (
  community_id uuid primary key references public.communities (id) on delete cascade,
  removed_at timestamptz not null default now(),
  official boolean not null,
  members integer not null default 0,
  posts integer not null default 0
);
comment on table private.removed_groups is
  'Groups removed on 2026-11-06 (owner decision): clearing communities.deleted_at for these ids restores them.';
revoke all on table private.removed_groups from public, anon, authenticated;

-- The catalog never makes a group again.
update public.community_subtopics set active = false where active;

create or replace function private.ensure_official_subgroups() returns integer
language plpgsql security definer set search_path = public as $$
begin
  -- Groups were removed (20261109000000): IRLY makes none any more.
  return 0;
end $$;
revoke all on function private.ensure_official_subgroups() from public, anon, authenticated;

with gone as (
  update public.communities g set deleted_at = now()
  where g.parent_id is not null and g.deleted_at is null
  returning g.id, g.official
)
insert into private.removed_groups (community_id, official, members, posts)
select gone.id, gone.official,
  (select count(*)::int from public.community_members m where m.community_id = gone.id),
  (select count(*)::int from public.community_posts p where p.community_id = gone.id and p.deleted_at is null)
from gone
on conflict (community_id) do nothing;

-- Members cannot make a group any more (the server keeps the shape rules for what exists).
create or replace function public.create_subgroup(p_parent uuid, p_name text, p_tagline text default null, p_emoji text default null)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  raise exception 'groups are no longer available' using errcode = '42501';
end $$;
revoke all on function public.create_subgroup(uuid, text, text, text) from public, anon;
grant execute on function public.create_subgroup(uuid, text, text, text) to authenticated;

create or replace function private.subgroup_shape() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.communities;
begin
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'a group cannot move' using errcode = '42501';
  end if;
  if new.parent_id is null then return new; end if;
  -- No new group from the app (groups were removed on 2026-11-06).
  if auth.uid() is not null and (tg_op = 'INSERT' or old.parent_id is null) then
    raise exception 'groups are no longer available' using errcode = '42501';
  end if;
  select * into p from public.communities where id = new.parent_id;
  if not found or p.parent_id is not null then
    raise exception 'a group belongs to a top community' using errcode = '22023';
  end if;
  new.city_id := p.city_id;
  new.girl_only := p.girl_only;
  return new;
end $$;

-- Leaving a community no longer erases the kept memberships of its removed groups.
create or replace function private.sync_subgroup_members() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent uuid;
begin
  if tg_op = 'INSERT' then
    select parent_id into parent from public.communities where id = new.community_id;
    if parent is not null then
      insert into public.community_members (community_id, user_id) values (parent, new.user_id) on conflict do nothing;
    end if;
    return null;
  end if;
  delete from public.community_members m using public.communities c
  where c.parent_id = old.community_id and c.deleted_at is null
    and m.community_id = c.id and m.user_id = old.user_id and m.role <> 'owner';
  return null;
end $$;

-- No group to suggest.
create or replace function public.suggest_groups(p_city text, p_limit integer default 8)
returns table (id uuid, name text, emoji text, parent_id uuid, parent_name text, members integer, posts_week integer, reason text)
language sql stable security invoker set search_path = public as $$
  select null::uuid, null::text, null::text, null::uuid, null::text, null::integer, null::integer, null::text
  where false
$$;
revoke all on function public.suggest_groups(text, integer) from public, anon;
grant execute on function public.suggest_groups(text, integer) to authenticated;

-- A removed group's chat takes no new message (its history stays readable to its members).
create or replace function private.removed_group_chat_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.sender_id is not null and exists (
    select 1 from public.conversations v join public.communities g on g.id = v.community_id
    where v.id = new.conversation_id and g.parent_id is not null and g.deleted_at is not null
  ) then
    raise exception 'this group is no longer available' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.removed_group_chat_guard() from public, anon, authenticated;
drop trigger if exists messages_removed_group on public.messages;
create trigger messages_removed_group before insert on public.messages
for each row execute function private.removed_group_chat_guard();

-- The inbox: a removed group's chat leaves it (same as 20261007002800 otherwise).
create or replace function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text, last_sender uuid,
  last_at timestamptz, unread integer, ref_id uuid, other_photo text, photo_path text, photo_bucket text, members integer,
  last_kind text, last_sender_name text, archived boolean)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(com.name, act.title, c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from (
       select 1 from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and x.created_at > greatest(coalesce(me.last_read_at, 'epoch'::timestamptz), coalesce(me.cleared_at, 'epoch'::timestamptz))
         and (x.sender_id is null or x.sender_id <> all (array(
           select b.blocked_id from public.blocks b where b.blocker_id = auth.uid()
           union all select b.blocker_id from public.blocks b where b.blocked_id = auth.uid())))
         and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = x.id)
       limit 100
     ) u),
    coalesce(c.activity_id, c.community_id, c.match_id),
    other.photo,
    coalesce(com.cover_path, c.photo_path, act.cover_path),
    case when coalesce(com.cover_path, c.photo_path, act.cover_path) is null then null else 'activity-photos' end,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.kind,
    lm.first_name,
    me.archived_at is not null
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities com on com.id = c.community_id
  left join public.activities act on act.id = c.activity_id
  left join lateral (
    select p.id, p.first_name, p.photo_paths[1] as photo from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at, m.kind, sp.first_name from public.messages m
    left join public.profiles sp on sp.id = m.sender_id
    where m.conversation_id = c.id and m.deleted_at is null
      and (m.sender_id is null or not private.blocked_unchecked(auth.uid(), m.sender_id))
      and m.created_at > coalesce(me.cleared_at, '-infinity'::timestamptz)
      and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = m.id)
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
    and (me.cleared_at is null or lm.created_at is not null)
    -- IRLY Girl chats (Match, girls-only community or activity) only with IRLY Girl access.
    and ((select private.is_girl_eligible())
         or not (c.kind = 'match' or coalesce(com.girl_only, false) or coalesce(act.girl_only, false)))
    -- A removed group's chat (groups were removed on 2026-11-06).
    and not (com.parent_id is not null and com.deleted_at is not null)
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- ───────── 8. For the record (deploy log) ─────────
do $$
declare r record;
begin
  for r in
    select private.topic_space(t.topic, t.girl_only) as space, t.sort, t.topic, c.name, c.city_id, c.members_count
    from public.communities c join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.parent_id is null and c.deleted_at is null and c.retired_at is null
    order by 1, t.sort, t.topic
  loop
    raise notice 'official listed (%): % % (%), % members', r.space, r.city_id, r.name, r.topic, r.members_count;
  end loop;
  for r in
    select c.topic, count(*) as rows, coalesce(sum(c.members_count), 0) as members
    from public.communities c
    where c.official and c.parent_id is null and c.retired_at is not null and c.deleted_at is null
      and c.topic in ('girls', 'moms', 'girl_francophone')
    group by c.topic order by c.topic
  loop
    raise notice 'retired official topic %: % communities, % members (all kept)', r.topic, r.rows, r.members;
  end loop;
  for r in
    select official, count(*) as groups, coalesce(sum(members), 0) as members, coalesce(sum(posts), 0) as posts
    from private.removed_groups group by official order by official
  loop
    raise notice 'groups soft-deleted (%): % groups, % memberships, % posts (all kept, private.removed_groups)',
      case when r.official then 'IRLY' else 'members''' end, r.groups, r.members, r.posts;
  end loop;
end $$;
