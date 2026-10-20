-- Content its author removed (or a moderator took down) is gone everywhere.
-- Additive: no table or column dropped, no policy loosened.
--
-- 1. A Live that ends early (a moderator's takedown, three reports: both set
--    expires_at to now) loses its likes, saves, shares, hidden marks and
--    comments, as a deleted one already did. Until now only a DELETE purged
--    them: the takedown left them behind (a « Saved post » that opened
--    nothing, comments kept on a removed Live).
-- 2. A share in a chat of something that is gone (a deleted or ended Live, a
--    removed post, comment or community, a deleted activity) no longer
--    carries its words: the message reads « This is no longer available »
--    (the app shows it translated, and no longer opens it). Before, the chat
--    kept the first 60 characters of the removed Live or post.
-- 3. An edit reaches the notifications that quote the text: a friend's
--    « is live » notice, a community post's notice, a comment's notice show
--    the new words, not the ones the author took back.
-- 4. Moderators keep what was reported: a reported Live deleted by its author
--    (or a reported text edited after the report) keeps its reported words in
--    private.removed_content (staff only, 12 months, as for accounts), and
--    mod_case shows them: a case on a deleted Live or comment no longer comes
--    back empty (with a « remove » button that removed nothing).
-- 5. Nothing new can be attached to a removed post or comment: likes, saves,
--    shares and comments need it to be on (private.can_see), also for its
--    author.

-- ───────── 1. A Live that ends early takes its reactions with it ─────────
create or replace function private.purge_reactions() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t text := case tg_table_name when 'activities' then 'activity' when 'community_posts' then 'community_post'
                               when 'irl_posts' then 'irl_post' when 'comments' then 'comment' else 'community' end;
  i text := old.id::text;
begin
  if tg_op = 'UPDATE' then
    -- A Live ends when its expires_at is reached (set to now by a takedown); the rest is removed with deleted_at.
    if tg_table_name = 'irl_posts' then
      if (to_jsonb(new) ->> 'expires_at')::timestamptz > now() then return null; end if;
    elsif (to_jsonb(new) ->> 'deleted_at') is null then
      return null;
    end if;
  end if;
  delete from public.likes where target_type = t and target_id = i;
  delete from public.saves where target_type = t and target_id = i;
  delete from public.shares where target_type = t and target_id = i;
  delete from public.hidden_items where target_type = t and target_id = i;
  if t <> 'comment' then
    delete from public.comments where target_type = t and target_id = i;
  end if;
  return null;
end $$;
revoke all on function private.purge_reactions() from public, anon, authenticated;
drop trigger if exists irl_posts_purge_reactions on public.irl_posts;
create trigger irl_posts_purge_reactions after delete or update of expires_at on public.irl_posts
  for each row execute function private.purge_reactions();

-- ───────── 2. A share of something gone says so ─────────
-- The words of a share message the app shows for removed content (and translates).
create or replace function private.gone_share_body() returns text
language sql immutable as $$ select 'This is no longer available'::text $$;

create index if not exists messages_share_ref_idx on public.messages (ref_id) where kind = 'share' and ref_id is not null;

create or replace function private.retire_shares() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t text := case tg_table_name when 'irl_posts' then 'irl_post' when 'community_posts' then 'community_post'
                               when 'comments' then 'comment' when 'communities' then 'community' else 'activity' end;
begin
  if tg_op = 'UPDATE' then
    if tg_table_name = 'irl_posts' then
      if (to_jsonb(new) ->> 'expires_at')::timestamptz > now() then return null; end if;
    elsif (to_jsonb(new) ->> 'deleted_at') is null then
      return null;
    end if;
  end if;
  -- (A message removed by its sender stays as it is: nobody else sees it.)
  update public.messages set body = private.gone_share_body()
  where kind = 'share' and ref_id = old.id and ref_type = t and deleted_at is null
    and body is distinct from private.gone_share_body();
  return null;
end $$;
revoke all on function private.retire_shares() from public, anon, authenticated;
revoke all on function private.gone_share_body() from public, anon;

drop trigger if exists irl_posts_retire_shares on public.irl_posts;
create trigger irl_posts_retire_shares after delete or update of expires_at on public.irl_posts
  for each row execute function private.retire_shares();
drop trigger if exists community_posts_retire_shares on public.community_posts;
create trigger community_posts_retire_shares after delete or update of deleted_at on public.community_posts
  for each row execute function private.retire_shares();
drop trigger if exists comments_retire_shares on public.comments;
create trigger comments_retire_shares after delete or update of deleted_at on public.comments
  for each row execute function private.retire_shares();
drop trigger if exists communities_retire_shares on public.communities;
create trigger communities_retire_shares after delete or update of deleted_at on public.communities
  for each row execute function private.retire_shares();
-- A cancelled activity is still there to open (it says so); a deleted one is not.
drop trigger if exists activities_retire_shares on public.activities;
create trigger activities_retire_shares after delete on public.activities
  for each row execute function private.retire_shares();

-- Shares of what is already gone.
update public.messages m set body = private.gone_share_body()
where m.kind = 'share' and m.ref_id is not null and m.deleted_at is null and m.body <> private.gone_share_body()
  and case m.ref_type
    when 'irl_post' then not exists (select 1 from public.irl_posts x where x.id = m.ref_id and x.expires_at > now())
    when 'community_post' then not exists (select 1 from public.community_posts x where x.id = m.ref_id and x.deleted_at is null)
    when 'comment' then not exists (select 1 from public.comments x where x.id = m.ref_id and x.deleted_at is null)
    when 'community' then not exists (select 1 from public.communities x where x.id = m.ref_id and x.deleted_at is null)
    when 'activity' then not exists (select 1 from public.activities x where x.id = m.ref_id)
    else false
  end;

-- ───────── 3 & 4. An edit: notices follow, the reported words are kept ─────────
create or replace function private.on_content_edit() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  t text := case tg_table_name when 'irl_posts' then 'irl_post' when 'community_posts' then 'community_post' else 'comment' end;
begin
  if new.body is not distinct from old.body then return null; end if;
  if tg_table_name <> 'irl_posts' and (to_jsonb(new) ->> 'deleted_at') is not null then return null; end if;
  -- Reported before this edit: moderators keep the words as they were reported (the first ones only).
  if exists (select 1 from public.reports r where r.target_kind = t and r.target_id = old.id) then
    insert into private.removed_content (source, id, body) values (tg_table_name, old.id, old.body)
    on conflict (source, id) do nothing;
  end if;
  if tg_table_name = 'irl_posts' then
    update public.notifications set payload = jsonb_set(payload, '{body}', to_jsonb(left(new.body, 80)))
    where kind = 'IRLY_POST_CREATED' and payload ->> 'post_id' = new.id::text and payload ? 'body';
  elsif tg_table_name = 'community_posts' then
    update public.notifications
    set payload = jsonb_set(payload, '{body}', to_jsonb(left(new.body, case when kind = 'COMMUNITY_ANNOUNCEMENT' then 140 else 80 end)))
    where kind in ('COMMUNITY_POST', 'COMMUNITY_ANNOUNCEMENT') and payload ->> 'post_id' = new.id::text and payload ? 'body';
  else
    update public.notifications set payload = jsonb_set(payload, '{body}', to_jsonb(left(new.body, 80)))
    where kind in ('COMMENT', 'COMMENT_REPLY', 'MENTION') and payload ->> 'comment_id' = new.id::text and payload ? 'body';
  end if;
  return null;
end $$;
revoke all on function private.on_content_edit() from public, anon, authenticated;
drop trigger if exists irl_posts_content_edit on public.irl_posts;
create trigger irl_posts_content_edit after update of body on public.irl_posts
  for each row execute function private.on_content_edit();
drop trigger if exists community_posts_content_edit on public.community_posts;
create trigger community_posts_content_edit after update of body on public.community_posts
  for each row execute function private.on_content_edit();
drop trigger if exists comments_content_edit on public.comments;
create trigger comments_content_edit after update of body on public.comments
  for each row execute function private.on_content_edit();

-- A reported Live deleted by its author: its words stay for the moderators (as when an account goes).
create or replace function private.keep_reported_live() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if exists (select 1 from public.reports r where r.target_kind = 'irl_post' and r.target_id = old.id) then
    insert into private.removed_content (source, id, body)
    values ('irl_posts', old.id, old.body || coalesce(' [media: ' || old.media_path || ']', ''))
    on conflict (source, id) do nothing;
  end if;
  return old;
end $$;
revoke all on function private.keep_reported_live() from public, anon, authenticated;
drop trigger if exists irl_posts_keep_reported on public.irl_posts;
create trigger irl_posts_keep_reported before delete on public.irl_posts
  for each row execute function private.keep_reported_live();

-- The case shows the reported words: from the row, or kept above when the row
-- is gone, emptied (a removed comment reads « — ») or edited since.
create or replace function public.mod_case(p_case uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare m public.moderation_cases; r public.reports; target jsonb; kept text;
begin
  if not private.is_moderator(auth.uid()) then raise exception 'IRLY moderators only' using errcode = '42501'; end if;
  select * into m from public.moderation_cases where id = p_case;
  if m.id is null then raise exception 'no such case' using errcode = '22023'; end if;
  select * into r from public.reports where id = m.report_id;
  select rc.body into kept from private.removed_content rc
  where rc.id = r.target_id and rc.source = case r.target_kind when 'irl_post' then 'irl_posts' when 'comment' then 'comments'
                                                               when 'community_post' then 'community_posts' when 'message' then 'messages' end;
  target := case r.target_kind
    when 'profile' then (select jsonb_build_object('name', first_name, 'bio', bio, 'username', username) from public.profiles where id = r.target_user_id)
    when 'community_post' then (select jsonb_build_object('body', body, 'removed', deleted_at is not null) from public.community_posts where id = r.target_id)
    when 'comment' then (select jsonb_build_object('body', case when deleted_at is not null and kept is not null then kept else body end, 'removed', deleted_at is not null) from public.comments where id = r.target_id)
    when 'irl_post' then (select jsonb_build_object('body', body, 'removed', expires_at <= now()) from public.irl_posts where id = r.target_id)
    when 'activity' then (select jsonb_build_object('title', title, 'removed', cancelled_at is not null) from public.activities where id = r.target_id)
    when 'community' then (select jsonb_build_object('name', name, 'tagline', tagline, 'removed', deleted_at is not null) from public.communities where id = r.target_id)
    when 'message' then jsonb_build_object('private', true)
    else '{}'::jsonb end;
  if r.target_kind in ('irl_post', 'comment', 'community_post') then
    if target is null then
      -- Deleted since the report: what was kept of it, and never a « remove » for nothing.
      target := jsonb_build_object('removed', true) || case when kept is not null then jsonb_build_object('body', kept) else '{}'::jsonb end;
    elsif kept is not null and kept is distinct from target ->> 'body' then
      target := target || jsonb_build_object('reported', kept);
    end if;
  end if;
  return jsonb_build_object(
    'case', to_jsonb(m),
    'report', jsonb_build_object('id', r.id, 'category', r.category, 'details', r.details, 'target_kind', r.target_kind,
      'target_id', r.target_id, 'created_at', r.created_at,
      'reporter', (select jsonb_build_object('id', id, 'name', first_name) from public.profiles where id = r.reporter_id),
      'target_user', (select jsonb_build_object('id', id, 'name', first_name, 'deleted', deleted_at is not null, 'role', private.staff_role(id))
                      from public.profiles where id = r.target_user_id)),
    'target', coalesce(target, '{}'::jsonb),
    'others', (select count(*) from public.reports o where o.target_user_id = r.target_user_id and o.id <> r.id),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('body', n.body, 'at', n.at, 'author', p.first_name) order by n.at)
                       from private.case_notes n left join public.profiles p on p.id = n.author where n.case_id = m.id), '[]'),
    'history', coalesce((select jsonb_agg(jsonb_build_object('action', a.action, 'at', a.at, 'by', p.first_name, 'details', a.details) order by a.at)
                         from private.admin_audit a left join public.profiles p on p.id = a.actor where a.case_id = m.id), '[]'),
    'sanctions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'kind', s.kind, 'reason', s.reason, 'created_at', s.created_at,
                            'ends_at', s.ends_at, 'lifted_at', s.lifted_at) order by s.created_at desc)
                           from public.sanctions s where s.user_id = r.target_user_id), '[]')
  );
end $$;
revoke all on function public.mod_case(uuid) from public, anon;
grant execute on function public.mod_case(uuid) to authenticated;

-- ───────── 5. Nothing new on a removed post or comment ─────────
create or replace function private.can_see(p_type text, p_id text)
returns boolean
language plpgsql stable set search_path = public as $$
begin
  if p_type in ('place', 'catalog') then
    return p_id is not null and char_length(p_id) between 1 and 120;
  end if;
  if not private.is_uuid(p_id) then
    return false;
  end if;
  return case p_type
    when 'irl_post' then exists (select 1 from public.irl_posts where id = p_id::uuid)
    when 'activity' then exists (select 1 from public.activities where id = p_id::uuid)
    when 'community' then exists (select 1 from public.communities where id = p_id::uuid)
    -- Removed: its author (and its moderators) still read it, nobody adds to it.
    when 'community_post' then exists (select 1 from public.community_posts where id = p_id::uuid and deleted_at is null)
    when 'comment' then exists (select 1 from public.comments where id = p_id::uuid and deleted_at is null)
    when 'news' then exists (select 1 from public.news_articles where id = p_id::uuid)
    when 'profile' then exists (select 1 from public.profiles_public where id = p_id::uuid)
      and not private.is_blocked(auth.uid(), p_id::uuid)
      and (p_id::uuid = auth.uid() or private.discoverable(p_id::uuid))
    else false
  end;
end $$;

-- ───────── 6. A notification taken back leaves the bell at once ─────────
-- Realtime cannot hear a DELETE through a filter (user_id=eq.…): a notice
-- purged with its Live, post or comment stayed listed until the bell was
-- read again. Its reader is told through sync_signals (as for unsaves).
alter table public.sync_signals drop constraint if exists sync_signals_kind_check;
alter table public.sync_signals add constraint sync_signals_kind_check
  check (kind in ('activities', 'communities', 'inbox', 'follows', 'friends', 'saved', 'notifs'));

create or replace function private.sync_signal_notif_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- (A chat's message notices are not listed in the bell.)
  if old.kind <> 'MESSAGE_CREATED' then
    perform private.sync_signal(array[old.user_id], 'notifs');
  end if;
  return null;
end $$;
revoke all on function private.sync_signal_notif_gone() from public, anon, authenticated;
drop trigger if exists notifications_sync_signal on public.notifications;
create trigger notifications_sync_signal after delete on public.notifications
  for each row execute function private.sync_signal_notif_gone();
