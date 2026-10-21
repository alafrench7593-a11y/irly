-- Important reports reach the moderation inbox by email.
--
--   report filed → moderation case (as before)
--     → private.admin_notifications (one row per case: the back office counts it)
--     → private.report_email_outbox (one row per case at most, unique: idempotent)
--     → scripts/report-email.mjs (GitHub workflow "Report email", every 10 min)
--        claims a batch with a lease, sends through the email provider with
--        the outbox id as the provider's idempotency key, marks sent or failed
--        (retried with a growing delay, then left failed for a person).
--
-- The destination address, which reports count (off / important / all) and the
-- base link of the back office are settings in private.admin_settings, read and
-- changed only by admins (Back office → Settings), never by the app's code.
-- The provider key lives only in the workflow's secrets. The email carries the
-- case number, kind, reason, priority, date and a link to the case screen
-- (sign-in required): never a name, an email, the report's text or a key.
-- Additive: new private tables, no grant to clients, RLS on.

-- ───────── Settings ─────────
create table if not exists private.admin_settings (
  key text primary key check (key in ('report_email_to', 'report_email_scope', 'dashboard_url')),
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table private.admin_settings enable row level security;
revoke all on private.admin_settings from public, anon, authenticated;

create or replace function private.setting(p_key text) returns text
language sql stable security definer set search_path = public, private as $$
  select coalesce((select value from private.admin_settings where key = p_key),
    case p_key when 'report_email_scope' then 'important' when 'dashboard_url' then 'https://getirly.com/app' end)
$$;
revoke all on function private.setting(text) from public, anon, authenticated;

/** The settings, for the back office (admins). */
create or replace function public.admin_settings() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  return jsonb_build_object(
    'report_email_to', private.setting('report_email_to'),
    'report_email_scope', private.setting('report_email_scope'),
    'dashboard_url', private.setting('dashboard_url'),
    'updated', (select jsonb_object_agg(s.key, jsonb_build_object('at', s.updated_at, 'by', p.first_name))
                from private.admin_settings s left join public.profiles p on p.id = s.updated_by),
    'outbox', jsonb_build_object(
      'pending', (select count(*) from private.report_email_outbox where status in ('pending', 'sending')),
      'sent', (select count(*) from private.report_email_outbox where status = 'sent'),
      'failed', (select count(*) from private.report_email_outbox where status = 'failed'),
      'last_sent', (select max(sent_at) from private.report_email_outbox),
      'recent', coalesce((select jsonb_agg(x order by x.created_at desc) from (
          select o.id, o.case_id, o.status, o.attempts, o.last_error, o.created_at, o.sent_at
          from private.report_email_outbox o order by o.created_at desc limit 15) x), '[]'))
  );
end $$;
revoke all on function public.admin_settings() from public, anon;
grant execute on function public.admin_settings() to authenticated;

/** Changes one setting (admins); checked here, logged without its value. Empty clears it. */
create or replace function public.admin_set_setting(p_key text, p_value text) returns void
language plpgsql security definer set search_path = public, private as $$
declare v text := nullif(btrim(coalesce(p_value, '')), '');
begin
  perform private.need_admin();
  if p_key = 'report_email_to' then
    if v is not null and (char_length(v) > 254 or v !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$') then
      raise exception 'not an email address' using errcode = '22023';
    end if;
    v := lower(v);
  elsif p_key = 'report_email_scope' then
    if v is null or v not in ('off', 'important', 'all') then raise exception 'choose off, important or all' using errcode = '22023'; end if;
  elsif p_key = 'dashboard_url' then
    if v is not null and (char_length(v) > 200 or v !~ '^https://[A-Za-z0-9.-]+(:[0-9]{2,5})?(/[A-Za-z0-9._~/-]*)?$') then
      raise exception 'a secure (https) address is needed' using errcode = '22023';
    end if;
    v := rtrim(v, '/');
  else
    raise exception 'unknown setting' using errcode = '22023';
  end if;
  if v is null then
    delete from private.admin_settings where key = p_key;
  else
    insert into private.admin_settings (key, value, updated_at, updated_by) values (p_key, v, now(), auth.uid())
    on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  end if;
  perform private.journal('settings.changed', null, null, null, null, null, jsonb_build_object('setting', p_key, 'cleared', v is null));
end $$;
revoke all on function public.admin_set_setting(text, text) from public, anon;
grant execute on function public.admin_set_setting(text, text) to authenticated;

-- ───────── Notifications and outbox ─────────
create table if not exists private.admin_notifications (
  id bigserial primary key,
  case_id uuid not null unique references public.moderation_cases (id) on delete cascade,
  important boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists admin_notifications_at on private.admin_notifications (created_at desc);
alter table private.admin_notifications enable row level security;
revoke all on private.admin_notifications from public, anon, authenticated;

create table if not exists private.report_email_outbox (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.moderation_cases (id) on delete cascade,
  report_id uuid not null unique references public.reports (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 300),
  next_attempt_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text check (provider_id is null or char_length(provider_id) <= 120),
  created_at timestamptz not null default now()
);
create index if not exists report_email_outbox_due on private.report_email_outbox (next_attempt_at) where status in ('pending', 'sending');
alter table private.report_email_outbox enable row level security;
revoke all on private.report_email_outbox from public, anon, authenticated;

/** Important: a serious reason, or several members reporting the same thing (priority high). */
create or replace function private.case_is_important(p_case uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.priority = 'high' or r.category in ('threats', 'unsafe', 'sexual_content', 'hate_speech')
                   from public.moderation_cases m join public.reports r on r.id = m.report_id where m.id = p_case), false)
$$;
revoke all on function private.case_is_important(uuid) from public, anon, authenticated;

create or replace function private.queue_report_email(p_case uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare scope text := private.setting('report_email_scope');
begin
  if scope = 'off' or (scope = 'important' and not private.case_is_important(p_case)) then return; end if;
  insert into private.report_email_outbox (case_id, report_id)
  select m.id, m.report_id from public.moderation_cases m where m.id = p_case
  on conflict do nothing;
end $$;
revoke all on function private.queue_report_email(uuid) from public, anon, authenticated;

create or replace function private.on_case_notify() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if tg_op = 'INSERT' then
    insert into private.admin_notifications (case_id, important) values (new.id, private.case_is_important(new.id))
    on conflict (case_id) do nothing;
  elsif new.priority = 'high' and old.priority is distinct from 'high' then
    update private.admin_notifications set important = true where case_id = new.id;
  else
    return null;
  end if;
  -- Never a reason to refuse the report itself.
  begin
    perform private.queue_report_email(new.id);
  exception when others then
    raise warning 'report email not queued (%)', sqlstate;
  end;
  return null;
end $$;
revoke all on function private.on_case_notify() from public, anon, authenticated;
drop trigger if exists moderation_cases_notify on public.moderation_cases;
create trigger moderation_cases_notify after insert or update of priority on public.moderation_cases
  for each row execute function private.on_case_notify();

-- ───────── The sender's calls (server key only) ─────────
create or replace function private.report_email_max_attempts() returns integer language sql immutable as $$ select 6 $$;

/**
 * A batch to send: due rows (pending, or claimed by a run that died more than
 * a lease ago), locked so two runs never take the same row. Nothing while no
 * destination is set: the rows wait, nothing is lost.
 */
create or replace function private.report_email_claim(p_limit integer default 20, p_lease_seconds integer default 600)
returns table (id uuid, case_id uuid, target_kind text, category text, priority text, reported_at timestamptz,
  to_email text, case_url text, attempt integer)
language plpgsql security definer set search_path = public, private as $$
declare dest text := private.setting('report_email_to'); base text := private.setting('dashboard_url');
begin
  if dest is null then return; end if;
  return query
    with due as (
      select o.id from private.report_email_outbox o
      where (o.status = 'pending' and o.next_attempt_at <= now())
         or (o.status = 'sending' and o.claimed_at < now() - make_interval(secs => greatest(coalesce(p_lease_seconds, 600), 60)))
      order by o.created_at
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
      for update skip locked
    ), took as (
      update private.report_email_outbox o set status = 'sending', claimed_at = now(), attempts = o.attempts + 1
      from due where o.id = due.id
      returning o.id, o.case_id, o.report_id, o.attempts
    )
    select t.id, t.case_id, r.target_kind, r.category, m.priority, r.created_at, dest,
      base || '/admin/case/' || t.case_id, t.attempts
    from took t join public.reports r on r.id = t.report_id join public.moderation_cases m on m.id = t.case_id;
end $$;

create or replace function private.report_email_done(p_id uuid, p_provider_id text) returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  update private.report_email_outbox set status = 'sent', sent_at = now(), last_error = null,
    provider_id = left(nullif(btrim(coalesce(p_provider_id, '')), ''), 120)
  where id = p_id and status = 'sending';
  return found;
end $$;

/** A failed send: tried again later (2, 4, 8… minutes, at most 6 h), then left failed for a person. */
create or replace function private.report_email_failed(p_id uuid, p_error text) returns text
language plpgsql security definer set search_path = public, private as $$
declare n integer; st text;
begin
  select attempts into n from private.report_email_outbox where id = p_id and status = 'sending' for update;
  if n is null then return null; end if;
  st := case when n >= private.report_email_max_attempts() then 'failed' else 'pending' end;
  update private.report_email_outbox set status = st, claimed_at = null,
    next_attempt_at = now() + least(make_interval(mins => power(2, n)::integer), interval '6 hours'),
    -- Never a key: anything that looks like one is cut out.
    last_error = left(regexp_replace(coalesce(p_error, 'unknown error'), '(re_|sb_secret_|sbp_|Bearer\s+)[A-Za-z0-9._-]+', '[hidden]', 'g'), 300)
  where id = p_id;
  return st;
end $$;

do $$
declare f text;
begin
  foreach f in array array['private.report_email_claim(integer, integer)', 'private.report_email_done(uuid, text)',
                           'private.report_email_failed(uuid, text)', 'private.report_email_max_attempts()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- REST wrappers for the sender, callable with this project's server key only.
create or replace function public.report_email_claim(p_limit integer default 20, p_lease_seconds integer default 600)
returns table (id uuid, case_id uuid, target_kind text, category text, priority text, reported_at timestamptz,
  to_email text, case_url text, attempt integer)
language sql security definer set search_path = public, private as $$
  select * from private.report_email_claim(p_limit, p_lease_seconds)
$$;
create or replace function public.report_email_done(p_id uuid, p_provider_id text) returns boolean
language sql security definer set search_path = public, private as $$
  select private.report_email_done(p_id, p_provider_id)
$$;
create or replace function public.report_email_failed(p_id uuid, p_error text) returns text
language sql security definer set search_path = public, private as $$
  select private.report_email_failed(p_id, p_error)
$$;
do $$
declare f text;
begin
  foreach f in array array['public.report_email_claim(integer, integer)', 'public.report_email_done(uuid, text)',
                           'public.report_email_failed(uuid, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

/** Sends a failed email again (admins), from Back office → Settings. */
create or replace function public.admin_email_retry(p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  update private.report_email_outbox set status = 'pending', next_attempt_at = now(), attempts = 0, last_error = null
  where id = p_id and status = 'failed';
  if not found then raise exception 'nothing to send again' using errcode = '22023'; end if;
  perform private.journal('email.retry', null, (select case_id from private.report_email_outbox where id = p_id), null, null, null);
end $$;
revoke all on function public.admin_email_retry(uuid) from public, anon;
grant execute on function public.admin_email_retry(uuid) to authenticated;
