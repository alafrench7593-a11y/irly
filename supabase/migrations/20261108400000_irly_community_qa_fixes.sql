-- QA fixes for the communities (2026-11-06).
--
-- 1. Deleting an owner's account hands each community to the highest role
--    left (co-admin, then moderator, then the oldest member), as the role
--    ranks of 20261107000000 say. Before, a moderator or even a plain member
--    could pass a co-admin. The heir gets no co-admin limits, a
--    COMMUNITY_OWNERSHIP notification, and a journal entry. delete_my_account
--    is otherwise the one of 20261020001400_irly_account_purge, unchanged.
-- 2. An official community's name, tagline and description are IRLY's: only
--    IRLY's content team changes them (admin_official_texts,
--    admin_update_community, the official sync). A co-admin or owner writing
--    the row directly is refused, as community_update_info already refuses.

-- ───────── 1. Owner succession on account deletion ─────────
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private
-- A row locked by another transaction makes the call fail clearly (and the app
-- offers a retry) instead of waiting until the request is cut.
set lock_timeout = '10s'
as $$
declare
  me uuid := auth.uid();
  my_email text;
  goer record;
  g record;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- Two requests close together (double tap, a retry while the first is still
  -- running): the second waits here for the first, then finds nothing to do.
  perform 1 from public.profiles where id = me for no key update;
  begin
    perform 1 from auth.users where id = me for no key update;
  exception when insufficient_privilege then
    null;
  end;
  if not exists (select 1 from auth.users where id = me) and not exists (select 1 from public.profiles where id = me) then
    return;
  end if;
  select to_jsonb(u) ->> 'email' into my_email from auth.users u where u.id = me;
  -- Every file of the member, in every bucket, goes on the purge list (the
  -- database never deletes stored files itself; scripts/storage-purge.mjs
  -- removes them through the Storage API).
  begin
    perform private.queue_member_storage(me, 'account_deleted');
  exception when others then
    -- Never a reason to keep the account (the purge sweep finds leftovers).
    raise warning 'delete_my_account: storage files not queued (%)', sqlstate;
  end;
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
  -- The push copies (title and text, which can carry the member's name) of the
  -- notifications deleted below go with them.
  delete from public.push_outbox po using public.notifications n
  where po.notification_id = n.id
    and (n.payload ->> 'from' = me::text or n.payload ->> 'user_id' = me::text or n.payload ->> 'with' = me::text
      or (n.kind = 'MESSAGE_CREATED' and exists (select 1 from public.messages m where m.sender_id = me and n.payload ->> 'message_id' = m.id::text)));
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
    order by m.community_id, private.community_role_rank(m.role) desc, m.joined_at
  ) heir
  where cm.community_id = heir.community_id and cm.user_id = heir.user_id;
  -- The heir runs it fully (no co-admin limits left), hears it, and the
  -- community's journal says why (no actor: the former owner is gone).
  for g in select cm.community_id, cm.user_id from public.community_members cm
           join public.community_members mine on mine.community_id = cm.community_id and mine.user_id = me and mine.role = 'owner'
           where cm.role = 'owner' and cm.user_id <> me loop
    update public.community_members set permissions = '{}' where community_id = g.community_id and user_id = g.user_id;
    perform private.community_notify(g.user_id, 'COMMUNITY_OWNERSHIP', g.community_id);
    insert into public.community_audit (community_id, actor, action, target_user, meta)
    values (g.community_id, null, 'ownership.succession', g.user_id, jsonb_build_object('reason', 'account_deleted'));
  end loop;
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
  -- The website waitlist: the same person, by their sign-in address.
  if my_email is not null then
    delete from public.waitlist where email = lower(btrim(my_email));
  end if;
  -- The sign-in account itself (its sessions go with it): every row of the
  -- member's that references the profile cascades from here, and the
  -- profiles trigger below clears what kept rows say about them.
  delete from auth.users where id = me;
  -- Verified before answering: a success always means the account is gone.
  if exists (select 1 from auth.users where id = me) or exists (select 1 from public.profiles where id = me) then
    raise exception 'account still exists' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── 2. Official texts stay IRLY's ─────────
create or replace function private.official_texts_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if old.official and auth.uid() is not null
     and (new.name is distinct from old.name or new.tagline is distinct from old.tagline or new.description is distinct from old.description)
     and not private.is_content_staff(auth.uid()) then
    raise exception 'official communities keep IRLY''s texts' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.official_texts_guard() from public, anon, authenticated;
drop trigger if exists communities_official_texts_guard on public.communities;
create trigger communities_official_texts_guard before update of name, tagline, description on public.communities
for each row execute function private.official_texts_guard();
