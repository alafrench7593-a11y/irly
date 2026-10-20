-- Creating communities and activities, and their chats (audit fixes).
-- Tests: supabase/tests/create_and_chats.test.sql.

-- ───────── 1. A community is created by create_community only ─────────
-- A row inserted straight into the table (REST, around the RPC) had no owner
-- (nobody could edit or delete it), no chat, no welcome, a count of 0 and
-- no 2-minute dedupe. create_community and create_subgroup run as the
-- server and do all of it; the app never inserts the row itself.
drop policy if exists communities_create on public.communities;

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
