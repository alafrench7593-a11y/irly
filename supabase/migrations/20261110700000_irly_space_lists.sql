-- Each app space lists only its own communities, on the server (owner
-- request, 2026-11-06: « in IRLY Mixte you still show Girl communities »).
--
-- Until now the lists returned every community the caller may read (a woman
-- with IRLY Girl access reads Girl, Mom and women-only Network ones too) and
-- the app sorted them out by space. An installed build without that filter
-- (or a list that forgot it) showed IRLY Girl communities in Mixte. The lists
-- now take the space and keep only its communities, with the one universe
-- rule (private.community_universe, migration 20261110000000, through
-- private.community_live_space, migration 20261110400000):
--   Mixte ('mixte' or 'irly'):          Mixte, and Network not women-only;
--   IRLY Girl ('girl' or 'irly_girl'):  Girl, Mom, and Network women-only.
--
--   community_list(p_city, p_space)
--   community_directory(p_city, p_sort, p_search, p_limit, p_space)
--   community_recommend(p_city, p_tags, p_limit, p_space)
--   member_communities(p_user, p_space)
--   search_all(p_q, p_city, p_limit, p_space)   (its communities and activities)
--   event_activities(p_event, p_limit, p_space)  (plans to go to an event together)
--   post_activities(p_post, p_limit, p_space)    (plans made from a post)
--
-- p_space is last and defaults to null: null keeps the previous answer
-- exactly (installed apps call without it). Any other value is refused
-- (22023). Read rules are untouched: the space only ever removes rows.
-- Each function is dropped and created again with the same body, the same
-- security mode and the same grants (signed-in members only).
-- Idempotent.

-- ───────── The space of a list ─────────
-- 'irly' (Mixte) or 'irly_girl' (IRLY Girl), the values of app_scope and of
-- private.community_live_space; null for no space (every universe).
create or replace function private.space_scope(p_space text) returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_space is null then return null; end if;
  if p_space in ('mixte', 'irly') then return 'irly'; end if;
  if p_space in ('girl', 'irly_girl') then return 'irly_girl'; end if;
  raise exception 'space: mixte or girl' using errcode = '22023';
end $$;
revoke all on function private.space_scope(text) from public, anon;
grant execute on function private.space_scope(text) to authenticated;

-- Whether a community belongs to a space (null space: yes). Says nothing the
-- lists below do not already return (each asks it about rows it read).
create or replace function private.community_in_space(p_id uuid, p_space text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select p_space is null or private.community_live_space(p_id) = private.space_scope(p_space)
$$;
revoke all on function private.community_in_space(uuid, text) from public, anon;
grant execute on function private.community_in_space(uuid, text) to authenticated;

-- An activity's space: a women-only plan is IRLY Girl's (as the app's
-- activity lists and the map read it: girl_only = the space; every plan of an
-- IRLY Girl, Mom or women-only Network community is women-only, trigger
-- activities_girl_only); otherwise its community's, else Mixte.
create or replace function private.activity_in_space(p_id uuid, p_space text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select p_space is null or coalesce((
    select case when a.girl_only then 'irly_girl'
                when a.community_id is not null then private.community_live_space(a.community_id)
                else 'irly' end
    from public.activities a where a.id = p_id) = private.space_scope(p_space), false)
$$;
revoke all on function private.activity_in_space(uuid, text) from public, anon;
grant execute on function private.activity_in_space(uuid, text) to authenticated;

-- ───────── community_list ─────────
drop function if exists public.community_list(text);
drop function if exists public.community_list(text, text);
create function public.community_list(p_city text, p_space text default null)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz, cover_path text)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only, c.members_count,
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at, c.cover_path
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
    and c.retired_at is null
    and (p_space is null or private.community_in_space(c.id, p_space))
  order by (c.city_id = p_city) desc, c.official desc, case when c.official then t.sort end nulls last,
    c.members_count desc, c.created_at, c.id
  limit 200
$$;
revoke all on function public.community_list(text, text) from public, anon;
grant execute on function public.community_list(text, text) to authenticated;

-- ───────── community_directory ─────────
drop function if exists public.community_directory(text, text, text, integer);
drop function if exists public.community_directory(text, text, text, integer, text);
create function public.community_directory(p_city text, p_sort text default 'members',
  p_search text default null, p_limit integer default 100, p_space text default null)
returns table (id uuid, name text, tagline text, description text, emoji text, category_id text, topic text, official boolean,
  girl_only boolean, members_count integer, upcoming_count integer, posts_week integer, created_at timestamptz,
  is_member boolean, is_favorite boolean, cover_path text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  srt text := coalesce(nullif(btrim(p_sort), ''), 'members');
  pat text := private.ilike_pattern(p_search);
  girl boolean;
  scope text := private.space_scope(p_space);
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if srt not in ('members', 'active', 'recent', 'activities') then
    raise exception 'sort: members, active, recent or activities' using errcode = '22023';
  end if;
  girl := private.girl_eligible_unchecked(me);
  return query
    with base as (
      select c.*, t.emoji as topic_emoji
      from public.communities c
      left join public.community_topics t on t.topic = c.topic
      where c.deleted_at is null and c.parent_id is null and c.retired_at is null
        and (not c.girl_only or girl)
        and (scope is null or private.community_live_space(c.id) = scope)
        and (p_city is null or c.city_id = any (private.city_scope(p_city)))
        and (pat is null or c.name ilike pat or c.tagline ilike pat or c.description ilike pat
             or c.category_id ilike pat or c.topic ilike pat or t.name ilike pat)
    ), counted as (
      select b.*,
        private.community_member_count(b.id) as n_members,
        private.community_upcoming_count(b.id) as n_upcoming,
        (select count(*)::int from public.community_posts x
          where x.community_id = b.id and x.deleted_at is null and x.created_at > now() - interval '7 days') as n_posts,
        -- Chat messages are read only for the « active » sort.
        case when srt = 'active' then
          (select count(*)::int from public.conversations v
            join public.messages msg on msg.conversation_id = v.id
            where v.community_id = b.id and msg.deleted_at is null and msg.sender_id is not null
              and msg.created_at > now() - interval '7 days')
        else 0 end as n_messages
      from base b
    )
    select k.id, k.name, k.tagline, k.description, coalesce(k.emoji, k.topic_emoji), k.category_id, k.topic, k.official,
      k.girl_only, k.n_members, k.n_upcoming, k.n_posts, k.created_at,
      exists (select 1 from public.community_members m where m.community_id = k.id and m.user_id = me),
      exists (select 1 from public.community_favorites f where f.community_id = k.id and f.user_id = me),
      k.cover_path
    from counted k
    order by
      case srt when 'members' then k.n_members when 'active' then k.n_posts + k.n_messages
        when 'activities' then k.n_upcoming else 0 end desc,
      case when srt = 'recent' then k.created_at end desc nulls last,
      k.n_members desc, k.created_at desc, k.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200);
end $$;
revoke all on function public.community_directory(text, text, text, integer, text) from public, anon;
grant execute on function public.community_directory(text, text, text, integer, text) to authenticated;

-- ───────── community_recommend ─────────
drop function if exists public.community_recommend(text, text[], integer);
drop function if exists public.community_recommend(text, text[], integer, text);
create function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6, p_space text default null)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean, members integer,
  is_member boolean, score integer, city_id text, cover_path text)
language sql stable set search_path = public as $$
  with mine as (select distinct unnest(coalesce(p_tags, '{}')) as tag),
  cand as (
    select c.id, t.topic, c.name, c.tagline, t.emoji, c.girl_only, t.intro_first, c.city_id, t.sort, c.cover_path,
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
      and (p_space is null or private.community_in_space(c.id, p_space))
  ),
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id,
    cover_path
  from best
  -- A tie between an IRLY community and its Girl or Mom twin: IRLY's first (the twin follows).
  order by score desc, sort, girl_only, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;
revoke all on function public.community_recommend(text, text[], integer, text) from public, anon;
grant execute on function public.community_recommend(text, text[], integer, text) to authenticated;

-- ───────── member_communities ─────────
drop function if exists public.member_communities(uuid);
drop function if exists public.member_communities(uuid, text);
create function public.member_communities(p_user uuid, p_space text default null)
returns table (id uuid, name text, city_id text, cover_path text, members integer, tagline text, role text, official boolean,
  topic text, category_id text, girl_only boolean, retired boolean)
language sql stable security definer set search_path = public, private as $$
  with v as (
    select auth.uid() as me, p_user = auth.uid() as own
  )
  select c.id, c.name, c.city_id, c.cover_path, c.members_count, c.tagline,
    case when coalesce(c.created_by = p_user or m.role = 'owner', false) then 'created' else 'joined' end,
    c.official, c.topic, c.category_id, c.girl_only, c.retired_at is not null
  from v
  join public.community_members m on m.user_id = p_user
  join public.communities c on c.id = m.community_id and c.deleted_at is null and c.parent_id is null
  where v.me is not null
    and exists (select 1 from public.profiles pr where pr.id = p_user and pr.deleted_at is null)
    and (not c.girl_only or private.girl_eligible_unchecked(v.me))
    and not private.community_banned(c.id, p_user)
    and (p_space is null or private.community_in_space(c.id, p_space))
    and (v.own or (
      c.retired_at is null
      and not private.blocked_unchecked(v.me, p_user)
      and private.visible_to(v.me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
  order by coalesce(c.created_by = p_user or m.role = 'owner', false) desc, c.retired_at is not null, c.members_count desc, c.name, c.id
  limit 100
$$;
revoke all on function public.member_communities(uuid, text) from public, anon;
grant execute on function public.member_communities(uuid, text) to authenticated;

-- ───────── search_all ─────────
-- Its communities and activities keep to the space when one is given;
-- people, places, areas, cities and categories are the same in both.
drop function if exists public.search_all(text, text, integer);
drop function if exists public.search_all(text, text, integer, text);
create function public.search_all(p_q text, p_city text default null, p_limit integer default 30, p_space text default null)
returns table (kind text, id text, title text, subtitle text, city_id text, area_id text, starts_at timestamptz, rank integer)
language sql stable set search_path = public as $$
  with q as (select '%' || replace(replace(btrim(coalesce(p_q, '')), '%', ''), '_', '') || '%' as pat, lower(btrim(coalesce(p_q, ''))) as raw),
  sc as (select case when p_city is null then null else private.city_scope(p_city) end as cities)
  select r.kind, r.id, r.title, r.subtitle, r.city_id, r.area_id, r.starts_at, r.rank from (
    select 'activity'::text, a.id::text, a.title, a.category_id, a.city_id, a.area_id, a.starts_at,
      case when lower(a.title) like q.raw || '%' then 3 else 2 end, 0
    from public.activities a, q, sc
    where a.cancelled_at is null and coalesce(a.ends_at, a.starts_at + interval '2 hours') >= now() and (a.starts_at >= now() - interval '2 hours' or a.ends_at >= now())
      and (sc.cities is null or a.city_id = any (sc.cities))
      and (a.title ilike q.pat or a.category_id ilike q.pat or coalesce(a.description, '') ilike q.pat
        or coalesce(a.place_name, '') ilike q.pat or a.area_id ilike q.pat)
      and (p_space is null or private.activity_in_space(a.id, p_space))
    union all
    select 'community', c.id::text, c.name,
      case when p.id is not null then 'Group of ' || p.name else coalesce(c.tagline, c.category_id) end,
      c.city_id, null, null,
      case when lower(c.name) like q.raw || '%' then 3 else 2 end, c.members_count
    from public.communities c
    left join public.communities p on p.id = c.parent_id and p.deleted_at is null, q, sc
    where c.deleted_at is null and (sc.cities is null or c.city_id = any (sc.cities))
      and (c.name ilike q.pat or coalesce(c.tagline, '') ilike q.pat or coalesce(c.category_id, '') ilike q.pat)
      and (p_space is null or private.community_in_space(c.id, p_space))
    union all
    -- People are not limited to the city (as before); at most p_limit of
    -- them can make the list, in name order.
    select 'person', s.id::text, s.first_name, s.city_id, s.city_id, null, null, 1, 0
    from q, private.search_people(q.raw, p_limit) s
    where char_length(q.raw) >= 2
    union all
    select 'place', pl.slug, pl.name, pl.kind, pl.city_id, pl.area_id, null, case when pl.featured then 2 else 1 end, 0
    from public.places pl, q, sc
    where (sc.cities is null or pl.city_id = any (sc.cities))
      and (pl.name ilike q.pat or pl.kind ilike q.pat or array_to_string(pl.tags, ' ') ilike q.pat)
    union all
    select 'area', ar.city_id || ':' || ar.id, ar.name, coalesce(aci.name, ar.city_id), ar.city_id, ar.id, null,
      case when lower(ar.name) like q.raw || '%' then 2 else 1 end, 0
    from public.areas ar left join public.cities aci on aci.id = ar.city_id, q, sc
    where ar.name ilike q.pat and (sc.cities is null or ar.city_id = any (sc.cities))
    union all
    select 'city', ci.id, ci.name, ci.region_id, ci.id, null, null,
      case when lower(ci.name) like q.raw || '%' then 4 else 3 end, 0
    from public.cities ci, q where ci.name ilike q.pat
    union all
    select 'category', ca.id, ca.label, null, null, null, null, 2, 0
    from public.categories ca, q where ca.label ilike q.pat
  ) r (kind, id, title, subtitle, city_id, area_id, starts_at, rank, members)
  where char_length(btrim(coalesce(p_q, ''))) >= 1
  order by r.rank desc, r.starts_at nulls last, r.members desc, r.title
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.search_all(text, text, integer, text) from public, anon;
grant execute on function public.search_all(text, text, integer, text) to authenticated;

-- ───────── event_activities ─────────
-- The plans to go to an event together: in Mixte, never a women-only plan
-- (with its IRLY Girl community's name) of a woman's other space.
drop function if exists public.event_activities(text, integer);
drop function if exists public.event_activities(text, integer, text);
create function public.event_activities(p_event text, p_limit integer default 50, p_space text default null)
returns table (id uuid, title text, category_id text, sub_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, capacity integer, going integer, girl_only boolean,
  community_id uuid, community_name text, creator_id uuid, creator_name text, cover_url text, my_status text)
language plpgsql stable set search_path = public as $$
declare
  me uuid := auth.uid();
  girl boolean;
  blocked uuid[];
  scope text := private.space_scope(p_space);
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_event is null or char_length(p_event) > 64 or p_event !~ '^e-[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'unknown event' using errcode = '22023';
  end if;
  girl := private.is_girl_eligible();
  blocked := private.my_block_ids();
  return query
  select a.id, a.title, a.category_id, a.sub_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, g.name,
    a.creator_id, p.first_name,
    coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = me)
  from public.activities a
  left join public.communities g on g.id = a.community_id and g.deleted_at is null
  -- offset 0: the creator's row only, through the view's own filter.
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where a.event_key = p_event
    and a.cancelled_at is null
    and a.moderated_at is null
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and (not a.girl_only or girl)
    and not (a.creator_id = any (blocked))
    and (a.privacy = 'public'
      or (a.privacy = 'community' and a.community_id is not null
        and (a.creator_id = me or private.i_belong(a.community_id))))
    and (scope is null or private.activity_in_space(a.id, scope))
  order by a.starts_at, a.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
revoke all on function public.event_activities(text, integer, text) from public, anon;
grant execute on function public.event_activities(text, integer, text) to authenticated;

-- ───────── post_activities ─────────
-- Body of 20261110300000_irly_activity_from_post, with the space.
drop function if exists public.post_activities(uuid, integer);
drop function if exists public.post_activities(uuid, integer, text);
create function public.post_activities(p_post uuid, p_limit integer default 5, p_space text default null)
returns table (id uuid, title text, category_id text, sub_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, capacity integer, going integer, girl_only boolean,
  community_id uuid, community_name text, creator_id uuid, creator_name text, cover_url text, my_status text)
language plpgsql stable security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  girl boolean;
  blocked uuid[];
  scope text := private.space_scope(p_space);
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_post is null or not exists (select 1 from public.community_posts p where p.id = p_post and p.deleted_at is null) then
    return;
  end if;
  girl := private.is_girl_eligible();
  blocked := private.my_block_ids();
  return query
  select a.id, a.title, a.category_id, a.sub_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, g.name,
    a.creator_id, p.first_name,
    coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = me)
  from public.activities a
  left join public.communities g on g.id = a.community_id and g.deleted_at is null
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where a.source_post_id = p_post
    and a.cancelled_at is null
    and a.moderated_at is null
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and (not a.girl_only or girl)
    and not (a.creator_id = any (blocked))
    and (a.creator_id = me
      or a.privacy = 'public'
      or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id)))
    and (scope is null or private.activity_in_space(a.id, scope))
  order by a.starts_at, a.id
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
end $$;
revoke all on function public.post_activities(uuid, integer, text) from public, anon;
grant execute on function public.post_activities(uuid, integer, text) to authenticated;

-- ───────── A notification's universe: the reader's own rows only ─────────
-- notification_universe(n) and notification_women_only(n) (20261110100000)
-- run as their owner and read the community, activity or chat a payload
-- names. Called as computed columns they only ever see the reader's own
-- notifications, but called directly with a made-up row they would tell the
-- universe of any community or chat id (an IRLY Girl one included). They now
-- read the stored notification (by id) and answer only when it is the
-- caller's own: null (and false) otherwise, whatever the row passed says.
create or replace function public.notification_universe(n public.notifications) returns text
language sql stable security definer set search_path = public as $$
  select (private.notification_universe_of(x.kind, x.payload)).universe
  from public.notifications x where x.id = n.id and x.user_id = auth.uid()
$$;
revoke all on function public.notification_universe(public.notifications) from public, anon;
grant execute on function public.notification_universe(public.notifications) to authenticated;

create or replace function public.notification_women_only(n public.notifications) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (private.notification_universe_of(x.kind, x.payload)).women_only
    from public.notifications x where x.id = n.id and x.user_id = auth.uid()), false)
$$;
revoke all on function public.notification_women_only(public.notifications) from public, anon;
grant execute on function public.notification_women_only(public.notifications) to authenticated;
