-- Live: photos and videos, not only text.
--
-- 1. irl_posts.media_kind already exists ('photo' | 'video', default
--    'photo'); adds thumb_path (a video's poster image) and media_seconds.
-- 2. A post may be a photo or a video without text; text alone still needs
--    at least one character. 160 characters at most, as before.
-- 3. A post's files must be in its author's own folder (the upload rule
--    already says so; the post now cannot point at someone else's file).
-- 4. Storage: the poster of a video is readable by whoever may read the post
--    (same rule as the video: the post itself, as the reader may see it).
-- 5. irl_feed returns the new columns.
-- The irl-media bucket already accepts mp4 / mov up to 25 MB.

alter table public.irl_posts add column if not exists thumb_path text;
alter table public.irl_posts add column if not exists media_seconds integer check (media_seconds between 0 and 120);

alter table public.irl_posts drop constraint if exists irl_posts_body_check;
alter table public.irl_posts add constraint irl_posts_body_check
  check (char_length(body) <= 160 and (char_length(body) >= 1 or media_path is not null));

alter table public.irl_posts drop constraint if exists irl_posts_media_own;
alter table public.irl_posts add constraint irl_posts_media_own check (
  (media_path is null or media_path like author_id::text || '/%')
  and (thumb_path is null or thumb_path like author_id::text || '/%')
) not valid;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists irl_media_read on storage.objects';
    execute $p$
      create policy irl_media_read on storage.objects for select to authenticated
      using (bucket_id = 'irl-media' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.irl_posts p where p.media_path = name or p.thumb_path = name)
      ))
    $p$;
  end if;
end $$;

drop function if exists public.irl_feed(text);
create function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  left join public.activities a on a.id = i.activity_id
  where i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
  order by i.created_at desc
  limit 100
$$;
revoke all on function public.irl_feed(text) from public, anon;
grant execute on function public.irl_feed(text) to authenticated;

-- A member's Lives on their profile: videos show their poster too.
drop function if exists public.member_lives(uuid);
create function public.member_lives(p_user uuid)
returns table (id uuid, body text, media_path text, area_id text, place_name text, created_at timestamptz, expires_at timestamptz, live boolean,
  media_kind text, thumb_path text, media_seconds integer)
language sql stable security invoker set search_path = public as $$
  select i.id, i.body, i.media_path, i.area_id, i.place_name, i.created_at, i.expires_at, i.expires_at > now(),
    i.media_kind, i.thumb_path, i.media_seconds
  from public.irl_posts i
  where i.author_id = p_user and auth.uid() is not null
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by i.created_at desc
  limit 60
$$;
revoke all on function public.member_lives(uuid) from public, anon;
grant execute on function public.member_lives(uuid) to authenticated;
