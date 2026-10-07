-- Retention, as stated in the Privacy Policy:
-- - reports and their moderation case: 12 months after the case is closed
--   (actioned or dismissed); open cases are kept until handled;
-- - text kept aside from removed or reported content: 12 months;
-- - support requests: 24 months.
-- There is no scheduler on the project, so the clean-up runs now and then
-- when new reports or support requests arrive (and can be run by an admin).
create or replace function private.purge_retention() returns void
language plpgsql security definer set search_path = public, private as $$
begin
  delete from public.reports r
  using public.moderation_cases m
  where m.report_id = r.id and m.status in ('actioned', 'dismissed') and m.updated_at < now() - interval '12 months';
  delete from private.removed_content where removed_at < now() - interval '12 months';
  delete from public.support_requests where created_at < now() - interval '24 months';
end $$;
revoke all on function private.purge_retention() from public, anon, authenticated;

create or replace function private.retention_tick() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if random() < 0.02 then
    perform private.purge_retention();
  end if;
  return null;
end $$;
drop trigger if exists reports_retention on public.reports;
create trigger reports_retention after insert on public.reports
for each statement execute function private.retention_tick();
drop trigger if exists support_retention on public.support_requests;
create trigger support_retention after insert on public.support_requests
for each statement execute function private.retention_tick();
