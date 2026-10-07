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
