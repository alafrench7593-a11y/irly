-- Messaging and social, completed on the existing tables:
--  1. Follows between members (one row per pair, no self-follow, blocks
--     remove them, writes only through RPCs, a notification for a new follower).
--  2. A real member profile for any member (public_profile), honouring
--     profile_visibility, with followers / following lists.
--  3. Group chats people can create (conversations.kind = 'group' existed
--     with no way to make one): title, members, photo, rename, add, leave.
--  4. Photos in messages: a private "chat-media" bucket, a media path on the
--     message, readable only by the chat's members.
--  5. The inbox returns each chat's own picture: the other person's photo
--     for private chats, the community's photo for community chats, the
--     activity's cover, the group's photo, and the member count.

-- ───────────────────────── 1. Follows ─────────────────────────

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);
alter table public.follows enable row level security;
alter table public.follows replica identity full;

-- Rows you are part of; everything else goes through the RPCs below.
drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to authenticated
  using (follower_id = auth.uid() or followee_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in (
  'MATCH_CREATED', 'MATCH_REMOVED', 'MESSAGE_CREATED', 'ACTIVITY_CREATED', 'ACTIVITY_JOINED',
  'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER', 'ACTIVITY_UPDATED', 'COMMUNITY_JOINED', 'COMMUNITY_INVITATION',
  'COMMUNITY_POST', 'MATCH_SUGGESTION', 'IRLY_POST_CREATED', 'PROFILE_UPDATED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
  'LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION', 'SHARE', 'AI_ACTION', 'PRO_CONNECT_REQUEST', 'PRO_CONNECT_ACCEPTED',
  'NEW_FOLLOWER', 'GROUP_ADDED'
));

-- Follow (idempotent: a double tap is one row, one notification).
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
  if n > 0 then
    insert into public.notifications (user_id, kind, payload) values (p_user, 'NEW_FOLLOWER', jsonb_build_object('from', me));
  end if;
  return true;
end $$;

create or replace function public.unfollow_user(p_user uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  delete from public.follows where follower_id = auth.uid() and followee_id = p_user;
  return false;
end $$;

-- A block ends following both ways.
create or replace function private.blocks_end_follows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end $$;
drop trigger if exists blocks_end_follows on public.blocks;
create trigger blocks_end_follows after insert on public.blocks
for each row execute function private.blocks_end_follows();

revoke all on function public.follow_user(uuid), public.unfollow_user(uuid) from public, anon;
grant execute on function public.follow_user(uuid), public.unfollow_user(uuid) to authenticated;

-- ───────────────────────── 2. Member profile ─────────────────────────

-- What the viewer may see of a member. When the profile is not visible to
-- them, only the first name and photo come back (as in a shared chat), with
-- visible = false, and no lists.
create or replace function public.public_profile(p_user uuid)
returns table (id uuid, first_name text, photo_path text, bio text, city_id text, interests text[], languages text[],
  visible boolean, followers integer, following integer, i_follow boolean, follows_me boolean, can_message boolean,
  direct_id uuid, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  vis boolean;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles p where p.id = p_user and p.deleted_at is null)
     or (p_user <> me and private.blocked_unchecked(me, p_user)) then
    return;
  end if;
  vis := p_user = me or private.visible_to(me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user));
  return query
  select p.id, p.first_name, p.photo_paths[1],
    case when vis then p.bio end,
    case when vis then p.city_id end,
    case when vis then p.interests else '{}'::text[] end,
    case when vis then p.languages else '{}'::text[] end,
    vis,
    (select count(*)::int from public.follows f where f.followee_id = p.id),
    (select count(*)::int from public.follows f where f.follower_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = me and f.followee_id = p.id),
    exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = me),
    p.id <> me and (private.may_message(p.id) or exists (
      select 1 from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id))),
    (select c.id from public.conversations c
      where c.kind = 'direct'
        and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = me)
        and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = p.id)
      limit 1),
    p.id = me
  from public.profiles p where p.id = p_user;
end $$;

-- The public communities of a member (girl-only ones only for women who
-- may see them), when their profile is visible to you.
create or replace function public.member_communities(p_user uuid)
returns table (id uuid, name text, city_id text, cover_path text, members integer)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.city_id, c.cover_path, (select count(*)::int from public.community_members x where x.community_id = c.id)
  from public.community_members m
  join public.communities c on c.id = m.community_id and c.deleted_at is null
  where m.user_id = p_user
    and (not c.girl_only or private.girl_eligible_unchecked(auth.uid()))
    and (p_user = auth.uid() or (not private.blocked_unchecked(auth.uid(), p_user)
      and private.visible_to(auth.uid(), p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
  order by c.name
  limit 50
$$;

-- Followers / following of a member, when their profile is visible to you.
-- Members who blocked you (or you them) are left out.
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
  order by f.created_at desc
  limit 500
$$;

revoke all on function public.public_profile(uuid), public.member_communities(uuid), public.follow_list(uuid, text) from public, anon;
grant execute on function public.public_profile(uuid), public.member_communities(uuid), public.follow_list(uuid, text) to authenticated;

-- ───────────────────────── 3. Group chats ─────────────────────────

-- Create a group: you are its admin; you may add people you are allowed to
-- message (friends, matches, or whoever accepts it in their settings).
create or replace function public.create_group(p_title text, p_members uuid[], p_photo text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  conv uuid;
  m uuid;
begin
  if me is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'give the group a name (60 characters at most)' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_members), 0) = 0 or cardinality(p_members) > 49 then
    raise exception 'add between 1 and 49 people' using errcode = '22023';
  end if;
  if p_photo is not null and not private.own_upload(p_photo) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  foreach m in array p_members loop
    if m = me then continue; end if;
    if not exists (select 1 from public.profiles where id = m and deleted_at is null) or not private.may_message(m) then
      raise exception 'one of these people does not accept messages from you' using errcode = '42501';
    end if;
  end loop;
  insert into public.conversations (kind, title, photo_path) values ('group', btrim(p_title), p_photo) returning id into conv;
  insert into public.conversation_members (conversation_id, user_id, role) values (conv, me, 'admin');
  insert into public.conversation_members (conversation_id, user_id)
    select conv, x from unnest(p_members) x where x <> me on conflict do nothing;
  insert into public.notifications (user_id, kind, payload)
    select x, 'GROUP_ADDED', jsonb_build_object('from', me, 'conversation_id', conv, 'title', btrim(p_title))
    from unnest(p_members) x where x <> me;
  return conv;
end $$;

create or replace function public.add_group_members(p_conversation uuid, p_members uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  m uuid;
  t text;
begin
  select title into t from public.conversations where id = p_conversation and kind = 'group';
  if t is null or not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = me) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  foreach m in array coalesce(p_members, '{}') loop
    if m = me or exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = m) then continue; end if;
    if not private.may_message(m) then
      raise exception 'one of these people does not accept messages from you' using errcode = '42501';
    end if;
    insert into public.conversation_members (conversation_id, user_id) values (p_conversation, m) on conflict do nothing;
    insert into public.notifications (user_id, kind, payload) values (m, 'GROUP_ADDED', jsonb_build_object('from', me, 'conversation_id', p_conversation, 'title', t));
  end loop;
end $$;

create or replace function public.rename_group(p_conversation uuid, p_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.conversations c join public.conversation_members m on m.conversation_id = c.id
                 where c.id = p_conversation and c.kind = 'group' and m.user_id = auth.uid() and m.role = 'admin') then
    raise exception 'only the group admin can rename it' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then
    raise exception 'give the group a name (60 characters at most)' using errcode = '22023';
  end if;
  update public.conversations set title = btrim(p_title) where id = p_conversation;
end $$;

-- Leave a group. The last admin leaving hands the role to the oldest member;
-- the last member leaving deletes the group (no orphan chat).
create or replace function public.leave_group(p_conversation uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if not exists (select 1 from public.conversations where id = p_conversation and kind = 'group') then
    raise exception 'not a group' using errcode = '22023';
  end if;
  delete from public.conversation_members where conversation_id = p_conversation and user_id = me;
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation) then
    delete from public.conversations where id = p_conversation;
  elsif not exists (select 1 from public.conversation_members where conversation_id = p_conversation and role = 'admin') then
    update public.conversation_members set role = 'admin'
    where conversation_id = p_conversation
      and user_id = (select user_id from public.conversation_members where conversation_id = p_conversation order by joined_at limit 1);
  end if;
end $$;

-- Members of a chat you are in (for the group info and avatars by messages).
create or replace function public.chat_members(p_conversation uuid)
returns table (user_id uuid, first_name text, photo_path text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.first_name, p.photo_paths[1], m.role
  from public.conversation_members m
  join public.profiles p on p.id = m.user_id and p.deleted_at is null
  where m.conversation_id = p_conversation
    and private.is_member(p_conversation, auth.uid())
  order by m.role = 'admin' desc, p.first_name
  limit 500
$$;

-- People you may add to a group: friends, people you follow or who follow
-- you, and people you already talk to privately, who accept your messages.
create or replace function public.group_candidates()
returns table (id uuid, first_name text, photo_path text)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as id),
  near as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as uid from public.friendships f, me
      where f.status = 'accepted' and me.id in (f.user_a, f.user_b)
    union select followee_id from public.follows, me where follower_id = me.id
    union select follower_id from public.follows, me where followee_id = me.id
    union select o.user_id from public.conversation_members a
      join public.conversations c on c.id = a.conversation_id and c.kind in ('direct', 'match')
      join public.conversation_members o on o.conversation_id = c.id, me
      where a.user_id = me.id and o.user_id <> me.id
  )
  select p.id, p.first_name, p.photo_paths[1]
  from near join public.profiles p on p.id = near.uid and p.deleted_at is null
  where private.may_message(p.id)
  order by p.first_name
  limit 300
$$;

revoke all on function public.create_group(text, uuid[], text), public.add_group_members(uuid, uuid[]), public.rename_group(uuid, text),
  public.leave_group(uuid), public.chat_members(uuid), public.group_candidates() from public, anon;
grant execute on function public.create_group(text, uuid[], text), public.add_group_members(uuid, uuid[]), public.rename_group(uuid, text),
  public.leave_group(uuid), public.chat_members(uuid), public.group_candidates() to authenticated;

-- ───────────────────────── 4. Photos in messages ─────────────────────────

alter table public.messages add column if not exists media_path text;
alter table public.messages drop constraint if exists messages_media_shape;
alter table public.messages add constraint messages_media_shape check (media_path is null or (kind = 'photo' and media_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'));

-- A photo message points at one of the sender's own uploads.
create or replace function private.message_media_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.media_path is not null and split_part(new.media_path, '/', 1) <> coalesce(new.sender_id::text, '') then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.media_path is distinct from old.media_path then
    raise exception 'a sent photo cannot be swapped' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_media_guard on public.messages;
create trigger messages_media_guard before insert or update on public.messages
for each row execute function private.message_media_guard();

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('chat-media', 'chat-media', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'])
    on conflict (id) do nothing;
    execute 'drop policy if exists chat_media_write on storage.objects';
    execute $p$
      create policy chat_media_write on storage.objects for insert to authenticated
      with check (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists chat_media_delete on storage.objects';
    execute $p$
      create policy chat_media_delete on storage.objects for delete to authenticated
      using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    -- Read: your own uploads, or a photo sent in a chat you are a member of.
    execute 'drop policy if exists chat_media_read on storage.objects';
    execute $p$
      create policy chat_media_read on storage.objects for select to authenticated
      using (bucket_id = 'chat-media' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.messages m where m.media_path = name and m.deleted_at is null and private.is_member(m.conversation_id))
      ))
    $p$;
  end if;
end $$;

-- ───────────────────────── 5. Inbox with pictures ─────────────────────────

drop function if exists public.my_conversations();
create function public.my_conversations()
returns table (conversation_id uuid, kind text, title text, other_user_id uuid, other_name text, last_body text,
  last_sender uuid, last_at timestamptz, unread integer, ref_id uuid,
  other_photo text, photo_path text, photo_bucket text, members integer, last_kind text, last_sender_name text)
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
    (select count(*)::int from public.messages x
       where x.conversation_id = c.id and x.deleted_at is null
         and x.sender_id is distinct from auth.uid()
         and (x.sender_id is null or not private.blocked_unchecked(auth.uid(), x.sender_id))
         and x.created_at > coalesce(me.last_read_at, 'epoch'::timestamptz)),
    coalesce(c.activity_id, c.community_id, c.match_id),
    other.photo,
    -- Each chat's own picture: the community's photo, else the chat's, else the activity's cover.
    coalesce(com.cover_path, c.photo_path, act.cover_path),
    case when coalesce(com.cover_path, c.photo_path, act.cover_path) is null then null else 'activity-photos' end,
    (select count(*)::int from public.conversation_members x where x.conversation_id = c.id),
    lm.kind,
    lm.first_name
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.communities com on com.id = c.community_id
  left join public.activities act on act.id = c.activity_id
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
    order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
    and not (c.kind in ('direct', 'match') and other.id is not null and private.blocked_unchecked(auth.uid(), other.id))
  order by coalesce(lm.created_at, c.created_at) desc
$$;
revoke all on function public.my_conversations() from public, anon;
grant execute on function public.my_conversations() to authenticated;

-- Realtime: follows reach the profiles that show them.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'follows') then
    alter publication supabase_realtime add table public.follows;
  end if;
end $$;
