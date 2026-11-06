-- The IRLY team publishes in its official communities, signed « IRLY »
-- (sections 1-7), and one designated IRLY Girl safety moderator gets a
-- read-only, journaled view of IRLY Girl (section 8).
-- Additive: two columns, functions created or replaced, triggers added. No
-- policy is loosened, no row is changed or removed, RLS stays on everywhere.
--
-- Official communities (communities.official, whatever their topic) have no
-- owner (created_by null), so nobody could post there from the app. A member
-- of the content team (owner, admin or content role: private.is_content_staff)
-- now publishes a post (text, photos, a video), an announcement, a message in
-- the community chat, and pins or unpins posts and chat messages, through the
-- irly_* functions below, in the mixte, IRLY Girl and Mom official
-- communities. What they write carries as_irly: the app shows it as « IRLY »
-- with the official badge, never as the person. The person is still recorded
-- (community_posts.author_id, community_broadcasts.sender_id,
-- private.admin_audit, public.community_audit): accountability stays and
-- every existing rule keeps applying to them (rate limits, sanctions,
-- community restrictions and bans, the community's announcement quota, the
-- 10 pinned posts and 5 pinned messages).
-- A chat message from IRLY has no sender (sender_id null), as IRLY's own
-- notes already have: no member's name is attached to it.
-- Only those functions may set as_irly (a trigger refuses it otherwise), so
-- no member can sign as IRLY.
-- IRLY Girl isolation is never bypassed: in a women-only community (IRLY
-- Girl, Mom) the team member must have IRLY Girl access herself
-- (private.girl_eligible_unchecked, the same predicate as everywhere); being
-- staff opens nothing there. A community created by a member is not IRLY's:
-- the team acts there only through the moderation that already exists.
-- Hardening found on the way (section 7): an IRLY admin without IRLY Girl
-- access could rewrite the posts of women-only communities with an UPDATE
-- that reads no column (it skips the read rules); now only a removal passes.

-- ───────── 1. Columns ─────────
alter table public.community_posts add column if not exists as_irly boolean not null default false;
alter table public.messages add column if not exists as_irly boolean not null default false;
create index if not exists community_posts_irly_idx on public.community_posts (community_id, created_at desc) where as_irly;

-- ───────── 2. Only the irly_* functions sign as IRLY ─────────
create or replace function private.as_irly_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.as_irly is distinct from (case when tg_op = 'INSERT' then false else old.as_irly end)
     and coalesce(current_setting('irly.as_irly', true), '') <> 'on' then
    raise exception 'only IRLY publishes as IRLY' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.as_irly_guard() from public, anon, authenticated;
drop trigger if exists community_posts_as_irly on public.community_posts;
create trigger community_posts_as_irly before insert or update of as_irly on public.community_posts
for each row execute function private.as_irly_guard();
drop trigger if exists messages_as_irly on public.messages;
create trigger messages_as_irly before insert or update of as_irly on public.messages
for each row execute function private.as_irly_guard();
-- Last created in 20261103000000_irly_qa_fix_messaging: every column of a
-- sent message but deleted_at stays frozen, the new one too.
drop trigger if exists messages_edit_guard on public.messages;
create trigger messages_edit_guard before update on public.messages
for each row execute function private.edit_guard(
  'id', 'conversation_id', 'sender_id', 'kind', 'created_at', 'ref_type', 'ref_id', 'body',
  'reply_to', 'edited_at', 'media_path', 'as_irly');

-- ───────── 3. Who ─────────
/** May this person speak as IRLY in this community? Content team, official community, and IRLY Girl access of her own in a women-only one. */
create or replace function private.irly_voice(cid uuid, uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, private as $$
  select uid is not null and coalesce(private.is_content_staff(uid), false) and exists (
    select 1 from public.communities c
    where c.id = cid and c.deleted_at is null and c.official
      and (not c.girl_only or private.girl_eligible_unchecked(uid))
  )
$$;
revoke all on function private.irly_voice(uuid, uuid) from public, anon, authenticated;

/** The community IRLY speaks in, after every check (raises otherwise). */
create or replace function private.irly_need(cid uuid) returns public.communities
language plpgsql stable security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  c public.communities;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into c from public.communities where id = cid and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not coalesce(private.is_content_staff(me), false) then raise exception 'IRLY team only' using errcode = '42501'; end if;
  if not c.official then
    raise exception 'IRLY speaks only in its official communities' using errcode = '42501';
  end if;
  if c.girl_only and not private.girl_eligible_unchecked(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return c;
end $$;
revoke all on function private.irly_need(uuid) from public, anon, authenticated;

-- Last defined in 20261018000100_irly_community_groups. An announcement
-- signed IRLY (irly_announce) is the team's, not a moderator's.
create or replace function private.post_kind_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.kind = 'announcement' and (tg_op = 'INSERT' or old.kind is distinct from 'announcement')
     and auth.uid() is not null and not (new.community_id is not null and private.moderates(new.community_id))
     and not (new.as_irly and coalesce(current_setting('irly.as_irly', true), '') = 'on') then
    raise exception 'only moderators post announcements' using errcode = '42501';
  end if;
  return new;
end $$;

-- ───────── 4. Publishing as IRLY ─────────
/**
 * A post signed IRLY: text, photos (up to 10) or one video, files from the
 * caller's own uploads (as any post). `p_id` makes a retry the same post.
 */
create or replace function public.irly_post(p_community uuid, p_body text, p_id uuid default null,
  p_media_paths text[] default '{}', p_media_kind text default null, p_thumb_path text default null,
  p_media_seconds integer default null, p_category text default null) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  c public.communities;
  v_body text := btrim(coalesce(p_body, ''));
  files text[] := coalesce(p_media_paths, '{}');
  pid uuid := coalesce(p_id, gen_random_uuid());
begin
  c := private.irly_need(p_community);
  if v_body = '' and cardinality(files) = 0 then raise exception 'write something or add a photo' using errcode = '22023'; end if;
  if cardinality(files) > 10 then raise exception 'ten photos at most' using errcode = '22023'; end if;
  if p_media_kind is not null and p_media_kind not in ('photo', 'video') then raise exception 'media: photo or video' using errcode = '22023'; end if;
  if exists (select 1 from public.community_posts where id = pid) then
    -- A retry after a lost answer: that post (only one's own IRLY post, never someone else's).
    if exists (select 1 from public.community_posts where id = pid and author_id = me and as_irly and community_id = c.id) then return pid; end if;
    raise exception 'post not found' using errcode = 'P0002';
  end if;
  perform set_config('irly.as_irly', 'on', true);
  insert into public.community_posts (id, community_id, author_id, body, kind, media_paths, media_kind, thumb_path, media_seconds, category, as_irly)
  values (pid, c.id, me, v_body, 'post', files, case when cardinality(files) > 0 then p_media_kind end, p_thumb_path, p_media_seconds,
          nullif(btrim(coalesce(p_category, '')), ''), true);
  perform set_config('irly.as_irly', 'off', true);
  perform private.community_log(c.id, 'irly.post', null, pid, null);
  perform private.journal('irly.post', null, null, 'community_post', pid, null, jsonb_build_object('community', c.id));
  return pid;
end $$;
revoke all on function public.irly_post(uuid, text, uuid, text[], text, text, integer, text) from public, anon;
grant execute on function public.irly_post(uuid, text, uuid, text[], text, text, integer, text) to authenticated;

/** An announcement signed IRLY: the same quota and notifications as announce(). */
create or replace function public.irly_announce(p_community uuid, p_body text, p_kind text default 'announcement', p_pin boolean default false)
returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  c public.communities;
  v_body text := btrim(coalesce(p_body, ''));
  pid uuid;
  sent integer;
begin
  c := private.irly_need(p_community);
  if p_kind is null or p_kind not in ('announcement', 'event', 'info') then raise exception 'kind: announcement, event or info' using errcode = '22023'; end if;
  if char_length(v_body) not between 3 and 500 then raise exception 'write 3 to 500 characters' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('announce:' || c.id::text, 0));
  if exists (select 1 from public.community_broadcasts where community_id = c.id and created_at > now() - interval '1 hour') then
    raise exception 'one announcement per hour: try again later' using errcode = 'P0001';
  end if;
  if (select count(*) from public.community_broadcasts where community_id = c.id and created_at > now() - interval '1 day') >= 3 then
    raise exception 'three announcements a day at most' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.community_broadcasts b where b.community_id = c.id and lower(b.body) = lower(v_body) and created_at > now() - interval '7 days') then
    raise exception 'this announcement was already sent this week' using errcode = 'P0001';
  end if;
  perform set_config('irly.as_irly', 'on', true);
  insert into public.community_posts (community_id, author_id, body, kind, as_irly)
  values (c.id, me, v_body, 'announcement', true) returning id into pid;
  perform set_config('irly.as_irly', 'off', true);
  if p_pin then
    insert into public.community_pins (post_id, community_id, pinned_by) values (pid, c.id, me) on conflict do nothing;
  end if;
  -- Signed IRLY: no 'from' (the person is in the journal, not in members' notifications).
  insert into public.notifications (user_id, kind, payload)
  select m.user_id, 'COMMUNITY_ANNOUNCEMENT',
    jsonb_build_object('as_irly', true, 'community_id', c.id, 'post_id', pid, 'community', c.name, 'body', left(v_body, 140), 'type', p_kind)
  from public.community_members m
  where m.community_id = c.id and m.user_id <> me;
  get diagnostics sent = row_count;
  insert into public.community_broadcasts (community_id, sender_id, kind, body, post_id, recipients)
  values (c.id, me, p_kind, v_body, pid, sent);
  perform private.community_log(c.id, 'irly.announce', null, pid, null, jsonb_build_object('kind', p_kind, 'pinned', p_pin));
  perform private.journal('irly.announce', null, null, 'community_post', pid, null, jsonb_build_object('community', c.id, 'recipients', sent));
  return sent;
end $$;
revoke all on function public.irly_announce(uuid, text, text, boolean) from public, anon;
grant execute on function public.irly_announce(uuid, text, text, boolean) to authenticated;

/** A message signed IRLY in the community chat (no sender: IRLY's own voice). 20 an hour per chat. */
create or replace function public.irly_chat_message(p_community uuid, p_body text) returns uuid
language plpgsql security definer set search_path = public, private as $$
declare
  c public.communities;
  v_body text := btrim(coalesce(p_body, ''));
  conv uuid;
  mid uuid;
begin
  c := private.irly_need(p_community);
  if char_length(v_body) not between 1 and 2000 then raise exception 'write 1 to 2000 characters' using errcode = '22023'; end if;
  conv := private.ensure_conversation('community', c.id, c.name);
  perform pg_advisory_xact_lock(hashtextextended('irly-chat:' || conv::text, 0));
  if (select count(*) from public.messages where conversation_id = conv and as_irly and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'slow down: too many in a short time' using errcode = '54000';
  end if;
  perform set_config('irly.as_irly', 'on', true);
  insert into public.messages (conversation_id, sender_id, kind, body, as_irly)
  values (conv, null, 'text', v_body, true) returning id into mid;
  perform set_config('irly.as_irly', 'off', true);
  perform private.community_log(c.id, 'irly.message', null, mid, null, jsonb_build_object('conversation_id', conv));
  perform private.journal('irly.message', null, null, 'message', mid, null, jsonb_build_object('community', c.id));
  return mid;
end $$;
revoke all on function public.irly_chat_message(uuid, text) from public, anon;
grant execute on function public.irly_chat_message(uuid, text) to authenticated;

/** Pins (or unpins) a post of an official community, as pin_post does for its moderators. */
create or replace function public.irly_pin_post(p_post uuid, p_on boolean default true, p_until timestamptz default null) returns boolean
language plpgsql security definer set search_path = public, private as $$
declare
  cid uuid;
  gone timestamptz;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select community_id, deleted_at into cid, gone from public.community_posts where id = p_post;
  if cid is null then raise exception 'post not found' using errcode = 'P0002'; end if;
  perform private.irly_need(cid);
  if not coalesce(p_on, false) then
    delete from public.community_pins where post_id = p_post;
    if found then
      perform private.community_log(cid, 'post.unpin', null, p_post, null, '{"as_irly": true}');
      perform private.journal('irly.unpin', null, null, 'community_post', p_post, null, jsonb_build_object('community', cid));
    end if;
    return false;
  end if;
  if gone is not null then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p_until is not null and p_until <= now() then raise exception 'the end of a pin is in the future' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('community_pins:' || cid::text, 0));
  if not exists (select 1 from public.community_pins where post_id = p_post and (expires_at is null or expires_at > now()))
     and (select count(*) from public.community_pins x join public.community_posts y on y.id = x.post_id and y.deleted_at is null
          where x.community_id = cid and (x.expires_at is null or x.expires_at > now())) >= 10 then
    raise exception 'unpin a post first: 10 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.community_pins (post_id, community_id, pinned_by, expires_at) values (p_post, cid, auth.uid(), p_until)
  on conflict (post_id) do update set pinned_at = now(), pinned_by = auth.uid(), expires_at = excluded.expires_at;
  perform private.community_log(cid, 'post.pin', null, p_post, null, jsonb_build_object('until', p_until, 'as_irly', true));
  perform private.journal('irly.pin', null, null, 'community_post', p_post, null, jsonb_build_object('community', cid));
  return true;
end $$;
revoke all on function public.irly_pin_post(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.irly_pin_post(uuid, boolean, timestamptz) to authenticated;

/** Pins (or unpins) a message of an official community's chat, as pin_message does for its moderators. */
create or replace function public.irly_pin_message(p_message uuid, p_on boolean, p_until timestamptz default null) returns boolean
language plpgsql security definer set search_path = public, private as $$
declare
  msg public.messages;
  cid uuid;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  select * into msg from public.messages where id = p_message;
  if not found then raise exception 'not found' using errcode = 'P0002'; end if;
  select v.community_id into cid from public.conversations v where v.id = msg.conversation_id and v.kind = 'community';
  if cid is null then raise exception 'only messages of a community chat' using errcode = '42501'; end if;
  perform private.irly_need(cid);
  if not coalesce(p_on, false) then
    delete from public.message_pins where message_id = p_message;
    if found then
      perform private.community_log(cid, 'message.unpin', msg.sender_id, p_message, null,
        jsonb_build_object('conversation_id', msg.conversation_id, 'as_irly', true));
      perform private.journal('irly.unpin', msg.sender_id, null, 'message', p_message, null, jsonb_build_object('community', cid));
    end if;
    return false;
  end if;
  if msg.deleted_at is not null then raise exception 'not found' using errcode = 'P0002'; end if;
  if p_until is not null and p_until <= now() then raise exception 'the end of a pin is in the future' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('message_pins:' || msg.conversation_id::text, 0));
  if not exists (select 1 from public.message_pins where message_id = p_message and (expires_at is null or expires_at > now()))
     and (select count(*) from public.message_pins x join public.messages y on y.id = x.message_id and y.deleted_at is null
          where x.conversation_id = msg.conversation_id and (x.expires_at is null or x.expires_at > now())) >= 5 then
    raise exception 'unpin a message first: 5 pinned at most' using errcode = 'P0001';
  end if;
  insert into public.message_pins (message_id, conversation_id, pinned_by, expires_at)
  values (p_message, msg.conversation_id, auth.uid(), p_until)
  on conflict (message_id) do update set pinned_at = now(), pinned_by = auth.uid(), expires_at = excluded.expires_at;
  perform private.community_log(cid, 'message.pin', msg.sender_id, p_message, null,
    jsonb_build_object('conversation_id', msg.conversation_id, 'until', p_until, 'as_irly', true));
  perform private.journal('irly.pin', msg.sender_id, null, 'message', p_message, null, jsonb_build_object('community', cid));
  return true;
end $$;
revoke all on function public.irly_pin_message(uuid, boolean, timestamptz) from public, anon;
grant execute on function public.irly_pin_message(uuid, boolean, timestamptz) to authenticated;

-- ───────── 5. IRLY's posts notify as IRLY ─────────
-- on_community_post writes 'from' (the author) into COMMUNITY_POST; for a
-- post signed IRLY the person's id is taken out and the notice says IRLY.
create or replace function private.irly_notification_voice() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if new.kind = 'COMMUNITY_POST' and new.payload ? 'post_id' and new.payload ? 'from'
     and exists (select 1 from public.community_posts p
                 where p.id = private.uuid_or_null(new.payload ->> 'post_id') and p.as_irly) then
    new.payload := (new.payload - 'from') || '{"as_irly": true}';
  end if;
  return new;
end $$;
revoke all on function private.irly_notification_voice() from public, anon, authenticated;
drop trigger if exists notifications_irly_voice on public.notifications;
create trigger notifications_irly_voice before insert on public.notifications
for each row execute function private.irly_notification_voice();

-- Its push reads « IRLY: … » (push_text, unchanged, would say « Someone: »).
create or replace function private.irly_push_voice() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  n public.notifications;
begin
  select * into n from public.notifications where id = new.notification_id;
  if n.kind = 'COMMUNITY_POST' and coalesce(n.payload ->> 'as_irly', '') = 'true' then
    new.body := 'IRLY: ' || coalesce(left(n.payload ->> 'body', 100), '');
  end if;
  return new;
end $$;
revoke all on function private.irly_push_voice() from public, anon, authenticated;
drop trigger if exists push_outbox_irly_voice on public.push_outbox;
create trigger push_outbox_irly_voice before insert on public.push_outbox
for each row execute function private.irly_push_voice();

-- ───────── 6. Rights: can_irly ─────────
-- Last defined in 20261107000000_irly_community_governance. One more key:
-- can_irly (the irly_* functions will accept the caller here).
create or replace function public.community_my_rights(p_community uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  r jsonb;
begin
  r := private.community_act(p_community);
  return coalesce(r, '{}'::jsonb) || jsonb_build_object(
    'can_irly', private.irly_voice(p_community, auth.uid()));
end $$;
revoke all on function public.community_my_rights(uuid) from public, anon;
grant execute on function public.community_my_rights(uuid) to authenticated;

-- ───────── 7. IRLY Girl posts are not rewritten by the team ─────────
-- Without IRLY Girl access, an IRLY admin may remove a post of a women-only
-- community (moderation, as before) but no longer change what it says or
-- shows. Her own IRLY post, the team's photo tool (irly.staff_photo) and
-- server-side work (no auth.uid()) are unchanged.
create or replace function private.girl_staff_edit_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null or old.community_id is null or old.author_id = auth.uid()
     or coalesce(current_setting('irly.staff_photo', true), '') = 'on' then
    return new;
  end if;
  if not exists (select 1 from public.communities c where c.id = old.community_id and c.girl_only) then return new; end if;
  if private.girl_eligible_unchecked(auth.uid()) then return new; end if;
  if (to_jsonb(new) - 'deleted_at' - 'updated_at') is distinct from (to_jsonb(old) - 'deleted_at' - 'updated_at') then
    raise exception 'IRLY Girl content: only a removal' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.girl_staff_edit_guard() from public, anon, authenticated;
drop trigger if exists community_posts_girl_staff_edit on public.community_posts;
create trigger community_posts_girl_staff_edit before update on public.community_posts
for each row execute function private.girl_staff_edit_guard();

-- ───────── 8. The IRLY Girl safety moderator: one person, read-only, journaled ─────────
-- IRLY Girl stays women-only. One person, and only one, may view it for its
-- safety (lists, community pages, feeds, members, activities and, for IRLY's
-- own communities, the chat): the IRLY Girl safety moderator. The owner of
-- the back office (staff role 'owner', the role the Grant owner workflow
-- gives) designates, changes or removes that person in the app (Team and
-- roles), with a reason, in the staff journal; nothing names anyone in the
-- code. The person must be on the IRLY team (any role, not suspended) for
-- the designation to count; it ends by itself when they leave the team.
-- The view goes only through the staff_girl_* functions: each call writes
-- who, what and when to private.admin_audit (action girl.view) before
-- returning anything. The read policies of IRLY Girl are NOT widened: a
-- direct read of a table (REST, Realtime) still returns nothing to anyone
-- without IRLY Girl access, the moderator included, so there is no read the
-- journal would miss (a GET is a read-only transaction and could not write
-- it). The view writes nothing but the journal: joining, posting,
-- messaging, reacting, voting and Match keep demanding IRLY Girl access
-- (unchanged), so the moderator never appears in a member list and is never
-- matched or recommended; and signing as IRLY in IRLY Girl still needs IRLY
-- Girl access of one's own (section 3): the designation gives none. Members
-- are not notified per access; the journal is there for audits.
create table if not exists private.girl_moderator (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);
revoke all on private.girl_moderator from public, anon, authenticated;

/** Is this person the IRLY Girl safety moderator (designated, on the team, not suspended)? */
create or replace function private.girl_moderator_of(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public, private as $$
  select uid is not null
    and exists (select 1 from private.girl_moderator g join public.profiles p on p.id = g.user_id and p.deleted_at is null where g.user_id = uid)
    and private.staff_power(uid) is not null
    and not private.is_sanctioned(uid)
$$;
revoke all on function private.girl_moderator_of(uuid) from public, anon, authenticated;

/** The app asks whether to show the moderation view's door (the server checks again on every read). */
create or replace function public.my_girl_moderation() returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.girl_moderator_of(auth.uid())
$$;
revoke all on function public.my_girl_moderation() from public, anon;
grant execute on function public.my_girl_moderation() to authenticated;

/** Owner only: who the IRLY Girl safety moderator is ({} when nobody). */
create or replace function public.admin_girl_moderator() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  if private.staff_power(auth.uid()) is distinct from 'owner' then
    raise exception 'only the owner designates the IRLY Girl safety moderator' using errcode = '42501';
  end if;
  return coalesce((select jsonb_build_object('user_id', g.user_id, 'first_name', p.first_name, 'granted_at', g.granted_at,
      'active', private.girl_moderator_of(g.user_id))
    from private.girl_moderator g left join public.profiles p on p.id = g.user_id), '{}'::jsonb);
end $$;
revoke all on function public.admin_girl_moderator() from public, anon;
grant execute on function public.admin_girl_moderator() to authenticated;

/** Owner only: designates (or, with null, removes) the one IRLY Girl safety moderator, with a reason. */
create or replace function public.admin_set_girl_moderator(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  why text := btrim(coalesce(p_reason, ''));
  before uuid;
begin
  if private.staff_power(me) is distinct from 'owner' then
    raise exception 'only the owner designates the IRLY Girl safety moderator' using errcode = '42501';
  end if;
  if char_length(why) < 3 then raise exception 'give a reason' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('girl_moderator', 0));
  select user_id into before from private.girl_moderator;
  if p_user is null then
    delete from private.girl_moderator;
    if before is not null then
      perform private.journal('girl.moderator_removed', before, null, 'profile', before, why);
    end if;
    return;
  end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if private.staff_power(p_user) is null then
    raise exception 'the IRLY Girl safety moderator must be on the IRLY team' using errcode = '42501';
  end if;
  insert into private.girl_moderator (singleton, user_id, granted_by, granted_at) values (true, p_user, me, now())
  on conflict (singleton) do update set user_id = excluded.user_id, granted_by = excluded.granted_by, granted_at = excluded.granted_at;
  if before is not null and before <> p_user then
    perform private.journal('girl.moderator_removed', before, null, 'profile', before, why);
  end if;
  perform private.journal('girl.moderator_set', p_user, null, 'profile', p_user, why);
end $$;
revoke all on function public.admin_set_girl_moderator(uuid, text) from public, anon;
grant execute on function public.admin_set_girl_moderator(uuid, text) to authenticated;

/** Refuses anyone but the IRLY Girl safety moderator, then writes the access to the staff journal (who, what, when). */
create or replace function private.staff_girl_need(p_what text, p_id uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if not private.girl_moderator_of(auth.uid()) then
    raise exception 'IRLY Girl moderation view: the safety moderator only' using errcode = '42501';
  end if;
  perform private.journal('girl.view', null, null, p_what, p_id, null, '{}');
end $$;
revoke all on function private.staff_girl_need(text, uuid) from public, anon, authenticated;

/** A women-only community, for the view (raises when it is not one). */
create or replace function private.staff_girl_community_row(cid uuid) returns public.communities
language plpgsql stable security definer set search_path = public as $$
declare
  c public.communities;
begin
  select * into c from public.communities where id = cid and deleted_at is null;
  if not found then raise exception 'community not found' using errcode = 'P0002'; end if;
  if not c.girl_only then raise exception 'not an IRLY Girl community' using errcode = '22023'; end if;
  return c;
end $$;
revoke all on function private.staff_girl_community_row(uuid) from public, anon, authenticated;

/** Every IRLY Girl community (IRLY's own first), for the view. */
create or replace function public.staff_girl_communities() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.staff_girl_need('communities', null);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'tagline', c.tagline, 'city_id', c.city_id,
      'official', c.official, 'parent_id', c.parent_id, 'members', c.members_count,
      'retired', c.retired_at is not null, 'created_at', c.created_at)
      order by c.retired_at is not null, c.official desc, c.parent_id is not null, c.city_id, c.name, c.id)
    from public.communities c
    where c.girl_only and c.deleted_at is null), '[]'::jsonb);
end $$;
revoke all on function public.staff_girl_communities() from public, anon;
grant execute on function public.staff_girl_communities() to authenticated;

/** One IRLY Girl community: its facts, latest posts, members and activities. */
create or replace function public.staff_girl_community(p_community uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  c public.communities;
begin
  c := private.staff_girl_community_row(p_community);
  perform private.staff_girl_need('community', c.id);
  return jsonb_build_object(
    'community', jsonb_build_object('id', c.id, 'name', c.name, 'tagline', c.tagline, 'description', c.description,
      'city_id', c.city_id, 'official', c.official, 'parent_id', c.parent_id,
      'members', c.members_count, 'retired', c.retired_at is not null),
    'posts', coalesce((
      select jsonb_agg(x.j order by x.pinned desc, x.created_at desc) from (
        select p.created_at, pin.post_id is not null as pinned, jsonb_build_object(
          'id', p.id, 'first_name', case when p.as_irly then 'IRLY' else pr.first_name end,
          'body', p.body, 'kind', p.kind, 'created_at', p.created_at, 'as_irly', p.as_irly,
          'media', cardinality(p.media_paths), 'media_kind', p.media_kind,
          'pinned', pin.post_id is not null,
          'likes', (select count(*) from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
          'comments', (select count(*) from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null)) as j
        from public.community_posts p
        left join public.profiles pr on pr.id = p.author_id
        left join public.community_pins pin on pin.post_id = p.id and (pin.expires_at is null or pin.expires_at > now())
        where p.community_id = c.id and p.deleted_at is null
        order by pin.post_id is not null desc, p.created_at desc
        limit 50) x), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'first_name', pr.first_name, 'role', m.role, 'joined_at', m.joined_at)
        order by case m.role when 'owner' then 0 when 'co_admin' then 1 when 'moderator' then 2 else 3 end, pr.first_name, m.user_id)
      from public.community_members m join public.profiles pr on pr.id = m.user_id and pr.deleted_at is null
      where m.community_id = c.id), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'starts_at', a.starts_at,
          'cancelled', a.cancelled_at is not null,
          'going', (select count(*) from public.activity_participants ap where ap.activity_id = a.id))
        order by a.starts_at desc)
      from (select * from public.activities a where a.community_id = c.id and a.starts_at > now() - interval '30 days'
            order by a.starts_at desc limit 50) a), '[]'::jsonb));
end $$;
revoke all on function public.staff_girl_community(uuid) from public, anon;
grant execute on function public.staff_girl_community(uuid) to authenticated;

/** The chat of an official IRLY Girl community (IRLY hosts it): its latest 50 messages. */
create or replace function public.staff_girl_chat(p_community uuid) returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  c public.communities;
  conv uuid;
begin
  c := private.staff_girl_community_row(p_community);
  if not c.official then raise exception 'IRLY speaks only in its official communities' using errcode = '42501'; end if;
  perform private.staff_girl_need('chat', c.id);
  select v.id into conv from public.conversations v where v.community_id = c.id and v.kind = 'community';
  return coalesce((
    select jsonb_agg(x.j order by x.created_at) from (
      select m.created_at, jsonb_build_object('id', m.id, 'created_at', m.created_at, 'kind', m.kind,
        'first_name', case when m.sender_id is null then 'IRLY' else pr.first_name end,
        'as_irly', m.as_irly, 'body', case when m.kind = 'photo' then null else m.body end) as j
      from public.messages m left join public.profiles pr on pr.id = m.sender_id
      where m.conversation_id = conv and m.deleted_at is null and m.kind in ('text', 'photo', 'activity', 'location', 'share')
      order by m.created_at desc
      limit 50) x), '[]'::jsonb);
end $$;
revoke all on function public.staff_girl_chat(uuid) from public, anon;
grant execute on function public.staff_girl_chat(uuid) to authenticated;

/** IRLY Girl activities coming up (and the last week), for the view. */
create or replace function public.staff_girl_activities() returns jsonb
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.staff_girl_need('activities', null);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'title', a.title, 'starts_at', a.starts_at, 'city_id', a.city_id,
        'community', (select c.name from public.communities c where c.id = a.community_id),
        'cancelled', a.cancelled_at is not null,
        'going', (select count(*) from public.activity_participants ap where ap.activity_id = a.id))
      order by a.starts_at)
    from (select * from public.activities a where a.girl_only and a.starts_at > now() - interval '7 days'
          order by a.starts_at limit 200) a), '[]'::jsonb);
end $$;
revoke all on function public.staff_girl_activities() from public, anon;
grant execute on function public.staff_girl_activities() to authenticated;

-- ───────── 9. Selfie verification for IRLY Girl: until 100 members, then on by itself ─────────
-- IRLY Girl access = a woman's account (profiles.gender, set at signup and
-- locked: only support changes it) AND, when selfie verification is
-- required, a verified identity (as before). Nothing else changes: men are
-- refused everywhere in every mode, suspensions and sanctions still close
-- it, every policy keeps the one predicate private.girl_eligible_unchecked.
-- « Required » comes from private.girl_settings, key selfie_mode:
--   auto (default)  required once IRLY Girl has had `selfie_threshold`
--                   members (100 unless set): distinct women's accounts,
--                   not deleted, members of at least one women-only
--                   community that is not deleted. Counted when someone
--                   joins a women-only community; once reached it is
--                   latched (selfie_reached_at) and stays on, so members
--                   leaving later do not switch it off again;
--   on / off        set by an IRLY admin (admin_set_girl_selfie_mode,
--                   journaled), to force it either way.
-- When it switches on, an unverified woman's my_girl_status() becomes
-- needs_verification: the app shows its verification screen (selfie and
-- photos), not an error. While it is off, each unverified woman who joins
-- a women-only community is written to the staff journal
-- (girl.unverified_joined) for the safety moderator to review; reporting
-- stays as it is.
create table if not exists private.girl_settings (
  key text primary key check (key in ('selfie_mode', 'selfie_threshold', 'selfie_reached_at')),
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);
alter table private.girl_settings enable row level security;
revoke all on private.girl_settings from public, anon, authenticated;

/** Distinct women members of IRLY Girl (see above). */
create or replace function private.girl_member_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct m.user_id)::int
  from public.community_members m
  join public.communities c on c.id = m.community_id and c.girl_only and c.deleted_at is null
  join public.profiles p on p.id = m.user_id and p.gender = 'woman' and p.deleted_at is null
$$;
revoke all on function private.girl_member_count() from public, anon, authenticated;

/** Is a selfie-verified identity required for IRLY Girl right now? */
create or replace function private.girl_selfie_required() returns boolean
language sql stable security definer set search_path = public, private as $$
  select case coalesce((select value from private.girl_settings where key = 'selfie_mode'), 'auto')
    when 'on' then true
    when 'off' then false
    else exists (select 1 from private.girl_settings where key = 'selfie_reached_at')
  end
$$;
revoke all on function private.girl_selfie_required() from public, anon, authenticated;

/** Latches « reached » once IRLY Girl has its threshold of members. */
create or replace function private.girl_selfie_latch() returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from private.girl_settings where key = 'selfie_reached_at') then return; end if;
  if private.girl_member_count() >= coalesce((select value::int from private.girl_settings where key = 'selfie_threshold'), 100) then
    insert into private.girl_settings (key, value) values ('selfie_reached_at', now()::text) on conflict (key) do nothing;
    insert into private.admin_audit (actor, action, details)
    values (null, 'girl.selfie_required', jsonb_build_object('members', private.girl_member_count()));
  end if;
end $$;
revoke all on function private.girl_selfie_latch() from public, anon, authenticated;

/** On each join of a women-only community: the latch, and the journal line for an unverified woman. */
create or replace function private.girl_member_joined() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from public.communities c where c.id = new.community_id and c.girl_only) then return new; end if;
  perform private.girl_selfie_latch();
  if not private.identity_verified(new.user_id) then
    insert into private.admin_audit (actor, action, target_user, details)
    values (new.user_id, 'girl.unverified_joined', new.user_id,
            jsonb_build_object('kind', 'community', 'id', new.community_id, 'selfie_required', private.girl_selfie_required()));
  end if;
  return new;
end $$;
revoke all on function private.girl_member_joined() from public, anon, authenticated;
drop trigger if exists community_members_girl_joined on public.community_members;
create trigger community_members_girl_joined after insert on public.community_members
for each row execute function private.girl_member_joined();

-- Last defined in 20261103100000_irly_qa_fix_moderation. Same rule, with
-- the verified identity required only while private.girl_selfie_required().
create or replace function private.girl_eligible_unchecked(uid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.gender = 'woman' and p.deleted_at is null
      and not exists (select 1 from public.girl_suspensions s where s.user_id = uid)
      and (private.identity_verified(uid) or not private.girl_selfie_required())
  ) and not private.is_sanctioned(uid)
$$;

/** For the app: whether IRLY Girl asks for selfie verification now (the promise text and the verification step follow it). */
create or replace function public.girl_selfie_required() returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.girl_selfie_required()
$$;
revoke all on function public.girl_selfie_required() from public, anon;
grant execute on function public.girl_selfie_required() to authenticated;

/** IRLY admins: the mode (auto, on, off), the members counted and whether it is required now. */
create or replace function public.admin_girl_selfie() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  return jsonb_build_object(
    'mode', coalesce((select value from private.girl_settings where key = 'selfie_mode'), 'auto'),
    'threshold', coalesce((select value::int from private.girl_settings where key = 'selfie_threshold'), 100),
    'members', private.girl_member_count(),
    'reached_at', (select value from private.girl_settings where key = 'selfie_reached_at'),
    'required', private.girl_selfie_required());
end $$;
revoke all on function public.admin_girl_selfie() from public, anon;
grant execute on function public.admin_girl_selfie() to authenticated;

/** IRLY admins: forces selfie verification on or off, or back to auto; journaled. */
create or replace function public.admin_set_girl_selfie_mode(p_mode text) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  perform private.need_admin();
  if p_mode is null or p_mode not in ('auto', 'on', 'off') then raise exception 'choose auto, on or off' using errcode = '22023'; end if;
  insert into private.girl_settings (key, value, updated_at, updated_by) values ('selfie_mode', p_mode, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  perform private.journal('girl.selfie_mode', null, null, null, null, null, jsonb_build_object('mode', p_mode));
  if p_mode = 'auto' then perform private.girl_selfie_latch(); end if;
end $$;
revoke all on function public.admin_set_girl_selfie_mode(text) from public, anon;
grant execute on function public.admin_set_girl_selfie_mode(text) to authenticated;

-- IRLY Girl may already have its members: the latch is checked once now.
select private.girl_selfie_latch();
