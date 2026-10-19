-- IRLY back office: staff roles, a moderation inbox, sanctions that the
-- server enforces, an audit log, and scoped access to reported private
-- messages.
--
-- Roles (public.staff_roles, readable only through the functions below):
--   owner      everything, the only one who grants or removes roles
--   admin      everything except roles; same as the historic profiles.is_admin
--   moderator  reports: triage, notes, warnings, suspensions up to 7 days,
--              reading a reported message with its context
--   content    reserved for content tools (communities, activities, articles)
-- The first owner is set from the server only (private.grant_owner, called by
-- the "Grant owner" GitHub workflow with the account's email): there is no
-- button, no client path and no hard-coded account.
--
-- Private messages: nobody on the staff can list or read conversations.
-- A moderator or admin reads one REPORTED message, with the three messages
-- before and after it in that conversation, through mod_reported_message,
-- which demands a reason and writes who read what, when and why to
-- private.mod_access_log. Nothing else exposes message bodies to the staff.
--
-- Sanctions (public.sanctions) keep their whole history: a lifted sanction
-- stays, marked lifted. A suspension or a ban blocks every write the app
-- makes (messages, posts, comments, lives, activities, communities, joins,
-- likes) in a trigger, so it holds through every RPC; a ban also ends the
-- account's sessions where the auth schema allows it. Reporting stays open.

-- ───────── Roles ─────────
create table if not exists public.staff_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'moderator', 'content')),
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);
alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon, authenticated;

create table if not exists private.admin_audit (
  id bigserial primary key,
  actor uuid,
  action text not null,
  target_user uuid,
  case_id uuid,
  details jsonb not null default '{}',
  at timestamptz not null default now()
);
create index if not exists admin_audit_at_idx on private.admin_audit (at desc);
create index if not exists admin_audit_case_idx on private.admin_audit (case_id);

create or replace function private.audit(p_action text, p_target uuid, p_case uuid, p_details jsonb default '{}')
returns void language sql security definer set search_path = public, private as $$
  insert into private.admin_audit (actor, action, target_user, case_id, details)
  values (auth.uid(), p_action, p_target, p_case, coalesce(p_details, '{}'))
$$;
revoke all on function private.audit(text, uuid, uuid, jsonb) from public, anon, authenticated;

/** The staff role of a person, or null. The historic is_admin flag counts as admin. */
create or replace function private.staff_role(uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s.role from public.staff_roles s join public.profiles p on p.id = s.user_id and p.deleted_at is null where s.user_id = uid),
    (select 'admin' from public.profiles where id = uid and deleted_at is null and is_admin)
  )
$$;
revoke all on function private.staff_role(uuid) from public, anon, authenticated;

-- Every existing admin check keeps working and now also covers owner/admin roles.
create or replace function private.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_role(uid) in ('owner', 'admin'), false)
$$;

create or replace function private.is_moderator(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_role(uid) in ('owner', 'admin', 'moderator'), false)
$$;
revoke all on function private.is_moderator(uuid) from public, anon, authenticated;

create or replace function private.staff_rank(r text) returns integer
language sql immutable as $$
  select case r when 'owner' then 4 when 'admin' then 3 when 'moderator' then 2 when 'content' then 1 else 0 end
$$;

/** The caller's staff role (null for members): the app shows the back office from it, the server re-checks every call. */
create or replace function public.my_staff_role() returns text
language sql stable security definer set search_path = public as $$
  select private.staff_role(auth.uid())
$$;
revoke all on function public.my_staff_role() from public, anon;
grant execute on function public.my_staff_role() to authenticated;

-- Only the owner may change the historic is_admin flag (an admin could set it on anyone before).
create or replace function private.lock_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.is_admin is distinct from old.is_admin
     and coalesce(private.staff_role(auth.uid()), '') <> 'owner' then
    raise exception 'only the owner can change admin rights' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists profiles_lock_is_admin on public.profiles;
create trigger profiles_lock_is_admin before update of is_admin on public.profiles
for each row execute function private.lock_is_admin();

/** First owner, from the server only (GitHub workflow "Grant owner" → Management API). */
create or replace function private.grant_owner(p_email text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare uid uuid;
begin
  select u.id into uid from auth.users u join public.profiles p on p.id = u.id and p.deleted_at is null
  where lower(to_jsonb(u) ->> 'email') = lower(btrim(p_email));
  if uid is null then raise exception 'no IRLY account with this email: sign up in the app first'; end if;
  insert into public.staff_roles (user_id, role, granted_by) values (uid, 'owner', null)
  on conflict (user_id) do update set role = 'owner', granted_at = now();
  insert into private.admin_audit (actor, action, target_user, details) values (null, 'role.owner_granted', uid, jsonb_build_object('by', 'server'));
  return uid;
end $$;
revoke all on function private.grant_owner(text) from public, anon, authenticated;

/** Owner only: give or remove a role (null removes). The owner role itself is never given here. */
create or replace function public.staff_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); old text;
begin
  if coalesce(private.staff_role(me), '') <> 'owner' then raise exception 'owner only' using errcode = '42501'; end if;
  if p_user = me then raise exception 'you cannot change your own role' using errcode = '22023'; end if;
  if p_role is not null and p_role not in ('admin', 'moderator', 'content') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'no such member' using errcode = '22023';
  end if;
  select role into old from public.staff_roles where user_id = p_user;
  if old = 'owner' then raise exception 'an owner cannot be changed here' using errcode = '42501'; end if;
  if p_role is null then
    delete from public.staff_roles where user_id = p_user;
    -- The historic flag would keep admin rights alive: it goes too.
    update public.profiles set is_admin = false where id = p_user and is_admin;
  else
    insert into public.staff_roles (user_id, role, granted_by) values (p_user, p_role, me)
    on conflict (user_id) do update set role = excluded.role, granted_by = me, granted_at = now();
  end if;
  perform private.audit('role.set', p_user, null, jsonb_build_object('from', old, 'to', p_role));
end $$;
revoke all on function public.staff_set_role(uuid, text) from public, anon;
grant execute on function public.staff_set_role(uuid, text) to authenticated;

create or replace function public.staff_list() returns table (user_id uuid, first_name text, role text, granted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  return query
    select p.id, p.first_name, private.staff_role(p.id), s.granted_at
    from public.profiles p left join public.staff_roles s on s.user_id = p.id
    where p.deleted_at is null and (s.user_id is not null or p.is_admin)
    order by private.staff_rank(private.staff_role(p.id)) desc, p.first_name;
end $$;
revoke all on function public.staff_list() from public, anon;
grant execute on function public.staff_list() to authenticated;

-- ───────── Cases: more statuses, notes ─────────
alter table public.moderation_cases drop constraint if exists moderation_cases_status_check;
alter table public.moderation_cases add constraint moderation_cases_status_check
  check (status in ('open', 'reviewing', 'need_info', 'actioned', 'dismissed', 'closed'));

create table if not exists private.case_notes (
  id bigserial primary key,
  case_id uuid not null references public.moderation_cases (id) on delete cascade,
  author uuid references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  at timestamptz not null default now()
);
create index if not exists case_notes_case_idx on private.case_notes (case_id, at);

create table if not exists private.mod_access_log (
  id bigserial primary key,
  actor uuid not null,
  case_id uuid not null,
  message_id uuid,
  reason text not null,
  at timestamptz not null default now()
);
create index if not exists mod_access_log_at_idx on private.mod_access_log (at desc);

-- ───────── Sanctions ─────────
create table if not exists public.sanctions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('warning', 'suspension', 'ban')),
  reason text not null check (char_length(reason) between 3 and 1000),
  case_id uuid references public.moderation_cases (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  ends_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id) on delete set null,
  lift_reason text
);
create index if not exists sanctions_user_idx on public.sanctions (user_id, created_at desc);
alter table public.sanctions enable row level security;
revoke all on public.sanctions from anon, authenticated;
grant select on public.sanctions to authenticated;
drop policy if exists sanctions_own on public.sanctions;
-- A member sees her own sanctions (the app tells her why she cannot post); nobody else does.
create policy sanctions_own on public.sanctions for select to authenticated using (user_id = auth.uid());

create or replace function private.is_sanctioned(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sanctions s
    where s.user_id = uid and s.kind in ('suspension', 'ban') and s.lifted_at is null
      and (s.ends_at is null or s.ends_at > now())
  )
$$;
revoke all on function private.is_sanctioned(uuid) from public, anon, authenticated;

-- Enforcement: every write the app makes goes through one of these tables,
-- whether from the client or through an RPC (triggers run either way).
create or replace function private.block_sanctioned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and private.is_sanctioned(auth.uid()) then
    raise exception 'your account is suspended' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['messages', 'community_posts', 'comments', 'irl_posts', 'activities', 'communities',
                           'activity_participants', 'community_members', 'likes', 'conversations'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_block_sanctioned', t);
      execute format('create trigger %I before insert on public.%I for each row execute function private.block_sanctioned()', t || '_block_sanctioned', t);
    end if;
  end loop;
end $$;

/** The caller's active suspension or ban, if any (the app explains it). */
create or replace function public.my_sanction() returns table (kind text, reason text, ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.kind, s.reason, s.ends_at from public.sanctions s
  where s.user_id = auth.uid() and s.kind in ('suspension', 'ban') and s.lifted_at is null
    and (s.ends_at is null or s.ends_at > now())
  order by s.created_at desc limit 1
$$;
revoke all on function public.my_sanction() from public, anon;
grant execute on function public.my_sanction() to authenticated;

-- Ends the account's sessions where the auth schema has them (Supabase does; the test shim does not).
create or replace function private.end_sessions(uid uuid, until timestamptz) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    execute 'update auth.users set banned_until = $1 where id = $2' using until, uid;
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using uid;
  end if;
end $$;
revoke all on function private.end_sessions(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.mod_sanction(p_user uuid, p_kind text, p_reason text, p_days integer default null, p_case uuid default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); mine text := private.staff_role(auth.uid()); theirs text := private.staff_role(p_user); sid uuid; ends timestamptz;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if p_user = me then raise exception 'you cannot sanction yourself' using errcode = '22023'; end if;
  if p_kind not in ('warning', 'suspension', 'ban') then raise exception 'unknown sanction' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  if private.staff_rank(theirs) >= private.staff_rank(mine) then
    raise exception 'you cannot sanction this member' using errcode = '42501';
  end if;
  if p_kind = 'suspension' and (p_days is null or p_days < 1 or p_days > 365) then
    raise exception 'a suspension lasts 1 to 365 days' using errcode = '22023';
  end if;
  -- A moderator warns and suspends for a week at most; longer and bans are for admins.
  if mine = 'moderator' and (p_kind = 'ban' or (p_kind = 'suspension' and p_days > 7)) then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such member' using errcode = '22023'; end if;
  ends := case when p_kind = 'suspension' then now() + make_interval(days => p_days) end;
  insert into public.sanctions (user_id, kind, reason, case_id, created_by, ends_at)
  values (p_user, p_kind, btrim(p_reason), p_case, me, ends) returning id into sid;
  if p_kind = 'ban' then
    perform private.end_sessions(p_user, 'infinity');
  elsif p_kind = 'suspension' then
    perform private.end_sessions(p_user, ends);
  end if;
  perform private.audit('sanction.' || p_kind, p_user, p_case, jsonb_build_object('sanction', sid, 'days', p_days, 'reason', btrim(p_reason)));
  return sid;
end $$;
revoke all on function public.mod_sanction(uuid, text, text, integer, uuid) from public, anon;
grant execute on function public.mod_sanction(uuid, text, text, integer, uuid) to authenticated;

create or replace function public.mod_lift_sanction(p_sanction uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); s public.sanctions;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  select * into s from public.sanctions where id = p_sanction;
  if s.id is null then raise exception 'no such sanction' using errcode = '22023'; end if;
  if s.lifted_at is not null then return; end if;
  if s.kind = 'ban' and not private.is_admin(me) then raise exception 'admins only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  update public.sanctions set lifted_at = now(), lifted_by = me, lift_reason = btrim(p_reason) where id = p_sanction;
  if not private.is_sanctioned(s.user_id) then perform private.end_sessions(s.user_id, null); end if;
  perform private.audit('sanction.lifted', s.user_id, s.case_id, jsonb_build_object('sanction', s.id, 'kind', s.kind, 'reason', btrim(p_reason)));
end $$;
revoke all on function public.mod_lift_sanction(uuid, text) from public, anon;
grant execute on function public.mod_lift_sanction(uuid, text) to authenticated;

-- ───────── Inbox ─────────
create or replace function public.mod_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  return jsonb_build_object(
    'new', (select count(*) from public.moderation_cases where status = 'open'),
    'high', (select count(*) from public.moderation_cases where status in ('open', 'reviewing', 'need_info') and priority = 'high'),
    'reviewing', (select count(*) from public.moderation_cases where status = 'reviewing'),
    'need_info', (select count(*) from public.moderation_cases where status = 'need_info'),
    'week', (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'sanctions', (select count(*) from public.sanctions where kind in ('suspension', 'ban') and lifted_at is null and (ends_at is null or ends_at > now())),
    'members', (select count(*) from public.profiles where deleted_at is null)
  );
end $$;
revoke all on function public.mod_dashboard() from public, anon;
grant execute on function public.mod_dashboard() to authenticated;

create or replace function public.mod_cases(p_status text default null, p_kind text default null, p_priority text default null,
  p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns table (case_id uuid, status text, priority text, created_at timestamptz, updated_at timestamptz, category text,
  target_kind text, target_id uuid, details text, reporter_id uuid, reporter_name text, target_user_id uuid, target_name text,
  reports_on_target bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  return query
    select m.id, m.status, coalesce(m.priority, 'normal'), m.created_at, m.updated_at, r.category, r.target_kind, r.target_id, r.details,
      r.reporter_id, rp.first_name, r.target_user_id, tp.first_name,
      (select count(*) from public.reports r2 where r2.target_user_id = r.target_user_id)
    from public.moderation_cases m
    join public.reports r on r.id = m.report_id
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = r.target_user_id
    where (p_status is null or m.status = p_status or (p_status = 'active' and m.status in ('open', 'reviewing', 'need_info')))
      and (p_kind is null or r.target_kind = p_kind)
      and (p_priority is null or coalesce(m.priority, 'normal') = p_priority)
      and (q is null or tp.first_name ilike '%' || q || '%' or rp.first_name ilike '%' || q || '%' or tp.username ilike '%' || q || '%'
           or r.category ilike '%' || q || '%' or m.id::text = q or r.target_user_id::text = q)
    order by (m.status = 'open') desc, (coalesce(m.priority, 'normal') = 'high') desc, m.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.mod_cases(text, text, text, text, integer, integer) from public, anon;
grant execute on function public.mod_cases(text, text, text, text, integer, integer) to authenticated;

/** One case: the report, what was reported (never a private message body: see mod_reported_message), notes, history, sanctions. */
create or replace function public.mod_case(p_case uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare m public.moderation_cases; r public.reports; target jsonb;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  select * into m from public.moderation_cases where id = p_case;
  if m.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  select * into r from public.reports where id = m.report_id;
  target := case r.target_kind
    when 'profile' then (select jsonb_build_object('name', first_name, 'bio', bio, 'username', username) from public.profiles where id = r.target_user_id)
    when 'community_post' then (select jsonb_build_object('body', body, 'removed', deleted_at is not null) from public.community_posts where id = r.target_id)
    when 'comment' then (select jsonb_build_object('body', body, 'removed', deleted_at is not null) from public.comments where id = r.target_id)
    when 'irl_post' then (select jsonb_build_object('body', body, 'removed', expires_at <= now()) from public.irl_posts where id = r.target_id)
    when 'activity' then (select jsonb_build_object('title', title, 'removed', cancelled_at is not null) from public.activities where id = r.target_id)
    when 'community' then (select jsonb_build_object('name', name, 'tagline', tagline, 'removed', deleted_at is not null) from public.communities where id = r.target_id)
    when 'message' then jsonb_build_object('private', true)
    else '{}'::jsonb end;
  return jsonb_build_object(
    'case', to_jsonb(m),
    'report', jsonb_build_object('id', r.id, 'category', r.category, 'details', r.details, 'target_kind', r.target_kind,
      'target_id', r.target_id, 'created_at', r.created_at,
      'reporter', (select jsonb_build_object('id', id, 'name', first_name) from public.profiles where id = r.reporter_id),
      'target_user', (select jsonb_build_object('id', id, 'name', first_name, 'deleted', deleted_at is not null, 'role', private.staff_role(id))
                      from public.profiles where id = r.target_user_id)),
    'target', coalesce(target, '{}'::jsonb),
    'others', (select count(*) from public.reports o where o.target_user_id = r.target_user_id and o.id <> r.id),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('body', n.body, 'at', n.at, 'author', p.first_name) order by n.at)
                       from private.case_notes n left join public.profiles p on p.id = n.author where n.case_id = m.id), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'at', a.at, 'by', p.first_name, 'details', a.details) order by a.at)
                         from private.admin_audit a left join public.profiles p on p.id = a.actor where a.case_id = m.id), '[]'),
    'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'reason', s.reason, 'created_at', s.created_at,
                            'ends_at', s.ends_at, 'lifted_at', s.lifted_at) order by s.created_at desc)
                           from public.sanctions s where s.user_id = r.target_user_id), '[]')
  );
end $$;
revoke all on function public.mod_case(uuid) from public, anon;
grant execute on function public.mod_case(uuid) to authenticated;

create or replace function public.mod_case_update(p_case uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); old text; tuid uuid;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if p_status not in ('open', 'reviewing', 'need_info', 'actioned', 'dismissed', 'closed') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  select m.status, r.target_user_id into old, tuid from public.moderation_cases m join public.reports r on r.id = m.report_id where m.id = p_case;
  if old is null then raise exception 'no such case' using errcode = '22023'; end if;
  update public.moderation_cases set status = p_status, assignee_id = me,
    decision = coalesce(nullif(btrim(coalesce(p_note, '')), ''), decision) where id = p_case;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into private.case_notes (case_id, author, body) values (p_case, me, left(btrim(p_note), 2000));
  end if;
  perform private.audit('case.status', tuid, p_case, jsonb_build_object('from', old, 'to', p_status));
end $$;
revoke all on function public.mod_case_update(uuid, text, text) from public, anon;
grant execute on function public.mod_case_update(uuid, text, text) to authenticated;

create or replace function public.mod_case_note(p_case uuid, p_body text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_body, ''))) = 0 then raise exception 'write a note' using errcode = '22023'; end if;
  if not exists (select 1 from public.moderation_cases where id = p_case) then raise exception 'no such case' using errcode = '22023'; end if;
  insert into private.case_notes (case_id, author, body) values (p_case, auth.uid(), left(btrim(p_body), 2000));
end $$;
revoke all on function public.mod_case_note(uuid, text) from public, anon;
grant execute on function public.mod_case_note(uuid, text) to authenticated;

/**
 * The reported private message and its immediate context (3 before, 3 after,
 * same conversation), for a case about that message only. A reason is
 * required and every read is logged. Any other conversation stays closed.
 */
create or replace function public.mod_reported_message(p_case uuid, p_reason text)
returns table (id uuid, sender_id uuid, sender_name text, body text, kind text, created_at timestamptz, reported boolean, removed boolean)
language plpgsql security definer set search_path = public, private as $$
declare r public.reports; msg public.messages;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'say why you need to read it' using errcode = '22023'; end if;
  select rr.* into r from public.moderation_cases m join public.reports rr on rr.id = m.report_id where m.id = p_case;
  if r.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  if r.target_kind <> 'message' or r.target_id is null then raise exception 'this case is not about a message' using errcode = '42501'; end if;
  select * into msg from public.messages where messages.id = r.target_id;
  if msg.id is null then raise exception 'the message no longer exists' using errcode = '22023'; end if;
  insert into private.mod_access_log (actor, case_id, message_id, reason) values (auth.uid(), p_case, msg.id, left(btrim(p_reason), 500));
  perform private.audit('message.read', r.target_user_id, p_case, jsonb_build_object('message', msg.id));
  return query
    with around as (
      (select * from public.messages x where x.conversation_id = msg.conversation_id and x.created_at < msg.created_at order by x.created_at desc limit 3)
      union all select msg.*
      union all
      (select * from public.messages x where x.conversation_id = msg.conversation_id and x.created_at > msg.created_at order by x.created_at limit 3)
    )
    select a.id, a.sender_id, p.first_name, a.body, a.kind, a.created_at, a.id = msg.id, a.deleted_at is not null
    from around a left join public.profiles p on p.id = a.sender_id
    order by a.created_at;
end $$;
revoke all on function public.mod_reported_message(uuid, text) from public, anon;
grant execute on function public.mod_reported_message(uuid, text) to authenticated;

/** Takes the reported content down (admins): a post, comment, live, message, activity or community. */
create or replace function public.mod_remove_content(p_case uuid, p_note text) returns void
language plpgsql security definer set search_path = public, private as $$
declare r public.reports;
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  select rr.* into r from public.moderation_cases m join public.reports rr on rr.id = m.report_id where m.id = p_case;
  if r.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  case r.target_kind
    when 'irl_post' then update public.irl_posts set expires_at = now() where id = r.target_id;
    when 'comment' then update public.comments set deleted_at = now() where id = r.target_id and deleted_at is null;
    when 'community_post' then update public.community_posts set deleted_at = now() where id = r.target_id and deleted_at is null;
    when 'message' then update public.messages set deleted_at = now() where id = r.target_id and deleted_at is null;
    when 'activity' then update public.activities set cancelled_at = now() where id = r.target_id and cancelled_at is null;
    when 'community' then update public.communities set deleted_at = now() where id = r.target_id and deleted_at is null;
    else raise exception 'nothing to take down for this kind of report' using errcode = '22023';
  end case;
  update public.moderation_cases set status = 'actioned', assignee_id = auth.uid(), decision = btrim(p_note) where id = p_case;
  insert into private.case_notes (case_id, author, body) values (p_case, auth.uid(), left(btrim(p_note), 2000));
  perform private.audit('content.removed', r.target_user_id, p_case, jsonb_build_object('kind', r.target_kind, 'id', r.target_id));
end $$;
revoke all on function public.mod_remove_content(uuid, text) from public, anon;
grant execute on function public.mod_remove_content(uuid, text) to authenticated;

-- ───────── Members ─────────
create or replace function public.mod_users(p_search text, p_limit integer default 30)
returns table (user_id uuid, first_name text, username text, email text, created_at timestamptz, deleted boolean,
  role text, sanction text, sanction_ends timestamptz, reports bigint)
language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(btrim(coalesce(p_search, '')), ''); admin boolean := private.is_admin(auth.uid());
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  return query
    select p.id, p.first_name, p.username,
      -- Emails are for admins (support), not moderators.
      case when admin then (select to_jsonb(u) ->> 'email' from auth.users u where u.id = p.id) end,
      p.created_at, p.deleted_at is not null, private.staff_role(p.id),
      (select s.kind from public.sanctions s where s.user_id = p.id and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
       order by private.staff_rank(s.kind) desc, s.created_at desc limit 1),
      (select s.ends_at from public.sanctions s where s.user_id = p.id and s.lifted_at is null and (s.ends_at is null or s.ends_at > now())
       order by s.created_at desc limit 1),
      (select count(*) from public.reports r where r.target_user_id = p.id)
    from public.profiles p
    where q is null or p.first_name ilike '%' || q || '%' or p.username ilike '%' || q || '%' or p.id::text = q
      or (admin and exists (select 1 from auth.users u where u.id = p.id and lower(to_jsonb(u) ->> 'email') = lower(q)))
    order by (select count(*) from public.reports r where r.target_user_id = p.id) desc, p.created_at desc
    limit least(greatest(coalesce(p_limit, 30), 1), 100);
end $$;
revoke all on function public.mod_users(text, integer) from public, anon;
grant execute on function public.mod_users(text, integer) to authenticated;

create or replace function public.mod_user_sanctions(p_user uuid)
returns table (id uuid, kind text, reason text, created_at timestamptz, ends_at timestamptz, lifted_at timestamptz, by_name text, lift_reason text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  return query
    select s.id, s.kind, s.reason, s.created_at, s.ends_at, s.lifted_at, p.first_name, s.lift_reason
    from public.sanctions s left join public.profiles p on p.id = s.created_by
    where s.user_id = p_user order by s.created_at desc;
end $$;
revoke all on function public.mod_user_sanctions(uuid) from public, anon;
grant execute on function public.mod_user_sanctions(uuid) to authenticated;

-- ───────── Audit ─────────
create or replace function public.mod_audit(p_limit integer default 100)
returns table (at timestamptz, actor_name text, action text, target_name text, case_id uuid, details jsonb)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  return query
    select a.at, coalesce(pa.first_name, 'IRLY server'), a.action, pt.first_name, a.case_id, a.details
    from private.admin_audit a left join public.profiles pa on pa.id = a.actor left join public.profiles pt on pt.id = a.target_user
    order by a.at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;
revoke all on function public.mod_audit(integer) from public, anon;
grant execute on function public.mod_audit(integer) to authenticated;

create or replace function public.mod_access_reads(p_limit integer default 100)
returns table (at timestamptz, actor_name text, case_id uuid, reason text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
  return query
    select l.at, p.first_name, l.case_id, l.reason from private.mod_access_log l left join public.profiles p on p.id = l.actor
    order by l.at desc limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;
revoke all on function public.mod_access_reads(integer) from public, anon;
grant execute on function public.mod_access_reads(integer) to authenticated;

-- ───────── Retention ─────────
-- Closed cases go like actioned and dismissed ones; reads of private
-- messages are kept 12 months, the staff audit 24 months.
create or replace function private.purge_retention() returns void
language plpgsql security definer set search_path = public, private as $$
begin
  delete from public.reports r
  using public.moderation_cases m
  where m.report_id = r.id and m.status in ('actioned', 'dismissed', 'closed') and m.updated_at < now() - interval '12 months';
  delete from private.removed_content where removed_at < now() - interval '12 months';
  delete from public.support_requests where created_at < now() - interval '24 months';
  delete from public.waitlist where created_at < now() - interval '24 months';
  delete from private.mod_access_log where at < now() - interval '12 months';
  delete from private.admin_audit where at < now() - interval '24 months';
end $$;
revoke all on function private.purge_retention() from public, anon, authenticated;
