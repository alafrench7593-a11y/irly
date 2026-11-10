-- IRLY Games: rooms, access, chat, and Ludo played on the server
-- (20261111000000_irly_games). Runs after irly_test.sql (scripts/test-db.sh).
-- TEST accounts only, ids prefixed 9a3e0000-….
--
--   a1 Lina  woman (IRLY Girl access)   a2 Omar man   a3 Sara woman
--   a4 Theo  man                         a5 Yara woman, blocked by Lina
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', uid::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'FAIL games: %', label;
  end if;
  raise notice 'ok  %', label;
end $$;
/** Runs p_sql as the current role and returns the error message, or null when it worked. */
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) values
  ('9a3e0000-0000-0000-0000-0000000000a1'), ('9a3e0000-0000-0000-0000-0000000000a2'), ('9a3e0000-0000-0000-0000-0000000000a3'),
  ('9a3e0000-0000-0000-0000-0000000000a4'), ('9a3e0000-0000-0000-0000-0000000000a5');
insert into public.profiles (id, first_name, birthdate, gender, city_id) values
  ('9a3e0000-0000-0000-0000-0000000000a1', 'Lina', '1994-03-03', 'woman', 'dubai'),
  ('9a3e0000-0000-0000-0000-0000000000a2', 'Omar', '1992-05-05', 'man', 'dubai'),
  ('9a3e0000-0000-0000-0000-0000000000a3', 'Sara', '1996-07-07', 'woman', 'dubai'),
  ('9a3e0000-0000-0000-0000-0000000000a4', 'Theo', '1990-09-09', 'man', 'dubai'),
  ('9a3e0000-0000-0000-0000-0000000000a5', 'Yara', '1995-01-01', 'woman', 'dubai');
insert into public.blocks (blocker_id, blocked_id) values ('9a3e0000-0000-0000-0000-0000000000a1', '9a3e0000-0000-0000-0000-0000000000a5');

-- ───────── The engine, alone ─────────
do $$
declare
  s jsonb := jsonb_build_object(
    'players', '["9a3e0000-0000-0000-0000-0000000000a1","9a3e0000-0000-0000-0000-0000000000a2"]'::jsonb,
    'colors', '[0,2]'::jsonb,
    'tokens', '[[-1,-1,-1,-1],[-1,-1,-1,-1]]'::jsonb,
    'turn', 0, 'die', null, 'sixes', 0, 'idle', '[0,0]'::jsonb, 'out', '[false,false]'::jsonb);
  res jsonb;
begin
  perform pg_temp.check(private.ludo_legal(s, 0, 5) = '{}', 'a token leaves the yard only with a 6');
  perform pg_temp.check(private.ludo_legal(s, 0, 6) = '{0,1,2,3}', 'with a 6, every token in the yard may come out');
  res := private.ludo_apply(s, 0, 6, 0);
  perform pg_temp.check((res -> 'state' -> 'tokens' -> 0 ->> 0)::int = 0, 'a token out of the yard stands on its start square');
  perform pg_temp.check((res ->> 'extra')::boolean, 'a 6 gives another roll');

  -- Capture: red token at progress 3 (square 3); yellow (colour 2, start 26) at progress 29 is square 3 too.
  s := jsonb_set(s, '{tokens}', '[[3,-1,-1,-1],[27,-1,-1,-1]]'::jsonb);
  res := private.ludo_apply(s, 1, 2, 0);
  perform pg_temp.check((res -> 'state' -> 'tokens' -> 0 ->> 0)::int = -1, 'landing on an opponent sends it back to the yard');
  perform pg_temp.check(jsonb_array_length(res -> 'captured') = 1 and (res ->> 'extra')::boolean, 'a capture is reported and gives another roll');

  -- Safe square: red at progress 8 (star square 8); yellow at progress 32 lands on square 8.
  s := jsonb_set(s, '{tokens}', '[[8,-1,-1,-1],[30,-1,-1,-1]]'::jsonb);
  res := private.ludo_apply(s, 1, 2, 0);
  perform pg_temp.check((res -> 'state' -> 'tokens' -> 0 ->> 0)::int = 8 and jsonb_array_length(res -> 'captured') = 0, 'no capture on a safe square');

  -- Start squares of other colours are safe too (square 13).
  s := jsonb_set(s, '{tokens}', '[[13,-1,-1,-1],[37,-1,-1,-1]]'::jsonb);
  res := private.ludo_apply(s, 1, 2, 0);
  perform pg_temp.check(jsonb_array_length(res -> 'captured') = 0, 'no capture on a start square');

  -- Home column and exact roll.
  s := jsonb_set(s, '{tokens}', '[[53,-1,-1,-1],[-1,-1,-1,-1]]'::jsonb);
  perform pg_temp.check(private.ludo_legal(s, 0, 4) = '{}', 'home needs the exact roll (53 + 4 > 56)');
  perform pg_temp.check(private.ludo_legal(s, 0, 3) = '{0}', 'the exact roll brings the token home');
  res := private.ludo_apply(s, 0, 3, 0);
  perform pg_temp.check((res ->> 'home')::boolean and (res ->> 'extra')::boolean, 'a token home gives another roll');
  perform pg_temp.check(not private.ludo_won(res -> 'state', 0), 'one token home is not a win');
  perform pg_temp.check(private.ludo_won(jsonb_set(s, '{tokens,0}', '[56,56,56,56]'::jsonb), 0), 'four tokens home win');

  -- Tokens in the home column are never captured (no square on the track).
  s := jsonb_set(s, '{tokens}', '[[52,-1,-1,-1],[0,-1,-1,-1]]'::jsonb);
  perform pg_temp.check(private.ludo_square(0, 52) is null, 'the home column is off the shared track');

  perform pg_temp.check(private.ludo_next(jsonb_set(s, '{out}', '[false,true]'::jsonb), 0) = 0, 'a player who left is skipped');
end $$;

do $$
declare n integer; d integer; seen integer[] := '{}';
begin
  for n in 1..600 loop
    d := private.game_die();
    if d < 1 or d > 6 then raise exception 'FAIL games: die out of range %', d; end if;
    if not d = any (seen) then seen := seen || d; end if;
  end loop;
  perform pg_temp.check(cardinality(seen) = 6, 'the server die gives 1 to 6, every face');
end $$;

-- ───────── Rooms and access ─────────
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
do $$
declare r jsonb; rid uuid;
begin
  perform pg_temp.check(pg_temp.err($q$select public.game_create('werewolf', 'mixte')$q$) = 'Loup-Garou opens soon', 'Loup-Garou rooms are refused until it opens');
  perform pg_temp.check(pg_temp.err($q$select public.game_create('ludo', 'mixte', 'public', 6)$q$) = 'Ludo: 2 to 4 players', 'Ludo takes 2 to 4 players');
  perform pg_temp.check(pg_temp.err($q$select public.game_create('ludo', 'girl')$q$) = 'IRLY Girl games are for IRLY Girl members', 'a man cannot open an IRLY Girl game');
  perform pg_temp.check(pg_temp.err($q$select public.games_overview('girl')$q$) = 'IRLY Girl games are for IRLY Girl members', 'a man cannot read IRLY Girl counts');
  perform pg_temp.check(pg_temp.err($q$insert into public.game_rooms (game, space, max_players) values ('ludo', 'irly', 4)$q$) is not null, 'a phone cannot write a room directly');
  r := public.game_create('ludo', 'mixte', 'public', 3, 'Omar''s table', 'fr');
  rid := (r ->> 'id')::uuid;
  perform pg_temp.check(r ->> 'code' is null, 'a public room has no code');
  perform set_config('games.public_room', rid::text, false);
  perform pg_temp.check(pg_temp.err(format('update public.game_rooms set status = %L where id = %L', 'finished', rid)) is not null
    or (select status from public.game_rooms where id = rid) = 'waiting', 'a phone cannot change a room');
end $$;

select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a1');
do $$
declare r jsonb; o jsonb;
begin
  -- Lina's private IRLY Girl room.
  r := public.game_create('ludo', 'girl', 'private', 4, null, 'fr');
  perform pg_temp.check(r ->> 'code' ~ '^[A-Z2-9]{6}$', 'a private room gets a 6-character code');
  perform set_config('games.girl_room', r ->> 'id', false);
  perform set_config('games.girl_code', r ->> 'code', false);
  o := public.games_overview('girl');
  perform pg_temp.check((o -> 'games' -> 0 ->> 'waiting')::int = 0, 'a private room is not counted as open to join');
  o := public.games_overview('mixte');
  perform pg_temp.check((o -> 'games' -> 0 ->> 'waiting')::int = 1 and (o -> 'games' -> 0 ->> 'open_seats')::int = 2, 'Mixte counts: one room waiting, two free seats');
  perform public.game_ping('mixte');
  o := public.games_overview('mixte');
  perform pg_temp.check((o ->> 'online')::int = 1, 'a member on a games screen counts as online');
end $$;

-- Omar cannot see or join the IRLY Girl room, even with its code.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.game_rooms where id = current_setting('games.girl_room')::uuid), 'a private IRLY Girl room is invisible to others');
  perform pg_temp.check(pg_temp.err(format('select public.game_join_code(%L)', current_setting('games.girl_code'))) = 'IRLY Girl games are for IRLY Girl members', 'the code does not open IRLY Girl to a man');
end $$;

-- Sara joins the private room with its code, not without it.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a3');
do $$
begin
  perform pg_temp.check(pg_temp.err(format('select public.game_join(%L)', current_setting('games.girl_room'))) = 'this game is private: ask for its code', 'a private room needs its code');
  perform public.game_join_code(lower(current_setting('games.girl_code')));
  perform pg_temp.check(exists (select 1 from public.game_participants where room_id = current_setting('games.girl_room')::uuid and user_id = auth.uid()), 'the code (any case) lets her in');
end $$;

-- Yara, blocked by Lina, cannot join Lina's room.
select pg_temp.as_admin();
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a5');
do $$
begin
  perform pg_temp.check(pg_temp.err(format('select public.game_join_code(%L)', current_setting('games.girl_code'))) = 'you cannot join this game', 'a blocked member cannot join a room with the person who blocked her');
end $$;

-- Lina blocks nobody in Omar's room: she, Theo join it; Lina kicks no one (not host).
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a4');
do $$
declare rid uuid := current_setting('games.public_room')::uuid; room jsonb;
begin
  perform pg_temp.check(public.game_quickplay('ludo', 'mixte') = rid, 'Play now joins the room waiting');
  perform pg_temp.check(pg_temp.err(format('select public.game_start(%L)', rid)) = 'only the host can do this', 'only the host starts');
  perform pg_temp.check(pg_temp.err(format('select public.game_kick(%L, %L)', rid, '9a3e0000-0000-0000-0000-0000000000a2')) = 'only the host can do this', 'only the host removes a player');
  room := public.game_room(rid);
  perform pg_temp.check(jsonb_array_length(room -> 'people') = 2 and room ->> 'code' is null, 'the room shows its two players');
end $$;

-- Omar removes Theo; Theo cannot come back.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
select public.game_kick(current_setting('games.public_room')::uuid, '9a3e0000-0000-0000-0000-0000000000a4');
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a4');
do $$
begin
  perform pg_temp.check(pg_temp.err(format('select public.game_join(%L)', current_setting('games.public_room'))) = 'you cannot join this game', 'a removed player cannot come back');
  perform pg_temp.check(public.game_quickplay('ludo', 'mixte') <> current_setting('games.public_room')::uuid, 'Play now does not send him back: it opens a new room');
end $$;

-- Lina and Sara join Omar's room: three players. Chat and start.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a1');
select public.game_join(current_setting('games.public_room')::uuid);
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a3');
select public.game_join(current_setting('games.public_room')::uuid);
do $$
declare rid uuid := current_setting('games.public_room')::uuid;
begin
  perform pg_temp.check(pg_temp.err(format('select public.game_join(%L)', rid)) is null, 'joining twice is harmless');
  perform public.game_say(rid, 'Salut tout le monde 👋');
  perform pg_temp.check(pg_temp.err(format('select public.game_say(%L, %L)', rid, repeat('x', 301))) = 'write 1 to 300 characters', 'chat messages are 1 to 300 characters');
  perform public.game_say(rid, 'a'); perform public.game_say(rid, 'b'); perform public.game_say(rid, 'c'); perform public.game_say(rid, 'd');
  perform pg_temp.check(pg_temp.err(format('select public.game_say(%L, %L)', rid, 'e')) = 'slow down a little', 'five messages in ten seconds at most');
end $$;
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a5');
do $$
begin
  perform pg_temp.check(not exists (select 1 from public.game_messages where room_id = current_setting('games.public_room')::uuid), 'someone outside the room reads none of its chat');
  perform pg_temp.check(pg_temp.err(format('select public.game_say(%L, %L)', current_setting('games.public_room'), 'hi')) = 'you are not playing in this game', 'someone outside the room cannot write in it');
end $$;

select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
select public.game_start(current_setting('games.public_room')::uuid);
do $$
declare rid uuid := current_setting('games.public_room')::uuid; r public.game_rooms;
begin
  select * into r from public.game_rooms where id = rid;
  perform pg_temp.check(r.status = 'playing' and r.state -> 'colors' = '[0,1,2]'::jsonb and jsonb_array_length(r.state -> 'players') = 3, 'three players: red, green, yellow');
  perform pg_temp.check(r.turn_deadline > now(), 'the first turn has a deadline');
end $$;

-- After the start nobody joins, and only the player whose turn it is rolls.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a5');
select pg_temp.check(pg_temp.err(format('select public.game_join(%L)', current_setting('games.public_room'))) = 'this game has already started', 'a running game takes nobody new');
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a1');
select pg_temp.check(pg_temp.err(format('select public.ludo_roll(%L)', current_setting('games.public_room'))) = 'not your turn', 'only the player whose turn it is rolls');
select pg_temp.check(pg_temp.err(format('select public.ludo_move(%L, 0)', current_setting('games.public_room'))) = 'not your turn', 'only the player whose turn it is moves');

-- ───────── A whole game, three real players through the public functions ─────────
-- Each player rolls; when a choice is left, they move their most advanced token. Up to 3000 actions.
select pg_temp.as_admin();
create or replace function pg_temp.play_one(p_room uuid) returns text language plpgsql as $$
declare
  r public.game_rooms;
  uid uuid;
  idx integer;
  legal integer[];
  pick integer;
begin
  perform pg_temp.as_admin();
  select * into r from public.game_rooms where id = p_room;
  if r.status <> 'playing' then return r.status; end if;
  idx := (r.state ->> 'turn')::integer;
  uid := (r.state -> 'players' ->> idx)::uuid;
  if r.state ->> 'die' is not null then
    legal := private.ludo_legal(r.state, idx, (r.state ->> 'die')::integer);
  end if;
  perform pg_temp.as_user(uid);
  if r.state ->> 'die' is null then
    perform public.ludo_roll(p_room);
  else
    -- Someone else's token: refused.
    if pg_temp.err(format('select public.ludo_move(%L, %s)', p_room, 7)) <> 'this token cannot move' then
      raise exception 'FAIL games: an impossible token was accepted';
    end if;
    select k into pick from unnest(legal) k order by (r.state -> 'tokens' -> idx ->> k)::integer desc limit 1;
    perform public.ludo_move(p_room, pick);
  end if;
  return 'playing';
end $$;

do $$
declare
  rid uuid := current_setting('games.public_room')::uuid;
  n integer := 0;
  st text := 'playing';
  r public.game_rooms;
  captures integer;
begin
  while st = 'playing' and n < 3000 loop
    st := pg_temp.play_one(rid);
    n := n + 1;
  end loop;
  perform pg_temp.as_admin();
  select * into r from public.game_rooms where id = rid;
  perform pg_temp.check(r.status = 'finished', format('the game ends with a winner (%s actions)', n));
  perform pg_temp.check(private.ludo_won(r.state, (select (i.idx - 1)::int from jsonb_array_elements_text(r.state -> 'players') with ordinality i(u, idx) where i.u::uuid = r.winner_id)), 'the winner has four tokens home');
  perform pg_temp.check((select place from public.game_participants where room_id = rid and user_id = r.winner_id) = 1, 'the winner is first');
  perform pg_temp.check((select count(distinct place) from public.game_participants where room_id = rid and place is not null) = 3, 'every player gets a place');
  perform pg_temp.check(exists (select 1 from public.game_messages where room_id = rid and kind = 'system' and body = 'won'), 'the chat says who won');
  select count(*) into captures from public.game_messages where room_id = rid and body = 'captured';
  raise notice '    (captures in this game: %)', captures;
end $$;

select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a3');
do $$
declare g jsonb := public.games_recent();
begin
  perform pg_temp.check(jsonb_array_length(g) >= 1 and jsonb_array_length(g -> 0 -> 'people') = 2, 'recent games list the other players');
  perform pg_temp.check(pg_temp.err(format('select public.ludo_roll(%L)', current_setting('games.public_room'))) = 'this game is not running', 'a finished game takes no move');
end $$;
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a1');
do $$
declare g jsonb := public.games_recent();
begin
  -- Lina blocked Yara: never listed (Yara was not in this game anyway); Omar and Sara are.
  perform pg_temp.check(jsonb_array_length(g -> 0 -> 'people') = 2, 'Lina sees the two others of her game');
end $$;

-- ───────── Absent players and leaving ─────────
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a3');
do $$
declare rid uuid := (public.game_create('ludo', 'mixte', 'public', 2) ->> 'id')::uuid;
begin
  perform set_config('games.away_room', rid::text, false);
end $$;
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
select public.game_join(current_setting('games.away_room')::uuid);
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a3');
select public.game_start(current_setting('games.away_room')::uuid);
-- Sara never plays: the deadline passes three times, the server plays for her, then she is out and Omar wins.
select pg_temp.as_admin();
do $$
declare rid uuid := current_setting('games.away_room')::uuid; r public.game_rooms; turns integer := 0;
begin
  loop
    select * into r from public.game_rooms where id = rid;
    exit when r.status <> 'playing' or turns > 400;
    if (r.state -> 'players' ->> (r.state ->> 'turn')::integer)::uuid = '9a3e0000-0000-0000-0000-0000000000a3' then
      update public.game_rooms set turn_deadline = now() - interval '1 second' where id = rid;
      perform pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
      perform public.game_tick(rid);
    else
      perform pg_temp.play_one(rid);
    end if;
    perform pg_temp.as_admin();
    turns := turns + 1;
  end loop;
  select * into r from public.game_rooms where id = rid;
  perform pg_temp.check(r.status = 'finished' and r.winner_id = '9a3e0000-0000-0000-0000-0000000000a2', 'a player away three turns is out; the last one in wins');
  perform pg_temp.check(exists (select 1 from public.game_messages where room_id = rid and body = 'away'), 'the chat says who was away too long');
end $$;

-- Leaving a two-player game gives the win to the other.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a4');
do $$
declare rid uuid := (public.game_create('ludo', 'mixte', 'public', 2) ->> 'id')::uuid;
begin
  perform set_config('games.leave_room', rid::text, false);
end $$;
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a2');
select public.game_join(current_setting('games.leave_room')::uuid);
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a4');
select public.game_start(current_setting('games.leave_room')::uuid);
select public.game_leave(current_setting('games.leave_room')::uuid);
select pg_temp.as_admin();
select pg_temp.check((select status = 'finished' and winner_id = '9a3e0000-0000-0000-0000-0000000000a2' from public.game_rooms where id = current_setting('games.leave_room')::uuid),
  'leaving a two-player game gives the other the win');

-- A waiting room whose last player leaves is closed; the host role moves on otherwise.
select pg_temp.as_user('9a3e0000-0000-0000-0000-0000000000a4');
do $$
declare rid uuid := (public.game_create('ludo', 'mixte', 'public', 4) ->> 'id')::uuid;
begin
  perform public.game_leave(rid);
  perform pg_temp.as_admin();
  perform pg_temp.check((select status from public.game_rooms where id = rid) = 'abandoned', 'an empty waiting room is closed');
end $$;

-- Only the database sweeps; members cannot call the engine.
select pg_temp.as_admin();
select private.games_sweep();
select pg_temp.check(not has_function_privilege('authenticated', 'private.game_advance(uuid)', 'execute'), 'members cannot call the engine directly');
select pg_temp.check(not has_function_privilege('authenticated', 'private.ludo_do_roll(uuid, jsonb, integer, boolean)', 'execute'), 'members cannot roll for someone');
select pg_temp.check(not has_function_privilege('anon', 'public.games_overview(text)', 'execute'), 'signed-out visitors read no counts');
