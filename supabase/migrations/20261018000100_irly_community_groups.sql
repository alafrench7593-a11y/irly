-- Communities v2: sub-groups, roles, pinned posts, announcements.
--
-- Additive only; existing communities, posts and members are untouched.
-- 1. Sub-groups: a community can hold topic groups (IRLY Sport → Padel).
--    A sub-group is a community row with parent_id: its own members, posts,
--    chat and comments, reusing everything communities already have. It
--    keeps its parent's city and women-only rule; joining it joins the
--    parent; leaving the parent leaves its groups. Parent moderators also
--    moderate the groups. IRLY's official groups are rows (community_subtopics).
-- 2. Roles: IRLY admins (profiles.is_admin) and a community's owner name
--    moderators; members are listed for them by community_people().
-- 3. Pinned posts: moderators and admins pin up to 10 posts per community.
-- 4. Announcements: moderators and admins notify every member of a community
--    or group (push + in-app), at most 3 a day, one per hour, never the same
--    text twice in a week. Each member can turn off a community's posts or
--    announcements (community_notification_prefs).
-- 5. Posts get a kind (post, question, recommendation, announcement) and an
--    optional category, used by Help & Questions and the special spaces.

-- ───────── 0. Who is an IRLY admin (for the app's own menus) ─────────
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid())
$$;
revoke all on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- ───────── 1. Sub-groups ─────────
alter table public.communities add column if not exists parent_id uuid references public.communities (id) on delete cascade;
alter table public.communities add column if not exists subtopic text check (subtopic is null or subtopic ~ '^[a-z][a-z0-9_]{1,30}$');
alter table public.communities add column if not exists emoji text;
create index if not exists communities_parent_idx on public.communities (parent_id) where parent_id is not null;
create unique index if not exists communities_parent_subtopic on public.communities (parent_id, subtopic) where subtopic is not null and deleted_at is null;

-- A group sits directly under a top community, in its city, with its rule.
create or replace function private.subgroup_shape() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  p public.communities;
begin
  if tg_op = 'UPDATE' and new.parent_id is distinct from old.parent_id and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'a group cannot move' using errcode = '42501';
  end if;
  if new.parent_id is null then return new; end if;
  select * into p from public.communities where id = new.parent_id;
  if not found or p.parent_id is not null then
    raise exception 'a group belongs to a top community' using errcode = '22023';
  end if;
  new.city_id := p.city_id;
  new.girl_only := p.girl_only;
  return new;
end $$;
drop trigger if exists communities_subgroup_shape on public.communities;
create trigger communities_subgroup_shape before insert or update of parent_id, city_id, girl_only on public.communities
for each row execute function private.subgroup_shape();

-- Joining a group joins its community; leaving a community leaves its groups.
create or replace function private.sync_subgroup_members() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  parent uuid;
begin
  if tg_op = 'INSERT' then
    select parent_id into parent from public.communities where id = new.community_id;
    if parent is not null then
      insert into public.community_members (community_id, user_id) values (parent, new.user_id) on conflict do nothing;
    end if;
    return null;
  end if;
  delete from public.community_members m using public.communities c
  where c.parent_id = old.community_id and m.community_id = c.id and m.user_id = old.user_id and m.role <> 'owner';
  return null;
end $$;
drop trigger if exists community_members_subgroups on public.community_members;
create trigger community_members_subgroups after insert or delete on public.community_members
for each row execute function private.sync_subgroup_members();

-- Moderators of a community also moderate its groups.
create or replace function private.moderates(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid()) or exists (
    select 1 from public.community_members m
    where m.user_id = auth.uid() and m.role in ('owner', 'moderator')
      and m.community_id in (cid, (select parent_id from public.communities where id = cid))
  )
$$;
grant execute on function private.moderates(uuid) to authenticated;

-- Top-level lists stay as they were: groups show inside their community.
drop function if exists public.community_list(text);
create function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
  order by (c.city_id = p_city) desc, 8 desc, 6 desc, c.name
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- IRLY's own groups: rows, like topics. Added to every official community of the topic.
create table if not exists public.community_subtopics (
  parent_topic text not null references public.community_topics (topic) on delete cascade,
  subtopic text not null check (subtopic ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  tagline text not null default '',
  emoji text not null default '',
  sort integer not null default 100,
  active boolean not null default true,
  primary key (parent_topic, subtopic)
);
alter table public.community_subtopics enable row level security;
drop policy if exists community_subtopics_read on public.community_subtopics;
create policy community_subtopics_read on public.community_subtopics for select to authenticated using (active);

-- A community's groups, most active first.
create or replace function public.community_subgroups(p_parent uuid)
returns table (id uuid, name text, tagline text, emoji text, members integer, is_member boolean, posts_week integer, last_post_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select c.id, c.name, c.tagline, c.emoji,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    (select max(p.created_at) from public.community_posts p where p.community_id = c.id and p.deleted_at is null)
  from public.communities c
  left join public.community_subtopics s on s.parent_topic = (select topic from public.communities where id = p_parent) and s.subtopic = c.subtopic
  where c.parent_id = p_parent and c.deleted_at is null
  order by coalesce(s.sort, 1000), c.name
$$;
grant execute on function public.community_subgroups(uuid) to authenticated;
revoke all on function public.community_subgroups(uuid) from anon;

create or replace function private.ensure_official_subgroups() returns integer
language plpgsql security definer set search_path = public as $$
declare
  s public.community_subtopics;
  p public.communities;
  cid uuid;
  conv uuid;
  made integer := 0;
begin
  for s in select * from public.community_subtopics where active order by sort loop
    for p in select * from public.communities where official and topic = s.parent_topic and deleted_at is null and parent_id is null loop
      select id into cid from public.communities where parent_id = p.id and subtopic = s.subtopic and deleted_at is null;
      if cid is null then
        insert into public.communities (city_id, name, tagline, category_id, girl_only, created_by, official, parent_id, subtopic, emoji)
        values (p.city_id, s.name, nullif(s.tagline, ''), p.category_id, p.girl_only, null, true, p.id, s.subtopic, nullif(s.emoji, ''))
        returning id into cid;
        conv := private.ensure_conversation('community', cid, s.name);
        insert into public.messages (conversation_id, sender_id, kind, body)
        values (conv, null, 'system', 'Welcome to ' || s.name || ' 👋 Share tips, ask questions and plan things together.');
        made := made + 1;
      else
        update public.communities set name = s.name, tagline = nullif(s.tagline, ''), emoji = nullif(s.emoji, '')
        where id = cid and (name <> s.name or tagline is distinct from nullif(s.tagline, '') or emoji is distinct from nullif(s.emoji, ''));
      end if;
      cid := null;
    end loop;
  end loop;
  return made;
end $$;
revoke all on function private.ensure_official_subgroups() from public, anon, authenticated;

-- A new official top community for lifestyle (restaurants, shopping, wellness, good addresses).
insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort) values
  ('lifestyle', 'IRLY Lifestyle', 'Restaurants, shopping, wellness and the city''s best addresses.', '✨',
    '{}', '{dubai,abudhabi}', false, false, 23)
on conflict (topic) do nothing;
select private.ensure_official_communities();

insert into public.community_subtopics (parent_topic, subtopic, name, tagline, emoji, sort) values
  ('sport', 'padel', 'Padel', 'Find partners, courts and games.', '🎾', 1),
  ('sport', 'fitness', 'Fitness', 'Gyms, classes and training buddies.', '💪', 2),
  ('sport', 'running', 'Running', 'Runs, routes and race days.', '🏃', 3),
  ('sport', 'yoga', 'Yoga', 'Classes, studios and sunrise sessions.', '🧘', 4),
  ('sport', 'football', 'Football', 'Five-a-side, leagues and match nights.', '⚽', 5),
  ('sport', 'water', 'Water sports', 'Paddle, kite, surf, dive and sail.', '🌊', 6),
  ('network', 'entrepreneurs', 'Entrepreneurs', 'Founders sharing what works.', '🚀', 1),
  ('network', 'startups', 'Startups', 'Building, hiring and raising in the region.', '💡', 2),
  ('network', 'networking', 'Networking', 'Events, intros and coffee meetings.', '🤝', 3),
  ('network', 'investing', 'Investing', 'Markets, property and angel investing.', '📈', 4),
  ('network', 'careers', 'Careers & jobs', 'Jobs, hiring and career advice.', '💼', 5),
  ('lifestyle', 'restaurants', 'Restaurants & cafés', 'New openings, brunches and favourite spots.', '🍽️', 1),
  ('lifestyle', 'shopping', 'Shopping', 'Malls, markets and where to find things.', '🛍️', 2),
  ('lifestyle', 'wellbeing', 'Wellbeing', 'Spas, beauty and feeling good.', '🌿', 3),
  ('lifestyle', 'addresses', 'Good addresses', 'Trusted places and people, recommended by members.', '📍', 4),
  ('nights', 'bars', 'Bars & nightlife', 'Where to go out tonight.', '🍸', 1),
  ('nights', 'beachclubs', 'Beach clubs', 'Day passes, pools and sunsets.', '🏝️', 2),
  ('nights', 'parties', 'Parties', 'Parties and nights out together.', '🎉', 3),
  ('nights', 'concerts', 'Concerts & events', 'Gigs, festivals and shows.', '🎤', 4),
  ('trip', 'excursions', 'Excursions', 'Day trips, desert and mountains.', '🏜️', 1),
  ('trip', 'grouptrips', 'Group trips', 'Travel together, share the plan.', '🧳', 2),
  ('trip', 'weekends', 'Weekends', 'Short breaks and staycations.', '🗓️', 3),
  ('trip', 'emirates', 'Discover the Emirates', 'All seven emirates, one trip at a time.', '🇦🇪', 4),
  ('newcomers', 'arrivals', 'New arrivals', 'Just landed? Say hello.', '🛬', 1),
  ('newcomers', 'tips', 'Practical tips', 'Phone, bank, transport, the first weeks.', '🧭', 2),
  ('newcomers', 'meet', 'Meet people', 'Coffees and first plans with other newcomers.', '☕', 3),
  ('newcomers', 'settling', 'Settling in', 'Housing, areas and getting set up.', '🏠', 4)
on conflict (parent_topic, subtopic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji, sort = excluded.sort;

select private.ensure_official_subgroups();

-- Owners, moderators and admins add a group to their community.
create or replace function public.create_subgroup(p_parent uuid, p_name text, p_tagline text default null, p_emoji text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p public.communities;
  cid uuid;
  conv uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into p from public.communities where id = p_parent and deleted_at is null and parent_id is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not private.moderates(p_parent) then raise exception 'only the community''s moderators can add a group' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 60 then raise exception 'name: 2 to 60 characters' using errcode = '22023'; end if;
  if (select count(*) from public.communities where parent_id = p_parent and deleted_at is null) >= 30 then
    raise exception 'a community has 30 groups at most' using errcode = 'P0001';
  end if;
  insert into public.communities (city_id, name, tagline, category_id, girl_only, created_by, official, parent_id, emoji)
  values (p.city_id, btrim(p_name), nullif(btrim(coalesce(p_tagline, '')), ''), p.category_id, p.girl_only, auth.uid(), p.official and private.is_admin(auth.uid()), p.id, nullif(btrim(coalesce(p_emoji, '')), ''))
  returning id into cid;
  conv := private.ensure_conversation('community', cid, btrim(p_name));
  insert into public.community_members (community_id, user_id, role) values (cid, auth.uid(), 'moderator') on conflict do nothing;
  return cid;
end $$;
revoke all on function public.create_subgroup(uuid, text, text, text) from public, anon;
grant execute on function public.create_subgroup(uuid, text, text, text) to authenticated;

-- ───────── 2. Roles ─────────
-- Members of a community with their role, for its moderators and IRLY admins.
create or replace function public.community_people(p_community uuid, p_query text default null)
returns table (user_id uuid, first_name text, photo_path text, role text, joined_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.moderates(p_community) then raise exception 'moderators only' using errcode = '42501'; end if;
  return query
    select m.user_id, p.first_name, p.photo_paths[1], m.role, m.joined_at
    from public.community_members m
    join public.profiles p on p.id = m.user_id and p.deleted_at is null
    where m.community_id = p_community
      and (p_query is null or p.first_name ilike '%' || p_query || '%')
    order by case m.role when 'owner' then 0 when 'moderator' then 1 else 2 end, p.first_name
    limit 200;
end $$;
revoke all on function public.community_people(uuid, text) from public, anon;
grant execute on function public.community_people(uuid, text) to authenticated;

-- The owner (or an IRLY admin) names or removes a moderator.
create or replace function public.set_community_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  parent uuid;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_role not in ('moderator', 'member') then raise exception 'role: moderator or member' using errcode = '22023'; end if;
  select parent_id into parent from public.communities where id = p_community and deleted_at is null;
  if not (private.is_admin(me) or exists (
    select 1 from public.community_members where user_id = me and role = 'owner' and community_id in (p_community, parent)
  )) then
    raise exception 'only the owner or IRLY can change roles' using errcode = '42501';
  end if;
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  update public.community_members set role = p_role where community_id = p_community and user_id = p_user and role <> 'owner';
end $$;
revoke all on function public.set_community_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_community_role(uuid, uuid, text) to authenticated;

-- ───────── 3. Pinned posts ─────────
create table if not exists public.community_pins (
  post_id uuid primary key references public.community_posts (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  pinned_by uuid references public.profiles (id) on delete set null,
  pinned_at timestamptz not null default now()
);
create index if not exists community_pins_idx on public.community_pins (community_id, pinned_at desc);
alter table public.community_pins enable row level security;
drop policy if exists community_pins_read on public.community_pins;
create policy community_pins_read on public.community_pins for select to authenticated
  using (exists (select 1 from public.community_posts p where p.id = post_id));

create or replace function public.pin_post(p_post uuid, p_on boolean default true) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select community_id into cid from public.community_posts where id = p_post and deleted_at is null;
  if cid is null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not private.moderates(cid) then raise exception 'only moderators can pin' using errcode = '42501'; end if;
  if not p_on then
    delete from public.community_pins where post_id = p_post;
    return false;
  end if;
  if not exists (select 1 from public.community_pins where post_id = p_post)
     and (select count(*) from public.community_pins where community_id = cid) >= 10 then
    raise exception 'unpin a post first: 10 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.community_pins (post_id, community_id, pinned_by) values (p_post, cid, auth.uid())
  on conflict (post_id) do update set pinned_at = now(), pinned_by = auth.uid();
  return true;
end $$;
revoke all on function public.pin_post(uuid, boolean) from public, anon;
grant execute on function public.pin_post(uuid, boolean) to authenticated;

-- ───────── 5. Kinds of posts ─────────
alter table public.community_posts add column if not exists kind text not null default 'post'
  check (kind in ('post', 'question', 'recommendation', 'announcement'));
alter table public.community_posts add column if not exists category text check (category is null or category ~ '^[a-z][a-z0-9_]{1,30}$');
-- Announcements only come from moderators (through announce()).
create or replace function private.post_kind_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.kind = 'announcement' and (tg_op = 'INSERT' or old.kind is distinct from 'announcement')
     and auth.uid() is not null and not (new.community_id is not null and private.moderates(new.community_id)) then
    raise exception 'only moderators post announcements' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists community_posts_kind_guard on public.community_posts;
create trigger community_posts_kind_guard before insert or update of kind on public.community_posts
for each row execute function private.post_kind_guard();

-- ───────── 4. Announcements ─────────
create table if not exists public.community_broadcasts (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'announcement' check (kind in ('announcement', 'event', 'info')),
  body text not null check (char_length(body) between 3 and 500),
  post_id uuid references public.community_posts (id) on delete set null,
  recipients integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_broadcasts_idx on public.community_broadcasts (community_id, created_at desc);
alter table public.community_broadcasts enable row level security;
drop policy if exists community_broadcasts_read on public.community_broadcasts;
create policy community_broadcasts_read on public.community_broadcasts for select to authenticated
  using (private.moderates(community_id));

-- What the signed-in member may do in a community (the app shows the matching tools).
create or replace function public.community_rights(p_community uuid)
returns table (is_admin boolean, can_moderate boolean, is_owner boolean, announcements_today integer, next_announcement_at timestamptz)
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid()),
    private.moderates(p_community),
    private.is_admin(auth.uid()) or exists (
      select 1 from public.community_members where user_id = auth.uid() and role = 'owner'
        and community_id in (p_community, (select parent_id from public.communities where id = p_community))),
    (select count(*)::int from public.community_broadcasts b where b.community_id = p_community and b.created_at > now() - interval '1 day'),
    (select max(b.created_at) + interval '1 hour' from public.community_broadcasts b where b.community_id = p_community and b.created_at > now() - interval '1 hour')
$$;

create table if not exists public.community_notification_prefs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete cascade,
  posts boolean not null default true,
  announcements boolean not null default true,
  primary key (user_id, community_id)
);
alter table public.community_notification_prefs enable row level security;
drop policy if exists community_notification_prefs_self on public.community_notification_prefs;
create policy community_notification_prefs_self on public.community_notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'MATCH_CREATED', 'MATCH_REMOVED', 'MESSAGE_CREATED', 'ACTIVITY_CREATED', 'ACTIVITY_JOINED',
  'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER', 'ACTIVITY_UPDATED', 'COMMUNITY_JOINED', 'COMMUNITY_INVITATION',
  'COMMUNITY_POST', 'MATCH_SUGGESTION', 'IRLY_POST_CREATED', 'PROFILE_UPDATED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
  'LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION', 'SHARE', 'AI_ACTION', 'PRO_CONNECT_REQUEST', 'PRO_CONNECT_ACCEPTED',
  'NEW_FOLLOWER', 'GROUP_ADDED', 'COMMUNITY_ANNOUNCEMENT'
));

-- Muted kinds, a community turned off, and blocks: dropped before anyone is notified.
create or replace function private.notification_filter() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid;
  cid uuid;
begin
  if exists (select 1 from public.notification_prefs p where p.user_id = new.user_id and new.kind = any (p.muted_kinds)) then
    return null;
  end if;
  if new.kind in ('COMMUNITY_POST', 'COMMUNITY_ANNOUNCEMENT') then
    cid := private.uuid_or_null(new.payload ->> 'community_id');
    if cid is not null and exists (
      select 1 from public.community_notification_prefs c where c.user_id = new.user_id and c.community_id = cid
        and ((new.kind = 'COMMUNITY_POST' and not c.posts) or (new.kind = 'COMMUNITY_ANNOUNCEMENT' and not c.announcements))
    ) then
      return null;
    end if;
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

-- Announcement posts notify through announce() only (never twice).
create or replace function private.on_community_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cname text;
begin
  if new.community_id is null or new.kind = 'announcement' then return new; end if;
  select name into cname from public.communities where id = new.community_id;
  insert into public.notifications (user_id, kind, payload)
  select m.user_id, 'COMMUNITY_POST',
    jsonb_build_object('from', new.author_id, 'community_id', new.community_id, 'post_id', new.id, 'community', cname, 'body', left(new.body, 80))
  from public.community_members m
  where m.community_id = new.community_id and m.user_id <> new.author_id;
  return new;
end $$;

-- A moderator's announcement: a pinned-able post in the community plus one
-- notification per member (their preferences apply), within the limits.
create or replace function public.announce(p_community uuid, p_body text, p_kind text default 'announcement', p_pin boolean default false)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c public.communities;
  v_body text := btrim(coalesce(p_body, ''));
  pid uuid;
  sent integer;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not private.moderates(p_community) then raise exception 'only moderators can notify all members' using errcode = '42501'; end if;
  if p_kind not in ('announcement', 'event', 'info') then raise exception 'kind: announcement, event or info' using errcode = '22023'; end if;
  if char_length(v_body) not between 3 and 500 then raise exception 'write 3 to 500 characters' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('announce:' || p_community::text, 0));
  if exists (select 1 from public.community_broadcasts where community_id = p_community and created_at > now() - interval '1 hour') then
    raise exception 'one announcement per hour: try again later' using errcode = 'P0001';
  end if;
  if (select count(*) from public.community_broadcasts where community_id = p_community and created_at > now() - interval '1 day') >= 3 then
    raise exception 'three announcements a day at most' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.community_broadcasts b where b.community_id = p_community and lower(b.body) = lower(v_body) and created_at > now() - interval '7 days') then
    raise exception 'this announcement was already sent this week' using errcode = 'P0001';
  end if;
  insert into public.community_posts (community_id, author_id, body, kind)
  values (p_community, me, v_body, 'announcement') returning id into pid;
  if p_pin then
    insert into public.community_pins (post_id, community_id, pinned_by) values (pid, p_community, me) on conflict do nothing;
  end if;
  insert into public.notifications (user_id, kind, payload)
  select m.user_id, 'COMMUNITY_ANNOUNCEMENT',
    jsonb_build_object('from', me, 'community_id', p_community, 'post_id', pid, 'community', c.name, 'body', left(v_body, 140), 'type', p_kind)
  from public.community_members m
  where m.community_id = p_community and m.user_id <> me;
  get diagnostics sent = row_count;
  insert into public.community_broadcasts (community_id, sender_id, kind, body, post_id, recipients)
  values (p_community, me, p_kind, v_body, pid, sent);
  return sent;
end $$;
revoke all on function public.announce(uuid, text, text, boolean) from public, anon;
grant execute on function public.announce(uuid, text, text, boolean) to authenticated;
revoke all on function public.community_rights(uuid) from public, anon;
grant execute on function public.community_rights(uuid) to authenticated;

-- ───────── Feed: pinned first, with kinds ─────────
drop function if exists public.community_feed(uuid, integer, timestamptz);
create function public.community_feed(p_community uuid, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text, activity_starts_at timestamptz,
  poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer, liked boolean, created_at timestamptz, mine boolean,
  media_paths text[], media_kind text, thumb_path text, media_seconds integer, edited_at timestamptz,
  kind text, category text, pinned_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at,
    p.kind, p.category, pin.pinned_at
  from public.community_posts p
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  left join public.community_pins pin on pin.post_id = p.id
  where p.community_id = p_community and p.deleted_at is null
    and (p_before is null or p.created_at < p_before)
    -- Pinned posts come first on the first page only.
    and (p_before is null or pin.post_id is null)
  order by (pin.post_id is not null and p_before is null) desc, pin.pinned_at desc nulls last, p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.community_feed(uuid, integer, timestamptz) from public, anon;
grant execute on function public.community_feed(uuid, integer, timestamptz) to authenticated;

-- Push text for announcements (the rest unchanged).
create or replace function private.push_text(n public.notifications, lang text, out title text, out body text, out url text)
language plpgsql stable security definer set search_path = public as $$
declare
  fr boolean := lang = 'fr';
  who text;
  someone text := case when lang = 'fr' then 'Quelqu’un' else 'Someone' end;
  msg record;
begin
  select first_name into who from public.profiles where id = private.uuid_or_null(coalesce(n.payload ->> 'from', n.payload ->> 'user_id'));
  url := '/notifications';
  case n.kind
    when 'MESSAGE_CREATED' then
      select m.body, m.kind, p.first_name, c.title as conv into msg
      from public.messages m left join public.profiles p on p.id = m.sender_id left join public.conversations c on c.id = m.conversation_id
      where m.id = private.uuid_or_null(n.payload ->> 'message_id');
      title := coalesce(nullif(msg.conv, ''), msg.first_name, 'IRLY');
      body := case
        when msg.kind = 'photo' then coalesce(msg.first_name || ': ', '') || case when fr then '📷 Photo' else '📷 Photo' end
        when msg.body is not null then coalesce(case when msg.conv is not null then msg.first_name || ': ' end, '') || left(msg.body, 120)
        else case when fr then 'Nouveau message' else 'New message' end end;
      url := '/messages/' || coalesce(n.payload ->> 'conversation_id', '');
    when 'PRO_CONNECT_REQUEST' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' veut entrer en contact avec toi' else ' wants to connect with you' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'PRO_CONNECT_ACCEPTED' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande. Écris-lui !' else ' accepted your request. Say hi!' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'FRIEND_REQUEST' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end;
    when 'FRIEND_ACCEPTED' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end;
    when 'PROFILE_UPDATED' then
      title := 'IRLY';
      body := case n.payload ->> 'type'
        when 'friend_request' then coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end
        when 'friend_accepted' then coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end
        else case when fr then 'Ton profil a été mis à jour' else 'Your profile was updated' end end;
    when 'MATCH_CREATED' then
      title := 'IRLY Girl';
      body := case when fr then 'C’est un match ! Dis bonjour 👋' else 'It’s a match! Say hello 👋' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/girl' end;
    when 'ACTIVITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Quelqu’un a rejoint ton activité' else 'Someone joined your activity' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'ACTIVITY_UPDATED' then
      title := 'IRLY';
      body := case when fr then 'Une activité de ton agenda a changé' else 'An activity in your calendar changed' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'ACTIVITY_REMINDER' then
      title := 'IRLY';
      body := case when fr then 'Ton activité commence bientôt' else 'Your activity starts soon' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'LIKE' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a aimé ta publication' else ' liked your post' end;
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      title := 'IRLY';
      body := coalesce(who, someone) || case n.kind
        when 'COMMENT' then case when fr then ' a commenté' else ' commented' end
        when 'COMMENT_REPLY' then case when fr then ' t’a répondu' else ' replied to you' end
        else case when fr then ' t’a mentionné·e' else ' mentioned you' end end
        || coalesce(': ' || left(n.payload ->> 'body', 100), '');
    when 'IRLY_POST_CREATED' then
      title := 'IRL';
      body := coalesce(who, case when fr then 'Un·e ami·e' else 'A friend' end) || case when fr then ' est en live' else ' is live' end;
      url := '/live';
    when 'COMMUNITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Tu as rejoint une communauté. Son chat est dans Messages.' else 'You joined a community. Its chat is in Messages.' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'NEW_FOLLOWER' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' s’est abonné·e à toi' else ' started following you' end;
      url := case when n.payload ? 'from' then '/person/' || (n.payload ->> 'from') else '/notifications' end;
    when 'GROUP_ADDED' then
      title := coalesce(nullif(n.payload ->> 'title', ''), 'IRLY');
      body := coalesce(who, someone) || case when fr then ' t’a ajouté·e au groupe' else ' added you to the group' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'COMMUNITY_POST' then
      title := coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(who, someone) || ': ' || coalesce(left(n.payload ->> 'body', 100), case when fr then 'nouvelle publication' else 'new post' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    when 'COMMUNITY_ANNOUNCEMENT' then
      title := '📣 ' || coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(left(n.payload ->> 'body', 140), case when fr then 'Nouvelle annonce' else 'New announcement' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    else
      title := 'IRLY';
      body := case when fr then 'Tu as une nouvelle notification' else 'You have a new notification' end;
  end case;
end $$;
revoke all on function private.push_text(public.notifications, text) from public, anon, authenticated;
