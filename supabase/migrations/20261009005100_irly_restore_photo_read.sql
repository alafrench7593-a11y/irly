-- The cancelled AI photo work (20261009004000, removed from the repo) had
-- replaced the read rule of activity-photos on the live database. Back to
-- the rule of 20261008003300: your own uploads, or the photo of an
-- activity, community or chat you can see.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists activity_photos_read on storage.objects';
    execute $p$
      create policy activity_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'activity-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.activities a where a.cover_path = name)
        or exists (select 1 from public.communities c where c.cover_path = name)
        or exists (select 1 from public.conversations v where v.photo_path = name)
      ))
    $p$;
  end if;
end $$;
