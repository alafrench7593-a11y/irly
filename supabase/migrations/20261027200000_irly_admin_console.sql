-- IRLY back office, completed: an overview made of real counts, a member
-- sheet (suspension until a date, reactivation, deletion through the
-- existing account pipeline), communities, activities and posts that the
-- team can hide, restore or delete with a reason, related reports, an
-- append-only staff journal, and reports that can be filed again later
-- without double taps creating duplicates.
-- Additive: no table or column is dropped, RLS stays on everywhere, nobody
-- is granted a role here (the owner is still set from the server only:
-- private.grant_owner, see docs/ADMIN.md).
--
-- Who may do what (re-checked by the server on every call):
--   any staff role       read the lists and sheets (members, communities, content)
--   moderator and above  reports, warnings, suspensions (7 days at most for a moderator)
--   content and above    edit a community's name, texts and photo
--   admin and owner      hide / restore / delete content and communities,
--                        bans, account deletion, settings, overview counts
--
-- Moderation holds (private.moderation_holds) remember what the team hid and
-- how it was before, so a decision can be undone exactly: restoring never
-- revives something its author deleted. A hold that is still active keeps
-- the item out of every list, detail, search and the IRLY Map.

-- ───────── 0. Helpers ─────────
/** Any staff role for the caller (no argument: it never says anything about someone else). */
create or replace function private.i_am_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select private.staff_role(auth.uid()) is not null
$$;
revoke all on function private.i_am_staff() from public, anon;
grant execute on function private.i_am_staff() to authenticated;

create or replace function private.need_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if private.staff_role(auth.uid()) is null then raise exception 'IRLY team only' using errcode = '42501'; end if;
end $$;
revoke all on function private.need_staff() from public, anon, authenticated;

create or replace function private.need_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_admin(auth.uid()) then raise exception 'IRLY admins only' using errcode = '42501'; end if;
end $$;
revoke all on function private.need_admin() from public, anon, authenticated;

/** A reason the journal keeps: 3 to 1000 characters, trimmed. */
create or replace function private.need_reason(p text) returns text
language plpgsql immutable as $$
begin
  if char_length(btrim(coalesce(p, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  return left(btrim(p), 1000);
end $$;

/** Plain substring match, without LIKE wildcards from the search box. */
create or replace function private.has_text(hay text, needle text) returns boolean
language sql immutable as $$
  select needle is null or position(lower(needle) in lower(coalesce(hay, ''))) > 0
$$;

-- ───────── 1. The staff journal is append-only ─────────
-- private.admin_audit was already out of the API (private schema, no grant);
-- now even the database refuses to change or delete a line, except the
-- 24-month retention purge, which says so for its own transaction.
alter table private.admin_audit add column if not exists result text not null default 'done';

create or replace function private.audit_append_only() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' and current_setting('irly.retention', true) = 'on' then return old; end if;
  raise exception 'the staff journal is append-only' using errcode = '42501';
end $$;
drop trigger if exists admin_audit_append_only on private.admin_audit;
create trigger admin_audit_append_only before update or delete on private.admin_audit
  for each row execute function private.audit_append_only();
drop trigger if exists admin_audit_no_truncate on private.admin_audit;
create trigger admin_audit_no_truncate before truncate on private.admin_audit
  for each statement execute function private.audit_append_only();
revoke all on private.admin_audit from public, anon, authenticated;

-- Same body as in 20261023000000, with the retention flag around the journal purge.
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
  perform set_config('irly.retention', 'on', true);
  delete from private.admin_audit where at < now() - interval '24 months';
  perform set_config('irly.retention', 'off', true);
end $$;
revoke all on function private.purge_retention() from public, anon, authenticated;

/** One journal line: who (the caller), what, whom, about what, why. */
create or replace function private.journal(p_action text, p_target_user uuid, p_case uuid, p_kind text, p_id uuid, p_reason text, p_extra jsonb default '{}')
returns void language sql security definer set search_path = public, private as $$
  insert into private.admin_audit (actor, action, target_user, case_id, details)
  values (auth.uid(), p_action, p_target_user, p_case,
          jsonb_strip_nulls(jsonb_build_object('kind', p_kind, 'id', p_id, 'reason', p_reason)) || coalesce(p_extra, '{}'))
$$;
revoke all on function private.journal(text, uuid, uuid, text, uuid, text, jsonb) from public, anon, authenticated;

-- ───────── 2. Reports: new reason, duplicates only within minutes ─────────
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (category in (
  'harassment', 'hate_speech', 'spam', 'scam', 'fake_profile', 'inappropriate', 'threats', 'other', 'unsafe',
  'impersonation', 'sexual_content'));

-- One report per person and item for ever was too strict: a second, later
-- report (something new happened) must reach the team. Accidental repeats
-- (double tap, a retry) are still folded, in file_report below.
drop index if exists public.reports_once;
create index if not exists reports_reporter_target_idx on public.reports (reporter_id, target_kind, target_id, created_at desc);
create index if not exists reports_target_idx on public.reports (target_kind, target_id);

create or replace function private.file_report(p_kind text, p_target_id uuid, p_category text, p_details text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  owner uuid;
  rid uuid;
  n integer;
begin
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  owner := case p_kind
    when 'message' then (select sender_id from public.messages where id = p_target_id)
    when 'profile' then p_target_id
    else private.owner_of(case p_kind when 'event' then 'activity' else p_kind end, p_target_id::text)
  end;
  if owner = me then raise exception 'you cannot report yourself' using errcode = '22023'; end if;
  -- Two identical sends close together (same person, item and reason): one report.
  perform pg_advisory_xact_lock(hashtextextended(me::text || p_kind || coalesce(p_target_id::text, '') || p_category, 7));
  select id into rid from public.reports
  where reporter_id = me and target_kind = p_kind and target_id is not distinct from p_target_id and category = p_category
    and created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;
  if rid is not null then return rid; end if;
  insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category, details)
  values (me, owner, p_kind, p_target_id, p_category, p_details)
  returning id into rid;
  insert into public.moderation_cases (report_id) values (rid);
  select count(distinct reporter_id) into n from public.reports
  where target_kind = p_kind and target_id = p_target_id and created_at > now() - interval '1 day';
  if n >= 3 then
    update public.moderation_cases m set priority = 'high'
    from public.reports r where r.id = m.report_id and r.target_kind = p_kind and r.target_id = p_target_id and m.status <> 'dismissed';
  end if;
  return rid;
end $$;
revoke all on function private.file_report(text, uuid, text, text) from public, anon;
grant execute on function private.file_report(text, uuid, text, text) to authenticated;

-- ───────── 3. Moderation holds ─────────
create table if not exists private.moderation_holds (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('activity', 'community', 'community_post', 'comment', 'irl_post')),
  target_id uuid not null,
  -- How the item was before (to restore it exactly).
  prev jsonb not null default '{}',
  reason text not null,
  case_id uuid references public.moderation_cases (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  active boolean not null default true,
  final boolean not null default false,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles (id) on delete set null
);
create unique index if not exists moderation_holds_active on private.moderation_holds (kind, target_id) where active;
alter table private.moderation_holds enable row level security;
revoke all on private.moderation_holds from public, anon, authenticated;

create or replace function private.is_held(p_kind text, p_id uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from private.moderation_holds h where h.kind = p_kind and h.target_id = p_id and h.active)
$$;
revoke all on function private.is_held(text, uuid) from public, anon, authenticated;

-- An activity the team hid leaves every screen (lists, detail, search, map),
-- for its host and participants too; the team still sees it.
alter table public.activities add column if not exists moderated_at timestamptz;
drop policy if exists activities_not_moderated on public.activities;
create policy activities_not_moderated on public.activities as restrictive for select to authenticated
  using (moderated_at is null or (select private.i_am_staff()));

-- Nobody but the team changes moderated_at, or brings a hidden item back.
create or replace function private.hold_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null or private.i_am_staff() then return new; end if;
  if tg_table_name = 'activities' then
    if new.moderated_at is distinct from old.moderated_at
       or (old.moderated_at is not null and new.cancelled_at is distinct from old.cancelled_at) then
      raise exception 'this activity was removed by the IRLY team' using errcode = '42501';
    end if;
  elsif tg_table_name = 'irl_posts' then
    if new.expires_at is distinct from old.expires_at and private.is_held('irl_post', old.id) then
      raise exception 'this live was removed by the IRLY team' using errcode = '42501';
    end if;
  elsif old.deleted_at is not null and new.deleted_at is null
        and private.is_held(case tg_table_name when 'community_posts' then 'community_post' when 'comments' then 'comment' else 'community' end, old.id) then
    raise exception 'this was removed by the IRLY team' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.hold_guard() from public, anon, authenticated;
drop trigger if exists activities_hold_guard on public.activities;
create trigger activities_hold_guard before update of moderated_at, cancelled_at on public.activities
  for each row execute function private.hold_guard();
drop trigger if exists irl_posts_hold_guard on public.irl_posts;
create trigger irl_posts_hold_guard before update of expires_at on public.irl_posts
  for each row execute function private.hold_guard();
drop trigger if exists community_posts_hold_guard on public.community_posts;
create trigger community_posts_hold_guard before update of deleted_at on public.community_posts
  for each row execute function private.hold_guard();
drop trigger if exists comments_hold_guard on public.comments;
create trigger comments_hold_guard before update of deleted_at on public.comments
  for each row execute function private.hold_guard();
drop trigger if exists communities_hold_guard on public.communities;
create trigger communities_hold_guard before update of deleted_at on public.communities
  for each row execute function private.hold_guard();

/**
 * Hide, restore or delete one item (the work behind every content action).
 * Hide is soft and restorable; restore only undoes a hold; delete removes
 * the item (its words are kept 12 months for moderation, as when an account
 * goes). Callers check the role; this checks the item.
 */
create or replace function private.moderate_item(p_kind text, p_id uuid, p_action text, p_reason text, p_case uuid, p_auto boolean default false)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  h private.moderation_holds;
  a public.activities;
  author uuid;
  p record;
  ids uuid[];
begin
  if p_kind not in ('activity', 'community', 'community_post', 'comment', 'irl_post') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;
  if p_action not in ('hide', 'restore', 'delete') then raise exception 'unknown action' using errcode = '22023'; end if;
  select * into h from private.moderation_holds where kind = p_kind and target_id = p_id and active for update;
  author := case p_kind when 'community' then (select created_by from public.communities where id = p_id)
                        else private.owner_of(p_kind, p_id::text) end;

  if p_action = 'hide' then
    if h.id is not null then return; end if;
    if p_kind = 'activity' then
      select * into a from public.activities where id = p_id for update;
      if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
      update public.activities set moderated_at = now(), cancelled_at = coalesce(cancelled_at, now()) where id = p_id;
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, jsonb_build_object('cancelled_at', a.cancelled_at), p_reason, p_case, case when p_auto then null else auth.uid() end);
    elsif p_kind = 'community' then
      if not exists (select 1 from public.communities where id = p_id and deleted_at is null) then
        raise exception 'this community is already removed' using errcode = '22023';
      end if;
      -- The community and its groups; only these come back on restore.
      with gone as (
        update public.communities set deleted_at = now() where (id = p_id or parent_id = p_id) and deleted_at is null returning id
      ) select array_agg(id) into ids from gone;
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, jsonb_build_object('ids', to_jsonb(ids)), p_reason, p_case, auth.uid());
    elsif p_kind = 'irl_post' then
      select expires_at into p from public.irl_posts where id = p_id for update;
      if not found then raise exception 'not found' using errcode = 'P0002'; end if;
      update public.irl_posts set expires_at = now() where id = p_id;
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, jsonb_build_object('expires_at', p.expires_at), p_reason, p_case, case when p_auto then null else auth.uid() end);
    else
      if p_kind = 'community_post' then
        update public.community_posts set deleted_at = now() where id = p_id and deleted_at is null;
      else
        update public.comments set deleted_at = now() where id = p_id and deleted_at is null;
      end if;
      if not found then raise exception 'already removed by its author, or gone' using errcode = '22023'; end if;
      insert into private.moderation_holds (kind, target_id, reason, case_id, created_by)
      values (p_kind, p_id, p_reason, p_case, case when p_auto then null else auth.uid() end);
    end if;

  elsif p_action = 'restore' then
    if h.id is null or h.final then raise exception 'nothing to restore: the team did not hide this' using errcode = '22023'; end if;
    if p_kind = 'activity' then
      update public.activities set moderated_at = null, cancelled_at = (h.prev ->> 'cancelled_at')::timestamptz where id = p_id;
    elsif p_kind = 'community' then
      update public.communities set deleted_at = null
      where id in (select (jsonb_array_elements_text(coalesce(h.prev -> 'ids', '[]')))::uuid);
    elsif p_kind = 'irl_post' then
      if (h.prev ->> 'expires_at')::timestamptz <= now() then
        raise exception 'this live has expired since: it cannot come back' using errcode = '22023';
      end if;
      update public.irl_posts set expires_at = (h.prev ->> 'expires_at')::timestamptz where id = p_id;
    elsif p_kind = 'community_post' then
      update public.community_posts set deleted_at = null where id = p_id;
    else
      update public.comments set deleted_at = null where id = p_id;
    end if;
    update private.moderation_holds set active = false, lifted_at = now(), lifted_by = auth.uid() where id = h.id;

  else -- delete
    if p_kind = 'activity' then
      select * into a from public.activities where id = p_id for update;
      if a.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
      insert into private.removed_content (source, id, body)
      values ('activities', a.id, left(a.title || coalesce(E'\n' || a.description, ''), 3000)) on conflict do nothing;
      -- People going hear it once, as when the host deletes it.
      if a.cancelled_at is null then
        for p in select user_id from public.activity_participants where activity_id = a.id and status = 'going' and user_id <> a.creator_id loop
          perform private.notify(p.user_id, 'ACTIVITY_UPDATED', jsonb_build_object('activity_id', a.id, 'title', a.title, 'change', 'deleted'));
        end loop;
      end if;
      delete from public.activities where id = p_id;
    elsif p_kind = 'community' then
      if not exists (select 1 from public.communities where id = p_id) then raise exception 'not found' using errcode = 'P0002'; end if;
      -- As delete_community: the community and its groups leave every list,
      -- their chats leave every inbox; the history is kept for moderation.
      update public.communities set deleted_at = now() where (id = p_id or parent_id = p_id) and deleted_at is null;
      delete from public.conversation_members cm using public.conversations v, public.communities x
      where v.community_id = x.id and (x.id = p_id or x.parent_id = p_id) and cm.conversation_id = v.id;
    elsif p_kind = 'irl_post' then
      insert into private.removed_content (source, id, body)
        select 'irl_posts', x.id, x.body || coalesce(' [media: ' || x.media_path || ']', '') from public.irl_posts x where x.id = p_id
        on conflict do nothing;
      delete from public.irl_posts where id = p_id;
    elsif p_kind = 'community_post' then
      insert into private.removed_content (source, id, body)
        select 'community_posts', x.id, x.body from public.community_posts x where x.id = p_id on conflict do nothing;
      delete from public.community_posts where id = p_id;
    else
      insert into private.removed_content (source, id, body)
        select 'comments', x.id, x.body from public.comments x where x.id = p_id on conflict do nothing;
      delete from public.comments where id = p_id;
    end if;
    if h.id is not null then
      update private.moderation_holds set active = false, final = true, lifted_at = now(), lifted_by = auth.uid() where id = h.id;
    end if;
    insert into private.moderation_holds (kind, target_id, reason, case_id, created_by, active, final)
    values (p_kind, p_id, p_reason, p_case, auth.uid(), false, true);
  end if;

  if p_case is not null and p_action <> 'restore' then
    update public.moderation_cases set status = 'actioned', assignee_id = auth.uid(), decision = p_reason where id = p_case;
    insert into private.case_notes (case_id, author, body) values (p_case, auth.uid(), left(p_reason, 2000));
  end if;
  if not p_auto then
    perform private.journal('content.' || p_action, author, p_case, p_kind, p_id, p_reason);
  end if;
end $$;
revoke all on function private.moderate_item(text, uuid, text, text, uuid, boolean) from public, anon, authenticated;

-- Reported content taken down from a case (admins): now through a hold, so it can be restored.
create or replace function public.mod_remove_content(p_case uuid, p_note text) returns void
language plpgsql security definer set search_path = public, private as $$
declare r public.reports; why text;
begin
  perform private.need_admin();
  why := private.need_reason(p_note);
  select rr.* into r from public.moderation_cases m join public.reports rr on rr.id = m.report_id where m.id = p_case;
  if r.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  if r.target_kind in ('activity', 'event', 'community', 'community_post', 'comment', 'irl_post') then
    perform private.moderate_item(case r.target_kind when 'event' then 'activity' else r.target_kind end, r.target_id, 'hide', why, p_case);
  elsif r.target_kind = 'message' then
    update public.messages set deleted_at = now() where id = r.target_id and deleted_at is null;
    update public.moderation_cases set status = 'actioned', assignee_id = auth.uid(), decision = why where id = p_case;
    insert into private.case_notes (case_id, author, body) values (p_case, auth.uid(), left(why, 2000));
    perform private.journal('content.removed', r.target_user_id, p_case, 'message', r.target_id, why);
  else
    raise exception 'nothing to take down for this kind of report' using errcode = '22023';
  end if;
end $$;
revoke all on function public.mod_remove_content(uuid, text) from public, anon;
grant execute on function public.mod_remove_content(uuid, text) to authenticated;

-- Three established members reporting the same post hides it (existing rule),
-- now as a hold the team reviews and can undo: never a final decision.
create or replace function private.on_report_escalate() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare n integer;
begin
  if new.target_id is null or new.target_kind not in ('irl_post', 'comment', 'community_post') then return new; end if;
  select count(distinct r.reporter_id) into n from public.reports r
  join public.profiles p on p.id = r.reporter_id and p.deleted_at is null and p.created_at < now() - interval '7 days'
  where r.target_kind = new.target_kind and r.target_id = new.target_id and r.created_at > now() - interval '1 day';
  if n < 3 or exists (select 1 from public.moderation_cases m join public.reports r on r.id = m.report_id
      where r.target_id = new.target_id and m.status = 'dismissed')
     or private.is_held(new.target_kind, new.target_id) then
    return new;
  end if;
  if new.target_kind = 'irl_post' then
    if exists (select 1 from public.irl_posts where id = new.target_id and expires_at > now()) then
      perform private.moderate_item('irl_post', new.target_id, 'hide', 'Hidden automatically after reports from 3 members, until the team reviews it', null, true);
    end if;
  elsif new.target_kind = 'comment' then
    if exists (select 1 from public.comments where id = new.target_id and deleted_at is null) then
      perform private.moderate_item('comment', new.target_id, 'hide', 'Hidden automatically after reports from 3 members, until the team reviews it', null, true);
    end if;
  elsif exists (select 1 from public.community_posts where id = new.target_id and deleted_at is null) then
    perform private.moderate_item('community_post', new.target_id, 'hide', 'Hidden automatically after reports from 3 members, until the team reviews it', null, true);
  end if;
  return new;
end $$;
revoke all on function private.on_report_escalate() from public, anon, authenticated;

-- ───────── 4. Sanctions hold on more writes ─────────
-- A suspension or a ban already refuses every new post, message, activity,
-- community, join and like. It now also refuses follows, friendships,
-- reactions, poll votes, swipes, shares and channels, and editing what is
-- already published (texts, names, photos). Reporting, blocking, reading,
-- deleting one's own things and deleting the account stay open.
do $$
declare t text;
begin
  foreach t in array array['follows', 'friendships', 'message_reactions', 'community_poll_votes', 'community_channels',
                           'community_broadcasts', 'irly_match_actions', 'shares'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_block_sanctioned', t);
      execute format('create trigger %I before insert on public.%I for each row execute function private.block_sanctioned()', t || '_block_sanctioned', t);
    end if;
  end loop;
end $$;

/**
 * Edits by a suspended member: refused when a listed column of their own row
 * (or of a community they run) gets a new, non-empty value. Clearing (null)
 * stays possible, and so do the server's own updates of other people's rows
 * that the member's allowed actions cause (a deleted post retiring its shares).
 */
create or replace function private.block_sanctioned_edit() returns trigger
language plpgsql security definer set search_path = public as $$
declare k text; j jsonb := to_jsonb(new);
begin
  if auth.uid() is null or not private.is_sanctioned(auth.uid()) then return new; end if;
  if tg_table_name <> 'communities'
     and coalesce(j ->> 'author_id', j ->> 'sender_id', j ->> 'creator_id', j ->> 'id') is distinct from auth.uid()::text then
    return new;
  end if;
  foreach k in array tg_argv loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) and coalesce(to_jsonb(new) -> k, 'null'::jsonb) <> 'null'::jsonb then
      raise exception 'your account is suspended' using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;
revoke all on function private.block_sanctioned_edit() from public, anon, authenticated;

drop trigger if exists community_posts_block_sanctioned_edit on public.community_posts;
create trigger community_posts_block_sanctioned_edit before update of body, media_paths on public.community_posts
  for each row execute function private.block_sanctioned_edit('body', 'media_paths');
drop trigger if exists comments_block_sanctioned_edit on public.comments;
create trigger comments_block_sanctioned_edit before update of body on public.comments
  for each row execute function private.block_sanctioned_edit('body');
drop trigger if exists irl_posts_block_sanctioned_edit on public.irl_posts;
create trigger irl_posts_block_sanctioned_edit before update of body, media_path on public.irl_posts
  for each row execute function private.block_sanctioned_edit('body', 'media_path');
drop trigger if exists messages_block_sanctioned_edit on public.messages;
create trigger messages_block_sanctioned_edit before update of body on public.messages
  for each row execute function private.block_sanctioned_edit('body');
drop trigger if exists activities_block_sanctioned_edit on public.activities;
create trigger activities_block_sanctioned_edit before update of title, description, cover_path on public.activities
  for each row execute function private.block_sanctioned_edit('title', 'description', 'cover_path');
drop trigger if exists communities_block_sanctioned_edit on public.communities;
create trigger communities_block_sanctioned_edit before update of name, tagline, description, cover_path on public.communities
  for each row execute function private.block_sanctioned_edit('name', 'tagline', 'description', 'cover_path');
drop trigger if exists profiles_block_sanctioned_edit on public.profiles;
create trigger profiles_block_sanctioned_edit before update of first_name, bio, photo_paths, username on public.profiles
  for each row execute function private.block_sanctioned_edit('first_name', 'bio', 'photo_paths', 'username');

/** Suspension until a chosen date (moderators: 7 days at most), with the same rules as mod_sanction. */
create or replace function public.admin_suspend(p_user uuid, p_until timestamptz, p_reason text, p_case uuid default null)
returns uuid language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); mine text := private.staff_role(auth.uid()); sid uuid; why text;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if p_user = me then raise exception 'you cannot sanction yourself' using errcode = '22023'; end if;
  why := private.need_reason(p_reason);
  if private.staff_rank(private.staff_role(p_user)) >= private.staff_rank(mine) then
    raise exception 'you cannot sanction this member' using errcode = '42501';
  end if;
  if p_until is null or p_until < now() + interval '1 hour' or p_until > now() + interval '366 days' then
    raise exception 'a suspension ends between 1 hour and 1 year from now' using errcode = '22023';
  end if;
  if mine = 'moderator' and p_until > now() + interval '7 days 1 hour' then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'no such member' using errcode = '22023';
  end if;
  insert into public.sanctions (user_id, kind, reason, case_id, created_by, ends_at)
  values (p_user, 'suspension', why, p_case, me, p_until) returning id into sid;
  perform private.end_sessions(p_user, p_until);
  perform private.audit('sanction.suspension', p_user, p_case, jsonb_build_object('sanction', sid, 'until', p_until, 'reason', why));
  return sid;
end $$;
revoke all on function public.admin_suspend(uuid, timestamptz, text, uuid) from public, anon;
grant execute on function public.admin_suspend(uuid, timestamptz, text, uuid) to authenticated;

/** Lifts every active suspension (and, for admins, ban) of a member: the account is active again. */
create or replace function public.admin_reactivate(p_user uuid, p_reason text) returns integer
language plpgsql security definer set search_path = public, private as $$
declare s record; n integer := 0; why text;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  why := private.need_reason(p_reason);
  for s in select id, kind from public.sanctions where user_id = p_user and kind in ('suspension', 'ban') and lifted_at is null
             and (ends_at is null or ends_at > now()) loop
    perform public.mod_lift_sanction(s.id, why);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.admin_reactivate(uuid, text) from public, anon;
grant execute on function public.admin_reactivate(uuid, text) to authenticated;

-- ───────── 5. Account deletion by an admin (the member's own pipeline) ─────────
/**
 * Deletes a member's account through delete_my_account() itself (files
 * queued for the storage purge, reported words kept, groups handed on,
 * communities passed to an heir, sign-in account removed and verified), run
 * as that member for this one call. Admins only, never oneself, never a
 * member of the team (remove the role first), with the word DELETE typed
 * and a reason. Suspension is usually the better answer: this cannot be undone.
 */
create or replace function public.admin_delete_account(p_user uuid, p_confirm text, p_reason text) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); why text; prev text;
begin
  perform private.need_admin();
  if p_user is null or p_user = me then raise exception 'you cannot delete your own account here' using errcode = '22023'; end if;
  if coalesce(p_confirm, '') <> 'DELETE' then raise exception 'type DELETE to confirm' using errcode = '22023'; end if;
  why := private.need_reason(p_reason);
  if private.staff_role(p_user) is not null then
    raise exception 'this member is on the IRLY team: remove the role first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then raise exception 'no such member' using errcode = '22023'; end if;
  -- Written first: the journal keeps the id (never the name or the email).
  perform private.journal('account.deleted', p_user, null, 'profile', p_user, why);
  prev := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  begin
    perform public.delete_my_account();
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(prev, ''), true);
    raise;
  end;
  perform set_config('request.jwt.claim.sub', coalesce(prev, ''), true);
  if auth.uid() is distinct from me then raise exception 'identity not restored' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.admin_delete_account(uuid, text, text) from public, anon;
grant execute on function public.admin_delete_account(uuid, text, text) to authenticated;

-- ───────── 6. Overview ─────────
/** Real counts for the back office home (admins). "Active" = wrote, joined or reacted in 30 days. */
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare active30 bigint; signins bigint;
begin
  perform private.need_admin();
  select count(*) into active30 from (
    select sender_id as u from public.messages where created_at > now() - interval '30 days'
    union select author_id from public.community_posts where created_at > now() - interval '30 days'
    union select author_id from public.comments where created_at > now() - interval '30 days'
    union select author_id from public.irl_posts where created_at > now() - interval '30 days'
    union select creator_id from public.activities where created_at > now() - interval '30 days'
    union select user_id from public.activity_participants where joined_at > now() - interval '30 days'
  ) x join public.profiles p on p.id = x.u and p.deleted_at is null;
  -- Sign-ins, where the auth schema keeps them (Supabase does).
  if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'last_sign_in_at') then
    execute 'select count(*) from auth.users where last_sign_in_at > now() - interval ''30 days''' into signins;
  end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles where deleted_at is null),
    'new_7d', (select count(*) from public.profiles where deleted_at is null and created_at > now() - interval '7 days'),
    'new_30d', (select count(*) from public.profiles where deleted_at is null and created_at > now() - interval '30 days'),
    'active_30d', active30,
    'signins_30d', signins,
    'communities', (select count(*) from public.communities where deleted_at is null and parent_id is null),
    'activities', (select count(*) from public.activities where cancelled_at is null),
    'activities_upcoming', (select count(*) from public.activities where cancelled_at is null and starts_at > now()),
    'posts', (select count(*) from public.community_posts where deleted_at is null),
    'lives', (select count(*) from public.irl_posts where expires_at > now()),
    'reports_open', (select count(*) from public.moderation_cases where status = 'open'),
    'reports_review', (select count(*) from public.moderation_cases where status = 'reviewing'),
    'reports_action', (select count(*) from public.moderation_cases where status = 'need_info'),
    'reports_7d', (select count(*) from public.reports where created_at > now() - interval '7 days'),
    'important_7d', (select count(*) from private.admin_notifications where important and created_at > now() - interval '7 days'),
    'suspended', (select count(distinct user_id) from public.sanctions where kind = 'suspension' and lifted_at is null and ends_at > now()),
    'banned', (select count(distinct user_id) from public.sanctions where kind = 'ban' and lifted_at is null and (ends_at is null or ends_at > now())),
    'hidden', (select count(*) from private.moderation_holds where active),
    'email_pending', (select count(*) from private.report_email_outbox where status in ('pending', 'sending')),
    'email_failed', (select count(*) from private.report_email_outbox where status = 'failed'),
    'recent', coalesce((select jsonb_agg(x order by x.at desc) from (
        select a.at, coalesce(pa.first_name, 'IRLY') as by, a.action, pt.first_name as target
        from private.admin_audit a left join public.profiles pa on pa.id = a.actor left join public.profiles pt on pt.id = a.target_user
        order by a.at desc limit 8) x), '[]')
  );
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- ───────── 7. Members ─────────
/** A member's sheet: status, what was reported about them, their sanctions and the team's actions about them. */
create or replace function public.admin_user(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare p public.profiles; admin boolean := private.is_admin(auth.uid()); s record;
begin
  perform private.need_staff();
  select * into p from public.profiles where id = p_user;
  if p.id is null then raise exception 'no such member' using errcode = 'P0002'; end if;
  select kind, ends_at into s from public.sanctions
  where user_id = p_user and kind in ('suspension', 'ban') and lifted_at is null and (ends_at is null or ends_at > now())
  order by (kind = 'ban') desc, ends_at desc nulls first limit 1;
  return jsonb_build_object(
    'id', p.id, 'first_name', p.first_name, 'username', p.username, 'city_id', p.city_id, 'created_at', p.created_at,
    'verified', p.verified_at is not null, 'role', private.staff_role(p.id), 'photos', coalesce(array_length(p.photo_paths, 1), 0),
    'email', case when admin then (select to_jsonb(u) ->> 'email' from auth.users u where u.id = p.id) end,
    'status', case when p.deleted_at is not null then 'deleted' when s.kind = 'ban' then 'banned' when s.kind = 'suspension' then 'suspended' else 'active' end,
    'status_until', s.ends_at,
    'counts', jsonb_build_object(
      'activities', (select count(*) from public.activities where creator_id = p.id),
      'communities', (select count(*) from public.community_members where user_id = p.id and role = 'owner'),
      'posts', (select count(*) from public.community_posts where author_id = p.id and deleted_at is null),
      'reports_about', (select count(*) from public.reports where target_user_id = p.id),
      'reports_filed', (select count(*) from public.reports where reporter_id = p.id)),
    'reports', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select m.id as case_id, m.status, r.category, r.target_kind, r.created_at
        from public.reports r join public.moderation_cases m on m.report_id = r.id
        where r.target_user_id = p.id order by r.created_at desc limit 30) x), '[]'),
    'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'kind', x.kind, 'reason', x.reason, 'created_at', x.created_at,
        'ends_at', x.ends_at, 'lifted_at', x.lifted_at, 'lift_reason', x.lift_reason, 'by', pb.first_name) order by x.created_at desc)
        from public.sanctions x left join public.profiles pb on pb.id = x.created_by where x.user_id = p.id), '[]'),
    'history', coalesce((select jsonb_agg(y order by y.at desc) from (
        select a.at, a.action, coalesce(pa.first_name, 'IRLY') as by, a.details ->> 'reason' as reason
        from private.admin_audit a left join public.profiles pa on pa.id = a.actor
        where a.target_user = p.id order by a.at desc limit 40) y), '[]')
  );
end $$;
revoke all on function public.admin_user(uuid) from public, anon;
grant execute on function public.admin_user(uuid) to authenticated;

-- ───────── 8. Communities ─────────
create or replace function public.admin_communities(p_search text default null, p_filter text default null, p_limit integer default 50)
returns table (id uuid, name text, city_id text, girl_only boolean, official boolean, parent_id uuid, members_count integer,
  created_at timestamptz, removed boolean, hidden boolean, cover_path text, creator_name text, reports bigint)
language plpgsql stable security definer set search_path = public, private as $$
declare q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  perform private.need_staff();
  return query
    select c.id, c.name, c.city_id, c.girl_only, c.official, c.parent_id, c.members_count, c.created_at,
      c.deleted_at is not null, private.is_held('community', c.id), c.cover_path, pc.first_name,
      (select count(*) from public.reports r where r.target_kind = 'community' and r.target_id = c.id)
    from public.communities c left join public.profiles pc on pc.id = c.created_by
    where (q is null or private.has_text(c.name, q) or c.id::text = q or private.has_text(c.tagline, q))
      and (p_filter is null or (p_filter = 'hidden' and private.is_held('community', c.id))
           or (p_filter = 'removed' and c.deleted_at is not null) or (p_filter = 'reported'
               and exists (select 1 from public.reports r where r.target_kind = 'community' and r.target_id = c.id))
           or (p_filter = 'official' and c.official))
    order by (c.deleted_at is null) desc, c.members_count desc, c.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;
revoke all on function public.admin_communities(text, text, integer) from public, anon;
grant execute on function public.admin_communities(text, text, integer) to authenticated;

create or replace function public.admin_community(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare c public.communities;
begin
  perform private.need_staff();
  select * into c from public.communities where id = p_id;
  if c.id is null then raise exception 'not found' using errcode = 'P0002'; end if;
  return to_jsonb(c) || jsonb_build_object(
    'creator', (select jsonb_build_object('id', id, 'name', first_name) from public.profiles where id = c.created_by),
    'parent_name', (select name from public.communities where id = c.parent_id),
    'admins', coalesce((select jsonb_agg(jsonb_build_object('id', m.user_id, 'name', p.first_name, 'role', m.role) order by (m.role = 'owner') desc, p.first_name)
        from public.community_members m join public.profiles p on p.id = m.user_id where m.community_id = c.id and m.role in ('owner', 'moderator')), '[]'),
    'member_count', (select count(*) from public.community_members m where m.community_id = c.id),
    'groups', (select count(*) from public.communities g where g.parent_id = c.id and g.deleted_at is null),
    'removed', c.deleted_at is not null,
    'hold', (select jsonb_build_object('reason', h.reason, 'at', h.created_at, 'by', p.first_name) from private.moderation_holds h
             left join public.profiles p on p.id = h.created_by where h.kind = 'community' and h.target_id = c.id and h.active),
    'reports', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select m.id as case_id, m.status, r.category, r.created_at from public.reports r join public.moderation_cases m on m.report_id = r.id
        where r.target_kind = 'community' and r.target_id = c.id order by r.created_at desc limit 30) x), '[]')
  );
end $$;
revoke all on function public.admin_community(uuid) from public, anon;
grant execute on function public.admin_community(uuid) to authenticated;

/** Name and texts of a community (content staff and above), with a reason for the journal. */
create or replace function public.admin_update_community(p_id uuid, p_name text, p_tagline text, p_description text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare c public.communities; why text; changed text[] := '{}';
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  why := private.need_reason(p_reason);
  select * into c from public.communities where id = p_id and deleted_at is null for update;
  if c.id is null then raise exception 'this community no longer exists' using errcode = 'P0002'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 60 then raise exception 'a name has 3 to 60 characters' using errcode = '22023'; end if;
  if btrim(p_name) is distinct from c.name then changed := array_append(changed, 'name'); end if;
  if nullif(btrim(coalesce(p_tagline, '')), '') is distinct from c.tagline then changed := array_append(changed, 'tagline'); end if;
  if nullif(btrim(coalesce(p_description, '')), '') is distinct from c.description then changed := array_append(changed, 'description'); end if;
  if cardinality(changed) = 0 then return; end if;
  update public.communities set name = btrim(p_name), tagline = nullif(btrim(coalesce(p_tagline, '')), ''),
    description = nullif(btrim(coalesce(p_description, '')), '') where id = p_id;
  perform private.journal('community.edited', c.created_by, null, 'community', p_id, why, jsonb_build_object('fields', to_jsonb(changed)));
end $$;
revoke all on function public.admin_update_community(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_update_community(uuid, text, text, text, text) to authenticated;

/**
 * Replaces (or removes, with null) a community's photo. The new photo is the
 * staff member's own upload, just made by the app; its path is new, so every
 * screen loads it instead of a cached copy. The old file is queued for the
 * storage purge only now that the new reference is saved, and only if
 * nothing else points at it.
 */
create or replace function public.admin_set_community_cover(p_id uuid, p_path text, p_reason text)
returns void language plpgsql security definer set search_path = public, private as $$
declare old text; why text;
begin
  if not private.is_content_staff(auth.uid()) then raise exception 'IRLY content team only' using errcode = '42501'; end if;
  why := private.need_reason(p_reason);
  select cover_path into old from public.communities where id = p_id and deleted_at is null for update;
  if not found then raise exception 'this community no longer exists' using errcode = 'P0002'; end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  if p_path is not distinct from old then return; end if;
  update public.communities set cover_path = p_path where id = p_id;
  if old is not null and old ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'
     and not exists (select 1 from public.communities where cover_path = old)
     and not exists (select 1 from public.activities where cover_path = old)
     and not exists (select 1 from public.conversations where photo_path = old) then
    insert into private.storage_cleanup (bucket_id, name, user_id, reason)
    values ('activity-photos', old, split_part(old, '/', 1)::uuid, 'orphan')
    on conflict do nothing;
  end if;
  perform private.journal(case when p_path is null then 'community.photo_removed' else 'community.photo_replaced' end,
    (select created_by from public.communities where id = p_id), null, 'community', p_id, why);
end $$;
revoke all on function public.admin_set_community_cover(uuid, text, text) from public, anon;
grant execute on function public.admin_set_community_cover(uuid, text, text) to authenticated;

-- ───────── 9. Activities, posts, comments, lives ─────────
create or replace function public.admin_content(p_kind text, p_search text default null, p_filter text default null, p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, author_id uuid, author_name text, created_at timestamptz, state text,
  girl_only boolean, context text, reports bigint)
language plpgsql stable security definer set search_path = public, private as $$
declare q text := nullif(btrim(coalesce(p_search, '')), ''); lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  perform private.need_staff();
  if p_kind = 'activity' then
    return query
      select a.id, 'activity'::text, a.title, left(a.description, 300), a.creator_id, p.first_name, a.created_at,
        case when a.moderated_at is not null then 'hidden' when a.cancelled_at is not null then 'cancelled'
             when coalesce(a.ends_at, a.starts_at) < now() then 'past' else 'visible' end,
        a.girl_only, a.city_id || ' · ' || to_char(a.starts_at at time zone a.timezone, 'YYYY-MM-DD HH24:MI'),
        (select count(*) from public.reports r where r.target_kind in ('activity', 'event') and r.target_id = a.id)
      from public.activities a left join public.profiles p on p.id = a.creator_id
      where (q is null or private.has_text(a.title, q) or private.has_text(p.first_name, q) or a.id::text = q or a.creator_id::text = q)
        and (p_filter is null or (p_filter = 'hidden' and a.moderated_at is not null)
             or (p_filter = 'reported' and exists (select 1 from public.reports r where r.target_kind in ('activity', 'event') and r.target_id = a.id)))
      order by a.created_at desc limit lim;
  elsif p_kind = 'community_post' then
    return query
      select x.id, 'community_post'::text, c.name, left(x.body, 300), x.author_id, p.first_name, x.created_at,
        case when private.is_held('community_post', x.id) then 'hidden' when x.deleted_at is not null then 'deleted' else 'visible' end,
        coalesce(c.girl_only, false), coalesce(c.name, 'Profile post') || case when cardinality(x.media_paths) > 0 then ' · ' || cardinality(x.media_paths) || ' media' else '' end,
        (select count(*) from public.reports r where r.target_kind = 'community_post' and r.target_id = x.id)
      from public.community_posts x left join public.profiles p on p.id = x.author_id left join public.communities c on c.id = x.community_id
      where (q is null or private.has_text(x.body, q) or private.has_text(p.first_name, q) or x.id::text = q or x.author_id::text = q)
        and (p_filter is null or (p_filter = 'hidden' and private.is_held('community_post', x.id))
             or (p_filter = 'reported' and exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = x.id)))
      order by x.created_at desc limit lim;
  elsif p_kind = 'comment' then
    return query
      select x.id, 'comment'::text, null::text, left(x.body, 300), x.author_id, p.first_name, x.created_at,
        case when private.is_held('comment', x.id) then 'hidden' when x.deleted_at is not null then 'deleted' else 'visible' end,
        private.girl_target(x.target_type, x.target_id), x.target_type,
        (select count(*) from public.reports r where r.target_kind = 'comment' and r.target_id = x.id)
      from public.comments x left join public.profiles p on p.id = x.author_id
      where (q is null or private.has_text(x.body, q) or private.has_text(p.first_name, q) or x.id::text = q or x.author_id::text = q)
        and (p_filter is null or (p_filter = 'hidden' and private.is_held('comment', x.id))
             or (p_filter = 'reported' and exists (select 1 from public.reports r where r.target_kind = 'comment' and r.target_id = x.id)))
      order by x.created_at desc limit lim;
  elsif p_kind = 'irl_post' then
    return query
      select x.id, 'irl_post'::text, null::text, left(x.body, 300), x.author_id, p.first_name, x.created_at,
        case when private.is_held('irl_post', x.id) then 'hidden' when x.expires_at <= now() then 'expired' else 'visible' end,
        x.app_scope <> 'irly', x.visibility || coalesce(' · ' || x.media_kind, ''),
        (select count(*) from public.reports r where r.target_kind = 'irl_post' and r.target_id = x.id)
      from public.irl_posts x left join public.profiles p on p.id = x.author_id
      where (q is null or private.has_text(x.body, q) or private.has_text(p.first_name, q) or x.id::text = q or x.author_id::text = q)
        and (p_filter is null or (p_filter = 'hidden' and private.is_held('irl_post', x.id))
             or (p_filter = 'reported' and exists (select 1 from public.reports r where r.target_kind = 'irl_post' and r.target_id = x.id)))
      order by x.created_at desc limit lim;
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;
end $$;
revoke all on function public.admin_content(text, text, text, integer) from public, anon;
grant execute on function public.admin_content(text, text, text, integer) to authenticated;

/** One item, whole: text, author, reports about it, and the team's hold on it. */
create or replace function public.admin_content_item(p_kind text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare item jsonb; kinds text[] := case p_kind when 'activity' then array['activity', 'event'] else array[p_kind] end;
begin
  perform private.need_staff();
  item := case p_kind
    when 'activity' then (select jsonb_build_object('title', a.title, 'body', a.description, 'author_id', a.creator_id, 'created_at', a.created_at,
        'starts_at', a.starts_at, 'place', coalesce(a.place_name, a.area_id), 'city', a.city_id, 'girl_only', a.girl_only, 'privacy', a.privacy,
        'cancelled', a.cancelled_at is not null, 'hidden', a.moderated_at is not null, 'going', private.going_count(a.id),
        'community', (select name from public.communities where id = a.community_id)) from public.activities a where a.id = p_id)
    when 'community_post' then (select jsonb_build_object('body', x.body, 'author_id', x.author_id, 'created_at', x.created_at,
        'media', cardinality(x.media_paths), 'deleted', x.deleted_at is not null, 'community', (select name from public.communities where id = x.community_id))
        from public.community_posts x where x.id = p_id)
    when 'comment' then (select jsonb_build_object('body', x.body, 'author_id', x.author_id, 'created_at', x.created_at, 'deleted', x.deleted_at is not null, 'on', x.target_type)
        from public.comments x where x.id = p_id)
    when 'irl_post' then (select jsonb_build_object('body', x.body, 'author_id', x.author_id, 'created_at', x.created_at, 'expires_at', x.expires_at,
        'media', x.media_kind, 'girl_only', x.app_scope <> 'irly') from public.irl_posts x where x.id = p_id)
    else null end;
  if item is null then
    -- Deleted: what was kept for moderation, if anything.
    item := (select jsonb_build_object('body', rc.body, 'gone', true) from private.removed_content rc
             where rc.id = p_id and rc.source = case p_kind when 'activity' then 'activities' when 'community_post' then 'community_posts'
                                                             when 'comment' then 'comments' when 'irl_post' then 'irl_posts' end);
    if item is null then raise exception 'not found' using errcode = 'P0002'; end if;
  end if;
  return item || jsonb_build_object(
    'kind', p_kind, 'id', p_id,
    'author_name', (select first_name from public.profiles where id = (item ->> 'author_id')::uuid),
    'hold', (select jsonb_build_object('reason', h.reason, 'at', h.created_at, 'by', coalesce(p.first_name, 'IRLY (automatic)'), 'final', h.final)
             from private.moderation_holds h left join public.profiles p on p.id = h.created_by
             where h.kind = p_kind and h.target_id = p_id and (h.active or h.final) order by h.created_at desc limit 1),
    'reports', coalesce((select jsonb_agg(x order by x.created_at desc) from (
        select m.id as case_id, m.status, r.category, r.created_at from public.reports r join public.moderation_cases m on m.report_id = r.id
        where r.target_kind = any (kinds) and r.target_id = p_id order by r.created_at desc limit 30) x), '[]'));
end $$;
revoke all on function public.admin_content_item(text, uuid) from public, anon;
grant execute on function public.admin_content_item(text, uuid) to authenticated;

/** Hide, restore or delete an activity, a community, a post, a comment or a live (admins, with a reason). */
create or replace function public.admin_moderate(p_kind text, p_id uuid, p_action text, p_reason text, p_case uuid default null)
returns void language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  perform private.moderate_item(p_kind, p_id, p_action, private.need_reason(p_reason), p_case);
end $$;
revoke all on function public.admin_moderate(text, uuid, text, text, uuid) from public, anon;
grant execute on function public.admin_moderate(text, uuid, text, text, uuid) to authenticated;

-- ───────── 10. Reports: related cases ─────────
/** Other reports on the same item, then on the same member (never the reporter's identity to anyone but staff). */
create or replace function public.admin_case_related(p_case uuid)
returns table (case_id uuid, status text, category text, target_kind text, created_at timestamptz, same_item boolean)
language plpgsql stable security definer set search_path = public as $$
declare r public.reports;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  select rr.* into r from public.moderation_cases m join public.reports rr on rr.id = m.report_id where m.id = p_case;
  if r.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  return query
    select m.id, m.status, o.category, o.target_kind, o.created_at,
      (o.target_kind = r.target_kind and o.target_id is not distinct from r.target_id)
    from public.reports o join public.moderation_cases m on m.report_id = o.id
    where o.id <> r.id
      and ((o.target_kind = r.target_kind and o.target_id = r.target_id) or (r.target_user_id is not null and o.target_user_id = r.target_user_id))
    order by 6 desc, o.created_at desc limit 50;
end $$;
revoke all on function public.admin_case_related(uuid) from public, anon;
grant execute on function public.admin_case_related(uuid) to authenticated;

/** The whole journal, newest first, with the reason and what it was about (admins). */
create or replace function public.admin_journal(p_limit integer default 200, p_before timestamptz default null)
returns table (id bigint, at timestamptz, actor_name text, action text, target_user uuid, target_name text, case_id uuid,
  kind text, item_id text, reason text, result text)
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  return query
    select a.id, a.at, coalesce(pa.first_name, 'IRLY server'), a.action, a.target_user, pt.first_name, a.case_id,
      a.details ->> 'kind', a.details ->> 'id', a.details ->> 'reason', a.result
    from private.admin_audit a left join public.profiles pa on pa.id = a.actor left join public.profiles pt on pt.id = a.target_user
    where p_before is null or a.at < p_before
    order by a.at desc limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;
revoke all on function public.admin_journal(integer, timestamptz) from public, anon;
grant execute on function public.admin_journal(integer, timestamptz) to authenticated;
