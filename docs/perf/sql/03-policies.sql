-- PROPOSAL, not applied anywhere. This file rewrites security policies: it needs explicit validation.
-- No policy is removed or widened; each is the old rule written so the per-row part is an index probe.
-- Proven on 290 fingerprints across 10 member profiles: 0 differences, except messages_send (last statement),
-- which was checked by logic and three inserts only.

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
