-- Realtime at scale: a join no longer concerns every connected member.
--
-- Supabase Realtime checks every change of a published table against every
-- subscription to that table, on one thread. A subscription with no filter
-- costs one row-level-security query per connected member for each change;
-- one whose filter does not match costs a comparison. The app listened to
-- activity_participants without a filter (src/features/server/sync.ts): each
-- join, by anyone, was checked against every member online, and every member
-- allowed to see it re-read her lists of plans.
--
-- The app now listens to its own participations only (user_id = me), as it
-- already does for community and chat memberships. The one other person a
-- join concerns wherever she is in the app, the host, is told through
-- public.sync_signals, exactly as she already is when someone leaves
-- (20261020000500_irly_sync_signals). A plan's own page and a place's page
-- keep listening to the participants of the plans they show.
--
-- Additive only: one trigger function and one trigger. No table, column,
-- policy, grant or existing function changes; nothing is deleted.

-- Who needs to know about a join or a changed answer, apart from the person
-- herself (who hears her own row): the host. The signal names the plan, never
-- the person; the host may read her plan's participants (participant_visible).
create or replace function private.sync_signal_activity_joined() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  host uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  select creator_id into host from public.activities where id = new.activity_id;
  -- (The host's own row, written when she creates the plan, is hers to hear.)
  if host is not null and host <> new.user_id then
    perform private.sync_signal(array[host], 'activities', new.activity_id::text);
  end if;
  return null;
end $$;
revoke all on function private.sync_signal_activity_joined() from public, anon, authenticated;

drop trigger if exists activity_participants_sync_joined on public.activity_participants;
create trigger activity_participants_sync_joined
  after insert or update of status on public.activity_participants
  for each row execute function private.sync_signal_activity_joined();
