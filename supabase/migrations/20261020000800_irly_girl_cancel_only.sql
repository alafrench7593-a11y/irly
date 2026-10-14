-- A suspended IRLY Girl host can call off her girl-only plan, and only that.
-- The activities_creator policy lets her update once cancelled_at is set, so
-- the same update (or a later one) could also rename or move the cancelled
-- plan. This guard runs before the server-set triggers (name sorts first) and
-- accepts, for a host who is not eligible, exactly one change: cancelled_at
-- going from empty to set. Admins and server-side cascades are unaffected.
create or replace function private.girl_cancel_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) then return new; end if;
  if not (old.girl_only or new.girl_only) or old.creator_id <> auth.uid() or private.is_girl_eligible() then return new; end if;
  if old.cancelled_at is null and new.cancelled_at is not null
     and (to_jsonb(new) - 'cancelled_at') = (to_jsonb(old) - 'cancelled_at') then
    return new;
  end if;
  raise exception 'IRLY Girl is paused for you: you can only cancel this plan' using errcode = '42501';
end $$;
revoke all on function private.girl_cancel_only() from public, anon, authenticated;
drop trigger if exists activities_cancel_guard on public.activities;
create trigger activities_cancel_guard before update on public.activities
for each row execute function private.girl_cancel_only();
