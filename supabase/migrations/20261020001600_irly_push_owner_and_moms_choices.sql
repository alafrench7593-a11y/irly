-- Push tokens and IRLY Moms choices (audit of 15 October).
--
-- 1. A token registered before install secrets existed (no binding) could be
--    claimed by any account AND bound to that account's install: the real
--    phone's updated app was then refused for good ("belongs to another app
--    install"). An unbound token still follows an account switch (an old app
--    on a shared phone sends no secret), but it is only bound to an install
--    when no other account holds it, or by its own holder: the real phone
--    binds it at its next registration and is protected from then on.
--
-- 2. A push waiting for a retry (Expo busy, network) was sent again without
--    checking that its phone still belongs to its recipient: after a sign-out,
--    a release or an account switch on that phone, the previous member's
--    notification could still reach it for a few minutes. Pending pushes of a
--    token that leaves its member are now dropped, and push_send only sends a
--    row whose token is still that member's.
--
-- 3. IRLY Moms: what a member is looking for is shown to other women
--    (girl_circle). The app only offers six choices, but a direct write
--    accepted any text, children's names included. New writes are now limited
--    to those choices (existing rows are left as they are: NOT VALID).

create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'en', p_install text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  h text;
  bound text;
  holder uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_token is null or char_length(p_token) > 300 or p_token !~ '^Expo(nent)?PushToken\[[^]\s]{1,250}\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;
  if p_platform is null or p_platform not in ('ios', 'android') then
    raise exception 'invalid platform' using errcode = '22023';
  end if;
  if p_install is not null then
    if p_install !~ '^[A-Za-z0-9_-]{32,128}$' then
      raise exception 'invalid install id' using errcode = '22023';
    end if;
    h := private.push_install_hash(p_token, p_install);
  end if;
  -- One registration of a token at a time (two accounts racing for it).
  perform pg_advisory_xact_lock(hashtextextended('push_token:' || p_token, 0));
  select install_hash into bound from private.push_installs where token = p_token;
  select user_id into holder from public.push_tokens where token = p_token;

  -- (coalesce: a missing secret compares as null, which must mean "no", never "unknown".)
  if not coalesce(
    holder = me                  -- my own registration: refreshed, whatever the install says
    or bound is null             -- never bound (new token, or registered before installs had a secret)
    or bound = h,                -- the same install: an account switch on this phone
    false
  ) then
    raise exception 'this notification token belongs to another app install' using errcode = '42501';
  end if;

  insert into public.push_tokens (token, user_id, platform, lang)
  values (p_token, me, p_platform, case when p_lang = 'fr' then 'fr' else 'en' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, updated_at = now();

  -- Bound to this install only when nobody else held it, I held it already, or it
  -- was bound to this very install: claiming another member's unbound token never
  -- locks that member's own phone out.
  if h is not null and (holder is null or holder = me or bound is not null) then
    insert into private.push_installs (token, install_hash) values (p_token, h)
    on conflict (token) do update set install_hash = excluded.install_hash, updated_at = now();
  end if;
end $$;
revoke all on function public.register_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text, text) to authenticated;

-- A token that leaves its member (released, unregistered, taken by another
-- account, forgotten after DeviceNotRegistered): its pending pushes go.
create or replace function private.push_token_left() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' or new.user_id is distinct from old.user_id then
    update public.push_outbox set handled_at = now(), error = 'token left its member'
      where token = old.token and user_id = old.user_id and handled_at is null;
  end if;
  return null;
end $$;
revoke all on function private.push_token_left() from public, anon, authenticated;
drop trigger if exists push_token_left on public.push_tokens;
create trigger push_token_left after delete or update of user_id on public.push_tokens
  for each row execute function private.push_token_left();

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
  select coalesce(jsonb_agg(jsonb_build_object('to', o.token, 'title', o.title, 'body', o.body, 'sound', 'default',
      'data', jsonb_build_object('url', o.url), 'channelId', 'default', 'priority', 'high') order by o.id), '[]'),
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

alter table public.irly_match_profiles drop constraint if exists irly_match_profiles_looking_for_choices;
alter table public.irly_match_profiles add constraint irly_match_profiles_looking_for_choices
  check (looking_for <@ array['friends', 'activities', 'travel companions', 'coworking', 'wellness', 'sports']::text[]) not valid;
