-- Members could no longer delete their own files (live E2E, 21 October:
-- "Alice deletes the video post: permission denied for table
-- app_photo_overrides"). Since 20261027700000 the storage policy
-- app_photos_delete reads public.app_photo_overrides directly in its USING
-- expression. Postgres checks every DELETE policy of storage.objects for any
-- row a member deletes, in any bucket, and members have no right on that
-- table (it is read only through app_photo_overrides_list()): the whole
-- delete failed, whatever the bucket.
--
-- The policy now asks a security definer function whether a file of the
-- app-photos bucket is still one of IRLY's photos (it reads the table with
-- the owner's rights and returns a yes/no only). The rule itself is the same:
-- content staff delete their own unused files of app-photos, nobody else.
-- Additive: no table or column is dropped, RLS stays on everywhere.

/** True while one of IRLY's replaced photos (app_photo_overrides) is this file. */
create or replace function private.app_photo_in_use(p_name text) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (select 1 from public.app_photo_overrides o where o.storage_path = p_name);
$$;
revoke all on function private.app_photo_in_use(text) from public, anon;
grant execute on function private.app_photo_in_use(text) to authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists app_photos_delete on storage.objects';
    execute $p$
      create policy app_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'app-photos' and (storage.foldername(name))[1] = auth.uid()::text and private.is_content_staff(auth.uid())
             and not private.app_photo_in_use(name))
    $p$;
  end if;
end $$;
