-- QA fixes, activities (qa/activities.md). Additive and idempotent: no table
-- or column is dropped, no row is removed by this migration, RLS is untouched
-- and no check is loosened.
--
-- ACT-01  The rate limits (20 activities a day, 30 messages a minute…) could
--         be passed with parallel requests: each count ran before the others
--         committed. One count at a time per member and table now.
-- ACT-02  A community's « Past » tab was empty: the purge removed every plan
--         2 to 6 hours after it ended, while the tab lists the last 60 days.
--         A community plan now stays for those 60 days (read through the same
--         rules as before: nothing new is visible to anyone), and its chat
--         still goes at the usual time (owner's decision of 2026-10-22), so
--         nothing is kept longer than before except the plan card itself.
--         Every other plan is purged exactly as before.
-- ACT-03  The « Anyone can join » plan of a Live was over after 2 hours and
--         purged after 6, while the Live stays up 24 hours: it now ends when
--         its Live ends.
-- ACT-04  The host could set herself « maybe » or « not going » on her own
--         plan (freeing her seat, then locked out by « full »): the host is
--         always going.
-- ACT-06  A cancelled plan could be « uncancelled » through the API (the app
--         has no such action): duplicated chat notice, re-cancel never told.
-- ACT-07  A host could move a plan into the past (API): the purge then took
--         it, its chat and the change notice without a word.
-- ACT-08  New plans: start more than an hour ago or over five years ahead, longer
--         than 31 days, a blank title, a made-up currency or category, an
--         absurd price were all accepted.
-- ACT-09  The cover photo of a removed plan, and the photos of its chat,
--         stayed in storage for ever: they are queued for the storage purge,
--         which deletes a file only once nothing points at it any more
--         (checked again when the job claims it). Reported content is kept.
-- ACT-10  Leaving a community (or being removed from it) kept you « going »
--         in its members-only plans, and in their chat.

-- ───────── ACT-01. Rate limits hold under parallel requests ─────────
-- Same limits and same answer; the count now waits for any insert of the same
-- member in the same table still in flight (lock held to the end of the
-- transaction, so the next count sees the row the previous one committed).
create or replace function private.rate_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  actor uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
  n integer;
begin
  if auth.uid() is null or actor is distinct from auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('irly-rate:' || tg_table_schema || '.' || tg_table_name || ':' || actor::text, 0));
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2::interval', tg_table_schema, tg_table_name, tg_argv[0])
    into n using actor, tg_argv[1];
  if n >= tg_argv[2]::integer then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  return new;
end $$;
revoke all on function private.rate_guard() from public, anon, authenticated;

-- ───────── ACT-09. A removed plan's files are queued for the storage purge ─────────
/**
 * Queues a member's file of a removed plan for the storage purge (reason
 * 'orphan'). The purge hands such a file out only once nothing points at it
 * (private.photo_in_use, checked when it claims it), so a file still used
 * elsewhere is never deleted. IRLY library links and odd paths are skipped.
 */
create or replace function private.queue_removed_file(p_bucket text, p_name text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if p_name is null or p_name !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    return;
  end if;
  insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
  values (p_bucket, p_name, split_part(p_name, '/', 1)::uuid, 'orphan')
  on conflict (bucket_id, name) do update
    set done_at = null, attempts = 0, last_error = null, claimed_at = null, flagged_at = null, queued_at = now()
    where q.done_at is not null;
end $$;
revoke all on function private.queue_removed_file(text, text) from public, anon, authenticated;

/** The photos of an activity chat about to go (reported messages keep theirs: the team may need them). */
create or replace function private.queue_activity_chat_media(p_activity uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  f text;
begin
  for f in
    select distinct m.media_path from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where c.activity_id = p_activity and m.media_path is not null
      and not exists (select 1 from public.reports r where r.target_kind = 'message' and r.target_id = m.id)
  loop
    perform private.queue_removed_file('chat-media', f);
  end loop;
end $$;
revoke all on function private.queue_activity_chat_media(uuid) from public, anon, authenticated;

-- Before the delete: the chat (and its messages) still exist to be read.
create or replace function private.activity_files_on_delete() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from public.reports r where r.target_kind in ('activity', 'event') and r.target_id = old.id) then
    perform private.queue_removed_file('activity-photos', old.cover_path);
  end if;
  perform private.queue_activity_chat_media(old.id);
  return old;
end $$;
revoke all on function private.activity_files_on_delete() from public, anon, authenticated;
drop trigger if exists activities_queue_files on public.activities;
create trigger activities_queue_files before delete on public.activities
  for each row execute function private.activity_files_on_delete();

-- ───────── ACT-02. Ended plans go; a community's stay for its « Past » tab ─────────
-- As before (20261029600000): a plan goes two hours after its end, or six
-- hours after its start without an end, with its chat, participants and
-- reminders. A plan of a community that exists stays until 60 days after
-- its start, as long as community_activities(p_past) lists it; only its chat
-- goes at the usual time. It is read through the same rules as any plan.
create or replace function private.purge_ended_activities(p_limit integer default 500)
returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  lim integer := greatest(1, least(coalesce(p_limit, 500), 5000));
  n integer;
  r record;
begin
  with gone as (
    select a.id from public.activities a
    where coalesce(a.ends_at, a.starts_at + interval '4 hours') < now() - interval '2 hours'
      and (a.starts_at < now() - interval '60 days'
           or not exists (select 1 from public.communities g where g.id = a.community_id and g.deleted_at is null))
    order by a.starts_at
    limit lim
  )
  delete from public.activities a using gone where a.id = gone.id;
  get diagnostics n = row_count;

  -- The kept community plans: their chat ends as every plan's does.
  for r in
    select c.id, c.activity_id from public.conversations c
    join public.activities a on a.id = c.activity_id
    where coalesce(a.ends_at, a.starts_at + interval '4 hours') < now() - interval '2 hours'
    order by a.starts_at
    limit lim
  loop
    perform private.queue_activity_chat_media(r.activity_id);
    delete from public.conversations where id = r.id;
  end loop;
  return n;
end $$;
revoke all on function private.purge_ended_activities(integer) from public, anon, authenticated;

-- ───────── ACT-03. A Live's plan lasts as long as the Live ─────────
-- post_live (and the older app's two-step save) inserts the plan, then the
-- Live pointing at it: the plan, made without an end, now ends when its Live
-- does, so it stays joinable while the Live shows « Join », and is purged two
-- hours after (as every plan). A plan with its own end keeps it.
create or replace function private.live_plan_ends_with_live() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.activity_id is not null and new.expires_at is not null then
    update public.activities a set ends_at = new.expires_at
    where a.id = new.activity_id and a.creator_id = new.author_id and a.ends_at is null
      and a.cancelled_at is null and new.expires_at > a.starts_at;
  end if;
  return null;
end $$;
revoke all on function private.live_plan_ends_with_live() from public, anon, authenticated;
drop trigger if exists irl_posts_plan_ends on public.irl_posts;
create trigger irl_posts_plan_ends after insert on public.irl_posts
  for each row execute function private.live_plan_ends_with_live();

-- ───────── ACT-06, ACT-07, ACT-08. What a plan may hold ─────────
create or replace function private.activity_input_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  ins boolean := tg_op = 'INSERT';
  timed boolean;
  member boolean;
begin
  -- The server's own work (purge, imports, cascades) is not a member's request.
  if auth.uid() is null or pg_trigger_depth() > 1 then return new; end if;
  -- What every plan holds (members and the team alike), checked when it changes.
  if (ins or new.title is distinct from old.title) and char_length(regexp_replace(coalesce(new.title, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g')) < 3 then
    raise exception 'The title needs at least 3 characters' using errcode = '23514';
  end if;
  if (ins or new.currency is distinct from old.currency) and coalesce(new.currency, '') !~ '^[A-Z]{3}$' then
    raise exception 'unknown currency' using errcode = '23514';
  end if;
  -- A ceiling far above any real plan (IDR amounts are large: the column's own limit applies there).
  if (ins or new.price_minor is distinct from old.price_minor or new.currency is distinct from old.currency)
     and new.currency <> 'IDR' and new.price_minor > 100000000 then
    raise exception 'This price is too high' using errcode = '23514';
  end if;
  if (ins or new.category_id is distinct from old.category_id)
     and not exists (select 1 from public.categories c where c.id = new.category_id) then
    raise exception 'unknown category' using errcode = '23514';
  end if;
  timed := ins or new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at;
  if timed and new.ends_at is not null and new.ends_at > new.starts_at + interval '31 days' then
    raise exception 'A plan lasts 31 days at most' using errcode = '23514';
  end if;

  -- Time rules for members (the team can still correct a plan).
  member := not private.i_am_staff();
  if member and ins then
    if new.starts_at < now() - interval '1 hour' then
      raise exception 'This time has passed: pick a later one' using errcode = '22023';
    end if;
    if new.starts_at > now() + interval '5 years' then
      raise exception 'Pick a date within the next five years' using errcode = '22023';
    end if;
  elsif member then
    -- ACT-06: a cancelled plan stays cancelled (the app has no « uncancel »).
    if old.cancelled_at is not null and new.cancelled_at is null then
      raise exception 'A cancelled plan cannot be brought back: create a new one' using errcode = '42501';
    end if;
    -- ACT-07: no moving a plan into the past, or moving one that is over.
    if timed then
      if coalesce(old.ends_at, old.starts_at + interval '2 hours') < now() then
        raise exception 'This activity is over' using errcode = '22023';
      end if;
      if new.starts_at is distinct from old.starts_at and new.starts_at < now() - interval '5 minutes' then
        raise exception 'This time has passed: pick a later one' using errcode = '22023';
      end if;
      if new.starts_at is distinct from old.starts_at and new.starts_at > now() + interval '5 years' then
        raise exception 'Pick a date within the next five years' using errcode = '22023';
      end if;
      if new.ends_at is distinct from old.ends_at and new.ends_at is not null and new.ends_at < now() then
        raise exception 'The end has passed: pick a later one' using errcode = '22023';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.activity_input_guard() from public, anon, authenticated;
drop trigger if exists activities_input_guard on public.activities;
create trigger activities_input_guard before insert or update on public.activities
  for each row execute function private.activity_input_guard();

-- ───────── ACT-04. The host is always going ─────────
-- leave_activity already keeps her; join_activity accepted another status.
create or replace function private.host_stays_going() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status <> 'going'
     and exists (select 1 from public.activities a where a.id = new.activity_id and a.creator_id = new.user_id) then
    raise exception 'The host is always going: cancel the plan instead' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function private.host_stays_going() from public, anon, authenticated;
drop trigger if exists activity_participants_host_going on public.activity_participants;
create trigger activity_participants_host_going before insert or update of status on public.activity_participants
  for each row execute function private.host_stays_going();

-- ───────── ACT-10. Leaving a community leaves its members-only plans ─────────
-- Upcoming and running plans only (an ended one keeps who went, for its
-- « Past » card); the host keeps her own plans; plans open to everyone stay.
-- Removing the participant also removes her from the plan's chat
-- (private.sync_activity_chat), exactly as leave_activity does.
create or replace function private.left_community_plans() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity_participants p
  using public.activities a
  where a.id = p.activity_id and p.user_id = old.user_id
    and a.community_id = old.community_id and a.privacy = 'community'
    and a.creator_id <> old.user_id
    and coalesce(a.ends_at, a.starts_at + interval '2 hours') > now();
  return null;
end $$;
revoke all on function private.left_community_plans() from public, anon, authenticated;
drop trigger if exists community_members_leave_plans on public.community_members;
create trigger community_members_leave_plans after delete on public.community_members
  for each row execute function private.left_community_plans();

-- Rollback (documented, not run): restore private.rate_guard from
-- 20261015000000_irly_rate_limits and private.purge_ended_activities from
-- 20261029600000_irly_activities_expire; drop the triggers
-- activities_queue_files, irl_posts_plan_ends, activities_input_guard,
-- activity_participants_host_going and community_members_leave_plans, and the
-- functions they call. No data depends on them.
