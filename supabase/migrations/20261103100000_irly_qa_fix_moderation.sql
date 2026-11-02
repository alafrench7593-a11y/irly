-- QA fixes: moderation, communities, IRLY Girl access (QA reports
-- communities.md and spaces.md of 2026-11-01).
-- Additive and idempotent: functions are replaced, triggers and policies are
-- dropped if they exist and created again. RLS stays on everywhere. The only
-- rows removed are pins pointing at removed posts (section 4): they are
-- invisible, cannot be unpinned and block pinning.
--
--  1. COMMUNITIES-02  A suspended or banned staff member loses every staff
--                     power while the sanction runs. The owner role is the
--                     exception: someone must always be able to run the back
--                     office and lift a mistaken sanction.
--  2. COMMUNITIES-01  Lifting a sanction needs the authority that setting it
--                     would have needed; nobody lifts their own.
--  3. COMMUNITIES-03  A community the IRLY team hides takes its chats out of
--                     the inboxes; restoring it puts them back.
--  4. COMMUNITIES-04  A removed post loses its pin; unpinning always works.
--  5. COMMUNITIES-05  IRLY's names, their look-alikes and the IRLY brand prefix
--                     stay IRLY's.
--  6. COMMUNITIES-06  A community cannot move to another city.
--  7. COMMUNITIES-07  Owners and moderators remove a member.
--  8. COMMUNITIES-08  Owners and moderators remove a comment in their community.
--  9. COMMUNITIES-09  Closing, dismissing or actioning a case needs a note.
-- 10. COMMUNITIES-10  Member posts, comments and lives are for moderators;
--                     the content role keeps activities (not IRLY Girl ones).
-- 11. COMMUNITIES-11  A group name has 3 to 60 characters, as the table says.
-- 12. COMMUNITIES-12  An owner cannot "leave" her community: she hands it over
--                     or deletes it.
-- 13. spaces.md P2    A platform suspension or ban closes IRLY Girl (reads
--                     included) while it runs.

-- ───────── 1. Sanctioned staff lose their powers ─────────
-- private.staff_role(uid) stays the role someone HOLDS: it protects them
-- (a suspended moderator is still out of another moderator's reach) and the
-- back office shows it. private.staff_power(uid) is the role someone may USE.
/** The staff role someone may use now: none while a suspension or a ban runs, except for an owner. */
create or replace function private.staff_power(uid uuid default auth.uid()) returns text
language sql stable security definer set search_path = public, private as $$
  select case
    when r is null then null
    when r = 'owner' then r
    when private.is_sanctioned(uid) then null
    else r
  end
  from (select private.staff_role(uid) as r) x
$$;
revoke all on function private.staff_power(uuid) from public, anon, authenticated;

create or replace function private.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_power(uid) in ('owner', 'admin'), false)
$$;

create or replace function private.is_moderator(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_power(uid) in ('owner', 'admin', 'moderator'), false)
$$;
revoke all on function private.is_moderator(uuid) from public, anon, authenticated;

create or replace function private.is_content_staff(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(private.staff_power(uid) in ('owner', 'admin', 'content'), false)
$$;
revoke all on function private.is_content_staff(uuid) from public, anon;
grant execute on function private.is_content_staff(uuid) to authenticated;

create or replace function private.i_am_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select private.staff_power(auth.uid()) is not null
$$;
revoke all on function private.i_am_staff() from public, anon;
grant execute on function private.i_am_staff() to authenticated;

create or replace function private.need_staff() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if private.staff_power(auth.uid()) is null then raise exception 'IRLY team only' using errcode = '42501'; end if;
end $$;
revoke all on function private.need_staff() from public, anon, authenticated;

/** The caller's usable staff role (null for members and for suspended staff): the app shows the back office from it. */
create or replace function public.my_staff_role() returns text
language sql stable security definer set search_path = public as $$
  select private.staff_power(auth.uid())
$$;
revoke all on function public.my_staff_role() from public, anon;
grant execute on function public.my_staff_role() to authenticated;

-- ───────── 2. Lifting a sanction ─────────
-- The same authority as setting it: a moderator lifts what a moderator could
-- have set (a member's or the content role's warning or suspension of 7 days
-- at most, set by a moderator); a sanction on a moderator, a longer one, one
-- an admin set, and any ban are for admins; an admin's own sanction is for
-- the owner. Nobody lifts their own: a sanctioned moderator or admin has no
-- staff power left anyway (section 1), and an owner cannot be sanctioned
-- from the app.
create or replace function public.mod_lift_sanction(p_sanction uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); mine text; s public.sanctions;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  mine := private.staff_role(me);
  select * into s from public.sanctions where id = p_sanction;
  if s.id is null then raise exception 'no such sanction' using errcode = '22023'; end if;
  if s.user_id = me then raise exception 'you cannot lift your own sanction' using errcode = '42501'; end if;
  if s.lifted_at is not null then return; end if;
  if private.staff_rank(private.staff_role(s.user_id)) >= private.staff_rank(mine) then
    raise exception 'you cannot lift this member''s sanction' using errcode = '42501';
  end if;
  if s.kind = 'ban' and not private.is_admin(me) then raise exception 'admins only' using errcode = '42501'; end if;
  if not private.is_admin(me) and (
       private.staff_rank(private.staff_role(s.created_by)) > private.staff_rank(mine)
       or (s.kind = 'suspension' and s.ends_at is not null and s.ends_at - s.created_at > interval '7 days 1 hour')) then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  update public.sanctions set lifted_at = now(), lifted_by = me, lift_reason = btrim(p_reason) where id = p_sanction;
  if not private.is_sanctioned(s.user_id) then perform private.end_sessions(s.user_id, null); end if;
  perform private.audit('sanction.lifted', s.user_id, s.case_id, jsonb_build_object('sanction', s.id, 'kind', s.kind, 'reason', btrim(p_reason)));
end $$;
revoke all on function public.mod_lift_sanction(uuid, text) from public, anon;
grant execute on function public.mod_lift_sanction(uuid, text) to authenticated;

/** Lifts every active suspension (and, for admins, ban) of a member: the account is active again. Same rules as mod_lift_sanction, all or nothing. */
create or replace function public.admin_reactivate(p_user uuid, p_reason text) returns integer
language plpgsql security definer set search_path = public, private as $$
declare s record; n integer := 0; why text;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'you cannot lift your own sanction' using errcode = '42501'; end if;
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

-- ───────── 3, 4. Hide and restore (communities' chats, pins) ─────────
-- Last defined in 20261027200000_irly_admin_console. Changes:
--  - hiding a community takes its chats (and its groups' chats) out of every
--    inbox, as deleting it does; the hold keeps each chat member's row
--    (read marker, muted, archived) and restoring puts back those still in
--    the community.
--  - hiding a post keeps its pin in the hold (the post loses it, section 4);
--    restoring pins it again when the community has room.
create or replace function private.moderate_item(p_kind text, p_id uuid, p_action text, p_reason text, p_case uuid, p_auto boolean default false)
returns void language plpgsql security definer set search_path = public, private as $$
declare
  h private.moderation_holds;
  a public.activities;
  author uuid;
  p record;
  ids uuid[];
  chat jsonb;
  pin jsonb;
  cid uuid;
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
      -- Their chats leave every inbox while the hold lasts (kept here for the restore).
      select coalesce(jsonb_agg(jsonb_build_object('c', cm.conversation_id, 'u', cm.user_id, 'role', cm.role, 'joined_at', cm.joined_at,
               'last_read_at', cm.last_read_at, 'muted', cm.muted, 'archived_at', cm.archived_at, 'cleared_at', cm.cleared_at)), '[]'::jsonb)
        into chat
        from public.conversation_members cm join public.conversations v on v.id = cm.conversation_id
        where v.community_id = any (coalesce(ids, '{}'::uuid[]));
      delete from public.conversation_members cm using public.conversations v
      where v.id = cm.conversation_id and v.community_id = any (coalesce(ids, '{}'::uuid[]));
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, jsonb_build_object('ids', to_jsonb(ids), 'chat', chat), p_reason, p_case, auth.uid());
    elsif p_kind = 'irl_post' then
      select expires_at into p from public.irl_posts where id = p_id for update;
      if not found then raise exception 'not found' using errcode = 'P0002'; end if;
      update public.irl_posts set expires_at = now() where id = p_id;
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, jsonb_build_object('expires_at', p.expires_at), p_reason, p_case, case when p_auto then null else auth.uid() end);
    else
      if p_kind = 'community_post' then
        select jsonb_build_object('pinned_at', x.pinned_at, 'pinned_by', x.pinned_by) into pin
        from public.community_pins x where x.post_id = p_id;
        update public.community_posts set deleted_at = now() where id = p_id and deleted_at is null;
      else
        update public.comments set deleted_at = now() where id = p_id and deleted_at is null;
      end if;
      if not found then raise exception 'already removed by its author, or gone' using errcode = '22023'; end if;
      insert into private.moderation_holds (kind, target_id, prev, reason, case_id, created_by)
      values (p_kind, p_id, case when pin is not null then jsonb_build_object('pin', pin) else '{}'::jsonb end,
              p_reason, p_case, case when p_auto then null else auth.uid() end);
    end if;

  elsif p_action = 'restore' then
    if h.id is null or h.final then raise exception 'nothing to restore: the team did not hide this' using errcode = '22023'; end if;
    if p_kind = 'activity' then
      update public.activities set moderated_at = null, cancelled_at = (h.prev ->> 'cancelled_at')::timestamptz where id = p_id;
    elsif p_kind = 'community' then
      update public.communities set deleted_at = null
      where id in (select (jsonb_array_elements_text(coalesce(h.prev -> 'ids', '[]')))::uuid);
      -- The chats come back for those still in the community (holds older than this migration kept none).
      insert into public.conversation_members (conversation_id, user_id, role, joined_at, last_read_at, muted, archived_at, cleared_at)
      select (e ->> 'c')::uuid, (e ->> 'u')::uuid, coalesce(e ->> 'role', 'member'), coalesce((e ->> 'joined_at')::timestamptz, now()),
        (e ->> 'last_read_at')::timestamptz, coalesce((e ->> 'muted')::boolean, false), (e ->> 'archived_at')::timestamptz, (e ->> 'cleared_at')::timestamptz
      from jsonb_array_elements(coalesce(h.prev -> 'chat', '[]'::jsonb)) e
      join public.conversations v on v.id = (e ->> 'c')::uuid
      join public.communities c on c.id = v.community_id and c.deleted_at is null
      where exists (select 1 from public.community_members m where m.community_id = v.community_id and m.user_id = (e ->> 'u')::uuid)
        and exists (select 1 from public.profiles pr where pr.id = (e ->> 'u')::uuid and pr.deleted_at is null)
      on conflict do nothing;
    elsif p_kind = 'irl_post' then
      if (h.prev ->> 'expires_at')::timestamptz <= now() then
        raise exception 'this live has expired since: it cannot come back' using errcode = '22023';
      end if;
      update public.irl_posts set expires_at = (h.prev ->> 'expires_at')::timestamptz where id = p_id;
    elsif p_kind = 'community_post' then
      update public.community_posts set deleted_at = null where id = p_id;
      -- Pinned again if it was and the community still has room.
      if h.prev ? 'pin' then
        select community_id into cid from public.community_posts where id = p_id;
        if cid is not null and (select count(*) from public.community_pins x join public.community_posts y on y.id = x.post_id and y.deleted_at is null
                                where x.community_id = cid) < 10 then
          insert into public.community_pins (post_id, community_id, pinned_by, pinned_at)
          values (p_id, cid, (h.prev -> 'pin' ->> 'pinned_by')::uuid, coalesce((h.prev -> 'pin' ->> 'pinned_at')::timestamptz, now()))
          on conflict (post_id) do nothing;
        end if;
      end if;
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

-- ───────── 4. Pins of removed posts ─────────
-- However a post is removed (its author, a moderator, the IRLY team), its pin goes.
create or replace function private.unpin_removed_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    delete from public.community_pins where post_id = new.id;
  end if;
  return null;
end $$;
revoke all on function private.unpin_removed_post() from public, anon, authenticated;
drop trigger if exists community_posts_unpin_removed on public.community_posts;
create trigger community_posts_unpin_removed after update of deleted_at on public.community_posts
  for each row execute function private.unpin_removed_post();

-- One-off cleanup (justified orphans): pins pointing at posts already
-- removed. Nobody sees them (the feeds skip removed posts), pin_post could
-- not unpin them ("post not found") and they still counted toward the limit
-- of 10, so a community could end up unable to pin anything.
delete from public.community_pins x using public.community_posts p
where p.id = x.post_id and p.deleted_at is not null;

-- Last defined in 20261018000100_irly_community_groups. Unpinning works on a
-- removed post; the limit counts live posts only.
create or replace function public.pin_post(p_post uuid, p_on boolean default true) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  gone timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select community_id, deleted_at into cid, gone from public.community_posts where id = p_post;
  if cid is null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not private.moderates(cid) then raise exception 'only moderators can pin' using errcode = '42501'; end if;
  if not p_on then
    delete from public.community_pins where post_id = p_post;
    return false;
  end if;
  if gone is not null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.community_pins where post_id = p_post)
     and (select count(*) from public.community_pins x join public.community_posts y on y.id = x.post_id and y.deleted_at is null
          where x.community_id = cid) >= 10 then
    raise exception 'unpin a post first: 10 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.community_pins (post_id, community_id, pinned_by) values (p_post, cid, auth.uid())
  on conflict (post_id) do update set pinned_at = now(), pinned_by = auth.uid();
  return true;
end $$;
revoke all on function public.pin_post(uuid, boolean) from public, anon;
grant execute on function public.pin_post(uuid, boolean) to authenticated;

-- ───────── 5. IRLY's names stay IRLY's ─────────
-- The key two names share when they look the same: Unicode compatibility
-- forms folded (NFKC: full-width letters, no-break spaces), accents dropped,
-- common Cyrillic and Greek look-alikes and 1 / l / | / 0 read as Latin
-- letters, then everything but letters and digits removed (spaces,
-- punctuation, zero-width characters). « IRLY-Sport. », « ІRLY Sроrt » and
-- « irly sport » share one key. Names only, never shown.
create or replace function private.reserved_name_key(p text) returns text
language sql immutable set search_path = pg_catalog as $$
  select regexp_replace(
    translate(
      regexp_replace(normalize(lower(normalize(coalesce(p, ''), NFKC)), NFKD), '[̀-ͯ]', '', 'g'),
      'авекмнорстухіјѕԁɡӏαβγεικνορτυχıłø|1l0',
      'abekmhopctyxijsdgiabyeikvoptuxiioiiio'),
    '[^a-z0-9]', '', 'g')
$$;
revoke all on function private.reserved_name_key(text) from public, anon, authenticated;

-- Last defined in 20261029200000_irly_account_audit. Members (not IRLY's
-- admins, not IRLY's own rows) cannot take: the name of any IRLY topic,
-- retired ones included, under any look-alike spelling; a name starting
-- with IRLY; a name starting like an IRLY Girl community (Girl Trip, Girl
-- Expat, Girl Sport, Girl Activité, Girl CEO). A name kept unchanged is
-- never refused, so communities named before this rule keep their name.
create or replace function private.official_name_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare k text;
begin
  if new.official or auth.uid() is null or private.is_admin(auth.uid()) then
    return new;
  end if;
  if tg_op = 'UPDATE' and private.community_name_key(new.name) = private.community_name_key(old.name) then
    return new;
  end if;
  k := private.reserved_name_key(new.name);
  if k = '' then return new; end if;
  if exists (select 1 from public.community_topics t where private.reserved_name_key(t.name) = k)
     or exists (select 1 from unnest(array['IRLY', 'Girl Trip', 'Girl Expat', 'Girl Sport', 'Girl Activit', 'Girl CEO']) r(prefix)
                where starts_with(k, private.reserved_name_key(r.prefix))) then
    raise exception 'this name is reserved for an IRLY community' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.official_name_guard() from public, anon, authenticated;
drop trigger if exists communities_official_name_guard on public.communities;
create trigger communities_official_name_guard before insert or update of name on public.communities
  for each row execute function private.official_name_guard();

-- ───────── 6. A community stays in its city ─────────
-- Same guard as 20261028100000_irly_official_communities_four, one more column
-- (IRLY admins still can; a group follows its parent through subgroup_shape).
drop trigger if exists communities_edit_guard on public.communities;
create trigger communities_edit_guard before update on public.communities
for each row execute function private.edit_guard('created_by', 'girl_only', 'created_at', 'official', 'topic', 'members_count', 'retired_at', 'city_id');

-- ───────── 7. Removing a member ─────────
/**
 * The owner or a moderator of a community (or of its parent, or an IRLY
 * admin) removes a member: she leaves the community, its groups and their
 * chats (the usual triggers), and may join again later. Nobody removes an
 * owner; only the owner (or IRLY) removes a moderator. Leaving oneself is
 * leave_community.
 */
create or replace function public.remove_community_member(p_community uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  parent uuid;
  theirs text;
  their_parent text;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'to leave a community, use Leave' using errcode = '22023'; end if;
  select parent_id into parent from public.communities where id = p_community and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not private.moderates(p_community) then
    raise exception 'only the community''s owner and moderators can remove a member' using errcode = '42501';
  end if;
  select role into theirs from public.community_members where community_id = p_community and user_id = p_user for update;
  if not found then raise exception 'not a member' using errcode = 'P0002'; end if;
  select role into their_parent from public.community_members where community_id = parent and user_id = p_user;
  if theirs = 'owner' or their_parent = 'owner' then
    raise exception 'the owner cannot be removed' using errcode = '42501';
  end if;
  if (theirs = 'moderator' or their_parent = 'moderator') and not (private.is_admin(me) or exists (
    select 1 from public.community_members where user_id = me and role = 'owner' and community_id in (p_community, parent)
  )) then
    raise exception 'only the owner can remove a moderator' using errcode = '42501';
  end if;
  delete from public.community_members where community_id = p_community and user_id = p_user;
end $$;
revoke all on function public.remove_community_member(uuid, uuid) from public, anon;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;

-- ───────── 8. Removing a comment in one's community ─────────
/** The community of a comment's post (null when the comment is not under a community post). */
create or replace function private.comment_community(p_type text, p_id text) returns uuid
language sql stable security definer set search_path = public as $$
  select p.community_id from public.community_posts p
  where p_type = 'community_post'
    and p.id = case when p_type = 'community_post' and p_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then p_id::uuid end
$$;
revoke all on function private.comment_community(text, text) from public, anon;
grant execute on function private.comment_community(text, text) to authenticated;

-- The app removes a comment with an update of deleted_at, as for posts.
drop policy if exists comments_moderate on public.comments;
create policy comments_moderate on public.comments for update to authenticated
  using (target_type = 'community_post' and private.moderates(private.comment_community(target_type, target_id)))
  with check (target_type = 'community_post' and deleted_at is not null
              and private.moderates(private.comment_community(target_type, target_id)));

-- Someone else than the author (a community's owner or moderator) only removes:
-- the words go (private.erase_on_remove), nothing else changes.
create or replace function private.comment_moderator_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid()) or auth.uid() = old.author_id then
    return new;
  end if;
  if not (old.deleted_at is null and new.deleted_at is not null)
     or (to_jsonb(new) - 'deleted_at' - 'updated_at' - 'body') is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at' - 'body') then
    raise exception 'moderators can only remove a comment' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.comment_moderator_guard() from public, anon;
grant execute on function private.comment_moderator_guard() to authenticated;
drop trigger if exists comments_moderator_guard on public.comments;
create trigger comments_moderator_guard before update on public.comments
  for each row execute function private.comment_moderator_guard();

-- ───────── 9. Closing a case needs a note ─────────
-- Last defined in 20261023000000_irly_admin_moderation (docs/ADMIN.md: « Closing needs a note »).
create or replace function public.mod_case_update(p_case uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = public, private as $$
declare me uuid := auth.uid(); old text; tuid uuid;
begin
  if not private.is_moderator(me) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  if p_status not in ('open', 'reviewing', 'need_info', 'actioned', 'dismissed', 'closed') then
    raise exception 'unknown status' using errcode = '22023';
  end if;
  if p_status in ('actioned', 'dismissed', 'closed') and char_length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'write a note (3 characters at least) to close a case' using errcode = '22023';
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

-- ───────── 10. What each staff role reads ─────────
-- Last defined in 20261027200000_irly_admin_console. Members' posts,
-- comments and lives (their words, kept words of removed ones included) are
-- for moderators and above: the content role works on communities and
-- activities. IRLY Girl content stays readable by every moderator (they
-- handle its reports; admin_global's tests ask for it); for the content
-- role, only when she has IRLY Girl access herself.
create or replace function public.admin_content(p_kind text, p_search text default null, p_filter text default null, p_limit integer default 50)
returns table (id uuid, kind text, title text, body text, author_id uuid, author_name text, created_at timestamptz, state text,
  girl_only boolean, context text, reports bigint)
language plpgsql stable security definer set search_path = public, private as $$
declare
  q text := nullif(btrim(coalesce(p_search, '')), '');
  lim integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  see_girl boolean;
begin
  perform private.need_staff();
  if p_kind in ('community_post', 'comment', 'irl_post') and not private.is_moderator(auth.uid()) then
    raise exception 'IRLY moderators only' using errcode = '42501';
  end if;
  see_girl := private.is_moderator(auth.uid()) or private.girl_eligible_unchecked(auth.uid());
  if p_kind = 'activity' then
    return query
      select a.id, 'activity'::text, a.title, left(a.description, 300), a.creator_id, p.first_name, a.created_at,
        case when a.moderated_at is not null then 'hidden' when a.cancelled_at is not null then 'cancelled'
             when coalesce(a.ends_at, a.starts_at) < now() then 'past' else 'visible' end,
        a.girl_only, a.city_id || ' · ' || to_char(a.starts_at at time zone a.timezone, 'YYYY-MM-DD HH24:MI'),
        (select count(*) from public.reports r where r.target_kind in ('activity', 'event') and r.target_id = a.id)
      from public.activities a left join public.profiles p on p.id = a.creator_id
      where (see_girl or not a.girl_only)
        and (q is null or private.has_text(a.title, q) or private.has_text(p.first_name, q) or a.id::text = q or a.creator_id::text = q)
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

/** One item, whole: text, author, reports about it, and the team's hold on it (same reading rules as admin_content). */
create or replace function public.admin_content_item(p_kind text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare item jsonb; kinds text[] := case p_kind when 'activity' then array['activity', 'event'] else array[p_kind] end;
begin
  perform private.need_staff();
  if p_kind in ('community_post', 'comment', 'irl_post') and not private.is_moderator(auth.uid()) then
    raise exception 'IRLY moderators only' using errcode = '42501';
  end if;
  if p_kind = 'activity' and not private.is_moderator(auth.uid()) and not private.girl_eligible_unchecked(auth.uid())
     and exists (select 1 from public.activities a where a.id = p_id and a.girl_only) then
    raise exception 'IRLY Girl content: moderators only' using errcode = '42501';
  end if;
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

-- ───────── 11. Group names: 3 to 60 characters ─────────
-- Last defined in 20261018000100_irly_community_groups; the table asks for 3 at least.
create or replace function public.create_subgroup(p_parent uuid, p_name text, p_tagline text default null, p_emoji text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  p public.communities;
  cid uuid;
  conv uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into p from public.communities where id = p_parent and deleted_at is null and parent_id is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not private.moderates(p_parent) then raise exception 'only the community''s moderators can add a group' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 60 then raise exception 'name: 3 to 60 characters' using errcode = '22023'; end if;
  if (select count(*) from public.communities where parent_id = p_parent and deleted_at is null) >= 30 then
    raise exception 'a community has 30 groups at most' using errcode = 'P0001';
  end if;
  insert into public.communities (city_id, name, tagline, category_id, girl_only, created_by, official, parent_id, emoji)
  values (p.city_id, btrim(p_name), nullif(btrim(coalesce(p_tagline, '')), ''), p.category_id, p.girl_only, auth.uid(), p.official and private.is_admin(auth.uid()), p.id, nullif(btrim(coalesce(p_emoji, '')), ''))
  returning id into cid;
  conv := private.ensure_conversation('community', cid, btrim(p_name));
  insert into public.community_members (community_id, user_id, role) values (cid, auth.uid(), 'moderator') on conflict do nothing;
  return cid;
end $$;
revoke all on function public.create_subgroup(uuid, text, text, text) from public, anon;
grant execute on function public.create_subgroup(uuid, text, text, text) to authenticated;

-- ───────── 12. The owner does not leave ─────────
-- Last defined in 20261005000000_irly_core. It said yes and did nothing.
create or replace function public.leave_community(p_community uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if exists (select 1 from public.community_members where community_id = p_community and user_id = me and role = 'owner') then
    raise exception 'you own this community: hand it over or delete it first' using errcode = '22023';
  end if;
  delete from public.community_members where community_id = p_community and user_id = me and role <> 'owner';
  delete from public.conversation_members m using public.conversations c
  where c.id = m.conversation_id and c.community_id = p_community and m.user_id = me
    and not exists (select 1 from public.community_members where community_id = p_community and user_id = me);
end $$;
revoke all on function public.leave_community(uuid) from public, anon;
grant execute on function public.leave_community(uuid) to authenticated;

-- ───────── 13. A platform suspension closes IRLY Girl ─────────
-- Last defined in 20261102000000_irly_security_hardening. A suspension or a
-- ban (public.sanctions) blocked her writes only; while it runs she now
-- also loses IRLY Girl reads, as with an IRLY Girl suspension. Nothing is
-- removed: lifted or over, everything opens again as before.
create or replace function private.girl_eligible_unchecked(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.gender = 'woman' and p.deleted_at is null
      and not exists (select 1 from public.girl_suspensions s where s.user_id = uid)
      and private.identity_verified(uid)
  ) and not private.is_sanctioned(uid)
$$;

-- She is told « suspended » (the app shows it with Contact support), not
-- « needs verification ».
create or replace function public.my_girl_status() returns text
language sql stable security definer set search_path = public as $$
  select case
    when private.girl_eligible_unchecked(auth.uid()) then 'open'
    when exists (select 1 from public.girl_suspensions where user_id = auth.uid()) then 'suspended'
    when exists (select 1 from public.profiles p where p.id = auth.uid() and p.gender = 'woman' and p.deleted_at is null)
      then case when private.is_sanctioned(auth.uid()) then 'suspended' else 'needs_verification' end
    else 'not_eligible'
  end
$$;
revoke all on function public.my_girl_status() from public, anon;
grant execute on function public.my_girl_status() to authenticated;
