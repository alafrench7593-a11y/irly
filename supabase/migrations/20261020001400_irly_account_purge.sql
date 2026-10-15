-- Account purge: after an account is deleted, nothing of the member stays in
-- storage, and nothing points at their files from the rows that are kept.
-- Additive only: no table or column is dropped, RLS stays on everywhere and
-- no access is widened (every new function is private and admin-only).
--
-- The database cannot remove stored files itself (Supabase refuses deleting
-- storage.objects rows in SQL): files go through the Storage API with a
-- server key. This migration gives that job (scripts/storage-purge.mjs, run
-- by .github/workflows/storage-purge.yml) a safe queue:
--
-- 1. private.storage_cleanup gains a status: reason, attempts, last_error
--    (never a name or an id), claimed_at (a lease), done_at, flagged_at.
-- 2. private.queue_member_storage(): every object, in every bucket, in the
--    member's own folder ("<their id>/…"), is queued. Only that folder: the
--    upload rules make every member write into their own folder only.
-- 3. delete_my_account() (same body as in 20261020000900, kept whole) now
--    serializes two calls for the same account (the second one waits, then
--    finds the account gone and does nothing), queues every file of the
--    member, drops the push copies of the notifications it deletes, and
--    takes the member's address off the website waitlist.
-- 4. When a profile goes with its sign-in account (delete_my_account, or an
--    admin deleting the user in the dashboard), a trigger queues the files
--    and clears what kept rows still say about the member: a community cover
--    or group chat photo stored in their folder, their photo messages, their
--    id in other people's mentions, pins and channels.
-- 5. The purge job's functions (claim a batch with FOR UPDATE SKIP LOCKED and
--    a lease, mark done only once the object is really gone, mark failed with
--    bounded retries then flagged for a person), a sweep for leftovers
--    (files in the folder of an account that no longer exists, data exports
--    older than a day) and a status made of counts only.

-- ───────── 1. the queue gets a status ─────────
alter table private.storage_cleanup
  add column if not exists reason text not null default 'account_deleted',
  add column if not exists attempts integer not null default 0,
  add column if not exists last_error text,
  add column if not exists claimed_at timestamptz,
  add column if not exists done_at timestamptz,
  add column if not exists flagged_at timestamptz;
do $$ begin
  alter table private.storage_cleanup add constraint storage_cleanup_reason_check
    check (reason in ('account_deleted', 'orphan', 'export_expired'));
exception when duplicate_object then null;
end $$;
do $$ begin
  alter table private.storage_cleanup add constraint storage_cleanup_error_short
    check (last_error is null or char_length(last_error) <= 200);
exception when duplicate_object then null;
end $$;
create index if not exists storage_cleanup_pending on private.storage_cleanup (queued_at)
  where done_at is null and flagged_at is null;
alter table private.storage_cleanup enable row level security;
revoke all on private.storage_cleanup from public, anon, authenticated;

-- How many times a file is tried before a person has to look at it.
create or replace function private.storage_purge_max_attempts() returns integer
language sql immutable as $$ select 5 $$;

-- An error kept on the queue: short, and without ids, names or addresses.
create or replace function private.storage_purge_error(p text) returns text
language sql immutable as $$
  select left(regexp_replace(regexp_replace(coalesce(p, 'unknown error'),
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '<id>', 'g'),
    '[^[:space:]]+@[^[:space:]]+', '<email>', 'g'), 200)
$$;

-- ───────── 2. every file in the member's own folder, in every bucket ─────────
create or replace function private.queue_member_storage(p_user uuid, p_reason text default 'account_deleted')
returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  n integer := 0;
begin
  if p_user is null or to_regclass('storage.objects') is null then
    return 0;
  end if;
  -- A file purged earlier that is back (uploaded again with a token that had
  -- not expired yet) is queued again; a file waiting or flagged stays as is.
  execute $q$
    insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
    select o.bucket_id, o.name, $1, $2 from storage.objects o
    where split_part(o.name, '/', 1) = $1::text
    on conflict (bucket_id, name) do update
      set done_at = null, attempts = 0, last_error = null, claimed_at = null, queued_at = now(), reason = excluded.reason
      where q.done_at is not null and q.user_id = excluded.user_id
  $q$ using p_user, p_reason;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.queue_member_storage(uuid, text) from public, anon, authenticated;

-- ───────── 3. delete_my_account: everything as before, plus the above ─────────
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

-- ───────── 4. what kept rows still say about a deleted member ─────────
-- Runs when the profile goes and its sign-in account is gone too (never for
-- an account that still exists). Each step is on its own: one that fails is
-- logged and never keeps the account; the purge sweep still finds the files.
create or replace function private.forget_member(p_user uuid) returns void
language plpgsql security definer set search_path = public, private as $$
declare
  folder text := p_user::text;
begin
  if p_user is null or exists (select 1 from auth.users where id = p_user) then
    return;
  end if;
  begin
    perform private.queue_member_storage(p_user, 'account_deleted');
  exception when others then
    raise warning 'forget_member: storage files not queued (%)', sqlstate;
  end;
  -- A community that lives on (handed to another member) or a group chat that
  -- continues: their photo was the member's file, which is purged.
  begin
    update public.communities set cover_path = null where split_part(cover_path, '/', 1) = folder;
    update public.conversations set photo_path = null where split_part(photo_path, '/', 1) = folder;
  exception when others then
    raise warning 'forget_member: covers not cleared (%)', sqlstate;
  end;
  -- Their photo messages (left behind only when the account was deleted
  -- without delete_my_account): the photo is purged, the message goes too.
  begin
    delete from public.messages where split_part(media_path, '/', 1) = folder;
  exception when others then
    raise warning 'forget_member: photo messages not removed (%)', sqlstate;
  end;
  -- Their id in other people's rows: mentions, pins, channels, geocoding spend.
  begin
    update public.comments set mentions = array_remove(mentions, p_user) where mentions @> array[p_user];
    update public.community_activity_pins set pinned_by = null where pinned_by = p_user;
    update public.community_channels set created_by = null where created_by = p_user;
    delete from private.geo_spend where creator_id = p_user;
  exception when others then
    raise warning 'forget_member: references not cleared (%)', sqlstate;
  end;
end $$;
revoke all on function private.forget_member(uuid) from public, anon, authenticated;

-- Accounts known to be deleted: the only folders the orphan sweep may empty.
-- A folder named after any other uuid (an activity, a community, imported or
-- seeded files) is never treated as a deleted member's leftovers.
create table if not exists private.deleted_members (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);
revoke all on private.deleted_members from public, anon, authenticated;

create or replace function private.on_profile_deleted() returns trigger
language plpgsql security definer set search_path = public, private as $$
begin
  if not exists (select 1 from auth.users where id = old.id) then
    insert into private.deleted_members (user_id) values (old.id) on conflict (user_id) do nothing;
    perform private.forget_member(old.id);
  end if;
  return null;
end $$;
revoke all on function private.on_profile_deleted() from public, anon, authenticated;
drop trigger if exists profiles_forget_member on public.profiles;
create trigger profiles_forget_member after delete on public.profiles
for each row execute function private.on_profile_deleted();

-- ───────── 5. the purge job (admin only: Management API / service role) ─────────
-- Leftovers the deletion could not see: files in the folder of an account
-- that no longer exists (an account deleted before this migration, or a file
-- uploaded with a token that had not expired yet), and data exports older
-- than a day (the download link lasts 10 minutes). Old finished rows go.
create or replace function private.storage_purge_sweep(p_limit integer default 500) returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  n integer := 0;
  m integer := 0;
  lim integer := greatest(1, least(coalesce(p_limit, 500), 5000));
  app_buckets text[] := array['profile-photos', 'match-photos', 'irl-media', 'activity-photos', 'chat-media', 'post-media', 'verifications', 'data-exports'];
  uuid_re text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  delete from private.storage_cleanup where done_at < now() - interval '30 days';
  if to_regclass('storage.objects') is null then
    return 0;
  end if;
  execute $q$
    insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
    select o.bucket_id, o.name, split_part(o.name, '/', 1)::uuid, 'orphan'
    from storage.objects o
    where o.bucket_id = any($1)
      and split_part(o.name, '/', 1) ~ $2
      and not exists (select 1 from auth.users u where u.id::text = split_part(o.name, '/', 1))
      and exists (select 1 from private.deleted_members d where d.user_id::text = split_part(o.name, '/', 1))
      and not exists (select 1 from private.storage_cleanup p where p.bucket_id = o.bucket_id and p.name = o.name and p.done_at is null)
    limit $3
    on conflict (bucket_id, name) do update
      set done_at = null, attempts = 0, last_error = null, claimed_at = null, queued_at = now(), reason = excluded.reason
      where q.done_at is not null and q.user_id = excluded.user_id
  $q$ using app_buckets, uuid_re, lim;
  get diagnostics n = row_count;
  begin
    execute $q$
      insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
      select o.bucket_id, o.name, split_part(o.name, '/', 1)::uuid, 'export_expired'
      from storage.objects o
      where o.bucket_id = 'data-exports'
        and split_part(o.name, '/', 1) ~ $1
        and o.created_at < now() - interval '1 day'
        and not exists (select 1 from private.storage_cleanup p where p.bucket_id = o.bucket_id and p.name = o.name and p.done_at is null)
      limit $2
      on conflict (bucket_id, name) do update
        set done_at = null, attempts = 0, last_error = null, claimed_at = null, queued_at = now(), reason = excluded.reason
        where q.done_at is not null and q.user_id = excluded.user_id
    $q$ using uuid_re, lim;
    get diagnostics m = row_count;
  exception when undefined_column then
    m := 0;
  end;
  return n + m;
end $$;
revoke all on function private.storage_purge_sweep(integer) from public, anon, authenticated;

-- A batch for one run: rows nobody else holds (SKIP LOCKED) and whose lease
-- has run out, each one counted as an attempt. Ownership is checked here,
-- every time: the file is in the folder named after the queued member, and
-- that member no longer exists (an expired export: its own owner's folder in
-- data-exports). A row that fails the check is flagged, never handed out.
create or replace function private.storage_purge_claim(p_limit integer default 200, p_lease_seconds integer default 900)
returns table (bucket_id text, name text)
language sql security definer set search_path = public, private as $$
  update private.storage_cleanup q
    set flagged_at = now(), claimed_at = null,
        last_error = coalesce(q.last_error, 'no result after ' || q.attempts || ' attempts')
  where q.done_at is null and q.flagged_at is null and q.attempts >= private.storage_purge_max_attempts()
    and (q.claimed_at is null or q.claimed_at < now() - make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 0)));
  update private.storage_cleanup q
    set flagged_at = now(), last_error = 'not in the member''s own folder'
  where q.done_at is null and q.flagged_at is null and split_part(q.name, '/', 1) <> q.user_id::text;
  with c as (
    select q.bucket_id, q.name from private.storage_cleanup q
    where q.done_at is null and q.flagged_at is null
      and q.attempts < private.storage_purge_max_attempts()
      and (q.claimed_at is null or q.claimed_at < now() - make_interval(secs => greatest(coalesce(p_lease_seconds, 900), 0)))
      and split_part(q.name, '/', 1) = q.user_id::text
      and case when q.reason = 'export_expired' then q.bucket_id = 'data-exports'
               else not exists (select 1 from auth.users u where u.id = q.user_id) end
    order by q.queued_at, q.bucket_id, q.name
    limit greatest(1, least(coalesce(p_limit, 200), 1000))
    for update of q skip locked
  )
  update private.storage_cleanup q
    set claimed_at = now(), attempts = q.attempts + 1
  from c
  where q.bucket_id = c.bucket_id and q.name = c.name
  returning q.bucket_id, q.name;
$$;
revoke all on function private.storage_purge_claim(integer, integer) from public, anon, authenticated;

-- A failure: kept with a short error (no names, no ids). The lease stays, so
-- the file is tried again at a later run; after the last attempt it is
-- flagged for a person. Returns how many rows were updated.
create or replace function private.storage_purge_failed(p_bucket text, p_names text[], p_error text)
returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  n integer;
begin
  update private.storage_cleanup q
    set last_error = private.storage_purge_error(p_error),
        flagged_at = case when q.attempts >= private.storage_purge_max_attempts() then now() end
  where q.bucket_id = p_bucket and q.name = any(coalesce(p_names, '{}')) and q.done_at is null and q.flagged_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.storage_purge_failed(text, text[], text) from public, anon, authenticated;

-- Done, but only for files that are really gone from storage: a file the
-- Storage API answered "not found" for is gone too; a file still stored is
-- a failure (tried again later). Returns {"done": n, "still_stored": m}.
create or replace function private.storage_purge_done(p_bucket text, p_names text[])
returns jsonb
language plpgsql security definer set search_path = public, private as $$
declare
  still text[] := '{}';
  n integer;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select coalesce(array_agg(o.name), ''{}'') from storage.objects o where o.bucket_id = $1 and o.name = any($2)'
      into still using p_bucket, coalesce(p_names, '{}');
  end if;
  update private.storage_cleanup q
    set done_at = now(), claimed_at = null, last_error = null
  where q.bucket_id = p_bucket and q.name = any(coalesce(p_names, '{}')) and not (q.name = any(still)) and q.done_at is null;
  get diagnostics n = row_count;
  if cardinality(still) > 0 then
    perform private.storage_purge_failed(p_bucket, still, 'still stored after delete');
  end if;
  return jsonb_build_object('done', n, 'still_stored', cardinality(still));
end $$;
revoke all on function private.storage_purge_done(text, text[]) from public, anon, authenticated;

-- After a person has looked into the flagged files (an outage, a key that
-- had expired): they, and files that used their last attempt, go back on the
-- list with fresh attempts. Rows outside their member's folder stay flagged.
-- Deleting twice is harmless (done is checked against storage). Returns how
-- many were requeued.
create or replace function private.storage_purge_requeue() returns integer
language plpgsql security definer set search_path = public, private as $$
declare
  n integer;
begin
  update private.storage_cleanup q
    set flagged_at = null, attempts = 0, last_error = null, claimed_at = null
  where q.done_at is null and (q.flagged_at is not null or q.attempts >= private.storage_purge_max_attempts())
    and split_part(q.name, '/', 1) = q.user_id::text;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.storage_purge_requeue() from public, anon, authenticated;

-- What the job logs: counts only (no file names, no member ids).
create or replace function private.storage_purge_status() returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'waiting', count(*) filter (where done_at is null and flagged_at is null and claimed_at is null),
    'in_progress', count(*) filter (where done_at is null and flagged_at is null and claimed_at is not null),
    'done', count(*) filter (where done_at is not null),
    'flagged', count(*) filter (where flagged_at is not null and done_at is null),
    'oldest_waiting_minutes', coalesce(floor(extract(epoch from now() - min(queued_at) filter (where done_at is null and flagged_at is null)) / 60), 0)
  ) from private.storage_cleanup
$$;
revoke all on function private.storage_purge_status() from public, anon, authenticated;
