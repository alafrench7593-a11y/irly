-- Owner-approved clean-up of IRLY Girl and IRLY Mom Community (2026-10-23),
-- after a read-only inventory of production (scripts/community-inventory.mjs):
-- no post, comment, Live or activity exists in either space, so no member
-- content is touched. Removed, the same reversible way as everywhere
-- (deleted_at set; rows, chats and history kept, deleted_at cleared restores):
--
-- 1. The two communities members created in IRLY Girl, by id: « Dubai Moms »
--    (5407807f-…) and « Marina & JBR Moms » (28194170-…): 0 members, 0 posts,
--    their author's account already deleted.
-- 2. The groups inside IRLY Mom Community (8 per city: Bump & babies,
--    Toddlers, Kids, Teens, Coffee & brunch, Playdates & outings, Questions &
--    advice, Schools, nurseries & doctors): 0 members, 0 posts. IRLY Mom
--    Community is then the only thing the Mom space offers. Their subtopics
--    are switched off, so private.ensure_official_subgroups() never makes
--    them again.
--
-- Nothing else changes: IRLY Mom Community itself, every other official
-- community and its groups, accounts, profiles and Mixte data stay as they
-- are. Each step is filtered (ids, or the official 'moms' parent) and runs
-- once: running the file again finds nothing left to do.

-- 1. The two member communities (and any group of theirs).
update public.communities set deleted_at = now()
where deleted_at is null
  and not official
  and (id in ('5407807f-01a6-426f-bf1f-0be3896f37f9', '28194170-8bf5-4462-8335-2ff8d4a30c01')
       or parent_id in ('5407807f-01a6-426f-bf1f-0be3896f37f9', '28194170-8bf5-4462-8335-2ff8d4a30c01'));

-- 2. IRLY Mom Community's groups: never made again, then removed.
update public.community_subtopics set active = false where parent_topic = 'moms' and active;

update public.communities g set deleted_at = now()
from public.communities p
where g.parent_id = p.id and g.deleted_at is null
  and p.official and p.topic = 'moms' and p.parent_id is null
  and g.official
  -- A group a member has joined or written in is never removed by this file.
  and not exists (select 1 from public.community_members m where m.community_id = g.id)
  and not exists (select 1 from public.community_posts x where x.community_id = g.id);
