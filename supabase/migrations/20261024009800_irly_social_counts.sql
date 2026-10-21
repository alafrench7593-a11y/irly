-- Social graph: a profile's counters say what its lists show.
-- Additive: no table or column dropped, no policy loosened.
--
-- public_profile counted every follows row (followers, following), while
-- follow_list and friend_list leave out closed accounts (profiles.deleted_at)
-- and members blocked with the viewer. A closed follower kept « 1 follower »
-- on a profile whose list was empty. The counters now leave out the same
-- people (a member who hides her profile from the viewer is still counted:
-- the count is a total, the list never names her).

create or replace function public.public_profile(p_user uuid)
 RETURNS TABLE(id uuid, first_name text, photo_path text, bio text, city_id text, interests text[], languages text[], visible boolean, followers integer, following integer, i_follow boolean, follows_me boolean, can_message boolean, direct_id uuid, is_me boolean, friend_status text, username text, friends integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- The same people as follow_list: a closed account, or one blocked with
    -- the viewer, is in no list, so it is in no count either.
    (select count(*)::int from public.follows f
      join public.profiles o on o.id = f.follower_id and o.deleted_at is null
      where f.followee_id = p.id and (o.id = me or not private.blocked_unchecked(me, o.id))),
    (select count(*)::int from public.follows f
      join public.profiles o on o.id = f.followee_id and o.deleted_at is null
      where f.follower_id = p.id and (o.id = me or not private.blocked_unchecked(me, o.id))),
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
    case when p.id = me then 'none' else private.friend_status(me, p.id) end,
    p.username,
    (select count(*)::int from public.friendships f
      join public.profiles o on o.id = case when f.user_a = p.id then f.user_b else f.user_a end and o.deleted_at is null
      where f.status = 'accepted' and p.id in (f.user_a, f.user_b) and (o.id = me or not private.blocked_unchecked(me, o.id)))
  from public.profiles p where p.id = p_user;
end $function$;
