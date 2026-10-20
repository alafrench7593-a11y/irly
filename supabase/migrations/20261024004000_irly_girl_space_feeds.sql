-- IRLY Girl space: the IRL feed and the recommendations, women only.
--
-- IRLY Girl is now the same app as IRLY in another space (the app keeps
-- the space it is in). In that space the Live tab and the Home's « For you »
-- must show what women share and plan, not the whole city. Two new
-- functions, next to the ones the installed apps call (irl_feed(text) and
-- recommend_activities(text, integer) are not touched: same signatures,
-- same rows, same grants):
--
-- - irl_feed_girl(p_city): the IRL feed, only posts by women who have
--   IRLY Girl access (private.girl_eligible_unchecked of the author).
-- - recommend_activities_girl(p_city, p_limit): the recommendations, only
--   women-only (girl_only) activities, same scoring and same columns.
--
-- Both refuse (42501) when the caller has no IRLY Girl access, as
-- girl_feed does. Both are security invoker: the posts' and activities'
-- read rules still decide every row, and the women-only filter only takes
-- rows away. New names rather than an extra parameter, so PostgREST never
-- has two candidates for one call.

-- ───────── 1. irl_feed_girl ─────────
create or replace function public.irl_feed_girl(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer, media_ratio real)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds,
    i.media_ratio
  from (
    -- The posts I may see (their read rule) by women with IRLY Girl access, newest first.
    select x.* from public.irl_posts x
    where x.city_id = any (private.city_scope(p_city)) and x.expires_at > now()
      and private.girl_eligible_unchecked(x.author_id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = x.id::text)
    order by x.created_at desc, x.id desc
  ) i
  cross join lateral (select pp.first_name from public.profiles_public pp where pp.id = i.author_id offset 0) p
  left join public.activities a on a.id = i.activity_id
  order by i.created_at desc, i.id desc
  limit 100;
end $$;

-- ───────── 2. recommend_activities_girl ─────────
create or replace function public.recommend_activities_girl(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text, city_id text)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  with me as (
    select coalesce(p.interests, '{}') || coalesce(p.sports, '{}') || coalesce(p.activity_prefs, '{}') as tastes
    from public.profiles p where p.id = auth.uid()
  ),
  liked_cats as (
    select distinct a.category_id from public.activities a
    join (select l.target_id from public.likes l where l.user_id = auth.uid() and l.target_type = 'activity'
          union select s.target_id from public.saves s where s.user_id = auth.uid() and s.target_type = 'activity') t
      on t.target_id = a.id::text
  ),
  friends as materialized (
    select case when f.user_a = auth.uid() then f.user_b else f.user_a end as fid
    from public.friendships f
    where f.status = 'accepted' and (f.user_a = auth.uid() or f.user_b = auth.uid())
  ),
  friends_in as materialized (
    select x.activity_id as aid, count(*)::int as n
    from public.activity_participants x
    where x.status = 'going' and x.user_id in (select fr.fid from friends fr)
    group by x.activity_id
  ),
  scored as (
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at, a.city_id,
      private.going_count(a.id) as going,
      coalesce((select fi.n from friends_in fi where fi.aid = a.id), 0) as friends_going,
      (a.category_id = any (coalesce((select m.tastes from me m), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select m.tastes from me m), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select m.tastes from me m), '{}'))) as taste,
      a.category_id in (select lc.category_id from liked_cats lc) as liked_before
    from public.activities a
    where a.girl_only
      and a.city_id = any (private.city_scope(p_city)) and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      and not private.i_participate(a.id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or private.going_count(a.id) < a.capacity)
  ),
  ranked as (
    select s.*,
      (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
        + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10)
        + case when s.city_id = p_city then 12 else 0 end)::int as pts
    from scored s
  )
  select r.id, r.title, r.format, r.category_id, r.area_id, r.starts_at, r.going, r.friends_going, r.pts,
    case when r.friends_going > 0 then 'friends_going' when r.taste then 'your_interests'
      when r.liked_before then 'you_liked_similar' when r.starts_at < now() + interval '2 days' then 'soon' else 'popular' end,
    r.city_id
  from ranked r
  order by r.pts desc, r.starts_at
  limit least(greatest(p_limit, 1), 50);
end $$;

revoke all on function public.irl_feed_girl(text) from public, anon;
grant execute on function public.irl_feed_girl(text) to authenticated;
revoke all on function public.recommend_activities_girl(text, integer) from public, anon;
grant execute on function public.recommend_activities_girl(text, integer) to authenticated;
