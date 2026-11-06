-- The IRLY team publishes in its official communities, signed « IRLY ».
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
