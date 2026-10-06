-- One country, one community: in the Emirates, members of all seven emirates
-- see each other's activities, communities, IRL posts and search results
-- (their own emirate first). Bali stays Bali. Each row now says which city
-- it is in, so the app can show "Sharjah" on a card seen from Dubai.

-- Every city of the same country as p_city (p_city alone if unknown).
create or replace function private.city_scope(p_city text) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select array_agg(c.id order by c.id)
     from public.cities c join public.regions r on r.id = c.region_id
     where r.country_id = (select r2.country_id from public.cities c2 join public.regions r2 on r2.id = c2.region_id where c2.id = p_city)),
    array[p_city])
$$;
revoke all on function private.city_scope(text) from public;
grant execute on function private.city_scope(text) to authenticated, anon;

-- IRL feed: the whole country, newest first.
drop function if exists public.irl_feed(text);
create function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id
  from public.irl_posts i
  cross join lateral (select first_name from public.profiles_public where id = i.author_id) p
  left join public.activities a on a.id = i.activity_id
  where i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
    and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
  order by i.created_at desc
  limit 100
$$;
revoke all on function public.irl_feed(text) from public, anon;
grant execute on function public.irl_feed(text) to authenticated;

-- Recommendations: the whole country; your own city scores a little higher.
drop function if exists public.recommend_activities(text, integer);
create function public.recommend_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text, city_id text)
language sql stable set search_path = public as $$
  with me as (
    select coalesce(p.interests, '{}') || coalesce(p.sports, '{}') || coalesce(p.activity_prefs, '{}') as tastes
    from public.profiles p where p.id = auth.uid()
  ),
  liked_cats as (
    select distinct a.category_id from public.activities a
    join (select target_id from public.likes where user_id = auth.uid() and target_type = 'activity'
          union select target_id from public.saves where user_id = auth.uid() and target_type = 'activity') t
      on t.target_id = a.id::text
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at, a.city_id,
      private.going_count(a.id) as going,
      (select count(*)::int from public.activity_participants x
        where x.activity_id = a.id and x.status = 'going' and private.are_friends(auth.uid(), x.user_id)) as friends_going,
      (a.category_id = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select tastes from me), '{}'))) as taste,
      a.category_id in (select category_id from liked_cats) as liked_before
    from public.activities a
    where a.city_id = any (private.city_scope(p_city)) and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      and not private.i_participate(a.id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or private.going_count(a.id) < a.capacity)
  )
  select s.id, s.title, s.format, s.category_id, s.area_id, s.starts_at, s.going, s.friends_going,
    (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
      + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10)
      + case when s.city_id = p_city then 12 else 0 end)::int,
    case when s.friends_going > 0 then 'friends_going' when s.taste then 'your_interests'
      when s.liked_before then 'you_liked_similar' when s.starts_at < now() + interval '2 days' then 'soon' else 'popular' end,
    s.city_id
  from scored s
  order by 9 desc, s.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;
revoke all on function public.recommend_activities(text, integer) from public, anon;
grant execute on function public.recommend_activities(text, integer) to authenticated;

-- Communities: the whole country, your own city first.
drop function if exists public.community_list(text);
create function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id
  from public.communities c
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null
  order by (c.city_id = p_city) desc, 8 desc, 6 desc, c.name
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- Search: the whole country (same columns as before).
create or replace function public.search_all(p_q text, p_city text default null, p_limit integer default 30)
returns table (kind text, id text, title text, subtitle text, city_id text, area_id text, starts_at timestamptz, rank integer)
language sql stable set search_path = public as $$
  with q as (select '%' || replace(replace(btrim(coalesce(p_q, '')), '%', ''), '_', '') || '%' as pat, lower(btrim(coalesce(p_q, ''))) as raw),
  sc as (select case when p_city is null then null else private.city_scope(p_city) end as cities)
  select * from (
    select 'activity'::text, a.id::text, a.title, a.category_id, a.city_id, a.area_id, a.starts_at,
      case when lower(a.title) like q.raw || '%' then 3 else 2 end
    from public.activities a, q, sc
    where a.cancelled_at is null and a.starts_at > now() - interval '3 hours'
      and (sc.cities is null or a.city_id = any (sc.cities))
      and (a.title ilike q.pat or a.category_id ilike q.pat or coalesce(a.description, '') ilike q.pat
        or coalesce(a.place_name, '') ilike q.pat or a.area_id ilike q.pat)
    union all
    select 'community', c.id::text, c.name, coalesce(c.tagline, c.category_id), c.city_id, null, null,
      case when lower(c.name) like q.raw || '%' then 3 else 2 end
    from public.communities c, q, sc
    where (sc.cities is null or c.city_id = any (sc.cities))
      and (c.name ilike q.pat or coalesce(c.tagline, '') ilike q.pat or coalesce(c.category_id, '') ilike q.pat)
    union all
    select 'person', p.id::text, p.first_name, p.city_id, p.city_id, null, null, 1
    from public.profiles_public p, q
    where p.id <> auth.uid() and char_length(q.raw) >= 2 and p.first_name ilike q.raw || '%'
      and not private.is_blocked(auth.uid(), p.id) and private.discoverable(p.id)
    union all
    select 'place', pl.slug, pl.name, pl.kind, pl.city_id, pl.area_id, null, case when pl.featured then 2 else 1 end
    from public.places pl, q, sc
    where (sc.cities is null or pl.city_id = any (sc.cities))
      and (pl.name ilike q.pat or pl.kind ilike q.pat or array_to_string(pl.tags, ' ') ilike q.pat)
    union all
    select 'area', ar.city_id || ':' || ar.id, ar.name, ar.city_id, ar.city_id, ar.id, null, 1
    from public.areas ar, q, sc where ar.name ilike q.pat and (sc.cities is null or ar.city_id = any (sc.cities))
    union all
    select 'city', ci.id, ci.name, ci.region_id, ci.id, null, null, 1
    from public.cities ci, q where ci.name ilike q.pat
    union all
    select 'category', ca.id, ca.label, null, null, null, null, 2
    from public.categories ca, q where ca.label ilike q.pat
  ) r (kind, id, title, subtitle, city_id, area_id, starts_at, rank)
  where char_length(btrim(coalesce(p_q, ''))) >= 1
  order by rank desc, starts_at nulls last, title
  limit least(greatest(p_limit, 1), 100)
$$;
