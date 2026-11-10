-- The Home gets an « IRLY Games » section (20261111000000_irly_games), right
-- after « Today on IRLY ». The team's published layouts stay valid: a layout
-- saved before this section existed gets it where the app puts it
-- (private.home_layout_clean adds missing sections). Same functions as
-- 20261028500000_irly_admin_cms with one more key. Idempotent.

create or replace function private.home_section_keys() returns text[]
language sql immutable as $$
  select array['search', 'today', 'games', 'news', 'categories', 'banners', 'featured', 'create', 'bali', 'sessions', 'people', 'explore',
    'portals', 'members', 'nearby', 'eat', 'yourCommunities', 'communities', 'forYou', 'footer']
$$;

create or replace function private.home_section_spec(p_key text) returns jsonb
language sql immutable as $$
  select (case p_key
    when 'search' then '{"pinned": "first"}'
    when 'today' then '{"text": true, "cta": true}'
    when 'games' then '{}'
    when 'news' then '{"text": true, "cta": true, "styles": ["cards", "list"], "count": [1, 10]}'
    when 'categories' then '{}'
    when 'banners' then '{"styles": ["carousel", "stack"], "count": [1, 5]}'
    when 'featured' then '{"text": true, "cta": true, "styles": ["large", "compact"]}'
    when 'create' then '{}'
    when 'bali' then '{"cover": true}'
    when 'sessions' then '{"text": true, "cta": true, "count": [1, 5]}'
    when 'people' then '{"text": true, "cta": true, "count": [4, 20]}'
    when 'explore' then '{"text": true, "cta": true}'
    when 'portals' then '{"text": true}'
    when 'members' then '{}'
    when 'nearby' then '{"text": true, "cta": true, "category": true, "count": [2, 12]}'
    when 'eat' then '{"text": true, "cta": true, "count": [2, 12]}'
    when 'yourCommunities' then '{}'
    when 'communities' then '{"text": true, "cta": true, "count": [2, 12]}'
    when 'forYou' then '{"category": true, "count": [1, 6]}'
    when 'footer' then '{"pinned": "last"}'
  end)::jsonb
$$;
