-- Back office photos (migration 20261027700000_irly_admin_photos): who may
-- change which photo, the journal, IRLY's own photos replaced by the team
-- (overrides everyone reads, versions that change the link), old files
-- queued only once nothing uses them (and the purge job checking it again),
-- and IRLY Girl's photos staying behind their rule. Ids a0f70000-….
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
  if not coalesce(ok, false) then raise exception 'FAIL admin_photos: %', label; end if;
  raise notice 'ok  %', label;
end $$;

create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate;
end $$;

-- Rows a direct read returns (-1: refused outright). Either way, never the table's rows.
create or replace function pg_temp.seen(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || stmt || ') x' into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

create or replace function pg_temp.queued(p_bucket text, p_name text) returns boolean language sql as $$
  select exists (select 1 from private.storage_cleanup where bucket_id = p_bucket and name = p_name and done_at is null)
$$;

select pg_temp.as_admin();

-- f1 owner, f2 admin, f3 moderator, f4 content, f5 Paula (member, author), f6 Quentin (member, a man),
-- f7 Rita (content staff, suspended), f8 Sven (moderator), f9 Tara (a woman member).
insert into auth.users (id) values
  ('a0f70000-0000-0000-0000-0000000000f1'), ('a0f70000-0000-0000-0000-0000000000f2'), ('a0f70000-0000-0000-0000-0000000000f3'),
  ('a0f70000-0000-0000-0000-0000000000f4'), ('a0f70000-0000-0000-0000-0000000000f5'), ('a0f70000-0000-0000-0000-0000000000f6'),
  ('a0f70000-0000-0000-0000-0000000000f7'), ('a0f70000-0000-0000-0000-0000000000f8'), ('a0f70000-0000-0000-0000-0000000000f9');
insert into public.profiles (id, first_name, birthdate, gender, city_id, photo_paths) values
  ('a0f70000-0000-0000-0000-0000000000f1', 'Olga', '1990-01-01', 'woman', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f2', 'Anton', '1990-01-01', 'man', 'dubai', array['a0f70000-0000-0000-0000-0000000000f2/me.jpg']),
  ('a0f70000-0000-0000-0000-0000000000f3', 'Mila', '1990-01-01', 'woman', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f4', 'Carla', '1990-01-01', 'woman', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f5', 'Paula', '1990-01-01', 'woman', 'dubai',
     array['a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'a0f70000-0000-0000-0000-0000000000f5/face2.jpg']),
  ('a0f70000-0000-0000-0000-0000000000f6', 'Quentin', '1990-01-01', 'man', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f7', 'Rita', '1990-01-01', 'woman', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f8', 'Sven', '1990-01-01', 'man', 'dubai', '{}'),
  ('a0f70000-0000-0000-0000-0000000000f9', 'Tara', '1990-01-01', 'woman', 'dubai', '{}');
update public.profiles set created_at = now() - interval '60 days' where id::text like 'a0f70000-%';
insert into public.staff_roles (user_id, role) values
  ('a0f70000-0000-0000-0000-0000000000f1', 'owner'), ('a0f70000-0000-0000-0000-0000000000f2', 'admin'),
  ('a0f70000-0000-0000-0000-0000000000f3', 'moderator'), ('a0f70000-0000-0000-0000-0000000000f4', 'content'),
  ('a0f70000-0000-0000-0000-0000000000f7', 'content'), ('a0f70000-0000-0000-0000-0000000000f8', 'moderator');
insert into public.sanctions (user_id, kind, reason, ends_at, created_by) values
  ('a0f70000-0000-0000-0000-0000000000f7', 'suspension', 'Photo test', now() + interval '3 days', 'a0f70000-0000-0000-0000-0000000000f1');

insert into public.communities (id, city_id, name, created_by, cover_path) values
  ('a0f70000-0000-0000-0000-0000000000c1', 'dubai', 'Photo runners', 'a0f70000-0000-0000-0000-0000000000f5', 'a0f70000-0000-0000-0000-0000000000f5/club.jpg');
insert into public.communities (id, city_id, name, created_by, girl_only) values
  ('a0f70000-0000-0000-0000-0000000000c2', 'dubai', 'Photo girls brunch', 'a0f70000-0000-0000-0000-0000000000f5', true);
insert into public.activities (id, title, category_id, city_id, area_id, starts_at, capacity, creator_id, cover_path) values
  ('a0f70000-0000-0000-0000-0000000000a1', 'Photo sunset run', 'sport', 'dubai', 'marina', now() + interval '2 days', 8,
   'a0f70000-0000-0000-0000-0000000000f5', 'a0f70000-0000-0000-0000-0000000000f5/run.jpg');
insert into public.community_posts (id, community_id, author_id, body, media_paths, media_kind) values
  ('a0f70000-0000-0000-0000-0000000000b1', 'a0f70000-0000-0000-0000-0000000000c1', 'a0f70000-0000-0000-0000-0000000000f5', 'Our run',
   array['a0f70000-0000-0000-0000-0000000000f5/p1.jpg', 'a0f70000-0000-0000-0000-0000000000f5/p2.jpg'], 'photo'),
  ('a0f70000-0000-0000-0000-0000000000b2', 'a0f70000-0000-0000-0000-0000000000c1', 'a0f70000-0000-0000-0000-0000000000f5', '',
   array['a0f70000-0000-0000-0000-0000000000f5/only.jpg'], 'photo');
insert into public.irl_posts (id, author_id, city_id, area_id, body, media_path, media_kind) values
  ('a0f70000-0000-0000-0000-0000000000d1', 'a0f70000-0000-0000-0000-0000000000f5', 'dubai', 'marina', 'At the beach', 'a0f70000-0000-0000-0000-0000000000f5/l1.jpg', 'photo');
insert into public.irly_match_profiles (user_id, goals, photo_paths) values
  ('a0f70000-0000-0000-0000-0000000000f5', array['new_friends'], array['a0f70000-0000-0000-0000-0000000000f5/m1.jpg']);

-- ───────── Who may call what ─────────
do $$
declare stmt text;
begin
  perform pg_temp.as_anon();
  foreach stmt in array array[
    $q$select * from public.admin_photos('community')$q$,
    $q$select * from public.admin_item_photos('activity', 'a0f70000-0000-0000-0000-0000000000a1')$q$,
    $q$select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', null, null, 'test it')$q$,
    $q$select public.admin_set_app_photo('padel', null, 'test it')$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'anon refused: ' || left(stmt, 70));
  end loop;
  perform pg_temp.check((select count(*) from public.app_photo_overrides_list()) >= 0, 'anyone (signed out too) reads the photo overrides');

  -- A member: refused everywhere.
  perform pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f5');
  foreach stmt in array array[
    $q$select * from public.admin_photos('community')$q$, $q$select * from public.admin_photos('profile')$q$,
    $q$select * from public.admin_item_photos('profile', 'a0f70000-0000-0000-0000-0000000000f5')$q$,
    $q$select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', null, null, 'test it')$q$,
    $q$select public.admin_set_photo('community', 'a0f70000-0000-0000-0000-0000000000c1', null, null, 'test it')$q$,
    $q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f6', null, 'x', 'test it')$q$,
    $q$select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f5/mine.jpg', 'test it')$q$,
    $q$insert into public.app_photo_overrides (key, storage_path, version) values ('padel', 'a0f70000-0000-0000-0000-0000000000f5/mine.jpg', 1)$q$,
    $q$select private.queue_unused_photo('activity-photos', 'a0f70000-0000-0000-0000-0000000000f6/x.jpg')$q$,
    $q$select private.photo_in_use('activity-photos', 'x')$q$] loop
    perform pg_temp.check(pg_temp.fails(stmt) = '42501', 'member refused: ' || left(stmt, 70));
  end loop;

  -- A suspended content staff member: refused.
  perform pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f7');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f7/1.jpg', 'test it')$q$) = '42501', 'a suspended content staff member cannot change IRLY photos');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', 'a0f70000-0000-0000-0000-0000000000f7/1.jpg', null, 'test it')$q$) = '42501', 'a suspended content staff member cannot change an activity photo');

  -- Content staff: covers and IRLY photos, never a person's photos.
  perform pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f4');
  perform pg_temp.check(pg_temp.fails($q$select * from public.admin_photos('profile')$q$) = '42501', 'content staff do not browse profile photos');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f5', null, 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'test it')$q$) = '42501', 'content staff cannot remove a profile photo');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('community_post', 'a0f70000-0000-0000-0000-0000000000b1', null, 'a0f70000-0000-0000-0000-0000000000f5/p1.jpg', 'test it')$q$) = '42501', 'content staff cannot remove a post photo');
  perform pg_temp.check(exists (select 1 from public.admin_photos('community') where id = 'a0f70000-0000-0000-0000-0000000000c1'), 'content staff browse community photos');
  perform pg_temp.check(exists (select 1 from public.admin_photos('community_post') where id = 'a0f70000-0000-0000-0000-0000000000b1' and cardinality(paths) = 2), 'post photos are listed with their files');

  -- A moderator: removes, never replaces, nor changes IRLY's photos.
  perform pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f3');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f3/1.jpg', 'test it')$q$) = '42501', 'a moderator does not change IRLY photos');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f5', 'a0f70000-0000-0000-0000-0000000000f3/1.jpg', 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'test it')$q$) = '22023', 'a member''s photo is never replaced by another picture');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f2', null, 'a0f70000-0000-0000-0000-0000000000f2/me.jpg', 'test it')$q$) = '42501', 'a moderator cannot change an admin''s photos');
  perform pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f5', null, 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'x')$q$) = '22023', 'a reason is required');
  perform pg_temp.check((select count(*) from public.admin_item_photos('profile', 'a0f70000-0000-0000-0000-0000000000f5')) = 3, 'a moderator sees the profile and Match photos of a member (paths only)');
end $$;

-- ───────── IRLY's own photos ─────────
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f4');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f5/theirs.jpg', 'New padel photo')$q$) = '42501', 'an IRLY photo must be the staff member''s own upload');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('../etc', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg', 'New padel photo')$q$) = '22023', 'a key is a plain name');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg', '')$q$) = '22023', 'a reason is required for an IRLY photo');
select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg', 'New padel photo') as v1 \gset
select pg_temp.check(:v1 > 0, 'replacing an IRLY photo gives it a version');
-- Two keys may share one file: the file stays while one still uses it.
select public.admin_set_app_photo('tennis', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg', 'Same photo for tennis') > 0 as ok \gset
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f6');
select pg_temp.check((select path from public.app_photo_overrides_list() where key = 'padel') = 'a0f70000-0000-0000-0000-0000000000f4/1.jpg', 'members read the replaced photo');
select pg_temp.check(pg_temp.seen('select * from public.app_photo_overrides') <= 0, 'members never read the table itself (who changed it stays on the server)');
select pg_temp.check(pg_temp.fails($q$update public.app_photo_overrides set storage_path = 'a0f70000-0000-0000-0000-0000000000f6/x.jpg'$q$) = '42501' or pg_temp.seen('select * from public.app_photo_overrides') <= 0, 'members cannot change an override');
select pg_temp.as_anon();
select pg_temp.check((select version from public.app_photo_overrides_list() where key = 'padel') = :v1, 'signed-out visitors read it too, with its version');
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f2');
select public.admin_set_app_photo('padel', 'a0f70000-0000-0000-0000-0000000000f2/2.jpg', 'Better padel photo') as v2 \gset
select pg_temp.check(:v2 > :v1, 'a new photo is a new version (every screen loads it fresh)');
select pg_temp.as_admin();
select pg_temp.check(not pg_temp.queued('app-photos', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg'), 'a file another key still uses is kept');
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f4');
select public.admin_set_app_photo('tennis', null, 'Back to the app photo') = 0 as ok \gset
select pg_temp.check(not exists (select 1 from public.app_photo_overrides_list() where key = 'tennis'), 'restoring the default removes the override');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.queued('app-photos', 'a0f70000-0000-0000-0000-0000000000f4/1.jpg'), 'once no key uses it, the old file is queued for removal');
select pg_temp.check((select count(*) from private.admin_audit where action in ('photo.app_replaced', 'photo.app_restored') and details ->> 'key' in ('padel', 'tennis')) = 4, 'every IRLY photo change is journaled with its key');
select pg_temp.check((select count(*) from private.admin_audit where action = 'photo.app_replaced' and details ->> 'reason' = 'Better padel photo'
  and actor = 'a0f70000-0000-0000-0000-0000000000f2') = 1, 'the journal keeps who and why');
-- The journal stays append-only.
select pg_temp.check(pg_temp.fails($q$update private.admin_audit set action = 'x' where action = 'photo.app_replaced'$q$) = '42501', 'photo lines in the journal cannot be changed');

-- Where Storage exists, the uploaded file must be there (a stand-in here, removed below).
create schema storage;
create table storage.objects (bucket_id text, name text);
insert into storage.objects values ('app-photos', 'a0f70000-0000-0000-0000-0000000000f4/3.jpg');
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f4');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_app_photo('golf', 'a0f70000-0000-0000-0000-0000000000f4/missing.jpg', 'New golf photo')$q$) = 'P0002', 'a photo that was not uploaded is refused');
select pg_temp.check(public.admin_set_app_photo('golf', 'a0f70000-0000-0000-0000-0000000000f4/3.jpg', 'New golf photo') > 0, 'an uploaded photo is accepted');
select pg_temp.as_admin();
drop schema storage cascade;

-- ───────── Community and activity photos ─────────
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f4');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', 'a0f70000-0000-0000-0000-0000000000f5/x.jpg', null, 'New photo')$q$) = '42501', 'an activity photo must be the staff member''s own upload');
select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', 'a0f70000-0000-0000-0000-0000000000f4/run2.jpg', null, 'Blurry photo replaced');
select public.admin_set_photo('community', 'a0f70000-0000-0000-0000-0000000000c1', 'a0f70000-0000-0000-0000-0000000000f4/club2.jpg', null, 'Logo replaced by a photo');
select pg_temp.as_admin();
select pg_temp.check((select cover_path from public.activities where id = 'a0f70000-0000-0000-0000-0000000000a1') = 'a0f70000-0000-0000-0000-0000000000f4/run2.jpg', 'an activity photo is replaced (new path: no stale cache)');
select pg_temp.check((select cover_path from public.communities where id = 'a0f70000-0000-0000-0000-0000000000c1') = 'a0f70000-0000-0000-0000-0000000000f4/club2.jpg', 'a community photo is replaced from the Photos screen');
select pg_temp.check(pg_temp.queued('activity-photos', 'a0f70000-0000-0000-0000-0000000000f5/run.jpg'), 'the old activity photo is queued');
select pg_temp.check(pg_temp.queued('activity-photos', 'a0f70000-0000-0000-0000-0000000000f5/club.jpg'), 'the old community photo is queued');
select pg_temp.check(exists (select 1 from private.admin_audit where action = 'activity.photo_replaced' and target_user = 'a0f70000-0000-0000-0000-0000000000f5'
  and details ->> 'id' = 'a0f70000-0000-0000-0000-0000000000a1' and details ->> 'reason' = 'Blurry photo replaced'), 'an activity photo change is journaled with its reason');
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f1');
select public.admin_set_photo('activity', 'a0f70000-0000-0000-0000-0000000000a1', null, null, 'No photo, the app photo is fine');
select pg_temp.as_admin();
select pg_temp.check((select cover_path from public.activities where id = 'a0f70000-0000-0000-0000-0000000000a1') is null, 'an activity photo is removed (the app photo shows)');

-- ───────── A member's photos: removed only ─────────
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f3');
select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f5', null, 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'Not a photo of a person');
select public.admin_set_photo('match', 'a0f70000-0000-0000-0000-0000000000f5', null, 'a0f70000-0000-0000-0000-0000000000f5/m1.jpg', 'Inappropriate Match photo');
select public.admin_set_photo('community_post', 'a0f70000-0000-0000-0000-0000000000b1', null, 'a0f70000-0000-0000-0000-0000000000f5/p1.jpg', 'Shows a stranger''s face');
select public.admin_set_photo('irl_post', 'a0f70000-0000-0000-0000-0000000000d1', null, 'a0f70000-0000-0000-0000-0000000000f5/l1.jpg', 'Shows a car plate');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('community_post', 'a0f70000-0000-0000-0000-0000000000b2', null, 'a0f70000-0000-0000-0000-0000000000f5/only.jpg', 'Only photo')$q$) = '22023', 'a post that is only its photo is hidden, not emptied');
select pg_temp.check(pg_temp.fails($q$select public.admin_set_photo('profile', 'a0f70000-0000-0000-0000-0000000000f5', null, 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg', 'Again')$q$) = 'P0002', 'a photo already removed is said so');
select pg_temp.as_admin();
select pg_temp.check((select photo_paths from public.profiles where id = 'a0f70000-0000-0000-0000-0000000000f5') = array['a0f70000-0000-0000-0000-0000000000f5/face2.jpg'], 'the profile photo is taken off (the next photo, else initials, shows)');
select pg_temp.check((select photo_paths from public.irly_match_profiles where user_id = 'a0f70000-0000-0000-0000-0000000000f5') = '{}', 'the Match photo is taken off');
select pg_temp.check((select media_paths from public.community_posts where id = 'a0f70000-0000-0000-0000-0000000000b1') = array['a0f70000-0000-0000-0000-0000000000f5/p2.jpg'], 'one photo of a post is taken off, the rest stays');
select pg_temp.check((select media_path is null and body = 'At the beach' from public.irl_posts where id = 'a0f70000-0000-0000-0000-0000000000d1'), 'a Live keeps its words without its photo');
select pg_temp.check(pg_temp.queued('profile-photos', 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg') and pg_temp.queued('profile-photos', 'a0f70000-0000-0000-0000-0000000000f5/face1-s.jpg'), 'the profile photo and its small copy are queued');
select pg_temp.check(pg_temp.queued('match-photos', 'a0f70000-0000-0000-0000-0000000000f5/m1.jpg') and pg_temp.queued('post-media', 'a0f70000-0000-0000-0000-0000000000f5/p1.jpg')
  and pg_temp.queued('irl-media', 'a0f70000-0000-0000-0000-0000000000f5/l1.jpg'), 'Match, post and Live files are queued');
select pg_temp.check((select count(*) from private.admin_audit where action in ('profile.photo_removed', 'match.photo_removed', 'post.photo_removed', 'live.photo_removed')
  and target_user = 'a0f70000-0000-0000-0000-0000000000f5' and actor = 'a0f70000-0000-0000-0000-0000000000f3') = 4, 'every removal is journaled, about the member');

-- ───────── The purge job deletes a member's file only once nothing uses it ─────────
select pg_temp.as_admin();
-- The old community photo is used again meanwhile (by an activity): not handed out.
update public.activities set cover_path = 'a0f70000-0000-0000-0000-0000000000f5/club.jpg' where id = 'a0f70000-0000-0000-0000-0000000000a1';
create temp table claimed as select * from private.storage_purge_claim(1000, 900);
select pg_temp.check(exists (select 1 from claimed where bucket_id = 'activity-photos' and name = 'a0f70000-0000-0000-0000-0000000000f5/run.jpg'), 'an unused file of a living member is handed to the purge job');
select pg_temp.check(exists (select 1 from claimed where bucket_id = 'profile-photos' and name = 'a0f70000-0000-0000-0000-0000000000f5/face1.jpg'), 'a removed profile photo is handed to the purge job');
select pg_temp.check(not exists (select 1 from claimed where name = 'a0f70000-0000-0000-0000-0000000000f5/club.jpg'), 'a file used again is never handed out');
select pg_temp.check(not exists (select 1 from claimed where name = 'a0f70000-0000-0000-0000-0000000000f5/face2.jpg'), 'a photo still on the profile is never handed out');
drop table claimed;

-- ───────── IRLY Girl's photos stay behind their rule ─────────
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f6');
select pg_temp.check(not private.can_read_match_photo('a0f70000-0000-0000-0000-0000000000f5/m1.jpg'), 'a man still cannot read a Match photo');
select pg_temp.check(pg_temp.fails($q$select * from public.girl_feed('dubai')$q$) = '42501', 'a man still cannot read the IRLY Girl feed');
select pg_temp.check(not exists (select 1 from public.app_photo_overrides_list() where path like 'a0f70000-0000-0000-0000-0000000000f5/%'), 'no member file ever shows up as an IRLY photo');
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f8');
select pg_temp.check(not private.can_read_match_photo('a0f70000-0000-0000-0000-0000000000f5/face2.jpg'), 'a male moderator gets no reading right on Match photos from the back office');
select pg_temp.as_admin();

-- ───────── The post guard still holds outside the back office ─────────
insert into public.community_members (community_id, user_id, role) values
  ('a0f70000-0000-0000-0000-0000000000c1', 'a0f70000-0000-0000-0000-0000000000f9', 'moderator') on conflict do nothing;
select pg_temp.as_user('a0f70000-0000-0000-0000-0000000000f9');
select pg_temp.check(pg_temp.fails($q$update public.community_posts set media_paths = '{}', media_kind = null where id = 'a0f70000-0000-0000-0000-0000000000b1'$q$) is not null
  or (select cardinality(media_paths) from public.community_posts where id = 'a0f70000-0000-0000-0000-0000000000b1') = 1, 'a community moderator still cannot strip a member''s post');
select pg_temp.as_admin();
select pg_temp.check((select media_paths from public.community_posts where id = 'a0f70000-0000-0000-0000-0000000000b1') = array['a0f70000-0000-0000-0000-0000000000f5/p2.jpg'], 'the post kept its photo');
