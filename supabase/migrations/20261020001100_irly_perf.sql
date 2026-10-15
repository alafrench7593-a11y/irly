-- Speed of three reads the app makes on every visit, same rules, same rows.
--
-- 1. irl_feed (the Live tab, reloaded on every new post) and activity_detail
--    (every activity page, reloaded on every join) joined profiles_public,
--    a security_barrier view, for the author's first name. A plain join to
--    such a view cannot be driven by the author's id: Postgres computed the
--    whole view first, i.e. ran blocked_unchecked() for EVERY member, then
--    kept the one or hundred it needed. Measured on 20,000 members:
--    activity_detail 51 ms (48 ms of it that scan), irl_feed 115 ms.
--    The name is now looked up per row (a lateral subquery that is not
--    flattened, so the view's own filter still applies, by primary key), and
--    irl_feed looks names up only for the 100 posts it returns (posts made
--    in the same instant now keep one order, so a reload never swaps which
--    of them make the 100).
-- 2. recommend_activities (Activities tab, assistant; reloaded after every
--    create, join or leave) counted friends going by calling are_friends()
--    for every participant of every upcoming activity of the destination:
--    8 s of 9.4 s with 10,000 upcoming activities, over the API's statement
--    timeout, so the list silently stayed empty. My friends are now read
--    once, and only their own participation rows are counted (still through
--    the participants' read rule, as before).
-- Same signatures, same results; nothing is dropped.

-- ───────── 1a. irl_feed ─────────
create or replace function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer, media_ratio real)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds,
    i.media_ratio
  from (
    -- The posts I may see (their read rule), newest first: the name lookups
    -- below stop once 100 of them are found.
    select i.* from public.irl_posts i
    where i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = i.id::text)
    order by i.created_at desc, i.id desc
  ) i
  -- offset 0: looked up per post by the author's id, through the view's own filter.
  cross join lateral (select pp.first_name from public.profiles_public pp where pp.id = i.author_id offset 0) p
  left join public.activities a on a.id = i.activity_id
  -- Posts made in the same instant keep one order: a reload never swaps which of them make the 100.
  order by i.created_at desc, i.id desc
  limit 100
$$;

-- ───────── 1b. activity_detail ─────────
create or replace function public.activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer,
  currency text, capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text,
  my_status text, conversation_id uuid, cancelled boolean, sub_id text)
language sql stable set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, coalesce(a.cover_path, a.cover_url),
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null,
    a.sub_id
  from public.activities a
  -- offset 0: the creator's row only (by primary key), through the view's own filter.
  left join lateral (select pp.first_name from public.profiles_public pp where pp.id = a.creator_id offset 0) p on true
  where a.id = p_id
$$;

-- ───────── 2. recommend_activities ─────────
create or replace function public.recommend_activities(p_city text, p_limit integer default 20)
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
  -- My accepted friends, read once (are_friends(me, x) for each participant before).
  friends as materialized (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as id
    from public.friendships f
    where f.status = 'accepted' and (f.user_a = auth.uid() or f.user_b = auth.uid())
  ),
  -- Friends going, per activity: only my friends' participation rows, through their read rule as before.
  friends_in as materialized (
    select x.activity_id, count(*)::int as n
    from public.activity_participants x
    where x.status = 'going' and x.user_id in (select f.id from friends f)
    group by x.activity_id
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at, a.city_id,
      private.going_count(a.id) as going,
      coalesce((select fi.n from friends_in fi where fi.activity_id = a.id), 0) as friends_going,
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
-- Grants are kept by create or replace; restated for a fresh database.
revoke all on function public.irl_feed(text) from public, anon;
grant execute on function public.irl_feed(text) to authenticated;
revoke all on function public.activity_detail(uuid) from public, anon;
grant execute on function public.activity_detail(uuid) to authenticated;
revoke all on function public.recommend_activities(text, integer) from public, anon;
grant execute on function public.recommend_activities(text, integer) to authenticated;
