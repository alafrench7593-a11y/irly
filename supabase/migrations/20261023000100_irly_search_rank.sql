-- Search: a city ranks above its neighbourhoods ("Dubai" before "Dubai
-- Creek Harbour"), a neighbourhood whose name starts with the query ranks
-- above one that only contains it, and a neighbourhood says which city it
-- is in ("Dubai", not the raw id "dubai"). Same function otherwise
-- (20261020000600_irly_search_speed.sql).
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
