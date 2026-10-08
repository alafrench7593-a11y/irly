-- Own photos for communities and chats. Without one, the app shows its own
-- photo for the category. Uploads go to the private "activity-photos"
-- bucket under "<uploader id>/…", like session photos.
--   • a community photo: set by its owner or a moderator, seen by anyone who can see the community;
--   • a chat photo (group, session or community chat): set by a chat admin
--     (or the community owner / a moderator), seen by the chat's members.

alter table public.communities add column if not exists cover_path text;
alter table public.conversations add column if not exists photo_path text;

-- A new photo must be one of the caller's own uploads.
create or replace function private.own_upload(p_path text) returns boolean
language sql stable set search_path = public as $$
  select p_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' and split_part(p_path, '/', 1) = auth.uid()::text
$$;

create or replace function private.community_cover_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.cover_path is not null and new.cover_path is distinct from old.cover_path and not private.own_upload(new.cover_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists communities_cover_guard on public.communities;
create trigger communities_cover_guard before update of cover_path on public.communities
  for each row execute function private.community_cover_guard();

create or replace function public.set_community_cover(p_community uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.community_members m join public.communities c on c.id = m.community_id
    where m.community_id = p_community and m.user_id = auth.uid() and m.role in ('owner', 'moderator') and c.deleted_at is null
  ) then
    raise exception 'only the community owner or a moderator can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.communities set cover_path = p_path where id = p_community;
end $$;
revoke all on function public.set_community_cover(uuid, text) from public, anon;
grant execute on function public.set_community_cover(uuid, text) to authenticated;

create or replace function public.set_conversation_photo(p_conversation uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations;
begin
  if auth.uid() is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into conv from public.conversations where id = p_conversation;
  if conv.id is null or conv.kind not in ('group', 'activity', 'community') then
    raise exception 'this chat has no photo of its own' using errcode = '42501';
  end if;
  if not (
    exists (select 1 from public.conversation_members where conversation_id = conv.id and user_id = auth.uid() and role = 'admin')
    or (conv.community_id is not null and exists (
      select 1 from public.community_members where community_id = conv.community_id and user_id = auth.uid() and role in ('owner', 'moderator')))
  ) then
    raise exception 'only the chat admin can change its photo' using errcode = '42501';
  end if;
  if p_path is not null and not private.own_upload(p_path) then
    raise exception 'the photo must be one of your own uploads' using errcode = '42501';
  end if;
  update public.conversations set photo_path = p_path where id = conv.id;
end $$;
revoke all on function public.set_conversation_photo(uuid, text) from public, anon;
grant execute on function public.set_conversation_photo(uuid, text) to authenticated;

-- Read: your own uploads, or the photo of an activity, community or chat you can see
-- (the read policies of those tables apply inside the subqueries).
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
