-- Activity photos: the creator can give an activity its own photo.
-- Stored in the private bucket "activity-photos" under "<creator id>/…";
-- a photo is visible exactly to the people who can see its activity.

alter table public.activities add column if not exists cover_path text;

create or replace function private.activity_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.cover_path is null then return new; end if;
  if new.cover_path !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$'
     or split_part(new.cover_path, '/', 1) <> new.creator_id::text then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists activities_cover_guard on public.activities;
create trigger activities_cover_guard before insert or update of cover_path on public.activities
  for each row execute function private.activity_cover_guard();

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('activity-photos', 'activity-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'])
    on conflict (id) do nothing;
    execute 'drop policy if exists activity_photos_write on storage.objects';
    execute $p$
      create policy activity_photos_write on storage.objects for insert to authenticated
      with check (bucket_id = 'activity-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists activity_photos_delete on storage.objects';
    execute $p$
      create policy activity_photos_delete on storage.objects for delete to authenticated
      using (bucket_id = 'activity-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    -- Read: your own uploads, or the photo of an activity you can see
    -- (the activities read policy applies inside the subquery).
    execute 'drop policy if exists activity_photos_read on storage.objects';
    execute $p$
      create policy activity_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'activity-photos' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.activities a where a.cover_path = name)
      ))
    $p$;
  end if;
end $$;

-- The activity page gets the uploaded photo (a storage path) in cover_url.
create or replace function public.activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer, currency text,
  capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text, my_status text, conversation_id uuid,
  cancelled boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.id = p_id
$$;
