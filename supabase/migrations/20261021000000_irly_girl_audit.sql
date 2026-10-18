-- IRLY Girl audit (2026-10-21). Additive: one trigger, three restrictive policies.
--
-- 1. A plan could become girl-only (directly, or by moving it into a girl-only
--    community) while men were in it: they kept reading the participant list
--    and the girls' comments. The change is now refused while anyone without
--    IRLY Girl access is a participant. Named so it fires after
--    activities_girl_only (the trigger that forces the flag from the community).
-- 2. A suspended girl (or anyone let in before such a change) kept reading and
--    writing comments and likes on girl-only plans she hosts or joined. Comments
--    and likes on IRLY Girl content now need IRLY Girl access, host included.
--    She still sees the plan itself, so a suspended host can cancel it.
-- People without access already inside girl-only plans are NOT removed here
-- (production data): they lose comments and likes now; removing them is a
-- separate, reviewed decision.

create or replace function private.activity_girl_flip_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.girl_only and not old.girl_only and exists (
    select 1 from public.activity_participants p
    where p.activity_id = new.id and not private.girl_eligible_unchecked(p.user_id)
  ) then
    raise exception 'someone without IRLY Girl joined: this plan cannot become girl-only' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.activity_girl_flip_guard() from public, anon, authenticated;
drop trigger if exists activities_girl_only_flip on public.activities;
create trigger activities_girl_only_flip before update of girl_only, community_id on public.activities
  for each row execute function private.activity_girl_flip_guard();

grant execute on function private.girl_target(text, text) to authenticated;
drop policy if exists comments_girl_only on public.comments;
create policy comments_girl_only on public.comments as restrictive for select to authenticated
  using (not private.girl_target(target_type, target_id) or (select private.is_girl_eligible()));
drop policy if exists comments_girl_only_write on public.comments;
create policy comments_girl_only_write on public.comments as restrictive for insert to authenticated
  with check (not private.girl_target(target_type, target_id) or (select private.is_girl_eligible()));
drop policy if exists likes_girl_only on public.likes;
create policy likes_girl_only on public.likes as restrictive for insert to authenticated
  with check (not private.girl_target(target_type, target_id) or (select private.is_girl_eligible()));
