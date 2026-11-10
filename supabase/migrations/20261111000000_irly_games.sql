-- IRLY Games, part 1: rooms, players, chat, presence, and Ludo played on the
-- server (owner request, 2026-11-10: « IRLY Games — joue et rencontre du
-- monde »). Loup-Garou comes in a later migration; its rooms are refused
-- until then.
--
-- The server decides everything: who may join, whose turn it is, the dice
-- (drawn here, never sent by a phone), which moves are legal, captures, the
-- winner. Phones read the room and call these functions; they cannot write
-- the tables.
--
-- Spaces: a room belongs to IRLY ('irly') or to IRLY Girl ('irly_girl').
-- IRLY Girl rooms are for women with IRLY Girl access only (the same rule as
-- the rest of IRLY Girl, private.girl_eligible_unchecked).
--
-- Counts shown in the app (players online, rooms waiting or playing, free
-- seats) come from games_overview: real rows only, nothing made up.
--
--   games_overview(p_space)                 counts per game
--   game_ping(p_space, p_room)              "I am here" every 30 s on a games screen
--   game_rooms_open(p_game, p_space)        public rooms to join, and mine
--   game_create(p_game, p_space, p_visibility, p_max, p_title, p_lang)
--   game_join(p_room) / game_join_code(p_code) / game_quickplay(p_game, p_space)
--   game_leave(p_room) / game_kick(p_room, p_user) / game_start(p_room)
--   game_room(p_room)                       the room, its players and the board
--   game_say(p_room, p_body)                the room's chat
--   ludo_roll(p_room) / ludo_move(p_room, p_token) / game_tick(p_room)
--   games_recent()                          my finished games and who played
--
-- Ludo rules: 52 squares, each colour enters on its own start square with a
-- 6; a token travels 50 squares, then 5 squares of its home column, then
-- home (56, exact roll). A 6, a capture or a token reaching home gives
-- another roll; a third 6 in a row ends the turn. Start squares and the four
-- star squares are safe. The first player with four tokens home wins.
-- Each action has 30 seconds; past it the server plays for the player (rolls,
-- then moves the most advanced token). Three timeouts in a row and the
-- player is out of the game.
-- Idempotent.

-- ───────── Tables ─────────
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('ludo', 'werewolf')),
  space text not null check (space in ('irly', 'irly_girl')),
  host_id uuid references public.profiles (id) on delete set null,
  title text check (title is null or char_length(title) between 1 and 60),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  code text unique check (code is null or code ~ '^[A-Z2-9]{6}$'),
  lang text not null default 'en' check (lang in ('en', 'fr')),
  max_players integer not null check (max_players between 2 and 20),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'abandoned')),
  state jsonb not null default '{}'::jsonb,
  turn_deadline timestamptz,
  winner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists game_rooms_open_idx on public.game_rooms (game, space, status, created_at) where status in ('waiting', 'playing');
create index if not exists game_rooms_deadline_idx on public.game_rooms (turn_deadline) where status = 'playing';

create table if not exists public.game_participants (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat integer not null check (seat between 0 and 19),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  place integer,
  primary key (room_id, user_id)
);
create index if not exists game_participants_user_idx on public.game_participants (user_id, joined_at desc);
create unique index if not exists game_participants_seat_idx on public.game_participants (room_id, seat) where left_at is null;

create table if not exists public.game_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'chat' check (kind in ('chat', 'system')),
  -- chat: what a player wrote; system: an event key (joined, left, start, captured,
  -- three_sixes, away, won) shown by the app in the member's language with `data`.
  body text not null check (char_length(body) between 1 and 300),
  data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_messages_room_idx on public.game_messages (room_id, id);

-- Who is on a games screen now (counts only: never listed to anyone).
create table if not exists public.game_presence (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  space text not null check (space in ('irly', 'irly_girl')),
  room_id uuid references public.game_rooms (id) on delete set null,
  seen_at timestamptz not null default now()
);
create index if not exists game_presence_seen_idx on public.game_presence (space, seen_at);

-- Players a host removed from a room: they cannot come back to it.
create table if not exists private.game_kicks (
  room_id uuid not null references public.game_rooms (id) on delete cascade,
  user_id uuid not null,
  primary key (room_id, user_id)
);

alter table public.game_rooms enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_messages enable row level security;
alter table public.game_presence enable row level security;
revoke all on public.game_rooms, public.game_participants, public.game_messages, public.game_presence from anon;
revoke insert, update, delete on public.game_rooms, public.game_participants, public.game_messages, public.game_presence from authenticated;
grant select on public.game_rooms, public.game_participants, public.game_messages to authenticated;

-- ───────── Who may see what ─────────
create or replace function private.game_space_ok(p_space text, p_uid uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select p_uid is not null
    and exists (select 1 from public.profiles p where p.id = p_uid and p.deleted_at is null)
    and (p_space = 'irly' or private.girl_eligible_unchecked(p_uid))
$$;
revoke all on function private.game_space_ok(text, uuid) from public, anon, authenticated;

create or replace function private.game_is_player(p_room uuid, p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = p_uid)
$$;
revoke all on function private.game_is_player(uuid, uuid) from public, anon;
grant execute on function private.game_is_player(uuid, uuid) to authenticated;

/** The chat: the room's players only, never a message from someone blocked either way. */
create or replace function private.game_message_visible(p_room uuid, p_author uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select private.game_is_player(p_room, auth.uid())
    and (p_author is null or p_author = auth.uid() or not private.blocked_unchecked(auth.uid(), p_author))
$$;
revoke all on function private.game_message_visible(uuid, uuid) from public, anon;
grant execute on function private.game_message_visible(uuid, uuid) to authenticated;

/** A room is readable by its players (present or past), and a public room by anyone allowed in its space. */
create or replace function private.game_can_read(p_room uuid) returns boolean
language sql stable security definer set search_path = public, private as $$
  select exists (
    select 1 from public.game_rooms r
    where r.id = p_room
      and (private.game_is_player(r.id, auth.uid())
        or (r.visibility = 'public' and private.game_space_ok(r.space, auth.uid())))
  )
$$;
revoke all on function private.game_can_read(uuid) from public, anon;
grant execute on function private.game_can_read(uuid) to authenticated;

drop policy if exists game_rooms_read on public.game_rooms;
create policy game_rooms_read on public.game_rooms for select to authenticated using (private.game_can_read(id));
drop policy if exists game_participants_read on public.game_participants;
create policy game_participants_read on public.game_participants for select to authenticated using (private.game_can_read(room_id));
-- The chat: the room's players only, never a message from someone blocked either way.
drop policy if exists game_messages_read on public.game_messages;
create policy game_messages_read on public.game_messages for select to authenticated
  using (private.game_message_visible(room_id, user_id));

-- ───────── Small helpers ─────────
create or replace function private.game_me() returns uuid
language plpgsql stable set search_path = public, private as $$
declare me uuid := auth.uid();
begin
  if me is null or not exists (select 1 from public.profiles p where p.id = me and p.deleted_at is null) then
    raise exception 'sign in to play' using errcode = '42501';
  end if;
  if private.is_sanctioned(me) then
    raise exception 'your account cannot play right now' using errcode = '42501';
  end if;
  return me;
end $$;
revoke all on function private.game_me() from public, anon, authenticated;

create or replace function private.game_scope(p_space text) returns text
language plpgsql immutable set search_path = public as $$
begin
  if p_space in ('mixte', 'irly') then return 'irly'; end if;
  if p_space in ('girl', 'irly_girl') then return 'irly_girl'; end if;
  raise exception 'space: mixte or girl' using errcode = '22023';
end $$;
revoke all on function private.game_scope(text) from public, anon, authenticated;

/** A die, from the server's strong random source (gen_random_uuid), without bias. */
create or replace function private.game_die() returns integer
language plpgsql volatile set search_path = public as $$
declare b integer;
begin
  loop
    b := get_byte(uuid_send(gen_random_uuid()), 0);
    if b < 252 then return (b % 6) + 1; end if;
  end loop;
end $$;
revoke all on function private.game_die() from public, anon, authenticated;

create or replace function private.game_new_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, (get_byte(uuid_send(gen_random_uuid()), 0) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.game_rooms r where r.code = c);
  end loop;
  return c;
end $$;
revoke all on function private.game_new_code() from public, anon, authenticated;

create or replace function private.game_system(p_room uuid, p_key text, p_data jsonb default null) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.game_messages (room_id, user_id, kind, body, data) values (p_room, null, 'system', p_key, p_data)
$$;
revoke all on function private.game_system(uuid, text, jsonb) from public, anon, authenticated;

create or replace function private.game_first_name(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select (select p.first_name from public.profiles p where p.id = p_uid and p.deleted_at is null)
$$;
revoke all on function private.game_first_name(uuid) from public, anon, authenticated;

-- ───────── Ludo engine (pure: state in, state out) ─────────
-- state: { players: [uuid], colors: [int], tokens: [[int x4]], turn: int,
--          die: int|null, sixes: int, idle: [int], out: [bool], last: {...} }
-- token progress: -1 in the yard, 0..50 on the track, 51..55 home column, 56 home.

create or replace function private.ludo_square(p_color integer, p_progress integer) returns integer
language sql immutable set search_path = public as $$
  select case when p_progress between 0 and 50 then (p_color * 13 + p_progress) % 52 end
$$;
revoke all on function private.ludo_square(integer, integer) from public, anon, authenticated;

create or replace function private.ludo_safe(p_square integer) returns boolean
language sql immutable set search_path = public as $$
  select p_square = any (array[0, 8, 13, 21, 26, 34, 39, 47])
$$;
revoke all on function private.ludo_safe(integer) from public, anon, authenticated;

/** The tokens player p_idx may move with p_die. */
create or replace function private.ludo_legal(p_state jsonb, p_idx integer, p_die integer) returns integer[]
language plpgsql immutable set search_path = public as $$
declare
  out_ integer[] := '{}';
  p integer;
begin
  for k in 0..3 loop
    p := (p_state -> 'tokens' -> p_idx ->> k)::integer;
    if p = -1 then
      if p_die = 6 then out_ := out_ || k; end if;
    elsif p < 56 and p + p_die <= 56 then
      out_ := out_ || k;
    end if;
  end loop;
  return out_;
end $$;
revoke all on function private.ludo_legal(jsonb, integer, integer) from public, anon, authenticated;

/**
 * Moves token p_token of player p_idx by p_die. Returns
 * { state, captured: [[player, token]...], home: bool, extra: bool }.
 * The caller has checked the move is legal.
 */
create or replace function private.ludo_apply(p_state jsonb, p_idx integer, p_die integer, p_token integer) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  s jsonb := p_state;
  color integer := (p_state -> 'colors' ->> p_idx)::integer;
  p integer := (p_state -> 'tokens' -> p_idx ->> p_token)::integer;
  np integer;
  sq integer;
  captured jsonb := '[]'::jsonb;
  n integer := jsonb_array_length(p_state -> 'players');
  q integer;
begin
  np := case when p = -1 then 0 else p + p_die end;
  s := jsonb_set(s, array['tokens', p_idx::text, p_token::text], to_jsonb(np));
  sq := private.ludo_square(color, np);
  if sq is not null and not private.ludo_safe(sq) then
    for j in 0..n - 1 loop
      continue when j = p_idx or coalesce((s -> 'out' ->> j)::boolean, false);
      for k in 0..3 loop
        q := (s -> 'tokens' -> j ->> k)::integer;
        if private.ludo_square((s -> 'colors' ->> j)::integer, q) = sq then
          s := jsonb_set(s, array['tokens', j::text, k::text], to_jsonb(-1));
          captured := captured || jsonb_build_array(jsonb_build_array(j, k));
        end if;
      end loop;
    end loop;
  end if;
  return jsonb_build_object(
    'state', s,
    'captured', captured,
    'home', np = 56,
    'extra', p_die = 6 or jsonb_array_length(captured) > 0 or np = 56
  );
end $$;
revoke all on function private.ludo_apply(jsonb, integer, integer, integer) from public, anon, authenticated;

create or replace function private.ludo_won(p_state jsonb, p_idx integer) returns boolean
language sql immutable set search_path = public as $$
  select bool_and((p_state -> 'tokens' -> p_idx ->> k)::integer = 56) from generate_series(0, 3) k
$$;
revoke all on function private.ludo_won(jsonb, integer) from public, anon, authenticated;

/** The next player still in the game after p_idx (p_idx itself when alone). */
create or replace function private.ludo_next(p_state jsonb, p_idx integer) returns integer
language plpgsql immutable set search_path = public as $$
declare
  n integer := jsonb_array_length(p_state -> 'players');
  j integer;
begin
  for step in 1..n loop
    j := (p_idx + step) % n;
    if not coalesce((p_state -> 'out' ->> j)::boolean, false) then return j; end if;
  end loop;
  return p_idx;
end $$;
revoke all on function private.ludo_next(jsonb, integer) from public, anon, authenticated;

create or replace function private.ludo_active(p_state jsonb) returns integer
language sql immutable set search_path = public as $$
  select count(*)::integer from jsonb_array_elements(p_state -> 'out') o where not o::text::boolean
$$;
revoke all on function private.ludo_active(jsonb) from public, anon, authenticated;

-- ───────── Room state changes (one place each) ─────────
create or replace function private.game_finish(p_room uuid, p_winner uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare r public.game_rooms;
begin
  select * into r from public.game_rooms where id = p_room;
  update public.game_rooms set status = 'finished', winner_id = p_winner, finished_at = now(), turn_deadline = null, updated_at = now()
    where id = p_room;
  -- Places: the winner first, then by tokens' progress (Ludo), leavers last.
  with ranked as (
    select gp.user_id,
      row_number() over (order by (gp.user_id = p_winner) desc, (gp.left_at is null) desc,
        coalesce((
          select sum(greatest((r.state -> 'tokens' -> (i.idx - 1)::integer ->> k)::integer, -1))
          from jsonb_array_elements_text(r.state -> 'players') with ordinality i(uid, idx), generate_series(0, 3) k
          where i.uid::uuid = gp.user_id), 0) desc) as place
    from public.game_participants gp where gp.room_id = p_room
      -- Only those who played (not someone removed or gone before the start).
      and r.state -> 'players' ? gp.user_id::text
  )
  update public.game_participants gp set place = ranked.place from ranked
    where gp.room_id = p_room and gp.user_id = ranked.user_id;
  if p_winner is not null then
    perform private.game_system(p_room, 'won', jsonb_build_object('user', p_winner));
  end if;
end $$;
revoke all on function private.game_finish(uuid, uuid) from public, anon, authenticated;

/** After a move or a skipped turn: who plays next, a fresh deadline. */
create or replace function private.ludo_pass(p_room uuid, p_state jsonb, p_idx integer, p_keep boolean) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  s jsonb := p_state;
  nxt integer := case when p_keep then p_idx else private.ludo_next(p_state, p_idx) end;
begin
  s := jsonb_set(s, '{turn}', to_jsonb(nxt));
  s := jsonb_set(s, '{die}', 'null'::jsonb);
  if not p_keep then s := jsonb_set(s, '{sixes}', to_jsonb(0)); end if;
  update public.game_rooms set state = s, turn_deadline = now() + interval '30 seconds', updated_at = now() where id = p_room;
end $$;
revoke all on function private.ludo_pass(uuid, jsonb, integer, boolean) from public, anon, authenticated;

/** Moves a token for player p_idx (checked legal), then passes the turn or ends the game. */
create or replace function private.ludo_do_move(p_room uuid, p_state jsonb, p_idx integer, p_token integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  die integer := (p_state ->> 'die')::integer;
  res jsonb;
  s jsonb;
  uid uuid := (p_state -> 'players' ->> p_idx)::uuid;
  c jsonb;
begin
  res := private.ludo_apply(p_state, p_idx, die, p_token);
  s := res -> 'state';
  s := jsonb_set(s, '{last}', jsonb_build_object('player', p_idx, 'token', p_token, 'die', die, 'captured', res -> 'captured', 'home', res -> 'home', 'at', now()));
  for c in select * from jsonb_array_elements(res -> 'captured') loop
    perform private.game_system(p_room, 'captured', jsonb_build_object('by', uid, 'of', s -> 'players' ->> (c ->> 0)::integer));
  end loop;
  if private.ludo_won(s, p_idx) then
    update public.game_rooms set state = s, updated_at = now() where id = p_room;
    perform private.game_finish(p_room, uid);
    return;
  end if;
  perform private.ludo_pass(p_room, s, p_idx, (res ->> 'extra')::boolean);
end $$;
revoke all on function private.ludo_do_move(uuid, jsonb, integer, integer) from public, anon, authenticated;

/** Rolls for player p_idx: three 6 in a row end the turn; no legal move passes; one legal move is played at once. */
create or replace function private.ludo_do_roll(p_room uuid, p_state jsonb, p_idx integer, p_auto boolean default false) returns integer
language plpgsql volatile security definer set search_path = public, private as $$
declare
  die integer := private.game_die();
  s jsonb := p_state;
  sixes integer := coalesce((p_state ->> 'sixes')::integer, 0);
  legal integer[];
begin
  if die = 6 then sixes := sixes + 1; else sixes := 0; end if;
  s := jsonb_set(s, '{sixes}', to_jsonb(sixes));
  s := jsonb_set(s, '{die}', to_jsonb(die));
  s := jsonb_set(s, '{last}', jsonb_build_object('player', p_idx, 'roll', die, 'at', now()));
  if sixes >= 3 then
    perform private.game_system(p_room, 'three_sixes', jsonb_build_object('user', s -> 'players' ->> p_idx));
    perform private.ludo_pass(p_room, s, p_idx, false);
    return die;
  end if;
  legal := private.ludo_legal(s, p_idx, die);
  if cardinality(legal) = 0 then
    -- No move: a 6 still gives another roll.
    perform private.ludo_pass(p_room, s, p_idx, die = 6);
  elsif cardinality(legal) = 1 or p_auto then
    -- One choice, or the server plays for an absent player: the most advanced token.
    perform private.ludo_do_move(p_room, s, p_idx,
      (select k from unnest(legal) k order by (s -> 'tokens' -> p_idx ->> k)::integer desc limit 1));
  else
    update public.game_rooms set state = s, turn_deadline = now() + interval '30 seconds', updated_at = now() where id = p_room;
  end if;
  return die;
end $$;
revoke all on function private.ludo_do_roll(uuid, jsonb, integer, boolean) from public, anon, authenticated;

/** Takes a player out of a running game (left, or three timeouts): the last one standing wins. */
create or replace function private.ludo_drop(p_room uuid, p_idx integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  r public.game_rooms;
  s jsonb;
  last_idx integer;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if r.status <> 'playing' or coalesce((r.state -> 'out' ->> p_idx)::boolean, true) then return; end if;
  s := jsonb_set(r.state, array['out', p_idx::text], 'true'::jsonb);
  s := jsonb_set(s, array['tokens', p_idx::text], '[-1,-1,-1,-1]'::jsonb);
  if private.ludo_active(s) <= 1 then
    select (i.idx - 1)::integer into last_idx from jsonb_array_elements_text(s -> 'out') with ordinality i(o, idx) where i.o = 'false' limit 1;
    update public.game_rooms set state = s, updated_at = now() where id = p_room;
    perform private.game_finish(p_room, case when last_idx is null then null else (s -> 'players' ->> last_idx)::uuid end);
    return;
  end if;
  if (s ->> 'turn')::integer = p_idx then
    perform private.ludo_pass(p_room, s, p_idx, false);
  else
    update public.game_rooms set state = s, updated_at = now() where id = p_room;
  end if;
end $$;
revoke all on function private.ludo_drop(uuid, integer) from public, anon, authenticated;

/** Past the deadline: the server plays for the player whose turn it is. */
create or replace function private.game_advance(p_room uuid) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  r public.game_rooms;
  idx integer;
  s jsonb;
  legal integer[];
  best integer;
  idle integer;
begin
  select * into r from public.game_rooms where id = p_room for update skip locked;
  if not found or r.status <> 'playing' or r.game <> 'ludo' or r.turn_deadline is null or r.turn_deadline > now() then
    return false;
  end if;
  idx := (r.state ->> 'turn')::integer;
  -- A missed roll counts once per turn (a missed move only follows a roll the player made).
  idle := coalesce((r.state -> 'idle' ->> idx)::integer, 0) + case when r.state ->> 'die' is null then 1 else 0 end;
  s := jsonb_set(r.state, array['idle', idx::text], to_jsonb(idle));
  if idle >= 3 then
    perform private.game_system(p_room, 'away', jsonb_build_object('user', s -> 'players' ->> idx));
    update public.game_rooms set state = s where id = p_room;
    perform private.ludo_drop(p_room, idx);
    return true;
  end if;
  if s ->> 'die' is null then
    perform private.ludo_do_roll(p_room, s, idx, true);
  else
    legal := private.ludo_legal(s, idx, (s ->> 'die')::integer);
    select k into best from unnest(legal) k order by (s -> 'tokens' -> idx ->> k)::integer desc limit 1;
    perform private.ludo_do_move(p_room, s, idx, best);
  end if;
  return true;
end $$;
revoke all on function private.game_advance(uuid) from public, anon, authenticated;

-- ───────── Counts and lists ─────────
create or replace function public.games_overview(p_space text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  sp text := private.game_scope(p_space);
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  return jsonb_build_object(
    'online', (select count(*) from public.game_presence p where p.space = sp and p.seen_at > now() - interval '90 seconds'),
    'games', (
    select jsonb_agg(jsonb_build_object(
      'game', g.game,
      'in_game', (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.left_at is null
                  where r.game = g.game and r.space = sp and r.status = 'playing'),
      'waiting', (select count(*) from public.game_rooms r where r.game = g.game and r.space = sp and r.visibility = 'public' and r.status = 'waiting'),
      'playing', (select count(*) from public.game_rooms r where r.game = g.game and r.space = sp and r.status = 'playing'),
      'open_seats', (select coalesce(sum(r.max_players - (select count(*) from public.game_participants gp where gp.room_id = r.id and gp.left_at is null)), 0)
                     from public.game_rooms r where r.game = g.game and r.space = sp and r.visibility = 'public' and r.status = 'waiting')
    ) order by g.ord)
    from (values ('ludo', 1), ('werewolf', 2)) g(game, ord))
  );
end $$;
revoke all on function public.games_overview(text) from public, anon;
grant execute on function public.games_overview(text) to authenticated;

create or replace function public.game_ping(p_space text, p_room uuid default null) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  sp text := private.game_scope(p_space);
  me uuid := auth.uid();
begin
  if me is null or not private.game_space_ok(sp, me) then return; end if;
  insert into public.game_presence (user_id, space, room_id, seen_at)
    values (me, sp, case when p_room is not null and private.game_is_player(p_room, me) then p_room end, now())
    on conflict (user_id) do update set space = excluded.space, room_id = excluded.room_id, seen_at = excluded.seen_at;
end $$;
revoke all on function public.game_ping(text, uuid) from public, anon;
grant execute on function public.game_ping(text, uuid) to authenticated;

create or replace function private.game_room_card(r public.game_rooms, p_me uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', r.id, 'game', r.game, 'title', r.title, 'visibility', r.visibility, 'lang', r.lang,
    'max', r.max_players, 'status', r.status, 'created_at', r.created_at,
    'host', private.game_first_name(r.host_id), 'host_id', r.host_id,
    'players', (select count(*) from public.game_participants gp where gp.room_id = r.id and gp.left_at is null),
    'mine', exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = p_me and gp.left_at is null)
  )
$$;
revoke all on function private.game_room_card(public.game_rooms, uuid) from public, anon, authenticated;

create or replace function public.game_rooms_open(p_game text, p_space text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  sp text := private.game_scope(p_space);
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x.card order by x.mine desc, x.waiting desc, x.created_at desc)
    from (
      select private.game_room_card(r, me) as card, r.created_at, (r.status = 'waiting') as waiting,
        exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = me and gp.left_at is null) as mine
      from public.game_rooms r
      where r.game = p_game and r.space = sp and r.status in ('waiting', 'playing')
        and (exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = me and gp.left_at is null)
          or (r.visibility = 'public'
            -- A host who blocked me, or whom I blocked: the room is not offered.
            and (r.host_id is null or not private.blocked_unchecked(me, r.host_id))))
      order by 4 desc, 3 desc, 2 desc
      limit 40
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.game_rooms_open(text, text) from public, anon;
grant execute on function public.game_rooms_open(text, text) to authenticated;

-- ───────── Rooms ─────────
create or replace function public.game_create(p_game text, p_space text, p_visibility text default 'public', p_max integer default 4,
                                              p_title text default null, p_lang text default 'en') returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  c text;
begin
  if p_game = 'werewolf' then raise exception 'Loup-Garou opens soon' using errcode = '22023'; end if;
  if p_game is distinct from 'ludo' then raise exception 'unknown game' using errcode = '22023'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'public or private' using errcode = '22023'; end if;
  if p_max is null or p_max not between 2 and 4 then raise exception 'Ludo: 2 to 4 players' using errcode = '22023'; end if;
  if p_lang not in ('en', 'fr') then raise exception 'language: en or fr' using errcode = '22023'; end if;
  -- One open room at a time per host (no flooding the list).
  if (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.user_id = me and gp.left_at is null
      where r.status in ('waiting', 'playing')) >= 3 then
    raise exception 'you are already in three games' using errcode = '22023';
  end if;
  c := case when p_visibility = 'private' then private.game_new_code() end;
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players)
    values ('ludo', sp, me, nullif(btrim(coalesce(p_title, '')), ''), p_visibility, c, p_lang, p_max)
    returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  return jsonb_build_object('id', rid, 'code', c);
end $$;
revoke all on function public.game_create(text, text, text, integer, text, text) from public, anon;
grant execute on function public.game_create(text, text, text, integer, text, text) to authenticated;

/** Joins a waiting room the caller may enter: space, free seat, not removed, no block with anyone in it. */
create or replace function private.game_enter(p_room uuid, p_me uuid, p_by_code boolean) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  r public.game_rooms;
  seat_ integer;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = p_me and gp.left_at is null) then
    return r.id;
  end if;
  if not private.game_space_ok(r.space, p_me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if r.visibility = 'private' and not p_by_code then raise exception 'this game is private: ask for its code' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'this game has already started' using errcode = '22023'; end if;
  if exists (select 1 from private.game_kicks k where k.room_id = r.id and k.user_id = p_me) then
    raise exception 'you cannot join this game' using errcode = '42501';
  end if;
  if exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.left_at is null and private.blocked_unchecked(p_me, gp.user_id)) then
    raise exception 'you cannot join this game' using errcode = '42501';
  end if;
  select min(s) into seat_ from generate_series(0, r.max_players - 1) s
    where not exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.seat = s and gp.left_at is null);
  if seat_ is null then raise exception 'this game is full' using errcode = '22023'; end if;
  insert into public.game_participants (room_id, user_id, seat) values (r.id, p_me, seat_)
    on conflict (room_id, user_id) do update set seat = excluded.seat, left_at = null, joined_at = now();
  perform private.game_system(r.id, 'joined', jsonb_build_object('user', p_me));
  update public.game_rooms set updated_at = now() where id = r.id;
  return r.id;
end $$;
revoke all on function private.game_enter(uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public.game_join(p_room uuid) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
begin
  return private.game_enter(p_room, private.game_me(), false);
end $$;
revoke all on function public.game_join(uuid) from public, anon;
grant execute on function public.game_join(uuid) to authenticated;

create or replace function public.game_join_code(p_code text) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  rid uuid;
begin
  select r.id into rid from public.game_rooms r where r.code = upper(btrim(coalesce(p_code, ''))) and r.status in ('waiting', 'playing');
  if rid is null then raise exception 'no game with this code' using errcode = 'P0002'; end if;
  return private.game_enter(rid, me, true);
end $$;
revoke all on function public.game_join_code(text) from public, anon;
grant execute on function public.game_join_code(text) to authenticated;

/** Play now: the public room waiting longest that the caller may enter, or a new one. */
create or replace function public.game_quickplay(p_game text, p_space text) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  r record;
begin
  if p_game = 'werewolf' then raise exception 'Loup-Garou opens soon' using errcode = '22023'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  for r in
    select g.id from public.game_rooms g
    where g.game = p_game and g.space = sp and g.visibility = 'public' and g.status = 'waiting'
      and (select count(*) from public.game_participants gp where gp.room_id = g.id and gp.left_at is null) < g.max_players
      and not exists (select 1 from private.game_kicks k where k.room_id = g.id and k.user_id = me)
      and not exists (select 1 from public.game_participants gp where gp.room_id = g.id and gp.left_at is null and private.blocked_unchecked(me, gp.user_id))
    order by g.created_at
    limit 5
  loop
    begin
      return private.game_enter(r.id, me, false);
    exception when others then
      -- Taken meanwhile: try the next one.
    end;
  end loop;
  return (public.game_create(p_game, p_space, 'public', 4, null, 'en') ->> 'id')::uuid;
end $$;
revoke all on function public.game_quickplay(text, text) from public, anon;
grant execute on function public.game_quickplay(text, text) to authenticated;

create or replace function public.game_leave(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  idx integer;
  next_host uuid;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
    return;
  end if;
  update public.game_participants set left_at = now() where room_id = p_room and user_id = me;
  perform private.game_system(p_room, 'left', jsonb_build_object('user', me));
  if r.status = 'waiting' then
    select gp.user_id into next_host from public.game_participants gp where gp.room_id = p_room and gp.left_at is null order by gp.joined_at limit 1;
    if next_host is null then
      update public.game_rooms set status = 'abandoned', finished_at = now(), updated_at = now() where id = p_room;
    elsif r.host_id = me then
      update public.game_rooms set host_id = next_host, updated_at = now() where id = p_room;
    else
      update public.game_rooms set updated_at = now() where id = p_room;
    end if;
  elsif r.status = 'playing' and r.game = 'ludo' then
    select (i.idx - 1)::integer into idx from jsonb_array_elements_text(r.state -> 'players') with ordinality i(uid, idx) where i.uid::uuid = me;
    if idx is not null then perform private.ludo_drop(p_room, idx); end if;
  end if;
end $$;
revoke all on function public.game_leave(uuid) from public, anon;
grant execute on function public.game_leave(uuid) to authenticated;

create or replace function public.game_kick(p_room uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  r public.game_rooms;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or r.host_id is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if p_user = me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'this game has already started' using errcode = '22023'; end if;
  insert into private.game_kicks (room_id, user_id) values (p_room, p_user) on conflict do nothing;
  update public.game_participants set left_at = now() where room_id = p_room and user_id = p_user and left_at is null;
  update public.game_rooms set updated_at = now() where id = p_room;
end $$;
revoke all on function public.game_kick(uuid, uuid) from public, anon;
grant execute on function public.game_kick(uuid, uuid) to authenticated;

create or replace function public.game_start(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  r public.game_rooms;
  players jsonb;
  n integer;
  colors jsonb;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or r.host_id is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'this game has already started' using errcode = '22023'; end if;
  select jsonb_agg(gp.user_id order by gp.seat), count(*) into players, n
    from public.game_participants gp where gp.room_id = p_room and gp.left_at is null;
  if n < 2 then raise exception 'two players are needed to start' using errcode = '22023'; end if;
  -- Two players sit opposite each other (red and yellow).
  colors := case n when 2 then '[0,2]' when 3 then '[0,1,2]' else '[0,1,2,3]' end::jsonb;
  update public.game_rooms set status = 'playing', started_at = now(), updated_at = now(),
    turn_deadline = now() + interval '30 seconds',
    state = jsonb_build_object(
      'players', players, 'colors', colors,
      'tokens', (select jsonb_agg('[-1,-1,-1,-1]'::jsonb) from generate_series(1, n)),
      'turn', 0, 'die', null, 'sixes', 0,
      'idle', (select jsonb_agg(0) from generate_series(1, n)),
      'out', (select jsonb_agg(false) from generate_series(1, n)),
      'last', null)
    where id = p_room;
  perform private.game_system(p_room, 'start');
end $$;
revoke all on function public.game_start(uuid) from public, anon;
grant execute on function public.game_start(uuid) to authenticated;

-- ───────── Playing ─────────
create or replace function private.ludo_my_turn(p_room uuid, p_me uuid, out state jsonb, out idx integer)
language plpgsql volatile security definer set search_path = public, private as $$
declare
  r public.game_rooms;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or r.game <> 'ludo' then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if r.status <> 'playing' then raise exception 'this game is not running' using errcode = '22023'; end if;
  select (i.idx - 1)::integer into idx from jsonb_array_elements_text(r.state -> 'players') with ordinality i(uid, idx) where i.uid::uuid = p_me;
  if idx is null or coalesce((r.state -> 'out' ->> idx)::boolean, true) then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  if (r.state ->> 'turn')::integer <> idx then raise exception 'not your turn' using errcode = '22023'; end if;
  state := r.state;
end $$;
revoke all on function private.ludo_my_turn(uuid, uuid) from public, anon, authenticated;

create or replace function public.ludo_roll(p_room uuid) returns integer
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  t record;
  s jsonb;
begin
  select * into t from private.ludo_my_turn(p_room, me);
  if t.state ->> 'die' is not null then raise exception 'move a token first' using errcode = '22023'; end if;
  s := jsonb_set(t.state, array['idle', t.idx::text], to_jsonb(0));
  return private.ludo_do_roll(p_room, s, t.idx);
end $$;
revoke all on function public.ludo_roll(uuid) from public, anon;
grant execute on function public.ludo_roll(uuid) to authenticated;

create or replace function public.ludo_move(p_room uuid, p_token integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  t record;
  s jsonb;
begin
  select * into t from private.ludo_my_turn(p_room, me);
  if t.state ->> 'die' is null then raise exception 'roll the die first' using errcode = '22023'; end if;
  if p_token is null or not (p_token = any (private.ludo_legal(t.state, t.idx, (t.state ->> 'die')::integer))) then
    raise exception 'this token cannot move' using errcode = '22023';
  end if;
  s := jsonb_set(t.state, array['idle', t.idx::text], to_jsonb(0));
  perform private.ludo_do_move(p_room, s, t.idx, p_token);
end $$;
revoke all on function public.ludo_move(uuid, integer) from public, anon;
grant execute on function public.ludo_move(uuid, integer) to authenticated;

/** Any player may ask: past the deadline, the server plays the late turn. */
create or replace function public.game_tick(p_room uuid) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
begin
  if not private.game_is_player(p_room, auth.uid()) then return false; end if;
  return private.game_advance(p_room);
end $$;
revoke all on function public.game_tick(uuid) from public, anon;
grant execute on function public.game_tick(uuid) to authenticated;

create or replace function public.game_room(p_room uuid) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into r from public.game_rooms where id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  return private.game_room_card(r, me) || jsonb_build_object(
    'space', r.space,
    'code', case when private.game_is_player(r.id, me) then r.code end,
    'state', r.state,
    'deadline', r.turn_deadline,
    'now', now(),
    'winner_id', r.winner_id,
    'started_at', r.started_at,
    'finished_at', r.finished_at,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', gp.user_id, 'seat', gp.seat, 'left', gp.left_at is not null, 'place', gp.place,
        'name', private.game_first_name(gp.user_id),
        'photo', (select p.photo_paths[1] from public.profiles p where p.id = gp.user_id and p.deleted_at is null),
        'blocked', me <> gp.user_id and private.blocked_unchecked(me, gp.user_id)
      ) order by gp.seat, gp.joined_at)
      from public.game_participants gp where gp.room_id = r.id
        and (gp.left_at is null or r.status <> 'waiting')
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.game_room(uuid) from public, anon;
grant execute on function public.game_room(uuid) to authenticated;

create or replace function public.game_say(p_room uuid, p_body text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  b text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
    raise exception 'you are not playing in this game' using errcode = '42501';
  end if;
  if char_length(b) not between 1 and 300 then raise exception 'write 1 to 300 characters' using errcode = '22023'; end if;
  if (select count(*) from public.game_messages m where m.room_id = p_room and m.user_id = me and m.created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'slow down a little' using errcode = '22023';
  end if;
  insert into public.game_messages (room_id, user_id, body) values (p_room, me, b);
end $$;
revoke all on function public.game_say(uuid, text) from public, anon;
grant execute on function public.game_say(uuid, text) to authenticated;

/** My finished games of the last 30 days, with who played (for « play again » and « stay in touch »). */
create or replace function public.games_recent() returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x.card order by x.finished_at desc)
    from (
      select r.finished_at, jsonb_build_object(
        'id', r.id, 'game', r.game, 'space', r.space, 'finished_at', r.finished_at,
        'winner_id', r.winner_id, 'title', r.title,
        'people', (select jsonb_agg(jsonb_build_object('id', o.user_id, 'name', private.game_first_name(o.user_id), 'place', o.place,
                     'photo', (select p.photo_paths[1] from public.profiles p where p.id = o.user_id and p.deleted_at is null)) order by o.place nulls last)
                   from public.game_participants o
                   where o.room_id = r.id and o.user_id <> me and r.state -> 'players' ? o.user_id::text
                     and not private.blocked_unchecked(me, o.user_id))
      ) as card
      from public.game_rooms r
      join public.game_participants gp on gp.room_id = r.id and gp.user_id = me
      where r.status = 'finished' and r.finished_at > now() - interval '30 days'
      order by r.finished_at desc
      limit 20
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.games_recent() from public, anon;
grant execute on function public.games_recent() to authenticated;

-- ───────── Upkeep ─────────
/** Every minute: late turns played, rooms nobody waits in closed, old presence forgotten. */
create or replace function private.games_sweep() returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare r record;
begin
  for r in select id from public.game_rooms where status = 'playing' and turn_deadline < now() limit 200 loop
    perform private.game_advance(r.id);
  end loop;
  -- A waiting room left two hours without anyone, or a game without a move for an hour.
  update public.game_rooms set status = 'abandoned', finished_at = now(), turn_deadline = null, updated_at = now()
    where (status = 'waiting' and updated_at < now() - interval '2 hours')
       or (status = 'playing' and updated_at < now() - interval '1 hour');
  delete from public.game_presence where seen_at < now() - interval '1 day';
end $$;
revoke all on function private.games_sweep() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'irly-games-sweep';
  perform cron.schedule('irly-games-sweep', '* * * * *', 'select private.games_sweep()');
exception when others then
  raise notice 'pg_cron not available: late turns are played when a player opens the game';
end $$;

-- Live updates for the room screen (rows each member may read only).
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['game_rooms', 'game_participants', 'game_messages'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;
