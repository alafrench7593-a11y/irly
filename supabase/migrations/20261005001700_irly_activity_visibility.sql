-- activity_visibility is enforced: who can see that a member joined an
-- activity (participant rows, including realtime). Yourself, the creator
-- and people also going always can; otherwise the member's setting decides
-- (everyone / friends / communities / nobody).
-- Counts stay exact for everyone who can see the activity, through
-- private.going_count() and the computed column activities.going.

create or replace function private.participant_visible(aid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = auth.uid()
    or exists (select 1 from public.activities a where a.id = aid and auth.uid() is not null and a.creator_id in (auth.uid(), uid))
    or exists (select 1 from public.activity_participants x where x.activity_id = aid and x.user_id = auth.uid() and x.status = 'going')
    or private.visible_to(auth.uid(), uid, (select s.activity_visibility from public.safety_settings s where s.user_id = uid))
$$;
revoke all on function private.participant_visible(uuid, uuid) from public, anon;
grant execute on function private.participant_visible(uuid, uuid) to authenticated;

drop policy if exists participants_read on public.activity_participants;
create policy participants_read on public.activity_participants for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id) and private.participant_visible(activity_id, user_id));

-- PostgREST computed column: select=...,going on activities.
create or replace function public.going(a public.activities) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.activity_participants where activity_id = a.id and status = 'going'
$$;
revoke all on function public.going(public.activities) from public, anon;
grant execute on function public.going(public.activities) to authenticated;

create or replace function public.activity_detail(p_id uuid)
returns table (id uuid, creator_id uuid, creator_name text, format text, title text, description text, category_id text,
  city_id text, area_id text, place_name text, starts_at timestamptz, ends_at timestamptz, price_minor integer, currency text,
  capacity integer, going integer, girl_only boolean, community_id uuid, cover_url text, my_status text, conversation_id uuid,
  cancelled boolean)
language sql stable security invoker set search_path = public as $$
  select a.id, a.creator_id, p.first_name, a.format, a.title, a.description, a.category_id, a.city_id, a.area_id, a.place_name,
    a.starts_at, a.ends_at, a.price_minor, a.currency, a.capacity,
    private.going_count(a.id),
    a.girl_only, a.community_id, a.cover_url,
    (select x.status from public.activity_participants x where x.activity_id = a.id and x.user_id = auth.uid()),
    (select c.id from public.conversations c where c.activity_id = a.id and private.is_member(c.id)),
    a.cancelled_at is not null
  from public.activities a
  left join public.profiles_public p on p.id = a.creator_id
  where a.id = p_id
$$;


create or replace function public.recommend_activities(p_city text, p_limit integer default 20)
returns table (id uuid, title text, format text, category_id text, area_id text, starts_at timestamptz, going integer,
  friends_going integer, score integer, reason text)
language sql stable security invoker set search_path = public as $$
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
    select a.id, a.title, a.format, a.category_id, a.area_id, a.starts_at,
      private.going_count(a.id) as going,
      (select count(*)::int from public.activity_participants x
        where x.activity_id = a.id and x.status = 'going' and private.are_friends(auth.uid(), x.user_id)) as friends_going,
      (a.category_id = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.sub_id, '') = any (coalesce((select tastes from me), '{}'))
        or coalesce(a.catalog_activity_id, '') = any (coalesce((select tastes from me), '{}'))) as taste,
      a.category_id in (select category_id from liked_cats) as liked_before
    from public.activities a
    where a.city_id = p_city and a.cancelled_at is null
      and a.starts_at between now() and now() + interval '21 days'
      and a.creator_id <> auth.uid()
      and not private.i_participate(a.id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid()
        and h.target_type = 'activity' and h.target_id = a.id::text)
      and (a.capacity is null or private.going_count(a.id) < a.capacity)
  )
  select s.id, s.title, s.format, s.category_id, s.area_id, s.starts_at, s.going, s.friends_going,
    (case when s.taste then 40 else 0 end + least(s.friends_going, 3) * 15 + case when s.liked_before then 15 else 0 end
      + case when s.starts_at < now() + interval '2 days' then 10 else 0 end + least(s.going, 10))::int,
    case when s.friends_going > 0 then 'friends_going' when s.taste then 'your_interests'
      when s.liked_before then 'you_liked_similar' when s.starts_at < now() + interval '2 days' then 'soon' else 'popular' end
  from scored s
  order by 9 desc, s.starts_at
  limit least(greatest(p_limit, 1), 50)
$$;

create or replace function public.place_activities(p_slug text)
returns table (id uuid, title text, activity_type text, audience text, starts_at timestamptz, going integer)
language sql stable security invoker set search_path = public as $$
  select a.id, a.title, a.activity_type, a.audience, a.starts_at,
    private.going_count(a.id)
  from public.activities a
  join public.places p on p.id = a.place_id and p.slug = p_slug
  where a.cancelled_at is null and a.starts_at > now() - interval '2 hours'
  order by a.starts_at
  limit 20
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.going_count(uuid), private.participant_visible(uuid, uuid) to authenticated;
