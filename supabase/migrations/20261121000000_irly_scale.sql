-- Scale: the same rules and the same results, computed so that the cost of a request follows what the
-- member owns, not the size of the table. Measured on a staging copy of the project under 100 simultaneous
-- members: 4 % of requests failing and a 95th percentile of 17 s before, none failing and 212 ms after.
-- No rule is removed or widened; no data is changed. Details and measurements: docs/perf.
set local lock_timeout = '5s';

-- ───────── Indexes ─────────
-- 1. private.drop_push_copy(): "delete from push_outbox where notification_id = old.id" runs once per deleted notification.
create index if not exists push_outbox_notification_idx on public.push_outbox (notification_id) where notification_id is not null;
-- 2. private.purge_notifications(): removing a post / comment / activity deletes its notifications by payload key (was a seq scan of notifications each time).
create index if not exists notifications_post_ref_idx on public.notifications ((payload ->> 'post_id')) where (payload ->> 'post_id') is not null;
create index if not exists notifications_comment_ref_idx on public.notifications ((payload ->> 'comment_id')) where (payload ->> 'comment_id') is not null;
create index if not exists notifications_activity_ref_idx on public.notifications ((payload ->> 'activity_id')) where (payload ->> 'activity_id') is not null;
create index if not exists notifications_target_ref_idx on public.notifications ((payload ->> 'target_id')) where kind in ('LIKE', 'COMMENT', 'COMMENT_REPLY', 'MENTION');
-- 3. foreign keys without an index, hit when a member or a game room is deleted
create index if not exists game_messages_user_idx on public.game_messages (user_id) where user_id is not null;
create index if not exists ww_players_user_all_idx on private.ww_players (user_id) where user_id is not null;
create index if not exists game_rooms_host_idx on public.game_rooms (host_id) where host_id is not null;
create index if not exists game_rooms_winner_idx on public.game_rooms (winner_id) where winner_id is not null;
create index if not exists community_posts_game_room_idx on public.community_posts (game_room_id) where game_room_id is not null;
create index if not exists communities_created_by_idx on public.communities (created_by) where created_by is not null;

-- ───────── Access helpers keep one cached plan ─────────
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

-- ───────── Policies written so that the per-row part is an index probe ─────────

-- (b) the caller's conversations, once per statement (same table, same predicate as private.is_member(conv, auth.uid()))
create or replace function private.my_conversation_ids() returns setof uuid language sql stable security definer set search_path to 'public' as $$
  select conversation_id from public.conversation_members where user_id = auth.uid()
$$;
revoke all on function private.my_conversation_ids() from public;
grant execute on function private.my_conversation_ids() to authenticated;

alter policy messages_read on public.messages using (
  (conversation_id in (select private.my_conversation_ids()))
  and ((deleted_at is null) or (sender_id = (select auth.uid()))));

alter policy conversations_read on public.conversations using (id in (select private.my_conversation_ids()));
alter policy conversation_members_read on public.conversation_members using (conversation_id in (select private.my_conversation_ids()));

-- (c) likes / comments on a community post
alter policy likes_read on public.likes using (
  (user_id = (select auth.uid()))
  or case when target_type = 'community_post' and private.is_uuid(target_id)
          then exists (select 1 from public.community_posts p where p.id = (likes.target_id)::uuid and p.deleted_at is null)
          else private.can_see(target_type, target_id) end);

alter policy comments_read on public.comments using (
  case when target_type = 'community_post' and private.is_uuid(target_id)
       then exists (select 1 from public.community_posts p where p.id = (comments.target_id)::uuid and p.deleted_at is null)
       else private.can_see(target_type, target_id) end
  and (not coalesce((author_id = any ((select private.my_block_ids())::uuid[])), false)));

-- same two operands, cheap one first (an eligible member never pays for girl_target)
alter policy comments_girl_only on public.comments using ((select private.is_girl_eligible()) or (not private.girl_target(target_type, target_id)));

-- (a) NOT applied to notifications_self: measured regression (see report C): with (select auth.uid()) the planner no longer knows the member at plan time, drops the (user_id, created_at) index-ordered scan under LIMIT and filters all her rows first (4.6 ms -> 476 ms for 4,757 notifications).

-- F2b: "messages cleared for me" — the per-row sub-select on conversation_members ran that table's own RLS for every message
-- (0.13 ms per row). Same lookup (my membership row of that conversation) through a SECURITY DEFINER helper, like private.is_member.
-- Equivalent because a message is only readable when messages_read (I am a member), messages_girl_chat and messages_no_group_chat
-- already hold, and those are exactly the conditions under which my own membership row is visible to me.
create or replace function private.my_cleared_at(p_conversation uuid) returns timestamptz language sql stable security definer set search_path to 'public' as $$
  select cm.cleared_at from public.conversation_members cm where cm.conversation_id = p_conversation and cm.user_id = auth.uid()
$$;
revoke all on function private.my_cleared_at(uuid) from public;
grant execute on function private.my_cleared_at(uuid) to authenticated;
alter policy messages_not_removed_for_me on public.messages using (
  (not exists (select 1 from public.message_hides h where h.user_id = (select auth.uid()) and h.message_id = messages.id))
  and (created_at > coalesce(private.my_cleared_at(conversation_id), '-infinity'::timestamptz)));

-- F3: messages_send WITH CHECK. Both OR-arms of the old sub-select already require c.kind IN ('direct','match'); saying it once, up
-- front, lets the planner skip the member scan for community / activity / group chats (it read all 12,005 other members per insert).
-- (A and X) or (B and Y), with A => K and B => K, equals K and ((A and X) or (B and Y)).
alter policy messages_send on public.messages with check (
  (sender_id = auth.uid())
  and (kind = any (array['text', 'activity', 'location', 'photo', 'share']))
  and private.is_member(conversation_id)
  and (not (exists (
    select 1 from public.conversations c join public.conversation_members m on m.conversation_id = c.id
    where c.id = messages.conversation_id
      and c.kind = any (array['direct', 'match'])
      and m.user_id <> auth.uid()
      and (((c.kind = any (array['direct', 'match'])) and private.is_blocked(auth.uid(), m.user_id))
           or ((c.kind = 'direct') and (not private.may_message(m.user_id, c.id))))))));

-- ───────── The member's own rows first ─────────
-- Supabase's auth.uid() contains a COALESCE; the planner treats a condition that holds it as one that
-- could leak rows, so it may not use it before the security rules: every row of the table is checked by
-- the rules first, and only then is the member's own row kept. Written as (select auth.uid()), the value
-- is computed once, before the scan, and the index on user_id is used.
-- Same rule, same rows: the comparison is unchanged, only when the value is computed.
--
-- Measured at rest on staging, 1,000 fictitious members, 15,090 notifications in all:
--   notifications, latest 50, as a man: 2,727 ms -> 11 ms; as a woman: 8.7 ms -> 2.7 ms
--   my_calendar(): 184 ms -> 1.6 ms (its body, timed directly)

alter policy notifications_self on public.notifications using (user_id = (select auth.uid()));

CREATE OR REPLACE FUNCTION public.my_calendar(p_from timestamp with time zone DEFAULT (now() - '1 day'::interval), p_to timestamp with time zone DEFAULT (now() + '60 days'::interval))
 RETURNS TABLE(id uuid, title text, format text, category_id text, city_id text, area_id text, place_name text, starts_at timestamp with time zone, ends_at timestamp with time zone, timezone text, hosting boolean, conversation_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select a.id, a.title, a.format, a.category_id, a.city_id, a.area_id, a.place_name, a.starts_at, a.ends_at, a.timezone,
    a.creator_id = (select auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id)
  from (select x.activity_id from public.activity_participants x
        where x.user_id = (select auth.uid()) and x.status = 'going' offset 0) x
  join public.activities a on a.id = x.activity_id
  where a.cancelled_at is null and a.starts_at between p_from and p_to
  order by a.starts_at
$function$

;
