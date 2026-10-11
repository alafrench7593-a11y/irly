-- Phone notifications you can rely on.
--
-- 1. Every push request keeps its pg_net request id. Expo's answer (one
--    ticket per phone, in the order sent) is read back: a phone Expo reports
--    as gone (DeviceNotRegistered) loses its token, so nothing is sent to it
--    again; a request that failed on the network or on Expo's side is sent
--    again, at most 3 times; everything else is closed. No loop: a closed row
--    is never read again.
-- 2. "Show message previews" (notification_prefs.push_previews, on by
--    default): off, a message push says who wrote, not what.
-- 3. Activity reminders: two hours before an activity, people going get one
--    reminder (once per activity and person), unless they muted reminders.
-- 4. With pg_cron (Supabase), the replies and reminders are handled every
--    minute; without it, each new notification handles the replies waiting.
-- Logs keep ids, status codes and Expo's error codes only, never the text.

alter table public.push_outbox add column if not exists request_id bigint;
alter table public.push_outbox add column if not exists attempts integer not null default 0;
alter table public.push_outbox add column if not exists handled_at timestamptz;
alter table public.push_outbox add column if not exists error text;
create index if not exists push_outbox_pending_idx on public.push_outbox (request_id) where handled_at is null;

alter table public.notification_prefs add column if not exists push_previews boolean not null default true;

-- Sends queued rows (one HTTP request for the batch) and remembers the request.
create or replace function private.push_send(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  batch jsonb;
  req bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  select coalesce(jsonb_agg(jsonb_build_object('to', o.token, 'title', o.title, 'body', o.body, 'sound', 'default',
      'data', jsonb_build_object('url', o.url), 'channelId', 'default', 'priority', 'high') order by o.id), '[]')
    into batch from public.push_outbox o where o.id = any (p_ids);
  if jsonb_array_length(batch) = 0 then return; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      into req
      using 'https://exp.host/--/api/v2/push/send', batch, '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
    update public.push_outbox set request_id = req, attempts = attempts + 1, sent_at = now(), error = null where id = any (p_ids);
  exception when others then
    -- A push that cannot leave never blocks the notification itself.
    update public.push_outbox set attempts = attempts + 1, error = 'not sent' where id = any (p_ids);
  end;
end $$;
revoke all on function private.push_send(bigint[]) from public, anon, authenticated;

-- Reads one Expo answer for the rows of one request. Pure logic, testable
-- without pg_net: status null means "no answer (timeout or network)".
create or replace function private.push_handle_reply(p_request bigint, p_status integer, p_body jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  i integer := 0;
  ticket jsonb;
  code text;
begin
  if p_status is null or p_status >= 500 or p_status = 429 then
    -- Expo or the network failed: try again later, up to 3 sends in all.
    update public.push_outbox set request_id = null, error = coalesce(p_status::text, 'no answer')
      where request_id = p_request and handled_at is null and attempts < 3;
    update public.push_outbox set handled_at = now(), error = coalesce(p_status::text, 'no answer') || ' (gave up)'
      where request_id = p_request and handled_at is null;
    return;
  end if;
  if p_status <> 200 then
    update public.push_outbox set handled_at = now(), error = p_status::text where request_id = p_request and handled_at is null;
    return;
  end if;
  for r in select id, token from public.push_outbox where request_id = p_request and handled_at is null order by id loop
    ticket := p_body -> 'data' -> i;
    i := i + 1;
    code := ticket -> 'details' ->> 'error';
    if ticket ->> 'status' = 'error' and code = 'DeviceNotRegistered' then
      -- The app was removed or notifications turned off for good: forget this phone.
      delete from public.push_tokens where token = r.token;
    end if;
    update public.push_outbox set handled_at = now(),
      error = case when ticket ->> 'status' = 'error' then coalesce(code, 'error') end
      where id = r.id;
  end loop;
end $$;
revoke all on function private.push_handle_reply(bigint, integer, jsonb) from public, anon, authenticated;

-- Reads Expo's answers waiting in pg_net and sends again what needs it.
create or replace function private.push_housekeeping() returns void
language plpgsql security definer set search_path = public as $$
declare
  req record;
  retry bigint[];
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    for req in execute $q$
      select distinct o.request_id as id, r.status_code, r.content::jsonb as body, r.timed_out, r.error_msg
      from public.push_outbox o
      join net._http_response r on r.id = o.request_id
      where o.handled_at is null and o.request_id is not null
      limit 100 $q$
    loop
      begin
        perform private.push_handle_reply(req.id, case when req.timed_out or req.error_msg is not null then null else req.status_code end, req.body);
      exception when others then
        perform private.push_handle_reply(req.id, req.status_code, '{}'::jsonb);
      end;
    end loop;
    -- Requests pg_net has forgotten (no answer after 10 minutes) count as failed.
    update public.push_outbox o set request_id = null, error = 'no answer'
      where o.handled_at is null and o.request_id is not null and o.sent_at < now() - interval '10 minutes'
        and not exists (select 1 from net._http_response r where r.id = o.request_id) and o.attempts < 3;
  end if;
  -- Rows waiting for a new try (never more than 3 sends), a little later each time.
  select array_agg(id) into retry from (
    select id from public.push_outbox
    where handled_at is null and request_id is null and attempts between 1 and 2
      and coalesce(sent_at, created_at) < now() - (attempts * interval '1 minute')
    order by id limit 100) t;
  if retry is not null then perform private.push_send(retry); end if;
  update public.push_outbox set handled_at = now(), error = coalesce(error, 'gave up')
    where handled_at is null and request_id is null and attempts >= 3;
  delete from public.push_outbox where created_at < now() - interval '7 days';
end $$;
revoke all on function private.push_housekeeping() from public, anon, authenticated;

-- After a notification is stored: one push per phone of its owner.
create or replace function private.on_notification_push() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tok record;
  txt record;
  ids bigint[] := '{}';
  new_id bigint;
  previews boolean;
begin
  if not coalesce((select p.push_enabled from public.notification_prefs p where p.user_id = new.user_id), true) then
    return null;
  end if;
  -- A busy chat pushes once a minute, not once a message.
  if new.kind = 'MESSAGE_CREATED' and exists (
    select 1 from public.push_outbox o join public.notifications n on n.id = o.notification_id
    where o.user_id = new.user_id and n.kind = 'MESSAGE_CREATED' and n.payload ->> 'conversation_id' = new.payload ->> 'conversation_id'
      and o.created_at > now() - interval '1 minute') then
    return null;
  end if;
  previews := coalesce((select p.push_previews from public.notification_prefs p where p.user_id = new.user_id), true);
  for tok in select token, lang from public.push_tokens where user_id = new.user_id loop
    txt := private.push_text(new, tok.lang);
    if not previews and new.kind = 'MESSAGE_CREATED' then
      txt.body := case when tok.lang = 'fr' then 'Nouveau message' else 'New message' end;
    end if;
    insert into public.push_outbox (notification_id, user_id, token, title, body, url)
    values (new.id, new.user_id, tok.token, txt.title, txt.body, txt.url)
    returning id into new_id;
    ids := ids || new_id;
  end loop;
  if cardinality(ids) > 0 then
    perform private.push_send(ids);
  end if;
  -- Without pg_cron, replies waiting are read here.
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform private.push_housekeeping();
    exception when others then null;
    end;
  end if;
  return null;
end $$;

-- ───────── Activity reminders ─────────
-- Two hours before the start (a window of 2h to 1h45, run every minute or
-- so), once per activity and person.
create or replace function private.send_activity_reminders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select ap.user_id, a.id, a.title
    from public.activities a
    join public.activity_participants ap on ap.activity_id = a.id and ap.status = 'going'
    where a.cancelled_at is null
      and a.starts_at > now() + interval '105 minutes' and a.starts_at <= now() + interval '120 minutes'
      and not exists (
        select 1 from public.notifications x
        where x.user_id = ap.user_id and x.kind = 'ACTIVITY_REMINDER' and x.payload ->> 'activity_id' = a.id::text)
  loop
    perform private.notify(r.user_id, 'ACTIVITY_REMINDER', jsonb_build_object('activity_id', r.id, 'title', r.title));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.send_activity_reminders() from public, anon, authenticated;

-- pg_cron on Supabase: replies and reminders every minute.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname in ('irly-push-housekeeping', 'irly-activity-reminders');
  perform cron.schedule('irly-push-housekeeping', '* * * * *', 'select private.push_housekeeping()');
  perform cron.schedule('irly-activity-reminders', '* * * * *', 'select private.send_activity_reminders()');
exception when others then
  raise notice 'pg_cron not available: push replies are read on each new notification, reminders are not sent';
end $$;
