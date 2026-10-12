-- Two communities left behind by an interrupted end-to-end test run: the same
-- name twice in Bali, not official, no member. Removed the way delete_community
-- removes one (deleted_at, chat out of every inbox, history kept).
with gone as (
  update public.communities c
  set deleted_at = now()
  where c.name = 'Sync club mv00tl2o'
    and c.city_id = 'bali'
    and not c.official
    and c.deleted_at is null
    and not exists (select 1 from public.community_members m where m.community_id = c.id)
  returning c.id
)
delete from public.conversation_members cm
using public.conversations v, gone
where v.community_id = gone.id and cm.conversation_id = v.id;
