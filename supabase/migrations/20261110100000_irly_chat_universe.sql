-- Messages and notifications by universe (Mixte, Girl, Mom, Network).
--
-- Nothing is moved, copied or deleted: every chat and notification stays one
-- row. Only what a screen lists depends on the universe, with the rule of
-- 20261110000000_irly_universe (private.community_universe and
-- private.conversation_universe, the server twins of the app's
-- src/features/universe/universe.ts).
--
-- 1. The inbox (my_conversations) tells each chat's universe and whether it
--    is women-only (a Network chat is on the Girl side or the Mixte side by
--    it), plus what the app needs for the chat's picture when it has no
--    photo of its own (the community's topic and category, the activity's
--    category, sub-category and place). A private chat has no universe
--    (null): it is one chat, shown in every universe its members use.
--    Same rows, same order, same read rules and unread counts as
--    20261109050000_irly_no_group_chats.
-- 2. Each notification's universe, read with the notification itself
--    (computed columns notification_universe and notification_women_only:
--    select 'id, kind, …, notification_universe'): the list and the bell
--    show a notification in its universe, or in every universe when it has
--    none (a follower, a friend, a private message).
-- 3. Mutual follow: when you follow back someone who follows you, their
--    NEW_FOLLOWER notification says so (payload.mutual) and its push reads
--    « … followed you back ». Still one notification a day at most.
-- 4. A notification about a removed community (deleted_at set) is no longer
--    listed nor opened (kept on the server, hidden by a restrictive read
--    rule), as removed posts, comments and chats already take theirs.
-- Idempotent.

-- ───────── 0. An activity's universe ─────────
-- Its community's; without one, its own women-only flag (as
-- private.conversation_universe).
create or replace function private.activity_universe(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when a.community_id is not null then private.community_universe(a.community_id)
              when a.girl_only then 'girl' else 'mixte' end
  from public.activities a where a.id = p_id
$$;
revoke all on function private.activity_universe(uuid) from public, anon, authenticated;

-- ───────── 1. The inbox, with each chat's universe ─────────
-- The return type changes (new columns): dropped and created again, with its grants.
drop function if exists public.my_conversations();
create function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text, last_sender uuid,
  last_at timestamptz, unread integer, ref_id uuid, other_photo text, photo_path text, photo_bucket text, members integer,
  last_kind text, last_sender_name text, archived boolean,
  universe text, women_only boolean, ref_topic text, ref_category text, ref_sub text, ref_place text)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(com.name, act.title, c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from (
       select 1 from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and x.created_at > greatest(coalesce(me.last_read_at, 'epoch'::timestamptz), coalesce(me.cleared_at, 'epoch'::timestamptz))
         and (x.sender_id is null or x.sender_id <> all (array(
           select b.blocked_id from public.blocks b where b.blocker_id = auth.uid()
           union all select b.blocker_id from public.blocks b where b.blocked_id = auth.uid())))
         and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = x.id)
       limit 100
     ) u),
    coalesce(c.activity_id, c.community_id, c.match_id),
    other.photo,
    coalesce(com.cover_path, c.photo_path, act.cover_path),
    case when coalesce(com.cover_path, c.photo_path, act.cover_path) is null then null else 'activity-photos' end,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.kind,
    lm.first_name,
    me.archived_at is not null,
    -- The universe (null: a private chat, shared by every universe) and the women-only side.
    case when c.community_id is not null or c.activity_id is not null then private.conversation_universe(c.id) end,
    coalesce(com.girl_only, actcom.girl_only, act.girl_only, false),
    coalesce(com.topic, actcom.topic),
    coalesce(com.category_id, act.category_id),
    act.sub_id,
    act.place_name
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities com on com.id = c.community_id
  left join public.activities act on act.id = c.activity_id
  left join public.communities actcom on actcom.id = act.community_id
  left join lateral (
    select p.id, p.first_name, p.photo_paths[1] as photo from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at, m.kind, sp.first_name from public.messages m
    left join public.profiles sp on sp.id = m.sender_id
    where m.conversation_id = c.id and m.deleted_at is null
      and (m.sender_id is null or not private.blocked_unchecked(auth.uid(), m.sender_id))
      and m.created_at > coalesce(me.cleared_at, '-infinity'::timestamptz)
      and not exists (select 1 from public.message_hides h where h.user_id = auth.uid() and h.message_id = m.id)
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
    and (me.cleared_at is null or lm.created_at is not null)
    -- IRLY Girl chats (Match, girls-only community or activity) only with IRLY Girl access.
    and ((select private.is_girl_eligible())
         or not (c.kind = 'match' or coalesce(com.girl_only, false) or coalesce(act.girl_only, false) or coalesce(actcom.girl_only, false)))
    -- A removed group's chat (groups were removed on 2026-11-06).
    and not (com.parent_id is not null and com.deleted_at is not null)
    -- Group chats were removed on 2026-11-06 (kept, never listed).
    and not exists (select 1 from private.removed_group_chats g where g.conversation_id = c.id)
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- ───────── 2. A notification's universe ─────────
-- What it is about, from its payload: a chat, a community, an activity, a
-- post or Live, a comment's thread. IRLY Match and IRLY Girl news are Girl.
-- Nothing to tell (a follower, a friend, a private chat): null, every universe.
create or replace function private.notification_universe_of(p_kind text, p_payload jsonb, out universe text, out women_only boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  conv uuid;
  cid uuid;
  aid uuid;
  t_type text;
  t_id uuid;
begin
  women_only := false;
  if p_kind in ('MATCH_CREATED', 'MATCH_REMOVED', 'MATCH_SUGGESTION') then
    universe := 'girl'; women_only := true; return;
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then return; end if;
  if p_payload ? 'match_id' then universe := 'girl'; women_only := true; return; end if;
  if p_kind = 'IRLY_NEWS' then
    if p_payload ->> 'girl' = 'true' then universe := 'girl'; women_only := true; end if;
    return;
  end if;
  cid := private.uuid_or_null(p_payload ->> 'community_id');
  aid := private.uuid_or_null(p_payload ->> 'activity_id');
  conv := private.uuid_or_null(p_payload ->> 'conversation_id');
  -- A comment, like or mention names its thread.
  t_type := p_payload ->> 'target_type';
  t_id := private.uuid_or_null(p_payload ->> 'target_id');
  if t_type = 'comment' and t_id is not null then
    select k.target_type, private.uuid_or_null(k.target_id) into t_type, t_id from public.comments k where k.id = t_id;
  end if;
  if cid is null and aid is null and t_id is not null then
    if t_type = 'community' then cid := t_id;
    elsif t_type = 'activity' then aid := t_id;
    elsif t_type = 'community_post' then select p.community_id into cid from public.community_posts p where p.id = t_id;
    elsif t_type = 'irl_post' then
      select p.community_id, case when p.community_id is null and p.app_scope = 'irly_girl' then 'girl' end
        into cid, universe from public.irl_posts p where p.id = t_id;
      if universe is not null then women_only := true; return; end if;
    end if;
  end if;
  if cid is null and aid is null and p_kind = 'IRLY_POST_CREATED' then
    select p.community_id, case when p.community_id is null and p.app_scope = 'irly_girl' then 'girl' end
      into cid, universe from public.irl_posts p where p.id = private.uuid_or_null(p_payload ->> 'post_id');
    if universe is not null then women_only := true; return; end if;
  end if;
  if cid is not null then
    select private.community_universe(c.id), c.girl_only into universe, women_only from public.communities c where c.id = cid;
  elsif aid is not null then
    select private.activity_universe(a.id), coalesce(c.girl_only, a.girl_only) into universe, women_only
    from public.activities a left join public.communities c on c.id = a.community_id where a.id = aid;
  elsif conv is not null then
    select private.conversation_universe(v.id),
           coalesce(c.girl_only, ac.girl_only, a.girl_only, v.kind = 'match')
      into universe, women_only
    from public.conversations v
    left join public.communities c on c.id = v.community_id
    left join public.activities a on a.id = v.activity_id
    left join public.communities ac on ac.id = a.community_id
    where v.id = conv;
    if universe is null and women_only then universe := 'girl'; end if;
  end if;
  women_only := coalesce(women_only, false);
end $$;
revoke all on function private.notification_universe_of(text, jsonb) from public, anon, authenticated;

-- Computed columns of a notification (PostgREST: select 'notification_universe'
-- next to the table's own columns). Only ever about the reader's own rows:
-- the notifications read rules come first.
create or replace function public.notification_universe(n public.notifications) returns text
language sql stable security definer set search_path = public as $$
  select (private.notification_universe_of(n.kind, n.payload)).universe
$$;
revoke all on function public.notification_universe(public.notifications) from public, anon;
grant execute on function public.notification_universe(public.notifications) to authenticated;

create or replace function public.notification_women_only(n public.notifications) returns boolean
language sql stable security definer set search_path = public as $$
  select (private.notification_universe_of(n.kind, n.payload)).women_only
$$;
revoke all on function public.notification_women_only(public.notifications) from public, anon;
grant execute on function public.notification_women_only(public.notifications) to authenticated;

-- ───────── 3. Mutual follow ─────────
-- follow_user as in 20261009005000_irly_audit_integrity, plus `mutual` in the
-- notification when the person followed already follows me.
create or replace function public.follow_user(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if p_user = me then raise exception 'you cannot follow yourself' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null)
     or private.blocked_unchecked(me, p_user) then
    raise exception 'this member is not available' using errcode = 'P0002';
  end if;
  if not private.visible_to(me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user)) then
    raise exception 'this profile is private' using errcode = '42501';
  end if;
  insert into public.follows (follower_id, followee_id) values (me, p_user) on conflict do nothing;
  get diagnostics n = row_count;
  -- Follow, unfollow, follow again: one notification a day at most.
  if n > 0 and not exists (select 1 from public.notifications where user_id = p_user and kind = 'NEW_FOLLOWER'
                           and payload ->> 'from' = me::text and created_at > now() - interval '1 day') then
    insert into public.notifications (user_id, kind, payload) values (p_user, 'NEW_FOLLOWER',
      jsonb_build_object('from', me) || case when exists (select 1 from public.follows f where f.follower_id = p_user and f.followee_id = me)
                                             then jsonb_build_object('mutual', true) else '{}'::jsonb end);
  end if;
  return true;
end $$;
revoke all on function public.follow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid) to authenticated;

-- Its push reads « Lina followed you back » (push_text, unchanged, says « started
-- following you »), the way news and IRLY's own posts adjust theirs.
create or replace function private.followed_back_push() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  n public.notifications;
  who text;
  fr boolean;
begin
  select * into n from public.notifications where id = new.notification_id;
  if n.kind = 'NEW_FOLLOWER' and coalesce(n.payload ->> 'mutual', '') = 'true' then
    fr := coalesce((select t.lang from public.push_tokens t where t.token = new.token), 'en') = 'fr';
    select first_name into who from public.profiles where id = private.uuid_or_null(n.payload ->> 'from');
    new.body := coalesce(who, case when fr then 'Quelqu’un' else 'Someone' end)
      || case when fr then ' s’est abonné·e à toi en retour' else ' followed you back' end;
  end if;
  return new;
end $$;
revoke all on function private.followed_back_push() from public, anon, authenticated;
drop trigger if exists push_outbox_followed_back on public.push_outbox;
create trigger push_outbox_followed_back before insert on public.push_outbox
for each row execute function private.followed_back_push();

-- ───────── 4. A removed community's notifications ─────────
-- Kept, no longer read (list, bell, a tapped push): the community is gone.
create or replace function private.notification_community_gone(p_payload jsonb) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.communities c
                 where c.id = private.uuid_or_null(p_payload ->> 'community_id') and c.deleted_at is not null)
$$;
revoke all on function private.notification_community_gone(jsonb) from public, anon;
grant execute on function private.notification_community_gone(jsonb) to authenticated;

drop policy if exists notifications_community_gone on public.notifications;
create policy notifications_community_gone on public.notifications as restrictive for select to authenticated
  using (not (payload ? 'community_id') or not private.notification_community_gone(payload));
