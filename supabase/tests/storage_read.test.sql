-- Who can read a stored file (the storage read rules of 20261017000100
-- irl_media_read, 20261018000000 post_media_read, 20261009003000
-- chat_media_read, 20261009005200 activity_photos_read, 20261020001000
-- match_photos_read). A post's photo, a Live, a chat photo, a plan's or a community's cover and a
-- Match photo are read only by whoever may read the post, Live, message,
-- plan, community or Match profile that shows it — IRLY Girl access
-- (private.girl_eligible_unchecked), deletion and removal by the team,
-- blocks, chat membership — and by the member who uploaded it (her own
-- folder: the upload comes before the row that shows it).
-- Runs after irly_test.sql on the same database (scripts/test-db.sh).
-- TEST accounts only, ids prefixed ce000000-….
--
--   01 Ama   woman, IRLY Girl access, owns the women-only community and posts
--   02 Bea   woman, IRLY Girl access, member of the women-only community
--   03 Cleo  woman, IRLY Girl access, not a member of it
--   04 Max   man (the attacker)
--   05 Rae   woman whose IRLY Girl access is suspended, left inside
--   06 Liv   woman, member, whose gender staff corrects to « man » mid-test
--   07 Bo    woman, IRLY Girl access, member, blocked by Ama
--   08 Staff an IRLY admin who corrects Liv's gender
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;
select private.restrict_profile_columns();

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claims', '', false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL storage_read: %', label;
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

-- ───────── Accounts and content (set up by the server role) ─────────
select pg_temp.as_admin();
insert into auth.users (id) values
  ('ce000000-0000-0000-0000-000000000001'), ('ce000000-0000-0000-0000-000000000002'), ('ce000000-0000-0000-0000-000000000003'),
  ('ce000000-0000-0000-0000-000000000004'), ('ce000000-0000-0000-0000-000000000005'), ('ce000000-0000-0000-0000-000000000006'),
  ('ce000000-0000-0000-0000-000000000007'), ('ce000000-0000-0000-0000-000000000008');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('ce000000-0000-0000-0000-000000000001', 'Ama', '1994-03-03', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000002', 'Bea', '1993-05-05', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000003', 'Cleo', '1992-06-06', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000004', 'Max', '1992-07-07', 'man', 'dubai'),
  ('ce000000-0000-0000-0000-000000000005', 'Rae', '1991-09-09', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000006', 'Liv', '1995-10-10', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000007', 'Bo', '1996-11-11', 'woman', 'dubai'),
  ('ce000000-0000-0000-0000-000000000008', 'Staff', '1990-01-01', 'man', 'dubai');
insert into public.staff_roles (user_id, role) values ('ce000000-0000-0000-0000-000000000008', 'admin');
insert into public.girl_suspensions (user_id, reason) values ('ce000000-0000-0000-0000-000000000005', 'storage read test');
insert into public.blocks (blocker_id, blocked_id) values ('ce000000-0000-0000-0000-000000000001', 'ce000000-0000-0000-0000-000000000007');

-- A women-only community (Ama owner; Bea, Rae, Liv, Bo inside) and an open one.
insert into public.communities (id, city_id, name, category_id, girl_only, created_by) values
  ('ce000000-0000-0000-0000-0000000000c1', 'dubai', 'Storage Girls Circle', 'girl', true, 'ce000000-0000-0000-0000-000000000001'),
  ('ce000000-0000-0000-0000-0000000000c2', 'dubai', 'Storage Open Club', 'sport', false, 'ce000000-0000-0000-0000-000000000001');
insert into public.community_members (community_id, user_id, role) values
  ('ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000001', 'owner'),
  ('ce000000-0000-0000-0000-0000000000c2', 'ce000000-0000-0000-0000-000000000001', 'owner'),
  ('ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000002', 'member'),
  ('ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000005', 'member'),
  ('ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000006', 'member'),
  ('ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000007', 'member');
-- Posts: one in each community, one Ama deleted, one the team removed.
insert into public.community_posts (id, community_id, author_id, body, media_paths, media_kind) values
  ('ce000000-0000-0000-0000-0000000000d1', 'ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000001', 'Storage: girls brunch', array['ce000000-0000-0000-0000-000000000001/g-post.jpg'], 'photo'),
  ('ce000000-0000-0000-0000-0000000000d2', 'ce000000-0000-0000-0000-0000000000c1', 'ce000000-0000-0000-0000-000000000001', 'Storage: deleted', array['ce000000-0000-0000-0000-000000000001/g-deleted.jpg'], 'photo'),
  ('ce000000-0000-0000-0000-0000000000d3', 'ce000000-0000-0000-0000-0000000000c2', 'ce000000-0000-0000-0000-000000000001', 'Storage: open run', array['ce000000-0000-0000-0000-000000000001/o-post.jpg'], 'photo'),
  ('ce000000-0000-0000-0000-0000000000d4', 'ce000000-0000-0000-0000-0000000000c2', 'ce000000-0000-0000-0000-000000000001', 'Storage: removed', array['ce000000-0000-0000-0000-000000000001/o-removed.jpg'], 'photo');
update public.community_posts set deleted_at = now() where id in ('ce000000-0000-0000-0000-0000000000d2', 'ce000000-0000-0000-0000-0000000000d4');
-- A women-only plan with a cover; the women-only community's cover.
insert into public.activities (id, creator_id, title, category_id, city_id, area_id, starts_at, girl_only, audience) values
  ('ce000000-0000-0000-0000-0000000000b1', 'ce000000-0000-0000-0000-000000000001', 'Storage girls padel', 'sport', 'dubai', 'marina', now() + interval '3 days', true, 'girls');
alter table public.activities disable trigger user;
update public.activities set cover_path = 'ce000000-0000-0000-0000-000000000001/g-plan.jpg' where id = 'ce000000-0000-0000-0000-0000000000b1';
alter table public.activities enable trigger user;
alter table public.communities disable trigger user;
update public.communities set cover_path = 'ce000000-0000-0000-0000-000000000001/g-cover.jpg' where id = 'ce000000-0000-0000-0000-0000000000c1';
alter table public.communities enable trigger user;
-- A photo sent in the women-only community's chat.
select id as gc_chat from public.conversations where community_id = 'ce000000-0000-0000-0000-0000000000c1' \gset
insert into public.messages (id, conversation_id, sender_id, body, kind, media_path) values
  ('ce000000-0000-0000-0000-000000000101', :'gc_chat', 'ce000000-0000-0000-0000-000000000001', 'Photo', 'photo', 'ce000000-0000-0000-0000-000000000001/g-chat.jpg');
-- Ama's Match photo.
insert into public.irly_match_onboarding (user_id) values ('ce000000-0000-0000-0000-000000000001');
insert into public.irly_match_profiles (user_id, visible, goals, photo_paths, destination) values
  ('ce000000-0000-0000-0000-000000000001', true, '{new_friends}', array['ce000000-0000-0000-0000-000000000001/m1.jpg'], 'dubai');
-- Ama's IRLY Girl Live with a photo, and an IRLY Live that has ended.
select pg_temp.as_user('ce000000-0000-0000-0000-000000000001');
select public.post_live('{"id":"ce000000-0000-0000-0000-0000000000f1","city_id":"dubai","area_id":"marina","body":"Storage girl live","visibility":"everyone","scope":"girl","media_path":"ce000000-0000-0000-0000-000000000001/g-live.jpg"}'::jsonb);
select public.post_live('{"id":"ce000000-0000-0000-0000-0000000000f2","city_id":"dubai","area_id":"marina","body":"Storage old live","visibility":"everyone","media_path":"ce000000-0000-0000-0000-000000000001/old-live.jpg"}'::jsonb);
select pg_temp.as_admin();
update public.irl_posts set expires_at = now() - interval '1 minute' where id = 'ce000000-0000-0000-0000-0000000000f2';

-- ───────── Storage, on a stand-in ─────────
-- Plain PostgreSQL has no storage schema, so the migrations skipped their
-- storage policies. A stand-in storage.objects gets the same policies (text
-- copied from the migrations named at the top) inside a transaction that is
-- rolled back. A signed URL is only issued for an object its reader may
-- select. The rules hold because each EXISTS reads the post, Live, message,
-- plan, community or chat under the reader's own row-level security: the
-- table's read rule (IRLY Girl access, blocks, deletion, membership) decides.
begin;
create schema storage;
create table storage.objects (bucket_id text, name text, owner uuid);
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)]
$$;
grant usage on schema storage to anon, authenticated;
grant select on storage.objects to anon;
grant select, insert, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create policy irl_media_read on storage.objects for select to authenticated
  using (bucket_id = 'irl-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.irl_posts p where p.media_path = name or p.thumb_path = name)
  ));
create policy post_media_read on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.community_posts p where p.deleted_at is null and (name = any (p.media_paths) or p.thumb_path = name))
  ));
create policy chat_media_read on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.messages m where m.media_path = name and m.deleted_at is null and private.is_member(m.conversation_id))
  ));
create policy activity_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'activity-photos' and (
    (storage.foldername(objects.name))[1] = auth.uid()::text
    or exists (select 1 from public.activities a where a.cover_path = objects.name)
    or exists (select 1 from public.communities c where c.cover_path = objects.name)
    or exists (select 1 from public.conversations v where v.photo_path = objects.name)
  ));
create policy match_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'match-photos' and private.can_read_match_photo(name));
insert into storage.objects (bucket_id, name) values
  ('post-media', 'ce000000-0000-0000-0000-000000000001/g-post.jpg'),
  ('post-media', 'ce000000-0000-0000-0000-000000000001/g-deleted.jpg'),
  ('post-media', 'ce000000-0000-0000-0000-000000000001/o-post.jpg'),
  ('post-media', 'ce000000-0000-0000-0000-000000000001/o-removed.jpg'),
  ('post-media', 'ce000000-0000-0000-0000-000000000001/stray.jpg'),
  ('irl-media', 'ce000000-0000-0000-0000-000000000001/g-live.jpg'),
  ('irl-media', 'ce000000-0000-0000-0000-000000000001/old-live.jpg'),
  ('chat-media', 'ce000000-0000-0000-0000-000000000001/g-chat.jpg'),
  ('activity-photos', 'ce000000-0000-0000-0000-000000000001/g-plan.jpg'),
  ('activity-photos', 'ce000000-0000-0000-0000-000000000001/g-cover.jpg'),
  ('match-photos', 'ce000000-0000-0000-0000-000000000001/m1.jpg');

-- The files of Ama's folder a member can open, in name order.
create or replace function pg_temp.files(uid uuid) returns text language plpgsql as $f$
declare out text;
begin
  perform pg_temp.as_user(uid);
  select coalesce(string_agg(split_part(name, '/', 2), ',' order by split_part(name, '/', 2)), '') into out
    from storage.objects where name like 'ce000000-0000-0000-0000-000000000001/%';
  perform pg_temp.as_admin();
  return out;
end $f$;
create or replace function pg_temp.expect(uid uuid, want text, label text) returns void language plpgsql as $f$
declare got text := pg_temp.files(uid);
begin
  if got is distinct from want then raise notice '   % reads [%], expected [%]', label, got, want; end if;
  perform pg_temp.check(got = want, label);
end $f$;

-- Ama reads every file of hers: posted, deleted, removed, an upload no row shows yet, an ended Live.
select pg_temp.expect('ce000000-0000-0000-0000-000000000001',
  'g-chat.jpg,g-cover.jpg,g-deleted.jpg,g-live.jpg,g-plan.jpg,g-post.jpg,m1.jpg,o-post.jpg,o-removed.jpg,old-live.jpg,stray.jpg',
  'author: reads all her own uploads');
-- Bea, an eligible member: what is shown, not what was deleted, removed, ended or never posted.
select pg_temp.expect('ce000000-0000-0000-0000-000000000002',
  'g-chat.jpg,g-cover.jpg,g-live.jpg,g-plan.jpg,g-post.jpg,m1.jpg,o-post.jpg',
  'eligible member: reads the shown files only (no deleted / removed / ended / unposted file)');
-- Cleo, eligible but outside the community: no chat photo.
select pg_temp.expect('ce000000-0000-0000-0000-000000000003',
  'g-cover.jpg,g-live.jpg,g-plan.jpg,g-post.jpg,m1.jpg,o-post.jpg',
  'eligible non-member: no photo of a chat she is not in');
-- Max, a man: only the open community's post.
select pg_temp.expect('ce000000-0000-0000-0000-000000000004', 'o-post.jpg',
  'man: no IRLY Girl file (post, Live, chat, plan cover, community cover, Match)');
-- Knowing a path is not enough: Max cannot show Ama's file in a post or Live of his own to open it.
select pg_temp.as_user('ce000000-0000-0000-0000-000000000004');
select pg_temp.check(pg_temp.fails($q$insert into public.community_posts (author_id, body, media_paths, media_kind)
  values ('ce000000-0000-0000-0000-000000000004', 'mine', array['ce000000-0000-0000-0000-000000000001/g-post.jpg'], 'photo')$q$) = '42501',
  'man: a post of his cannot show another member''s file');
select pg_temp.check(pg_temp.fails($q$select public.post_live('{"city_id":"dubai","area_id":"marina","body":"mine","visibility":"everyone","media_path":"ce000000-0000-0000-0000-000000000001/g-live.jpg"}'::jsonb)$q$) is not null,
  'man: a Live of his cannot show another member''s file');
select pg_temp.as_admin();
select pg_temp.expect('ce000000-0000-0000-0000-000000000004', 'o-post.jpg', 'man: still no IRLY Girl file after trying');
-- Rae, suspended from IRLY Girl although still inside the community.
select pg_temp.expect('ce000000-0000-0000-0000-000000000005', 'o-post.jpg',
  'suspended woman: no IRLY Girl file');
-- Bo, blocked by Ama: none of Ama's posts, Lives, plan or Match photos.
select pg_temp.check(pg_temp.files('ce000000-0000-0000-0000-000000000007') !~ '(g-post|o-post|g-live|g-plan|m1)',
  'blocked member: none of the blocker''s posts, Lives, plans or Match photos');
-- Liv, before and after staff corrects her gender (the revocation).
select pg_temp.expect('ce000000-0000-0000-0000-000000000006',
  'g-chat.jpg,g-cover.jpg,g-live.jpg,g-plan.jpg,g-post.jpg,m1.jpg,o-post.jpg',
  'Liv, before: reads the IRLY Girl files');
select set_config('request.jwt.claim.sub', 'ce000000-0000-0000-0000-000000000008', false);
update public.profiles set gender = 'man' where id = 'ce000000-0000-0000-0000-000000000006';
select pg_temp.as_admin();
select pg_temp.expect('ce000000-0000-0000-0000-000000000006', 'o-post.jpg',
  'revoked woman: no IRLY Girl file once her access ends');
-- A post deleted later disappears for others at once; restored, it is back.
update public.community_posts set deleted_at = now() where id = 'ce000000-0000-0000-0000-0000000000d1';
select pg_temp.check(pg_temp.files('ce000000-0000-0000-0000-000000000002') !~ 'g-post', 'deleted post: its photo is refused to members');
update public.community_posts set deleted_at = null where id = 'ce000000-0000-0000-0000-0000000000d1';
select pg_temp.check(pg_temp.files('ce000000-0000-0000-0000-000000000002') ~ 'g-post', 'restored post: its photo is back');
-- The community deleted: its posts' photos and cover go with it.
update public.communities set deleted_at = now() where id = 'ce000000-0000-0000-0000-0000000000c1';
select pg_temp.check(pg_temp.files('ce000000-0000-0000-0000-000000000002') !~ '(g-post|g-cover)', 'deleted community: its posts'' photos and cover are refused');
update public.communities set deleted_at = null where id = 'ce000000-0000-0000-0000-0000000000c1';
-- Signed out (anon) reads nothing.
select pg_temp.as_admin();
set role anon;
select pg_temp.check((select count(*) from storage.objects where name like 'ce000000-%') = 0, 'signed out: reads no member file');
select pg_temp.as_admin();
rollback;

select pg_temp.as_admin();
\echo 'storage_read: ALL CHECKS PASSED'
