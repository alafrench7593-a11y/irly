-- Activities on the Map tab: every upcoming plan the member may see, at its
-- meeting point. Additive only: map_activities (exact positions only) stays
-- as it is for whoever still calls it.
--
--  1. map_activity_pins: the same rows as the activities list (the activity's
--     own read rule, security invoker: IRLY Girl women-only plans, members-only
--     community plans, blocks, friends / invite privacy, moderation), upcoming
--     or happening now, never cancelled or over. Each comes with a position:
--       - 'exact': its listed place, or its address matched precisely by the
--         geocoder (as before);
--       - 'area': otherwise, the centre of its neighbourhood (public.areas;
--         the middle of its city when the neighbourhood has none) plus a small fixed offset drawn from the activity's id, so plans of
--         one neighbourhood do not stack on one point. Never stored on the
--         activity, never presented as its meeting point (the app says
--         « around <neighbourhood> »).
--     Only activity meeting points: no member's address or live position.
--  2. A plan created (or renamed) with the name of a listed place of its city,
--     and no place chosen, is tied to that place (one match only), so it gets
--     the place's coordinates (activity_position). No external service.

-- ───────── 1. The pins ─────────
create or replace function public.map_activity_pins(p_city text, p_from timestamptz default null, p_to timestamptz default null,
  p_category text default null, p_community uuid default null, p_lat double precision default null,
  p_lng double precision default null, p_km double precision default null, p_limit integer default 300,
  p_girl_only boolean default null)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz, place_name text,
  address text, lat double precision, lng double precision, category_id text, community_id uuid, community_name text,
  status text, going integer, capacity integer, distance_km double precision, area_id text, city_id text, precise boolean)
language plpgsql stable set search_path = public as $$
declare
  t constant timestamptz := greatest(now(), coalesce(p_from, now()));
  want integer := least(greatest(coalesce(p_limit, 300), 1), 500);
  lo timestamptz := '-infinity';
  hi timestamptz := t - interval '2 hours';
  step interval := interval '2 days';
  got integer;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- The IRLY Girl map: women with IRLY Girl access only (the read rule of
  -- activities already hides every women-only plan from anyone else).
  if p_girl_only and not private.is_girl_eligible() then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  -- Read a time window at a time (as map_activities), so the first page of a
  -- busy city never reads every future plan.
  loop
    return query
    select * from (
      select a.id, a.title, a.description, a.starts_at, a.ends_at, a.place_name,
        case when a.lat is not null then coalesce(a.formatted_address, a.address) end,
        pos.lat, pos.lng, a.category_id, a.community_id, g.name,
        public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
        private.going_count(a.id),
        a.capacity,
        case when p_lat is null or p_lng is null then null else
          6371 * 2 * asin(sqrt(power(sin(radians(pos.lat - p_lat) / 2), 2)
            + cos(radians(p_lat)) * cos(radians(pos.lat)) * power(sin(radians(pos.lng - p_lng) / 2), 2))) end,
        a.area_id, a.city_id, a.lat is not null
      from public.activities a
      left join public.communities g on g.id = a.community_id and g.deleted_at is null
      -- Its neighbourhood's centre; a neighbourhood IRLY has no centre for: the middle of its city.
      cross join lateral (
        select coalesce(
          (select x.lat from public.areas x where x.city_id = a.city_id and x.id = a.area_id and x.lng is not null),
          (select avg(x.lat) from public.areas x where x.city_id = a.city_id and x.lng is not null)) as lat,
        coalesce(
          (select x.lng from public.areas x where x.city_id = a.city_id and x.id = a.area_id and x.lat is not null),
          (select avg(x.lng) from public.areas x where x.city_id = a.city_id and x.lat is not null)) as lng
      ) ar
      cross join lateral (
        select ('x' || substr(md5(a.id::text), 1, 7))::bit(28)::int as h
      ) k
      cross join lateral (
        select
          coalesce(a.lat::double precision,
            ar.lat::double precision + (0.0012 + ((k.h >> 9) % 100) * 0.000023) * sin(radians(k.h % 360))) as lat,
          coalesce(a.lng::double precision,
            ar.lng::double precision + (0.0012 + ((k.h >> 9) % 100) * 0.000023) * cos(radians(k.h % 360))
              / greatest(cos(radians(ar.lat::double precision)), 0.2)) as lng
      ) pos
      where (a.lat is not null or (ar.lat is not null and ar.lng is not null))
        and a.cancelled_at is null
        and a.city_id = any (private.city_scope(p_city))
        and a.starts_at > lo and a.starts_at <= hi
        and coalesce(a.ends_at, a.starts_at + interval '2 hours') > t
        and (a.starts_at > t - interval '2 hours' or a.ends_at > t)
        and (p_to is null or a.starts_at <= p_to)
        and (p_category is null or a.category_id = p_category)
        and (p_community is null or a.community_id = p_community or g.parent_id = p_community)
        and (p_girl_only is null or a.girl_only = p_girl_only)
    ) x (id, title, description, starts_at, ends_at, place_name, address, lat, lng, category_id, community_id, community_name,
      status, going, capacity, distance_km, area_id, city_id, precise)
    where p_km is null or x.distance_km is null or x.distance_km <= p_km
    order by x.starts_at, x.id
    limit want;
    get diagnostics got = row_count;
    want := want - got;
    exit when want <= 0 or hi = 'infinity' or (p_to is not null and hi >= p_to);
    lo := hi;
    if hi < t then
      hi := t + step;
    elsif step >= interval '120 days' then
      hi := 'infinity';
    else
      step := step * 4;
      hi := hi + step;
    end if;
  end loop;
end $$;
revoke all on function public.map_activity_pins(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer, boolean) from public, anon;
grant execute on function public.map_activity_pins(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer, boolean) to authenticated;

-- ───────── 2. A listed place named, not picked ─────────
-- « Kite Beach » typed in the place field is the listed Kite Beach of that
-- city when exactly one listed place with coordinates has that name (or the
-- name followed by a detail: « Kite Beach, court 3 »). Two candidates, or
-- none: nothing is guessed (the plan is shown around its neighbourhood).
-- Named to run after activities_place_renamed and before activities_position
-- (same event, alphabetical order).
create or replace function private.activity_place_resolve() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  typed text := lower(btrim(coalesce(new.place_name, '')));
  found_id uuid;
  n integer;
begin
  if current_setting('irly.geo_collect', true) = 'on' then return new; end if;
  if new.place_id is not null or typed = '' then return new; end if;
  if tg_op = 'UPDATE' and new.place_name is not distinct from old.place_name then return new; end if;
  select count(*), min(p.id::text)::uuid into n, found_id
  from public.places p
  where p.city_id = new.city_id and p.lat is not null and p.lng is not null
    and (typed = lower(p.name) or starts_with(typed, lower(p.name) || ',') or starts_with(typed, lower(p.name) || ' ·')
      or starts_with(typed, lower(p.name) || ' - '));
  if n = 1 then
    new.place_id := found_id;
  end if;
  return new;
end $$;
revoke all on function private.activity_place_resolve() from public, anon, authenticated;
drop trigger if exists activities_place_resolve on public.activities;
create trigger activities_place_resolve before insert or update of place_name on public.activities
for each row execute function private.activity_place_resolve();
