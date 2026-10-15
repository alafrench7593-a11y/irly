-- Account purge (migration 20261020001400_irly_account_purge): after an
-- account is deleted every one of the member's stored files is queued for the
-- purge job and nothing else is; kept rows stop pointing at the member; the
-- purge queue is claimed safely (lease, SKIP LOCKED, bounded retries) and a
-- file is "done" only once it is really gone.
-- Plain PostgreSQL has no storage schema: a stand-in storage.objects is made
-- here and dropped at the end. People here use ids prefixed ad000000-….
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL account_purge: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;

-- The SQLSTATE a statement fails with, or null when it succeeds.
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

create or replace function pg_temp.queued(uid text) returns bigint language sql as $$
  select count(*) from private.storage_cleanup where split_part(name, '/', 1) = uid
$$;

select pg_temp.as_admin();

-- ───── Stand-in storage (bucket + name + created_at, as in Supabase) ─────
create schema if not exists storage;
create table storage.objects (
  bucket_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  primary key (bucket_id, name)
);
alter table auth.users add column if not exists email text;

-- People: Mia (deletes her account), Noa (stays), Ola (deletion interrupted,
-- then retried), Pia (two deletion requests at once), Quinn (deleted by an
-- admin in the dashboard, not through the app).
insert into auth.users (id, email) values
  ('ad000000-0000-0000-0000-0000000000a1', 'Mia.Purge@Example.test'),
  ('ad000000-0000-0000-0000-0000000000a2', 'noa.purge@example.test'),
  ('ad000000-0000-0000-0000-0000000000a3', 'ola.purge@example.test'),
  ('ad000000-0000-0000-0000-0000000000a4', 'pia.purge@example.test'),
  ('ad000000-0000-0000-0000-0000000000a5', 'quinn.purge@example.test');
insert into public.profiles (id, first_name, birthdate, gender, city_id, photo_paths) values
  ('ad000000-0000-0000-0000-0000000000a1', 'Miapurge', '1994-03-03', 'woman', 'dubai', array['ad000000-0000-0000-0000-0000000000a1/face.jpg']),
  ('ad000000-0000-0000-0000-0000000000a2', 'Noapurge', '1990-05-05', 'woman', 'dubai', array['ad000000-0000-0000-0000-0000000000a2/face.jpg']),
  ('ad000000-0000-0000-0000-0000000000a3', 'Olapurge', '1992-07-07', 'woman', 'dubai', '{}'),
  ('ad000000-0000-0000-0000-0000000000a4', 'Piapurge', '1991-09-09', 'woman', 'dubai', '{}'),
  ('ad000000-0000-0000-0000-0000000000a5', 'Quinnpurge', '1989-01-01', 'man', 'dubai', '{}');
insert into public.waitlist (email) values ('mia.purge@example.test'), ('noa.purge@example.test');

-- Files: Mia has some in every bucket (a sub-folder too), Noa has her own,
-- Ola, Pia and Quinn a few each. One more sits in the folder of an account
-- that no longer exists (deleted before the purge existed).
insert into storage.objects (bucket_id, name) values
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000a1/face.jpg'),
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000a1/face.thumb.jpg'),
  ('match-photos', 'ad000000-0000-0000-0000-0000000000a1/m1.jpg'),
  ('irl-media', 'ad000000-0000-0000-0000-0000000000a1/clip1.mp4'),
  ('irl-media', 'ad000000-0000-0000-0000-0000000000a1/clip2.mp4'),
  ('irl-media', 'ad000000-0000-0000-0000-0000000000a1/clip3.mp4'),
  ('activity-photos', 'ad000000-0000-0000-0000-0000000000a1/club-cover.jpg'),
  ('chat-media', 'ad000000-0000-0000-0000-0000000000a1/group-photo.jpg'),
  ('chat-media', 'ad000000-0000-0000-0000-0000000000a1/msg-photo.jpg'),
  ('post-media', 'ad000000-0000-0000-0000-0000000000a1/p1.jpg'),
  ('post-media', 'ad000000-0000-0000-0000-0000000000a1/p2.jpg'),
  ('verifications', 'ad000000-0000-0000-0000-0000000000a1/req.jpg'),
  ('data-exports', 'ad000000-0000-0000-0000-0000000000a1/irly-data.json'),
  ('some-new-bucket', 'ad000000-0000-0000-0000-0000000000a1/deep/er/file.bin'),
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000a2/face.jpg'),
  ('chat-media', 'ad000000-0000-0000-0000-0000000000a2/msg.jpg'),
  ('post-media', 'ad000000-0000-0000-0000-0000000000a2/ad000000-0000-0000-0000-0000000000a1.jpg'),
  ('irl-media', 'ad000000-0000-0000-0000-0000000000a3/o1.mp4'),
  ('irl-media', 'ad000000-0000-0000-0000-0000000000a3/o2.mp4'),
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000a4/face.jpg'),
  ('chat-media', 'ad000000-0000-0000-0000-0000000000a5/q.jpg'),
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg');
-- Noa's exports: one from two days ago, one fresh. Shared files with no member folder.
insert into storage.objects (bucket_id, name, created_at) values
  ('data-exports', 'ad000000-0000-0000-0000-0000000000a2/old-export.json', now() - interval '2 days'),
  ('data-exports', 'ad000000-0000-0000-0000-0000000000a2/new-export.json', now()),
  ('profile-photos', 'shared/brand.png', now() - interval '30 days');

-- Mia's content: several posts, a community she owns (Noa inherits it) with
-- her cover, a group chat with her photo, a photo message, Noa mentioning her,
-- a pin and a channel she made, a reported post (moderators keep the text).
insert into public.irl_posts (id, author_id, city_id, area_id, body, media_path, media_kind) values
  ('ad000000-0000-0000-0000-0000000000b1', 'ad000000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'Mia post one', 'ad000000-0000-0000-0000-0000000000a1/clip1.mp4', 'video'),
  ('ad000000-0000-0000-0000-0000000000b2', 'ad000000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'Mia post two', 'ad000000-0000-0000-0000-0000000000a1/clip2.mp4', 'video'),
  ('ad000000-0000-0000-0000-0000000000b3', 'ad000000-0000-0000-0000-0000000000a1', 'dubai', 'marina', 'Mia post three', 'ad000000-0000-0000-0000-0000000000a1/clip3.mp4', 'video');
insert into public.irl_posts (id, author_id, city_id, area_id, body) values
  ('ad000000-0000-0000-0000-0000000000b4', 'ad000000-0000-0000-0000-0000000000a2', 'dubai', 'marina', 'Noa post');
insert into public.reports (reporter_id, target_user_id, target_kind, target_id, category)
values ('ad000000-0000-0000-0000-0000000000a2', 'ad000000-0000-0000-0000-0000000000a1', 'irl_post', 'ad000000-0000-0000-0000-0000000000b3', 'spam');
insert into public.communities (id, city_id, name, created_by, cover_path) values
  ('ad000000-0000-0000-0000-0000000000f1', 'dubai', 'Mia purge club', 'ad000000-0000-0000-0000-0000000000a1', 'ad000000-0000-0000-0000-0000000000a1/club-cover.jpg');
insert into public.community_members (community_id, user_id, role) values
  ('ad000000-0000-0000-0000-0000000000f1', 'ad000000-0000-0000-0000-0000000000a1', 'owner'),
  ('ad000000-0000-0000-0000-0000000000f1', 'ad000000-0000-0000-0000-0000000000a2', 'member')
on conflict (community_id, user_id) do update set role = excluded.role;
insert into public.community_posts (id, community_id, author_id, body, media_paths, media_kind) values
  ('ad000000-0000-0000-0000-0000000000d1', 'ad000000-0000-0000-0000-0000000000f1', 'ad000000-0000-0000-0000-0000000000a1', 'Mia club post', array['ad000000-0000-0000-0000-0000000000a1/p1.jpg', 'ad000000-0000-0000-0000-0000000000a1/p2.jpg'], 'photo');
insert into public.community_posts (id, community_id, author_id, body) values
  ('ad000000-0000-0000-0000-0000000000d2', 'ad000000-0000-0000-0000-0000000000f1', 'ad000000-0000-0000-0000-0000000000a2', 'Noa club post');
insert into public.community_channels (id, community_id, slug, name, created_by) values
  ('ad000000-0000-0000-0000-0000000000f2', 'ad000000-0000-0000-0000-0000000000f1', 'miachan', 'Mia channel', 'ad000000-0000-0000-0000-0000000000a1');
insert into public.comments (id, target_type, target_id, author_id, body, mentions) values
  ('ad000000-0000-0000-0000-0000000000e1', 'irl_post', 'ad000000-0000-0000-0000-0000000000b4', 'ad000000-0000-0000-0000-0000000000a2', 'Noa says hi to Mia',
   array['ad000000-0000-0000-0000-0000000000a1', 'ad000000-0000-0000-0000-0000000000a3']::uuid[]);
insert into public.conversations (id, kind, title, photo_path) values
  ('ad000000-0000-0000-0000-0000000000c1', 'group', 'Purge group', 'ad000000-0000-0000-0000-0000000000a1/group-photo.jpg');
insert into public.conversation_members (conversation_id, user_id, role) values
  ('ad000000-0000-0000-0000-0000000000c1', 'ad000000-0000-0000-0000-0000000000a1', 'admin'),
  ('ad000000-0000-0000-0000-0000000000c1', 'ad000000-0000-0000-0000-0000000000a2', 'member'),
  ('ad000000-0000-0000-0000-0000000000c1', 'ad000000-0000-0000-0000-0000000000a3', 'member');
insert into public.messages (conversation_id, sender_id, kind, body, media_path) values
  ('ad000000-0000-0000-0000-0000000000c1', 'ad000000-0000-0000-0000-0000000000a1', 'photo', 'Mia photo', 'ad000000-0000-0000-0000-0000000000a1/msg-photo.jpg'),
  ('ad000000-0000-0000-0000-0000000000c1', 'ad000000-0000-0000-0000-0000000000a2', 'text', 'Noa stays in the group', null);
insert into public.push_tokens (user_id, token, platform) values
  ('ad000000-0000-0000-0000-0000000000a2', 'ExponentPushToken[noa-purge]', 'ios');
-- A push copy of a notification from Mia to Noa (its text carries Mia's name).
insert into public.notifications (id, user_id, kind, payload) values
  ('ad000000-0000-0000-0000-00000000aa01', 'ad000000-0000-0000-0000-0000000000a2', 'FRIEND_REQUEST', jsonb_build_object('from', 'ad000000-0000-0000-0000-0000000000a1'));
insert into public.push_outbox (notification_id, user_id, token, title, body)
select 'ad000000-0000-0000-0000-00000000aa01', 'ad000000-0000-0000-0000-0000000000a2', 'ExponentPushToken[noa-purge]', 'Miapurge', 'Miapurge wants to connect'
where not exists (select 1 from public.push_outbox where notification_id = 'ad000000-0000-0000-0000-00000000aa01');

-- ───── Nobody but the job may touch the queue ─────
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select count(*) from private.storage_cleanup$$) = '42501', 'a member cannot read the purge queue');
select pg_temp.check(pg_temp.fails($$select * from private.storage_purge_claim(10, 0)$$) = '42501', 'a member cannot claim purge work');
select pg_temp.check(pg_temp.fails($$select private.storage_purge_done('profile-photos', array['x/y'])$$) = '42501', 'a member cannot mark files purged');
select pg_temp.check(pg_temp.fails($$select private.storage_purge_failed('profile-photos', array['x/y'], 'e')$$) = '42501', 'a member cannot mark files failed');
select pg_temp.check(pg_temp.fails($$select private.queue_member_storage('ad000000-0000-0000-0000-0000000000a1')$$) = '42501', 'a member cannot queue someone else''s files');
select pg_temp.check(pg_temp.fails($$select private.storage_purge_sweep(10)$$) = '42501', 'a member cannot run the sweep');
select pg_temp.as_anon();
select pg_temp.check(pg_temp.fails($$select * from private.storage_purge_claim(10, 0)$$) is not null, 'a visitor cannot claim purge work');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from private.storage_cleanup where split_part(name, '/', 1) like 'ad000000-%') = 0, 'queue starts empty for these people');

-- ───── Normal delete, with files in every bucket and several posts ─────
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
select pg_temp.check(not public.my_account_exists(), 'Mia: deleted');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a1') = 14, 'Mia: every file of hers, in every bucket (sub-folders and unknown buckets too), is queued');
select pg_temp.check((select bool_and(reason = 'account_deleted' and attempts = 0 and done_at is null and flagged_at is null and user_id = 'ad000000-0000-0000-0000-0000000000a1')
  from private.storage_cleanup where split_part(name, '/', 1) = 'ad000000-0000-0000-0000-0000000000a1'), 'Mia: queued as hers, waiting');
select pg_temp.check((select count(distinct bucket_id) from private.storage_cleanup where split_part(name, '/', 1) = 'ad000000-0000-0000-0000-0000000000a1') = 9, 'Mia: all 9 buckets covered');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name like 'ad000000-0000-0000-0000-0000000000a2/%'), 'Noa: none of her files is queued (not even one named after Mia)');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where split_part(name, '/', 1) <> user_id::text), 'queue: every row is in its own member''s folder');
select pg_temp.check(not exists (select 1 from public.irl_posts where author_id is null or id in ('ad000000-0000-0000-0000-0000000000b1', 'ad000000-0000-0000-0000-0000000000b2', 'ad000000-0000-0000-0000-0000000000b3')), 'Mia: her posts are gone');
select pg_temp.check(not exists (select 1 from public.community_posts where id = 'ad000000-0000-0000-0000-0000000000d1'), 'Mia: her community post is gone');
select pg_temp.check(exists (select 1 from private.removed_content where id = 'ad000000-0000-0000-0000-0000000000b3'), 'Mia: the reported post''s text is kept for moderators');
select pg_temp.check((select cover_path is null from public.communities where id = 'ad000000-0000-0000-0000-0000000000f1'), 'kept community: no longer points at Mia''s purged cover');
select pg_temp.check((select role from public.community_members where community_id = 'ad000000-0000-0000-0000-0000000000f1' and user_id = 'ad000000-0000-0000-0000-0000000000a2') = 'owner', 'kept community: passed to Noa');
select pg_temp.check((select photo_path is null from public.conversations where id = 'ad000000-0000-0000-0000-0000000000c1'), 'kept group chat: no longer points at Mia''s purged photo');
select pg_temp.check(exists (select 1 from public.messages where body = 'Noa stays in the group'), 'kept group chat: other members'' messages stay');
select pg_temp.check(not exists (select 1 from public.messages where media_path like 'ad000000-0000-0000-0000-0000000000a1/%'), 'no message points at Mia''s files');
select pg_temp.check((select mentions = array['ad000000-0000-0000-0000-0000000000a3']::uuid[] and body = 'Noa says hi to Mia' from public.comments where id = 'ad000000-0000-0000-0000-0000000000e1'), 'Noa''s comment stays, without Mia''s id in its mentions');
select pg_temp.check((select created_by is null from public.community_channels where id = 'ad000000-0000-0000-0000-0000000000f2'), 'a channel Mia made stays, without her id');
select pg_temp.check(not exists (select 1 from public.push_outbox where notification_id = 'ad000000-0000-0000-0000-00000000aa01'), 'the push copy carrying Mia''s name is gone');
select pg_temp.check(not exists (select 1 from public.waitlist where email = 'mia.purge@example.test'), 'Mia: off the website waitlist');
select pg_temp.check(exists (select 1 from public.waitlist where email = 'noa.purge@example.test'), 'Noa: still on the waitlist');

-- ───── The old session after the deletion ─────
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a1');
select pg_temp.check(public.export_my_data() -> 'profile' = 'null'::jsonb and public.export_my_data() -> 'account' = 'null'::jsonb, 'old session: exports nothing');
select pg_temp.check((select count(*) from public.messages where conversation_id = 'ad000000-0000-0000-0000-0000000000c1') = 0, 'old session: cannot read the group it was in');
select pg_temp.check((select count(*) from public.conversations where id = 'ad000000-0000-0000-0000-0000000000c1') = 0, 'old session: the group is not even visible');
select pg_temp.check(pg_temp.fails($$insert into public.profiles (id, first_name, birthdate, gender, city_id) values (auth.uid(), 'Back', '1994-03-03', 'woman', 'dubai')$$) is not null, 'old session: cannot bring the profile back');
select pg_temp.check(pg_temp.fails($$insert into public.irl_posts (author_id, city_id, area_id, body) values (auth.uid(), 'dubai', 'marina', 'ghost')$$) is not null, 'old session: cannot post');
select pg_temp.check(pg_temp.fails($$select count(*) from private.storage_cleanup$$) = '42501', 'old session: cannot read the purge queue');
select pg_temp.check(pg_temp.fails($$select public.delete_my_account()$$) is null, 'old session: deleting again is a quiet no-op');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a1') = 14, 'the no-op queued nothing more');

-- ───── Another account keeps everything ─────
select pg_temp.check(exists (select 1 from auth.users where id = 'ad000000-0000-0000-0000-0000000000a2') and exists (select 1 from public.profiles where id = 'ad000000-0000-0000-0000-0000000000a2'), 'Noa: account and profile kept');
select pg_temp.check((select count(*) from storage.objects where name like 'ad000000-0000-0000-0000-0000000000a2/%') = 5, 'Noa: all her files kept');
select pg_temp.check(exists (select 1 from public.irl_posts where id = 'ad000000-0000-0000-0000-0000000000b4') and exists (select 1 from public.community_posts where id = 'ad000000-0000-0000-0000-0000000000d2'), 'Noa: her posts kept');
select pg_temp.check(exists (select 1 from public.push_tokens where token = 'ExponentPushToken[noa-purge]'), 'Noa: her phone kept');

-- ───── Interruption mid-deletion, then retry ─────
create or replace function pg_temp.refuse_delete() returns trigger language plpgsql as $$
begin
  raise exception 'simulated outage';
end $$;
create trigger purge_refuse before delete on auth.users for each row execute function pg_temp.refuse_delete();
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a3');
select pg_temp.check(pg_temp.fails($$select public.delete_my_account()$$) is not null, 'Ola: the interrupted deletion reports a failure');
select pg_temp.as_admin();
drop trigger purge_refuse on auth.users;
select pg_temp.check(exists (select 1 from public.profiles where id = 'ad000000-0000-0000-0000-0000000000a3'), 'Ola: nothing half-deleted');
select pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a3') = 0, 'Ola: nothing queued while her account still exists');
select pg_temp.check((select count(*) from public.conversation_members where conversation_id = 'ad000000-0000-0000-0000-0000000000c1' and user_id = 'ad000000-0000-0000-0000-0000000000a3') = 1, 'Ola: still in the group');
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a3');
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from auth.users where id = 'ad000000-0000-0000-0000-0000000000a3'), 'Ola: the retry deletes her account');
select pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a3') = 2, 'Ola: the retry queues her files once');
select pg_temp.check((select mentions = '{}'::uuid[] from public.comments where id = 'ad000000-0000-0000-0000-0000000000e1'), 'Ola: her id leaves the mentions too');

-- ───── Two deletion requests at the same time (a second connection) ─────
-- Needs dblink (shipped with PostgreSQL); skipped with a notice where a second
-- connection cannot be opened.
-- Pia hosts a plan Noa goes to: Noa must hear about it once, not twice.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at) values
  ('ad000000-0000-0000-0000-0000000000e9', 'ad000000-0000-0000-0000-0000000000a4', 'Pia purge brunch', 'food', 'dubai', 'marina', now() + interval '2 days');
insert into public.activity_participants (activity_id, user_id, status) values
  ('ad000000-0000-0000-0000-0000000000e9', 'ad000000-0000-0000-0000-0000000000a2', 'going') on conflict do nothing;
do $$
declare
  ok boolean := false;
  conn text := 'dbname=' || current_database();
  r text;
begin
  begin
    create extension if not exists dblink;
    perform dblink_connect('purge_one', conn);
    perform dblink_connect('purge_two', conn);
    ok := true;
  exception when others then
    raise notice 'skip  concurrent deletion test (no second connection: %)', sqlerrm;
  end;
  if not ok then
    return;
  end if;
  -- Request one runs and holds its transaction open; request two starts meanwhile.
  perform dblink_exec('purge_one', 'begin');
  perform dblink_exec('purge_one', $q$set request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000a4'$q$);
  perform dblink_exec('purge_one', 'set role authenticated');
  perform * from dblink('purge_one', 'select public.delete_my_account()::text') as t(x text);
  perform dblink_exec('purge_two', $q$set request.jwt.claim.sub = 'ad000000-0000-0000-0000-0000000000a4'$q$);
  perform dblink_exec('purge_two', 'set role authenticated');
  perform dblink_send_query('purge_two', 'select ''done'' from (select public.delete_my_account()) x');
  perform pg_sleep(0.3);
  perform pg_temp.check(dblink_is_busy('purge_two') = 1, 'Pia: the second request waits for the first');
  perform dblink_exec('purge_one', 'commit');
  select x into r from dblink_get_result('purge_two') as t(x text);
  perform pg_temp.check(r = 'done', 'Pia: the second request ends quietly, without an error');
  perform * from dblink_get_result('purge_two') as t(x text);
  perform dblink_disconnect('purge_one');
  perform dblink_disconnect('purge_two');
  perform pg_temp.check(not exists (select 1 from auth.users where id = 'ad000000-0000-0000-0000-0000000000a4'), 'Pia: deleted once');
  perform pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a4') = 1, 'Pia: her file queued once');
  perform pg_temp.check((select count(*) from public.notifications where user_id = 'ad000000-0000-0000-0000-0000000000a2' and kind = 'ACTIVITY_UPDATED'
    and payload ->> 'activity_id' = 'ad000000-0000-0000-0000-0000000000e9') = 1, 'Pia: Noa is told about the cancelled plan once');
end $$;
-- Without a second connection, the sequential version of the same thing.
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a4');
select public.delete_my_account();
select public.delete_my_account();
select pg_temp.as_admin();
select pg_temp.check(not exists (select 1 from auth.users where id = 'ad000000-0000-0000-0000-0000000000a4') and pg_temp.queued('ad000000-0000-0000-0000-0000000000a4') = 1, 'Pia: two requests, one deletion, files queued once');

-- ───── Deleted by an admin in the dashboard (not through the app) ─────
delete from auth.users where id = 'ad000000-0000-0000-0000-0000000000a5';
select pg_temp.check(pg_temp.queued('ad000000-0000-0000-0000-0000000000a5') = 1, 'Quinn: an admin deletion queues the files too');

-- ───── Sweep: leftovers of accounts that no longer exist, old exports ─────
-- A folder named after a uuid that was never a deleted account (an activity,
-- a community, imported files) is never swept: only recorded deletions count.
select pg_temp.check(private.storage_purge_sweep(500) = 1, 'sweep: an unknown uuid folder is left alone (only the old export is queued)');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg'), 'sweep: a folder that is not a recorded deleted account is never queued');
-- The same folder once its account is known to have been deleted (e.g. a file
-- uploaded with a token that had not expired yet) is queued.
insert into private.deleted_members (user_id) values ('ad000000-0000-0000-0000-0000000000ff');
select pg_temp.check(private.storage_purge_sweep(500) = 1, 'sweep: finds the leftover folder of a recorded deleted account');
select pg_temp.check((select reason from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg') = 'orphan', 'sweep: a file of an account that no longer exists is queued');
select pg_temp.check((select reason from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000a2/old-export.json') = 'export_expired', 'sweep: an export older than a day is queued');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where name in ('ad000000-0000-0000-0000-0000000000a2/new-export.json', 'ad000000-0000-0000-0000-0000000000a2/face.jpg', 'shared/brand.png')), 'sweep: a fresh export, a living member''s photo and shared files are left alone');
select pg_temp.check(private.storage_purge_sweep(500) = 0, 'sweep: running it again adds nothing');

-- Ownership is checked again when work is handed out: a row that is not in
-- its member's folder, or whose member still exists, is never claimed.
insert into private.storage_cleanup (bucket_id, name, user_id, reason) values
  ('profile-photos', 'ad000000-0000-0000-0000-0000000000a2/face.jpg', 'ad000000-0000-0000-0000-0000000000a1', 'account_deleted'),
  ('chat-media', 'ad000000-0000-0000-0000-0000000000a2/msg.jpg', 'ad000000-0000-0000-0000-0000000000a2', 'account_deleted');

-- ───── Claiming work: lease, attempts, two workers ─────
create temp table batch1 as select * from private.storage_purge_claim(10, 900);
select pg_temp.check((select count(*) from batch1) = 10, 'claim: a batch of 10');
select pg_temp.check(not exists (select 1 from batch1 where name like 'ad000000-0000-0000-0000-0000000000a2/face.jpg' or name = 'ad000000-0000-0000-0000-0000000000a2/msg.jpg'), 'claim: never hands out a living member''s file');
select pg_temp.check((select flagged_at is not null and last_error = 'not in the member''s own folder' from private.storage_cleanup where bucket_id = 'profile-photos' and name = 'ad000000-0000-0000-0000-0000000000a2/face.jpg'), 'claim: a row outside its member''s folder is flagged');
select pg_temp.check((select flagged_at is null and done_at is null and claimed_at is null from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000a2/msg.jpg'), 'claim: a row whose member still exists just waits');
select pg_temp.check((select bool_and(attempts = 1 and claimed_at is not null) from private.storage_cleanup q join batch1 b using (bucket_id, name)), 'claim: each claimed row counts one attempt and has a lease');
create temp table batch2 as select * from private.storage_purge_claim(100, 900);
select pg_temp.check(not exists (select 1 from batch1 join batch2 using (bucket_id, name)), 'claim: a second worker never gets the same files');
select pg_temp.check((select count(*) from batch2) = (select count(*) from private.storage_cleanup where done_at is null and flagged_at is null and (user_id <> 'ad000000-0000-0000-0000-0000000000a2' or reason = 'export_expired')) - 10, 'claim: the second worker gets the rest');
select pg_temp.check(not exists (select 1 from private.storage_purge_claim(100, 900)), 'claim: nothing left while the leases run');

-- Two workers at once (second connection): SKIP LOCKED, never the same row.
update private.storage_cleanup set claimed_at = null where done_at is null and flagged_at is null;
do $$
declare
  conn text := 'dbname=' || current_database();
  n_one integer;
  n_two integer;
  overlap integer;
begin
  begin
    perform dblink_connect('claim_one', conn);
  exception when others then
    raise notice 'skip  concurrent claim test (no second connection: %)', sqlerrm;
    return;
  end;
  perform dblink_exec('claim_one', 'begin');
  create temp table claim_one_rows as
    select * from dblink('claim_one', 'select bucket_id, name from private.storage_purge_claim(5, 900)') as t(bucket_id text, name text);
  -- Worker one has not committed: its rows are locked and skipped here.
  create temp table claim_two_rows as select * from private.storage_purge_claim(1000, 900);
  perform dblink_exec('claim_one', 'commit');
  perform dblink_disconnect('claim_one');
  select count(*) into n_one from claim_one_rows;
  select count(*) into n_two from claim_two_rows;
  select count(*) into overlap from claim_one_rows join claim_two_rows using (bucket_id, name);
  perform pg_temp.check(n_one = 5 and n_two > 0 and overlap = 0, 'claim: two workers at the same moment get different files');
  drop table claim_one_rows;
  drop table claim_two_rows;
end $$;

-- ───── A crash mid-batch, then the next run resumes ─────
-- The job claimed everything, deleted some files in storage, then died
-- before saying so. When the lease runs out the rows are handed out again.
update private.storage_cleanup set claimed_at = now(), attempts = 1 where done_at is null and flagged_at is null and (user_id <> 'ad000000-0000-0000-0000-0000000000a2' or reason = 'export_expired');
delete from storage.objects where bucket_id = 'irl-media' and name like 'ad000000-0000-0000-0000-0000000000a1/%';
update private.storage_cleanup set claimed_at = now() - interval '20 minutes' where done_at is null;
create temp table resumed as select * from private.storage_purge_claim(1000, 900);
select pg_temp.check((select count(*) from resumed where bucket_id = 'irl-media' and name like 'ad000000-0000-0000-0000-0000000000a1/%') = 3, 'crash: the files of the interrupted batch are handed out again');
select pg_temp.check((select bool_and(attempts = 2) from private.storage_cleanup q join resumed using (bucket_id, name)), 'crash: the retry counts as a second attempt');
-- "Not found" in storage (deleted before the crash) is done.
select pg_temp.check(private.storage_purge_done('irl-media', array(select name from resumed where bucket_id = 'irl-media' and name like 'ad000000-0000-0000-0000-0000000000a1/%')) = '{"done": 3, "still_stored": 0}'::jsonb, 'crash: files already gone are marked done');

-- ───── Storage answers 500, then the retry works ─────
select pg_temp.check(private.storage_purge_failed('profile-photos', array(select name from resumed where bucket_id = 'profile-photos'), 'storage 500 for ad000000-0000-0000-0000-0000000000a1/face.jpg (mia.purge@example.test)') = 4, 'storage 500: recorded as a failure');
select pg_temp.check((select bool_and(last_error = 'storage 500 for <id>/face.jpg <email>' and done_at is null) from private.storage_cleanup where bucket_id = 'profile-photos' and flagged_at is null), 'storage 500: the error kept has no id and no address');
select pg_temp.check(not exists (select 1 from private.storage_purge_claim(1000, 900) where bucket_id = 'profile-photos'), 'storage 500: not retried while the lease runs');
create temp table retry as select * from private.storage_purge_claim(1000, 0);
select pg_temp.check((select count(*) from retry where bucket_id = 'profile-photos') = 4, 'storage 500: retried at the next run');
-- This time the delete works for two files; two are still stored (the API said OK, but they are not gone).
delete from storage.objects where bucket_id = 'profile-photos' and name in ('ad000000-0000-0000-0000-0000000000a1/face.jpg', 'ad000000-0000-0000-0000-0000000000a1/face.thumb.jpg');
select pg_temp.check(private.storage_purge_done('profile-photos', array(select name from retry where bucket_id = 'profile-photos')) = '{"done": 2, "still_stored": 2}'::jsonb, 'done only for files really gone');
select pg_temp.check((select last_error = 'still stored after delete' and done_at is null from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg'), 'a file still stored stays on the list');

-- ───── Bounded retries, then flagged for a person ─────
update private.storage_cleanup set attempts = 4, claimed_at = null where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg';
select pg_temp.check((select count(*) from private.storage_purge_claim(1000, 0) where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg') = 1, 'last attempt handed out');
select pg_temp.check(private.storage_purge_failed('profile-photos', array['ad000000-0000-0000-0000-0000000000ff/ghost.jpg'], 'storage 503') = 1, 'the last attempt fails too');
select pg_temp.check((select flagged_at is not null and attempts = 5 from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg'), 'after 5 failed attempts the file is flagged');
select pg_temp.check(not exists (select 1 from private.storage_purge_claim(1000, 0) where name = 'ad000000-0000-0000-0000-0000000000ff/ghost.jpg'), 'a flagged file is not handed out again');
-- A crash on the last attempt (no answer at all) is flagged too, once its lease runs out.
update private.storage_cleanup set attempts = 5, claimed_at = now() - interval '1 hour' where bucket_id = 'chat-media' and name = 'ad000000-0000-0000-0000-0000000000a5/q.jpg';
select pg_temp.check(not exists (select 1 from private.storage_purge_claim(1000, 900) where name = 'ad000000-0000-0000-0000-0000000000a5/q.jpg'), 'no answer after the last attempt: not handed out again');
select pg_temp.check((select flagged_at is not null and last_error = 'no result after 5 attempts' from private.storage_cleanup where name = 'ad000000-0000-0000-0000-0000000000a5/q.jpg'), 'no answer after the last attempt: flagged');

-- ───── A person requeues the flagged files (the test's many claims used up attempts) ─────
select pg_temp.check(private.storage_purge_requeue() > 0, 'flagged files can be requeued by an admin');
select pg_temp.check((select flagged_at is not null from private.storage_cleanup where bucket_id = 'profile-photos' and name = 'ad000000-0000-0000-0000-0000000000a2/face.jpg'), 'requeue: a row outside its member''s folder stays flagged');
select pg_temp.as_user('ad000000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.fails($$select private.storage_purge_requeue()$$) = '42501', 'a member cannot requeue');
select pg_temp.as_admin();

-- ───── The whole queue is finished: everything of the deleted members is gone ─────
delete from storage.objects o using private.storage_cleanup q
where q.bucket_id = o.bucket_id and q.name = o.name and q.done_at is null and q.flagged_at is null
  and (q.user_id <> 'ad000000-0000-0000-0000-0000000000a2' or q.reason = 'export_expired');
update private.storage_cleanup set claimed_at = null where done_at is null;
do $$
declare
  b record;
begin
  for b in select bucket_id, array_agg(name) as names from private.storage_purge_claim(1000, 0) group by bucket_id loop
    perform private.storage_purge_done(b.bucket_id, b.names);
  end loop;
end $$;
select pg_temp.check(not exists (select 1 from storage.objects where split_part(name, '/', 1) in ('ad000000-0000-0000-0000-0000000000a1', 'ad000000-0000-0000-0000-0000000000a3', 'ad000000-0000-0000-0000-0000000000a4')), 'end: no file of Mia, Ola or Pia is left');
select pg_temp.check((select count(*) from storage.objects where name like 'ad000000-0000-0000-0000-0000000000a2/%') = 4, 'end: Noa keeps all her files but the expired export');
select pg_temp.check(exists (select 1 from storage.objects where name = 'shared/brand.png'), 'end: shared files untouched');
select pg_temp.check((private.storage_purge_status() ->> 'flagged')::int = 1 and (private.storage_purge_status() ->> 'waiting')::int = 1, 'status: counts only (the planted row flagged, the one for a living member waiting)');
select pg_temp.check(private.storage_purge_status()::text !~ 'ad000000', 'status: no ids, no names');

-- Clean up: plain PostgreSQL again for the next test files.
delete from private.storage_cleanup where split_part(name, '/', 1) like 'ad000000-%';
drop table storage.objects;
drop schema storage;
alter table auth.users drop column email;

do $$ begin raise notice 'ok  account purge: every file of a deleted member queued, nobody else''s; claims safe; done only when gone'; end $$;
