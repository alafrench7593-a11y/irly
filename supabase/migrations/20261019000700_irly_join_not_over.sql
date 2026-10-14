-- An activity that is over could still be joined from an old link (the lists
-- hide it, the server did not check), which also notified its organiser.
-- Same function as before, plus one check: joining an activity that has ended
-- (its end time, or two hours after its start when it has none) is refused.
CREATE OR REPLACE FUNCTION public.join_activity(p_activity uuid, p_status text DEFAULT 'going'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.activities;
  going integer;
  conv uuid;
  me uuid := auth.uid();
  before text;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  perform private.require_profile(me);
  select * into a from public.activities where id = p_activity and cancelled_at is null for update;
  if not found then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if coalesce(a.ends_at, a.starts_at + interval '2 hours') < now() then
    raise exception 'This activity is over' using errcode = '22023';
  end if;
  if a.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this activity is reserved for IRLY Girl' using errcode = '42501';
  end if;
  if private.is_blocked(me, a.creator_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  select status into before from public.activity_participants where activity_id = p_activity and user_id = me;
  -- Who may join: anyone (public), the creator's friends, the community's
  -- members, or (invite) people it was shared with in a chat they are in.
  if a.creator_id <> me and before is null and not (
    a.privacy = 'public'
    or (a.privacy = 'friends' and private.friends_unchecked(me, a.creator_id))
    or (a.privacy = 'community' and a.community_id is not null
        and exists (select 1 from public.community_members where community_id = a.community_id and user_id = me))
    -- Invite: shared in one of your chats BY the creator or someone going
    -- (anyone can write a message pointing at an id; that is not an invite).
    or (a.privacy = 'invite' and exists (
        select 1 from public.messages msg
        join public.conversation_members cm on cm.conversation_id = msg.conversation_id and cm.user_id = me
        where msg.kind = 'share' and msg.ref_type = 'activity' and msg.ref_id = p_activity and msg.deleted_at is null
          and (msg.sender_id = a.creator_id or exists (
            select 1 from public.activity_participants ap where ap.activity_id = a.id and ap.user_id = msg.sender_id and ap.status = 'going'))))
  ) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if p_status = 'going' and a.capacity is not null then
    select count(*) into going from public.activity_participants
    where activity_id = p_activity and status = 'going' and user_id <> me;
    if going >= a.capacity then
      return 'full';
    end if;
  end if;
  insert into public.activity_participants (activity_id, user_id, status) values (p_activity, me, p_status)
  on conflict (activity_id, user_id) do update set status = excluded.status;
  conv := private.ensure_conversation('activity', p_activity, a.title);
  if p_status = 'going' then
    insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
    -- Once per person and activity, however often they switch going/maybe.
    if a.creator_id <> me and not exists (
      select 1 from public.notifications n
      where n.user_id = a.creator_id and n.kind = 'ACTIVITY_JOINED'
        and n.payload ->> 'activity_id' = p_activity::text and n.payload ->> 'user_id' = me::text
    ) then
      perform private.notify(a.creator_id, 'ACTIVITY_JOINED', jsonb_build_object('activity_id', p_activity, 'user_id', me));
    end if;
  else
    delete from public.conversation_members where conversation_id = conv and user_id = me and user_id <> a.creator_id;
  end if;
  return p_status;
end $function$;
