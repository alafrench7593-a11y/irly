-- Realtime DELETE privacy.
--
-- Supabase Realtime cannot apply RLS to DELETE events: every client subscribed
-- to a published table receives every delete, and with RLS on the old record
-- is cut down to the PRIMARY KEY columns (realtime.apply_rls: "if RLS enabled,
-- we can't secure deletes so filter to pkey"). For these tables the primary
-- key IS the private fact — who left which girl-only activity or community,
-- who left a private chat, who unfriended / unfollowed whom, who unsaved or
-- unliked what:
--   activity_participants, community_members, conversation_members, follows,
--   friendships, saves, likes, community_poll_votes.
--
-- Fix, without unpublishing anything (feature screens owned elsewhere still
-- subscribe to INSERT/UPDATE on some of these tables, and Realtime refuses a
-- whole channel when one of its tables is not published):
--   1. Each table gets an opaque surrogate column rt_id and its REPLICA
--      IDENTITY becomes a unique index on rt_id alone. The WAL "identity" of a
--      delete is then just {rt_id}; Realtime keeps only primary-key columns
--      of it, so a DELETE event now carries an EMPTY old record: no user, no
--      activity, no community, no post. INSERT/UPDATE are unchanged (they are
--      RLS-checked against the new row). Filtered DELETE listeners no longer
--      match (the filter column is not in the identity), which also ends the
--      app-wide reload storms on leaves/unlikes.
--   2. The people who legitimately need to hear about a delete get a row in
--      public.sync_signals (readable only by its owner, written only by these
--      SECURITY DEFINER triggers), which the app's SyncBridge listens to with
--      an RLS-checked INSERT subscription filtered on its own user id.
-- Primary keys, policies and data are untouched.

-- ───────── 1. Signals ─────────
create table if not exists public.sync_signals (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('activities', 'communities', 'inbox', 'follows', 'friends', 'saved')),
  ref text check (ref is null or char_length(ref) <= 64),
  at timestamptz not null default now()
);
create index if not exists sync_signals_user_at_idx on public.sync_signals (user_id, at);
create index if not exists sync_signals_at_idx on public.sync_signals (at);
alter table public.sync_signals enable row level security;

drop policy if exists sync_signals_read_own on public.sync_signals;
create policy sync_signals_read_own on public.sync_signals
  for select to authenticated using (user_id = (select auth.uid()));
-- No insert / update / delete policy: clients can never write signals.
revoke all on public.sync_signals from public, anon, authenticated;
grant select on public.sync_signals to authenticated;

-- One signal per (user, kind, ref) per transaction (a cascade of deletes is one
-- signal), only for existing profiles (a deleted account is not signalled
-- during its own cascade), plus a cheap bounded prune of day-old signals.
create or replace function private.sync_signal(p_users uuid[], p_kind text, p_ref text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_signals (user_id, kind, ref)
  select u, p_kind, p_ref
  from (select distinct u from unnest(p_users) u where u is not null) t
  where exists (select 1 from public.profiles p where p.id = t.u)
    and not exists (
      select 1 from public.sync_signals s
      where s.user_id = t.u and s.kind = p_kind and s.ref is not distinct from p_ref
        and s.xmin = pg_current_xact_id()::xid
    );
  delete from public.sync_signals
  where id in (
    select id from public.sync_signals
    where at < now() - interval '1 day'
    order by at
    limit 50
    for update skip locked
  );
end $$;
revoke all on function private.sync_signal(uuid[], text, text) from public, anon, authenticated;

-- ───────── 2. Who needs to know about a delete ─────────

-- Activity leave / removal: the person, the host, and (for small groups) the
-- other attendees, whose open activity screen showed the attendee list. When
-- the activity itself is being deleted, its own (key-only) event reaches
-- everyone already, so only the person is signalled.
create or replace function private.sync_signal_activity_left() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  host uuid;
  others uuid[] := '{}';
begin
  select creator_id into host from public.activities where id = old.activity_id;
  if found then
    if (select count(*) from public.activity_participants where activity_id = old.activity_id) <= 50 then
      others := array(select user_id from public.activity_participants where activity_id = old.activity_id);
    end if;
  end if;
  perform private.sync_signal(array[old.user_id, host] || others, 'activities', old.activity_id::text);
  return old;
end $$;

create or replace function private.sync_signal_community_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Other members see the new count through the communities row (members_count).
  perform private.sync_signal(array[old.user_id], 'communities', old.community_id::text);
  return old;
end $$;

create or replace function private.sync_signal_chat_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.sync_signal(array[old.user_id], 'inbox', old.conversation_id::text);
  return old;
end $$;

create or replace function private.sync_signal_unfollow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.sync_signal(array[old.follower_id, old.followee_id], 'follows');
  return old;
end $$;

create or replace function private.sync_signal_unfriend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.sync_signal(array[old.user_a, old.user_b], 'friends');
  return old;
end $$;

create or replace function private.sync_signal_unsave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.sync_signal(array[old.user_id], 'saved');
  return old;
end $$;
-- likes / community_poll_votes: no signal. Counts refresh on the next load;
-- fanning an unlike out to an author (or every viewer) is not worth it.

revoke all on function
  private.sync_signal_activity_left(), private.sync_signal_community_left(), private.sync_signal_chat_left(),
  private.sync_signal_unfollow(), private.sync_signal_unfriend(), private.sync_signal_unsave()
from public, anon, authenticated;

drop trigger if exists activity_participants_sync_signal on public.activity_participants;
create trigger activity_participants_sync_signal after delete on public.activity_participants
for each row execute function private.sync_signal_activity_left();
drop trigger if exists community_members_sync_signal on public.community_members;
create trigger community_members_sync_signal after delete on public.community_members
for each row execute function private.sync_signal_community_left();
drop trigger if exists conversation_members_sync_signal on public.conversation_members;
create trigger conversation_members_sync_signal after delete on public.conversation_members
for each row execute function private.sync_signal_chat_left();
drop trigger if exists follows_sync_signal on public.follows;
create trigger follows_sync_signal after delete on public.follows
for each row execute function private.sync_signal_unfollow();
drop trigger if exists friendships_sync_signal on public.friendships;
create trigger friendships_sync_signal after delete on public.friendships
for each row execute function private.sync_signal_unfriend();
drop trigger if exists saves_sync_signal on public.saves;
create trigger saves_sync_signal after delete on public.saves
for each row execute function private.sync_signal_unsave();

-- ───────── 3. Key-less DELETE events ─────────
do $$
declare
  t text;
begin
  foreach t in array array['activity_participants', 'community_members', 'conversation_members', 'follows',
                           'friendships', 'saves', 'likes', 'community_poll_votes'] loop
    execute format('alter table public.%I add column if not exists rt_id bigint generated by default as identity', t);
    execute format('create unique index if not exists %I on public.%I (rt_id)', t || '_rt_id_key', t);
    execute format('alter table public.%I replica identity using index %I', t, t || '_rt_id_key');
  end loop;
end $$;

-- ───────── 4. Publish the signals ─────────
-- In a function so the tests can check it against a stand-in publication.
create or replace function private.sync_signals_realtime() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return; -- local databases without Supabase realtime
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_signals') then
    alter publication supabase_realtime add table public.sync_signals;
  end if;
end $$;
revoke all on function private.sync_signals_realtime() from public, anon, authenticated;
select private.sync_signals_realtime();
