-- Pre-launch audit: moderation, blocking, data rights.
-- 1. Report categories as members see them: harassment, hate speech, spam,
--    scam, fake profile, inappropriate content, threats, other.
-- 2. Blocking someone also ends your connection or pending request with them
--    (Networking, friends), removes their requests from your notifications
--    and hides your private chat with them from both inboxes.
-- 3. The inbox ignores people you blocked: no chat with them, their messages
--    neither count as unread nor show as the last message.
-- 4. Blocked members: the list of people you blocked, to unblock them.
-- 5. Your data: one call returns everything IRLY stores about you (export).
-- 6. Deleting a message you sent (it disappears for everyone).

-- ───────── 1 ─────────
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (category in (
  'harassment', 'hate_speech', 'spam', 'scam', 'fake_profile', 'inappropriate', 'threats', 'other',
  -- earlier values, kept for existing reports
  'unsafe', 'impersonation'));

-- ───────── 2 ─────────
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mid uuid;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if p_target is null or p_target = me or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (me, p_target) on conflict do nothing;
  select id into mid from public.irly_matches where user_a = least(me, p_target) and user_b = greatest(me, p_target) and removed_at is null;
  if mid is not null then
    update public.irly_matches set removed_at = now(), removed_by = me where id = mid;
    delete from public.conversation_members cm using public.conversations c where c.id = cm.conversation_id and c.match_id = mid;
  end if;
  delete from public.irly_match_actions where (actor_id = me and target_id = p_target) or (actor_id = p_target and target_id = me);
  -- Connections and requests end both ways.
  delete from public.friendships where user_a = least(me, p_target) and user_b = greatest(me, p_target);
  delete from public.notifications
  where (user_id = me and payload ->> 'from' = p_target::text) or (user_id = p_target and payload ->> 'from' = me::text);
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ───────── 3 ─────────
create or replace function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text,
  last_sender uuid, last_at timestamptz, unread integer, ref_id uuid)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.kind,
    coalesce(c.title, other.first_name, 'IRLY'),
    other.id,
    other.first_name,
    lm.body,
    lm.sender_id,
    coalesce(lm.created_at, c.created_at),
    (select count(*)::int from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and (x.sender_id is null or not private.blocked_unchecked(auth.uid(), x.sender_id))
         and x.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz)),
    coalesce(c.activity_id, c.community_id, c.match_id)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join lateral (
    select p.id, p.first_name from public.conversation_members o
    join public.profiles p on p.id = o.user_id
    where o.conversation_id = c.id and o.user_id <> auth.uid() and c.kind in ('direct', 'match')
    limit 1
  ) other on true
  left join lateral (
    select m.body, m.sender_id, m.created_at from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
      and (m.sender_id is null or not private.blocked_unchecked(auth.uid(), m.sender_id))
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- ───────── 4 ─────────
create or replace function public.my_blocks()
returns table (user_id uuid, first_name text, blocked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, coalesce(p.first_name, 'Member'), b.created_at
  from public.blocks b left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
$$;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- ───────── 5 ─────────
-- Everything about you, in one JSON document (GDPR access and portability).
-- Other people's personal data is left out: chats contain your own messages only.
create or replace function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object('id', u.id, 'email', to_jsonb(u) ->> 'email', 'phone', to_jsonb(u) ->> 'phone',
      'created_at', to_jsonb(u) ->> 'created_at', 'last_sign_in_at', to_jsonb(u) ->> 'last_sign_in_at') from auth.users u where u.id = me),
    'profile', (select to_jsonb(p) - 'is_admin' from public.profiles p where p.id = me),
    'professional_profile', (select to_jsonb(x) from public.pro_profiles x where x.user_id = me),
    'irly_girl_profile', (select to_jsonb(x) from public.irly_match_profiles x where x.user_id = me),
    'privacy_settings', (select to_jsonb(x) from public.safety_settings x where x.user_id = me),
    'notification_settings', (select to_jsonb(x) from public.notification_prefs x where x.user_id = me),
    'phones_registered_for_notifications', (select count(*) from public.push_tokens where user_id = me),
    'activities_created', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.activities a where a.creator_id = me), '[]'),
    'activities_joined', coalesce((select jsonb_agg(jsonb_build_object('activity_id', x.activity_id, 'status', x.status)) from public.activity_participants x where x.user_id = me), '[]'),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('community_id', x.community_id, 'role', x.role, 'joined_at', x.joined_at)) from public.community_members x where x.user_id = me), '[]'),
    'community_posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'community_id', x.community_id, 'body', x.body, 'created_at', x.created_at)) from public.community_posts x where x.author_id = me), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'target_type', x.target_type, 'target_id', x.target_id, 'body', x.body, 'created_at', x.created_at)) from public.comments x where x.author_id = me), '[]'),
    'irl_posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'body', x.body, 'area_id', x.area_id, 'created_at', x.created_at)) from public.irl_posts x where x.author_id = me), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', x.conversation_id, 'body', x.body, 'created_at', x.created_at) order by x.created_at) from public.messages x where x.sender_id = me and x.deleted_at is null), '[]'),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('with', case when f.user_a = me then f.user_b else f.user_a end, 'status', f.status, 'since', coalesce(f.accepted_at, f.created_at))) from public.friendships f where me in (f.user_a, f.user_b)), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'at', b.created_at)) from public.blocks b where b.blocker_id = me), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('kind', r.target_kind, 'category', r.category, 'at', r.created_at)) from public.reports r where r.reporter_id = me), '[]'),
    'likes', coalesce((select jsonb_agg(jsonb_build_object('target_type', x.target_type, 'target_id', x.target_id)) from public.likes x where x.user_id = me), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('target_type', x.target_type, 'target_id', x.target_id)) from public.saves x where x.user_id = me), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'created_at', n.created_at)) from public.notifications n where n.user_id = me), '[]'),
    'usage_events', (select count(*) from public.analytics_events where user_id = me)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ───────── 6 ─────────
-- Your own message: removed for everyone.
create or replace function public.delete_my_message(p_message uuid) returns void
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.messages where id = p_message and sender_id = auth.uid()) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  -- The erase trigger keeps the text aside for moderators and empties it.
  update public.messages set deleted_at = now() where id = p_message and sender_id = auth.uid() and deleted_at is null;
end $$;
revoke all on function public.delete_my_message(uuid) from public, anon;
grant execute on function public.delete_my_message(uuid) to authenticated;

-- Analytics: usage events are kept 13 months, then removed.
create or replace function private.analytics_retention() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if random() < 0.01 then
    delete from public.analytics_events where created_at < now() - interval '13 months';
  end if;
  return null;
end $$;
drop trigger if exists analytics_retention on public.analytics_events;
create trigger analytics_retention after insert on public.analytics_events
for each statement execute function private.analytics_retention();
