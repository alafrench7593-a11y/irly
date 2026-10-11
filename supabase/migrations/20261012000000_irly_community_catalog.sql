-- IRLY Community catalog, completed: the themes members ask for that had no
-- official community yet (expats, wellness, art & music, shopping, families,
-- nights out). Same rules as the first topics: one community per topic and
-- city, created once (ensure_official_communities is safe to run again),
-- recommended from the member's own answers, joined only by choice.

insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort) values
  ('expats', 'IRLY Expats', 'Living abroad: share tips, languages and a sense of home.', '🌍',
    '{type:expat,type:nomad,interest:languages}', '{dubai,abudhabi,bali}', false, false, 2),
  ('wellness', 'IRLY Wellness', 'Yoga, breathwork and feeling good, together.', '🧘',
    '{interest:wellness,activity:yoga}', '{dubai,abudhabi,bali}', false, false, 14),
  ('culture', 'IRLY Culture', 'Art, music, galleries and concerts to discover together.', '🎨',
    '{interest:art,interest:music}', '{dubai,abudhabi,bali}', false, false, 23),
  ('nights', 'IRLY Nights', 'Rooftops, live music and evenings out with good people.', '🌙',
    '{interest:nightlife,interest:music}', '{dubai,abudhabi,bali}', false, false, 24),
  ('shopping', 'IRLY Shopping', 'Markets, malls and fashion finds to share.', '🛍️',
    '{interest:fashion}', '{dubai,abudhabi}', false, false, 25),
  ('families', 'IRLY Families', 'Parents and kids: weekend plans and playdates.', '👨‍👩‍👧',
    '{interest:family}', '{dubai,abudhabi,bali}', false, false, 42)
on conflict (topic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji,
  match_tags = excluded.match_tags, cities = excluded.cities, girl_only = excluded.girl_only,
  intro_first = excluded.intro_first, sort = excluded.sort;

select private.ensure_official_communities();

-- ───────── Match IRLY: people worth meeting, for everyone ─────────
-- Real members ranked by what they share with me, from what each of them
-- declared: interests 3, activities and sports 2, goals 2, languages 1, the
-- same city 2. Only people who share something; never me, never someone
-- deleted or blocked either way, never someone whose profile I may not see,
-- never a friend already (they are found). Only the shared items are
-- returned, nothing else from their profile. A match is a suggestion:
-- becoming friends is still Add friend, accepted by the other person.
-- « Not now » hides someone for 30 days, so the same faces do not repeat.

create table if not exists public.people_match_skips (
  user_id uuid not null references public.profiles (id) on delete cascade,
  other_id uuid not null references public.profiles (id) on delete cascade,
  until timestamptz not null,
  primary key (user_id, other_id)
);
alter table public.people_match_skips enable row level security;
drop policy if exists people_match_skips_own on public.people_match_skips;
create policy people_match_skips_own on public.people_match_skips for select to authenticated using (user_id = auth.uid());

create or replace function public.people_match_skip(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'that is you' using errcode = '22023'; end if;
  insert into public.people_match_skips (user_id, other_id, until) values (auth.uid(), p_user, now() + interval '30 days')
  on conflict (user_id, other_id) do update set until = excluded.until;
end $$;
revoke all on function public.people_match_skip(uuid) from public, anon;
grant execute on function public.people_match_skip(uuid) to authenticated;

create or replace function public.people_match(p_city text, p_limit integer default 20, p_offset integer default 0)
returns table (id uuid, first_name text, photo_path text, username text, city_id text, score integer,
  shared_interests text[], shared_activities text[], shared_goals text[], shared_languages text[], friend_status text, i_follow boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select p.id, p.city_id, p.interests, p.activity_prefs || p.sports as acts, p.intentions, p.languages
    from public.profiles p where p.id = auth.uid() and p.deleted_at is null
  ),
  cand as (
    select o.id, o.first_name, o.photo_paths[1] as photo_path, o.username, o.city_id,
      array(select unnest(o.interests) intersect select unnest(me.interests)) as si,
      array(select unnest(o.activity_prefs || o.sports) intersect select unnest(me.acts)) as sa,
      array(select unnest(o.intentions) intersect select unnest(me.intentions)) as sg,
      array(select unnest(o.languages) intersect select unnest(me.languages)) as sl,
      o.city_id = me.city_id as same_city
    from public.profiles o, me
    where o.id <> me.id and o.deleted_at is null
      and o.city_id = any (private.city_scope(p_city))
      and not private.blocked_unchecked(me.id, o.id)
      and private.visible_to(me.id, o.id, (select s.profile_visibility from public.safety_settings s where s.user_id = o.id))
      and not private.friends_unchecked(me.id, o.id)
      and not exists (select 1 from public.people_match_skips k where k.user_id = me.id and k.other_id = o.id and k.until > now())
  )
  select c.id, c.first_name, c.photo_path, c.username, c.city_id,
    (3 * cardinality(c.si) + 2 * cardinality(c.sa) + 2 * cardinality(c.sg) + cardinality(c.sl) + case when c.same_city then 2 else 0 end)::int,
    c.si, c.sa, c.sg, c.sl,
    private.friend_status(auth.uid(), c.id),
    exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followee_id = c.id)
  from cand c
  where cardinality(c.si) + cardinality(c.sa) + cardinality(c.sg) > 0
  order by 6 desc, md5(c.id::text || auth.uid()::text || current_date::text)
  limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke all on function public.people_match(text, integer, integer) from public, anon;
grant execute on function public.people_match(text, integer, integer) to authenticated;
