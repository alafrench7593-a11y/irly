-- Every read of IRLY Girl content through the back office is journaled
-- (owner decision, 2026-11-06), the same way as the IRLY Girl safety
-- moderator's view (20261109100000_irly_admin_publish_girl_view, section 8):
-- one line in the staff journal, private.admin_audit, action 'girl.view',
-- with who (actor), what and when, written in the same transaction as the
-- read (a refused or failed read leaves no line; a read that returns
-- women-only content cannot happen without its line).
--
-- Reads covered, and when they write:
--   admin_content          (20261103100000) a list that returns at least one
--                          women-only item: one line naming them all (ids);
--   admin_content_item     (20261103100000) one women-only item (activity,
--                          post, comment or Live of IRLY Girl or Mom);
--   admin_community        (20261027200000) the sheet of a women-only
--                          community (its admins and reports);
--   community_sanctions,   (20261107000000) a women-only community's bans,
--   community_stats,       restrictions and warnings, its counts and its
--   community_audit_log    audit log, read by an IRLY admin: being IRLY
--                          staff is what opens them there (private.
--                          community_act lets admins in), so every such read
--                          is journaled, even by an admin who is also on the
--                          community's own team.
-- What each function returns, who may call it and the errors it raises do
-- not change: each one becomes a thin wrapper around its previous body,
-- moved as is to private.<name>_read (same code, no grant to anyone). The
-- wrappers are VOLATILE (they write the journal): the stable originals
-- could be run in a read-only transaction (GET), where the line could not
-- be written. Nothing is widened: the read rules of IRLY Girl stay as they
-- are, and no policy changes.
-- A later migration that redefines one of these public functions must keep
-- calling private.girl_read_journal (tests: girl_admin_reads_journal).

-- ───────── 1. The previous bodies, kept as they are, out of reach ─────────
do $$
declare
  f record;
begin
  for f in select * from (values
      ('admin_content', 'text, text, text, integer'),
      ('admin_content_item', 'text, uuid'),
      ('admin_community', 'uuid'),
      ('community_sanctions', 'uuid, uuid'),
      ('community_stats', 'uuid'),
      ('community_audit_log', 'uuid, integer')) as x(name, args)
  loop
    -- Once only: a second run finds the wrapper in public and the body already moved.
    if to_regprocedure(format('private.%s_read(%s)', f.name, f.args)) is null then
      execute format('alter function public.%I(%s) rename to %I', f.name, f.args, f.name || '_read');
      execute format('alter function public.%I(%s) set schema private', f.name || '_read', f.args);
    end if;
    execute format('revoke all on function private.%I(%s) from public, anon, authenticated', f.name || '_read', f.args);
  end loop;
end $$;

-- ───────── 2. The journal line ─────────
/** One 'girl.view' line in the staff journal for a back-office read of women-only content. */
create or replace function private.girl_read_journal(p_via text, p_kind text, p_id uuid, p_target_user uuid default null, p_extra jsonb default '{}')
returns void language sql security definer set search_path = public, private as $$
  select private.journal('girl.view', p_target_user, null, p_kind, p_id, null,
    jsonb_build_object('via', p_via) || coalesce(p_extra, '{}'))
$$;
revoke all on function private.girl_read_journal(text, text, uuid, uuid, jsonb) from public, anon, authenticated;

-- ───────── 3. The back office's content reads ─────────
create or replace function public.admin_content(p_kind text, p_search text default null, p_filter text default null, p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, author_id uuid, author_name text, created_at timestamptz, state text,
  girl_only boolean, context text, reports bigint)
language plpgsql volatile security definer set search_path = public, private as $$
declare
  girl uuid[] := '{}';
begin
  for id, kind, title, body, author_id, author_name, created_at, state, girl_only, context, reports in
    select * from private.admin_content_read(p_kind, p_search, p_filter, p_limit)
  loop
    if girl_only then girl := array_append(girl, id); end if;
    return next;
  end loop;
  if cardinality(girl) > 0 then
    perform private.girl_read_journal('admin_content', p_kind, null, null,
      jsonb_build_object('ids', to_jsonb(girl), 'count', cardinality(girl), 'search', nullif(btrim(coalesce(p_search, '')), ''), 'filter', p_filter));
  end if;
end $$;
revoke all on function public.admin_content(text, text, text, integer) from public, anon;
grant execute on function public.admin_content(text, text, text, integer) to authenticated;

create or replace function public.admin_content_item(p_kind text, p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  item jsonb := private.admin_content_item_read(p_kind, p_id);
begin
  -- Women-only: an IRLY Girl or Mom activity, a post or Live there, or a comment on one (private.girl_target).
  if coalesce((item ->> 'girl_only')::boolean, false) or private.girl_target(p_kind, p_id::text) then
    perform private.girl_read_journal('admin_content_item', p_kind, p_id,
      case when (item ->> 'author_id') ~* '^[0-9a-f-]{36}$' then (item ->> 'author_id')::uuid end);
  end if;
  return item;
end $$;
revoke all on function public.admin_content_item(text, uuid) from public, anon;
grant execute on function public.admin_content_item(text, uuid) to authenticated;

create or replace function public.admin_community(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  sheet jsonb := private.admin_community_read(p_id);
begin
  if coalesce((sheet ->> 'girl_only')::boolean, false) then
    perform private.girl_read_journal('admin_community', 'community', p_id);
  end if;
  return sheet;
end $$;
revoke all on function public.admin_community(uuid) from public, anon;
grant execute on function public.admin_community(uuid) to authenticated;

-- ───────── 4. A women-only community's management reads, by IRLY admins ─────────
/** True when the caller reads a women-only community's management data as an IRLY admin. */
create or replace function private.girl_admin_read(cid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.girl_target('community', cid::text) and coalesce(private.is_admin(auth.uid()), false)
$$;
revoke all on function private.girl_admin_read(uuid) from public, anon, authenticated;

create or replace function public.community_sanctions(p_community uuid, p_user uuid default null)
returns table (kind text, user_id uuid, name text, reason text, until timestamptz, created_by uuid, created_at timestamptz)
language plpgsql volatile security definer set search_path = public, private as $$
begin
  return query select * from private.community_sanctions_read(p_community, p_user);
  if private.girl_admin_read(p_community) then
    perform private.girl_read_journal('community_sanctions', 'community', p_community, p_user);
  end if;
end $$;
revoke all on function public.community_sanctions(uuid, uuid) from public, anon;
grant execute on function public.community_sanctions(uuid, uuid) to authenticated;

create or replace function public.community_stats(p_community uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  stats jsonb := private.community_stats_read(p_community);
begin
  if private.girl_admin_read(p_community) then
    perform private.girl_read_journal('community_stats', 'community', p_community);
  end if;
  return stats;
end $$;
revoke all on function public.community_stats(uuid) from public, anon;
grant execute on function public.community_stats(uuid) to authenticated;

create or replace function public.community_audit_log(p_community uuid, p_limit integer default 100)
returns table (id uuid, actor uuid, actor_name text, action text, target_user uuid, target_name text, target_id uuid,
  reason text, meta jsonb, created_at timestamptz)
language plpgsql volatile security definer set search_path = public, private as $$
begin
  return query select * from private.community_audit_log_read(p_community, p_limit);
  if private.girl_admin_read(p_community) then
    perform private.girl_read_journal('community_audit_log', 'community', p_community);
  end if;
end $$;
revoke all on function public.community_audit_log(uuid, integer) from public, anon;
grant execute on function public.community_audit_log(uuid, integer) to authenticated;
