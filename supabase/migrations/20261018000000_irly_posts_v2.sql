-- Publications v2: text, several photos or a video, from a profile or a community.
--
-- Builds on community_posts (comments, likes, saves, reports, moderation and
-- removal already work on it); nothing is removed or rewritten.
-- 1. A post may belong to no community: a profile post, shown on its author's
--    profile, readable as the profile is (its visibility setting, blocks).
-- 2. Media: up to 10 photos (media_paths) or one video (+ poster, length).
--    Text is optional when there is media. Files live in the private
--    post-media bucket, in the author's own folder, readable by whoever may
--    read the post.
-- 3. Editing: the author can change the text and media of their post
--    (edited_at is set); a poll with votes still cannot change. A Live
--    (irl_posts, 4 hours) can have its text corrected through edit_live_post.

-- ───────── 1. Profile posts ─────────
alter table public.community_posts alter column community_id drop not null;

drop policy if exists community_posts_read on public.community_posts;
create policy community_posts_read on public.community_posts for select to authenticated
  using (
    -- A profile post follows the profile's own visibility (everyone, friends or nobody).
    (case when community_id is null then author_id = auth.uid() or private.discoverable(author_id)
      else exists (select 1 from public.communities c where c.id = community_id) end)
    and not private.is_blocked(auth.uid(), author_id)
    and (deleted_at is null or author_id = auth.uid() or (community_id is not null and private.moderates(community_id)))
  );
drop policy if exists community_posts_write on public.community_posts;
create policy community_posts_write on public.community_posts for insert to authenticated
  with check (author_id = auth.uid() and (community_id is null or private.i_belong(community_id)));

-- ───────── 2. Media ─────────
alter table public.community_posts add column if not exists media_paths text[] not null default '{}';
alter table public.community_posts add column if not exists media_kind text check (media_kind in ('photo', 'video'));
alter table public.community_posts add column if not exists thumb_path text;
alter table public.community_posts add column if not exists media_seconds integer check (media_seconds between 0 and 120);
alter table public.community_posts add column if not exists edited_at timestamptz;

alter table public.community_posts drop constraint if exists community_posts_media_count;
alter table public.community_posts add constraint community_posts_media_count check (
  cardinality(media_paths) <= 10
  and (media_kind is distinct from 'video' or cardinality(media_paths) = 1)
  and ((cardinality(media_paths) = 0) = (media_kind is null))
);
alter table public.community_posts drop constraint if exists community_posts_body_check;
alter table public.community_posts drop constraint if exists community_posts_body_len;
alter table public.community_posts add constraint community_posts_body_len check (
  char_length(body) <= 2000 and (char_length(body) >= 1 or cardinality(media_paths) > 0)
);

-- Shape: text trimmed, the activity exists, files in the author's own folder,
-- a voted poll never changes, an edit by the author is dated.
create or replace function private.community_post_shape() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  f text;
begin
  new.body := btrim(new.body);
  if new.activity_id is not null and (tg_op = 'INSERT' or new.activity_id is distinct from old.activity_id)
     and not exists (select 1 from public.activities where id = new.activity_id) then
    raise exception 'activity not found' using errcode = 'P0002';
  end if;
  if tg_op = 'UPDATE' and new.poll is distinct from old.poll
     and exists (select 1 from public.community_poll_votes v where v.post_id = old.id) then
    raise exception 'a poll cannot change once people voted' using errcode = '42501';
  end if;
  foreach f in array new.media_paths || coalesce(new.thumb_path, '') loop
    if f <> '' and f not like new.author_id::text || '/%' then
      raise exception 'a post can only show its author''s own files' using errcode = '42501';
    end if;
  end loop;
  if tg_op = 'UPDATE' and auth.uid() = old.author_id and new.deleted_at is null
     and (new.body is distinct from old.body or new.media_paths is distinct from old.media_paths or new.poll is distinct from old.poll) then
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists community_posts_shape on public.community_posts;
create trigger community_posts_shape before insert or update on public.community_posts
for each row execute function private.community_post_shape();

-- Mentions in comments: a profile post is seen by members who are not blocked.
create or replace function private.user_can_see(p_user uuid, p_type text, p_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
  author uuid;
  a public.activities;
  p public.irl_posts;
begin
  if p_type in ('place', 'catalog') then return true; end if;
  if not private.is_uuid(p_id) then return false; end if;
  if p_type = 'community' then
    return exists (select 1 from public.community_members where community_id = p_id::uuid and user_id = p_user);
  elsif p_type = 'community_post' then
    select community_id, author_id into cid, author from public.community_posts where id = p_id::uuid and deleted_at is null;
    if author is null then return false; end if;
    if cid is null then
      return author = p_user or (not private.blocked_unchecked(p_user, author)
        and private.visible_to(p_user, author, (select st.profile_visibility from public.safety_settings st where st.user_id = author)));
    end if;
    return exists (select 1 from public.community_members where community_id = cid and user_id = p_user);
  elsif p_type = 'activity' then
    select * into a from public.activities where id = p_id::uuid;
    if not found or private.blocked_unchecked(p_user, a.creator_id) then return false; end if;
    return a.creator_id = p_user
      or exists (select 1 from public.activity_participants where activity_id = a.id and user_id = p_user)
      or (a.privacy = 'public' and a.cancelled_at is null and (not a.girl_only or private.girl_eligible_unchecked(p_user)));
  elsif p_type = 'irl_post' then
    select * into p from public.irl_posts where id = p_id::uuid;
    if not found then return false; end if;
    if p.author_id = p_user then return true; end if;
    return p.expires_at > now() and not private.blocked_unchecked(p_user, p.author_id) and (
      p.visibility = 'everyone'
      or (p.visibility = 'friends' and private.friends_unchecked(p.author_id, p_user))
      or (p.visibility = 'close_friends' and exists (select 1 from public.close_friends cf where cf.user_id = p.author_id and cf.friend_id = p_user))
      or (p.visibility = 'community' and p.community_id is not null
          and exists (select 1 from public.community_members cm where cm.community_id = p.community_id and cm.user_id = p_user))
    );
  elsif p_type = 'profile' then
    return not private.blocked_unchecked(p_user, p_id::uuid);
  end if;
  return false;
end $$;
revoke all on function private.user_can_see(uuid, text, text) from public, anon, authenticated;

-- Storage: a private bucket for posts' photos and videos.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('post-media', 'post-media', false, 26214400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
    on conflict (id) do nothing;
    execute 'drop policy if exists post_media_write on storage.objects';
    execute $p$
      create policy post_media_write on storage.objects for insert to authenticated
      with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists post_media_delete on storage.objects';
    execute $p$
      create policy post_media_delete on storage.objects for delete to authenticated
      using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute 'drop policy if exists post_media_read on storage.objects';
    execute $p$
      create policy post_media_read on storage.objects for select to authenticated
      using (bucket_id = 'post-media' and (
        (storage.foldername(name))[1] = auth.uid()::text
        or exists (select 1 from public.community_posts p where p.deleted_at is null and (name = any (p.media_paths) or p.thumb_path = name))
      ))
    $p$;
  end if;
end $$;

-- ───────── 3. Correcting a Live's text ─────────
alter table public.irl_posts add column if not exists edited_at timestamptz;

create or replace function public.edit_live_post(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  p public.irl_posts;
begin
  select * into p from public.irl_posts where id = p_id;
  if not found or p.author_id is distinct from auth.uid() then
    raise exception 'only the author can edit this post' using errcode = '42501';
  end if;
  if p.expires_at <= now() then
    raise exception 'this Live has ended' using errcode = '42501';
  end if;
  update public.irl_posts set body = btrim(coalesce(p_body, '')), edited_at = now() where id = p_id;
end $$;
revoke all on function public.edit_live_post(uuid, text) from public, anon;
grant execute on function public.edit_live_post(uuid, text) to authenticated;

-- ───────── 4. Feeds return the media ─────────
drop function if exists public.community_feed(uuid, integer, timestamptz);
create function public.community_feed(p_community uuid, p_limit integer default 30, p_before timestamptz default null)
returns table (id uuid, author_id uuid, first_name text, body text, activity_id uuid, activity_title text, activity_starts_at timestamptz,
  poll jsonb, poll_counts integer[], my_vote smallint, likes integer, comments integer, liked boolean, created_at timestamptz, mine boolean,
  media_paths text[], media_kind text, thumb_path text, media_seconds integer, edited_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select p.id, p.author_id, a.first_name, p.body, p.activity_id, act.title, act.starts_at, p.poll,
    case when p.poll is null then null else array(
      select (select count(*)::int from public.community_poll_votes v where v.post_id = p.id and v.option = o.i)
      from generate_series(0, jsonb_array_length(p.poll -> 'options') - 1) o (i)
    ) end,
    (select v.option from public.community_poll_votes v where v.post_id = p.id and v.user_id = auth.uid()),
    (select count(*)::int from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text),
    (select count(*)::int from public.comments k where k.target_type = 'community_post' and k.target_id = p.id::text and k.deleted_at is null),
    exists (select 1 from public.likes l where l.target_type = 'community_post' and l.target_id = p.id::text and l.user_id = auth.uid()),
    p.created_at, p.author_id = auth.uid(),
    p.media_paths, p.media_kind, p.thumb_path, p.media_seconds, p.edited_at
  from public.community_posts p
  left join public.profiles_public a on a.id = p.author_id
  left join public.activities act on act.id = p.activity_id
  where p.community_id = p_community and p.deleted_at is null
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
revoke all on function public.community_feed(uuid, integer, timestamptz) from public, anon;
grant execute on function public.community_feed(uuid, integer, timestamptz) to authenticated;
