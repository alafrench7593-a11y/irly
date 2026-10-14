-- Joining an activity or a community with an account whose profile never
-- reached the server (signup finished offline, or the publish failed) used to
-- fail on the profiles foreign key: "violates foreign key constraint", which
-- the app can only show as "Something went wrong on our side". The member now
-- reads what to do, and the app publishes the missing profile and retries.
-- The functions are otherwise unchanged (same checks, same writes, same RLS).

create or replace function private.require_profile(uid uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = uid and deleted_at is null) then
    raise exception 'Finish your profile first' using errcode = '42501', hint = 'profile_missing';
  end if;
end $$;
revoke all on function private.require_profile(uuid) from public, anon, authenticated;

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

CREATE OR REPLACE FUNCTION public.join_community(p_community uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.communities;
  conv uuid;
  me uuid := auth.uid();
  added integer;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  perform private.require_profile(me);
  select * into c from public.communities where id = p_community and deleted_at is null;
  if not found then
    raise exception 'community not found' using errcode = 'P0002';
  end if;
  if c.girl_only and not private.is_girl_eligible(me) then
    raise exception 'this community is reserved for IRLY Girl' using errcode = '42501';
  end if;
  insert into public.community_members (community_id, user_id) values (p_community, me) on conflict do nothing;
  get diagnostics added = row_count;
  conv := private.ensure_conversation('community', p_community, c.name);
  insert into public.conversation_members (conversation_id, user_id) values (conv, me) on conflict do nothing;
  if added > 0 then
    perform private.notify(me, 'COMMUNITY_JOINED', jsonb_build_object('community_id', p_community, 'conversation_id', conv));
  end if;
  return conv;
end $function$;

CREATE OR REPLACE FUNCTION public.join_communities(p_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cid uuid;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  perform private.require_profile(auth.uid());
  foreach cid in array coalesce(p_ids, '{}') loop
    begin
      perform public.join_community(cid);
      n := n + 1;
    exception when others then
      -- A community the member may not join (girls-only, gone) is skipped.
      null;
    end;
  end loop;
  return n;
end $function$;
