-- Notifications audit: a phone notification knows which notification it is.
--
-- A push carried only the screen to open (data.url), and for several kinds
-- (friend requests, likes, comments, replies, mentions) that screen was the
-- whole Notifications list: tapping one never opened its post or profile,
-- and never marked it read, so the bell kept counting what had been opened
-- from the lock screen. Each push now also carries its notification's id
-- (data.notification_id): the app reads that notification (its owner only:
-- RLS), marks it read and opens its own page, exactly as a tap in the list
-- does. data.url stays as it was, for app versions that do not know the id.
--
-- push_message builds one Expo message from an outbox row (pure, testable
-- without pg_net); push_send is unchanged otherwise (migration
-- 20261020001600). Nothing else changes: no table, no policy, no data.

create or replace function private.push_message(o public.push_outbox) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('to', o.token, 'title', o.title, 'body', o.body, 'sound', 'default',
    'data', jsonb_build_object('url', o.url, 'notification_id', o.notification_id),
    'channelId', 'default', 'priority', 'high')
$$;
revoke all on function private.push_message(public.push_outbox) from public, anon, authenticated;

create or replace function private.push_send(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  batch jsonb;
  req bigint;
  ids bigint[];
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  -- Only rows whose phone is still their recipient's (a retry can come minutes later).
  update public.push_outbox o set handled_at = now(), error = 'token left its member'
    where o.id = any (p_ids) and o.handled_at is null
      and not exists (select 1 from public.push_tokens t where t.token = o.token and t.user_id = o.user_id);
  select coalesce(jsonb_agg(private.push_message(o) order by o.id), '[]'),
    array_agg(o.id order by o.id)
    into batch, ids
    from public.push_outbox o
    where o.id = any (p_ids) and o.handled_at is null;
  if jsonb_array_length(batch) = 0 then return; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 10000)'
      into req
      using 'https://exp.host/--/api/v2/push/send', batch, '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb;
    update public.push_outbox set request_id = req, attempts = attempts + 1, sent_at = now(), error = null where id = any (ids);
  exception when others then
    -- A push that cannot leave never blocks the notification itself.
    update public.push_outbox set attempts = attempts + 1, error = 'not sent' where id = any (ids);
  end;
end $$;
revoke all on function private.push_send(bigint[]) from public, anon, authenticated;
