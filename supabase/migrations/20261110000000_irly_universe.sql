-- The universe of a community and of a conversation (Mixte, Girl, Mom,
-- Network), same rule as the app's src/features/universe/universe.ts.
-- Used by lists that show one universe at a time. Nothing is moved: the
-- data stays where it is; only what a screen lists depends on it.

create or replace function private.community_universe(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when c.category_id = 'networking'
      or c.topic in ('network', 'girl_network', 'mom_network', 'entrepreneurs', 'ecom', 'tech', 'ai') then 'network'
    when c.topic = 'moms' or c.topic like 'mom\_%' then 'mom'
    when c.girl_only then 'girl'
    else 'mixte' end
  from public.communities c
  where c.id = p_id
$$;
revoke all on function private.community_universe(uuid) from public, anon, authenticated;

-- A conversation's universe: its community's, or its activity's community's;
-- an activity without community follows its own women-only flag; a direct
-- conversation has none (null: shared by every universe the member uses).
create or replace function private.conversation_universe(p_conversation uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when v.community_id is not null then private.community_universe(v.community_id)
    when a.id is not null and a.community_id is not null then private.community_universe(a.community_id)
    when a.id is not null then case when a.girl_only then 'girl' else 'mixte' end
    else null end
  from public.conversations v
  left join public.activities a on a.id = v.activity_id
  where v.id = p_conversation
$$;
revoke all on function private.conversation_universe(uuid) from public, anon, authenticated;
