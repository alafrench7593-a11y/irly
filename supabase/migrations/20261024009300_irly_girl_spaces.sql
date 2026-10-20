-- IRLY Girl before launch: the Live of each space stays in its space, and
-- IRLY Girl's official communities are the five IRLY runs for it.
--
-- 1. The Live (irl_posts) gets the space it was posted in: app_scope,
--    'irly' (IRLY) or 'irly_girl' (IRLY Girl). Until now the IRLY Girl Live
--    showed every post by a woman with IRLY Girl access, the ones she shared
--    in IRLY too, and IRLY's Live showed hers from IRLY Girl.
--    - post_live() stores the space the app sends (p_post ->> 'scope');
--      an app that sends none posts in IRLY, as before.
--    - irl_feed() (IRLY) lists 'irly' posts only; irl_feed_girl() (IRLY
--      Girl) lists 'irly_girl' posts only.
--    - The read rule (RLS) shows an 'irly_girl' post to its author and to
--      members with IRLY Girl access only: a direct REST read, a Realtime
--      event or member_lives() from anyone else never returns it. The insert
--      rule refuses 'irly_girl' to anyone without that access.
--    - member_lives(p_user, p_scope) lists the lives of one space.
--    Existing posts (all gone after 4 hours anyway) stay in IRLY.
--
-- 2. IRLY Girl's official communities: IRLY Nouvelle Arrivante, IRLY Girl
--    Networking, IRLY Francophone, IRLY Girl Trip and IRLY Activité, in
--    Dubai, women only. Made once each (communities_official_topic_city is
--    unique; ensure_official_communities() only creates what is missing),
--    never deleted. Nothing else changes: the existing IRLY Girl and IRLY
--    Moms communities, their groups, members, posts and chats stay as they
--    are (the app no longer features them as IRLY Girl's official ones).
--    girl_official_communities() lists the five.

-- ───────── 1. The Live's space ─────────
alter table public.irl_posts add column if not exists app_scope text not null default 'irly';
do $$ begin
  alter table public.irl_posts add constraint irl_posts_app_scope check (app_scope in ('irly', 'irly_girl'));
exception when duplicate_object then null; end $$;
create index if not exists irl_posts_scope_feed_idx on public.irl_posts (app_scope, city_id, created_at desc);

-- Read: as before, and an IRLY Girl post only for its author and IRLY Girl members.
drop policy if exists irl_posts_read on public.irl_posts;
create policy irl_posts_read on public.irl_posts for select to authenticated using (
  (author_id = auth.uid())
  or (
    expires_at > now()
    and not private.is_blocked(auth.uid(), author_id)
    and (app_scope = 'irly' or private.is_girl_eligible())
    and (visibility = 'everyone'
      or (visibility = 'friends' and private.are_friends(auth.uid(), author_id))
      or (visibility = 'close_friends' and private.in_close_friends(author_id))
      or (visibility = 'community' and community_id is not null and private.i_belong(community_id)))
  )
);

-- Insert: as before, and IRLY Girl only with IRLY Girl access.
drop policy if exists irl_posts_insert on public.irl_posts;
create policy irl_posts_insert on public.irl_posts for insert to authenticated with check (
  author_id = auth.uid()
  and expires_at <= now() + interval '4 hours 1 minute'
  and (community_id is null or private.i_belong(community_id))
  and (visibility <> 'community' or community_id is not null)
  and (app_scope = 'irly' or private.is_girl_eligible())
);

-- A post never changes space.
create or replace function private.irl_scope_frozen() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.app_scope is distinct from old.app_scope then
    raise exception 'a Live stays in the space it was posted in' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists irl_posts_scope_frozen on public.irl_posts;
create trigger irl_posts_scope_frozen before update of app_scope on public.irl_posts
  for each row execute function private.irl_scope_frozen();

create or replace function public.post_live(p_post jsonb, p_activity jsonb default null)
returns jsonb
language plpgsql set search_path = public as $$
declare
  me uuid := auth.uid();
  pid uuid;
  aid uuid;
  r record;
  scope text := case when p_post ->> 'scope' in ('girl', 'irly_girl') then 'irly_girl' else 'irly' end;
begin
  if me is null then raise exception 'sign in required' using errcode = '42501'; end if;
  pid := nullif(p_post ->> 'id', '')::uuid;
  if pid is null then raise exception 'a Live needs its id' using errcode = '22023'; end if;
  if scope = 'irly_girl' and not private.is_girl_eligible(me) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('irly-live:' || pid::text, 0));

  -- Saved by an earlier try whose answer got lost: the same Live, as it is.
  select i.id, i.created_at, i.visibility, i.activity_id into r from public.irl_posts i where i.id = pid and i.author_id = me;
  if found then
    return jsonb_build_object('id', r.id, 'created_at', r.created_at, 'visibility', r.visibility, 'activity_id', r.activity_id, 'replayed', true);
  end if;
  if private.live_was_abandoned(pid) then
    raise exception 'this Live was abandoned' using errcode = '22023';
  end if;

  if p_activity is not null then
    -- An older app may have made it already (same client_ref): reuse it while it is on.
    select a.id into aid from public.activities a where a.creator_id = me and a.client_ref = pid and a.cancelled_at is null;
    if aid is null then
      insert into public.activities (
        creator_id, format, title, description, category_id, sub_id, catalog_activity_id, city_id, area_id, place_name,
        starts_at, timezone, price_minor, currency, capacity, privacy, client_ref
      ) values (
        me,
        coalesce(p_activity ->> 'format', 'meetup'),
        p_activity ->> 'title',
        nullif(p_activity ->> 'description', ''),
        coalesce(p_activity ->> 'category_id', 'entertainment'),
        p_activity ->> 'sub_id',
        p_activity ->> 'catalog_activity_id',
        coalesce(p_activity ->> 'city_id', p_post ->> 'city_id'),
        coalesce(p_activity ->> 'area_id', p_post ->> 'area_id'),
        p_activity ->> 'place_name',
        (p_activity ->> 'starts_at')::timestamptz,
        coalesce(p_activity ->> 'timezone', 'Asia/Dubai'),
        coalesce((p_activity ->> 'price_minor')::integer, 0),
        coalesce(p_activity ->> 'currency', 'AED'),
        (p_activity ->> 'capacity')::integer,
        coalesce(p_activity ->> 'privacy', 'public'),
        pid
      ) returning id into aid;
    end if;
  end if;

  insert into public.irl_posts (
    id, author_id, city_id, area_id, place_name, body, media_path, media_kind, thumb_path, media_seconds, media_ratio, visibility, activity_id, app_scope
  ) values (
    pid, me,
    p_post ->> 'city_id',
    p_post ->> 'area_id',
    p_post ->> 'place_name',
    coalesce(p_post ->> 'body', ''),
    p_post ->> 'media_path',
    coalesce(p_post ->> 'media_kind', 'photo'),
    p_post ->> 'thumb_path',
    (p_post ->> 'media_seconds')::integer,
    (p_post ->> 'media_ratio')::real,
    coalesce(p_post ->> 'visibility', private.default_irl_visibility()),
    aid,
    scope
  ) returning id, created_at, visibility, activity_id into r;
  return jsonb_build_object('id', r.id, 'created_at', r.created_at, 'visibility', r.visibility, 'activity_id', r.activity_id, 'replayed', false);
end $$;

create or replace function public.irl_feed(p_city text)
returns table (id uuid, author_id uuid, first_name text, area_id text, place_name text, body text, media_path text,
  visibility text, created_at timestamptz, friend boolean, activity_id uuid, activity_title text, city_id text,
  media_kind text, thumb_path text, media_seconds integer, media_ratio real)
language sql stable set search_path = public as $$
  select i.id, i.author_id, p.first_name, i.area_id, i.place_name, i.body, i.media_path, i.visibility, i.created_at,
    private.are_friends(auth.uid(), i.author_id), a.id, a.title, i.city_id, i.media_kind, i.thumb_path, i.media_seconds,
    i.media_ratio
  from (
    -- IRLY's posts I may see (their read rule), newest first: the name lookups
    -- below stop once 100 of them are found.
    select i.* from public.irl_posts i
    where i.app_scope = 'irly' and i.city_id = any (private.city_scope(p_city)) and i.expires_at > now()
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
    -- IRLY Girl's posts I may see, by women who still have IRLY Girl access, newest first.
    select x.* from public.irl_posts x
    where x.app_scope = 'irly_girl' and x.city_id = any (private.city_scope(p_city)) and x.expires_at > now()
      and private.girl_eligible_unchecked(x.author_id)
      and not exists (select 1 from public.hidden_items h where h.user_id = auth.uid() and h.target_type = 'irl_post' and h.target_id = x.id::text)
    order by x.created_at desc, x.id desc
  ) i
  cross join lateral (select pp.first_name from public.profiles_public pp where pp.id = i.author_id offset 0) p
  left join public.activities a on a.id = i.activity_id
  order by i.created_at desc, i.id desc
  limit 100;
end $$;

-- A member's lives, in one space (IRLY by default: what installed apps call).
drop function if exists public.member_lives(uuid);
create or replace function public.member_lives(p_user uuid, p_scope text default 'irly')
returns table (id uuid, body text, media_path text, area_id text, place_name text, created_at timestamptz,
  expires_at timestamptz, live boolean, media_kind text, thumb_path text, media_seconds integer)
language sql stable set search_path = public as $$
  select i.id, i.body, i.media_path, i.area_id, i.place_name, i.created_at, i.expires_at, i.expires_at > now(),
    i.media_kind, i.thumb_path, i.media_seconds
  from public.irl_posts i
  where i.author_id = p_user and auth.uid() is not null
    and i.app_scope = case when p_scope in ('girl', 'irly_girl') then 'irly_girl' else 'irly' end
    and (p_user = auth.uid() or (not private.is_blocked(auth.uid(), p_user) and private.discoverable(p_user)))
  order by i.created_at desc
  limit 60
$$;
revoke all on function public.member_lives(uuid, text) from public, anon;
grant execute on function public.member_lives(uuid, text) to authenticated;

-- ───────── 2. IRLY Girl's five official communities ─────────
-- No match tags: community_recommend() (IRLY's onboarding and « For you ») never
-- picks them; IRLY Girl lists them with girl_official_communities().
insert into public.community_topics (topic, name, tagline, emoji, match_tags, cities, girl_only, intro_first, sort, active) values
  ('girl_newcomers', 'IRLY Nouvelle Arrivante', 'Just arrived in Dubai? Ask anything, get tips and meet other newcomers.', '👋',
    '{}', '{dubai}', true, true, 1, true),
  ('girl_network', 'IRLY Girl Networking', 'Women in business: entrepreneurship, opportunities, collaborations and your network.', '💼',
    '{}', '{dubai}', true, false, 2, true),
  ('girl_francophone', 'IRLY Francophone', 'French-speaking girls in Dubai: chats, meetups and activities in French.', '🥐',
    '{}', '{dubai}', true, false, 3, true),
  ('girl_trip', 'IRLY Girl Trip', 'Trips, excursions, getaways and road trips between girls.', '✈️',
    '{}', '{dubai}', true, false, 4, true),
  ('girl_activity', 'IRLY Activité', 'Sport, outings, restaurants, beach clubs, shopping, wellness and everything to do together.', '✨',
    '{}', '{dubai}', true, false, 5, true)
on conflict (topic) do nothing;

select private.ensure_official_communities();

-- The five, with the caller's membership: the same list on every IRLY Girl page.
create or replace function public.girl_official_communities()
returns table (id uuid, topic text, name text, tagline text, emoji text, members integer, is_member boolean, city_id text, cover_path text)
language plpgsql stable security invoker set search_path = public as $$
#variable_conflict use_column
begin
  if not private.is_girl_eligible(auth.uid()) then
    raise exception 'IRLY Girl is reserved for women' using errcode = '42501';
  end if;
  return query
  select x.id, x.topic, x.name, x.tagline, x.emoji, x.members_count, private.i_belong(x.id), x.city_id, x.cover_path
  from (
    -- One per topic (Dubai's), in IRLY's order.
    select distinct on (t.sort) c.id, c.topic, c.name, c.tagline, coalesce(c.emoji, t.emoji) as emoji, c.members_count,
      c.city_id, c.cover_path, t.sort
    from public.communities c
    join public.community_topics t on t.topic = c.topic
    where c.official and c.deleted_at is null and c.parent_id is null and c.girl_only
      and c.topic in ('girl_newcomers', 'girl_network', 'girl_francophone', 'girl_trip', 'girl_activity')
    order by t.sort, c.city_id = 'dubai' desc, c.created_at
  ) x
  order by x.sort;
end $$;
revoke all on function public.girl_official_communities() from public, anon;
grant execute on function public.girl_official_communities() to authenticated;

-- ───────── 3. Everything that carries an IRLY Girl Live stays in IRLY Girl ─────────
-- The read rule already covers comments, likes, saves and shares of a Live
-- (private.can_see reads irl_posts under it), its files (irl_media_read) and
-- Realtime. What runs as the server, and so around that rule, follows the
-- space here.

-- « Anyone can join » from an IRLY Girl Live: the plan is for women only (and its chat an IRLY Girl chat).
-- The Live is inserted after its activity (post_live): its insert sets the plan's audience.
create or replace function private.irl_post_activity_girl() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.app_scope = 'irly_girl' and new.activity_id is not null then
    update public.activities set girl_only = true, audience = case when audience in ('girls', 'moms') then audience else 'girls' end
    where id = new.activity_id and not girl_only;
  end if;
  return new;
end $$;
drop trigger if exists irl_posts_activity_girl on public.irl_posts;
create trigger irl_posts_activity_girl after insert on public.irl_posts
  for each row execute function private.irl_post_activity_girl();

-- Friends are told about a Live only in its space (the notice carries its first words).
create or replace function private.on_irl_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, kind, payload)
  select x.friend, 'IRLY_POST_CREATED',
    jsonb_build_object('post_id', new.id, 'from', new.author_id, 'body', left(new.body, 80), 'area_id', new.area_id)
  from (
    select case when f.user_a = new.author_id then f.user_b else f.user_a end as friend
    from public.friendships f
    where f.status = 'accepted' and new.author_id in (f.user_a, f.user_b)
  ) x
  where (new.app_scope = 'irly' or private.girl_eligible_unchecked(x.friend))
    and (
      new.visibility in ('friends', 'everyone')
      or (new.visibility = 'close_friends' and exists (
        select 1 from public.close_friends c where c.user_id = new.author_id and c.friend_id = x.friend))
    );
  return new;
end $$;

-- Who may see a Live, as the server decides it for notifications: its space too.
create or replace function private.user_can_see(p_user uuid, p_type text, p_id text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid;
  author uuid;
  a public.activities;
  p public.irl_posts;
begin
  if p_type in ('place', 'catalog') then return true; end if;
  if not private.is_uuid(p_id) then return false; end if;
  if p_type = 'community' then
    return exists (select 1 from public.community_members where community_id = p_id::uuid and user_id = p_user);
  elsif p_type = 'community_post' then
    select community_id, author_id into cid, author from public.community_posts where id = p_id::uuid and deleted_at is null;
    if author is null then return false; end if;
    if cid is null then
      return author = p_user or (not private.blocked_unchecked(p_user, author)
        and private.visible_to(p_user, author, (select st.profile_visibility from public.safety_settings st where st.user_id = author)));
    end if;
    return exists (select 1 from public.community_members where community_id = cid and user_id = p_user);
  elsif p_type = 'activity' then
    select * into a from public.activities where id = p_id::uuid;
    if not found or private.blocked_unchecked(p_user, a.creator_id) then return false; end if;
    return a.creator_id = p_user
      or exists (select 1 from public.activity_participants where activity_id = a.id and user_id = p_user)
      or (a.privacy = 'public' and a.cancelled_at is null and (not a.girl_only or private.girl_eligible_unchecked(p_user)));
  elsif p_type = 'irl_post' then
    select * into p from public.irl_posts where id = p_id::uuid;
    if not found then return false; end if;
    if p.author_id = p_user then return true; end if;
    return p.expires_at > now() and not private.blocked_unchecked(p_user, p.author_id)
      and (p.app_scope = 'irly' or private.girl_eligible_unchecked(p_user))
      and (
        p.visibility = 'everyone'
        or (p.visibility = 'friends' and private.friends_unchecked(p.author_id, p_user))
        or (p.visibility = 'close_friends' and exists (select 1 from public.close_friends cf where cf.user_id = p.author_id and cf.friend_id = p_user))
        or (p.visibility = 'community' and p.community_id is not null
            and exists (select 1 from public.community_members cm where cm.community_id = p.community_id and cm.user_id = p_user))
      );
  elsif p_type = 'profile' then
    return not private.blocked_unchecked(p_user, p_id::uuid);
  end if;
  return false;
end $$;

-- An IRLY Girl Live is IRLY Girl content (comments, likes, mentions and shares of it follow).
create or replace function private.girl_target(p_type text, p_id text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if not private.is_uuid(p_id) then return false; end if;
  return case p_type
    when 'activity' then coalesce((select a.girl_only from public.activities a where a.id = p_id::uuid), false)
    when 'community' then coalesce((select c.girl_only from public.communities c where c.id = p_id::uuid), false)
    when 'community_post' then coalesce((select c.girl_only from public.community_posts p join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    when 'irl_post' then coalesce((select p.app_scope = 'irly_girl' or coalesce(c.girl_only, false)
                                   from public.irl_posts p left join public.communities c on c.id = p.community_id where p.id = p_id::uuid), false)
    else false
  end;
end $$;

-- A friend's Live notice is shown only while its reader may see that Live.
create or replace function private.notification_visible(n public.notifications)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  conv uuid;
  cid uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = n.user_id and p.deleted_at is null) then
    return false;
  end if;
  case n.kind
    when 'MESSAGE_CREATED' then
      -- (A message of no existing chat has no text to show: the push says "New message".)
      conv := private.uuid_or_null(n.payload ->> 'conversation_id');
      return conv is null
        or not exists (select 1 from public.conversations v where v.id = conv)
        or (exists (select 1 from public.conversation_members m where m.conversation_id = conv and m.user_id = n.user_id)
            and (not private.girl_chat(conv) or private.girl_eligible_unchecked(n.user_id)));
    when 'COMMENT', 'COMMENT_REPLY', 'MENTION' then
      return private.user_can_see(n.user_id, n.payload ->> 'target_type', n.payload ->> 'target_id')
        and (not private.girl_target(n.payload ->> 'target_type', n.payload ->> 'target_id')
             or private.girl_eligible_unchecked(n.user_id));
    when 'IRLY_POST_CREATED' then
      return private.user_can_see(n.user_id, 'irl_post', n.payload ->> 'post_id')
        and (not private.girl_target('irl_post', n.payload ->> 'post_id') or private.girl_eligible_unchecked(n.user_id));
    when 'COMMUNITY_POST', 'COMMUNITY_ANNOUNCEMENT' then
      cid := private.uuid_or_null(n.payload ->> 'community_id');
      return cid is null
        or (exists (select 1 from public.community_members m where m.community_id = cid and m.user_id = n.user_id)
            and (not exists (select 1 from public.communities c where c.id = cid and c.girl_only)
                 or private.girl_eligible_unchecked(n.user_id)));
    when 'MATCH_CREATED' then
      return private.girl_eligible_unchecked(n.user_id);
    else
      return true;
  end case;
end $$;

-- IRLY Girl content is never shared into a chat that is not an IRLY Girl chat
-- (share_to_chat, or a message written straight to the table with its ref).
create or replace function private.message_girl_ref_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ref_type is not null and new.ref_id is not null
     and private.girl_target(new.ref_type, new.ref_id::text)
     and not private.girl_chat(new.conversation_id) then
    raise exception 'IRLY Girl content stays in IRLY Girl' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists messages_girl_ref_guard on public.messages;
create trigger messages_girl_ref_guard before insert on public.messages
  for each row execute function private.message_girl_ref_guard();
