-- Regions: where a member lives decides what she sees.
--
-- IRLY already had countries, regions (emirates, Bali) and cities, and its
-- lists were asked for one city by the app. The city was the app's choice:
-- nothing on the server stopped an account of one country from reading
-- another. From here the member's region (a country: 'ae', 'id') is hers on
-- the server, and every regional list, read and write follows it.
--
--  1. profiles.region_id         the country she lives in (from her city);
--                                residency_declared_at, region_declarations.
--  2. Helpers                    my_region, my_region_cities, city_scope
--                                (now held to the member's own region).
--  3. Reads                      restrictive policies on activities,
--                                communities, irl_posts, news_articles.
--  4. Writes                     nothing is created or joined outside one's
--                                region (activities, communities, lives,
--                                memberships, participations, public games).
--  5. Games                      game_rooms.region_id; public tables are
--                                listed and joined inside one region.
--  6. RPCs                       my_region, declare_residency, change_region.
--
-- IRLY's staff (moderators, admins) read every region. Private chats are
-- not regional: nothing here touches conversations or messages.
-- No row is deleted or rewritten: region_id is filled from the city each
-- profile already has (every existing account lives in the Emirates).

-- ───────── 1. The member's region ─────────
alter table public.profiles add column if not exists region_id text references public.countries (id);
alter table public.profiles add column if not exists residency_declared_at timestamptz;

/** The country of a city (null: unknown city). */
create or replace function private.country_of(p_city text) returns text
language sql stable security definer set search_path = public as $$
  select r.country_id from public.cities c join public.regions r on r.id = c.region_id where c.id = p_city
$$;
revoke all on function private.country_of(text) from public;
grant execute on function private.country_of(text) to anon, authenticated;

update public.profiles p set region_id = private.country_of(p.city_id)
where p.region_id is null and private.country_of(p.city_id) is not null;
create index if not exists profiles_region_idx on public.profiles (region_id);

-- What she declared, each time: append-only, read by herself.
create table if not exists public.region_declarations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  region_id text not null references public.countries (id),
  previous_region text references public.countries (id),
  -- 'signup': the first declaration; 'change': she moved.
  source text not null check (source in ('signup', 'change')),
  declared_at timestamptz not null default now()
);
create index if not exists region_declarations_user_idx on public.region_declarations (user_id, declared_at desc);
alter table public.region_declarations enable row level security;
revoke all on table public.region_declarations from anon, authenticated;
grant select on table public.region_declarations to authenticated;
drop policy if exists region_declarations_read on public.region_declarations;
create policy region_declarations_read on public.region_declarations for select to authenticated
  using (user_id = (select auth.uid()));

/**
 * The region follows the city, and moving to another region goes through
 * change_region (a declaration, a waiting time, what is left behind). A
 * direct write by an API role may change the city inside the region only.
 * Not security definer, so that current_user is the role that writes.
 */
create or replace function private.profile_region_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  api boolean := current_user in ('anon', 'authenticated');
  country text := private.country_of(new.city_id);
begin
  if tg_op = 'INSERT' then
    new.region_id := country;
    if api then new.residency_declared_at := null; end if;
    return new;
  end if;
  if api then
    if new.residency_declared_at is distinct from old.residency_declared_at then
      raise exception 'the residency declaration cannot be changed' using errcode = '42501';
    end if;
    if new.city_id is distinct from old.city_id and old.region_id is not null and country is distinct from old.region_id then
      raise exception 'moving to another region is asked from your settings' using errcode = '42501';
    end if;
    -- Filled for an account that had none yet (an unknown city until now).
    new.region_id := coalesce(old.region_id, country);
    return new;
  end if;
  if new.city_id is distinct from old.city_id then
    new.region_id := coalesce(country, new.region_id);
  end if;
  return new;
end $$;
revoke all on function private.profile_region_guard() from public;
grant execute on function private.profile_region_guard() to anon, authenticated;
drop trigger if exists profiles_region_guard on public.profiles;
create trigger profiles_region_guard before insert or update of city_id, region_id, residency_declared_at on public.profiles
  for each row execute function private.profile_region_guard();

-- ───────── 2. Helpers ─────────
/** A member's region (null: no profile yet). */
create or replace function private.region_of(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select p.region_id from public.profiles p where p.id = uid and p.deleted_at is null
$$;
revoke all on function private.region_of(uuid) from public, anon, authenticated;

create or replace function private.my_region() returns text
language sql stable security definer set search_path = public as $$
  select private.region_of(auth.uid())
$$;
revoke all on function private.my_region() from public;
grant execute on function private.my_region() to anon, authenticated;

/**
 * The cities whose content I may read: those of my region. Every city for
 * IRLY's staff, and for a session without a profile yet (it reads nothing
 * personal; its lists are held to the city it asks for).
 */
create or replace function private.my_region_cities() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(c.id), '{}')
  from public.cities c join public.regions r on r.id = c.region_id
  where private.my_region() is null
    or private.is_moderator(auth.uid())
    or r.country_id = private.my_region()
$$;
revoke all on function private.my_region_cities() from public;
grant execute on function private.my_region_cities() to anon, authenticated;

/** Is this city in the region of this member (true for staff, and while she has no region). */
create or replace function private.region_allows(uid uuid, p_city text) returns boolean
language sql stable security definer set search_path = public as $$
  select uid is null or private.region_of(uid) is null or private.is_moderator(uid)
    or private.country_of(p_city) is not distinct from private.region_of(uid)
$$;
revoke all on function private.region_allows(uuid, text) from public, anon, authenticated;

/**
 * The cities a list covers. As before: the country of the city asked for.
 * Now held to the member's own region: asking for a city of another region
 * gives her own (staff, and sessions without a profile, keep what they ask).
 */
create or replace function private.city_scope(p_city text) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array_agg(c.id order by c.id)
     from public.cities c join public.regions r on r.id = c.region_id
     where r.country_id = case
       when private.my_region() is null or private.is_moderator(auth.uid()) then private.country_of(p_city)
       else private.my_region() end),
    array[p_city])
$$;

/** The city a list is for: the one asked for when it is in my region, else my own. */
create or replace function private.region_city(p_city text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when private.my_region() is null or private.is_moderator(auth.uid())
      or private.country_of(p_city) is not distinct from private.my_region() then p_city
    else (select p.city_id from public.profiles p where p.id = auth.uid()) end
$$;
revoke all on function private.region_city(text) from public;
grant execute on function private.region_city(text) to anon, authenticated;

-- ───────── 3. Reads ─────────
-- Restrictive: added to what each table already requires. The cities are
-- read once per statement (a sub-select), not once per row.
drop policy if exists activities_region on public.activities;
create policy activities_region on public.activities as restrictive for select
  using (city_id = any ((select private.my_region_cities())::text[])
    -- What she organised or joined before moving stays hers to read.
    or creator_id = (select auth.uid())
    or id in (select private.my_participations()));

-- No sub-select here: community_members' read rule reads communities again, and a
-- sub-select in this policy makes PostgreSQL report an infinite recursion when an
-- owner updates her community. The function is stable and communities are few.
drop policy if exists communities_region on public.communities;
create policy communities_region on public.communities as restrictive for select
  using (city_id = any (private.my_region_cities()));

drop policy if exists irl_posts_region on public.irl_posts;
create policy irl_posts_region on public.irl_posts as restrictive for select
  using (city_id is null or city_id = any ((select private.my_region_cities())::text[]) or author_id = (select auth.uid()));

drop policy if exists news_articles_region on public.news_articles;
create policy news_articles_region on public.news_articles as restrictive for select
  using (city_id is null or city_id = any ((select private.my_region_cities())::text[]));

-- The month's challenges count one city: the one asked for, inside my region.
do $$
declare
  def text;
begin
  select pg_get_functiondef(p.oid) into strict def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'city_challenges';
  if position('private.region_city(p_city)' in def) > 0 then return; end if;
  if position('a.city_id = p_city' in def) = 0 then
    raise exception using message = 'regions: city_challenges no longer filters on a.city_id = p_city';
  end if;
  execute replace(def, 'a.city_id = p_city', 'a.city_id = private.region_city(p_city)');
end $$;

-- ───────── 4. Writes ─────────
/**
 * Nothing is created outside one's region: an activity, a community, a
 * Live. Staff and server jobs (no signed-in member) are not held.
 */
create or replace function private.region_create_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.city_id is not null and not private.region_allows(auth.uid(), new.city_id) then
    raise exception 'this city is outside your region' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.region_create_guard() from public, anon, authenticated;
drop trigger if exists activities_region_guard on public.activities;
create trigger activities_region_guard before insert on public.activities
  for each row execute function private.region_create_guard();
drop trigger if exists communities_region_guard on public.communities;
create trigger communities_region_guard before insert on public.communities
  for each row execute function private.region_create_guard();
drop trigger if exists irl_posts_region_guard on public.irl_posts;
create trigger irl_posts_region_guard before insert on public.irl_posts
  for each row execute function private.region_create_guard();

/** Nobody becomes a member of a community of another region, whatever adds her. */
create or replace function private.region_member_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not private.region_allows(new.user_id, (select c.city_id from public.communities c where c.id = new.community_id)) then
    raise exception 'this community is in another region' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.region_member_guard() from public, anon, authenticated;
drop trigger if exists community_members_region_guard on public.community_members;
create trigger community_members_region_guard before insert on public.community_members
  for each row execute function private.region_member_guard();

/** Nor joins an activity of another region (its organiser always may). */
create or replace function private.region_participant_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a record;
begin
  select x.city_id, x.creator_id into a from public.activities x where x.id = new.activity_id;
  if a.creator_id is distinct from new.user_id and not private.region_allows(new.user_id, a.city_id) then
    raise exception 'this activity is in another region' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.region_participant_guard() from public, anon, authenticated;
drop trigger if exists activity_participants_region_guard on public.activity_participants;
create trigger activity_participants_region_guard before insert on public.activity_participants
  for each row execute function private.region_participant_guard();

-- ───────── 5. Games ─────────
alter table public.game_rooms add column if not exists region_id text references public.countries (id);

/** A table belongs to its host's region (training tables and tables without a host: to none). */
create or replace function private.game_room_region() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.region_id is null and new.host_id is not null then
    new.region_id := private.region_of(new.host_id);
  end if;
  return new;
end $$;
revoke all on function private.game_room_region() from public, anon, authenticated;
drop trigger if exists game_rooms_region on public.game_rooms;
create trigger game_rooms_region before insert on public.game_rooms
  for each row execute function private.game_room_region();

/**
 * A public table is joined inside its region. A private table is joined
 * with its code, given by someone she knows: like a private chat, it is
 * not regional.
 */
create or replace function private.game_seat_region_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select g.region_id, g.visibility, g.host_id into r from public.game_rooms g where g.id = new.room_id;
  if r.visibility = 'public' and r.region_id is not null and new.user_id is distinct from r.host_id
     and private.region_of(new.user_id) is not null and private.region_of(new.user_id) <> r.region_id
     and not private.is_moderator(new.user_id) then
    raise exception 'this table is in another region' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.game_seat_region_guard() from public, anon, authenticated;
drop trigger if exists game_participants_region_guard on public.game_participants;
create trigger game_participants_region_guard before insert on public.game_participants
  for each row execute function private.game_seat_region_guard();

-- The list of open tables: those of my region (one line added to game_rooms_open).
do $$
declare
  def text;
  needle constant text := 'where r.game = p_game and r.space = sp and ';
begin
  select pg_get_functiondef(p.oid) into strict def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'game_rooms_open';
  if position('private.my_region()' in def) > 0 then return; end if;
  if position(needle in def) = 0 then
    raise exception using message = 'regions: the filter of game_rooms_open was not found';
  end if;
  execute replace(def, needle, needle
    || '(r.region_id is null or private.my_region() is null or r.region_id = private.my_region() or private.is_moderator(me)'
    || ' or exists (select 1 from public.game_participants gq where gq.room_id = r.id and gq.user_id = me and gq.left_at is null)) and ');
end $$;

-- ───────── 6. Functions ─────────

/** Days between two moves from one region to another. */
create or replace function private.region_change_wait() returns interval
language sql immutable as $$ select interval '90 days' $$;
revoke all on function private.region_change_wait() from public, anon, authenticated;

/**
 * My region, my city, what I declared, when I may next move, and the
 * regions that are open with their cities.
 */
create or replace function public.my_region() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  p record;
  last_change timestamptz;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select pr.region_id, pr.city_id, pr.residency_declared_at into p from public.profiles pr where pr.id = me and pr.deleted_at is null;
  select max(d.declared_at) into last_change from public.region_declarations d where d.user_id = me and d.source = 'change';
  return jsonb_build_object(
    'region_id', p.region_id,
    'city_id', p.city_id,
    'declared_at', p.residency_declared_at,
    'can_change_at', case when last_change is null then null else last_change + private.region_change_wait() end,
    'regions', (select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name,
        'cities', (select coalesce(jsonb_agg(c.id order by c.sort, c.id), '[]'::jsonb)
          from public.cities c join public.regions r on r.id = c.region_id where r.country_id = k.id and c.live)) order by k.sort, k.id), '[]'::jsonb)
      from public.countries k
      where exists (select 1 from public.cities c join public.regions r on r.id = c.region_id where r.country_id = k.id and c.live)));
end $$;
revoke all on function public.my_region() from public, anon;
grant execute on function public.my_region() to authenticated;

/**
 * « I live in this region »: recorded once, with its date, for the region
 * my profile is in. A statement on her honour: IRLY does not check it
 * against a document, and says so nowhere.
 */
create or replace function public.declare_residency(p_region text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mine text;
  already timestamptz;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  perform private.require_profile(me);
  select p.region_id, p.residency_declared_at into mine, already from public.profiles p where p.id = me for update;
  if p_region is null or mine is null or p_region <> mine then
    raise exception 'this is not the region of your profile' using errcode = '22023';
  end if;
  if already is null then
    update public.profiles set residency_declared_at = now() where id = me;
    insert into public.region_declarations (user_id, region_id, source) values (me, mine, 'signup');
  end if;
  return public.my_region();
end $$;
revoke all on function public.declare_residency(text) from public, anon;
grant execute on function public.declare_residency(text) to authenticated;

/**
 * She moved: her account, her private chats and what she organised stay;
 * her region, her city and her declaration change. She leaves the
 * communities of the region she left and the activities coming up there
 * (her seat is freed), and owns no community there any more (handed over or
 * deleted first). One move every 90 days: a region is where one lives, not
 * a filter.
 */
create or replace function public.change_region(p_region text, p_city text, p_resident boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  old_region text;
  last_change timestamptz;
  left_communities integer;
  left_activities integer;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  perform private.require_profile(me);
  if private.is_sanctioned(me) then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  select p.region_id into old_region from public.profiles p where p.id = me for update;
  if p_region is null or p_city is null or private.country_of(p_city) is distinct from p_region
     or not exists (select 1 from public.cities c where c.id = p_city and c.live) then
    raise exception 'this region is not open' using errcode = '22023';
  end if;
  if p_region is not distinct from old_region then
    raise exception 'you already live in this region' using errcode = '22023';
  end if;
  if not coalesce(p_resident, false) then
    raise exception 'confirm that you live there' using errcode = '22023';
  end if;
  select max(d.declared_at) into last_change from public.region_declarations d where d.user_id = me and d.source = 'change';
  if last_change is not null and last_change + private.region_change_wait() > now() then
    raise exception 'you changed region recently' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.community_members m join public.communities c on c.id = m.community_id
    where m.user_id = me and m.role = 'owner' and c.deleted_at is null and not c.official
      and private.country_of(c.city_id) is not distinct from old_region) then
    raise exception 'hand over or delete the communities you own first' using errcode = '22023';
  end if;

  -- The communities of the region she leaves (their chats go with them: sync_community_chat).
  delete from public.community_members m using public.communities c
  where c.id = m.community_id and m.user_id = me and m.role <> 'owner'
    and private.country_of(c.city_id) is not distinct from old_region;
  get diagnostics left_communities = row_count;
  -- Her seat in what is coming up there (what is past stays in her history; what she organises stays hers).
  delete from public.activity_participants x using public.activities a
  where a.id = x.activity_id and x.user_id = me and a.creator_id <> me
    and private.country_of(a.city_id) is not distinct from old_region
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now();
  get diagnostics left_activities = row_count;
  -- Requests to join private communities there are no longer hers to wait on.
  update public.community_applications a set status = 'withdrawn', decided_at = now()
  from public.communities c
  where c.id = a.community_id and a.user_id = me and a.status = 'pending'
    and private.country_of(c.city_id) is not distinct from old_region;

  update public.profiles set city_id = p_city, region_id = p_region, residency_declared_at = now() where id = me;
  insert into public.region_declarations (user_id, region_id, previous_region, source) values (me, p_region, old_region, 'change');
  return public.my_region() || jsonb_build_object('left_communities', left_communities, 'left_activities', left_activities);
end $$;
revoke all on function public.change_region(text, text, boolean) from public, anon;
grant execute on function public.change_region(text, text, boolean) to authenticated;
