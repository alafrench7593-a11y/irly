-- Members delete their own files again (migration 20261027900000): the
-- app-photos delete policy no longer reads public.app_photo_overrides with
-- the member's rights (every DELETE on storage.objects failed with
-- "permission denied for table app_photo_overrides"). The policy's question
-- goes through private.app_photo_in_use, callable by members, which answers
-- yes / no only; the table itself stays closed to them. Ids a0f90000-….
\set ON_ERROR_STOP 1

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL app_photos_delete_policy: %', label; end if;
  raise notice 'ok  %', label;
end $$;

-- Rows a direct read returns (-1: refused outright).
create or replace function pg_temp.seen(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || stmt || ') x' into n;
  return n;
exception when insufficient_privilege then
  return -1;
end $$;

reset role;
insert into auth.users (id) values ('a0f90000-0000-0000-0000-0000000000a1'), ('a0f90000-0000-0000-0000-0000000000a2');
insert into public.app_photo_overrides (key, storage_path, version, updated_by)
values ('zzPolicyTest', 'a0f90000-0000-0000-0000-0000000000a1/override.jpg', 1, 'a0f90000-0000-0000-0000-0000000000a1');

select pg_temp.as_user('a0f90000-0000-0000-0000-0000000000a2');
select pg_temp.check(private.app_photo_in_use('a0f90000-0000-0000-0000-0000000000a1/override.jpg'), 'a member can ask whether a file is one of IRLY''s photos (yes)');
select pg_temp.check(not private.app_photo_in_use('a0f90000-0000-0000-0000-0000000000a2/my-video.mp4'), 'a member''s own file is not one of them (no)');
select pg_temp.check(pg_temp.seen('select * from public.app_photo_overrides') <= 0, 'the overrides table itself stays closed to members');

-- The policy (on Supabase, where the storage schema exists) asks the function, never the table.
reset role;
select pg_temp.check(
  not exists (select 1 from information_schema.schemata where schema_name = 'storage')
  or exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'app_photos_delete'
      and qual like '%app_photo_in_use%' and qual not like '%app_photo_overrides%'
  ),
  'the app-photos delete policy no longer reads app_photo_overrides with the member''s rights');

delete from public.app_photo_overrides where key = 'zzPolicyTest';
delete from auth.users where id in ('a0f90000-0000-0000-0000-0000000000a1', 'a0f90000-0000-0000-0000-0000000000a2');
