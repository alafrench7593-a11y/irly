-- Communities ranked by their real members, discussion categories inside a
-- community, activities with a status, pinned activities, and a map that only
-- shows activities whose position is known (a listed place, or an address the
-- geocoder matched precisely). Additive only: nothing is removed, renamed or
-- moved; every existing community, post and activity stays as it is.

-- ───────── Member counts, kept by the database ─────────
-- One row per (community, member) already (primary key), so the count is the
-- number of distinct people. A sub-community's members are NOT added to its
-- parent: joining a group already makes you a member of its community.
alter table public.communities add column if not exists members_count integer not null default 0;
update public.communities c set members_count = (select count(*) from public.community_members m where m.community_id = c.id);

create or replace function private.community_members_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.communities set members_count = members_count + 1 where id = new.community_id;
  elsif tg_op = 'DELETE' then
    update public.communities set members_count = greatest(members_count - 1, 0) where id = old.community_id;
  end if;
  return null;
end $$;
revoke all on function private.community_members_count() from public, anon, authenticated;
drop trigger if exists community_members_count on public.community_members;
create trigger community_members_count after insert or delete on public.community_members
for each row execute function private.community_members_count();

-- A new community starts at zero (its owner's membership counts as the first).
create or replace function private.community_count_start() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.members_count := 0;
  return new;
end $$;
drop trigger if exists communities_count_start on public.communities;
create trigger communities_count_start before insert on public.communities
for each row execute function private.community_count_start();

-- Members cannot write the count themselves (the counter runs one level down).
drop trigger if exists communities_edit_guard on public.communities;
create trigger communities_edit_guard before update on public.communities
for each row execute function private.edit_guard('created_by', 'girl_only', 'created_at', 'official', 'topic', 'members_count');

create index if not exists communities_rank_idx on public.communities (city_id, members_count desc, created_at)
  where parent_id is null and deleted_at is null;

-- Main communities, most members first (then the oldest), as on Home and in "All".
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
  -- Your own emirate first (as before), then most members, then the oldest.
  order by (c.city_id = p_city) desc, c.members_count desc, c.created_at, c.id
  limit 200
$$;

-- A community's groups, most members first.
create or replace function public.community_subgroups(p_parent uuid)
returns table (id uuid, name text, tagline text, emoji text, members integer, is_member boolean, posts_week integer, last_post_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.tagline, c.emoji, c.members_count,
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    (select max(p.created_at) from public.community_posts p where p.community_id = c.id and p.deleted_at is null)
  from public.communities c
  where c.parent_id = p_parent and c.deleted_at is null
  order by c.members_count desc, c.created_at, c.id
$$;

-- A member's communities on a profile and in "Mine": main communities only
-- (joining a group already joins its community, which is listed).
create or replace function public.member_communities(p_user uuid)
returns table (id uuid, name text, city_id text, cover_path text, members integer, tagline text, role text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city_id, c.cover_path, c.members_count,
    c.tagline, case when c.created_by = p_user or m.role = 'owner' then 'created' else 'joined' end
  from public.community_members m
  join public.communities c on c.id = m.community_id and c.deleted_at is null and c.parent_id is null
  where m.user_id = p_user
    and (not c.girl_only or private.girl_eligible_unchecked(auth.uid()))
    and (p_user = auth.uid() or (not private.blocked_unchecked(auth.uid(), p_user)
      and private.visible_to(auth.uid(), p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
  order by (c.created_by = p_user or m.role = 'owner') desc, c.members_count desc, c.name
  limit 100
$$;

-- Search: a group says which community it belongs to; communities rank by members.
create or replace function public.search_all(p_q text, p_city text default null, p_limit integer default 30)
returns table (kind text, id text, title text, subtitle text, city_id text, area_id text, starts_at timestamptz, rank integer)
language sql stable set search_path = public as $$
  with q as (select '%' || replace(replace(btrim(coalesce(p_q, '')), '%', ''), '_', '') || '%' as pat, lower(btrim(coalesce(p_q, ''))) as raw),
  sc as (select case when p_city is null then null else private.city_scope(p_city) end as cities)
  select r.kind, r.id, r.title, r.subtitle, r.city_id, r.area_id, r.starts_at, r.rank from (
    select 'activity'::text, a.id::text, a.title, a.category_id, a.city_id, a.area_id, a.starts_at,
      case when lower(a.title) like q.raw || '%' then 3 else 2 end, 0
    from public.activities a, q, sc
    where a.cancelled_at is null and a.starts_at > now() - interval '3 hours'
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
    select 'person', p.id::text, p.first_name, p.city_id, p.city_id, null, null, 1, 0
    from public.profiles_public p, q
    where p.id <> auth.uid() and char_length(q.raw) >= 2 and p.first_name ilike q.raw || '%'
      and not private.is_blocked(auth.uid(), p.id) and private.discoverable(p.id)
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

-- ───────── Discussion categories inside a community ─────────
-- Not a sub-community: no members of their own, just a theme for posts
-- ("Questions & advice", "Good deals"…). "General" is a post without one.
create table if not exists public.community_channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z][a-z0-9_]{1,30}$' and slug <> 'general'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  sort integer not null default 100,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (community_id, slug)
);
alter table public.community_channels enable row level security;
drop policy if exists community_channels_read on public.community_channels;
create policy community_channels_read on public.community_channels for select to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.deleted_at is null));
drop policy if exists community_channels_write on public.community_channels;
create policy community_channels_write on public.community_channels for all to authenticated
  using (private.moderates(community_id)) with check (private.moderates(community_id));
grant select, insert, update, delete on public.community_channels to authenticated;

create or replace function private.channel_shape() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.community_channels where community_id = new.community_id) >= 12 then
      raise exception 'up to 12 categories per community' using errcode = 'P0001';
    end if;
    new.created_by := coalesce(auth.uid(), new.created_by);
  elsif new.community_id <> old.community_id then
    raise exception 'a category stays in its community' using errcode = '42501';
  end if;
  new.name := btrim(new.name);
  return new;
end $$;
drop trigger if exists community_channels_shape on public.community_channels;
create trigger community_channels_shape before insert or update on public.community_channels
for each row execute function private.channel_shape();

-- Renaming a category's slug moves its posts with it; deleting a category
-- moves its posts back to General (nothing is deleted).
create or replace function private.channel_follow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    update public.community_posts set category = null where community_id = old.community_id and category = old.slug;
    return old;
  end if;
  if new.slug <> old.slug then
    update public.community_posts set category = new.slug where community_id = old.community_id and category = old.slug;
  end if;
  return new;
end $$;
drop trigger if exists community_channels_follow on public.community_channels;
create trigger community_channels_follow after update or delete on public.community_channels
for each row execute function private.channel_follow();

-- A post's category must exist in its community (General = none).
create or replace function private.post_channel_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.category is not null and pg_trigger_depth() <= 1
     and (tg_op = 'INSERT' or new.category is distinct from old.category)
     and not exists (select 1 from public.community_channels ch where ch.community_id = new.community_id and ch.slug = new.category) then
    raise exception 'unknown category in this community' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_channel_guard on public.community_posts;
create trigger community_posts_channel_guard before insert or update of category on public.community_posts
for each row execute function private.post_channel_guard();

-- Posts of one space: General (p_category null) or one category, pinned first.
create or replace function public.community_space_feed(p_community uuid, p_category text default null, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text, activity_starts_at timestamptz,
  poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer, liked boolean, created_at timestamptz, mine boolean,
  media_paths text[], media_kind text, thumb_path text, media_seconds integer, edited_at timestamptz,
  kind text, category text, pinned_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select f.* from public.community_feed(p_community, 100, p_before) f
  where f.category is not distinct from p_category
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.community_space_feed(uuid, text, integer, timestamptz) from public, anon;
grant execute on function public.community_space_feed(uuid, text, integer, timestamptz) to authenticated;

-- ───────── Activities: status, community view, pins ─────────
-- Status is computed, never stored: it cannot drift. Without an end time an
-- activity counts as ongoing for 2 hours after it starts.
create or replace function public.activity_status(p_starts timestamptz, p_ends timestamptz, p_cancelled timestamptz)
returns text language sql stable set search_path = public as $$
  select case
    when p_cancelled is not null then 'cancelled'
    when now() < p_starts then 'upcoming'
    when now() < coalesce(p_ends, p_starts + interval '2 hours') then 'ongoing'
    else 'finished' end
$$;
grant execute on function public.activity_status(timestamptz, timestamptz, timestamptz) to authenticated;

-- Position columns (filled only from a reliable source, see below).
alter table public.activities add column if not exists lat numeric(9, 6);
alter table public.activities add column if not exists lng numeric(9, 6);
alter table public.activities add column if not exists address text check (address is null or char_length(address) <= 200);
alter table public.activities add column if not exists geo_source text check (geo_source in ('place', 'geocoded'));
alter table public.activities add column if not exists geo_status text check (geo_status in ('pending', 'ok', 'not_found', 'off'));
alter table public.activities add column if not exists formatted_address text;
do $$ begin
  alter table public.activities add constraint activities_latlng_pair check ((lat is null) = (lng is null)
    and (lat is null or (lat between -90 and 90 and lng between -180 and 180)));
exception when duplicate_object then null; end $$;

create index if not exists activities_community_time_idx on public.activities (community_id, starts_at) where community_id is not null;

create table if not exists public.community_activity_pins (
  community_id uuid not null references public.communities (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  pinned_by uuid,
  pinned_at timestamptz not null default now(),
  primary key (community_id, activity_id)
);
alter table public.community_activity_pins enable row level security;
drop policy if exists community_activity_pins_read on public.community_activity_pins;
create policy community_activity_pins_read on public.community_activity_pins for select to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.deleted_at is null));
grant select on public.community_activity_pins to authenticated;

-- Hosts pin (or unpin) an activity of their community or of one of its groups.
create or replace function public.pin_activity(p_community uuid, p_activity uuid, p_pin boolean default true)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not private.moderates(p_community) then raise exception 'only the hosts can pin' using errcode = '42501'; end if;
  if not p_pin then
    delete from public.community_activity_pins where community_id = p_community and activity_id = p_activity;
    return;
  end if;
  select * into a from public.activities where id = p_activity;
  if not found or a.community_id is null
     or not (a.community_id = p_community or exists (select 1 from public.communities g where g.id = a.community_id and g.parent_id = p_community)) then
    raise exception 'this activity is not in this community' using errcode = 'P0001';
  end if;
  if (select count(*) from public.community_activity_pins where community_id = p_community) >= 5 then
    raise exception 'up to 5 pinned activities' using errcode = 'P0001';
  end if;
  insert into public.community_activity_pins (community_id, activity_id, pinned_by) values (p_community, p_activity, auth.uid())
  on conflict do nothing;
end $$;
revoke all on function public.pin_activity(uuid, uuid, boolean) from public, anon;
grant execute on function public.pin_activity(uuid, uuid, boolean) to authenticated;

-- A community's Activities space: its own and its groups' activities (the
-- same rows, never copies), pinned first, then by start time. Finished ones
-- only when asked. Visibility is the activity's own read rule.
create or replace function public.community_activities(p_community uuid, p_past boolean default false, p_limit integer default 40)
returns table (id uuid, title text, starts_at timestamptz, ends_at timestamptz, place_name text, area_id text, city_id text,
  category_id text, community_id uuid, community_name text, status text, going integer, capacity integer,
  cover_path text, cover_url text, creator_id uuid, pinned_at timestamptz, has_location boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.starts_at, a.ends_at, a.place_name, a.area_id, a.city_id, a.category_id, a.community_id, g.name,
    public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
    (select count(*)::int from public.activity_participants ap where ap.activity_id = a.id),
    a.capacity, a.cover_path, a.cover_url, a.creator_id, pin.pinned_at, a.lat is not null
  from public.activities a
  join public.communities g on g.id = a.community_id and g.deleted_at is null
  left join public.community_activity_pins pin on pin.community_id = p_community and pin.activity_id = a.id
  where (a.community_id = p_community or g.parent_id = p_community)
    and (case when p_past
      then a.starts_at > now() - interval '60 days'
      else coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() end)
  order by (pin.activity_id is not null) desc, pin.pinned_at desc nulls last,
    case when p_past then null else a.starts_at end asc, a.starts_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.community_activities(uuid, boolean, integer) from public, anon;
grant execute on function public.community_activities(uuid, boolean, integer) to authenticated;

-- ───────── Where an activity is: only from a reliable source ─────────
-- lat/lng come from a listed place that has coordinates, or from the
-- creator's address matched precisely by the geocoder. Never from the
-- neighbourhood, never typed in by hand: an activity without a reliable
-- position simply is not on the map.
-- The geocoder (a paid service): off until an IRLY admin stores a key and
-- turns it on. The key stays in the database, never in the app.
create table if not exists private.geocoder (
  id boolean primary key default true check (id),
  provider text not null default 'google' check (provider in ('google')),
  api_key text,
  active boolean not null default false,
  monthly_cap integer not null default 1000 check (monthly_cap between 0 and 100000),
  month text not null default to_char(now(), 'YYYY-MM'),
  used integer not null default 0
);
insert into private.geocoder (id) values (true) on conflict do nothing;
revoke all on private.geocoder from public, anon, authenticated;

create or replace function private.geocoder_ready() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select active and api_key is not null and api_key <> '' from private.geocoder), false)
$$;

-- On create or edit: the place's coordinates, or the address queued for the geocoder.
create or replace function private.activity_position() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pl record;
begin
  -- The geocoder's collector writes its answer as is (it marks its own updates).
  if current_setting('irly.geo_collect', true) = 'on' then return new; end if;
  new.address := nullif(btrim(coalesce(new.address, '')), '');
  if tg_op = 'UPDATE' and new.place_id is not distinct from old.place_id and new.address is not distinct from old.address then
    new.lat := old.lat; new.lng := old.lng; new.geo_source := old.geo_source;
    new.geo_status := old.geo_status; new.formatted_address := old.formatted_address;
    return new;
  end if;
  new.lat := null; new.lng := null; new.geo_source := null; new.geo_status := null; new.formatted_address := null;
  if new.place_id is not null then
    select p.lat, p.lng into pl from public.places p where p.id = new.place_id;
    if pl.lat is not null and pl.lng is not null then
      new.lat := pl.lat; new.lng := pl.lng; new.geo_source := 'place'; new.geo_status := 'ok';
      return new;
    end if;
  end if;
  if new.address is not null then
    new.geo_status := case when private.geocoder_ready() then 'pending' else 'off' end;
  end if;
  return new;
end $$;
-- Existing activities held at a listed place with coordinates get them now
-- (straight from the place; the others stay off the map).
update public.activities a set lat = p.lat, lng = p.lng, geo_source = 'place', geo_status = 'ok'
from public.places p
where p.id = a.place_id and p.lat is not null and p.lng is not null and a.lat is null;

drop trigger if exists activities_position on public.activities;
create trigger activities_position before insert or update on public.activities
for each row execute function private.activity_position();

create table if not exists private.geo_requests (
  request_id bigint primary key,
  activity_id uuid not null references public.activities (id) on delete cascade,
  address text not null,
  created_at timestamptz not null default now()
);
revoke all on private.geo_requests from public, anon, authenticated;

-- Every minute: send pending addresses (within the monthly cap).
create or replace function private.geo_dispatch() returns integer
language plpgsql security definer set search_path = public as $$
declare
  g private.geocoder;
  a record;
  rid bigint;
  n integer := 0;
begin
  select * into g from private.geocoder;
  if not found or not g.active or coalesce(g.api_key, '') = '' then return 0; end if;
  if g.month <> to_char(now(), 'YYYY-MM') then
    update private.geocoder set month = to_char(now(), 'YYYY-MM'), used = 0;
    g.used := 0;
  end if;
  for a in
    select x.id, x.address, r.country_id
    from public.activities x
    join public.cities c on c.id = x.city_id
    join public.regions r on r.id = c.region_id
    where x.geo_status = 'pending' and x.address is not null
      and not exists (select 1 from private.geo_requests q where q.activity_id = x.id and q.address = x.address)
    order by x.created_at
    limit 20
  loop
    exit when g.used + n >= g.monthly_cap;
    execute 'select net.http_get(url := $1, timeout_milliseconds := 10000)' into rid
      using 'https://maps.googleapis.com/maps/api/geocode/json?address=' || replace(replace(replace(a.address, '%', '%25'), '&', '%26'), ' ', '%20')
        || '&components=country:' || a.country_id || '&key=' || g.api_key;
    insert into private.geo_requests (request_id, activity_id, address) values (rid, a.id, a.address) on conflict do nothing;
    n := n + 1;
  end loop;
  update private.geocoder set used = used + n;
  return n;
end $$;

-- Every minute: read the answers. Only a precise match is kept (an exact
-- address or a building or place, never a whole street, district or city).
create or replace function private.geo_collect() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  res jsonb;
  top jsonb;
  n integer := 0;
begin
  for r in execute $q$
    select q.request_id, q.activity_id, q.address, x.status_code, x.content
    from private.geo_requests q join net._http_response x on x.id = q.request_id $q$
  loop
    begin
      res := case when r.status_code = 200 then r.content::jsonb else null end;
    exception when others then res := null;
    end;
    top := res -> 'results' -> 0;
    perform set_config('irly.geo_collect', 'on', true);
    if res ->> 'status' = 'OK' and top is not null
       and top -> 'geometry' ->> 'location_type' in ('ROOFTOP', 'RANGE_INTERPOLATED')
       and coalesce((top ->> 'partial_match')::boolean, false) = false then
      update public.activities set lat = round((top -> 'geometry' -> 'location' ->> 'lat')::numeric, 6),
        lng = round((top -> 'geometry' -> 'location' ->> 'lng')::numeric, 6),
        geo_source = 'geocoded', geo_status = 'ok', formatted_address = left(top ->> 'formatted_address', 200)
      where id = r.activity_id and address = r.address;
    else
      update public.activities set geo_status = 'not_found' where id = r.activity_id and address = r.address and geo_status = 'pending';
    end if;
    perform set_config('irly.geo_collect', 'off', true);
    delete from private.geo_requests where request_id = r.request_id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.geo_dispatch(), private.geo_collect(), private.geocoder_ready() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname in ('irly-geo-dispatch', 'irly-geo-collect');
  perform cron.schedule('irly-geo-dispatch', '* * * * *', 'select private.geo_dispatch()');
  perform cron.schedule('irly-geo-collect', '* * * * *', 'select private.geo_collect()');
exception when others then
  raise notice 'pg_cron not available: addresses stay off the map';
end $$;

-- Is the address search on? (The app shows the address field only then.)
create or replace function public.geocoder_on() returns boolean
language sql stable security definer set search_path = public as $$ select private.geocoder_ready() $$;
revoke all on function public.geocoder_on() from public, anon;
grant execute on function public.geocoder_on() to authenticated;

-- ───────── The map ─────────
-- Activities the member may see (their read rule applies), with a reliable
-- position, not cancelled and not over, in the chosen window and filters.
create index if not exists activities_located_idx on public.activities (city_id, starts_at) where lat is not null and cancelled_at is null;

create or replace function public.map_activities(p_city text, p_from timestamptz default null, p_to timestamptz default null,
  p_category text default null, p_community uuid default null, p_lat double precision default null, p_lng double precision default null,
  p_km double precision default null, p_limit integer default 300)
returns table (id uuid, title text, description text, starts_at timestamptz, ends_at timestamptz, place_name text, address text,
  lat double precision, lng double precision, category_id text, community_id uuid, community_name text, status text,
  going integer, capacity integer, distance_km double precision)
language sql stable security invoker set search_path = public as $$
  select * from (
    select a.id, a.title, a.description, a.starts_at, a.ends_at, a.place_name, coalesce(a.formatted_address, a.address),
      a.lat::double precision, a.lng::double precision, a.category_id, a.community_id, g.name,
      public.activity_status(a.starts_at, a.ends_at, a.cancelled_at),
      (select count(*)::int from public.activity_participants ap where ap.activity_id = a.id),
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
  ) x (id, title, description, starts_at, ends_at, place_name, address, lat, lng, category_id, community_id, community_name, status, going, capacity, distance_km)
  where p_km is null or x.distance_km is null or x.distance_km <= p_km
  order by x.starts_at
  limit least(greatest(p_limit, 1), 500)
$$;
revoke all on function public.map_activities(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer) from public, anon;
grant execute on function public.map_activities(text, timestamptz, timestamptz, text, uuid, double precision, double precision, double precision, integer) to authenticated;
