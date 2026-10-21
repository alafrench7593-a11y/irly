-- Communities, activities and the IRLY Map: lifecycle audit fixes.
-- Additive and data-preserving: no row is changed, rewritten or removed.
--
-- 1. A community or an activity in a city IRLY does not have was accepted
--    (create_community('…', 'atlantis')): it was then listed nowhere. New
--    rows must name a city of public.cities (NOT VALID: existing rows are
--    not re-checked, nothing is rewritten).
-- 2. The map counted « going » through the reader's row rules: a participant
--    who hides her plans was missing, so the pin said 2/3 where the page and
--    the lists said 3/3. It now uses the same exact count (going_count).
-- 3. A deleted community's members-only plans stayed on its former members'
--    map and joinable: belonging now needs the community to exist.
-- 4. A plan moved by its host to another place (by name) kept the old
--    listed place's pin: the pin now goes instead of pointing wrong.

-- ───────── 1. Known cities only (new rows) ─────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'communities_city_known') then
    alter table public.communities add constraint communities_city_known
      foreign key (city_id) references public.cities (id) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activities_city_known') then
    alter table public.activities add constraint activities_city_known
      foreign key (city_id) references public.cities (id) not valid;
  end if;
end $$;

-- ───────── 2. The map's « going »: the exact count every other view shows ─────────
create or replace function public.map_activities(p_city text, p_from timestamptz default null, p_to timestamptz default null,
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
      -- Exact (security definer count): participants who hide their plans still count, as on the page and in the lists.
      private.going_count(a.id),
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

-- ───────── 3. A deleted community's members-only plans leave availability ─────────
-- Its members-only plans stayed on the map and joinable by its former
-- members after the owner deleted it (its posts and chat already went).
-- Belonging now needs the community to exist; people already going keep
-- their plan (they read it as participants), nobody new can join it.
create or replace function private.i_belong(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid())
    and exists (select 1 from public.communities c where c.id = cid and c.deleted_at is null
      and (not c.girl_only or private.girl_eligible_unchecked(auth.uid())))
$$;

create or replace function public.join_activity(p_activity uuid, p_status text default 'going') returns text
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  going integer;
  conv uuid;
  me uuid := auth.uid();
  before text;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  perform private.require_profile(me);
  select * into a from public.activities where id = p_activity and cancelled_at is null for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if coalesce(a.ends_at, a.starts_at + interval '2 hours') < now() then
    raise exception 'This activity is over' using errcode = '22023';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this activity is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.is_blocked(me, a.creator_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  select status into before from public.activity_participants where activity_id = p_activity and user_id = me;
  -- Who may join: anyone (public), the creator's friends, the community's
  -- members, or (invite) people it was shared with in a chat they are in.
  if a.creator_id <> me and before is null and not (
    a.privacy = 'public'
    or (a.privacy = 'friends' and private.friends_unchecked(me, a.creator_id))
    -- A member of the community, while it exists (a deleted community has no members to plan for).
    or (a.privacy = 'community' and a.community_id is not null and private.i_belong(a.community_id))
    -- Invite: shared in one of your chats BY the creator or someone going
    -- (anyone can write a message pointing at an id; that is not an invite).
    or (a.privacy = 'invite' and exists (
        select 1 from public.messages msg
        join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = me
        where msg.kind = 'share' and msg.ref_type = 'activity' and msg.ref_id = p_activity and msg.deleted_at is null
          and (msg.sender_id = a.creator_id or exists (
            select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = msg.sender_id and ap.status = 'going'))))
  ) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if p_status = 'going' and a.capacity is not null then
    select count(*) into going from public.activity_participants
    where activity_id = p_activity and status = 'going' and user_id <> me;
    if going >= a.capacity then
      return 'full';
    end if;
  end if;
  insert into public.activity_participants (activity_id, user_id, status) values (p_activity, me, p_status)
  on conflict (activity_id, user_id) do update set status = excluded.status;
  conv := private.ensure_conversation('activity', p_activity, a.title);
  if p_status = 'going' then
    insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
    -- Once per person and activity, however often they switch going/maybe.
    if a.creator_id <> me and not exists (
      select 1 from public.notifications n
      where n.user_id = a.creator_id and n.kind = 'ACTIVITY_JOINED'
        and n.payload ->> 'activity_id' = p_activity::text and n.payload ->> 'user_id' = me::text
    ) then
      perform private.notify(a.creator_id, 'ACTIVITY_JOINED', jsonb_build_object('activity_id', p_activity, 'user_id', me));
    end if;
  else
    delete from public.conversation_members where conversation_id = conv and user_id = me and user_id <> a.creator_id;
  end if;
  return p_status;
end $$;


-- ───────── 4. A plan moved elsewhere by its host leaves its old pin ─────────
-- The host's edit sheet changes the place by its name (« Kite Beach » →
-- « JLT Park »). A plan placed from a listed place kept that place's pin:
-- the map showed it at the old spot under the new name. When the new name
-- no longer names the listed place, the plan is no longer tied to it: its
-- pin goes (activity_position then places it from its exact address, if it
-- has one, or keeps it off the map: never at a wrong point).
create or replace function private.activity_place_renamed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  listed text;
begin
  if new.place_id is null or new.place_id is distinct from old.place_id
     or coalesce(new.place_name, '') = coalesce(old.place_name, '') then
    return new;
  end if;
  select p.name into listed from public.places p where p.id = new.place_id;
  if listed is not null and position(lower(listed) in lower(coalesce(new.place_name, ''))) = 0 then
    new.place_id := null;
  end if;
  return new;
end $$;
revoke all on function private.activity_place_renamed() from public, anon, authenticated;
-- Named to run before activities_position (same event, alphabetical order).
drop trigger if exists activities_place_renamed on public.activities;
create trigger activities_place_renamed before update of place_name on public.activities
for each row execute function private.activity_place_renamed();
