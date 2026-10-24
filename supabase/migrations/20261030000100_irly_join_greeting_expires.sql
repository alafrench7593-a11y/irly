-- "Sara just joined 👋 Say hello!" (private.official_member_joined) is a
-- moment, not history: it goes 5 minutes after it was posted. A job every
-- minute removes the ones older than that; the app hides them as soon as
-- they turn 5 minutes old. A greeting someone reported is kept for the
-- moderators (messages_keep_reported).

create or replace function private.purge_join_greetings() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  delete from public.messages m
  where m.sender_id is null and m.kind = 'system'
    and m.body like '% just joined 👋 Say hello!'
    and m.created_at < now() - interval '5 minutes'
    and not exists (select 1 from public.reports r where r.target_id = m.id);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.purge_join_greetings() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'irly-join-greetings-expire';
  perform cron.schedule('irly-join-greetings-expire', '* * * * *', 'select private.purge_join_greetings()');
exception when others then
  raise notice 'pg_cron not available: join greetings are only hidden by the app';
end $$;
