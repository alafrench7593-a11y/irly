-- Small copies of covers (migration 20261110600000_irly_latency): the
-- small copy "<path>_thumb.jpg" of a cover is readable by exactly who may
-- read the cover (own uploads, the cover of an activity or a community you
-- can see), IRLY Girl's covers and their small copies stay behind IRLY
-- Girl's rule, a small copy is « in use » while its photo is, and a cover
-- queued for removal takes its small copy with it.
-- Runs after irly_test.sql on the same database. TEST accounts only, ids c7a60000-….
--   …a1 Wren   woman (owner of both communities and the activities)
--   …a2 Nora   woman
--   …b1 Milo   man
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL cover_thumbs: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.reads(p_name text) returns boolean language sql as $$
  select private.can_read_activity_photo(p_name)
$$;
create or replace function pg_temp.queued(p_name text) returns boolean language sql as $$
  select exists (select 1 from private.storage_cleanup where bucket_id = 'activity-photos' and name = p_name and done_at is null)
$$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('c7a60000-0000-0000-0000-0000000000a1'), ('c7a60000-0000-0000-0000-0000000000a2'), ('c7a60000-0000-0000-0000-0000000000b1');
insert into public.profiles (id, first_name, birthdate, gender, city_id, area_id) values
  ('c7a60000-0000-0000-0000-0000000000a1', 'Wren', '1994-01-01', 'woman', 'dubai', 'marina'),
  ('c7a60000-0000-0000-0000-0000000000a2', 'Nora', '1992-01-01', 'woman', 'dubai', 'marina'),
  ('c7a60000-0000-0000-0000-0000000000b1', 'Milo', '1993-01-01', 'man', 'dubai', 'marina');
insert into public.communities (id, city_id, name, category_id, girl_only, created_by, cover_path) values
  ('c7a60000-0000-0000-0002-000000000001', 'dubai', 'Thumbx open circle', 'social', false, 'c7a60000-0000-0000-0000-0000000000a1', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg'),
  ('c7a60000-0000-0000-0002-000000000002', 'dubai', 'Thumbx girls circle', 'social', true, 'c7a60000-0000-0000-0000-0000000000a1', 'c7a60000-0000-0000-0000-0000000000a1/girls.jpg');
insert into public.community_members (community_id, user_id, role) values
  ('c7a60000-0000-0000-0002-000000000001', 'c7a60000-0000-0000-0000-0000000000a1', 'owner'),
  ('c7a60000-0000-0000-0002-000000000002', 'c7a60000-0000-0000-0000-0000000000a1', 'owner')
on conflict do nothing;
insert into public.activities (id, creator_id, format, title, category_id, city_id, area_id, starts_at, privacy, girl_only, audience, cover_path) values
  ('c7a60000-0000-0000-0001-000000000001', 'c7a60000-0000-0000-0000-0000000000a1', 'activity', 'Thumbx run', 'sport', 'dubai', 'marina', now() + interval '1 day', 'public', false, 'all', 'c7a60000-0000-0000-0000-0000000000a1/run.png'),
  ('c7a60000-0000-0000-0001-000000000002', 'c7a60000-0000-0000-0000-0000000000a1', 'activity', 'Thumbx girls brunch', 'food', 'dubai', 'marina', now() + interval '1 day', 'public', true, 'girls', 'c7a60000-0000-0000-0000-0000000000a1/brunch.jpg');

-- ───────── The photo a small copy belongs to ─────────
select pg_temp.check(private.cover_original('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg') = 'c7a60000-0000-0000-0000-0000000000a1/open.jpg', 'a small copy names its photo');
select pg_temp.check(private.cover_original('c7a60000-0000-0000-0000-0000000000a1/open.jpg') is null, 'a photo is no small copy');
select pg_temp.check(private.cover_original('_thumb.jpg') is null, 'a bare suffix names nothing');

-- ───────── Who reads what ─────────
select pg_temp.as_user('c7a60000-0000-0000-0000-0000000000b1');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/open.jpg'), 'a man reads an open community''s cover (as before)');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'and its small copy');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/run.png_thumb.jpg'), 'and the small copy of an open activity''s cover (any format)');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/girls.jpg'), 'a man never reads an IRLY Girl community''s cover');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/girls.jpg_thumb.jpg'), 'nor its small copy');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/brunch.jpg'), 'a man never reads an IRLY Girl activity''s cover');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/brunch.jpg_thumb.jpg'), 'nor its small copy');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/staged.jpg'), 'someone else''s unused upload stays private');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/staged.jpg_thumb.jpg'), 'and so does its small copy');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg_thumb.jpg'), 'a small copy of a small copy names no readable photo');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/open'), 'a near name is not the cover');
select pg_temp.check(not pg_temp.reads(null), 'no name, no read');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000b1/mine.jpg_thumb.jpg'), 'your own uploads, small copies included');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000b1'), 'a name without a folder is nobody''s upload');

select pg_temp.as_user('c7a60000-0000-0000-0000-0000000000a2');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/girls.jpg') and pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/girls.jpg_thumb.jpg'), 'a woman with IRLY Girl reads its community''s cover and small copy');
select pg_temp.check(pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/brunch.jpg_thumb.jpg'), 'and an IRLY Girl activity''s small copy');
select pg_temp.check(not pg_temp.reads('c7a60000-0000-0000-0000-0000000000a1/staged.jpg_thumb.jpg'), 'never the small copy of an unused upload');

-- Signed out: nothing at all.
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$
begin
  perform private.can_read_activity_photo('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg');
  raise exception 'FAIL cover_thumbs: a visitor could ask the read rule';
exception when insufficient_privilege then
  raise notice 'ok  a visitor cannot ask the read rule';
end $$;
select pg_temp.as_admin();

-- ───────── In use, and removed together ─────────
select pg_temp.check(private.photo_in_use('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'a used cover''s small copy is in use');
select pg_temp.check(private.photo_in_use('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg'), 'the cover itself too (as before)');
select pg_temp.check(not private.photo_in_use('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/staged.jpg_thumb.jpg'), 'an unused small copy is not');
select pg_temp.check(private.photo_in_use('profile-photos', 'c7a60000-0000-0000-0000-0000000000a1/none.jpg') = false, 'other buckets unchanged');

update public.communities set cover_path = null where id = 'c7a60000-0000-0000-0002-000000000001';
select pg_temp.check(not private.photo_in_use('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'a cover taken off: its small copy is no longer in use');
select private.queue_removed_file('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg');
select pg_temp.check(pg_temp.queued('c7a60000-0000-0000-0000-0000000000a1/open.jpg'), 'the old cover is queued');
select pg_temp.check(pg_temp.queued('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'its small copy is queued with it');
select pg_temp.check((select reason from private.storage_cleanup where bucket_id = 'activity-photos' and name = 'c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg') = 'orphan'
  and (select user_id from private.storage_cleanup where bucket_id = 'activity-photos' and name = 'c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg') = 'c7a60000-0000-0000-0000-0000000000a1', 'same reason, same member');
select pg_temp.check(not pg_temp.queued('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg_thumb.jpg'), 'a small copy never queues one of its own');
-- Done, then queued again (the same file name reused): the small copy comes back too.
update private.storage_cleanup set done_at = now() where bucket_id = 'activity-photos' and name like 'c7a60000-%';
select pg_temp.check(not pg_temp.queued('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'both marked done');
select private.queue_removed_file('activity-photos', 'c7a60000-0000-0000-0000-0000000000a1/open.jpg');
select pg_temp.check(pg_temp.queued('c7a60000-0000-0000-0000-0000000000a1/open.jpg_thumb.jpg'), 'queued again together');
select private.queue_removed_file('chat-media', 'c7a60000-0000-0000-0000-0000000000a1/m1.jpg');
select pg_temp.check(not exists (select 1 from private.storage_cleanup where bucket_id = 'chat-media' and name like '%_thumb.jpg'), 'other buckets queue no small copy');

-- ───────── Clean up ─────────
delete from private.storage_cleanup where name like 'c7a60000-%';
delete from public.activities where id::text like 'c7a60000-%';
delete from public.community_members where community_id::text like 'c7a60000-%';
delete from public.communities where id::text like 'c7a60000-%';
delete from public.profiles where id::text like 'c7a60000-%';
delete from auth.users where id::text like 'c7a60000-%';
