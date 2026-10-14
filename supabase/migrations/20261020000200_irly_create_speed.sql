-- Creating an activity, then seeing it (and every other cover) in the lists, was slow.
--
-- Every signed link for a photo in the private "activity-photos" bucket
-- (lists, the activity page, chats) goes through the storage read rule,
-- which asks, per file, whether an activity, a community or a chat uses it:
--   exists (select 1 from public.activities a where a.cover_path = objects.name) ...
-- None of these columns was indexed, so each check read the whole activities
-- table, running its read rule on every row. Measured locally with 20,000
-- activities: 367 ms for one photo of someone else, 1,034 ms for a list of 60;
-- with these indexes 1 ms and 8 ms. Additive only: no rule changes.

create index if not exists activities_cover_path_idx on public.activities (cover_path) where cover_path is not null;
create index if not exists communities_cover_path_idx on public.communities (cover_path) where cover_path is not null;
create index if not exists conversations_photo_path_idx on public.conversations (photo_path) where photo_path is not null;
