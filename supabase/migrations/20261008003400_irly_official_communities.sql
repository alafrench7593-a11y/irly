-- IRLY Community: official communities created and run by IRLY, one per
-- topic and city (IRLY Gym → Dubai → members). Topics are rows, not code:
-- IRLY adds a topic (or a city to a topic) and its communities appear.
-- New members get recommendations from their own onboarding answers only,
-- scored here; joining is always their choice.

create table if not exists public.community_topics (
  topic text primary key check (topic ~ '^[a-z][a-z0-9_]{1,30}$'),
  name text not null,
  tagline text not null,
  emoji text not null default '',
  -- What the topic matches in a member's answers: 'interest:…', 'activity:…',
  -- 'goal:…', 'type:…', 'newcomer'. Weights live in community_recommend().
  match_tags text[] not null default '{}',
  cities text[] not null default '{}',
  girl_only boolean not null default false,
  -- Introductions are strongly suggested here (newcomers), optional elsewhere.
  intro_first boolean not null default false,
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.community_topics enable row level security;
drop policy if exists community_topics_read on public.community_topics;
create policy community_topics_read on public.community_topics for select to authenticated using (active);

alter table public.communities add column if not exists official boolean not null default false;
alter table public.communities add column if not exists topic text references public.community_topics (topic) on delete set null;
create unique index if not exists communities_official_topic_city on public.communities (topic, city_id) where official and deleted_at is null;

-- Members cannot turn their community into an official one (or take one over).
drop trigger if exists communities_edit_guard on public.communities;
create trigger communities_edit_guard before update on public.communities
for each row execute function private.edit_guard('created_by', 'girl_only', 'created_at', 'official', 'topic');

create or replace function private.official_insert_guard() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if (new.official or new.topic is not null) and auth.uid() is not null and not private.is_admin(auth.uid()) then
    raise exception 'only IRLY creates official communities' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists communities_official_guard on public.communities;
create trigger communities_official_guard before insert on public.communities
for each row execute function private.official_insert_guard();

-- One community (and its chat) per active topic and city; safe to run again.
create or replace function private.ensure_official_communities() returns integer
language plpgsql security definer set search_path = public as $$
declare
  t public.community_topics;
  city text;
  cid uuid;
  conv uuid;
  made integer := 0;
begin
  for t in select * from public.community_topics where active loop
    foreach city in array t.cities loop
      select id into cid from public.communities where official and topic = t.topic and city_id = city and deleted_at is null;
      if cid is null then
        insert into public.communities (city_id, name, tagline, category_id, girl_only, created_by, official, topic)
        values (city, t.name, t.tagline, null, t.girl_only, null, true, t.topic)
        returning id into cid;
        conv := private.ensure_conversation('community', cid, t.name);
        insert into public.messages (conversation_id, sender_id, kind, body)
        values (conv, null, 'system', 'Welcome to ' || t.name || ' 👋 Introduce yourself, be kind and help others feel welcome.');
        made := made + 1;
      else
        update public.communities set name = t.name, tagline = t.tagline where id = cid and (name <> t.name or tagline is distinct from t.tagline);
      end if;
      cid := null;
    end loop;
  end loop;
  return made;
end $$;
revoke all on function private.ensure_official_communities() from public, anon, authenticated;

insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort) values
  ('newcomers', 'IRLY Newcomers', 'New to the city? Meet people who are discovering it too.', '👋',
    '{newcomer,type:expat,type:nomad,type:student,goal:friends}', '{dubai,abudhabi,bali}', false, true, 1),
  ('gym', 'IRLY Gym', 'Find people who train and stay active.', '🏋️',
    '{activity:gym,activity:boxing,interest:wellness,goal:sport}', '{dubai,abudhabi,bali}', false, false, 10),
  ('sport', 'IRLY Sport', 'Play, train and stay active together.', '🏅',
    '{interest:sports,goal:sport,activity:padel,activity:tennis,activity:basketball,activity:volleyball,activity:cycling,activity:swimming}', '{dubai,abudhabi,bali}', false, false, 11),
  ('football', 'IRLY Football', 'Play, watch and talk football with people around you.', '⚽',
    '{activity:football}', '{dubai,abudhabi}', false, false, 12),
  ('running', 'IRLY Running', 'Run together, from sunrise 5Ks to race days.', '🏃',
    '{activity:running}', '{dubai,abudhabi}', false, false, 13),
  ('trip', 'IRLY Trip', 'Discover the city and travel with others.', '✈️',
    '{interest:travel,goal:travel,interest:outdoors,activity:hiking}', '{dubai,abudhabi,bali}', false, false, 20),
  ('beach', 'IRLY Beach', 'Beach days, water sports and sunsets with good people.', '🏖️',
    '{activity:beach,activity:surf,activity:kayak,interest:outdoors}', '{dubai,abudhabi,bali}', false, false, 21),
  ('food', 'IRLY Food', 'New spots, brunches and dinners to share.', '🍽️',
    '{interest:food,goal:food}', '{dubai,abudhabi,bali}', false, false, 22),
  ('network', 'IRLY Network', 'Meet people interested in business and networking.', '🤝',
    '{goal:networking,interest:business,type:professional,activity:networking}', '{dubai,abudhabi,bali}', false, false, 30),
  ('entrepreneurs', 'IRLY Entrepreneurs', 'Founders and builders who meet, share and grow.', '💼',
    '{interest:startups,type:entrepreneur,interest:business}', '{dubai,abudhabi,bali}', false, false, 31),
  ('ecom', 'IRLY Ecom', 'E-commerce founders and sellers sharing what works.', '🛒',
    '{type:entrepreneur,interest:startups}', '{dubai}', false, false, 32),
  ('tech', 'IRLY Tech', 'Developers, product people and tech lovers.', '💻',
    '{interest:tech,type:professional}', '{dubai,abudhabi}', false, false, 33),
  ('ai', 'IRLY AI', 'Builders and curious minds exploring AI.', '🤖',
    '{interest:tech,interest:startups}', '{dubai}', false, false, 34),
  ('girls', 'IRLY Girls', 'Women meeting women: plans, advice and friendship.', '💗',
    '{goal:irlygirl,goal:friends}', '{dubai,abudhabi,bali}', true, false, 40),
  ('moms', 'IRLY Moms', 'Mums meeting mums, with or without the kids.', '🍼',
    '{interest:family}', '{dubai,abudhabi}', true, false, 41)
on conflict (topic) do update set name = excluded.name, tagline = excluded.tagline, emoji = excluded.emoji,
  match_tags = excluded.match_tags, cities = excluded.cities, girl_only = excluded.girl_only,
  intro_first = excluded.intro_first, sort = excluded.sort;

select private.ensure_official_communities();

-- Recommendations from the member's own answers (tags sent by the app from
-- the onboarding), scored: newcomer and interests 3, activities and goals 2,
-- who you are 1, the member's own city 2, an already active community 1
-- (at least 10 real members). Only communities that match something.
create or replace function public.community_recommend(p_city text, p_tags text[], p_limit integer default 6)
returns table (id uuid, topic text, name text, tagline text, emoji text, girl_only boolean, intro_first boolean,
  members integer, is_member boolean, score integer, city_id text)
language sql stable security invoker set search_path = public as $$
  with mine as (select distinct unnest(coalesce(p_tags, '{}')) as tag),
  cand as (
    select c.id, t.topic, c.name, c.tagline, t.emoji, c.girl_only, t.intro_first, c.city_id, t.sort,
      (select count(*)::int from public.community_members m where m.community_id = c.id) as members,
      private.i_belong(c.id) as is_member,
      (select coalesce(sum(case
          when m.tag = 'newcomer' then 3
          when m.tag like 'interest:%' then 3
          when m.tag like 'activity:%' or m.tag like 'goal:%' then 2
          when m.tag like 'type:%' then 1
          else 0 end), 0)::int
        from mine m where m.tag = any (t.match_tags)) as base
    from public.communities c
    join public.community_topics t on t.topic = c.topic and t.active
    where c.official and c.deleted_at is null
      and c.city_id = any (private.city_scope(p_city))
      -- RLS hides girls-only communities from members who are not eligible.
  ),
  -- One community per topic: the member's city first.
  best as (
    select distinct on (topic) * from cand where base > 0
    order by topic, (city_id = p_city) desc, members desc
  )
  select id, topic, name, tagline, emoji, girl_only, intro_first, members, is_member,
    base + (case when city_id = p_city then 2 else 0 end) + (case when members >= 10 then 1 else 0 end) as score, city_id
  from best
  order by score desc, sort, name
  limit greatest(1, least(coalesce(p_limit, 6), 20))
$$;
revoke all on function public.community_recommend(text, text[], integer) from public, anon;
grant execute on function public.community_recommend(text, text[], integer) to authenticated;

-- The list says which communities are IRLY's own (new columns at the end).
drop function if exists public.community_list(text);
create function public.community_list(p_city text)
returns table (id uuid, name text, tagline text, category_id text, girl_only boolean, members integer, is_member boolean,
  posts_week integer, city_id text, official boolean, topic text, emoji text, created_at timestamptz)
language sql stable set search_path = public as $$
  select c.id, c.name, c.tagline, c.category_id, c.girl_only,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    private.i_belong(c.id),
    (select count(*)::int from public.community_posts p where p.community_id = c.id and p.deleted_at is null and p.created_at > now() - interval '7 days'),
    c.city_id, c.official, c.topic, t.emoji, c.created_at
  from public.communities c
  left join public.community_topics t on t.topic = c.topic
  where c.city_id = any (private.city_scope(p_city)) and c.deleted_at is null
  order by (c.city_id = p_city) desc, 8 desc, 6 desc, c.name
  limit 200
$$;
revoke all on function public.community_list(text) from public, anon;
grant execute on function public.community_list(text) to authenticated;

-- Joining several at once (Join all), each with the usual checks.
create or replace function public.join_communities(p_ids uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  n integer := 0;
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '42501'; end if;
  foreach cid in array coalesce(p_ids, '{}') loop
    begin
      perform public.join_community(cid);
      n := n + 1;
    exception when others then
      -- A community the member may not join (girls-only, gone) is skipped.
      null;
    end;
  end loop;
  return n;
end $$;
revoke all on function public.join_communities(uuid[]) from public, anon;
grant execute on function public.join_communities(uuid[]) to authenticated;

-- A new member in an official community: one light line in the chat, so
-- people can say hello. Nothing is sent to anyone's notifications.
create or replace function private.official_member_joined() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  c public.communities;
  conv uuid;
  who text;
begin
  select * into c from public.communities where id = new.community_id;
  if not c.official then return new; end if;
  select id into conv from public.conversations where community_id = c.id;
  if conv is null then return new; end if;
  select first_name into who from public.profiles where id = new.user_id;
  insert into public.messages (conversation_id, sender_id, kind, body)
  values (conv, null, 'system', coalesce(nullif(trim(who), ''), 'Someone') || ' just joined 👋 Say hello!');
  return new;
end $$;
drop trigger if exists community_members_official_joined on public.community_members;
create trigger community_members_official_joined after insert on public.community_members
for each row execute function private.official_member_joined();
