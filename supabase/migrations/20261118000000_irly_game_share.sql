-- IRLY Games: share a game in a community, and on the Live.
--
-- A shared game is ONE community post (community_posts) that carries the game's
-- room (game_room_id), exactly as a post carries an activity. Published with
-- in_live, the same record also shows in the Live of the community's universe
-- for 24 hours (20261110400000): there is never a second copy, and never a
-- second room. Every post of a game points to the same room.
--
-- The post is inserted AS THE MEMBER (game_share is security invoker): every
-- existing rule on posts applies unchanged (membership, restricted
-- communities, rate limit, IRLY Girl isolation, sanctions, the Live guard).
-- On top of them:
--   - only the host shares a game, while it waits for players, never a
--     training game;
--   - an IRLY Girl game is shared only in an IRLY Girl community, a Mixte game
--     only in a Mixte one (the Live's universe rule), so a share never moves a
--     game across the two spaces;
--   - one post per game and community: sharing again returns the same post.
--
-- What a reader sees comes from the room itself, read at the moment it is
-- shown (game_share_cards): players, seats, status, text or voice. Only for
-- posts the reader may read: the community's own rule (IRLY Girl), blocks
-- either way with the author, removed posts, and the game's space.
--
-- Joining from a post (game_join_shared) goes through the one entry function
-- of every game (private.game_enter): space, blocks with the players, a
-- member removed by the host, a game already started, a full table. The room
-- row is locked there, so two members asking for the last seat at the same
-- time get one seat and one « this game is full ». For a private game the
-- host's share stands for its code, for those who can read the post only.
--
-- Public RPCs:
--   game_share(p_room, p_community, p_live)   → the post's id
--   game_share_cards(p_posts)                 → { post id: card }
--   game_join_shared(p_post)                  → the room's id

alter table public.community_posts add column if not exists game_room_id uuid references public.game_rooms (id) on delete set null;
create unique index if not exists community_posts_game_share_idx on public.community_posts (game_room_id, community_id)
  where game_room_id is not null and deleted_at is null;

create or replace function private.community_post_game_guard() returns trigger
language plpgsql security definer set search_path = public, private as $$
declare
  r public.game_rooms;
begin
  if tg_op = 'UPDATE' then
    if new.game_room_id is distinct from old.game_room_id and new.game_room_id is not null then
      raise exception 'a game is shared when the post is published' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.game_room_id is null then return new; end if;
  select * into r from public.game_rooms where id = new.game_room_id;
  if not found then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if r.host_id is distinct from new.author_id then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if r.kind = 'training' then raise exception 'a game against AI players is not shared' using errcode = '22023'; end if;
  if r.status <> 'waiting' then raise exception 'this game has already started' using errcode = '22023'; end if;
  if new.community_id is null then raise exception 'choose a community' using errcode = '22023'; end if;
  if private.community_live_space(new.community_id) is distinct from r.space then
    raise exception 'this game cannot be shared in this community' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function private.community_post_game_guard() from public, anon, authenticated;
drop trigger if exists community_posts_game_guard on public.community_posts;
create trigger community_posts_game_guard before insert or update of game_room_id on public.community_posts
for each row execute function private.community_post_game_guard();

create or replace function public.game_share(p_room uuid, p_community uuid, p_live boolean default false) returns uuid
language plpgsql volatile security invoker set search_path = public as $$
declare
  me uuid := auth.uid();
  pid uuid;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if p_room is null or p_community is null then raise exception 'choose a community' using errcode = '22023'; end if;
  select id into pid from public.community_posts
    where game_room_id = p_room and community_id = p_community and deleted_at is null limit 1;
  if pid is not null then return pid; end if;
  insert into public.community_posts (community_id, author_id, body, game_room_id, in_live)
    values (p_community, me, '🐺 Loup-Garou', p_room, coalesce(p_live, false))
    returning id into pid;
  return pid;
end $$;
revoke all on function public.game_share(uuid, uuid, boolean) from public, anon;
grant execute on function public.game_share(uuid, uuid, boolean) to authenticated;

/** May the caller read this post? The post read rule, for a community post that is not removed. */
create or replace function private.game_share_readable(p public.community_posts) returns boolean
language sql stable security definer set search_path = public, private as $$
  select auth.uid() is not null and p.deleted_at is null and p.game_room_id is not null and p.community_id is not null
    and exists (select 1 from public.communities c where c.id = p.community_id and c.deleted_at is null and (not c.girl_only or private.is_girl_eligible()))
    and not private.is_blocked(auth.uid(), p.author_id)
$$;
revoke all on function private.game_share_readable(public.community_posts) from public, anon, authenticated;

create or replace function public.game_share_cards(p_posts uuid[]) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select coalesce(jsonb_object_agg(p.id, jsonb_build_object(
    'room_id', r.id, 'game', r.game, 'kind', r.kind, 'title', r.title, 'visibility', r.visibility, 'max', r.max_players,
    'host', private.game_first_name(r.host_id), 'host_id', r.host_id,
    'mode', (select g.mode from private.ww_games g where g.room_id = r.id),
    'comm', (select g.comm from private.ww_games g where g.room_id = r.id),
    'players', n.players,
    'status', case when r.status = 'waiting' and n.players >= r.max_players then 'full'
      when r.status = 'abandoned' then 'cancelled' else r.status end,
    'mine', exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = auth.uid() and gp.left_at is null)
  )), '{}'::jsonb)
  from public.community_posts p
  join public.game_rooms r on r.id = p.game_room_id
  cross join lateral (select count(*)::integer as players from public.game_participants gp where gp.room_id = r.id and gp.left_at is null) n
  where p.id = any (coalesce(p_posts, '{}'::uuid[])) and private.game_share_readable(p) and private.game_space_ok(r.space, auth.uid())
$$;
revoke all on function public.game_share_cards(uuid[]) from public, anon;
grant execute on function public.game_share_cards(uuid[]) to authenticated;

create or replace function public.game_join_shared(p_post uuid) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  p public.community_posts;
begin
  select * into p from public.community_posts where id = p_post;
  if not found or not private.game_share_readable(p) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  -- The host shared it here: for those who can read the post, that stands for the code of a private game.
  return private.game_enter(p.game_room_id, me, true);
end $$;
revoke all on function public.game_join_shared(uuid) from public, anon;
grant execute on function public.game_join_shared(uuid) to authenticated;
