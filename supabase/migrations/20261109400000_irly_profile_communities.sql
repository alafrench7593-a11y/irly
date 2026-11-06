-- A profile shows the communities its member joined, each with its photo
-- (owner request, 2026-11-06). member_communities (last defined in
-- 20261019000000_irly_hierarchy_activities) is the one place a profile
-- reads them from; it now also says what the app needs to show the right
-- photo without a second request (official, topic, category: the same
-- choice as on the community's page, features/community/official.ts) and
-- whether the community is retired.
--
-- Who sees what (unchanged rules, made explicit, plus three new ones):
--   - your own profile: every community you belong to that is not deleted,
--     retired ones included (they left the lists, not your « Mine »);
--     women-only ones only while you have IRLY Girl access, as everywhere;
--   - someone else's profile: nothing when either of you blocked the other
--     or their profile visibility (safety_settings.profile_visibility) hides
--     it from you, or their account is deleted; otherwise their communities
--     you could find in a list yourself: never a women-only (IRLY Girl, Mom)
--     one unless you have IRLY Girl access, and (new) never a retired one
--     nor one they are banned from (a running ban means not belonging);
--   - only what the lists already show: name, tagline, photo, city, member
--     count. Never the member's role beyond « created » / « joined ».
-- The ones they created come first (an official community, with no
-- creator, sorted among them before: fixed). The return type changes (new
-- columns), so the function is dropped and created again with the same
-- grants.

drop function if exists public.member_communities(uuid);
create function public.member_communities(p_user uuid)
returns table (id uuid, name text, city_id text, cover_path text, members integer, tagline text, role text,
  official boolean, topic text, category_id text, girl_only boolean, retired boolean)
language sql stable security definer set search_path = public, private as $$
  with v as (
    select auth.uid() as me, p_user = auth.uid() as own
  )
  select c.id, c.name, c.city_id, c.cover_path, c.members_count, c.tagline,
    case when coalesce(c.created_by = p_user or m.role = 'owner', false) then 'created' else 'joined' end,
    c.official, c.topic, c.category_id, c.girl_only, c.retired_at is not null
  from v
  join public.community_members m on m.user_id = p_user
  join public.communities c on c.id = m.community_id and c.deleted_at is null and c.parent_id is null
  where v.me is not null
    and exists (select 1 from public.profiles pr where pr.id = p_user and pr.deleted_at is null)
    and (not c.girl_only or private.girl_eligible_unchecked(v.me))
    and not private.community_banned(c.id, p_user)
    and (v.own or (
      c.retired_at is null
      and not private.blocked_unchecked(v.me, p_user)
      and private.visible_to(v.me, p_user, (select s.profile_visibility from public.safety_settings s where s.user_id = p_user))))
  order by coalesce(c.created_by = p_user or m.role = 'owner', false) desc, c.retired_at is not null, c.members_count desc, c.name, c.id
  limit 100
$$;
revoke all on function public.member_communities(uuid) from public, anon;
grant execute on function public.member_communities(uuid) to authenticated;
