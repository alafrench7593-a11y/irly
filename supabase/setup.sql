-- IRLY: full database setup for a new Supabase project.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Generated from supabase/migrations (keep them as the source of truth).

-- ===== supabase/migrations/20261005000000_irly_core.sql =====
-- IRLY core schema: profiles, safety, conversations, activities, communities,
-- notifications. Every rule that matters is enforced here, server-side:
-- the app is never trusted to hide data it should not receive.

create extension if not exists pgcrypto;

-- Helpers that take an arbitrary user id live in `private`, a schema the API
-- never exposes: policies can call them, clients cannot (no probing someone
-- else's gender or blocks through an RPC).
create schema if not exists private;
grant usage on schema private to authenticated;

-- ───────────────────────── Profiles ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  birthdate date not null check (birthdate <= (current_date - interval '18 years')),
  -- Self-declared at signup. Locked afterwards (see profiles_guard): only an
  -- admin can change it, so IRLY Girl eligibility cannot be toggled by a user.
  gender text not null check (gender in ('woman', 'man', 'other')),
  city_id text not null,
  country text,
  languages text[] not null default '{}',
  bio text check (bio is null or char_length(bio) <= 300),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  faith text,
  faith_visible boolean not null default false,
  arrived_at date,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index profiles_city_idx on public.profiles (city_id) where deleted_at is null;

create or replace function private.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
for each row execute function private.touch_updated_at();

create or replace function private.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = uid and deleted_at is null), false)
$$;

-- Users cannot grant themselves admin, nor change the gender they declared.
create or replace function private.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.is_admin := false;
    return new;
  end if;
  if new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin is not editable' using errcode = '42501';
  end if;
  if new.gender is distinct from old.gender then
    raise exception 'gender is set at signup; contact support to change it' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before insert or update on public.profiles
for each row execute function private.profiles_guard();

-- IRLY Girl is women only, decided here and nowhere else.
create or replace function private.girl_eligible_unchecked(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = uid and gender = 'woman' and deleted_at is null
  )
$$;

-- When a client role calls a helper directly (not through one of our
-- security definer functions), it may only ask about itself.
create or replace function private.assert_self(variadic ids uuid[]) returns void
language plpgsql stable as $$
begin
  if session_user <> current_user and current_user in ('authenticated', 'anon') and not (auth.uid() = any (ids)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;

create or replace function private.is_girl_eligible(uid uuid default auth.uid()) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  perform private.assert_self(uid);
  return private.girl_eligible_unchecked(uid);
end $$;

-- ───────────────────────── Safety ─────────────────────────

create table public.safety_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  profile_visibility text not null default 'everyone' check (profile_visibility in ('everyone', 'friends', 'communities', 'nobody')),
  who_can_message text not null default 'matches' check (who_can_message in ('everyone', 'friends', 'matches', 'nobody')),
  irl_visibility text not null default 'friends' check (irl_visibility in ('everyone', 'friends', 'communities', 'nobody')),
  activity_visibility text not null default 'everyone' check (activity_visibility in ('everyone', 'friends', 'communities', 'nobody')),
  -- Exact location is never shared: at most the neighbourhood.
  location_precision text not null default 'area' check (location_precision in ('area', 'city', 'hidden')),
  show_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- Either side blocking hides both people from each other everywhere.
create or replace function private.blocked_unchecked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function private.is_blocked(a uuid, b uuid) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  perform private.assert_self(a, b);
  return private.blocked_unchecked(a, b);
end $$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_kind text not null check (target_kind in ('profile', 'message', 'activity', 'community', 'irl_post')),
  target_id uuid,
  category text not null check (category in ('harassment', 'inappropriate', 'fake_profile', 'spam', 'unsafe', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now()
);

create index reports_target_user_idx on public.reports (target_user_id);

create table public.moderation_cases (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  assignee_id uuid references public.profiles (id) on delete set null,
  decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index moderation_cases_status_idx on public.moderation_cases (status, created_at);

create trigger moderation_cases_touch before update on public.moderation_cases
for each row execute function private.touch_updated_at();

-- ───────────────────────── Notifications ─────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'MATCH_CREATED', 'MATCH_REMOVED', 'MESSAGE_CREATED', 'ACTIVITY_CREATED', 'ACTIVITY_JOINED',
    'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER', 'COMMUNITY_JOINED', 'COMMUNITY_INVITATION',
    'MATCH_SUGGESTION', 'IRLY_POST_CREATED', 'PROFILE_UPDATED'
  )),
  payload jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function private.notify(uid uuid, kind text, payload jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, payload) values (uid, kind, payload)
$$;

-- ───────────────────────── Communities ─────────────────────────

create table public.communities (
  id uuid primary key default gen_random_uuid(),
  city_id text not null,
  name text not null check (char_length(name) between 3 and 60),
  tagline text,
  description text,
  category_id text,
  girl_only boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index community_members_user_idx on public.community_members (user_id);

-- ───────────────────────── Activities ─────────────────────────

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  format text not null default 'session' check (format in ('activity', 'sport', 'event', 'session', 'meetup', 'trip')),
  title text not null check (char_length(title) between 3 and 80),
  description text check (description is null or char_length(description) <= 1000),
  category_id text not null,
  sub_id text,
  catalog_activity_id text,
  city_id text not null,
  area_id text not null,
  place_name text,
  -- Rounded to ~1 km; precise meeting points are shared in the chat.
  approx_lat numeric(6, 3),
  approx_lng numeric(6, 3),
  starts_at timestamptz not null,
  ends_at timestamptz,
  price_minor integer not null default 0 check (price_minor >= 0),
  currency text not null default 'AED',
  capacity integer check (capacity is null or capacity between 2 and 1000),
  privacy text not null default 'public' check (privacy in ('public', 'friends', 'community', 'invite')),
  girl_only boolean not null default false,
  community_id uuid references public.communities (id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at is null or ends_at > starts_at)
);

create index activities_city_time_idx on public.activities (city_id, starts_at) where cancelled_at is null;
create index activities_creator_idx on public.activities (creator_id);

create table public.activity_participants (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'maybe', 'not_going')),
  joined_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

create index activity_participants_user_idx on public.activity_participants (user_id);

-- ───────────────────────── Conversations ─────────────────────────

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'match', 'activity', 'community', 'group')),
  title text,
  -- One chat per match, per activity, per community: never duplicated.
  match_id uuid unique,
  activity_id uuid unique references public.activities (id) on delete cascade,
  community_id uuid unique references public.communities (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  muted boolean not null default false,
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create or replace function private.is_member(conv uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = conv and user_id = uid)
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- null = sent by IRLY (welcome, conversation starters).
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system', 'starter', 'activity', 'location', 'photo')),
  body text not null check (char_length(body) between 1 and 4000),
  reply_to uuid references public.messages (id) on delete set null,
  ref_id uuid,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create table public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.message_reads (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create or replace function private.ensure_conversation(p_kind text, p_ref uuid, p_title text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if p_kind = 'activity' then
    insert into public.conversations (kind, activity_id, title) values ('activity', p_ref, p_title)
    on conflict (activity_id) do nothing;
    select id into conv from public.conversations where activity_id = p_ref;
  elsif p_kind = 'community' then
    insert into public.conversations (kind, community_id, title) values ('community', p_ref, p_title)
    on conflict (community_id) do nothing;
    select id into conv from public.conversations where community_id = p_ref;
  elsif p_kind = 'match' then
    insert into public.conversations (kind, match_id, title) values ('match', p_ref, p_title)
    on conflict (match_id) do nothing;
    select id into conv from public.conversations where match_id = p_ref;
  else
    raise exception 'unsupported conversation kind %', p_kind;
  end if;
  return conv;
end $$;

-- Sending a message bumps the conversation and notifies the other members
-- (unless muted or blocked).
create or replace function private.on_message_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  if new.sender_id is not null then
    insert into public.notifications (user_id, kind, payload)
    select m.user_id, 'MESSAGE_CREATED', jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
    from public.conversation_members m
    where m.conversation_id = new.conversation_id
      and m.user_id <> new.sender_id
      and not m.muted
      and not private.is_blocked(m.user_id, new.sender_id);
  end if;
  return new;
end $$;

create trigger messages_created after insert on public.messages
for each row execute function private.on_message_created();

-- ───────────────────────── Activity & community flows ─────────────────────────

-- Creating an activity creates its chat with the creator in it.
create or replace function private.on_activity_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  insert into public.activity_participants (activity_id, user_id) values (new.id, new.creator_id)
  on conflict do nothing;
  conv := private.ensure_conversation('activity', new.id, new.title);
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, new.creator_id, 'admin')
  on conflict do nothing;
  return new;
end $$;

create trigger activities_created after insert on public.activities
for each row execute function private.on_activity_created();

-- Joining is done here so capacity holds under concurrent joins (row lock).
create or replace function public.join_activity(p_activity uuid, p_status text default 'going') returns text
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  going integer;
  conv uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select * into a from public.activities where id = p_activity and cancelled_at is null for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this activity is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.is_blocked(me, a.creator_id) then
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
    if a.creator_id <> me then
      perform private.notify(a.creator_id, 'ACTIVITY_JOINED', jsonb_build_object('activity_id', p_activity, 'user_id', me));
    end if;
  else
    delete from public.conversation_members where conversation_id = conv and user_id = me and user_id <> a.creator_id;
  end if;
  return p_status;
end $$;

create or replace function public.leave_activity(p_activity uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  delete from public.activity_participants
  where activity_id = p_activity and user_id = me
    and not exists (select 1 from public.activities where id = p_activity and creator_id = me);
  delete from public.conversation_members m using public.conversations c
  where c.id = m.conversation_id and c.activity_id = p_activity and m.user_id = me
    and not exists (select 1 from public.activities where id = p_activity and creator_id = me);
end $$;

-- Joining a community joins its chat, in the same transaction.
create or replace function public.join_community(p_community uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id) values (p_community, me) on conflict do nothing;
  conv := private.ensure_conversation('community', p_community, c.name);
  insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
  perform private.notify(me, 'COMMUNITY_JOINED', jsonb_build_object('community_id', p_community, 'conversation_id', conv));
  return conv;
end $$;

create or replace function public.leave_community(p_community uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  delete from public.community_members where community_id = p_community and user_id = me and role <> 'owner';
  delete from public.conversation_members m using public.conversations c
  where c.id = m.conversation_id and c.community_id = p_community and m.user_id = me
    and not exists (select 1 from public.community_members where community_id = p_community and user_id = me);
end $$;

-- ───────────────────────── Row level security ─────────────────────────

alter table public.profiles enable row level security;
alter table public.safety_settings enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_cases enable row level security;
alter table public.notifications enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.activities enable row level security;
alter table public.activity_participants enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reactions enable row level security;
alter table public.message_reads enable row level security;

-- People you share a conversation with can see your profile; everyone else
-- goes through purpose-built functions that return only what is visible.
create or replace function private.shares_unchecked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members x
    join public.conversation_members y on y.conversation_id = x.conversation_id
    where x.user_id = a and y.user_id = b
  )
$$;

create or replace function private.shares_conversation(a uuid, b uuid) returns boolean
language plpgsql stable security invoker set search_path = public as $$
begin
  perform private.assert_self(a, b);
  return private.shares_unchecked(a, b);
end $$;

create policy profiles_self on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_contacts on public.profiles for select to authenticated
  using (deleted_at is null and private.shares_conversation(auth.uid(), id) and not private.is_blocked(auth.uid(), id));
create policy profiles_admin on public.profiles for select to authenticated using (private.is_admin());

create policy safety_self on public.safety_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_self on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or private.is_admin());

create policy moderation_admin on public.moderation_cases for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy notifications_self on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy communities_read on public.communities for select to authenticated
  using (deleted_at is null and (not girl_only or private.is_girl_eligible()));
create policy communities_create on public.communities for insert to authenticated
  with check (created_by = auth.uid() and (not girl_only or private.is_girl_eligible()));
create policy communities_owner on public.communities for update to authenticated
  using (exists (select 1 from public.community_members m where m.community_id = id and m.user_id = auth.uid() and m.role = 'owner'));

create policy community_members_read on public.community_members for select to authenticated
  using (exists (select 1 from public.communities c where c.id = community_id and c.deleted_at is null and (not c.girl_only or private.is_girl_eligible())));

-- Membership checks for policies, without policies reading each other's
-- tables (which would recurse). Always about the caller.
create or replace function private.i_participate(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.activity_participants where activity_id = aid and user_id = auth.uid())
$$;
create or replace function private.i_belong(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid())
$$;
grant execute on function private.i_participate(uuid), private.i_belong(uuid) to authenticated;

create policy activities_read on public.activities for select to authenticated
  using (
    creator_id = auth.uid()
    or private.i_participate(id)
    or (
      cancelled_at is null
      and privacy = 'public'
      and (not girl_only or private.is_girl_eligible())
      and not private.is_blocked(auth.uid(), creator_id)
    )
    or (
      cancelled_at is null
      and privacy = 'community'
      and community_id is not null
      and private.i_belong(community_id)
    )
  );
create policy activities_create on public.activities for insert to authenticated
  with check (creator_id = auth.uid() and (not girl_only or private.is_girl_eligible()));
create policy activities_creator on public.activities for update to authenticated
  using (creator_id = auth.uid()) with check (creator_id = auth.uid());

create policy participants_read on public.activity_participants for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

create policy conversations_read on public.conversations for select to authenticated using (private.is_member(id));

create policy conversation_members_read on public.conversation_members for select to authenticated
  using (private.is_member(conversation_id));
create policy conversation_members_self on public.conversation_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy messages_read on public.messages for select to authenticated using (private.is_member(conversation_id));
create policy messages_send on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and kind in ('text', 'activity', 'location', 'photo')
    and private.is_member(conversation_id)
    -- In one-to-one chats, a block silences both sides.
    and not exists (
      select 1 from public.conversations c
      join public.conversation_members m on m.conversation_id = c.id
      where c.id = conversation_id and c.kind in ('direct', 'match') and m.user_id <> auth.uid()
        and private.is_blocked(auth.uid(), m.user_id)
    )
  );
create policy messages_edit_own on public.messages for update to authenticated
  using (sender_id = auth.uid()) with check (sender_id = auth.uid());

create policy reactions_read on public.message_reactions for select to authenticated
  using (exists (select 1 from public.messages m where m.id = message_id and private.is_member(m.conversation_id)));
create policy reactions_write on public.message_reactions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and private.is_member(m.conversation_id)));

create policy reads_self on public.message_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and private.is_member(m.conversation_id)));

-- Reports open a moderation case automatically.
create or replace function public.report(p_kind text, p_target_user uuid, p_target_id uuid, p_category text, p_details text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  rid uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category, details)
  values (auth.uid(), p_target_user, p_kind, p_target_id, p_category, p_details)
  returning id into rid;
  insert into public.moderation_cases (report_id) values (rid);
  return rid;
end $$;

revoke all on function public.join_activity(uuid, text), public.leave_activity(uuid), public.join_community(uuid),
  public.leave_community(uuid), public.report(text, uuid, uuid, text, text) from public, anon;
grant execute on function public.join_activity(uuid, text), public.leave_activity(uuid), public.join_community(uuid),
  public.leave_community(uuid), public.report(text, uuid, uuid, text, text) to authenticated;
revoke all on function private.notify(uuid, text, jsonb), private.ensure_conversation(text, uuid, text) from public, anon, authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_admin(uuid), private.is_girl_eligible(uuid), private.is_blocked(uuid, uuid),
  private.is_member(uuid, uuid), private.shares_conversation(uuid, uuid), private.assert_self(uuid[]),
  private.girl_eligible_unchecked(uuid), private.blocked_unchecked(uuid, uuid), private.shares_unchecked(uuid, uuid) to authenticated;

-- What the app may ask about itself.
create or replace function public.my_girl_access() returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_girl_eligible(auth.uid())
$$;
revoke all on function public.my_girl_access() from public, anon;
grant execute on function public.my_girl_access() to authenticated;

-- ===== supabase/migrations/20261005000100_irly_match.sql =====
-- IRLY Girl Match: women-only friendship matching.
-- Eligibility, visibility, scoring and match creation all happen here.
-- Clients can only call the functions below; they never read another
-- member's match profile directly.

-- ───────────────────────── Configuration ─────────────────────────

-- Weights live in the database so product can tune matching without an app
-- release. Each weight multiplies a 0..1 similarity; the score is the
-- weighted mean over the facets both people filled in.
create table public.irly_match_config (
  id smallint primary key default 1 check (id = 1),
  weights jsonb not null,
  min_score integer not null default 0 check (min_score between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.irly_match_config (weights) values (jsonb_build_object(
  'interests', 3,
  'activities', 2.5,
  'sports', 2,
  'goals', 2.5,
  'lifestyle', 2,
  'languages', 1.5,
  'availability', 1.5,
  'areas', 1,
  'age', 1,
  'communities', 1,
  'travel', 1
));

-- ───────────────────────── Profiles ─────────────────────────

create table public.irly_match_onboarding (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now()
);

create table public.irly_match_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  visible boolean not null default true,
  bio text check (bio is null or char_length(bio) <= 300),
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) between 0 and 6),
  interests text[] not null default '{}',
  sports text[] not null default '{}',
  activities text[] not null default '{}',
  goals text[] not null default '{}' check (cardinality(goals) >= 1),
  languages text[] not null default '{}',
  -- Neighbourhoods, never coordinates.
  areas text[] not null default '{}',
  availability text[] not null default '{}',
  travel text[] not null default '{}',
  -- Each dimension is -1, 0 or 1: chronotype (morning..night), social
  -- (introvert..social), planning (planner..spontaneous), energy
  -- (relaxed..active), setting (city..nature), travel frequency.
  lifestyle jsonb not null default '{}',
  age_min smallint not null default 18 check (age_min >= 18),
  age_max smallint not null default 99 check (age_max >= age_min),
  -- Fields the member keeps to herself (e.g. 'age', 'languages', 'areas').
  hidden_fields text[] not null default '{}',
  last_active_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index irly_match_profiles_visible_idx on public.irly_match_profiles (visible, last_active_at desc);
create index irly_match_profiles_interests_idx on public.irly_match_profiles using gin (interests);
create index irly_match_profiles_sports_idx on public.irly_match_profiles using gin (sports);

create trigger irly_match_profiles_touch before update on public.irly_match_profiles
for each row execute function private.touch_updated_at();

-- ───────────────────────── Actions & matches ─────────────────────────

create table public.irly_match_actions (
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  action text not null check (action in ('like', 'pass', 'save')),
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id, action),
  check (actor_id <> target_id)
);

-- Like and pass exclude each other; save is independent.
create unique index irly_match_actions_decision_idx on public.irly_match_actions (actor_id, target_id) where action <> 'save';
create index irly_match_actions_target_idx on public.irly_match_actions (target_id, action);

create table public.irly_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  score smallint not null check (score between 0 and 100),
  reasons jsonb not null default '{}',
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid references public.profiles (id) on delete set null,
  -- One match per pair, whoever liked first.
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index irly_matches_b_idx on public.irly_matches (user_b);

alter table public.conversations
  add constraint conversations_match_fk foreign key (match_id) references public.irly_matches (id) on delete cascade;

alter table public.irly_match_config enable row level security;
alter table public.irly_match_onboarding enable row level security;
alter table public.irly_match_profiles enable row level security;
alter table public.irly_match_actions enable row level security;
alter table public.irly_matches enable row level security;

create policy match_config_read on public.irly_match_config for select to authenticated using (true);
create policy match_config_admin on public.irly_match_config for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy match_onboarding_self on public.irly_match_onboarding for select to authenticated using (user_id = auth.uid());

-- Your own match profile only, and only if you are eligible.
create policy match_profile_self on public.irly_match_profiles for all to authenticated
  using (user_id = auth.uid() and private.is_girl_eligible(auth.uid()))
  with check (
    user_id = auth.uid()
    and private.is_girl_eligible(auth.uid())
    and exists (select 1 from public.irly_match_onboarding o where o.user_id = auth.uid())
  );

create policy match_actions_self on public.irly_match_actions for select to authenticated using (actor_id = auth.uid());

create policy matches_self on public.irly_matches for select to authenticated
  using (auth.uid() in (user_a, user_b) and removed_at is null);

-- ───────────────────────── Scoring ─────────────────────────

-- Set similarity: |A ∩ B| / sqrt(|A| · |B|). 1 when identical, 0 when
-- disjoint, and fair between someone with 3 interests and someone with 12.
create or replace function private.set_similarity(a text[], b text[]) returns numeric
language sql immutable as $$
  select case
    when coalesce(cardinality(a), 0) = 0 or coalesce(cardinality(b), 0) = 0 then null
    else (select count(*) from (select unnest(a) intersect select unnest(b)) x)::numeric
         / sqrt(cardinality(a)::numeric * cardinality(b)::numeric)
  end
$$;

create or replace function private.shared(a text[], b text[]) returns text[]
language sql immutable as $$
  select coalesce(array_agg(x order by x), '{}') from (select unnest(a) intersect select unnest(b)) s(x)
$$;

-- Lifestyle: mean agreement over the dimensions both answered (-1..1 each).
create or replace function private.lifestyle_similarity(a jsonb, b jsonb) returns numeric
language sql immutable as $$
  select avg(1 - abs((a ->> k)::numeric - (b ->> k)::numeric) / 2)
  from jsonb_object_keys(a) k
  where b ? k and jsonb_typeof(a -> k) = 'number' and jsonb_typeof(b -> k) = 'number'
$$;

create or replace function private.age_of(uid uuid) returns integer
language sql stable as $$
  select date_part('year', age(current_date, birthdate))::integer from public.profiles where id = uid
$$;

-- Age fits when each is inside the other's range; it fades over 10 years outside.
create or replace function private.age_similarity(age_a integer, min_a integer, max_a integer, age_b integer, min_b integer, max_b integer) returns numeric
language sql immutable as $$
  select least(
    1 - least(1, greatest(0, min_a - age_b, age_b - max_a)::numeric / 10),
    1 - least(1, greatest(0, min_b - age_a, age_a - max_b)::numeric / 10)
  )
$$;

create or replace function private.match_score(a uuid, b uuid) returns table (score integer, reasons jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  pa public.irly_match_profiles;
  pb public.irly_match_profiles;
  w jsonb;
  facets jsonb := '{}';
  num numeric := 0;
  den numeric := 0;
  k text;
  sim numeric;
  comm_a text[];
  comm_b text[];
begin
  select * into pa from public.irly_match_profiles where user_id = a;
  select * into pb from public.irly_match_profiles where user_id = b;
  if pa.user_id is null or pb.user_id is null then
    return query select 0, '{}'::jsonb;
    return;
  end if;
  select weights into w from public.irly_match_config where id = 1;
  select coalesce(array_agg(community_id::text), '{}') into comm_a from public.community_members where user_id = a;
  select coalesce(array_agg(community_id::text), '{}') into comm_b from public.community_members where user_id = b;

  facets := jsonb_build_object(
    'interests', private.set_similarity(pa.interests, pb.interests),
    'activities', private.set_similarity(pa.activities, pb.activities),
    'sports', private.set_similarity(pa.sports, pb.sports),
    'goals', private.set_similarity(pa.goals, pb.goals),
    'lifestyle', private.lifestyle_similarity(pa.lifestyle, pb.lifestyle),
    'languages', case when cardinality(private.shared(pa.languages, pb.languages)) > 0 then 1
                      when cardinality(pa.languages) > 0 and cardinality(pb.languages) > 0 then 0 end,
    'availability', private.set_similarity(pa.availability, pb.availability),
    'areas', private.set_similarity(pa.areas, pb.areas),
    'age', private.age_similarity(private.age_of(a), pa.age_min, pa.age_max, private.age_of(b), pb.age_min, pb.age_max),
    'communities', private.set_similarity(comm_a, comm_b),
    'travel', private.set_similarity(pa.travel, pb.travel)
  );

  for k in select jsonb_object_keys(facets) loop
    if jsonb_typeof(facets -> k) = 'number' and w ? k then
      sim := (facets ->> k)::numeric;
      num := num + sim * (w ->> k)::numeric;
      den := den + (w ->> k)::numeric;
    end if;
  end loop;

  return query select
    case when den = 0 then 0 else round(100 * num / den)::integer end,
    jsonb_build_object(
      'interests', private.shared(pa.interests, pb.interests),
      'activities', private.shared(pa.activities, pb.activities),
      'sports', private.shared(pa.sports, pb.sports),
      'goals', private.shared(pa.goals, pb.goals),
      'languages', private.shared(pa.languages, pb.languages),
      'areas', private.shared(pa.areas, pb.areas),
      'availability', private.shared(pa.availability, pb.availability),
      'travel', private.shared(pa.travel, pb.travel),
      'facets', facets
    );
end $$;

-- ───────────────────────── API (RPC) ─────────────────────────

create or replace function private.require_match_access() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if not private.is_girl_eligible(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return me;
end $$;

-- Where the member is in the IRLY Girl flow: 'onboarding', 'profile' or 'ready'.
create or replace function public.irly_match_state() returns text
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  if not exists (select 1 from public.irly_match_onboarding where user_id = me) then
    return 'onboarding';
  end if;
  if not exists (select 1 from public.irly_match_profiles where user_id = me) then
    return 'profile';
  end if;
  return 'ready';
end $$;

create or replace function public.complete_irly_match_onboarding() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  insert into public.irly_match_onboarding (user_id) values (me) on conflict do nothing;
end $$;

create or replace function public.irly_match_ping() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
begin
  update public.irly_match_profiles set last_active_at = now() where user_id = me;
end $$;

-- Discovery: eligible, visible, not blocked, not already decided, not
-- matched. Only fields the person chose to show, scored against you.
-- Filters (all optional): interests[], sport, language, goal, area,
-- availability, community_id, travel (bool), age_min, age_max,
-- section ('for_you' | 'new' | 'active' | 'nearby' | 'interests' | 'sports' | 'travel' | 'saved').
create or replace function public.irly_match_discover(p_filters jsonb default '{}', p_limit integer default 20, p_offset integer default 0)
returns table (
  user_id uuid,
  first_name text,
  age integer,
  city_id text,
  bio text,
  photo_paths text[],
  interests text[],
  sports text[],
  activities text[],
  goals text[],
  languages text[],
  areas text[],
  travel text[],
  active_now boolean,
  is_new boolean,
  saved boolean,
  score integer,
  reasons jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  my_city text;
  section text := coalesce(p_filters ->> 'section', 'for_you');
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  me_profile public.irly_match_profiles;
begin
  select * into me_profile from public.irly_match_profiles where irly_match_profiles.user_id = me;
  if me_profile.user_id is null then
    raise exception 'create your IRLY Match profile first' using errcode = 'P0001';
  end if;
  select p.city_id into my_city from public.profiles p where p.id = me;

  return query
  with candidates as (
    select mp.*, p.first_name as fname, p.city_id as pcity, p.created_at as pcreated, p.arrived_at,
      private.age_of(mp.user_id) as page,
      coalesce(s.show_active, false) as show_active,
      exists (select 1 from public.irly_match_actions sa where sa.actor_id = me and sa.target_id = mp.user_id and sa.action = 'save') as is_saved
    from public.irly_match_profiles mp
    join public.profiles p on p.id = mp.user_id and p.deleted_at is null and p.gender = 'woman'
    left join public.safety_settings s on s.user_id = mp.user_id
    where mp.user_id <> me
      and mp.visible
      and coalesce(s.profile_visibility, 'everyone') <> 'nobody'
      and not private.is_blocked(me, mp.user_id)
      and not exists (select 1 from public.irly_match_actions d where d.actor_id = me and d.target_id = mp.user_id and d.action in ('like', 'pass'))
      and not exists (
        select 1 from public.irly_matches m
        where m.user_a = least(me, mp.user_id) and m.user_b = greatest(me, mp.user_id) and m.removed_at is null
      )
  ),
  filtered as (
    select c.* from candidates c
    where (section <> 'saved' or c.is_saved)
      and (p_filters -> 'interests' is null or c.interests && array(select jsonb_array_elements_text(p_filters -> 'interests')))
      and (p_filters ->> 'sport' is null or (p_filters ->> 'sport') = any (c.sports))
      and (p_filters ->> 'language' is null or ((p_filters ->> 'language') = any (c.languages) and not 'languages' = any (c.hidden_fields)))
      and (p_filters ->> 'goal' is null or (p_filters ->> 'goal') = any (c.goals))
      and (p_filters ->> 'area' is null or ((p_filters ->> 'area') = any (c.areas) and not 'areas' = any (c.hidden_fields)))
      and (p_filters ->> 'availability' is null or (p_filters ->> 'availability') = any (c.availability))
      and (p_filters ->> 'community_id' is null or exists (
        select 1 from public.community_members cm where cm.user_id = c.user_id and cm.community_id = (p_filters ->> 'community_id')::uuid))
      and (coalesce((p_filters ->> 'travel')::boolean, false) = false or cardinality(c.travel) > 0)
      and (p_filters ->> 'age_min' is null or c.page >= (p_filters ->> 'age_min')::integer)
      and (p_filters ->> 'age_max' is null or c.page <= (p_filters ->> 'age_max')::integer)
      and case section
        when 'new' then coalesce(c.arrived_at, c.pcreated::date) >= current_date - 60
        when 'active' then c.show_active and c.last_active_at > now() - interval '15 minutes'
        when 'nearby' then c.areas && me_profile.areas and not 'areas' = any (c.hidden_fields)
        when 'interests' then c.interests && me_profile.interests
        when 'sports' then c.sports && me_profile.sports
        when 'travel' then cardinality(c.travel) > 0
        else c.pcity = my_city
      end
  ),
  scored as (
    select f.*, s.score as sc, s.reasons as rs
    from filtered f, lateral private.match_score(me, f.user_id) s
  )
  select
    sc.user_id,
    sc.fname,
    case when 'age' = any (sc.hidden_fields) then null else sc.page end,
    sc.pcity,
    sc.bio,
    sc.photo_paths,
    sc.interests,
    sc.sports,
    sc.activities,
    sc.goals,
    case when 'languages' = any (sc.hidden_fields) then '{}'::text[] else sc.languages end,
    case when 'areas' = any (sc.hidden_fields) then '{}'::text[] else sc.areas end,
    sc.travel,
    sc.show_active and sc.last_active_at > now() - interval '15 minutes',
    coalesce(sc.arrived_at, sc.pcreated::date) >= current_date - 60,
    sc.is_saved,
    sc.sc,
    -- Never reveal which hidden fields matched.
    case when 'areas' = any (sc.hidden_fields) then sc.rs - 'areas' else sc.rs end
  from scored sc
  where sc.sc >= (select min_score from public.irly_match_config where id = 1)
  order by sc.sc desc, sc.last_active_at desc
  limit lim offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Like, pass or save. A like that meets a like becomes a match, with its
-- private chat and conversation starters, in one transaction. Idempotent:
-- liking twice or racing a mutual like never creates two matches or chats.
create or replace function public.irly_match_act(p_target uuid, p_action text)
returns table (match_id uuid, conversation_id uuid, score integer, reasons jsonb)
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  a uuid := least(me, p_target);
  b uuid := greatest(me, p_target);
  m public.irly_matches;
  conv uuid;
  sc integer;
  rs jsonb;
  starter text;
begin
  if p_action not in ('like', 'pass', 'save', 'unsave') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if p_target = me then
    raise exception 'cannot act on yourself' using errcode = '22023';
  end if;
  if not private.is_girl_eligible(p_target) or private.is_blocked(me, p_target)
     or not exists (select 1 from public.irly_match_profiles where irly_match_profiles.user_id = p_target and visible) then
    raise exception 'profile not available' using errcode = 'P0002';
  end if;

  if p_action = 'unsave' then
    delete from public.irly_match_actions where actor_id = me and target_id = p_target and action = 'save';
    return;
  end if;
  if p_action = 'save' then
    insert into public.irly_match_actions (actor_id, target_id, action) values (me, p_target, 'save') on conflict do nothing;
    return;
  end if;

  -- Changing your mind replaces the previous decision.
  delete from public.irly_match_actions where actor_id = me and target_id = p_target and action in ('like', 'pass') and action <> p_action;
  insert into public.irly_match_actions (actor_id, target_id, action) values (me, p_target, p_action) on conflict do nothing;

  if p_action <> 'like' or not exists (
    select 1 from public.irly_match_actions where actor_id = p_target and target_id = me and action = 'like'
  ) then
    return;
  end if;

  select s.score, s.reasons into sc, rs from private.match_score(a, b) s;
  insert into public.irly_matches (user_a, user_b, score, reasons) values (a, b, sc, rs)
  on conflict (user_a, user_b) do update set removed_at = null, removed_by = null
    where irly_matches.removed_at is not null
  returning * into m;
  if m.id is null then
    -- Already matched: nothing new.
    select * into m from public.irly_matches where user_a = a and user_b = b and removed_at is null;
    if m.id is null then
      return;
    end if;
    select c.id into conv from public.conversations c where c.match_id = m.id;
    return query select m.id, conv, m.score::integer, m.reasons;
    return;
  end if;

  conv := private.ensure_conversation('match', m.id, null);
  insert into public.conversation_members (conversation_id, user_id) values (conv, a), (conv, b) on conflict do nothing;

  -- Conversation starters from what they actually share.
  if not exists (select 1 from public.messages where messages.conversation_id = conv) then
    starter := case
      when jsonb_array_length(m.reasons -> 'sports') > 0 then 'You both love ' || (m.reasons -> 'sports' ->> 0) || ' 👀'
      when jsonb_array_length(m.reasons -> 'activities') > 0 then 'You both like ' || (m.reasons -> 'activities' ->> 0) || '.'
      when jsonb_array_length(m.reasons -> 'travel') > 0 then 'You both love travelling ✈️'
      when jsonb_array_length(m.reasons -> 'interests') > 0 then 'You both are into ' || (m.reasons -> 'interests' ->> 0) || '.'
      else 'You both want to meet new people.'
    end;
    insert into public.messages (conversation_id, sender_id, kind, body) values
      (conv, null, 'system', 'It''s an IRLY match. Say hello!'),
      (conv, null, 'starter', starter),
      (conv, null, 'starter', 'Want to grab coffee or create an activity together?');
  end if;

  perform private.notify(a, 'MATCH_CREATED', jsonb_build_object('match_id', m.id, 'conversation_id', conv, 'with', b));
  perform private.notify(b, 'MATCH_CREATED', jsonb_build_object('match_id', m.id, 'conversation_id', conv, 'with', a));
  return query select m.id, conv, m.score::integer, m.reasons;
end $$;

-- Your matches, newest first, with the other person's visible card.
create or replace function public.irly_my_matches()
returns table (match_id uuid, conversation_id uuid, user_id uuid, first_name text, photo_paths text[], score integer, reasons jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, c.id, other.id, other.first_name, coalesce(mp.photo_paths, '{}'), m.score::integer, m.reasons, m.created_at
  from public.irly_matches m
  cross join lateral (select case when m.user_a = private.require_match_access() then m.user_b else m.user_a end as oid) o
  join public.profiles other on other.id = o.oid and other.deleted_at is null
  left join public.irly_match_profiles mp on mp.user_id = other.id
  left join public.conversations c on c.match_id = m.id
  where auth.uid() in (m.user_a, m.user_b)
    and m.removed_at is null
    and not private.is_blocked(m.user_a, m.user_b)
  order by m.created_at desc
$$;

-- Unmatch: the match disappears for both and the private chat closes.
create or replace function public.irly_unmatch(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := private.require_match_access();
  m public.irly_matches;
begin
  update public.irly_matches set removed_at = now(), removed_by = me
  where id = p_match and me in (user_a, user_b) and removed_at is null
  returning * into m;
  if m.id is null then
    return;
  end if;
  delete from public.conversation_members cm using public.conversations c
  where c.id = cm.conversation_id and c.match_id = m.id;
  -- Unmatching also withdraws the like, so the pair does not re-match by itself.
  delete from public.irly_match_actions where actor_id = me and target_id = case when m.user_a = me then m.user_b else m.user_a end and action = 'like';
  perform private.notify(case when m.user_a = me then m.user_b else m.user_a end, 'MATCH_REMOVED', jsonb_build_object('match_id', m.id));
end $$;

-- Block: hides both people from each other everywhere and ends any match.
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  select id into mid from public.irly_matches where user_a = least(me, p_target) and user_b = greatest(me, p_target) and removed_at is null;
  if mid is not null then
    update public.irly_matches set removed_at = now(), removed_by = me where id = mid;
    delete from public.conversation_members cm using public.conversations c where c.id = cm.conversation_id and c.match_id = mid;
  end if;
  delete from public.irly_match_actions where (actor_id = me and target_id = p_target) or (actor_id = p_target and target_id = me);
end $$;

create or replace function public.unblock_user(p_target uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = p_target
$$;

revoke all on function
  public.irly_match_state(), public.complete_irly_match_onboarding(), public.irly_match_ping(),
  public.irly_match_discover(jsonb, integer, integer), public.irly_match_act(uuid, text),
  public.irly_my_matches(), public.irly_unmatch(uuid), public.block_user(uuid), public.unblock_user(uuid)
from public, anon;
grant execute on function
  public.irly_match_state(), public.complete_irly_match_onboarding(), public.irly_match_ping(),
  public.irly_match_discover(jsonb, integer, integer), public.irly_match_act(uuid, text),
  public.irly_my_matches(), public.irly_unmatch(uuid), public.block_user(uuid), public.unblock_user(uuid)
to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_admin(uuid), private.is_girl_eligible(uuid), private.is_blocked(uuid, uuid),
  private.is_member(uuid, uuid), private.shares_conversation(uuid, uuid), private.assert_self(uuid[]),
  private.girl_eligible_unchecked(uuid), private.blocked_unchecked(uuid, uuid), private.shares_unchecked(uuid, uuid) to authenticated;

-- ===== supabase/migrations/20261005000200_irly_platform.sql =====
-- Supabase platform wiring: realtime events and photo storage.
-- Guarded so the same migrations also run on plain PostgreSQL (tests).

-- Realtime: the app reacts to these without refreshing
-- (MESSAGE_CREATED, MATCH_CREATED, notifications, activity joins).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.irly_matches, public.notifications,
      public.activity_participants, public.conversation_members;
  end if;
end $$;

-- Photos. Paths are "<user id>/<file>". Profile photos are visible to
-- signed-in members; IRLY Match photos only to IRLY Girl members.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
      ('match-photos', 'match-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
      ('irl-media', 'irl-media', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
    on conflict (id) do nothing;

    execute $p$
      create policy photos_own_write on storage.objects for insert to authenticated
      with check (bucket_id in ('profile-photos', 'match-photos', 'irl-media') and (storage.foldername(name))[1] = auth.uid()::text
        and (bucket_id <> 'match-photos' or private.is_girl_eligible(auth.uid())))
    $p$;
    execute $p$
      create policy photos_own_delete on storage.objects for delete to authenticated
      using (bucket_id in ('profile-photos', 'match-photos', 'irl-media') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy profile_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'profile-photos')
    $p$;
    execute $p$
      create policy match_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'match-photos' and private.is_girl_eligible(auth.uid()))
    $p$;
    execute $p$
      create policy irl_media_read on storage.objects for select to authenticated
      using (bucket_id = 'irl-media')
    $p$;
  end if;
end $$;

-- ===== supabase/migrations/20261005000300_irly_account.sql =====
-- Account deletion from the app (App Store requirement). Deleting the auth
-- user cascades to the profile and everything that references it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ===== supabase/migrations/20261005000400_irly_social.sql =====
-- Communities created by members, the inbox, read state.

-- Create a community: the creator becomes its owner and is in its chat.
create or replace function public.create_community(
  p_name text,
  p_city text,
  p_tagline text default null,
  p_description text default null,
  p_category text default null,
  p_girl_only boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  conv uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_girl_only and not private.is_girl_eligible(me) then
    raise exception 'only IRLY Girl members can create a girls-only community' using errcode = '42501';
  end if;
  if (select count(*) from public.communities where created_by = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'you can create up to 3 communities a day' using errcode = 'P0001';
  end if;
  insert into public.communities (city_id, name, tagline, description, category_id, girl_only, created_by)
  values (p_city, trim(p_name), nullif(trim(p_tagline), ''), nullif(trim(p_description), ''), p_category, p_girl_only, me)
  returning id into cid;
  insert into public.community_members (community_id, user_id, role) values (cid, me, 'owner');
  conv := private.ensure_conversation('community', cid, trim(p_name));
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'admin');
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, null, 'system', 'Welcome to ' || trim(p_name) || '! Introduce yourself and plan the first meetup.');
  return cid;
end $$;

-- The inbox: every conversation you are in, with its last message, unread
-- count and, for one-to-one chats, the other person's name.
create or replace function public.my_conversations()
returns table (
  conversation_id uuid,
  kind text,
  title text,
  other_user_id uuid,
  other_name text,
  last_body text,
  last_sender uuid,
  last_at timestamptz,
  unread integer,
  ref_id uuid
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and (x.sender_id is distinct from auth.uid())
         and x.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz)),
    coalesce(c.activity_id, c.community_id, c.match_id)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select p.id, p.first_name from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by coalesce(lm.created_at, c.created_at) desc
$$;

create or replace function public.mark_conversation_read(p_conversation uuid) returns void
language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid()
$$;

revoke all on function public.create_community(text, text, text, text, text, boolean), public.my_conversations(),
  public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.create_community(text, text, text, text, text, boolean), public.my_conversations(),
  public.mark_conversation_read(uuid) to authenticated;

