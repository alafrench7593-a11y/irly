-- IRLY communities in all seven emirates, and every "What are you looking
-- for?" answer leading somewhere. Additive: nothing is renamed, moved or
-- removed; existing communities and members stay as they are.

-- 1. Every topic run in the Emirates is also run in Sharjah, Ajman, Ras Al
--    Khaimah, Fujairah and Umm Al Quwain (Dubai-only topics stay Dubai-only).
--    Sharjah does not get IRLY Nights: alcohol is not served there.
update public.community_topics t
set cities = (
  select array_agg(distinct c order by c)
  from unnest(t.cities || array['sharjah', 'ajman', 'rak', 'fujairah', 'uaq']) c
  where not (t.topic = 'nights' and c = 'sharjah')
)
where 'abudhabi' = any (t.cities);

-- 2. Each answer of "What are you looking for?" is a goal tag the
--    recommendation can match (goal:<answer>).
create or replace function pg_temp.add_tags(p_topic text, p_tags text[]) returns void
language sql as $$
  update public.community_topics
  set match_tags = (select array_agg(distinct x order by x) from unnest(match_tags || p_tags) x)
  where topic = p_topic
$$;
select pg_temp.add_tags('newcomers', array['goal:communities', 'goal:help']);
select pg_temp.add_tags('expats', array['goal:communities', 'goal:languages']);
select pg_temp.add_tags('help', array['newcomer', 'goal:help']);
select pg_temp.add_tags('gym', array['goal:wellness']);
select pg_temp.add_tags('sport', array['goal:activities']);
select pg_temp.add_tags('football', array['goal:sport']);
select pg_temp.add_tags('running', array['goal:sport', 'goal:dogwalk', 'goal:outdoors']);
select pg_temp.add_tags('wellness', array['goal:wellness']);
select pg_temp.add_tags('trip', array['goal:activities', 'goal:outdoors', 'goal:dogwalk']);
select pg_temp.add_tags('beach', array['goal:beach', 'goal:activities', 'goal:outdoors']);
select pg_temp.add_tags('food', array['goal:events']);
select pg_temp.add_tags('culture', array['goal:culture', 'goal:events']);
select pg_temp.add_tags('lifestyle', array['goal:shopping', 'goal:activities']);
select pg_temp.add_tags('nights', array['goal:nightlife', 'goal:events']);
select pg_temp.add_tags('shopping', array['goal:shopping']);
select pg_temp.add_tags('entrepreneurs', array['goal:business']);
select pg_temp.add_tags('ecom', array['goal:business']);
select pg_temp.add_tags('tech', array['goal:tech']);
select pg_temp.add_tags('ai', array['goal:tech']);
select pg_temp.add_tags('moms', array['goal:family']);
select pg_temp.add_tags('families', array['goal:family']);

-- 3. Create the new emirates' communities, their groups and chats (the same
--    functions that created Dubai's and Abu Dhabi's; safe to run again).
select private.ensure_official_communities();
select private.ensure_official_subgroups();
