-- Account lifecycle: deleting an account is verified and safe to retry, and
-- "Download my data" produces a real file on phones.
-- Additive only: RLS stays on everywhere, nothing is dropped, no access is widened.
--
-- 1. delete_my_account() checks, inside its own transaction, that the auth user
--    is gone before it returns (a success therefore means "deleted"), never
--    waits on a lock forever, and queues for cleanup any of the member's storage
--    files the app could not remove (so a file the member may not delete can
--    no longer block, or loop, the deletion). Calling it again after a partial
--    failure is safe: the transaction is all or nothing, and a second call on a
--    deleted account does nothing.
-- 2. my_account_exists(): lets the app confirm the deletion from the server.
-- 3. export_my_data() also covers the member's verification requests, hidden
--    messages, skipped people, community notification settings and IRLY Girl
--    onboarding (only their own rows, as before).
-- 4. A private "data-exports" bucket: the phone stores the export in the
--    member's own folder and opens a short-lived download link, so iOS and
--    Android save a real .json file (no native file module needed).

-- ───────── 1. storage files left behind (admin cleanup queue) ─────────
create table if not exists private.storage_cleanup (
  bucket_id text not null,
  name text not null,
  user_id uuid not null,
  queued_at timestamptz not null default now(),
  primary key (bucket_id, name)
);
alter table private.storage_cleanup enable row level security;
revoke all on private.storage_cleanup from public, anon, authenticated;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, private
-- A row locked by another transaction makes the call fail clearly (and the app
-- offers a retry) instead of waiting until the request is cut.
set lock_timeout = '10s'
as $$
declare
  me uuid := auth.uid();
  goer record;
  g record;
begin
  if me is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  -- Files the app could not delete (the database never deletes stored files
  -- itself): kept on a list for the team to purge, never left untracked.
  if to_regclass('storage.objects') is not null then
    begin
      execute 'insert into private.storage_cleanup (bucket_id, name, user_id)
               select o.bucket_id, o.name, $1 from storage.objects o
               where split_part(o.name, ''/'', 1) = $1::text
               on conflict do nothing' using me;
    exception when others then
      -- Never a reason to keep the account.
      null;
    end;
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
  -- The sign-in account itself (its sessions go with it): every row of the
  -- member's that references the profile cascades from here.
  delete from auth.users where id = me;
  -- Verified before answering: a success always means the account is gone.
  if exists (select 1 from auth.users where id = me) or exists (select 1 from public.profiles where id = me) then
    raise exception 'account still exists' using errcode = 'P0001';
  end if;
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ───────── 2. the app confirms the deletion ─────────
-- Only the caller's own account; a signed-out caller is refused, so "false"
-- always means "this signed-in account no longer exists".
create or replace function public.my_account_exists() returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'sign in required' using errcode = '42501';
  end if;
  return exists (select 1 from auth.users where id = auth.uid());
end $$;
revoke all on function public.my_account_exists() from public, anon;
grant execute on function public.my_account_exists() to authenticated;

-- ───────── 3. "Download my data": the member's own rows only ─────────
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
    'irly_girl_onboarding', (select to_jsonb(x) - 'user_id' from public.irly_match_onboarding x where x.user_id = me),
    'privacy_settings', (select to_jsonb(x) from public.safety_settings x where x.user_id = me),
    'notification_settings', (select to_jsonb(x) from public.notification_prefs x where x.user_id = me),
    'community_notification_settings', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id') from public.community_notification_prefs x where x.user_id = me), '[]'),
    'phones_registered_for_notifications', (select count(*) from public.push_tokens where user_id = me),
    'activities_created', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.activities a where a.creator_id = me), '[]'),
    'activities_joined', coalesce((select jsonb_agg(jsonb_build_object('activity_id', x.activity_id, 'status', x.status)) from public.activity_participants x where x.user_id = me), '[]'),
    'communities', coalesce((select jsonb_agg(jsonb_build_object('community_id', x.community_id, 'role', x.role, 'joined_at', x.joined_at)) from public.community_members x where x.user_id = me), '[]'),
    'community_posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'community_id', x.community_id, 'body', x.body, 'created_at', x.created_at)) from public.community_posts x where x.author_id = me), '[]'),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'target_type', x.target_type, 'target_id', x.target_id, 'body', x.body, 'created_at', x.created_at)) from public.comments x where x.author_id = me), '[]'),
    'irl_posts', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'body', x.body, 'area_id', x.area_id, 'media_path', x.media_path, 'created_at', x.created_at)) from public.irl_posts x where x.author_id = me), '[]'),
    'messages_sent', coalesce((select jsonb_agg(jsonb_build_object('conversation_id', x.conversation_id, 'body', x.body, 'photo', x.media_path, 'created_at', x.created_at) order by x.created_at) from public.messages x where x.sender_id = me and x.deleted_at is null), '[]'),
    'messages_hidden_for_me', coalesce((select jsonb_agg(jsonb_build_object('message_id', x.message_id, 'at', x.created_at)) from public.message_hides x where x.user_id = me), '[]'),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('with', case when f.user_a = me then f.user_b else f.user_a end, 'status', f.status, 'since', coalesce(f.accepted_at, f.created_at))) from public.friendships f where me in (f.user_a, f.user_b)), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('user_id', b.blocked_id, 'at', b.created_at)) from public.blocks b where b.blocker_id = me), '[]'),
    'people_skipped', coalesce((select jsonb_agg(jsonb_build_object('user_id', x.other_id, 'until', x.until)) from public.people_match_skips x where x.user_id = me), '[]'),
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
    'verification_requests', coalesce((select jsonb_agg(to_jsonb(x) - 'user_id' - 'reviewer_id' order by x.created_at) from public.verification_requests x where x.user_id = me), '[]'),
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

-- ───────── 4. the export file, in the member's own private folder ─────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('data-exports', 'data-exports', false, 52428800, array['application/json'])
    on conflict (id) do nothing;
    execute 'drop policy if exists data_exports_write on storage.objects';
    execute $p$
      create policy data_exports_write on storage.objects for insert to authenticated
      with check (bucket_id = 'data-exports' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists data_exports_read on storage.objects';
    execute $p$
      create policy data_exports_read on storage.objects for select to authenticated
      using (bucket_id = 'data-exports' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists data_exports_delete on storage.objects';
    execute $p$
      create policy data_exports_delete on storage.objects for delete to authenticated
      using (bucket_id = 'data-exports' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;
