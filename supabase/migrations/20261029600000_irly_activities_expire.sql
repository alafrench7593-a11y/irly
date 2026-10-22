-- An activity is removed once it is over (owner's decision of 2026-10-22):
-- two hours after its end time, or, without an end time, six hours after it
-- started (the usual length plus the same two hours, so the people who went
-- can still say thank you in its chat). Its chat, its participants and its
-- reminders go with it (on delete cascade); Lives that pointed at it keep
-- the Live and lose the link (on delete set null).
-- Additive: no table or column changes, RLS untouched, the function is
-- private and runs as the database owner from pg_cron only.
create or replace function private.purge_ended_activities(p_limit integer default 500)
returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  n integer;
begin
  with gone as (
    select a.id from public.activities a
    where coalesce(a.ends_at, a.starts_at + interval '4 hours') < now() - interval '2 hours'
    order by a.starts_at
    limit greatest(1, least(coalesce(p_limit, 500), 5000))
  )
  delete from public.activities a using gone where a.id = gone.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.purge_ended_activities(integer) from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'irly-activities-expire';
  perform cron.schedule('irly-activities-expire', '*/15 * * * *', 'select private.purge_ended_activities()');
exception when others then
  raise notice 'pg_cron not available: ended activities are not removed automatically';
end $$;
