-- A plan's photo can be a photo the IRLY team put in the library
-- (20261111000200_irly_activity_cover_team_photos). Runs after irly_test.sql.
-- TEST accounts only, ids prefixed fa200000-….
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL team photos: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.fails(stmt text) returns text language plpgsql as $$
begin
  execute stmt;
  return null;
exception when others then
  return sqlstate || ' ' || sqlerrm;
end $$;

reset role;
insert into auth.users (id) values ('fa200000-0000-0000-0000-0000000000a1');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values ('fa200000-0000-0000-0000-0000000000a1', 'Lea', '1994-03-03', 'woman', 'dubai');
insert into public.app_photo_overrides (key, storage_path, version) values ('yoga', '45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg', 5)
  on conflict (key) do update set storage_path = excluded.storage_path, version = excluded.version;

select pg_temp.as_user('fa200000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Pilates', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/app-photos/45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg?v=5')$q$) is null,
  'a plan with the team''s yoga photo (as the library offers it, ?v= included) is published');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Pilates 2', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/app-photos/45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg')$q$) is null,
  '… and without its version');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Other file', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/app-photos/45070c29-dcea-44e6-8dff-7a2709e5398b/999.jpg')$q$) like '42501%',
  'another file of that bucket (not a team library photo) is refused');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Other bucket', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/avatars/45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg')$q$) like '42501%',
  'the same file name in another bucket is refused');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Other project', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://evilproject.supabase.co/storage/v1/object/public/app-photos/45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg')$q$) like '42501%',
  'another Supabase project is refused');
select pg_temp.check(pg_temp.fails($q$insert into public.activities (creator_id, title, category_id, city_id, area_id, starts_at, cover_path) values ('fa200000-0000-0000-0000-0000000000a1', 'Trailing', 'wellness', 'dubai', 'marina', now() + interval '2 days',
  'https://yqutcmgslwxcmnsqmhvy.supabase.co/storage/v1/object/public/app-photos/45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg?v=5&x=<script>')$q$) like '42501%',
  'anything after the version is refused');

-- Leave the shared test database as found (other files count Dubai activities and team photos).
reset role;
delete from public.activities where creator_id = 'fa200000-0000-0000-0000-0000000000a1';
delete from public.app_photo_overrides where key = 'yoga' and storage_path = '45070c29-dcea-44e6-8dff-7a2709e5398b/1792786811277.jpg';
