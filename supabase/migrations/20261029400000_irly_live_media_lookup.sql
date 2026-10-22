-- Live photos and videos load faster: every signed link of the Live feed
-- (createSignedUrls on irl-media) checks the storage read rule irl_media_read
-- (20261017000100), which looks for the Live that shows the file:
--   exists (select 1 from public.irl_posts p where p.media_path = name or p.thumb_path = name)
-- once per file. Without an index on those columns each check read the whole
-- of irl_posts (expired Lives stay in the table), so the feed's photos waited
-- longer and longer for their links. Additive only: two partial indexes,
-- nothing else changes (rule, rows, permissions).
create index if not exists irl_posts_media_path_idx on public.irl_posts (media_path) where media_path is not null;
create index if not exists irl_posts_thumb_path_idx on public.irl_posts (thumb_path) where thumb_path is not null;
