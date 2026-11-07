-- « 0 latence ». Small copies of covers: a cover uploaded by the app
-- (community, activity, chat photo, in "activity-photos") gets a small copy
-- next to it, "<path>_thumb.jpg" (360 px on its short side, made on the
-- phone at upload: coverThumbOf / uploadCoverThumb in
-- src/features/server/media.ts). Lists, rows and tiles show it instead of
-- the 1280–1600 px photo; pages keep the photo. Covers stored before have no
-- small copy and keep showing the photo: no existing file is changed.
--
--   1. private.cover_original(name): the photo a small copy belongs to.
--   2. private.can_read_activity_photo(name): the activity-photos read rule,
--      unchanged (your own uploads, the cover of an activity or community or
--      the photo of a chat YOU can see: it runs with your rights, so the read
--      rules of activities, communities and conversations, IRLY Girl and Mom
--      included, apply exactly as in the inline rule of
--      20261009005200_irly_community_cover_read), plus: the small copy of a
--      photo you may read. Nothing else becomes readable.
--   3. The storage read policy uses it (when storage exists).
--   4. private.photo_in_use: a small copy is in use while its photo is
--      (last defined in 20261108000000_irly_community_space; every other
--      bucket unchanged).
--   5. A cover queued for removal as unused takes its small copy with it (trigger on
--      private.storage_cleanup): a replaced or removed cover leaves nothing.
--   6. community_list counts « posts this week » with one index scan per
--      community instead of the posts' read rule row by row (same answer).
-- Idempotent.

-- ───────── 1. The photo of a small copy ─────────
create or replace function private.cover_original(p_name text) returns text
language sql immutable set search_path = public as $$
  select case when p_name ~ '_thumb\.jpg$' and char_length(p_name) > 10 then left(p_name, -10) end
$$;

-- ───────── 2. Who may read a file of "activity-photos" ─────────
-- Security invoker: the subqueries run with the reader's rights (row security applies).
create or replace function private.can_read_activity_photo(p_name text) returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce(p_name is not null and (
    (position('/' in p_name) > 0 and split_part(p_name, '/', 1) = auth.uid()::text)
    or exists (select 1 from public.activities a where a.cover_path in (p_name, private.cover_original(p_name)))
    or exists (select 1 from public.communities c where c.cover_path in (p_name, private.cover_original(p_name)))
    or exists (select 1 from public.conversations v where v.photo_path in (p_name, private.cover_original(p_name)))
  ), false)
$$;
revoke all on function private.can_read_activity_photo(text) from public, anon;
grant execute on function private.can_read_activity_photo(text) to authenticated;
revoke all on function private.cover_original(text) from public, anon;
grant execute on function private.cover_original(text) to authenticated;

-- ───────── 3. The storage read policy ─────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    execute 'drop policy if exists activity_photos_read on storage.objects';
    execute $p$
      create policy activity_photos_read on storage.objects for select to authenticated
      using (bucket_id = 'activity-photos' and private.can_read_activity_photo(objects.name))
    $p$;
  end if;
end $$;

-- ───────── 4. Is a stored file still used? ─────────
create or replace function private.photo_in_use(p_bucket text, p_name text) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
begin
  if p_name is null then return false; end if;
  return case p_bucket
    when 'activity-photos' then
      exists (select 1 from public.communities where cover_path in (p_name, private.cover_original(p_name)))
      or exists (select 1 from public.activities where cover_path in (p_name, private.cover_original(p_name)))
      or exists (select 1 from public.conversations where photo_path in (p_name, private.cover_original(p_name)))
    when 'app-photos' then exists (select 1 from public.app_photo_overrides where storage_path = p_name)
    when 'profile-photos' then
      exists (select 1 from public.profiles p, unnest(p.photo_paths) x where p_name in (x, private.photo_thumb(x)))
    when 'match-photos' then exists (select 1 from public.irly_match_profiles where p_name = any (photo_paths))
    when 'post-media' then exists (
      select 1 from public.community_posts p
      where (p.media_paths @> array[p_name] or p.thumb_path = p_name)
        and (p.deleted_at is null or private.is_held('community_post', p.id)
          or exists (select 1 from public.reports r where r.target_kind = 'community_post' and r.target_id = p.id)))
    when 'irl-media' then exists (select 1 from public.irl_posts where media_path = p_name or thumb_path = p_name)
    when 'chat-media' then exists (select 1 from public.messages where media_path = p_name)
    else true
  end;
end $$;
revoke all on function private.photo_in_use(text, text) from public, anon, authenticated;

-- ───────── 5. A cover's small copy leaves with it ─────────
create or replace function private.storage_cleanup_cover_thumb() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare thumb text := new.name || '_thumb.jpg';
begin
  -- Only a single cover taken off ('orphan'): a deleted account queues every stored file of its folder itself.
  if new.bucket_id <> 'activity-photos' or new.reason <> 'orphan' or new.done_at is not null or new.name ~ '_thumb\.jpg$'
     or new.name !~ '^[0-9a-f-]{36}/[A-Za-z0-9._-]{1,80}$' then
    return null;
  end if;
  insert into private.storage_cleanup as q (bucket_id, name, user_id, reason)
  values (new.bucket_id, thumb, new.user_id, new.reason)
  on conflict (bucket_id, name) do update
    set done_at = null, attempts = 0, last_error = null, claimed_at = null, flagged_at = null, queued_at = now()
    where q.done_at is not null;
  return null;
end $$;
revoke all on function private.storage_cleanup_cover_thumb() from public, anon, authenticated;
drop trigger if exists storage_cleanup_cover_thumb on private.storage_cleanup;
create trigger storage_cleanup_cover_thumb after insert or update of done_at, queued_at on private.storage_cleanup
  for each row execute function private.storage_cleanup_cover_thumb();

-- ───────── 6. community_list: « posts this week » without a read rule per post ─────────
-- Home, Communities, Live and Profile all read community_list. Its « posts
-- this week » counted each community's posts through the posts' read rule,
-- row by row (and the rule looks the community up again for every post):
-- ~150 ms for 300 communities and 50 000 posts. The count is now one index
-- scan per community, for the same answer: the community is one the reader
-- may see (its own read rule, checked here: not removed, IRLY Girl only for
-- women with IRLY Girl access), and for such a community the posts' read rule
-- keeps exactly the posts not removed and not written by someone blocked
-- either way. Same rows, same order, same columns (body of
-- 20261110200000_irly_community_list_covers otherwise unchanged).
create or replace function private.community_posts_week(p_community uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when exists (
      select 1 from public.communities c
      where c.id = p_community and c.deleted_at is null and (not c.girl_only or private.is_girl_eligible()))
    then (select count(*)::int from public.community_posts p
      where p.community_id = p_community and p.deleted_at is null and p.created_at > now() - interval '7 days'
        and not coalesce(p.author_id = any ((select private.my_block_ids())::uuid[]), false))
    else 0 end
$$;
revoke all on function private.community_posts_week(uuid) from public, anon;
grant execute on function private.community_posts_week(uuid) to authenticated;

create or replace function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz, cover_path text)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only, c.members_count,
    private.i_belong(c.id),
    private.community_posts_week(c.id),
    c.city_id, c.official, c.topic, t.emoji, c.created_at, c.cover_path
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null and c.parent_id is null
    and c.retired_at is null
  order by (c.city_id = p_city) desc, c.official desc, case when c.official then t.sort end nulls last,
    c.members_count desc, c.created_at, c.id
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;
