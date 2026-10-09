-- AI-enhanced cover photos (enhance-photo function, Cloudinary): next to the
-- member's original, "<name>.hd.jpg" (enhanced) is what an activity,
-- community or chat points at, and "<name>.c169.jpg" / "<name>.c11.jpg" are
-- its subject-aware crops for cards and thumbnails. Whoever may see the
-- photo may see its crops: the read rule maps a crop to its .hd.jpg.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists activity_photos_read on storage.objects';
    execute $p$
      create policy activity_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'activity-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.activities a where a.cover_path in (name, regexp_replace(name, '\.(c169|c11)\.jpg$', '.hd.jpg')))
        or exists (select 1 from public.communities c where c.cover_path in (name, regexp_replace(name, '\.(c169|c11)\.jpg$', '.hd.jpg')))
        or exists (select 1 from public.conversations v where v.photo_path in (name, regexp_replace(name, '\.(c169|c11)\.jpg$', '.hd.jpg')))
      ))
    $p$;
  end if;
end $$;
