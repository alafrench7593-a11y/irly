-- Pre-launch audit: security fixes and faster community/map reads.
-- Additive only: no data removed, no table dropped.

-- 1. Nobody verifies themselves, including when the profile is first created.
create or replace function private.verification_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and not private.is_admin(auth.uid()) then
      new.verified_at := null;
      new.verified_photos := null;
    end if;
    return new;
  end if;
  if (new.verified_at is distinct from old.verified_at or new.verified_photos is distinct from old.verified_photos)
     and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'verification is done by IRLY' using errcode = '42501';
  end if;
  if old.verified_at is not null and new.photo_paths is distinct from old.photo_paths and exists (
    select 1 from unnest(coalesce(new.photo_paths, '{}')) x
    where x not like 'irly-avatar:%' and not x = any (coalesce(old.verified_photos, '{}'))
  ) then
    new.verified_at := null;
    new.verified_photos := null;
  end if;
  return new;
end $$;
drop trigger if exists profiles_verification_guard on public.profiles;
create trigger profiles_verification_guard before insert or update on public.profiles
for each row execute function private.verification_guard();

-- 2. An activity of a girls-only community (or of one of its groups) is
--    girls-only too: it never shows to men on the map or in the feed.
create or replace function private.activity_girl_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.community_id is not null and not new.girl_only
     and exists (select 1 from public.communities c where c.id = new.community_id and c.girl_only) then
    new.girl_only := true;
  end if;
  return new;
end $$;
revoke all on function private.activity_girl_only() from public, anon, authenticated;
drop trigger if exists activities_girl_only on public.activities;
create trigger activities_girl_only before insert or update of community_id, girl_only on public.activities
for each row execute function private.activity_girl_only();
update public.activities a set girl_only = true
from public.communities c
where c.id = a.community_id and c.girl_only and not a.girl_only;

-- 3. The paid address lookup: at most 3 lookups per activity and 20 per
--    creator a day, so nobody can spend the monthly allowance by editing an
--    address again and again.
create table if not exists private.geo_spend (
  activity_id uuid not null,
  creator_id uuid,
  at timestamptz not null default now()
);
create index if not exists geo_spend_activity_idx on private.geo_spend (activity_id, at);
create index if not exists geo_spend_creator_idx on private.geo_spend (creator_id, at);
revoke all on private.geo_spend from public, anon, authenticated;

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
  delete from private.geo_spend where at < now() - interval '2 days';
  for a in
    select x.id, x.address, x.creator_id, r.country_id
    from public.activities x
    join public.cities c on c.id = x.city_id
    join public.regions r on r.id = c.region_id
    where x.geo_status = 'pending' and x.address is not null
      and not exists (select 1 from private.geo_requests q where q.activity_id = x.id and q.address = x.address)
    order by x.created_at
    limit 20
  loop
    exit when g.used + n >= g.monthly_cap;
    if (select count(*) from private.geo_spend s where s.activity_id = a.id and s.at > now() - interval '1 day') >= 3
       or (select count(*) from private.geo_spend s where s.creator_id = a.creator_id and s.at > now() - interval '1 day') >= 20 then
      update public.activities set geo_status = 'not_found' where id = a.id and geo_status = 'pending';
      continue;
    end if;
    execute 'select net.http_get(url := $1, timeout_milliseconds := 10000)' into rid
      using 'https://maps.googleapis.com/maps/api/geocode/json?address=' || replace(replace(replace(a.address, '%', '%25'), '&', '%26'), ' ', '%20')
        || '&components=country:' || a.country_id || '&key=' || g.api_key;
    insert into private.geo_requests (request_id, activity_id, address) values (rid, a.id, a.address) on conflict do nothing;
    insert into private.geo_spend (activity_id, creator_id) values (a.id, a.creator_id);
    n := n + 1;
  end loop;
  update private.geocoder set used = used + n;
  return n;
end $$;
revoke all on function private.geo_dispatch() from public, anon, authenticated;

-- 4. Live updates for pinned activities, community chats and pinned posts.
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['community_activity_pins', 'community_channels', 'community_pins'] loop
      if to_regclass('public.' || t) is not null
         and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- 5. Speed.
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
create index if not exists activities_community_starts_idx on public.activities (community_id, starts_at);

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
  where a.community_id in (select p_community union all select s.id from public.communities s where s.parent_id = p_community)
    and (case when p_past
      then a.starts_at > now() - interval '60 days'
      else coalesce(a.ends_at, a.starts_at + interval '2 hours') > now() end)
  order by (pin.activity_id is not null) desc, pin.pinned_at desc nulls last,
    case when p_past then null else a.starts_at end asc, a.starts_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

create or replace function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean,
  members integer, is_member boolean, score integer, city_id text)
language sql stable security invoker set search_path = public as $$
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
          else 0 end), 0)::int
        from mine m where m.tag = any (t.match_tags)) as base
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.deleted_at is null
      and c.city_id = any (private.city_scope(p_city))
  ),
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id
  from best
  order by score desc, sort, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;
