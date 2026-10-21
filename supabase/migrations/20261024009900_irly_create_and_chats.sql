-- Creating communities and activities, and their chats (audit fixes).
-- Tests: supabase/tests/create_and_chats.test.sql.

-- ───────── 1. A community always has its owner and its one chat ─────────
-- A row inserted straight into the table (REST, around create_community) had
-- no owner (nobody could edit, moderate or delete it), no chat and a count
-- of 0. Its creator now becomes its owner whatever the road; the member
-- trigger (sync_community_chat) opens its one chat (unique community_id) and
-- makes her its admin, the count trigger counts her. create_community adds
-- the owner the same way, so its own insert no longer collides.
create or replace function private.community_owner_joins() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and new.created_by = auth.uid() and new.parent_id is null and not new.official then
    insert into public.community_members (community_id, user_id, role) values (new.id, new.created_by, 'owner')
    on conflict (community_id, user_id) do update set role = 'owner';
  end if;
  return null;
end $$;
revoke all on function private.community_owner_joins() from public, anon, authenticated;
drop trigger if exists communities_owner_joins on public.communities;
create trigger communities_owner_joins after insert on public.communities
  for each row execute function private.community_owner_joins();

create or replace function public.create_community(p_name text, p_city text, p_tagline text default null, p_description text default null, p_category text default null, p_girl_only boolean default false)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
  conv uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- A double tap (or a retried request) gets the community it already made.
  perform pg_advisory_xact_lock(hashtextextended('create_community:' || me::text, 0));
  select id into cid from public.communities
  where created_by = me and city_id = p_city and lower(name) = lower(trim(p_name)) and deleted_at is null
    and created_at > now() - interval '2 minutes'
  limit 1;
  if cid is not null then
    return cid;
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
  -- The owner joins (communities_owner_joins already did); the member trigger opens the chat and adds them as admin.
  insert into public.community_members (community_id, user_id, role) values (cid, me, 'owner')
  on conflict (community_id, user_id) do nothing;
  select id into conv from public.conversations where community_id = cid;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, null, 'system', 'Welcome to ' || trim(p_name) || '! Introduce yourself and plan the first meetup.');
  return cid;
end $$;
revoke all on function public.create_community(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.create_community(text, text, text, text, text, boolean) to authenticated;

-- ───────── 2. Blocking takes the blocked person out of the other's plans ─────────
-- join_activity already refuses someone blocked (either way), but a person
-- who joined before the block stayed in the plan and its chat. Upcoming plans
-- only (a past one stays in each one's history); the participant trigger
-- (sync_activity_chat) takes them out of its chat. An organiser is never
-- removed from her own plan.
create or replace function private.block_leaves_plans() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity_participants p
  using public.activities a
  where a.id = p.activity_id
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now()
    and ((a.creator_id = new.blocker_id and p.user_id = new.blocked_id)
      or (a.creator_id = new.blocked_id and p.user_id = new.blocker_id));
  return null;
end $$;
revoke all on function private.block_leaves_plans() from public, anon, authenticated;
drop trigger if exists blocks_leave_plans on public.blocks;
create trigger blocks_leave_plans after insert on public.blocks
  for each row execute function private.block_leaves_plans();

-- ───────── 3. Categories the app offers ─────────
-- activities.category_id has no foreign key, so a plan in any category is
-- accepted; the labels (search) still need each of the app's categories
-- (src/data/catalog/categories.ts). All exist today: kept that way.
insert into public.categories (id, label, sort) values
  ('sport', 'Sport', 1), ('networking', 'Networking', 2), ('food', 'Food & drinks', 3), ('travel', 'Travel', 4),
  ('outdoor', 'Outdoor', 5), ('shopping', 'Shopping', 6), ('culture', 'Culture', 7), ('entertainment', 'Entertainment', 8),
  ('nightlife', 'Nightlife', 9), ('wellness', 'Wellness', 10), ('animals', 'Animals', 11), ('family', 'Family', 12),
  ('creative', 'Creative', 13), ('learning', 'Learning', 14), ('outings', 'Outings', 15), ('cafes', 'Cafés', 16),
  ('beach', 'Beach', 17), ('games', 'Games', 18), ('experiences', 'Experiences', 19), ('communities', 'Communities', 20)
on conflict (id) do nothing;

-- ───────── 4. An activity's time zone is its city's ─────────
-- The instant (starts_at, timestamptz) is what counts; the timezone column
-- says how to read it. It came from the app (Asia/Dubai unless UTC+8), and a
-- row without one (REST, seed content) defaulted to Asia/Dubai even in Bali.
-- The server's own reading (private.city_tz) decides now, on every write.
create or replace function private.activity_timezone() returns trigger
language plpgsql set search_path = public as $$
begin
  new.timezone := private.city_tz(new.city_id);
  return new;
end $$;
revoke all on function private.activity_timezone() from public, anon, authenticated;
drop trigger if exists activities_timezone on public.activities;
create trigger activities_timezone before insert or update of city_id, timezone on public.activities
  for each row execute function private.activity_timezone();
update public.activities set timezone = private.city_tz(city_id) where timezone is distinct from private.city_tz(city_id);
