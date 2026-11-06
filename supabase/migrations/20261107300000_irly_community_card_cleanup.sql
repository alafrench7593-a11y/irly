-- A plan that leaves a community (moderated out with
-- community_moderate_activity, 20261107000000) no longer shows in that
-- community's chat: its activity card (posted when it was created,
-- 20261107100000, or shared by a member) is removed for everyone, the same
-- soft delete as « delete for everyone ». Nothing else changes; no row is
-- removed.

create or replace function private.activities_card_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.community_id is not null and new.community_id is distinct from old.community_id then
    update public.messages m set deleted_at = now()
    from public.conversations c
    where c.community_id = old.community_id and m.conversation_id = c.id
      and m.kind = 'share' and m.ref_type = 'activity' and m.ref_id = new.id and m.deleted_at is null;
  end if;
  return null;
end $$;
revoke all on function private.activities_card_cleanup() from public, anon, authenticated;

drop trigger if exists activities_card_cleanup on public.activities;
create trigger activities_card_cleanup after update of community_id on public.activities
  for each row execute function private.activities_card_cleanup();
