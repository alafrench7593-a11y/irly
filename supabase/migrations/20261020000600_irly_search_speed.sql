-- Search speed and one "is it over" rule.
--
-- 1. People search read every profile. The people branch of search_all went
--    through profiles_public, a security_barrier view, so the name filter
--    could not be pushed into it: every live profile ran blocked_unchecked
--    (and precision_of for its city) before "first_name ilike 'un%'" was
--    tried — about 1 s with 5,000 members, growing with every sign-up.
--    Now a name index finds the few matching names first; blocks and
--    profile visibility are then checked on those only, with the same rules
--    as before (not deleted, not yourself, no block either way, discoverable
--    to you, city hidden when the member hides their location).
-- 2. An activity without an end time is over two hours after it starts:
--    join_activity and the app already said so, but search kept it for three
--    hours and profiles showed it "live" for three. Both now use the same rule
--    as join_activity: coalesce(ends_at, starts_at + 2 hours).
-- Same signatures; nothing is dropped.

-- ───────── 1. People by name ─────────

-- Prefix search on the lower-cased name (search lower-cases the query), live
-- profiles only. text_pattern_ops: byte order, so a prefix is one range.
create index if not exists profiles_first_name_prefix_idx
  on public.profiles (lower(first_name) text_pattern_ops) where deleted_at is null;

-- The people search_all may show for this query: matching names first (the
-- index), then the same checks profiles_public and search_all applied.
-- p_raw is the query as search_all prepares it (trimmed, lower-cased); as
-- before, it is used as a LIKE prefix as is.
create or replace function private.search_people(p_raw text, p_limit integer)
returns table (id uuid, first_name text, city_id text)
language sql stable security definer set search_path = public as $$
  with cand as materialized (
    -- Plain text: one index range (every name starting with the query, and
    -- nothing else, sorts between the query and the query + the last
    -- character), then the exact test search_all always used.
    select p.id, p.first_name, p.city_id
    from public.profiles p
    where p.deleted_at is null and char_length(p_raw) >= 2
      and p_raw !~ '[%_\\]'
      and lower(p.first_name) ~>=~ p_raw
      and lower(p.first_name) ~<~ (p_raw || chr(1114111))
      and p.first_name ilike p_raw || '%'
    union all
    -- A query with LIKE wildcards in it keeps its old meaning (rare, slower).
    select p.id, p.first_name, p.city_id
    from public.profiles p
    where p.deleted_at is null and char_length(p_raw) >= 2
      and p_raw ~ '[%_\\]'
      and p.first_name ilike p_raw || '%'
  )
  select c.id, c.first_name,
    -- Never you, so the city follows the member's location setting.
    case when private.precision_of(c.id) <> 'hidden' then c.city_id end
  -- In name order first (offset 0 keeps the checks out of the sort), so the
  -- checks stop once p_limit members passed them.
  from (select * from cand order by cand.first_name offset 0) c
  where auth.uid() is not null
    and c.id <> auth.uid()
    and not private.blocked_unchecked(auth.uid(), c.id)
    and private.discoverable(c.id)
  order by c.first_name
  limit least(greatest(coalesce(p_limit, 30), 1), 100)
$$;
revoke all on function private.search_people(text, integer) from public, anon;
grant execute on function private.search_people(text, integer) to authenticated;

-- Search (last defined in 20261019000000_irly_hierarchy_activities.sql):
-- the same, with people from search_people and activities kept until they
-- are over (as join_activity decides).
create or replace function public.search_all(p_q text, p_city text default null, p_limit integer default 30)
returns table (kind text, id text, title text, subtitle text, city_id text, area_id text, starts_at timestamptz, rank integer)
language sql stable set search_path = public as $$
  with q as (select '%' || replace(replace(btrim(coalesce(p_q, '')), '%', ''), '_', '') || '%' as pat, lower(btrim(coalesce(p_q, ''))) as raw),
  sc as (select case when p_city is null then null else private.city_scope(p_city) end as cities)
  select r.kind, r.id, r.title, r.subtitle, r.city_id, r.area_id, r.starts_at, r.rank from (
    select 'activity'::text, a.id::text, a.title, a.category_id, a.city_id, a.area_id, a.starts_at,
      case when lower(a.title) like q.raw || '%' then 3 else 2 end, 0
    from public.activities a, q, sc
    where a.cancelled_at is null and coalesce(a.ends_at, a.starts_at + interval '2 hours') >= now()
      and (sc.cities is null or a.city_id = any (sc.cities))
      and (a.title ilike q.pat or a.category_id ilike q.pat or coalesce(a.description, '') ilike q.pat
        or coalesce(a.place_name, '') ilike q.pat or a.area_id ilike q.pat)
    union all
    select 'community', c.id::text, c.name,
      case when p.id is not null then 'Group of ' || p.name else coalesce(c.tagline, c.category_id) end,
      c.city_id, null, null,
      case when lower(c.name) like q.raw || '%' then 3 else 2 end, c.members_count
    from public.communities c
    left join public.communities p on p.id = c.parent_id and p.deleted_at is null, q, sc
    where c.deleted_at is null and (sc.cities is null or c.city_id = any (sc.cities))
      and (c.name ilike q.pat or coalesce(c.tagline, '') ilike q.pat or coalesce(c.category_id, '') ilike q.pat)
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
    select 'area', ar.city_id || ':' || ar.id, ar.name, ar.city_id, ar.city_id, ar.id, null, 1, 0
    from public.areas ar, q, sc where ar.name ilike q.pat and (sc.cities is null or ar.city_id = any (sc.cities))
    union all
    select 'city', ci.id, ci.name, ci.region_id, ci.id, null, null, 1, 0
    from public.cities ci, q where ci.name ilike q.pat
    union all
    select 'category', ca.id, ca.label, null, null, null, null, 2, 0
    from public.categories ca, q where ca.label ilike q.pat
  ) r (kind, id, title, subtitle, city_id, area_id, starts_at, rank, members)
  where char_length(btrim(coalesce(p_q, ''))) >= 1
  order by r.rank desc, r.starts_at nulls last, r.members desc, r.title
  limit least(greatest(p_limit, 1), 100)
$$;

-- ───────── 2. Activities on a profile: live for two hours, not three ─────────
-- (last defined in 20261011000000_irly_profile_v2.sql; only the cutoff changes)
create or replace function public.member_activities(p_user uuid)
returns table (id uuid, title text, category_id text, city_id text, area_id text, place_name text, starts_at timestamptz,
  ends_at timestamptz, cover_path text, going integer, role text, state text)
language sql stable security invoker set search_path = public as $$
  with mine as (
    select a.id, 'created'::text as role from public.activities a where a.creator_id = p_user
    union
    select x.activity_id, 'joined' from public.activity_participants x
    join public.activities a on a.id = x.activity_id
    where x.user_id = p_user and x.status = 'going' and a.creator_id <> p_user
  )
  select a.id, a.title, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.cover_path,
    private.going_count(a.id), m.role,
    case
      when a.cancelled_at is not null then 'cancelled'
      when now() < a.starts_at then 'upcoming'
      when now() < coalesce(a.ends_at, a.starts_at + interval '2 hours') then 'live'
      else 'past' end
  from mine m
  join public.activities a on a.id = m.id
  where auth.uid() is not null
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by (a.cancelled_at is null and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()) desc,
    case when coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() then a.starts_at end asc,
    a.starts_at desc
  limit 200
$$;
revoke all on function public.member_activities(uuid) from public, anon;
grant execute on function public.member_activities(uuid) to authenticated;
