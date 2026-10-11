-- One source for members' faces everywhere (chats, Live, comments, posts,
-- lists, notifications): the current profile photo of up to 200 members at
-- once. Same visibility as a profile's name and photo: everyone signed in,
-- except deleted accounts and people blocked either way. Read only.

create or replace function public.profile_faces(p_ids uuid[])
returns table (id uuid, photo_path text)
language sql stable security definer set search_path = public as $$
  select p.id, p.photo_paths[1]
  from public.profiles p
  where auth.uid() is not null
    and p.id = any (p_ids[1:200])
    and p.deleted_at is null
    and not private.blocked_unchecked(auth.uid(), p.id)
$$;
revoke all on function public.profile_faces(uuid[]) from public, anon;
grant execute on function public.profile_faces(uuid[]) to authenticated;
