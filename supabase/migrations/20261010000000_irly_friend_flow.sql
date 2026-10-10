-- Friends, end to end, on a member's profile.
--
-- 1. add_friend refuses deleted accounts (the foreign key alone let a
--    request to a deleted member through), and two taps or two phones at the
--    same time never fail on the primary key: the second sees the first.
-- 2. Accepting marks the request notification as read, so the bell does not
--    keep counting a request already handled.
-- 3. public_profile says where the friendship stands ('none', 'outgoing',
--    'incoming', 'friends'), so the profile shows Add / Requested / Accept /
--    Friends from the server, after a refresh, a sign-out or on another phone.
-- Messaging rules do not change: who_can_message (default 'matches': friends
-- and IRLY matches) still decides who may open a private chat.

create or replace function public.add_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  a uuid := least(me, p_user);
  b uuid := greatest(me, p_user);
  f public.friendships;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user is null or p_user = me then raise exception 'that is you' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = p_user and deleted_at is null)
     or private.blocked_unchecked(me, p_user) then
    raise exception 'not available' using errcode = 'P0002';
  end if;
  -- One decision per pair at a time.
  perform pg_advisory_xact_lock(hashtextextended('friend:' || a::text || b::text, 0));
  select * into f from public.friendships where user_a = a and user_b = b;
  if not found then
    insert into public.friendships (user_a, user_b, requested_by) values (a, b, me) on conflict do nothing;
    -- Asking again after removing does not ping them again for a week.
    if not exists (
      select 1 from public.notifications n
      where n.user_id = p_user and n.kind = 'FRIEND_REQUEST' and n.payload ->> 'from' = me::text
        and n.created_at > now() - interval '7 days'
    ) then
      perform private.notify(p_user, 'FRIEND_REQUEST', jsonb_build_object('from', me));
    end if;
    return 'pending';
  end if;
  if f.status = 'pending' and f.requested_by <> me then
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = a and user_b = b;
    update public.notifications set read_at = coalesce(read_at, now())
      where user_id = me and kind in ('FRIEND_REQUEST', 'PRO_CONNECT_REQUEST') and payload ->> 'from' = p_user::text;
    perform private.notify(p_user, 'FRIEND_ACCEPTED', jsonb_build_object('from', me));
    return 'accepted';
  end if;
  return f.status;
end $$;
revoke all on function public.add_friend(uuid) from public, anon;
grant execute on function public.add_friend(uuid) to authenticated;

-- Where the friendship with someone stands, from my side.
create or replace function private.friend_status(me uuid, other uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when f.status = 'accepted' then 'friends'
      when f.requested_by = me then 'outgoing'
      else 'incoming' end
    from public.friendships f
    where f.user_a = least(me, other) and f.user_b = greatest(me, other)), 'none')
$$;
revoke all on function private.friend_status(uuid, uuid) from public, anon;

drop function if exists public.public_profile(uuid);
create function public.public_profile(p_user uuid)
returns table (id uuid, first_name text, photo_path text, bio text, city_id text, interests text[], languages text[],
  visible boolean, followers integer, following integer, i_follow boolean, follows_me boolean, can_message boolean,
  direct_id uuid, is_me boolean, friend_status text)
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
    p.id = me,
    case when p.id = me then 'none' else private.friend_status(me, p.id) end
  from public.profiles p where p.id = p_user;
end $$;
revoke all on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;
