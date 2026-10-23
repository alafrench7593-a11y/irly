-- IRLY Maman is now « IRLY Mom Community » (owner decision): the same name in
-- English and in French, as a brand name.
--
-- Only the name members see changes. The topic ('moms'), the routes, the
-- ids, the members, posts, groups and chat stay as they are.
-- 1. The official topic is renamed; ensure_official_communities() keeps its
--    communities in step (one per city), and their chat title follows
--    through communities_chat_title. The name stays reserved for IRLY
--    (official_name_guard reads community_topics).
-- 2. The title shown for a moms community whose stored name is only a code
--    (community_fallback_name) says IRLY Mom Community, like name.ts.
-- Safe to run again.

-- ───────── 1. The official community ─────────
update public.community_topics set name = 'IRLY Mom Community'
where topic = 'moms';

select private.ensure_official_communities();

-- ───────── 2. The fallback title (same labels as name.ts) ─────────
create or replace function private.community_fallback_name(p_topic text, p_category text, p_city text) returns text
language sql immutable set search_path = pg_catalog, private as $$
  select concat_ws(' · ',
    coalesce(
      case p_topic
        when 'gym' then 'Gym & Fitness' when 'sport' then 'Sport' when 'football' then 'Football'
        when 'running' then 'Running' when 'trip' then 'Trips' when 'beach' then 'Beach' when 'food' then 'Food'
        when 'network' then 'Network' when 'entrepreneurs' then 'Entrepreneurs' when 'ecom' then 'E-commerce'
        when 'tech' then 'Tech' when 'ai' then 'AI' when 'girls' then 'IRLY Girl' when 'moms' then 'IRLY Mom Community'
        when 'families' then 'IRLY Family' when 'newcomers' then 'Newcomers' when 'lifestyle' then 'Lifestyle'
        when 'nights' then 'Nights out' when 'help' then 'Help & Questions'
      end,
      nullif(initcap(replace(coalesce(p_topic, ''), '_', ' ')), ''),
      nullif(initcap(replace(coalesce(p_category, ''), '_', ' ')), ''),
      'Community'),
    nullif(private.community_city_label(p_city), ''))
$$;
revoke all on function private.community_fallback_name(text, text, text) from public, anon, authenticated;
