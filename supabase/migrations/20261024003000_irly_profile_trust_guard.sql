-- Profile account age is set by the server (2026-10-24). Additive: one trigger.
--
-- profiles.created_at decides whose reports count (private.on_report_escalate:
-- three reports from accounts older than 7 days hide a post or a comment).
-- A member could write it: a brand-new account inserting its profile with
-- created_at = three years ago (or updating it later) was trusted at once, so
-- three fresh accounts could take down any post, IRLY Girl posts included.
-- Now: a member's own insert always stamps now(), and nobody but an admin or
-- the server changes it afterwards. Server jobs (auth.uid() null) and admins
-- are not limited. Test: supabase/tests/girl_parity_security.test.sql (9).

create or replace function private.profile_created_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
    return new;
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is set by IRLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.profile_created_guard() from public, anon, authenticated;

drop trigger if exists profiles_created_guard on public.profiles;
create trigger profiles_created_guard before insert or update of created_at on public.profiles
for each row execute function private.profile_created_guard();
