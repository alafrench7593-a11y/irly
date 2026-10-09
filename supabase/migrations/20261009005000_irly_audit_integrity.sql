-- Audit fixes (database integrity, privacy and notifications).
-- 1. The last admin of a group could not leave it (role change blocked by the freeze trigger).
-- 2. Account deletion: groups keep an admin, empty groups and lone communities go,
--    the new community owner runs its chat, people going to the plans hear it,
--    and the deleted messages' notifications and push texts go too.
-- 3. Notifications, likes, saves, comments, shares and hidden items no longer outlive what they point at.
-- 4. A new community cannot point its cover at someone else's private photo.
-- 5. Follow / unfollow loops send one "new follower" a day; a repeated group member is notified once.
-- 6. Lock-screen texts for NEW_FOLLOWER, GROUP_ADDED and COMMUNITY_POST.

-- ───────── 1. trusted role changes, inside the app's own functions only ─────────
create or replace function private.freeze() returns trigger
language plpgsql security invoker set search_path = public as $$
declare k text;
begin
  if auth.uid() is null or pg_trigger_depth() > 1 or private.is_admin(auth.uid())
     or current_setting('irly.trusted', true) = 'on' then return new; end if;
  foreach k in array tg_argv loop
    if (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
      raise exception '% cannot be changed', k using errcode = '42501';
    end if;
  end loop;
  return new;
end $$;

create or replace function private.leave_group_as(p_user uuid, p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.conversation_members where conversation_id = p_conversation and user_id = p_user;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation) then
    delete from public.conversations where id = p_conversation;
  elsif not exists (select 1 from public.conversation_members where conversation_id = p_conversation and role = 'admin') then
    perform set_config('irly.trusted', 'on', true);
    update public.conversation_members set role = 'admin'
    where conversation_id = p_conversation
      and user_id = (select user_id from public.conversation_members where conversation_id = p_conversation order by joined_at, user_id limit 1);
    perform set_config('irly.trusted', 'off', true);
  end if;
end $$;
revoke all on function private.leave_group_as(uuid, uuid) from public, anon, authenticated;

create or replace function public.leave_group(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.conversations where id = p_conversation and kind = 'group') then
    raise exception 'not a group' using errcode = '22023';
  end if;
  perform private.leave_group_as(auth.uid(), p_conversation);
end $$;

-- ───────── 2. account deletion ─────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  goer record;
  g record;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  insert into private.removed_content (source, id, body)
    select 'messages', m.id, m.body from public.messages m
    where m.sender_id = me and exists (select 1 from public.reports r where r.target_kind = 'message' and r.target_id = m.id)
    on conflict do nothing;
  -- Reported posts and comments too: moderators keep what was reported.
  insert into private.removed_content (source, id, body)
    select 'comments', c.id, c.body from public.comments c
    where c.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'comment' and r.target_id = c.id)
    on conflict do nothing;
  insert into private.removed_content (source, id, body)
    select 'irl_posts', p.id, p.body || coalesce(' [media: ' || p.media_path || ']', '') from public.irl_posts p
    where p.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'irl_post' and r.target_id = p.id)
    on conflict do nothing;
  insert into private.removed_content (source, id, body)
    select 'community_posts', p.id, p.body from public.community_posts p
    where p.author_id = me and exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = p.id)
    on conflict do nothing;
  -- Their messages' notifications (and the push copies of their text) go with them.
  delete from public.notifications n using public.messages m
  where m.sender_id = me and n.kind = 'MESSAGE_CREATED' and n.payload ->> 'message_id' = m.id::text;
  -- People going to their upcoming plans hear it, as with delete_activity.
  for goer in select ap.user_id, a.id, a.title from public.activities a join public.activity_participants ap on ap.activity_id = a.id
           where a.creator_id = me and a.starts_at > now() and ap.status = 'going' and ap.user_id <> me loop
    perform private.notify(goer.user_id, 'ACTIVITY_UPDATED', jsonb_build_object('activity_id', goer.id, 'title', goer.title, 'change', 'deleted'));
  end loop;
  -- Groups: leaving them the way leave_group does (an admin is handed on, an empty group goes).
  for g in select m.conversation_id from public.conversation_members m join public.conversations c on c.id = m.conversation_id
           where m.user_id = me and c.kind = 'group' loop
    perform private.leave_group_as(me, g.conversation_id);
  end loop;
  delete from public.messages where sender_id = me;
  delete from public.conversations c where c.kind = 'direct'
    and exists (select 1 from public.conversation_members m where m.conversation_id = c.id and m.user_id = me);
  delete from public.notifications where payload ->> 'from' = me::text or payload ->> 'user_id' = me::text or payload ->> 'with' = me::text;
  update public.community_members cm set role = 'owner'
  from (
    select distinct on (m.community_id) m.community_id, m.user_id
    from public.community_members m
    join public.community_members mine on mine.community_id = m.community_id and mine.user_id = me and mine.role = 'owner'
    where m.user_id <> me
      and not exists (select 1 from public.community_members o where o.community_id = m.community_id and o.role = 'owner' and o.user_id <> me)
    order by m.community_id, (m.role = 'moderator') desc, m.joined_at
  ) heir
  where cm.community_id = heir.community_id and cm.user_id = heir.user_id;
  -- The new owner runs the community chat too.
  perform set_config('irly.trusted', 'on', true);
  update public.conversation_members cvm set role = 'admin'
  from public.conversations c, public.community_members cm
  where c.id = cvm.conversation_id and c.community_id = cm.community_id
    and cm.user_id = cvm.user_id and cm.role = 'owner' and cm.user_id <> me and cvm.role <> 'admin'
    and exists (select 1 from public.community_members mine where mine.community_id = cm.community_id and mine.user_id = me);
  perform set_config('irly.trusted', 'off', true);
  -- A community nobody else is in leaves every list (kept for moderation, as delete_community does).
  update public.communities c set deleted_at = now()
  where c.deleted_at is null and not c.official
    and (c.created_by = me or exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = me and m.role = 'owner'))
    and not exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id <> me);
  delete from auth.users where id = me;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── 3. nothing outlives its target ─────────
-- A push waiting in the outbox goes with its notification (its text included).
create or replace function private.drop_push_copy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_outbox where notification_id = old.id;
  return null;
end $$;
drop trigger if exists notifications_drop_push on public.notifications;
create trigger notifications_drop_push after delete on public.notifications
  for each row execute function private.drop_push_copy();

create or replace function private.purge_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  k text := case tg_table_name when 'comments' then 'comment_id' when 'activities' then 'activity_id' else 'post_id' end;
begin
  if tg_op = 'DELETE' or (case when tg_table_name = 'irl_posts' then (to_jsonb(new) ->> 'expires_at')::timestamptz <= now()
                               else to_jsonb(new) ->> 'deleted_at' is not null end) then
    -- Likes and comments name what they are on as target_id.
    delete from public.notifications
    -- (an activity's own "deleted" notice stays: it tells people going that it is off)
    where (tg_table_name <> 'activities' and payload ->> k = old.id::text)
       or (kind in ('LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION') and payload ->> 'target_id' = old.id::text);
  end if;
  return null;
end $$;
drop trigger if exists activities_purge_notifications on public.activities;
create trigger activities_purge_notifications after delete on public.activities
  for each row execute function private.purge_notifications();

-- Likes, saves, comments, shares and hidden items of a removed thing.
create or replace function private.purge_reactions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t text := case tg_table_name when 'activities' then 'activity' when 'community_posts' then 'community_post'
                               when 'irl_posts' then 'irl_post' when 'comments' then 'comment' else 'community' end;
  i text := old.id::text;
begin
  if tg_op = 'UPDATE' and (to_jsonb(new) ->> 'deleted_at') is null then return null; end if;
  delete from public.likes where target_type = t and target_id = i;
  delete from public.saves where target_type = t and target_id = i;
  delete from public.shares where target_type = t and target_id = i;
  delete from public.hidden_items where target_type = t and target_id = i;
  if t <> 'comment' then
    delete from public.comments where target_type = t and target_id = i;
  end if;
  return null;
end $$;
drop trigger if exists activities_purge_reactions on public.activities;
create trigger activities_purge_reactions after delete on public.activities
  for each row execute function private.purge_reactions();
drop trigger if exists irl_posts_purge_reactions on public.irl_posts;
create trigger irl_posts_purge_reactions after delete on public.irl_posts
  for each row execute function private.purge_reactions();
drop trigger if exists comments_purge_reactions on public.comments;
create trigger comments_purge_reactions after delete or update of deleted_at on public.comments
  for each row execute function private.purge_reactions();
drop trigger if exists community_posts_purge_reactions on public.community_posts;
create trigger community_posts_purge_reactions after delete or update of deleted_at on public.community_posts
  for each row execute function private.purge_reactions();
drop trigger if exists communities_purge_reactions on public.communities;
create trigger communities_purge_reactions after delete or update of deleted_at on public.communities
  for each row execute function private.purge_reactions();

-- Leftovers from before this migration.
delete from public.push_outbox o where o.notification_id is not null and not exists (select 1 from public.notifications n where n.id = o.notification_id);
do $$
declare r record;
begin
  for r in select * from (values ('activity', 'activities'), ('community_post', 'community_posts'), ('irl_post', 'irl_posts'),
                                 ('comment', 'comments'), ('community', 'communities')) v(t, tbl) loop
    execute format($f$delete from public.likes x where x.target_type = %L and not exists (select 1 from public.%I y where y.id::text = x.target_id %s)$f$,
      r.t, r.tbl, case when r.tbl in ('community_posts', 'comments', 'communities') then 'and y.deleted_at is null' else '' end);
    execute format($f$delete from public.saves x where x.target_type = %L and not exists (select 1 from public.%I y where y.id::text = x.target_id %s)$f$,
      r.t, r.tbl, case when r.tbl in ('community_posts', 'comments', 'communities') then 'and y.deleted_at is null' else '' end);
  end loop;
end $$;

-- ───────── 4. covers on insert too ─────────
create or replace function private.community_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null or private.is_admin(auth.uid()) then return new; end if;
  if new.cover_path is not null
     and (tg_op = 'INSERT' or new.cover_path is distinct from old.cover_path)
     and not private.own_upload(new.cover_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists communities_cover_guard on public.communities;
create trigger communities_cover_guard before insert or update of cover_path on public.communities
  for each row execute function private.community_cover_guard();

-- ───────── 5. no notification floods ─────────
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
    insert into public.notifications (user_id, kind, payload) values (p_user, 'NEW_FOLLOWER', jsonb_build_object('from', me));
  end if;
  return true;
end $$;

create or replace function public.create_group(p_title text, p_members uuid[], p_photo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
  m uuid;
  people uuid[];
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'give the group a name (60 characters at most)' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into people from unnest(p_members) x where x is not null and x <> me;
  if cardinality(people) = 0 or cardinality(people) > 49 then
    raise exception 'add between 1 and 49 people' using errcode = '22023';
  end if;
  if p_photo is not null and not private.own_upload(p_photo) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  foreach m in array people loop
    if not exists (select 1 from public.profiles where id = m and deleted_at is null) or not private.may_message(m) then
      raise exception 'one of these people does not accept messages from you' using errcode = '42501';
    end if;
  end loop;
  insert into public.conversations (kind, title, photo_path) values ('group', btrim(p_title), p_photo) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'admin');
  insert into public.conversation_members (conversation_id, user_id)
    select conv, x from unnest(people) x on conflict do nothing;
  insert into public.notifications (user_id, kind, payload)
    select x, 'GROUP_ADDED', jsonb_build_object('from', me, 'conversation_id', conv, 'title', btrim(p_title))
    from unnest(people) x;
  return conv;
end $$;

-- ───────── 6. lock-screen texts ─────────
create or replace function private.push_text(n public.notifications, lang text, out title text, out body text, out url text)
language plpgsql stable security definer set search_path = public as $$
declare
  fr boolean := lang = 'fr';
  who text;
  someone text := case when lang = 'fr' then 'Quelqu’un' else 'Someone' end;
  msg record;
begin
  select first_name into who from public.profiles where id = private.uuid_or_null(coalesce(n.payload ->> 'from', n.payload ->> 'user_id'));
  url := '/notifications';
  case n.kind
    when 'MESSAGE_CREATED' then
      select m.body, m.kind, p.first_name, c.title as conv into msg
      from public.messages m left join public.profiles p on p.id = m.sender_id left join public.conversations c on c.id = m.conversation_id
      where m.id = private.uuid_or_null(n.payload ->> 'message_id');
      title := coalesce(nullif(msg.conv, ''), msg.first_name, 'IRLY');
      body := case
        when msg.kind = 'photo' then coalesce(msg.first_name || ': ', '') || case when fr then '📷 Photo' else '📷 Photo' end
        when msg.body is not null then coalesce(case when msg.conv is not null then msg.first_name || ': ' end, '') || left(msg.body, 120)
        else case when fr then 'Nouveau message' else 'New message' end end;
      url := '/messages/' || coalesce(n.payload ->> 'conversation_id', '');
    when 'PRO_CONNECT_REQUEST' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' veut entrer en contact avec toi' else ' wants to connect with you' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'PRO_CONNECT_ACCEPTED' then
      title := 'Networking';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande. Écris-lui !' else ' accepted your request. Say hi!' end;
      url := '/network/' || (n.payload ->> 'from');
    when 'FRIEND_REQUEST' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end;
    when 'FRIEND_ACCEPTED' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end;
    when 'PROFILE_UPDATED' then
      title := 'IRLY';
      body := case n.payload ->> 'type'
        when 'friend_request' then coalesce(who, someone) || case when fr then ' veut être ton ami·e' else ' wants to be friends' end
        when 'friend_accepted' then coalesce(who, someone) || case when fr then ' a accepté ta demande' else ' accepted your request' end
        else case when fr then 'Ton profil a été mis à jour' else 'Your profile was updated' end end;
    when 'MATCH_CREATED' then
      title := 'IRLY Girl';
      body := case when fr then 'C’est un match ! Dis bonjour 👋' else 'It’s a match! Say hello 👋' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/girl' end;
    when 'ACTIVITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Quelqu’un a rejoint ton activité' else 'Someone joined your activity' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/notifications' end;
    when 'ACTIVITY_UPDATED' then
      title := 'IRLY';
      body := case when fr then 'Une activité de ton agenda a changé' else 'An activity in your calendar changed' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'ACTIVITY_REMINDER' then
      title := 'IRLY';
      body := case when fr then 'Ton activité commence bientôt' else 'Your activity starts soon' end;
      url := case when n.payload ? 'activity_id' then '/a/' || (n.payload ->> 'activity_id') else '/calendar' end;
    when 'LIKE' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' a aimé ta publication' else ' liked your post' end;
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      title := 'IRLY';
      body := coalesce(who, someone) || case n.kind
        when 'COMMENT' then case when fr then ' a commenté' else ' commented' end
        when 'COMMENT_REPLY' then case when fr then ' t’a répondu' else ' replied to you' end
        else case when fr then ' t’a mentionné·e' else ' mentioned you' end end
        || coalesce(': ' || left(n.payload ->> 'body', 100), '');
    when 'IRLY_POST_CREATED' then
      title := 'IRL';
      body := coalesce(who, case when fr then 'Un·e ami·e' else 'A friend' end) || case when fr then ' est en live' else ' is live' end;
      url := '/live';
    when 'COMMUNITY_JOINED' then
      title := 'IRLY';
      body := case when fr then 'Tu as rejoint une communauté. Son chat est dans Messages.' else 'You joined a community. Its chat is in Messages.' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'NEW_FOLLOWER' then
      title := 'IRLY';
      body := coalesce(who, someone) || case when fr then ' s’est abonné·e à toi' else ' started following you' end;
      url := case when n.payload ? 'from' then '/person/' || (n.payload ->> 'from') else '/notifications' end;
    when 'GROUP_ADDED' then
      title := coalesce(nullif(n.payload ->> 'title', ''), 'IRLY');
      body := coalesce(who, someone) || case when fr then ' t’a ajouté·e au groupe' else ' added you to the group' end;
      url := case when n.payload ? 'conversation_id' then '/messages/' || (n.payload ->> 'conversation_id') else '/messages' end;
    when 'COMMUNITY_POST' then
      title := coalesce(nullif(n.payload ->> 'community', ''), 'IRLY');
      body := coalesce(who, someone) || ': ' || coalesce(left(n.payload ->> 'body', 100), case when fr then 'nouvelle publication' else 'new post' end);
      url := case when n.payload ? 'community_id' then '/c/' || (n.payload ->> 'community_id') else '/notifications' end;
    else
      title := 'IRLY';
      body := case when fr then 'Tu as une nouvelle notification' else 'You have a new notification' end;
  end case;
end $$;
revoke all on function private.push_text(public.notifications, text) from public, anon, authenticated;

-- ───────── 7. "Notify me" for an upcoming destination is stored, like a coming-soon service ─────────
alter table public.service_interest drop constraint if exists service_interest_service_check;
alter table public.service_interest add constraint service_interest_service_check
  check (service in ('pro', 'bonplan', 'visa', 'location', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris'));
create or replace function public.set_service_interest(p_service text, p_on boolean default true)
returns boolean
language plpgsql security definer set search_path = public, private as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_service not in ('pro', 'bonplan', 'visa', 'location', 'dest_thailand', 'dest_singapore', 'dest_london', 'dest_paris') then
    raise exception 'unknown service' using errcode = '22023';
  end if;
  if p_on then
    insert into public.service_interest (user_id, service) values (auth.uid(), p_service) on conflict do nothing;
  else
    delete from public.service_interest where user_id = auth.uid() and service = p_service;
  end if;
  return p_on;
end $$;

-- ───────── 8. "Download my data" covers everything the policy lists ─────────
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
    'irl_posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'body', x.body, 'area_id', x.area_id, 'media_path', x.media_path, 'created_at', x.created_at)) from public.irl_posts x where x.author_id = me), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', x.conversation_id, 'body', x.body, 'photo', x.media_path, 'created_at', x.created_at) order by x.created_at) from public.messages x where x.sender_id = me and x.deleted_at is null), '[]'),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('with', case when f.user_a = me then f.user_b else f.user_a end, 'status', f.status, 'since', coalesce(f.accepted_at, f.created_at))) from public.friendships f where me in (f.user_a, f.user_b)), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'at', b.created_at)) from public.blocks b where b.blocker_id = me), '[]'),
    'reports_filed', coalesce((select jsonb_agg(jsonb_build_object('kind', r.target_kind, 'category', r.category, 'at', r.created_at)) from public.reports r where r.reporter_id = me), '[]'),
    'likes', coalesce((select jsonb_agg(jsonb_build_object('target_type', x.target_type, 'target_id', x.target_id)) from public.likes x where x.user_id = me), '[]'),
    'saved', coalesce((select jsonb_agg(jsonb_build_object('target_type', x.target_type, 'target_id', x.target_id)) from public.saves x where x.user_id = me), '[]'),
    'notifications', coalesce((select jsonb_agg(jsonb_build_object('kind', n.kind, 'created_at', n.created_at)) from public.notifications n where n.user_id = me), '[]'),
    'following', coalesce((select jsonb_agg(jsonb_build_object('user_id', f.followee_id, 'since', f.created_at)) from public.follows f where f.follower_id = me), '[]'),
    'followers', coalesce((select jsonb_agg(jsonb_build_object('user_id', f.follower_id, 'since', f.created_at)) from public.follows f where f.followee_id = me), '[]'),
    'group_chats', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', c.id, 'title', c.title, 'photo', c.photo_path, 'role', m.role, 'joined_at', m.joined_at)) from public.conversation_members m join public.conversations c on c.id = m.conversation_id where m.user_id = me and c.kind = 'group'), '[]'),
    'message_reactions', coalesce((select jsonb_agg(jsonb_build_object('message_id', x.message_id, 'emoji', x.emoji, 'at', x.created_at)) from public.message_reactions x where x.user_id = me), '[]'),
    'poll_votes', coalesce((select jsonb_agg(jsonb_build_object('post_id', x.post_id, 'option', x.option, 'at', x.created_at)) from public.community_poll_votes x where x.user_id = me), '[]'),
    'irly_girl_likes_passes_saves', coalesce((select jsonb_agg(jsonb_build_object('member', x.target_id, 'action', x.action, 'at', x.created_at)) from public.irly_match_actions x where x.actor_id = me), '[]'),
    'irly_girl_matches', coalesce((select jsonb_agg(jsonb_build_object('with', case when x.user_a = me then x.user_b else x.user_a end, 'score', x.score, 'created_at', x.created_at, 'removed_at', x.removed_at)) from public.irly_matches x where me in (x.user_a, x.user_b)), '[]'),
    'irly_girl_access_decisions', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'by_admin' - 'created_by') from public.girl_suspensions x where x.user_id = me), '[]'),
    'services_and_destinations_to_be_told_about', coalesce((select jsonb_agg(jsonb_build_object('service', x.service, 'at', x.created_at)) from public.service_interest x where x.user_id = me), '[]'),
    'assistant_requests', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.ai_commands x where x.user_id = me), '[]'),
    'support_requests', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.support_requests x where x.user_id = me), '[]'),
    'relocation_progress', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.relocation_progress x where x.user_id = me), '[]'),
    'close_friends', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.close_friends x where x.user_id = me), '[]'),
    'hidden_items', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.hidden_items x where x.user_id = me), '[]'),
    'shares', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.shares x where x.user_id = me), '[]'),
    'networking_requests', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.pro_connect_log x where x.user_id = me), '[]'),
    'usage_event_list', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' order by x.created_at) from public.analytics_events x where x.user_id = me), '[]'),
    'usage_events', (select count(*) from public.analytics_events where user_id = me)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- ───────── 9. follower lists respect each listed person's own visibility ─────────
create or replace function public.follow_list(p_user uuid, p_which text default 'followers')
returns table (id uuid, first_name text, photo_path text, i_follow boolean, followed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.photo_paths[1],
    exists (select 1 from public.follows x where x.follower_id = auth.uid() and x.followee_id = p.id),
    f.created_at
  from public.follows f
  join public.profiles p on p.id = case when p_which = 'following' then f.followee_id else f.follower_id end and p.deleted_at is null
  where (case when p_which = 'following' then f.follower_id else f.followee_id end) = p_user
    and auth.uid() is not null
    and not private.blocked_unchecked(auth.uid(), p.id)
    and (p_user = auth.uid() or (not private.blocked_unchecked(auth.uid(), p_user)
      and private.visible_to(auth.uid(), p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
    -- Someone who hides their profile from you is not shown in anyone's list either.
    and (p.id = auth.uid() or private.visible_to(auth.uid(), p.id, (select s.profile_visibility from public.safety_settings s where s.user_id = p.id)))
  order by f.created_at desc
  limit 500
$$;
