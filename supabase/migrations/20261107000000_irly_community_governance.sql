-- Community governance: co-admins, per-community bans, restrictions and
-- warnings, an append-only audit log, and the RPCs that run them
-- (docs/COMMUNITIES-CONTRACT.md, Migration A).
-- Additive and idempotent: functions are replaced, policies and triggers are
-- dropped if they exist and created again, CHECK constraints are only widened.
-- No row is removed by this migration, RLS stays on everywhere.
--
-- Ranks (server truth): owner 3 > co_admin 2 > moderator 1 > member 0. Nobody
-- acts on someone of equal or higher rank. IRLY admins act above every rank,
-- as before. The owner of a community also runs its groups (as before).
-- A co-admin's rights are booleans in community_members.permissions; a
-- moderator always has moderation and activities.
--
-- What does not change: any member in good standing creates a community
-- activity, with no role and no approval (activities_create, untouched).
-- A ban or a running restriction is the only thing that stops it.
--
--  1. Roles and permissions   co_admin, community_members.permissions.
--  2. Sanction tables         community_bans, community_restrictions,
--                             community_warnings; community_audit (append-only).
--  3. Notifications           new kinds for roles, warnings, bans,
--                             restrictions and ownership.
--  4. Rights                  one function computes them, every RPC reads it.
--  5. Enforcement             a ban closes join and i_belong; a restriction
--                             stops posts, chat and activities.
--  6. Co-admins in the existing rules (moderates, covers, settings).
--  7. RPCs                    roles, permissions, ownership, kick, ban, warn,
--                             restrict, moderation of activities and messages,
--                             sanctions list, audit log, stats.
--  8. set_community_role and remove_community_member go through the new rules.

-- ───────── 1. Roles and permissions ─────────
alter table public.community_members drop constraint if exists community_members_role_check;
alter table public.community_members add constraint community_members_role_check
  check (role in ('member', 'moderator', 'co_admin', 'owner'));
alter table public.community_members add column if not exists permissions jsonb not null default '{}';

-- ───────── 2. Sanction tables ─────────
create table if not exists public.community_bans (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  until timestamptz, -- null: permanent
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_bans_user_idx on public.community_bans (user_id);

create table if not exists public.community_restrictions (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_restrictions_user_idx on public.community_restrictions (user_id);

create table if not exists public.community_warnings (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists community_warnings_idx on public.community_warnings (community_id, user_id, created_at desc);

-- The journal keeps plain ids (no foreign key): nothing cascades into it.
create table if not exists public.community_audit (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  actor uuid,
  action text not null,
  target_user uuid,
  target_id uuid,
  reason text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists community_audit_idx on public.community_audit (community_id, created_at desc);

alter table public.community_bans enable row level security;
alter table public.community_restrictions enable row level security;
alter table public.community_warnings enable row level security;
alter table public.community_audit enable row level security;

-- Each member reads her own; the managers read through community_sanctions.
-- Every write goes through the RPCs below (security definer).
drop policy if exists community_bans_self on public.community_bans;
create policy community_bans_self on public.community_bans for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists community_restrictions_self on public.community_restrictions;
create policy community_restrictions_self on public.community_restrictions for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists community_warnings_self on public.community_warnings;
create policy community_warnings_self on public.community_warnings for select to authenticated
  using (user_id = (select auth.uid()));
-- community_audit: read through community_audit_log only (this rule reads nothing).
drop policy if exists community_audit_read on public.community_audit;
create policy community_audit_read on public.community_audit for select to authenticated using (false);

revoke all on public.community_bans, public.community_restrictions, public.community_warnings, public.community_audit from public, anon, authenticated;
grant select on public.community_bans, public.community_restrictions, public.community_warnings to authenticated;

/** The audit log is append-only: no update or delete, for anyone. */
create or replace function private.community_audit_frozen() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'the community audit log is append-only' using errcode = '42501';
end $$;
revoke all on function private.community_audit_frozen() from public, anon, authenticated;
drop trigger if exists community_audit_frozen on public.community_audit;
create trigger community_audit_frozen before update or delete on public.community_audit
for each row execute function private.community_audit_frozen();
drop trigger if exists community_audit_no_truncate on public.community_audit;
create trigger community_audit_no_truncate before truncate on public.community_audit
for each statement execute function private.community_audit_frozen();

-- ───────── 3. Notifications ─────────
-- The kinds already allowed stay; the new ones are added once.
do $$
declare
  def text;
  kinds text[];
  k text;
  added boolean := false;
begin
  select pg_get_constraintdef(c.oid) into def from pg_constraint c
  where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_kind_check';
  if def is null then return; end if;
  -- Either form: ARRAY['A'::text, …] or '{A,B,…}'::text[].
  if position('{' in def) > 0 then
    kinds := string_to_array(substring(def from '\{([^}]*)\}'), ',');
  else
    select array_agg(m.x[1]) into kinds from regexp_matches(def, '''([A-Z_]+)''', 'g') as m(x);
  end if;
  if coalesce(cardinality(kinds), 0) = 0 then
    raise exception using message = 'notifications_kind_check: kinds not found', detail = def;
  end if;
  foreach k in array array['COMMUNITY_ROLE', 'COMMUNITY_WARNING', 'COMMUNITY_BAN', 'COMMUNITY_RESTRICTION', 'COMMUNITY_OWNERSHIP'] loop
    if not k = any (kinds) then
      kinds := kinds || k;
      added := true;
    end if;
  end loop;
  if not added then return; end if;
  alter table public.notifications drop constraint notifications_kind_check;
  execute format('alter table public.notifications add constraint notifications_kind_check check (kind = any (%L::text[]))', kinds);
end $$;

-- ───────── 4. Rights ─────────
/** The rank of a role: owner 3, co_admin 2, moderator 1, member 0, anything else -1. */
create or replace function private.community_role_rank(p_role text) returns integer
language sql immutable set search_path = public as $$
  select case p_role when 'owner' then 3 when 'co_admin' then 2 when 'moderator' then 1 when 'member' then 0 else -1 end
$$;
revoke all on function private.community_role_rank(text) from public, anon, authenticated;

/** A member's rank in a community, counting her role in its parent (-1: not a member). */
create or replace function private.community_rank(cid uuid, uid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(private.community_role_rank(m.role)), -1)
  from public.community_members m
  where m.user_id = uid
    and m.community_id in (cid, (select c.parent_id from public.communities c where c.id = cid))
$$;
revoke all on function private.community_rank(uuid, uuid) from public, anon, authenticated;

/** The seven permission keys, every one a boolean (missing or not boolean: false). */
create or replace function private.community_perms_clean(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_object_agg(k, coalesce(jsonb_typeof(p -> k) = 'boolean' and (p ->> k)::boolean, false))
  from unnest(array['members', 'moderation', 'announcements', 'activities', 'settings', 'stats', 'roles']) k
$$;
revoke all on function private.community_perms_clean(jsonb) from public, anon, authenticated;

/** A running ban of a member, in the community or its parent. */
create or replace function private.community_banned(cid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.community_bans b
    where b.user_id = uid and (b.until is null or b.until > now())
      and b.community_id in (cid, (select c.parent_id from public.communities c where c.id = cid))
  )
$$;
revoke all on function private.community_banned(uuid, uuid) from public, anon, authenticated;

/** The end of a running restriction of a member, in the community or its parent (null: none). */
create or replace function private.community_restricted_until(cid uuid, uid uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select max(r.until) from public.community_restrictions r
  where r.user_id = uid and r.until > now()
    and r.community_id in (cid, (select c.parent_id from public.communities c where c.id = cid))
$$;
revoke all on function private.community_restricted_until(uuid, uuid) from public, anon, authenticated;

/**
 * What a person may do in a community (null when it does not exist). Without
 * IRLY Girl access, a women-only community gives no rights at all.
 * can_announce is what announce() checks (private.moderates).
 */
create or replace function private.community_rights_for(cid uuid, uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c public.communities;
  admin boolean := coalesce(private.is_admin(uid), false);
  rank integer;
  perms jsonb;
  ban public.community_bans;
  closed boolean;
  all_perms constant jsonb := '{"members": true, "moderation": true, "announcements": true, "activities": true, "settings": true, "stats": true, "roles": true}';
begin
  select * into c from public.communities where id = cid and deleted_at is null;
  if not found then return null; end if;
  closed := uid is null or (c.girl_only and not admin and not private.girl_eligible_unchecked(uid));
  rank := case when closed then -1 else private.community_rank(cid, uid) end;
  perms := case
    when not closed and (admin or rank = 3) then all_perms
    when rank = 2 then private.community_perms_clean(coalesce((
      select jsonb_object_agg(e.key, e.value) from public.community_members m, jsonb_each(m.permissions) e
      where m.user_id = uid and m.role = 'co_admin' and jsonb_typeof(e.value) = 'boolean' and e.value = 'true'::jsonb
        and m.community_id in (cid, c.parent_id)), '{}'))
    when rank = 1 then private.community_perms_clean('{"moderation": true, "activities": true}')
    else private.community_perms_clean('{}')
  end;
  select * into ban from public.community_bans b
  where b.user_id = uid and (b.until is null or b.until > now()) and b.community_id in (cid, c.parent_id)
  order by b.until desc nulls first limit 1;
  return jsonb_build_object(
    'role', case rank when 3 then 'owner' when 2 then 'co_admin' when 1 then 'moderator' when 0 then 'member' end,
    'rank', case when admin and not closed then 4 else rank end,
    'is_admin', admin and not closed,
    'permissions', perms,
    'can_manage_members', (perms ->> 'members')::boolean,
    'can_moderate', (perms ->> 'moderation')::boolean,
    'can_roles', (perms ->> 'roles')::boolean,
    'can_settings', (perms ->> 'settings')::boolean,
    'can_stats', (perms ->> 'stats')::boolean,
    'can_announce', not closed and rank >= 1 and (rank <> 2 or (perms ->> 'moderation')::boolean) or (admin and not closed),
    'can_official', admin and not closed,
    'banned', ban.user_id is not null,
    'banned_until', ban.until,
    'restricted_until', private.community_restricted_until(cid, uid)
  );
end $$;
revoke all on function private.community_rights_for(uuid, uuid) from public, anon, authenticated;

/** The caller's rights in a community, after the checks every RPC shares (sign-in, community, IRLY Girl). */
create or replace function private.community_act(cid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = cid and deleted_at is null) then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if private.girl_target('community', cid::text) and not private.girl_eligible_unchecked(me) and not private.is_admin(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return private.community_rights_for(cid, me);
end $$;
revoke all on function private.community_act(uuid) from public, anon, authenticated;

/** Raises unless the caller outranks the target (never oneself). */
create or replace function private.community_outranks(cid uuid, rights jsonb, target uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if target is null then raise exception 'who?' using errcode = '22023'; end if;
  if target = auth.uid() then raise exception 'not on yourself' using errcode = '22023'; end if;
  if private.community_rank(cid, target) >= (rights ->> 'rank')::integer then
    raise exception 'not on someone of your rank or above' using errcode = '42501';
  end if;
end $$;
revoke all on function private.community_outranks(uuid, jsonb, uuid) from public, anon, authenticated;

/** One line of the audit log, by the caller. */
create or replace function private.community_log(cid uuid, p_action text, p_target uuid, p_target_id uuid, p_reason text, p_meta jsonb default '{}')
returns void
language sql security definer set search_path = public as $$
  insert into public.community_audit (community_id, actor, action, target_user, target_id, reason, meta)
  values (cid, auth.uid(), p_action, p_target, p_target_id, nullif(left(btrim(coalesce(p_reason, '')), 500), ''), coalesce(p_meta, '{}'))
$$;
revoke all on function private.community_log(uuid, text, uuid, uuid, text, jsonb) from public, anon, authenticated;

/** A notification about a community (its id and name in the payload, as COMMUNITY_POST has). */
create or replace function private.community_notify(uid uuid, p_kind text, cid uuid, p_extra jsonb default '{}')
returns void
language sql security definer set search_path = public as $$
  select private.notify(uid, p_kind, jsonb_build_object('community_id', cid,
    'community', (select c.name from public.communities c where c.id = cid)) || coalesce(p_extra, '{}'))
$$;
revoke all on function private.community_notify(uuid, text, uuid, jsonb) from public, anon, authenticated;

-- ───────── 5. Enforcement ─────────
-- Last defined in 20261027300000_irly_communities_activities. A running ban
-- (here or in the parent) means not belonging, whatever the rows say.
create or replace function private.i_belong(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.community_members where community_id = cid and user_id = auth.uid())
    and exists (select 1 from public.communities c where c.id = cid and c.deleted_at is null
      and (not c.girl_only or private.girl_eligible_unchecked(auth.uid())))
    and not private.community_banned(cid, auth.uid())
$$;

-- Last defined in 20261019000500_irly_join_needs_profile. Same rules, and a
-- banned member does not come back.
create or replace function public.join_community(p_community uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
  me uuid := auth.uid();
  added integer;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  perform private.require_profile(me);
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.community_banned(p_community, me) then
    raise exception 'you were banned from this community' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id) values (p_community, me) on conflict do nothing;
  get diagnostics added = row_count;
  conv := private.ensure_conversation('community', p_community, c.name);
  insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
  if added > 0 then
    perform private.notify(me, 'COMMUNITY_JOINED', jsonb_build_object('community_id', p_community, 'conversation_id', conv));
  end if;
  return conv;
end $$;
revoke all on function public.join_community(uuid) from public, anon;
grant execute on function public.join_community(uuid) to authenticated;

/** Whatever the way in (join, a group's parent, an invitation), a banned member is not added back. */
create or replace function private.community_ban_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if private.community_banned(new.community_id, new.user_id) then
    raise exception 'you were banned from this community' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.community_ban_guard() from public, anon, authenticated;
drop trigger if exists community_members_ban_guard on public.community_members;
create trigger community_members_ban_guard before insert on public.community_members
for each row execute function private.community_ban_guard();

/**
 * While a restriction runs, its member writes nothing in the community: no
 * post, no chat message, no activity linked to it. Banned members neither.
 */
create or replace function private.community_write_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  actor uuid;
  until timestamptz;
begin
  if tg_table_name = 'activities' then
    cid := new.community_id;
    actor := new.creator_id;
    if tg_op = 'UPDATE' and cid is not distinct from old.community_id then return new; end if;
  elsif tg_table_name = 'community_posts' then
    cid := new.community_id;
    actor := new.author_id;
  else
    select v.community_id into cid from public.conversations v where v.id = new.conversation_id;
    actor := new.sender_id;
  end if;
  if cid is null or actor is null then return new; end if;
  if private.community_banned(cid, actor) then
    raise exception 'you were banned from this community' using errcode = '42501';
  end if;
  until := private.community_restricted_until(cid, actor);
  if until is not null then
    raise exception 'you are restricted in this community until %', to_char(until at time zone 'UTC', 'YYYY-MM-DD HH24:MI "UTC"')
      using errcode = '42501', hint = 'community_restricted';
  end if;
  return new;
end $$;
revoke all on function private.community_write_guard() from public, anon, authenticated;
drop trigger if exists activities_community_restricted on public.activities;
create trigger activities_community_restricted before insert or update of community_id on public.activities
for each row execute function private.community_write_guard();
drop trigger if exists community_posts_community_restricted on public.community_posts;
create trigger community_posts_community_restricted before insert on public.community_posts
for each row execute function private.community_write_guard();
drop trigger if exists messages_community_restricted on public.messages;
create trigger messages_community_restricted before insert on public.messages
for each row execute function private.community_write_guard();

-- ───────── 6. Co-admins in the existing rules ─────────
-- Last defined in 20261020001000_irly_security_audit. A co-admin with the
-- moderation permission moderates, as a moderator does.
create or replace function private.moderates(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.is_admin(auth.uid()) or (
    exists (
      select 1 from public.community_members m
      where m.user_id = auth.uid()
        and (m.role in ('owner', 'moderator') or (m.role = 'co_admin' and m.permissions @> '{"moderation": true}'))
        and m.community_id in (cid, (select parent_id from public.communities where id = cid))
    )
    and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
         or private.girl_eligible_unchecked(auth.uid()))
  )
$$;

-- Last defined in 20261025000100_irly_girl_isolation. Co-admins too.
create or replace function public.set_community_cover(p_community uuid, p_path text)
returns void
language plpgsql security definer set search_path = public, private as $$
declare staff boolean := private.is_content_staff(auth.uid());
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.communities where id = p_community and deleted_at is null) then
    raise exception 'this community no longer exists' using errcode = 'P0002';
  end if;
  if not staff and private.girl_target('community', p_community::text) and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if not staff and not exists (
    select 1 from public.community_members m
    where m.community_id = p_community and m.user_id = auth.uid() and m.role in ('owner', 'co_admin', 'moderator')
  ) then
    raise exception 'only the community owner or a moderator can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.communities set cover_path = p_path where id = p_community;
  if staff then
    perform private.audit('cover.community', (select created_by from public.communities where id = p_community), null,
      jsonb_build_object('community', p_community, 'reset', p_path is null));
  end if;
end $$;

-- Last defined in 20261025000100_irly_girl_isolation. Co-admins too.
create or replace function public.set_conversation_photo(p_conversation uuid, p_path text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into conv from public.conversations where id = p_conversation;
  if conv.id is null or conv.kind not in ('group', 'activity', 'community') then
    raise exception 'this chat has no photo of its own' using errcode = '42501';
  end if;
  if private.girl_chat(conv.id) and not private.girl_eligible_unchecked(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  if not (
    exists (select 1 from public.conversation_members where conversation_id = conv.id and user_id = auth.uid() and role = 'admin')
    or (conv.community_id is not null and exists (
      select 1 from public.community_members where community_id = conv.community_id and user_id = auth.uid() and role in ('owner', 'co_admin', 'moderator')))
  ) then
    raise exception 'only the chat admin can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.conversations set photo_path = p_path where id = conv.id;
end $$;

-- A co-admin with the settings permission edits the community as the owner
-- does (communities_owner, untouched), but never deletes or moves it.
drop policy if exists communities_co_admin on public.communities;
create policy communities_co_admin on public.communities for update to authenticated
  using (exists (
    select 1 from public.community_members m
    where m.community_id = communities.id and m.user_id = (select auth.uid())
      and m.role = 'co_admin' and m.permissions @> '{"settings": true}'
  ));

create or replace function private.community_co_admin_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null or private.i_am_staff() then return new; end if;
  if (new.deleted_at, new.parent_id, new.subtopic) is not distinct from (old.deleted_at, old.parent_id, old.subtopic) then
    return new;
  end if;
  if exists (select 1 from public.community_members m where m.community_id = old.id and m.user_id = auth.uid() and m.role = 'co_admin')
     and not exists (select 1 from public.community_members m where m.user_id = auth.uid() and m.role = 'owner'
                     and m.community_id in (old.id, old.parent_id)) then
    raise exception 'only the owner can delete or move the community' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.community_co_admin_guard() from public, anon, authenticated;
drop trigger if exists communities_co_admin_guard on public.communities;
create trigger communities_co_admin_guard before update on public.communities
for each row execute function private.community_co_admin_guard();

-- ───────── 7. RPCs ─────────
/**
 * The caller's rights: { role, rank, is_admin, permissions, can_manage_members,
 * can_moderate, can_roles, can_settings, can_stats, can_announce, can_official,
 * banned, banned_until, restricted_until }.
 */
create or replace function public.community_my_rights(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  return private.community_act(p_community);
end $$;

/**
 * Sets a member's role: co_admin, moderator or member. The owner gives any of
 * them; a co-admin with the roles permission names or removes moderators,
 * on members and moderators only. Never the owner, never oneself.
 */
create or replace function public.community_set_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  old_role text;
  default_perms constant jsonb := '{"members": true, "moderation": true, "announcements": true, "activities": true, "settings": false, "stats": true, "roles": false}';
begin
  if p_role is null or p_role not in ('co_admin', 'moderator', 'member') then
    raise exception 'role: co_admin, moderator or member' using errcode = '22023';
  end if;
  r := private.community_act(p_community);
  if not (r ->> 'can_roles')::boolean then
    raise exception 'only the owner or IRLY can change roles' using errcode = '42501';
  end if;
  select role into old_role from public.community_members where community_id = p_community and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  if old_role = 'owner' then raise exception 'the owner''s role cannot be changed' using errcode = '42501'; end if;
  perform private.community_outranks(p_community, r, p_user);
  if (p_role = 'co_admin' or old_role = 'co_admin') and (r ->> 'rank')::integer < 3 then
    raise exception 'only the owner names or removes co-admins' using errcode = '42501';
  end if;
  if old_role = p_role then return; end if;
  update public.community_members
  set role = p_role, permissions = case when p_role = 'co_admin' then default_perms else '{}' end
  where community_id = p_community and user_id = p_user;
  perform private.community_log(p_community, 'role.set', p_user, null, null, jsonb_build_object('from', old_role, 'to', p_role));
  perform private.community_notify(p_user, 'COMMUNITY_ROLE', p_community, jsonb_build_object('role', p_role, 'previous', old_role));
end $$;

/** The owner sets a co-admin's permissions (the seven keys; anything else is ignored). */
create or replace function public.community_set_permissions(p_community uuid, p_user uuid, p_perms jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  clean jsonb;
  before jsonb;
begin
  r := private.community_act(p_community);
  if coalesce(r ->> 'role', '') <> 'owner' then
    raise exception 'only the owner sets permissions' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then raise exception 'not on yourself' using errcode = '22023'; end if;
  if p_perms is null or jsonb_typeof(p_perms) <> 'object' then
    raise exception 'permissions: an object of booleans' using errcode = '22023';
  end if;
  select permissions into before from public.community_members
  where community_id = p_community and user_id = p_user and role = 'co_admin' for update;
  if not found then raise exception 'permissions are for co-admins' using errcode = '22023'; end if;
  clean := private.community_perms_clean(p_perms);
  update public.community_members set permissions = clean where community_id = p_community and user_id = p_user;
  perform private.community_log(p_community, 'permissions.set', p_user, null, null,
    jsonb_build_object('from', private.community_perms_clean(before), 'to', clean));
  return clean;
end $$;

/** A co-admin's current permissions (the seven keys), for the owner. */
create or replace function public.community_permissions(p_community uuid, p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
  perms jsonb;
begin
  r := private.community_act(p_community);
  if coalesce(r ->> 'role', '') <> 'owner' then
    raise exception 'only the owner reads permissions' using errcode = '42501';
  end if;
  select permissions into perms from public.community_members
  where community_id = p_community and user_id = p_user and role = 'co_admin';
  if not found then raise exception 'permissions are for co-admins' using errcode = '22023'; end if;
  return private.community_perms_clean(perms);
end $$;

/** The owner hands the community to a member, and stays as a co-admin with every permission. */
create or replace function public.community_transfer_ownership(p_community uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
begin
  perform private.community_act(p_community);
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = me and role = 'owner') then
    raise exception 'only the owner hands the community over' using errcode = '42501';
  end if;
  if p_user is null or p_user = me then raise exception 'choose another member' using errcode = '22023'; end if;
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  if private.girl_target('community', p_community::text) and not private.girl_eligible_unchecked(p_user) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  update public.community_members set role = 'owner', permissions = '{}' where community_id = p_community and user_id = p_user;
  update public.community_members set role = 'co_admin', permissions = private.community_perms_clean(
    '{"members": true, "moderation": true, "announcements": true, "activities": true, "settings": true, "stats": true, "roles": true}')
  where community_id = p_community and user_id = me;
  -- The new owner runs the community chat too.
  select id into conv from public.conversations where community_id = p_community;
  if conv is not null then
    perform set_config('irly.trusted', 'on', true);
    update public.conversation_members set role = 'admin' where conversation_id = conv and user_id = p_user and role <> 'admin';
    perform set_config('irly.trusted', 'off', true);
  end if;
  perform private.community_log(p_community, 'ownership.transfer', p_user, null, null, jsonb_build_object('from', me));
  perform private.community_notify(p_user, 'COMMUNITY_OWNERSHIP', p_community);
end $$;

/** Removes a member (she keeps her account and may join again). */
create or replace function public.community_kick(p_community uuid, p_user uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  if not ((r ->> 'can_moderate')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'only the community''s owner and moderators can remove a member' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then raise exception 'to leave a community, use Leave' using errcode = '22023'; end if;
  perform 1 from public.community_members where community_id = p_community and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  perform private.community_outranks(p_community, r, p_user);
  delete from public.community_members where community_id = p_community and user_id = p_user;
  perform private.community_log(p_community, 'member.kick', p_user, null, p_reason);
end $$;

/** Bans a person (until a date, or for good): out of the community and its groups, and kept out. */
create or replace function public.community_ban(p_community uuid, p_user uuid, p_reason text, p_until timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  r := private.community_act(p_community);
  if not (r ->> 'can_manage_members')::boolean then
    raise exception 'only the owner or a co-admin in charge of members can ban' using errcode = '42501';
  end if;
  if p_until is not null and p_until <= now() then raise exception 'the end of a ban is in the future' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'not found' using errcode = 'P0002'; end if;
  perform private.community_outranks(p_community, r, p_user);
  insert into public.community_bans (community_id, user_id, reason, until, created_by)
  values (p_community, p_user, why, p_until, auth.uid())
  on conflict (community_id, user_id) do update
    set reason = excluded.reason, until = excluded.until, created_by = excluded.created_by, created_at = now();
  delete from public.community_members where community_id = p_community and user_id = p_user;
  perform private.community_log(p_community, 'member.ban', p_user, null, why, jsonb_build_object('until', p_until));
  perform private.community_notify(p_user, 'COMMUNITY_BAN', p_community, jsonb_build_object('until', p_until, 'reason', why));
end $$;

create or replace function public.community_unban(p_community uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  if not (r ->> 'can_manage_members')::boolean then
    raise exception 'only the owner or a co-admin in charge of members can lift a ban' using errcode = '42501';
  end if;
  delete from public.community_bans where community_id = p_community and user_id = p_user;
  if not found then raise exception 'not banned' using errcode = 'P0002'; end if;
  perform private.community_log(p_community, 'member.unban', p_user, null, null);
end $$;

/** A written warning to a member. */
create or replace function public.community_warn(p_community uuid, p_user uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  why text := left(btrim(coalesce(p_reason, '')), 500);
  wid uuid;
begin
  r := private.community_act(p_community);
  if not ((r ->> 'can_moderate')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'only the community''s owner and moderators can warn' using errcode = '42501';
  end if;
  if char_length(why) < 3 then raise exception 'say why' using errcode = '22023'; end if;
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  perform private.community_outranks(p_community, r, p_user);
  insert into public.community_warnings (community_id, user_id, reason, created_by)
  values (p_community, p_user, why, auth.uid()) returning id into wid;
  perform private.community_log(p_community, 'member.warn', p_user, wid, why);
  perform private.community_notify(p_user, 'COMMUNITY_WARNING', p_community, jsonb_build_object('reason', why));
  return wid;
end $$;

/** Until the date, the member writes nothing in the community (posts, chat, activities); she still reads it. */
create or replace function public.community_restrict(p_community uuid, p_user uuid, p_until timestamptz, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  why text := nullif(left(btrim(coalesce(p_reason, '')), 500), '');
begin
  r := private.community_act(p_community);
  if not ((r ->> 'can_moderate')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'only the community''s owner and moderators can restrict' using errcode = '42501';
  end if;
  if p_until is null or p_until <= now() then raise exception 'the end of a restriction is in the future' using errcode = '22023'; end if;
  if not exists (select 1 from public.community_members where community_id = p_community and user_id = p_user) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;
  perform private.community_outranks(p_community, r, p_user);
  insert into public.community_restrictions (community_id, user_id, until, reason, created_by)
  values (p_community, p_user, p_until, why, auth.uid())
  on conflict (community_id, user_id) do update
    set until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  perform private.community_log(p_community, 'member.restrict', p_user, null, why, jsonb_build_object('until', p_until));
  perform private.community_notify(p_user, 'COMMUNITY_RESTRICTION', p_community, jsonb_build_object('until', p_until, 'reason', why));
end $$;

create or replace function public.community_unrestrict(p_community uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  if not ((r ->> 'can_moderate')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'only the community''s owner and moderators can lift a restriction' using errcode = '42501';
  end if;
  perform private.community_outranks(p_community, r, p_user);
  delete from public.community_restrictions where community_id = p_community and user_id = p_user;
  if not found then raise exception 'not restricted' using errcode = 'P0002'; end if;
  perform private.community_log(p_community, 'member.unrestrict', p_user, null, null);
end $$;

/** Running bans and restrictions, and every warning, of the community (or of one person). Managers only. */
create or replace function public.community_sanctions(p_community uuid, p_user uuid default null)
returns table (kind text, user_id uuid, name text, reason text, until timestamptz, created_by uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  if not ((r ->> 'can_moderate')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'managers only' using errcode = '42501';
  end if;
  return query
    select s.kind, s.user_id, p.first_name, s.reason, s.until, s.created_by, s.created_at
    from (
      select 'ban'::text as kind, b.user_id, b.reason, b.until, b.created_by, b.created_at
      from public.community_bans b where b.community_id = p_community and (b.until is null or b.until > now())
      union all
      select 'restriction', x.user_id, x.reason, x.until, x.created_by, x.created_at
      from public.community_restrictions x where x.community_id = p_community and x.until > now()
      union all
      select 'warning', w.user_id, w.reason, null, w.created_by, w.created_at
      from public.community_warnings w where w.community_id = p_community
    ) s
    left join public.profiles p on p.id = s.user_id
    where p_user is null or s.user_id = p_user
    order by s.created_at desc;
end $$;

/**
 * Takes an activity out of the community: it leaves the community's lists;
 * a members-only one is also cancelled. Its content is never edited.
 */
create or replace function public.community_moderate_activity(p_activity uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  a public.activities;
  r jsonb;
begin
  select * into a from public.activities where id = p_activity for update;
  if not found then raise exception 'activity not found' using errcode = 'P0002'; end if;
  if a.community_id is null then raise exception 'this activity is not in a community' using errcode = '22023'; end if;
  r := private.community_act(a.community_id);
  if not (r -> 'permissions') @> '{"activities": true}' then
    raise exception 'only the community''s moderators can do this' using errcode = '42501';
  end if;
  if a.creator_id <> auth.uid() then
    perform private.community_outranks(a.community_id, r, a.creator_id);
  end if;
  delete from public.community_activity_pins where activity_id = a.id and community_id = a.community_id;
  update public.activities
  set community_id = null,
      cancelled_at = case when a.privacy = 'community' and a.cancelled_at is null and a.moderated_at is null then now() else cancelled_at end
  where id = a.id;
  perform private.community_log(a.community_id, 'activity.moderate', a.creator_id, a.id, p_reason,
    jsonb_build_object('cancelled', a.privacy = 'community' and a.cancelled_at is null and a.moderated_at is null));
end $$;

/** Removes a message of the community chat (never of a private chat). */
create or replace function public.community_delete_message(p_message uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  msg public.messages;
  cid uuid;
  r jsonb;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into msg from public.messages where id = p_message;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select v.community_id into cid from public.conversations v where v.id = msg.conversation_id and v.kind = 'community';
  if cid is null then raise exception 'only messages of a community chat' using errcode = '42501'; end if;
  r := private.community_act(cid);
  if not (r ->> 'can_moderate')::boolean then
    raise exception 'only the community''s moderators can do this' using errcode = '42501';
  end if;
  if msg.sender_id is not null and msg.sender_id <> auth.uid() then
    perform private.community_outranks(cid, r, msg.sender_id);
  end if;
  if msg.deleted_at is not null then return; end if;
  -- The erase trigger keeps the text aside for IRLY moderators and empties it.
  update public.messages set deleted_at = now() where id = p_message and deleted_at is null;
  insert into public.message_removals (message_id, conversation_id) values (p_message, msg.conversation_id)
  on conflict (message_id) do nothing;
  perform private.community_log(cid, 'message.delete', msg.sender_id, p_message, p_reason,
    jsonb_build_object('conversation_id', msg.conversation_id));
end $$;

/** The audit log, newest first: the owner, or a co-admin with stats or members. */
create or replace function public.community_audit_log(p_community uuid, p_limit integer default 100)
returns table (id uuid, actor uuid, actor_name text, action text, target_user uuid, target_name text, target_id uuid,
  reason text, meta jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  if not ((r ->> 'rank')::integer >= 3 or (r ->> 'can_stats')::boolean or (r ->> 'can_manage_members')::boolean) then
    raise exception 'only the owner and co-admins in charge can read the log' using errcode = '42501';
  end if;
  return query
    select l.id, l.actor, pa.first_name, l.action, l.target_user, pt.first_name, l.target_id, l.reason, l.meta, l.created_at
    from public.community_audit l
    left join public.profiles pa on pa.id = l.actor and pa.deleted_at is null
    left join public.profiles pt on pt.id = l.target_user and pt.deleted_at is null
    where l.community_id = p_community
    order by l.created_at desc, l.id
    limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

/**
 * Real counts: { members, new_7d, new_30d, upcoming_activities, activities_30d,
 * participants_30d, messages_7d, open_reports }. The owner, or a co-admin with stats.
 */
create or replace function public.community_stats(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r jsonb;
  conv uuid;
begin
  r := private.community_act(p_community);
  if not (r ->> 'can_stats')::boolean then
    raise exception 'only the owner and co-admins in charge can read the stats' using errcode = '42501';
  end if;
  select v.id into conv from public.conversations v where v.community_id = p_community and v.kind = 'community';
  return jsonb_build_object(
    'members', (select count(*) from public.community_members m join public.profiles p on p.id = m.user_id and p.deleted_at is null
                where m.community_id = p_community),
    'new_7d', (select count(*) from public.community_members m where m.community_id = p_community and m.joined_at > now() - interval '7 days'),
    'new_30d', (select count(*) from public.community_members m where m.community_id = p_community and m.joined_at > now() - interval '30 days'),
    'upcoming_activities', (select count(*) from public.activities a where a.community_id = p_community
                            and a.cancelled_at is null and a.moderated_at is null and a.starts_at > now()),
    'activities_30d', (select count(*) from public.activities a where a.community_id = p_community
                       and a.moderated_at is null and a.created_at > now() - interval '30 days'),
    'participants_30d', (select count(distinct ap.user_id) from public.activity_participants ap
                         join public.activities a on a.id = ap.activity_id
                         where a.community_id = p_community and ap.status = 'going' and ap.joined_at > now() - interval '30 days'),
    'messages_7d', (select count(*) from public.messages x where conv is not null and x.conversation_id = conv
                    and x.deleted_at is null and x.sender_id is not null and x.created_at > now() - interval '7 days'),
    'open_reports', (select count(*) from public.reports rp
                     left join public.moderation_cases mc on mc.report_id = rp.id
                     where coalesce(mc.status, 'open') in ('open', 'reviewing', 'need_info')
                       and ((rp.target_kind = 'community' and rp.target_id = p_community)
                         or (rp.target_kind = 'community_post' and exists (select 1 from public.community_posts cp where cp.id = rp.target_id and cp.community_id = p_community))
                         or (rp.target_kind = 'activity' and exists (select 1 from public.activities a where a.id = rp.target_id and a.community_id = p_community))
                         or (rp.target_kind = 'message' and conv is not null and exists (select 1 from public.messages x where x.id = rp.target_id and x.conversation_id = conv))))
  );
end $$;

-- ───────── 8. The existing entry points go through the new rules ─────────
-- Last defined in 20261025000100_irly_girl_isolation (owner or IRLY,
-- moderator ↔ member). Same signature and errors; the ranks decide now.
create or replace function public.set_community_role(p_community uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.community_set_role(p_community, p_user, p_role);
end $$;

-- Last defined in 20261103100000_irly_qa_fix_moderation. Same signature and
-- errors; a kick with the audit log now.
create or replace function public.remove_community_member(p_community uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform public.community_kick(p_community, p_user, null);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.community_my_rights(uuid)',
    'public.community_set_role(uuid, uuid, text)',
    'public.community_set_permissions(uuid, uuid, jsonb)',
    'public.community_permissions(uuid, uuid)',
    'public.community_transfer_ownership(uuid, uuid)',
    'public.community_kick(uuid, uuid, text)',
    'public.community_ban(uuid, uuid, text, timestamptz)',
    'public.community_unban(uuid, uuid)',
    'public.community_warn(uuid, uuid, text)',
    'public.community_restrict(uuid, uuid, timestamptz, text)',
    'public.community_unrestrict(uuid, uuid)',
    'public.community_sanctions(uuid, uuid)',
    'public.community_moderate_activity(uuid, text)',
    'public.community_delete_message(uuid, text)',
    'public.community_audit_log(uuid, integer)',
    'public.community_stats(uuid)',
    'public.set_community_role(uuid, uuid, text)',
    'public.remove_community_member(uuid, uuid)',
    'public.set_community_cover(uuid, text)',
    'public.set_conversation_photo(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
