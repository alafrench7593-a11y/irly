-- IRLY engagement layer: places, universal interactions (like, comment,
-- save, share, hide), community posts, calendar, search, recommendations,
-- notification preferences, analytics and AI command log.
--
-- One rule throughout: an interaction points at a canonical entity by
-- (target_type, target_id). Nothing is copied; every screen reads the same row.

-- ───────────────────────── Destinations (admin-managed content) ─────────────────────────
-- Country → region (emirate) → city → area → place. Cities and areas keep the
-- text ids the app already uses (activities.city_id / area_id).

create table if not exists public.countries (
  id text primary key,
  name text not null,
  sort integer not null default 0
);
create table if not exists public.regions (
  id text primary key,
  country_id text not null references public.countries (id) on delete cascade,
  name text not null,
  sort integer not null default 0
);
create table if not exists public.cities (
  id text primary key,
  region_id text not null references public.regions (id) on delete cascade,
  name text not null,
  timezone text not null default 'Asia/Dubai',
  live boolean not null default true,
  sort integer not null default 0
);
create table if not exists public.areas (
  id text not null,
  city_id text not null references public.cities (id) on delete cascade,
  name text not null,
  lat numeric(8, 5),
  lng numeric(8, 5),
  primary key (city_id, id)
);
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  city_id text not null references public.cities (id) on delete cascade,
  area_id text,
  name text not null,
  kind text not null check (kind in ('mall', 'beach', 'beach_club', 'restaurant', 'cafe', 'court', 'park', 'venue', 'market', 'marina', 'desert', 'other')),
  category_id text,
  tags text[] not null default '{}',
  lat numeric(8, 5),
  lng numeric(8, 5),
  image_url text,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists places_city_idx on public.places (city_id, kind);

create table if not exists public.categories (
  id text primary key,
  label text not null,
  color text not null default '#7C5CFF',
  sort integer not null default 0,
  featured boolean not null default true
);

alter table public.countries enable row level security;
alter table public.regions enable row level security;
alter table public.cities enable row level security;
alter table public.areas enable row level security;
alter table public.places enable row level security;
alter table public.categories enable row level security;

do $$
declare t text;
begin
  foreach t in array array['countries', 'regions', 'cities', 'areas', 'places', 'categories'] loop
    execute format('drop policy if exists %1$s_read on public.%1$s', t);
    execute format('create policy %1$s_read on public.%1$s for select to anon, authenticated using (true)', t);
    execute format('drop policy if exists %1$s_admin on public.%1$s', t);
    execute format('create policy %1$s_admin on public.%1$s for all to authenticated using (private.is_admin()) with check (private.is_admin())', t);
  end loop;
end $$;

insert into public.countries (id, name, sort) values ('ae', 'United Arab Emirates', 0), ('id', 'Indonesia', 1)
on conflict (id) do nothing;
insert into public.regions (id, country_id, name, sort) values
  ('dubai', 'ae', 'Dubai', 0), ('abudhabi', 'ae', 'Abu Dhabi', 1), ('sharjah', 'ae', 'Sharjah', 2),
  ('ajman', 'ae', 'Ajman', 3), ('uaq', 'ae', 'Umm Al Quwain', 4), ('rak', 'ae', 'Ras Al Khaimah', 5),
  ('fujairah', 'ae', 'Fujairah', 6), ('bali', 'id', 'Bali', 0)
on conflict (id) do nothing;
insert into public.cities (id, region_id, name, timezone, sort) values
  ('dubai', 'dubai', 'Dubai', 'Asia/Dubai', 0), ('abudhabi', 'abudhabi', 'Abu Dhabi', 'Asia/Dubai', 1),
  ('sharjah', 'sharjah', 'Sharjah', 'Asia/Dubai', 2), ('ajman', 'ajman', 'Ajman', 'Asia/Dubai', 3),
  ('uaq', 'uaq', 'Umm Al Quwain', 'Asia/Dubai', 4), ('rak', 'rak', 'Ras Al Khaimah', 'Asia/Dubai', 5),
  ('fujairah', 'fujairah', 'Fujairah', 'Asia/Dubai', 6), ('bali', 'bali', 'Bali', 'Asia/Makassar', 0)
on conflict (id) do nothing;
insert into public.areas (city_id, id, name, lat, lng) values
  ('dubai', 'marina', 'Dubai Marina', 25.0805, 55.1403), ('dubai', 'jlt', 'JLT', 25.0693, 55.1426),
  ('dubai', 'jbr', 'JBR', 25.0780, 55.1330), ('dubai', 'jvc', 'JVC', 25.0592, 55.2066),
  ('dubai', 'palm', 'Palm Jumeirah', 25.1124, 55.1390), ('dubai', 'downtown', 'Downtown', 25.1972, 55.2744),
  ('dubai', 'difc', 'DIFC', 25.2125, 55.2795), ('dubai', 'businessbay', 'Business Bay', 25.1857, 55.2650),
  ('dubai', 'jumeirah', 'Jumeirah', 25.2048, 55.2425), ('dubai', 'kitebeach', 'Kite Beach', 25.1580, 55.1965),
  ('dubai', 'alquoz', 'Al Quoz', 25.1386, 55.2290), ('dubai', 'hills', 'Dubai Hills', 25.1030, 55.2440),
  ('dubai', 'alqudra', 'Al Qudra', 24.8330, 55.3720), ('dubai', 'deira', 'Deira', 25.2697, 55.3095),
  ('dubai', 'burdubai', 'Bur Dubai', 25.2532, 55.2967), ('dubai', 'citywalk', 'City Walk', 25.2068, 55.2620),
  ('abudhabi', 'saadiyat', 'Saadiyat', 24.5420, 54.4330), ('abudhabi', 'yas', 'Yas Island', 24.4880, 54.6080),
  ('abudhabi', 'corniche', 'Corniche', 24.4740, 54.3420), ('abudhabi', 'reem', 'Al Reem', 24.4960, 54.4050),
  ('abudhabi', 'maryah', 'Al Maryah', 24.5010, 54.3900), ('sharjah', 'alkhan', 'Al Khan', 25.3260, 55.3700),
  ('sharjah', 'alqasba', 'Al Qasba', 25.3290, 55.3810), ('ajman', 'corniche', 'Ajman Corniche', 25.4170, 55.4430),
  ('rak', 'almarjan', 'Al Marjan Island', 25.6830, 55.7460), ('rak', 'jebeljais', 'Jebel Jais', 25.9450, 56.1260),
  ('fujairah', 'dibba', 'Dibba', 25.6190, 56.2730), ('fujairah', 'snoopy', 'Snoopy Island', 25.4850, 56.3640),
  ('uaq', 'mangroves', 'Mangroves', 25.5450, 55.6000),
  ('bali', 'canggu', 'Canggu', -8.6478, 115.1385), ('bali', 'uluwatu', 'Uluwatu', -8.8291, 115.0849),
  ('bali', 'ubud', 'Ubud', -8.5069, 115.2625), ('bali', 'seminyak', 'Seminyak', -8.6913, 115.1683)
on conflict do nothing;
insert into public.places (slug, city_id, area_id, name, kind, category_id, tags, lat, lng, featured) values
  ('dubai-mall', 'dubai', 'downtown', 'The Dubai Mall', 'mall', 'shopping', '{luxury,fashion,beauty}', 25.1985, 55.2796, true),
  ('mall-of-the-emirates', 'dubai', 'alquoz', 'Mall of the Emirates', 'mall', 'shopping', '{fashion,luxury}', 25.1181, 55.2006, true),
  ('dubai-hills-mall', 'dubai', 'hills', 'Dubai Hills Mall', 'mall', 'shopping', '{fashion,sneakers}', 25.1029, 55.2389, false),
  ('dubai-marina-mall', 'dubai', 'marina', 'Dubai Marina Mall', 'mall', 'shopping', '{fashion}', 25.0763, 55.1403, false),
  ('city-walk', 'dubai', 'citywalk', 'City Walk', 'mall', 'shopping', '{streetwear,sneakers,cafes}', 25.2068, 55.2620, true),
  ('festival-city-mall', 'dubai', 'deira', 'Dubai Festival City Mall', 'mall', 'shopping', '{fashion}', 25.2220, 55.3520, false),
  ('ibn-battuta-mall', 'dubai', 'jlt', 'Ibn Battuta Mall', 'mall', 'shopping', '{fashion}', 25.0440, 55.1170, false),
  ('mercato', 'dubai', 'jumeirah', 'Mercato', 'mall', 'shopping', '{boutiques}', 25.2170, 55.2530, false),
  ('ripe-market', 'dubai', 'jumeirah', 'Ripe Market', 'market', 'shopping', '{market,vintage,food}', 25.2330, 55.2650, false),
  ('kite-beach', 'dubai', 'kitebeach', 'Kite Beach', 'beach', 'beach', '{kitesurf,running,volleyball}', 25.1580, 55.1965, true),
  ('jbr-beach', 'dubai', 'jbr', 'JBR Beach', 'beach', 'beach', '{swimming,sunset}', 25.0780, 55.1330, true),
  ('al-sufouh-beach', 'dubai', 'jumeirah', 'Al Sufouh Beach', 'beach', 'beach', '{sunset,paddleboard}', 25.1300, 55.1700, false),
  ('white-beach', 'dubai', 'palm', 'WHITE Beach', 'beach_club', 'beachclub', '{beach club,dj,sunset}', 25.1310, 55.1170, true),
  ('cove-beach', 'dubai', 'jbr', 'Cove Beach', 'beach_club', 'beachclub', '{beach club}', 25.0870, 55.1380, false),
  ('nikki-beach', 'dubai', 'jumeirah', 'Nikki Beach Dubai', 'beach_club', 'beachclub', '{beach club,brunch}', 25.2380, 55.2560, false),
  ('dubai-harbour', 'dubai', 'marina', 'Dubai Harbour', 'marina', 'water', '{yacht,boat,sunset}', 25.0930, 55.1420, false),
  ('al-qudra-lakes', 'dubai', 'alqudra', 'Al Qudra Lakes', 'desert', 'outdoor', '{cycling,camping,desert}', 24.8330, 55.3720, true),
  ('saadiyat-beach', 'abudhabi', 'saadiyat', 'Saadiyat Public Beach', 'beach', 'beach', '{swimming}', 24.5450, 54.4370, false),
  ('yas-mall', 'abudhabi', 'yas', 'Yas Mall', 'mall', 'shopping', '{fashion}', 24.4890, 54.6080, false),
  ('jebel-jais', 'rak', 'jebeljais', 'Jebel Jais', 'desert', 'outdoor', '{hiking,zipline}', 25.9450, 56.1260, true),
  ('snoopy-island', 'fujairah', 'snoopy', 'Snoopy Island', 'beach', 'water', '{snorkeling,diving,kayak}', 25.4850, 56.3640, false),
  ('batu-bolong', 'bali', 'canggu', 'Batu Bolong Beach', 'beach', 'water', '{surf,sunset}', -8.6590, 115.1300, true)
on conflict (slug) do nothing;
insert into public.categories (id, label, color, sort) values
  ('sport', 'Sport', '#2F80ED', 0), ('activities', 'Activities', '#7C5CFF', 1), ('events', 'Events', '#FF5A5F', 2),
  ('networking', 'Networking', '#0F9D8A', 3), ('food', 'Food', '#F2994A', 4), ('travel', 'Travel', '#27AE60', 5),
  ('entertainment', 'Entertainment', '#EB5757', 6), ('nightlife', 'Nightlife', '#5B4BDB', 7), ('wellness', 'Wellness', '#6FCF97', 8),
  ('shopping', 'Shopping', '#D16BA5', 9), ('creative', 'Creative', '#F2C94C', 10), ('culture', 'Culture', '#9B51E0', 11),
  ('learning', 'Learning', '#56CCF2', 12), ('beach', 'Beach', '#F6C26B', 13), ('beachclub', 'Beach Club', '#F28C6B', 14),
  ('water', 'Water Sports', '#2D9CDB', 15), ('outdoor', 'Outdoor', '#6E9F5B', 16), ('animals', 'Dog Walk', '#B08968', 17), ('family', 'Family', '#F2A65A', 21),
  ('communities', 'Communities', '#7C5CFF', 18), ('girl', 'IRLY Girl', '#E9A0B4', 19), ('irl', 'IRL', '#111111', 20)
on conflict (id) do nothing;

-- ───────────────────────── Profiles: onboarding fields ─────────────────────────

alter table public.profiles
  add column if not exists area_id text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists sports text[] not null default '{}',
  add column if not exists activity_prefs text[] not null default '{}',
  add column if not exists food text[] not null default '{}',
  add column if not exists travel text[] not null default '{}',
  add column if not exists intentions text[] not null default '{}',
  add column if not exists onboarded_at timestamptz;

-- Privacy lives in safety_settings (profile, IRL, activity visibility,
-- location precision, online status). Search honours profile_visibility.
create or replace function private.discoverable(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case s.profile_visibility
      when 'nobody' then false
      when 'friends' then private.friends_unchecked(auth.uid(), uid)
      else true end
    from public.safety_settings s where s.user_id = uid), true)
$$;
grant execute on function private.discoverable(uuid) to authenticated;

-- ───────────────────────── Activities & events: one canonical entity ─────────────────────────
-- An event is an activity with format = 'event' (cover, organizer, capacity,
-- chat, calendar): same join flow, same chat, same everywhere.

alter table public.activities
  add column if not exists cover_url text,
  add column if not exists timezone text not null default 'Asia/Dubai',
  add column if not exists place_id uuid references public.places (id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists activities_city_time_idx on public.activities (city_id, starts_at) where cancelled_at is null;

-- Participants hear about changes to time, place or cancellation.
create or replace function private.on_activity_updated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.starts_at, new.area_id, coalesce(new.place_name, ''), new.cancelled_at is null)
     is distinct from (old.starts_at, old.area_id, coalesce(old.place_name, ''), old.cancelled_at is null) then
    insert into public.notifications (user_id, kind, payload)
    select p.user_id, 'ACTIVITY_UPDATED',
      jsonb_build_object('activity_id', new.id, 'title', new.title, 'cancelled', new.cancelled_at is not null, 'starts_at', new.starts_at)
    from public.activity_participants p
    where p.activity_id = new.id and p.user_id <> new.creator_id and p.status = 'going';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists activities_updated on public.activities;
create trigger activities_updated before update on public.activities
for each row execute function private.on_activity_updated();

-- ───────────────────────── Notifications: kinds and preferences ─────────────────────────

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'MATCH_CREATED', 'MATCH_REMOVED', 'MESSAGE_CREATED', 'ACTIVITY_CREATED', 'ACTIVITY_JOINED',
  'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER', 'ACTIVITY_UPDATED', 'COMMUNITY_JOINED', 'COMMUNITY_INVITATION',
  'COMMUNITY_POST', 'MATCH_SUGGESTION', 'IRLY_POST_CREATED', 'PROFILE_UPDATED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
  'LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION', 'SHARE', 'AI_ACTION'
));

create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  muted_kinds text[] not null default '{}',
  push_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists notification_prefs_self on public.notification_prefs;
create policy notification_prefs_self on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Every notification passes here: muted kinds are dropped, and a block
-- silences notifications in both directions.
create or replace function private.notification_filter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid;
begin
  if exists (select 1 from public.notification_prefs p where p.user_id = new.user_id and new.kind = any (p.muted_kinds)) then
    return null;
  end if;
  begin
    actor := coalesce(new.payload ->> 'from', new.payload ->> 'user_id')::uuid;
  exception when others then
    actor := null;
  end;
  if actor is not null and (actor = new.user_id or private.blocked_unchecked(actor, new.user_id)) then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists notifications_filter on public.notifications;
create trigger notifications_filter before insert on public.notifications
for each row execute function private.notification_filter();

-- Friend requests get their own kinds (they were PROFILE_UPDATED).
create or replace function public.add_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_user);
  b uuid := greatest(me, p_user);
  f public.friendships;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user = me then raise exception 'that is you' using errcode = '22023'; end if;
  if private.blocked_unchecked(me, p_user) then raise exception 'not available' using errcode = 'P0002'; end if;
  select * into f from public.friendships where user_a = a and user_b = b;
  if not found then
    insert into public.friendships (user_a, user_b, requested_by) values (a, b, me);
    perform private.notify(p_user, 'FRIEND_REQUEST', jsonb_build_object('from', me));
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    perform private.notify(p_user, 'FRIEND_ACCEPTED', jsonb_build_object('from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;

-- ───────────────────────── Rate limiting ─────────────────────────

create or replace function private.rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
  cap integer := tg_argv[1]::integer;
  win interval := tg_argv[2]::interval;
  col text := tg_argv[0];
begin
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2', tg_table_schema, tg_table_name, col)
    into n using auth.uid(), win;
  if n >= cap then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  return new;
end $$;

-- ───────────────────────── IRL: more visibility levels, close friends ─────────────────────────

create table if not exists public.close_friends (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);
alter table public.close_friends enable row level security;
drop policy if exists close_friends_self on public.close_friends;
create policy close_friends_self on public.close_friends for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function private.in_close_friends(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.close_friends where user_id = owner and friend_id = auth.uid())
$$;
grant execute on function private.in_close_friends(uuid) to authenticated;

alter table public.irl_posts drop constraint if exists irl_posts_visibility_check;
alter table public.irl_posts add constraint irl_posts_visibility_check
  check (visibility in ('everyone', 'friends', 'close_friends', 'community', 'private'));
alter table public.irl_posts
  add column if not exists community_id uuid references public.communities (id) on delete set null,
  add column if not exists place_id uuid references public.places (id) on delete set null,
  add column if not exists media_kind text not null default 'photo' check (media_kind in ('photo', 'video'));

drop policy if exists irl_posts_read on public.irl_posts;
create policy irl_posts_read on public.irl_posts for select to authenticated
  using (
    author_id = auth.uid()
    or (
      expires_at > now()
      and not private.is_blocked(auth.uid(), author_id)
      and (
        visibility = 'everyone'
        or (visibility = 'friends' and private.are_friends(auth.uid(), author_id))
        or (visibility = 'close_friends' and private.in_close_friends(author_id))
        or (visibility = 'community' and community_id is not null and private.i_belong(community_id))
      )
    )
  );

drop trigger if exists irl_posts_rate on public.irl_posts;
create trigger irl_posts_rate before insert on public.irl_posts
for each row execute function private.rate_limit('author_id', '12', '1 hour');

-- Private and close-friends posts only notify the people who can see them.
create or replace function private.on_irl_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, payload)
  select case when f.user_a = new.author_id then f.user_b else f.user_a end, 'IRLY_POST_CREATED',
    jsonb_build_object('post_id', new.id, 'from', new.author_id, 'body', left(new.body, 80), 'area_id', new.area_id)
  from public.friendships f
  where f.status = 'accepted' and new.author_id in (f.user_a, f.user_b)
    and (
      new.visibility in ('friends', 'everyone')
      or (new.visibility = 'close_friends' and exists (
        select 1 from public.close_friends c
        where c.user_id = new.author_id and c.friend_id = case when f.user_a = new.author_id then f.user_b else f.user_a end))
    );
  return new;
end $$;

-- ───────────────────────── Community posts ─────────────────────────

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  media_path text,
  activity_id uuid references public.activities (id) on delete set null,
  poll jsonb check (poll is null or (jsonb_typeof(poll -> 'options') = 'array' and jsonb_array_length(poll -> 'options') between 2 and 6)),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists community_posts_idx on public.community_posts (community_id, created_at desc);
alter table public.community_posts enable row level security;

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select to authenticated
  using (
    deleted_at is null
    and exists (select 1 from public.communities c where c.id = community_id)
    and not private.is_blocked(auth.uid(), author_id)
  );
drop policy if exists community_posts_write on public.community_posts;
create policy community_posts_write on public.community_posts for insert to authenticated
  with check (author_id = auth.uid() and private.i_belong(community_id));
drop policy if exists community_posts_own on public.community_posts;
create policy community_posts_own on public.community_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop trigger if exists community_posts_rate on public.community_posts;
create trigger community_posts_rate before insert on public.community_posts
for each row execute function private.rate_limit('author_id', '20', '1 hour');

-- ───────────────────────── Universal interactions ─────────────────────────

create or replace function private.is_uuid(s text) returns boolean
language sql immutable as $$
  select s ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
$$;

-- Can the caller see this entity? Security INVOKER on purpose: each branch
-- reads the target table under the caller's own row level security, so an
-- interaction is only possible on content its author could already see.
-- Catalog items (places, curated activities) are public by nature.
create or replace function private.can_see(p_type text, p_id text) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_type in ('place', 'catalog') then
    return p_id is not null and char_length(p_id) between 1 and 120;
  end if;
  if not private.is_uuid(p_id) then
    return false;
  end if;
  return case p_type
    when 'irl_post' then exists (select 1 from public.irl_posts where id = p_id::uuid)
    when 'activity' then exists (select 1 from public.activities where id = p_id::uuid)
    when 'community' then exists (select 1 from public.communities where id = p_id::uuid)
    when 'community_post' then exists (select 1 from public.community_posts where id = p_id::uuid)
    when 'comment' then exists (select 1 from public.comments where id = p_id::uuid)
    when 'profile' then exists (select 1 from public.profiles_public where id = p_id::uuid)
      and not private.is_blocked(auth.uid(), p_id::uuid)
    else false
  end;
end $$;

-- Who should hear about it (null for catalog content).
create or replace function private.owner_of(p_type text, p_id text) returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_uuid(p_id) then return null; end if;
  return case p_type
    when 'irl_post' then (select author_id from public.irl_posts where id = p_id::uuid)
    when 'activity' then (select creator_id from public.activities where id = p_id::uuid)
    when 'community' then (select created_by from public.communities where id = p_id::uuid)
    when 'community_post' then (select author_id from public.community_posts where id = p_id::uuid)
    when 'comment' then (select author_id from public.comments where id = p_id::uuid)
    when 'profile' then p_id::uuid
    else null
  end;
end $$;

create table if not exists public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists likes_target_idx on public.likes (target_type, target_id);

create table if not exists public.saves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists saves_target_idx on public.saves (target_type, target_id);

create table if not exists public.hidden_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('irl_post', 'activity', 'community', 'community_post', 'place', 'catalog')),
  target_id text not null,
  -- One level of replies: a reply to a reply attaches to the same root.
  parent_id uuid references public.comments (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  mentions uuid[] not null default '{}' check (cardinality(mentions) <= 10),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists comments_target_idx on public.comments (target_type, target_id, created_at);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null,
  target_id text not null,
  channel text not null check (channel in ('chat', 'link', 'native', 'community')),
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shares_target_idx on public.shares (target_type, target_id);

do $$
declare t text;
begin
  foreach t in array array['likes', 'saves', 'hidden_items', 'shares'] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_type_check');
    execute format($f$alter table public.%I add constraint %I check (target_type in
      ('irl_post', 'activity', 'community', 'community_post', 'comment', 'profile', 'place', 'catalog'))$f$, t, t || '_type_check');
  end loop;
end $$;

alter table public.likes enable row level security;
alter table public.saves enable row level security;
alter table public.hidden_items enable row level security;
alter table public.comments enable row level security;
alter table public.shares enable row level security;

drop policy if exists likes_read on public.likes;
create policy likes_read on public.likes for select to authenticated
  using (user_id = auth.uid() or private.can_see(target_type, target_id));
drop policy if exists likes_write on public.likes;
create policy likes_write on public.likes for insert to authenticated
  with check (user_id = auth.uid() and private.can_see(target_type, target_id));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete to authenticated using (user_id = auth.uid());

-- Saves and hides are private to their owner.
drop policy if exists saves_self on public.saves;
create policy saves_self on public.saves for select to authenticated using (user_id = auth.uid());
drop policy if exists saves_write on public.saves;
create policy saves_write on public.saves for insert to authenticated
  with check (user_id = auth.uid() and private.can_see(target_type, target_id));
drop policy if exists saves_delete on public.saves;
create policy saves_delete on public.saves for delete to authenticated using (user_id = auth.uid());

drop policy if exists hidden_self on public.hidden_items;
create policy hidden_self on public.hidden_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated
  using (
    private.can_see(target_type, target_id)
    and not private.is_blocked(auth.uid(), author_id)
  );
drop policy if exists comments_write on public.comments;
create policy comments_write on public.comments for insert to authenticated
  with check (author_id = auth.uid() and deleted_at is null and private.can_see(target_type, target_id));
drop policy if exists comments_own on public.comments;
create policy comments_own on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists shares_self on public.shares;
create policy shares_self on public.shares for select to authenticated using (user_id = auth.uid());
drop policy if exists shares_write on public.shares;
create policy shares_write on public.shares for insert to authenticated
  with check (
    user_id = auth.uid() and private.can_see(target_type, target_id)
    and (conversation_id is null or private.is_member(conversation_id))
  );

drop trigger if exists likes_rate on public.likes;
create trigger likes_rate before insert on public.likes
for each row execute function private.rate_limit('user_id', '120', '1 minute');
drop trigger if exists comments_rate on public.comments;
create trigger comments_rate before insert on public.comments
for each row execute function private.rate_limit('author_id', '15', '2 minutes');

-- Replies: same target as their root, one level deep.
create or replace function private.comment_shape() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.comments;
begin
  if new.parent_id is not null then
    select * into p from public.comments where id = new.parent_id;
    if not found or p.target_type <> new.target_type or p.target_id <> new.target_id then
      raise exception 'reply must belong to the same thread' using errcode = '22023';
    end if;
    new.parent_id := coalesce(p.parent_id, p.id);
  end if;
  new.body := btrim(new.body);
  return new;
end $$;
drop trigger if exists comments_shape on public.comments;
create trigger comments_shape before insert on public.comments
for each row execute function private.comment_shape();

-- Owners hear about likes, comments, replies and mentions.
create or replace function private.on_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid := private.owner_of(new.target_type, new.target_id);
begin
  -- Like, unlike, like again: one notification a day, not three.
  if owner is not null and owner <> new.user_id and new.target_type <> 'profile'
     and not exists (select 1 from public.notifications n where n.user_id = owner and n.kind = 'LIKE'
       and n.created_at > now() - interval '1 day' and n.payload ->> 'from' = new.user_id::text
       and n.payload ->> 'target_id' = new.target_id) then
    perform private.notify(owner, 'LIKE', jsonb_build_object('from', new.user_id, 'target_type', new.target_type, 'target_id', new.target_id));
  end if;
  return new;
end $$;
drop trigger if exists likes_created on public.likes;
create trigger likes_created after insert on public.likes for each row execute function private.on_like();

create or replace function private.on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  owner uuid := private.owner_of(new.target_type, new.target_id);
  parent_author uuid;
  payload jsonb := jsonb_build_object('from', new.author_id, 'target_type', new.target_type, 'target_id', new.target_id,
    'comment_id', new.id, 'body', left(new.body, 80));
  m uuid;
begin
  if new.parent_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null and parent_author <> new.author_id then
      perform private.notify(parent_author, 'COMMENT_REPLY', payload);
    end if;
  end if;
  if owner is not null and owner <> new.author_id and owner is distinct from parent_author then
    perform private.notify(owner, 'COMMENT', payload);
  end if;
  foreach m in array new.mentions loop
    if m <> new.author_id and m is distinct from owner and m is distinct from parent_author then
      perform private.notify(m, 'MENTION', payload);
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists comments_created on public.comments;
create trigger comments_created after insert on public.comments for each row execute function private.on_comment();

-- Save totals are public numbers; who saved stays private.
create or replace function private.save_counts(p_type text, p_id text) returns setof integer
language sql stable security definer set search_path = public as $$
  select 1 from public.saves where target_type = p_type and target_id = p_id
$$;
-- Counters and my state for a batch of items (one round trip per screen).
create or replace function public.engagement(p_type text, p_ids text[])
returns table (target_id text, likes integer, comments integer, saves integer, liked boolean, saved boolean)
language sql stable security invoker set search_path = public as $$
  select i.id,
    (select count(*)::int from public.likes l where l.target_type = p_type and l.target_id = i.id),
    (select count(*)::int from public.comments c where c.target_type = p_type and c.target_id = i.id and c.deleted_at is null),
    (select count(*)::int from private.save_counts(p_type, i.id)),
    exists (select 1 from public.likes l where l.target_type = p_type and l.target_id = i.id and l.user_id = auth.uid()),
    exists (select 1 from public.saves s where s.target_type = p_type and s.target_id = i.id and s.user_id = auth.uid())
  from unnest(p_ids[1:200]) as i(id)
  where private.can_see(p_type, i.id)
$$;

grant execute on function private.save_counts(text, text), private.can_see(text, text), private.is_uuid(text) to authenticated;

create or replace function public.toggle_like(p_type text, p_id text) returns boolean
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.likes where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  if found then return false; end if;
  insert into public.likes (user_id, target_type, target_id) values (auth.uid(), p_type, p_id);
  return true;
end $$;

create or replace function public.toggle_save(p_type text, p_id text) returns boolean
language plpgsql security invoker set search_path = public as $$
begin
  delete from public.saves where user_id = auth.uid() and target_type = p_type and target_id = p_id;
  if found then return false; end if;
  insert into public.saves (user_id, target_type, target_id) values (auth.uid(), p_type, p_id);
  return true;
end $$;

-- Thread with author names; deleted comments keep their place, not their text.
create or replace function public.comment_thread(p_type text, p_id text)
returns table (id uuid, parent_id uuid, author_id uuid, first_name text, body text, created_at timestamptz, deleted boolean, likes integer, liked boolean)
language sql stable security invoker set search_path = public as $$
  select c.id, c.parent_id, c.author_id, p.first_name,
    case when c.deleted_at is null then c.body else '' end,
    c.created_at, c.deleted_at is not null,
    (select count(*)::int from public.likes l where l.target_type = 'comment' and l.target_id = c.id::text),
    exists (select 1 from public.likes l where l.target_type = 'comment' and l.target_id = c.id::text and l.user_id = auth.uid())
  from public.comments c
  left join public.profiles_public p on p.id = c.author_id
  where c.target_type = p_type and c.target_id = p_id
  order by coalesce(c.parent_id, c.id) = c.id desc, c.created_at
  limit 500
$$;

-- Share into a chat: one message pointing at the canonical entity.
alter table public.messages add column if not exists ref_type text;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'system', 'starter', 'activity', 'location', 'photo', 'share'));
drop policy if exists messages_send on public.messages;
create policy messages_send on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'activity', 'location', 'photo', 'share')
    and private.is_member(conversation_id)
    and not exists (
      select 1 from public.conversations c
      join public.conversation_members m on m.conversation_id = c.id
      where c.id = conversation_id and c.kind in ('direct', 'match') and m.user_id <> auth.uid()
        and private.is_blocked(auth.uid(), m.user_id)
    )
  );

create or replace function public.share_to_chat(p_conversation uuid, p_type text, p_id text, p_title text) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  mid uuid;
begin
  if not private.can_see(p_type, p_id) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  insert into public.messages (conversation_id, sender_id, kind, body, ref_type, ref_id)
  values (p_conversation, auth.uid(), 'share', left(coalesce(nullif(btrim(p_title), ''), 'Shared with you'), 200), p_type,
    case when private.is_uuid(p_id) then p_id::uuid end)
  returning id into mid;
  insert into public.shares (user_id, target_type, target_id, channel, conversation_id)
  values (auth.uid(), p_type, p_id, 'chat', p_conversation);
  return mid;
end $$;

-- One-to-one chat with a friend or a match (never with a stranger).
create or replace function public.open_direct(p_user uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user = me or private.blocked_unchecked(me, p_user) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  if not private.friends_unchecked(me, p_user)
     and not exists (select 1 from public.irly_matches where removed_at is null
       and user_a = least(me, p_user) and user_b = greatest(me, p_user)) then
    raise exception 'connect first to send a private message' using errcode = '42501';
  end if;
  select c.id into conv from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = me)
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = p_user)
  limit 1;
  if conv is null then
    insert into public.conversations (kind) values ('direct') returning id into conv;
    insert into public.conversation_members (conversation_id, user_id) values (conv, me), (conv, p_user);
  end if;
  return conv;
end $$;

-- The feed also carries the linked activity (IRL → join in one tap).
drop function if exists public.irl_feed(text);
create function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text)
language sql stable security invoker set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  left join public.activities a on a.id = i.activity_id
  where i.city_id = p_city and i.expires_at > now()
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
  order by i.created_at desc
  limit 100
$$;
grant execute on function public.irl_feed(text) to authenticated;

-- ───────────────────────── Activities: canonical reads ─────────────────────────

create or replace function public.activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer, currency text,
  capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text, my_status text, conversation_id uuid,
  cancelled boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    (select count(*)::int from public.activity_participants x where x.activity_id = a.id and x.status = 'going'),
    a.girl_only, a.community_id, a.cover_url,
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.id = p_id
$$;

-- Everything I'm going to between two dates: the calendar.
create or replace function public.my_calendar(p_from timestamptz default now() - interval '1 day', p_to timestamptz default now() + interval '60 days')
returns table (id uuid, title text, format text, category_id text, city_id text, area_id text, place_name text,
  starts_at timestamptz, ends_at timestamptz, timezone text, hosting boolean, conversation_id uuid)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.format, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.timezone,
    a.creator_id = auth.uid(),
    (select c.id from public.conversations c where c.activity_id = a.id)
  from public.activities a
  join public.activity_participants x on x.activity_id = a.id and x.user_id = auth.uid() and x.status = 'going'
  where a.cancelled_at is null and a.starts_at between p_from and p_to
  order by a.starts_at
$$;

-- ───────────────────────── Search ─────────────────────────

create or replace function public.search_all(p_q text, p_city text default null, p_limit integer default 30)
returns table (kind text, id text, title text, subtitle text, city_id text, area_id text, starts_at timestamptz, rank integer)
language sql stable security invoker set search_path = public as $$
  with q as (select '%' || replace(replace(btrim(coalesce(p_q, '')), '%', ''), '_', '') || '%' as pat, lower(btrim(coalesce(p_q, ''))) as raw)
  select * from (
    select 'activity'::text, a.id::text, a.title, a.category_id, a.city_id, a.area_id, a.starts_at,
      case when lower(a.title) like q.raw || '%' then 3 else 2 end
    from public.activities a, q
    where a.cancelled_at is null and a.starts_at > now() - interval '3 hours'
      and (p_city is null or a.city_id = p_city)
      and (a.title ilike q.pat or a.category_id ilike q.pat or coalesce(a.description, '') ilike q.pat
        or coalesce(a.place_name, '') ilike q.pat or a.area_id ilike q.pat)
    union all
    select 'community', c.id::text, c.name, coalesce(c.tagline, c.category_id), c.city_id, null, null,
      case when lower(c.name) like q.raw || '%' then 3 else 2 end
    from public.communities c, q
    where (p_city is null or c.city_id = p_city)
      and (c.name ilike q.pat or coalesce(c.tagline, '') ilike q.pat or coalesce(c.category_id, '') ilike q.pat)
    union all
    select 'person', p.id::text, p.first_name, p.city_id, p.city_id, null, null, 1
    from public.profiles_public p, q
    where p.id <> auth.uid() and char_length(q.raw) >= 2 and p.first_name ilike q.raw || '%'
      and not private.is_blocked(auth.uid(), p.id) and private.discoverable(p.id)
    union all
    select 'place', pl.slug, pl.name, pl.kind, pl.city_id, pl.area_id, null, case when pl.featured then 2 else 1 end
    from public.places pl, q
    where (p_city is null or pl.city_id = p_city)
      and (pl.name ilike q.pat or pl.kind ilike q.pat or array_to_string(pl.tags, ' ') ilike q.pat)
    union all
    select 'area', ar.city_id || ':' || ar.id, ar.name, ar.city_id, ar.city_id, ar.id, null, 1
    from public.areas ar, q where ar.name ilike q.pat and (p_city is null or ar.city_id = p_city)
    union all
    select 'city', ci.id, ci.name, ci.region_id, ci.id, null, null, 1
    from public.cities ci, q where ci.name ilike q.pat
    union all
    select 'category', ca.id, ca.label, null, null, null, null, 2
    from public.categories ca, q where ca.label ilike q.pat
  ) r (kind, id, title, subtitle, city_id, area_id, starts_at, rank)
  where char_length(btrim(coalesce(p_q, ''))) >= 1
  order by rank desc, starts_at nulls last, title
  limit least(greatest(p_limit, 1), 100)
$$;

-- ───────────────────────── Recommendations ─────────────────────────
-- Explainable score: my interests and sports, what friends are going to,
-- what I liked or saved before; never what I hid or already joined.

create or replace function public.recommend_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text)
language sql stable security invoker set search_path = public as $$
  with me as (
    select coalesce(p.interests, '{}') || coalesce(p.sports, '{}') || coalesce(p.activity_prefs, '{}') as tastes
    from public.profiles p where p.id = auth.uid()
  ),
  liked_cats as (
    select distinct a.category_id from public.activities a
    join (select target_id from public.likes where user_id = auth.uid() and target_type = 'activity'
          union select target_id from public.saves where user_id = auth.uid() and target_type = 'activity') t
      on t.target_id = a.id::text
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at,
      (select count(*)::int from public.activity_participants x where x.activity_id = a.id and x.status = 'going') as going,
      (select count(*)::int from public.activity_participants x
        where x.activity_id = a.id and x.status = 'going' and private.are_friends(auth.uid(), x.user_id)) as friends_going,
      (a.category_id = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select tastes from me), '{}'))) as taste,
      a.category_id in (select category_id from liked_cats) as liked_before
    from public.activities a
    where a.city_id = p_city and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      and not private.i_participate(a.id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or (select count(*) from public.activity_participants x
        where x.activity_id = a.id and x.status = 'going') < a.capacity)
  )
  select s.id, s.title, s.format, s.category_id, s.area_id, s.starts_at, s.going, s.friends_going,
    (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
      + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10))::int,
    case when s.friends_going > 0 then 'friends_going' when s.taste then 'your_interests'
      when s.liked_before then 'you_liked_similar' when s.starts_at < now() + interval '2 days' then 'soon' else 'popular' end
  from scored s
  order by 9 desc, s.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;

-- ───────────────────────── Moderation: repeated reports escalate ─────────────────────────

alter table public.reports drop constraint if exists reports_target_kind_check;
alter table public.reports add constraint reports_target_kind_check
  check (target_kind in ('profile', 'message', 'activity', 'community', 'irl_post', 'comment', 'community_post', 'event'));
alter table public.moderation_cases add column if not exists priority text not null default 'normal' check (priority in ('normal', 'high'));

-- Three different people reporting the same thing in a day: high priority,
-- and an IRL post or comment is hidden until a moderator reviews it.
create or replace function private.on_report_escalate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  if new.target_id is null then return new; end if;
  select count(distinct reporter_id) into n from public.reports
  where target_id = new.target_id and created_at > now() - interval '1 day';
  if n >= 3 then
    update public.moderation_cases m set priority = 'high'
    from public.reports r where r.id = m.report_id and r.target_id = new.target_id;
    if new.target_kind = 'irl_post' then
      update public.irl_posts set expires_at = now() where id = new.target_id;
    elsif new.target_kind = 'comment' then
      update public.comments set deleted_at = now() where id = new.target_id and deleted_at is null;
    elsif new.target_kind = 'community_post' then
      update public.community_posts set deleted_at = now() where id = new.target_id and deleted_at is null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists reports_escalate on public.reports;
create trigger reports_escalate after insert on public.reports
for each row execute function private.on_report_escalate();

-- ───────────────────────── Analytics (no sensitive data) ─────────────────────────

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (name ~ '^[A-Z][A-Z_]{2,39}$'),
  props jsonb not null default '{}' check (pg_column_size(props) <= 2048),
  platform text check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_name_idx on public.analytics_events (name, created_at);
alter table public.analytics_events enable row level security;
drop policy if exists analytics_insert on public.analytics_events;
create policy analytics_insert on public.analytics_events for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists analytics_admin on public.analytics_events;
create policy analytics_admin on public.analytics_events for select to authenticated using (private.is_admin());

-- ───────────────────────── AI and voice commands ─────────────────────────

create table if not exists public.ai_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null default 'text' check (source in ('text', 'voice')),
  input text not null check (char_length(input) between 1 and 500),
  intent text not null,
  entities jsonb not null default '{}',
  status text not null default 'parsed' check (status in ('parsed', 'confirmed', 'executed', 'cancelled', 'failed')),
  result_type text,
  result_id text,
  created_at timestamptz not null default now()
);
create index if not exists ai_commands_user_idx on public.ai_commands (user_id, created_at desc);
alter table public.ai_commands enable row level security;
drop policy if exists ai_commands_self on public.ai_commands;
create policy ai_commands_self on public.ai_commands for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── Grants and realtime ─────────────────────────

revoke all on function public.share_to_chat(uuid, text, text, text), public.open_direct(uuid) from public, anon;
grant execute on function
  public.engagement(text, text[]), public.toggle_like(text, text), public.toggle_save(text, text),
  public.comment_thread(text, text), public.share_to_chat(uuid, text, text, text), public.open_direct(uuid),
  public.activity_detail(uuid), public.my_calendar(timestamptz, timestamptz), public.search_all(text, text, integer),
  public.recommend_activities(text, integer)
to authenticated;

do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['likes', 'comments', 'community_posts', 'activities'] loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;
