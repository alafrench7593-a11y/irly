-- Supabase platform wiring: realtime events and photo storage.
-- Guarded so the same migrations also run on plain PostgreSQL (tests).

-- Realtime: the app reacts to these without refreshing
-- (MESSAGE_CREATED, MATCH_CREATED, notifications, activity joins).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.irly_matches, public.notifications,
      public.activity_participants, public.conversation_members;
  end if;
end $$;

-- Photos. Paths are "<user id>/<file>". Profile photos are visible to
-- signed-in members; IRLY Match photos only to IRLY Girl members.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
      ('match-photos', 'match-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
      ('irl-media', 'irl-media', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
    on conflict (id) do nothing;

    execute $p$
      create policy photos_own_write on storage.objects for insert to authenticated
      with check (bucket_id in ('profile-photos', 'match-photos', 'irl-media') and (storage.foldername(name))[1] = auth.uid()::text
        and (bucket_id <> 'match-photos' or private.is_girl_eligible(auth.uid())))
    $p$;
    execute $p$
      create policy photos_own_delete on storage.objects for delete to authenticated
      using (bucket_id in ('profile-photos', 'match-photos', 'irl-media') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy profile_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'profile-photos')
    $p$;
    execute $p$
      create policy match_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'match-photos' and private.is_girl_eligible(auth.uid()))
    $p$;
    execute $p$
      create policy irl_media_read on storage.objects for select to authenticated
      using (bucket_id = 'irl-media')
    $p$;
  end if;
end $$;
