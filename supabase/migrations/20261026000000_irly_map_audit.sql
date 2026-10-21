-- IRLY Map audit (2026-10-26). Additive: two new settings columns (off by
-- default), one new function, one function replaced with a wider signature
-- (old calls keep working). No data is changed or deleted; RLS stays on.
--
-- What was found:
--  1. People on the map. The People layer existed in the app but had no
--     server side: production showed nobody (example members only in the
--     demo build) and there was no way to choose to appear. Members now opt
--     in (map_visible for IRLY, map_visible_girl for IRLY Girl, both off by
--     default) and public.map_people() returns, to a signed-in member, only
--     those she may see: opted in, location set to « Neighbourhood », profile
--     visible to her (profile_visibility), no block either way, no active
--     suspension or ban, adults only, open account; and in IRLY Girl only
--     women for whom the one predicate private.girl_eligible_unchecked holds,
--     asked for by a woman for whom it holds. It never returns coordinates:
--     the neighbourhood (area_id) is the finest position that leaves the
--     server, as the privacy settings promise.
--  2. Spaces mixed on the map: map_activities returned IRLY Girl plans on
--     the IRLY map (to eligible women) and IRLY plans on the IRLY Girl map,
--     where every other list keeps each space to its own plans. It takes the
--     space now (p_girl_only; null keeps the old behaviour for older apps)
--     and refuses the IRLY Girl map to anyone without IRLY Girl access.
--  3. The « going » count of a marker counted every participant row
--     (maybe and not going too). Only « going » counts now.

-- ───────── 1. People on the map ─────────
alter table public.safety_settings
  add column if not exists map_visible boolean not null default false,
  add column if not exists map_visible_girl boolean not null default false;

create or replace function public.map_people(p_city text, p_girl boolean default false, p_limit integer default 200)
returns table (user_id uuid, first_name text, username text, city_id text, area_id text, verified boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- A closed, suspended or banned account sees nobody.
  if not exists (select 1 from public.profiles v where v.id = me and v.deleted_at is null) or private.is_sanctioned(me) then
    return;
  end if;
  if coalesce(p_girl, false) and not private.girl_eligible_unchecked(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
    select p.id, p.first_name, p.username, p.city_id, p.area_id, p.verified_at is not null
    from public.profiles p
    join public.safety_settings s on s.user_id = p.id
    where p.id <> me
      and p.deleted_at is null
      and p.area_id is not null
      and p.birthdate <= current_date - interval '18 years'
      and p.city_id = any (private.city_scope(p_city))
      and s.location_precision = 'area'
      and (case when coalesce(p_girl, false) then s.map_visible_girl and private.girl_eligible_unchecked(p.id) else s.map_visible end)
      and private.visible_to(me, p.id, s.profile_visibility)
      and not private.blocked_unchecked(me, p.id)
      and not private.is_sanctioned(p.id)
    order by p.id
    limit least(greatest(coalesce(p_limit, 200), 1), 300);
end $$;
revoke all on function public.map_people(text, boolean, integer) from public, anon;
grant execute on function public.map_people(text, boolean, integer) to authenticated;

-- ───────── 2 and 3. Activities on the map: one space at a time, real « going » ─────────
drop function if exists public.map_activities(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer);
create function public.map_activities(p_city text, p_from timestamptz default null, p_to timestamptz default null,
  p_category text default null, p_community uuid default null, p_lat double precision default null, p_lng double precision default null,
  p_km double precision default null, p_limit integer default 300, p_girl_only boolean default null)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz, place_name text, address text,
  lat double precision, lng double precision, category_id text, community_id uuid, community_name text, status text,
  going integer, capacity integer, distance_km double precision)
language plpgsql stable security invoker set search_path = public as $$
begin
  -- The IRLY Girl map: women with IRLY Girl access only (the read rule of
  -- activities already hides every women-only plan from anyone else).
  if p_girl_only and not private.is_girl_eligible() then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select * from (
    select a.id, a.title, a.description, a.starts_at, a.ends_at, a.place_name, coalesce(a.formatted_address, a.address),
      a.lat::double precision, a.lng::double precision, a.category_id, a.community_id, g.name,
      public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
      (select count(*)::int from public.activity_participants ap where ap.activity_id = a.id and ap.status = 'going'),
      a.capacity,
      case when p_lat is null or p_lng is null then null else
        6371 * 2 * asin(sqrt(power(sin(radians(a.lat::double precision - p_lat) / 2), 2)
          + cos(radians(p_lat)) * cos(radians(a.lat::double precision)) * power(sin(radians(a.lng::double precision - p_lng) / 2), 2))) end as d
    from public.activities a
    left join public.communities g on g.id = a.community_id and g.deleted_at is null
    where a.lat is not null and a.cancelled_at is null
      and a.city_id = any (private.city_scope(p_city))
      and coalesce(a.ends_at, a.starts_at + interval '2 hours') > greatest(now(), coalesce(p_from, now()))
      and (p_to is null or a.starts_at <= p_to)
      and (p_category is null or a.category_id = p_category)
      and (p_community is null or a.community_id = p_community or g.parent_id = p_community)
      and (p_girl_only is null or a.girl_only = p_girl_only)
  ) x (id, title, description, starts_at, ends_at, place_name, address, lat, lng, category_id, community_id, community_name, status, going, capacity, distance_km)
  where p_km is null or x.distance_km is null or x.distance_km <= p_km
  order by x.starts_at
  limit least(greatest(p_limit, 1), 500);
end $$;
revoke all on function public.map_activities(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer, boolean) from public, anon;
grant execute on function public.map_activities(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer, boolean) to authenticated;
