-- PROPOSAL, not applied anywhere. Same expressions, same results: the helper functions keep one cached plan
-- instead of being planned again on every row. No policy is touched in this file.
-- Proven on 290 fingerprints across 10 member profiles: 0 differences (see docs/perf/REPORT.md).
CREATE OR REPLACE FUNCTION private.blocked_unchecked(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
); end $function$
;
CREATE OR REPLACE FUNCTION private.discoverable(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select private.visible_to(auth.uid(), uid, (select s.profile_visibility from public.safety_settings s where s.user_id = uid))
); end $function$
;
CREATE OR REPLACE FUNCTION private.friends_unchecked(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (
    select 1 from public.friendships
    where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted'
  )
); end $function$
;
CREATE OR REPLACE FUNCTION private.girl_eligible_unchecked(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (
    select 1 from public.profiles p
    where p.id = uid and p.gender = 'woman' and p.deleted_at is null
      and not exists (select 1 from public.girl_suspensions s where s.user_id = uid)
      and (private.identity_verified(uid) or not private.girl_selfie_required())
  ) and not private.is_sanctioned(uid)
); end $function$
;
CREATE OR REPLACE FUNCTION private.girl_selfie_required()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select case coalesce((select value from private.girl_settings where key = 'selfie_mode'), 'auto')
    when 'on' then true
    when 'off' then false
    else exists (select 1 from private.girl_settings where key = 'selfie_reached_at')
  end
); end $function$
;
CREATE OR REPLACE FUNCTION private.identity_verified(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (select 1 from public.profiles p where p.id = uid and p.verified_at is not null)
      or exists (select 1 from public.verification_requests v where v.user_id = uid and v.status = 'approved')
); end $function$
;
CREATE OR REPLACE FUNCTION private.is_admin(uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select coalesce(private.staff_power(uid) in ('owner', 'admin'), false)
); end $function$
;
CREATE OR REPLACE FUNCTION private.is_sanctioned(uid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (
    select 1 from public.sanctions s
    where s.user_id = uid and s.kind in ('suspension', 'ban') and s.lifted_at is null
      and (s.ends_at is null or s.ends_at > now())
  )
); end $function$
;
CREATE OR REPLACE FUNCTION private.moderates(cid uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select private.is_admin(auth.uid()) or (
    exists (
      select 1 from public.community_members m
      where m.user_id = auth.uid()
        and (m.role in ('owner', 'moderator') or (m.role = 'co_admin' and m.permissions @> '{"moderation": true}'))
        and m.community_id in (cid, (select parent_id from public.communities where id = cid))
    )
    and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
         or private.girl_eligible_unchecked(auth.uid()))
  )
); end $function$
;
CREATE OR REPLACE FUNCTION private.my_block_ids()
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select coalesce(array_agg(case when b.blocker_id = auth.uid() then b.blocked_id else b.blocker_id end), '{}')
  from public.blocks b
  where b.blocker_id = auth.uid() or b.blocked_id = auth.uid()
 ); end $function$
;
CREATE OR REPLACE FUNCTION private.profile_visible_unchecked(viewer uuid, target uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select case
    when viewer is null or target is null then false
    when viewer = target then true
    when private.blocked_unchecked(viewer, target) then false
    when private.visible_to(viewer, target, (select s.profile_visibility from public.safety_settings s where s.user_id = target)) then true
    when exists (select 1 from public.friendships f
                 where f.user_a = least(viewer, target) and f.user_b = greatest(viewer, target)
                   and (f.status = 'accepted' or f.requested_by = target)) then true
    when exists (select 1 from public.follows f where f.follower_id = target and f.followee_id = viewer) then true
    when exists (select 1 from public.conversation_members x
                 join public.conversation_members y on y.conversation_id = x.conversation_id and y.user_id = target
                 join public.conversations c on c.id = x.conversation_id
                 where x.user_id = viewer
                   and (c.kind in ('direct', 'match') or exists (
                     select 1 from public.messages m where m.conversation_id = c.id and m.sender_id = target and m.deleted_at is null))) then true
    when exists (select 1 from public.community_members a
                 join public.community_members b on b.community_id = a.community_id and b.user_id = target
                 where a.user_id = viewer) then true
    when exists (select 1 from public.activity_participants a
                 join public.activities act on act.id = a.activity_id
                 where (a.user_id = viewer and (act.creator_id = target or exists (
                          select 1 from public.activity_participants b where b.activity_id = a.activity_id and b.user_id = target)))
                    or (a.user_id = target and act.creator_id = viewer)) then true
    else private.is_moderator(viewer)
  end
); end $function$
;
CREATE OR REPLACE FUNCTION private.staff_power(uid uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select case
    when r is null then null
    when r = 'owner' then r
    when private.is_sanctioned(uid) then null
    else r
  end
  from (select private.staff_role(uid) as r) x
); end $function$
;
CREATE OR REPLACE FUNCTION private.visible_to(viewer uuid, target uuid, vis text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select case coalesce(vis, 'everyone')
    when 'everyone' then true
    when 'nobody' then false
    when 'friends' then private.friends_unchecked(viewer, target)
    when 'communities' then private.friends_unchecked(viewer, target) or exists (
      select 1 from public.community_members a join public.community_members b on b.community_id = a.community_id
      where a.user_id = viewer and b.user_id = target)
    else false
  end
); end $function$
;
alter function private.can_see(text,text) set plan_cache_mode to force_generic_plan;
alter function private.girl_target(text,text) set plan_cache_mode to force_generic_plan;
alter function private.is_girl_eligible(uuid) set plan_cache_mode to force_generic_plan;
alter function private.notification_is_girl(text,jsonb) set plan_cache_mode to force_generic_plan;
CREATE OR REPLACE FUNCTION private.girl_chat(conv uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET plan_cache_mode TO 'force_generic_plan'
AS $function$ begin return (select exists (
    select 1 from public.conversations v
    left join public.communities c on c.id = v.community_id
    left join public.activities a on a.id = v.activity_id
    where v.id = conv
      and (v.kind = 'match' or coalesce(c.girl_only, false) or coalesce(a.girl_only, false))
  )
 ); end $function$
;
