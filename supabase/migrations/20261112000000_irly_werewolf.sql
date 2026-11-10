-- IRLY Loup-Garou, step A: the Classic mode played by the server, online
-- (unranked), in training against AI players, and in person (IRL).
-- Rules: docs/LOUP-GAROU.md (the owner's V3 rule book and decisions).
--
-- The server alone knows the cards. A phone only reads its player's view
-- (ww_view), sends intentions (ww_act, ww_say) and asks the server to move
-- on when a phase is over (game_tick). AI players decide from the very same
-- view a human gets (private.ww_view_for), never from the cards.
--
--   ww_create(p_space, p_visibility, p_size, p_kind, p_composition, p_title, p_lang)
--   ww_training(p_space, p_size, p_role, p_difficulty)   (starts at once, never ranked)
--   ww_view(p_room)          my player's view: my card, what I know, the table, the log
--   ww_act(p_room, p_kind, p_target, p_target2)
--   ww_say(p_room, p_body, p_channel)
--   ww_skip_day(p_room)      IRL: the host moves the table to the vote
--   ww_stats()               my games, training apart
-- and the shared ones (game_join, game_join_code, game_quickplay, game_leave,
-- game_kick, game_start, game_tick), which now know Loup-Garou.
-- Idempotent.

-- ───────── Shared tables learn Loup-Garou ─────────
alter table public.game_rooms add column if not exists kind text not null default 'online';
do $$ begin
  alter table public.game_rooms add constraint game_rooms_kind_check check (kind in ('online', 'training', 'irl'));
exception when duplicate_object then null; end $$;

alter table public.game_messages add column if not exists channel text not null default 'all';
alter table public.game_messages add column if not exists seat integer;
do $$ begin
  alter table public.game_messages add constraint game_messages_channel_check check (channel in ('all', 'wolves', 'dead'));
exception when duplicate_object then null; end $$;
alter table public.game_messages drop constraint if exists game_messages_kind_check;
alter table public.game_messages add constraint game_messages_kind_check check (kind in ('chat', 'system', 'bot'));

-- ───────── Loup-Garou tables (private: never read by a phone) ─────────
create table if not exists private.ww_games (
  room_id uuid primary key references public.game_rooms (id) on delete cascade,
  mode text not null default 'classic' check (mode = 'classic'),
  kind text not null check (kind in ('online', 'training', 'irl')),
  difficulty text check (difficulty in ('beginner', 'intermediate', 'expert')),
  size integer not null check (size between 6 and 20),
  composition jsonb,
  extras jsonb not null default '[]'::jsonb,
  phase text not null default 'lobby' check (phase in ('lobby', 'night', 'witch', 'day', 'vote', 'revote', 'ended')),
  night integer not null default 0,
  day integer not null default 0,
  deadline timestamptz,
  night_state jsonb not null default '{}'::jsonb,
  revote integer[],
  -- Step A: nothing is ranked; training never will be (V3 §16).
  ranked boolean not null default false,
  human_role text,
  result jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  constraint ww_training_unranked check (kind <> 'training' or not ranked),
  constraint ww_step_a_unranked check (not ranked)
);

create table if not exists private.ww_players (
  room_id uuid not null references private.ww_games (room_id) on delete cascade,
  seat integer not null,
  user_id uuid references public.profiles (id) on delete set null,
  bot boolean not null default false,
  name text not null,
  card text not null,
  charges jsonb not null default '{}'::jsonb,
  camp text not null check (camp in ('village', 'wolves')),
  wolf_since integer,
  alive boolean not null default true,
  death text,
  died_at text,
  lover integer,
  lover_opposed boolean not null default false,
  known jsonb not null default '[]'::jsonb,
  memory jsonb not null default '{}'::jsonb,
  primary key (room_id, seat)
);
create unique index if not exists ww_players_user_idx on private.ww_players (room_id, user_id) where user_id is not null;

create table if not exists private.ww_actions (
  room_id uuid not null references private.ww_games (room_id) on delete cascade,
  phase text not null,
  round integer not null,
  seat integer not null,
  kind text not null,
  target integer,
  target2 integer,
  at timestamptz not null default now(),
  primary key (room_id, phase, round, seat, kind)
);

-- What happened, and who may read it: 'all', 'wolves' (the pack as it is when read), 'seat:N'.
create table if not exists private.ww_log (
  id bigint generated always as identity primary key,
  room_id uuid not null references private.ww_games (room_id) on delete cascade,
  at timestamptz not null default now(),
  audience text not null,
  kind text not null,
  data jsonb not null default '{}'::jsonb
);
create index if not exists ww_log_room_idx on private.ww_log (room_id, id);

alter table private.ww_games enable row level security;
alter table private.ww_players enable row level security;
alter table private.ww_actions enable row level security;
alter table private.ww_log enable row level security;
revoke all on private.ww_games, private.ww_players, private.ww_actions, private.ww_log from public, anon, authenticated;

-- ───────── Cards ─────────
create or replace function private.ww_roles() returns text[]
language sql immutable as $$
  select array['werewolf', 'villager', 'seer', 'witch', 'hunter', 'cupid', 'little_girl', 'salvateur', 'thief', 'elder']
$$;

create or replace function private.ww_camp(p_role text) returns text
language sql immutable as $$
  select case when p_role = 'werewolf' then 'wolves' else 'village' end
$$;

/** What a card can still do: charges follow the card (V3 §2). */
create or replace function private.ww_fresh_charges(p_role text) returns jsonb
language sql immutable as $$
  select case p_role
    when 'witch' then '{"life": 1, "death": 1}'
    when 'hunter' then '{"shot": 1}'
    when 'elder' then '{"life": 1}'
    when 'little_girl' then '{"hint": 1}'
    when 'cupid' then '{"link": 1}'
    when 'thief' then '{"steal": 1}'
    when 'salvateur' then '{"last": null}'
    else '{}' end::jsonb
$$;

/** Wolves by size (V3 table; sizes in between take the lower step). */
create or replace function private.ww_wolves_for(p_size integer) returns integer
language sql immutable as $$
  select case when p_size < 8 then 1 when p_size < 12 then 2 when p_size < 15 then 3 when p_size < 20 then 4 else 5 end
$$;

/** The default deck for a size (docs/LOUP-GAROU.md): role → count, Voleur's two extra cards included. */
create or replace function private.ww_default_composition(p_size integer) returns jsonb
language plpgsql immutable as $$
declare
  c jsonb := jsonb_build_object('werewolf', private.ww_wolves_for(p_size), 'seer', 1, 'witch', 1);
  specials integer;
begin
  if p_size >= 7 then c := c || '{"hunter": 1}'; end if;
  if p_size >= 8 then c := c || '{"salvateur": 1}'; end if;
  if p_size >= 9 then c := c || '{"cupid": 1}'; end if;
  if p_size >= 10 then c := c || '{"little_girl": 1}'; end if;
  if p_size >= 11 then c := c || '{"elder": 1}'; end if;
  if p_size >= 13 then c := c || '{"thief": 1}'; end if;
  select coalesce(sum(value::text::integer), 0) into specials from jsonb_each(c);
  return c || jsonb_build_object('villager', p_size + case when c ? 'thief' then 2 else 0 end - specials);
end $$;

/** A composition the host sent, checked: the deck for p_size players, or a refusal (V3 §2). */
create or replace function private.ww_check_composition(p_size integer, p_comp jsonb) returns jsonb
language plpgsql immutable as $$
declare
  k text;
  v jsonb;
  total integer := 0;
  wolves integer;
  out_ jsonb := '{}'::jsonb;
begin
  if p_comp is null then return private.ww_default_composition(p_size); end if;
  if jsonb_typeof(p_comp) <> 'object' then raise exception 'composition: a list of cards' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_comp) loop
    if not (k = any (private.ww_roles())) then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::integer < 0 then
      raise exception 'composition: a whole number per card' using errcode = '22023';
    end if;
    if k not in ('werewolf', 'villager') and (v::text)::integer > 1 then raise exception 'composition: one of each special card' using errcode = '22023'; end if;
    if (v::text)::integer > 0 then out_ := out_ || jsonb_build_object(k, (v::text)::integer); end if;
    total := total + (v::text)::integer;
  end loop;
  wolves := coalesce((out_ ->> 'werewolf')::integer, 0);
  if wolves < 1 then raise exception 'composition: at least one werewolf' using errcode = '22023'; end if;
  if wolves * 2 >= p_size then raise exception 'composition: werewolves must be fewer than half the players' using errcode = '22023'; end if;
  if total <> p_size + (case when out_ ? 'thief' then 2 else 0 end) then
    raise exception 'composition: one card per player (two more with the thief)' using errcode = '22023';
  end if;
  return out_;
end $$;

-- ───────── Small helpers ─────────
create or replace function private.ww_log_add(p_room uuid, p_audience text, p_kind text, p_data jsonb default '{}'::jsonb) returns void
language sql volatile security definer set search_path = public, private as $$
  insert into private.ww_log (room_id, audience, kind, data) values (p_room, p_audience, p_kind, coalesce(p_data, '{}'::jsonb))
$$;

/** The pack that may act and talk this night: alive werewolves who joined before it (V3 §4). */
create or replace function private.ww_pack(p_room uuid, p_night integer) returns integer[]
language sql stable security definer set search_path = public, private as $$
  select coalesce(array_agg(seat order by seat), '{}') from private.ww_players
  where room_id = p_room and alive and camp = 'wolves' and coalesce(wolf_since, 0) <= p_night
$$;

/** A deterministic pick among ties (V3 §3 phase 6): the same room and round always give the same seat. */
create or replace function private.ww_pick(p_room uuid, p_round text, p_seats integer[]) returns integer
language sql immutable as $$
  select s from unnest(p_seats) s order by md5(p_room::text || ':' || p_round || ':' || s) limit 1
$$;

create or replace function private.ww_rand() returns double precision
language sql volatile as $$
  select get_byte(uuid_send(gen_random_uuid()), 0) / 256.0 + get_byte(uuid_send(gen_random_uuid()), 1) / 65536.0
$$;

create or replace function private.ww_touch(p_room uuid) returns void
language sql volatile security definer set search_path = public as $$
  update public.game_rooms set updated_at = now() where id = p_room
$$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_roles()', 'private.ww_camp(text)', 'private.ww_fresh_charges(text)', 'private.ww_wolves_for(integer)',
    'private.ww_default_composition(integer)', 'private.ww_check_composition(integer, jsonb)', 'private.ww_log_add(uuid, text, text, jsonb)',
    'private.ww_pack(uuid, integer)', 'private.ww_pick(uuid, text, integer[])', 'private.ww_rand()', 'private.ww_touch(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────── Starting a game ─────────
/** Shuffles the deck and deals: humans first by seat, AI players after; at least one werewolf dealt. */
create or replace function private.ww_deal(p_room uuid, p_humans uuid[], p_bots integer, p_human_role text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  deck text[];
  k text;
  v jsonb;
  n integer;
  tries integer := 0;
  names constant text[] := array['Léo', 'Inès', 'Sam', 'Nora', 'Yanis', 'Maya', 'Hugo', 'Lina', 'Adam', 'Jade', 'Noah', 'Zoé', 'Malik', 'Sofia', 'Elias', 'Rania', 'Tom', 'Aya', 'Nils', 'Lou'];
  bot_names text[];
  role_ text;
  pos integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  n := g.size;
  loop
    deck := '{}';
    for k, v in select * from jsonb_each(g.composition) loop
      for i in 1..(v::text)::integer loop deck := deck || k; end loop;
    end loop;
    select array_agg(x order by gen_random_uuid()) into deck from unnest(deck) x;
    -- Training: the member plays the role she chose (V3 §11), taken out of the deck.
    if p_human_role is not null then
      if not (p_human_role = any (deck)) then raise exception 'composition: that role is not in this game' using errcode = '22023'; end if;
      pos := array_position(deck, p_human_role);
      deck := array[p_human_role] || coalesce((select array_agg(x order by gen_random_uuid()) from unnest(deck[1:pos - 1] || deck[pos + 1:]) x), '{}');
    end if;
    tries := tries + 1;
    exit when 'werewolf' = any (deck[1:n]) and exists (select 1 from unnest(deck[1:n]) r where r <> 'werewolf') or tries > 60;
  end loop;
  select array_agg(x order by gen_random_uuid()) into bot_names from unnest(names) x;
  delete from private.ww_players where room_id = p_room;
  for s in 0..n - 1 loop
    role_ := deck[s + 1];
    insert into private.ww_players (room_id, seat, user_id, bot, name, card, charges, camp, wolf_since)
    values (p_room, s,
      case when s < coalesce(array_length(p_humans, 1), 0) then p_humans[s + 1] end,
      s >= coalesce(array_length(p_humans, 1), 0),
      case when s < coalesce(array_length(p_humans, 1), 0)
        then coalesce((select p.first_name from public.profiles p where p.id = p_humans[s + 1]), 'A player')
        else bot_names[s - coalesce(array_length(p_humans, 1), 0) + 1] end,
      role_, private.ww_fresh_charges(role_), private.ww_camp(role_), case when role_ = 'werewolf' then 0 end);
  end loop;
  update private.ww_games set extras = coalesce((
    select jsonb_agg(jsonb_build_object('role', r, 'charges', private.ww_fresh_charges(r))) from unnest(deck[n + 1:n + 2]) r), '[]'::jsonb)
  where room_id = p_room;
end $$;
revoke all on function private.ww_deal(uuid, uuid[], integer, text) from public, anon, authenticated;

/** Durations by kind of game, in seconds. */
create or replace function private.ww_duration(p_kind text, p_phase text) returns integer
language sql immutable as $$
  select case p_kind
    when 'irl' then case p_phase when 'night' then 60 when 'witch' then 30 when 'day' then 300 when 'vote' then 60 else 45 end
    when 'training' then case p_phase when 'night' then 40 when 'witch' then 25 when 'day' then 90 when 'vote' then 45 else 35 end
    else case p_phase when 'night' then 45 when 'witch' then 25 when 'day' then 150 when 'vote' then 60 else 45 end
  end
$$;
revoke all on function private.ww_duration(text, text) from public, anon, authenticated;

create or replace function private.ww_enter(p_room uuid, p_phase text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare g private.ww_games;
begin
  select * into g from private.ww_games where room_id = p_room;
  update private.ww_games set phase = p_phase,
    night = case when p_phase = 'night' then night + 1 else night end,
    day = case when p_phase = 'day' then day + 1 else day end,
    night_state = case when p_phase = 'night' then '{}'::jsonb else night_state end,
    deadline = now() + make_interval(secs => private.ww_duration(g.kind, p_phase))
  where room_id = p_room;
  perform private.ww_log_add(p_room, 'all', 'phase', jsonb_build_object('phase', p_phase,
    'night', (select night from private.ww_games where room_id = p_room), 'day', (select day from private.ww_games where room_id = p_room)));
  perform private.ww_bots_act(p_room);
  perform private.ww_touch(p_room);
end $$;
revoke all on function private.ww_enter(uuid, text) from public, anon, authenticated;

create or replace function private.ww_start(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  humans uuid[];
  n integer;
  comp jsonb;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  if g.phase <> 'lobby' then raise exception 'this game has already started' using errcode = '22023'; end if;
  select array_agg(gp.user_id order by gp.seat) into humans from public.game_participants gp where gp.room_id = p_room and gp.left_at is null;
  n := coalesce(array_length(humans, 1), 0);
  if g.kind <> 'training' then
    if n < 6 then raise exception 'six players are needed to start' using errcode = '22023'; end if;
    -- The deck follows the players present: the host's composition if it fits them, else the default one.
    comp := case when g.composition is not null and private.ww_card_count(g.composition) = n + case when g.composition ? 'thief' then 2 else 0 end
      then private.ww_check_composition(n, g.composition) else private.ww_default_composition(n) end;
    update private.ww_games set size = n, composition = comp where room_id = p_room;
  end if;
  perform private.ww_deal(p_room, humans, (select size from private.ww_games where room_id = p_room) - n, g.human_role);
  update private.ww_games set started_at = now() where room_id = p_room;
  update public.game_rooms set status = 'playing', started_at = now(), updated_at = now() where id = p_room;
  perform private.ww_log_add(p_room, 'all', 'start', jsonb_build_object('size', (select size from private.ww_games where room_id = p_room),
    'composition', (select composition from private.ww_games where room_id = p_room)));
  perform private.ww_enter(p_room, 'night');
end $$;
revoke all on function private.ww_start(uuid) from public, anon, authenticated;

create or replace function private.ww_card_count(p_comp jsonb) returns integer
language sql immutable as $$
  select coalesce(sum(value::text::integer), 0)::integer from jsonb_each(p_comp)
$$;
revoke all on function private.ww_card_count(jsonb) from public, anon, authenticated;

-- ───────── What each player may do now ─────────
/** The actions a seat must or may take in the current phase: [{kind, targets: [seats]}]. */
create or replace function private.ww_options(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  p private.ww_players;
  alive_others integer[];
  alive_all integer[];
  out_ jsonb := '[]'::jsonb;
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into p from private.ww_players where room_id = p_room and seat = p_seat;
  if not found or g.phase in ('lobby', 'ended') then return out_; end if;
  select coalesce(array_agg(seat order by seat), '{}') into alive_all from private.ww_players where room_id = p_room and alive;
  alive_others := array_remove(alive_all, p_seat);
  if not p.alive then return out_; end if;
  if g.phase = 'night' then
    if p_seat = any (private.ww_pack(p_room, g.night)) then
      out_ := out_ || jsonb_build_object('kind', 'wolf', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_all) s
        where (select camp from private.ww_players q where q.room_id = p_room and q.seat = s) <> 'wolves'));
    end if;
    if p.card = 'seer' then out_ := out_ || jsonb_build_object('kind', 'seer', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'salvateur' then
      out_ := out_ || jsonb_build_object('kind', 'protect', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where s is distinct from (p.charges ->> 'last')::integer));
    end if;
    if p.card = 'hunter' and (p.charges ->> 'shot')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'shoot', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'little_girl' and (p.charges ->> 'hint')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'hint', 'targets', '[]'::jsonb); end if;
    if p.card = 'cupid' and g.night = 1 and (p.charges ->> 'link')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'link', 'targets', to_jsonb(alive_all)); end if;
    if p.card = 'thief' and g.night = 1 and (p.charges ->> 'steal')::integer > 0 and jsonb_array_length(g.extras) = 2 then
      -- 0 or 1: one of the two extra cards; -1: keep the Voleur (owner, 2026-11-10).
      out_ := out_ || jsonb_build_object('kind', 'steal', 'targets', '[0, 1, -1]'::jsonb, 'cards', (select jsonb_agg(e -> 'role') from jsonb_array_elements(g.extras) e));
    end if;
  elsif g.phase = 'witch' and p.card = 'witch' then
    if (p.charges ->> 'life')::integer > 0 and g.night_state ->> 'wolves' is not null and (g.night_state ->> 'wolves')::integer <> p_seat then
      out_ := out_ || jsonb_build_object('kind', 'heal', 'targets', jsonb_build_array((g.night_state ->> 'wolves')::integer));
    end if;
    if (p.charges ->> 'death')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'poison', 'targets', to_jsonb(alive_others)); end if;
  elsif g.phase = 'day' then
    out_ := out_ || jsonb_build_object('kind', 'ready', 'targets', '[]'::jsonb);
  elsif g.phase = 'vote' then
    out_ := out_ || jsonb_build_object('kind', 'vote', 'targets', to_jsonb(alive_others));
  elsif g.phase = 'revote' then
    out_ := out_ || jsonb_build_object('kind', 'vote', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(g.revote) s where s <> p_seat and s = any (alive_all)));
  end if;
  return out_;
end $$;
revoke all on function private.ww_options(uuid, integer) from public, anon, authenticated;

/** Records a seat's intention after checking it (humans through ww_act, AI players directly). */
create or replace function private.ww_submit(p_room uuid, p_seat integer, p_kind text, p_target integer, p_target2 integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  opts jsonb;
  opt jsonb;
  round_ integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  opts := private.ww_options(p_room, p_seat);
  if p_kind = 'pass' then
    if jsonb_array_length(opts) = 0 then raise exception 'nothing to do now' using errcode = '22023'; end if;
  else
    select o into opt from jsonb_array_elements(opts) o where o ->> 'kind' = p_kind;
    if opt is null then raise exception 'you cannot do that now' using errcode = '22023'; end if;
    if jsonb_array_length(opt -> 'targets') > 0 and p_kind <> 'link' and not (opt -> 'targets') @> to_jsonb(p_target) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    if p_kind = 'link' and (p_target is null or p_target2 is null or p_target = p_target2
        or not (opt -> 'targets') @> to_jsonb(p_target) or not (opt -> 'targets') @> to_jsonb(p_target2)) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    -- The witch uses one potion per night (V3 §3 phase 7).
    if p_kind in ('heal', 'poison') then
      delete from private.ww_actions where room_id = p_room and phase = 'witch' and round = g.night and seat = p_seat and kind in ('heal', 'poison', 'pass');
    end if;
  end if;
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  if p_kind = 'pass' then
    delete from private.ww_actions where room_id = p_room and phase = g.phase and round = round_ and seat = p_seat;
  else
    delete from private.ww_actions where room_id = p_room and phase = g.phase and round = round_ and seat = p_seat and kind = 'pass';
  end if;
  insert into private.ww_actions (room_id, phase, round, seat, kind, target, target2)
    values (p_room, g.phase, round_, p_seat, p_kind, p_target, p_target2)
    on conflict (room_id, phase, round, seat, kind) do update set target = excluded.target, target2 = excluded.target2, at = now();
end $$;
revoke all on function private.ww_submit(uuid, integer, text, integer, integer) from public, anon, authenticated;

/** Whether everyone expected has acted: the phase can end before its deadline. */
create or replace function private.ww_phase_done(p_room uuid) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  round_ integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  -- Every alive seat with something to do has acted (or passed). IRL and online days also wait for the clock or the host.
  if g.phase = 'day' and g.kind <> 'training' then return false; end if;
  return not exists (
    select 1 from private.ww_players p
    where p.room_id = p_room and p.alive and jsonb_array_length(private.ww_options(p_room, p.seat)) > 0
      and not exists (select 1 from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p.seat)
      -- A day in training waits for the humans only (AI players are always ready).
  );
end $$;
revoke all on function private.ww_phase_done(uuid) from public, anon, authenticated;

-- ───────── Deaths and victory ─────────
/** Kills the seats given, then their lovers (once per player, no loop: V3 §6). Returns every seat that died. */
create or replace function private.ww_kill(p_room uuid, p_seats integer[], p_cause text, p_when text) returns integer[]
language plpgsql volatile security definer set search_path = public, private as $$
declare
  dead integer[] := '{}';
  todo integer[] := p_seats;
  s integer;
  l integer;
begin
  while cardinality(todo) > 0 loop
    s := todo[1];
    todo := todo[2:];
    if s = any (dead) or not exists (select 1 from private.ww_players where room_id = p_room and seat = s and alive) then continue; end if;
    update private.ww_players set alive = false, death = case when s = any (p_seats) then p_cause else 'love' end, died_at = p_when
      where room_id = p_room and seat = s;
    dead := dead || s;
    select lover into l from private.ww_players where room_id = p_room and seat = s;
    if l is not null and not (l = any (dead)) then todo := todo || l; end if;
  end loop;
  return dead;
end $$;
revoke all on function private.ww_kill(uuid, integer[], text, text) from public, anon, authenticated;

/** V3 §10 / §3 phase 12: ends the game when a side has won. Returns true when it ended. */
create or replace function private.ww_check_victory(p_room uuid) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  alive_n integer;
  wolves_n integer;
  lovers_alive integer;
  opposed boolean;
  winner text;
  winners integer[];
begin
  select count(*), count(*) filter (where camp = 'wolves') into alive_n, wolves_n from private.ww_players where room_id = p_room and alive;
  select count(*) filter (where alive), bool_or(lover_opposed) into lovers_alive, opposed from private.ww_players where room_id = p_room and lover is not null;
  if alive_n = 0 then
    winner := 'draw';
  elsif coalesce(opposed, false) and lovers_alive = 2 and alive_n = 2 then
    winner := 'lovers';
  elsif wolves_n = 0 then
    winner := 'village';
  elsif wolves_n >= alive_n - wolves_n then
    winner := 'wolves';
  else
    return false;
  end if;
  select coalesce(array_agg(seat order by seat), '{}') into winners from private.ww_players
  where room_id = p_room and case winner
    when 'lovers' then lover is not null
    when 'village' then camp = 'village' and not lover_opposed
    when 'wolves' then camp = 'wolves' and not lover_opposed
    else false end;
  perform private.ww_finish(p_room, winner, winners);
  return true;
end $$;
revoke all on function private.ww_check_victory(uuid) from public, anon, authenticated;

create or replace function private.ww_finish(p_room uuid, p_winner text, p_winners integer[]) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare reveal jsonb;
begin
  select jsonb_agg(jsonb_build_object('seat', seat, 'name', name, 'bot', bot, 'card', card, 'camp', camp, 'alive', alive,
    'death', death, 'lover', lover, 'won', seat = any (p_winners)) order by seat) into reveal
  from private.ww_players where room_id = p_room;
  update private.ww_games set phase = 'ended', deadline = null, ended_at = now(),
    result = jsonb_build_object('winner', p_winner, 'seats', to_jsonb(p_winners), 'ranked', false)
  where room_id = p_room;
  update public.game_rooms set status = 'finished', finished_at = now(), turn_deadline = null, updated_at = now() where id = p_room;
  update public.game_participants gp set place = case when exists (
      select 1 from private.ww_players p where p.room_id = p_room and p.user_id = gp.user_id and p.seat = any (p_winners)) then 1 else 2 end
  where gp.room_id = p_room;
  perform private.ww_log_add(p_room, 'all', 'game_over', jsonb_build_object('winner', p_winner, 'seats', to_jsonb(p_winners), 'cards', reveal));
end $$;
revoke all on function private.ww_finish(uuid, text, integer[]) from public, anon, authenticated;

-- ───────── Resolving phases (V3 §3) ─────────
create or replace function private.ww_resolve_night(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  a record;
  p private.ww_players;
  ns jsonb := '{}'::jsonb;
  extra jsonb;
  pack integer[];
  target integer;
  tops integer[];
  wolf_seat integer;
  others integer[];
  hint integer[];
begin
  select * into g from private.ww_games where room_id = p_room for update;

  -- Phase 3: Voleur (night 1). Keeping the card is allowed (owner, 2026-11-10).
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'steal' loop
    select * into p from private.ww_players where room_id = p_room and seat = a.seat;
    if a.target in (0, 1) then
      extra := g.extras -> a.target;
      update private.ww_players set card = extra ->> 'role', charges = extra -> 'charges', camp = private.ww_camp(extra ->> 'role'),
        wolf_since = case when extra ->> 'role' = 'werewolf' then g.night + 1 else wolf_since end
      where room_id = p_room and seat = a.seat;
      g.extras := jsonb_set(g.extras, array[a.target::text], jsonb_build_object('role', 'thief', 'charges', '{"steal": 0}'::jsonb));
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'thief_took', jsonb_build_object('card', extra ->> 'role'));
    else
      update private.ww_players set charges = '{"steal": 0}'::jsonb where room_id = p_room and seat = a.seat;
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'thief_kept', '{}');
    end if;
  end loop;
  update private.ww_games set extras = g.extras where room_id = p_room;

  -- Cupidon (night 1).
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'link' loop
    update private.ww_players set lover = a.target2 where room_id = p_room and seat = a.target;
    update private.ww_players set lover = a.target where room_id = p_room and seat = a.target2;
    update private.ww_players q set lover_opposed = (select count(distinct camp) from private.ww_players r where r.room_id = p_room and r.seat in (a.target, a.target2)) = 2
      where q.room_id = p_room and q.seat in (a.target, a.target2);
    update private.ww_players set charges = jsonb_set(charges, '{link}', '0') where room_id = p_room and seat = a.seat;
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'linked', jsonb_build_object('a', a.target, 'b', a.target2));
    perform private.ww_log_add(p_room, 'seat:' || a.target, 'lover', jsonb_build_object('seat', a.target2));
    perform private.ww_log_add(p_room, 'seat:' || a.target2, 'lover', jsonb_build_object('seat', a.target));
  end loop;

  -- Phase 4: Salvateur.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'protect' loop
    ns := ns || jsonb_build_object('protected', a.target);
    update private.ww_players set charges = jsonb_set(charges, '{last}', to_jsonb(a.target)) where room_id = p_room and seat = a.seat;
  end loop;
  -- A Salvateur who protected nobody can protect anyone the next night.
  update private.ww_players set charges = jsonb_set(charges, '{last}', 'null') where room_id = p_room and card = 'salvateur'
    and not exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = ww_players.seat and x.kind = 'protect');

  -- Phase 5: Voyante (after the swaps), Petite Fille.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'seer' loop
    update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'seer', 'night', g.night, 'seat', a.target,
      'card', (select card from private.ww_players q where q.room_id = p_room and q.seat = a.target)))
    where room_id = p_room and seat = a.seat;
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'seer_saw', jsonb_build_object('seat', a.target,
      'card', (select card from private.ww_players q where q.room_id = p_room and q.seat = a.target)));
  end loop;
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'hint' loop
    select seat into wolf_seat from private.ww_players where room_id = p_room and alive and camp = 'wolves' and seat <> a.seat order by gen_random_uuid() limit 1;
    if wolf_seat is not null then
      select coalesce(array_agg(seat), '{}') into others from (
        select seat from private.ww_players where room_id = p_room and alive and seat not in (a.seat, wolf_seat) order by gen_random_uuid() limit 2) x;
      select array_agg(s order by gen_random_uuid()) into hint from unnest(others || wolf_seat) s;
      update private.ww_players set charges = jsonb_set(charges, '{hint}', '0'),
        known = known || jsonb_build_array(jsonb_build_object('kind', 'hint', 'night', g.night, 'seats', to_jsonb(hint)))
      where room_id = p_room and seat = a.seat;
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'hint', jsonb_build_object('seats', to_jsonb(hint)));
    end if;
  end loop;

  -- Phase 6: the pack's victim (most votes; ties: the server's fixed pick; no vote: no attack).
  pack := private.ww_pack(p_room, g.night);
  select coalesce(array_agg(t), '{}') into tops from (
    select a2.target as t, count(*) c, max(count(*)) over () m
    from private.ww_actions a2
    where a2.room_id = p_room and a2.phase = 'night' and a2.round = g.night and a2.kind = 'wolf' and a2.seat = any (pack)
      and exists (select 1 from private.ww_players q where q.room_id = p_room and q.seat = a2.target and q.alive and q.camp <> 'wolves')
    group by a2.target) v where c = m;
  target := case when cardinality(tops) > 0 then private.ww_pick(p_room, 'wolves:' || g.night, tops) end;
  if target is not null then
    ns := ns || jsonb_build_object('wolves', target);
    perform private.ww_log_add(p_room, 'wolves', 'pack_target', jsonb_build_object('seat', target, 'night', g.night));
  end if;

  -- Phase 8 (collected now): the Chasseur's shot.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'shoot' loop
    ns := ns || jsonb_build_object('shot', jsonb_build_object('by', a.seat, 'target', a.target));
    update private.ww_players set charges = jsonb_set(charges, '{shot}', '0') where room_id = p_room and seat = a.seat;
  end loop;

  update private.ww_games set night_state = ns where room_id = p_room;
  -- Phase 7: the Sorcière, if one can still act; else the attacks now.
  if exists (select 1 from private.ww_players where room_id = p_room and alive and card = 'witch'
      and ((charges ->> 'life')::integer > 0 or (charges ->> 'death')::integer > 0)) then
    perform private.ww_enter(p_room, 'witch');
  else
    perform private.ww_resolve_attacks(p_room);
  end if;
end $$;
revoke all on function private.ww_resolve_night(uuid) from public, anon, authenticated;

create or replace function private.ww_resolve_witch(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  a record;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  for a in select * from private.ww_actions where room_id = p_room and phase = 'witch' and round = g.night and kind in ('heal', 'poison') loop
    if a.kind = 'heal' then
      g.night_state := g.night_state || '{"healed": true}';
      update private.ww_players set charges = jsonb_set(charges, '{life}', '0') where room_id = p_room and seat = a.seat;
    else
      g.night_state := g.night_state || jsonb_build_object('poisoned', a.target);
      update private.ww_players set charges = jsonb_set(charges, '{death}', '0') where room_id = p_room and seat = a.seat;
    end if;
  end loop;
  update private.ww_games set night_state = g.night_state where room_id = p_room;
  perform private.ww_resolve_attacks(p_room);
end $$;
revoke all on function private.ww_resolve_witch(uuid) from public, anon, authenticated;

/** Phase 9: every attack of the night, then deaths, lovers, victory, morning. */
create or replace function private.ww_resolve_attacks(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  ns jsonb;
  attacks jsonb := '[]'::jsonb;
  atk jsonb;
  v integer;
  victims integer[] := '{}';
  dead integer[];
  shot_by integer;
  shot_at integer;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  ns := g.night_state;
  if ns ->> 'wolves' is not null and not coalesce((ns ->> 'healed')::boolean, false) then
    attacks := attacks || jsonb_build_object('victim', (ns ->> 'wolves')::integer, 'source', 'wolves');
  end if;
  if ns ->> 'poisoned' is not null then attacks := attacks || jsonb_build_object('victim', (ns ->> 'poisoned')::integer, 'source', 'poison'); end if;
  if ns -> 'shot' is not null then
    shot_by := (ns -> 'shot' ->> 'by')::integer;
    shot_at := (ns -> 'shot' ->> 'target')::integer;
    -- The target's camp after the night's changes (V3 §5).
    if (select camp from private.ww_players where room_id = p_room and seat = shot_at) = 'wolves' then
      attacks := attacks || jsonb_build_object('victim', shot_at, 'source', 'hunter');
      perform private.ww_log_add(p_room, 'seat:' || shot_by, 'shot_hit', jsonb_build_object('seat', shot_at));
    else
      attacks := attacks || jsonb_build_object('victim', shot_by, 'source', 'hunter_miss');
      perform private.ww_log_add(p_room, 'seat:' || shot_by, 'shot_missed', jsonb_build_object('seat', shot_at));
    end if;
  end if;
  for atk in select * from jsonb_array_elements(attacks) loop
    v := (atk ->> 'victim')::integer;
    -- Immunity first (V3 phase 9 order): the Ancien survives the first attack of the wolves.
    if atk ->> 'source' = 'wolves' and exists (select 1 from private.ww_players where room_id = p_room and seat = v and card = 'elder' and (charges ->> 'life')::integer > 0) then
      update private.ww_players set charges = jsonb_set(charges, '{life}', '0') where room_id = p_room and seat = v;
      perform private.ww_log_add(p_room, 'seat:' || v, 'elder_resisted', '{}');
      continue;
    end if;
    -- The Salvateur's protection stops every attack of the night on that player.
    if (ns ->> 'protected')::integer = v then continue; end if;
    if not (v = any (victims)) then victims := victims || v; end if;
  end loop;
  dead := private.ww_kill(p_room, victims, 'night', 'night ' || g.night);
  perform private.ww_log_add(p_room, 'all', 'morning', jsonb_build_object('night', g.night, 'dead', to_jsonb(dead)));
  if private.ww_check_victory(p_room) then return; end if;
  perform private.ww_enter(p_room, 'day');
end $$;
revoke all on function private.ww_resolve_attacks(uuid) from public, anon, authenticated;

/** V3 §10: the most voted is out; a tie gets a second round between the tied; a second tie, nobody. */
create or replace function private.ww_resolve_vote(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  tops integer[];
  ballots jsonb;
  dead integer[];
begin
  select * into g from private.ww_games where room_id = p_room for update;
  select coalesce(jsonb_object_agg(a.seat::text, a.target), '{}') into ballots
    from private.ww_actions a join private.ww_players p on p.room_id = a.room_id and p.seat = a.seat and p.alive
    where a.room_id = p_room and a.phase = g.phase and a.round = g.day and a.kind = 'vote';
  select coalesce(array_agg(t order by t), '{}') into tops from (
    select (value::text)::integer t, count(*) c, max(count(*)) over () m from jsonb_each(ballots) group by 1) x where c = m;
  perform private.ww_log_add(p_room, 'all', 'votes', jsonb_build_object('day', g.day, 'round', g.phase, 'ballots', ballots));
  if cardinality(tops) = 1 then
    dead := private.ww_kill(p_room, tops, 'vote', 'day ' || g.day);
    perform private.ww_log_add(p_room, 'all', 'voted_out', jsonb_build_object('seat', tops[1], 'dead', to_jsonb(dead)));
    if private.ww_check_victory(p_room) then return; end if;
    perform private.ww_enter(p_room, 'night');
  elsif cardinality(tops) > 1 and g.phase = 'vote' then
    update private.ww_games set revote = tops where room_id = p_room;
    perform private.ww_log_add(p_room, 'all', 'tie', jsonb_build_object('seats', to_jsonb(tops)));
    perform private.ww_enter(p_room, 'revote');
  else
    perform private.ww_log_add(p_room, 'all', 'no_elimination', jsonb_build_object('day', g.day));
    perform private.ww_enter(p_room, 'night');
  end if;
end $$;
revoke all on function private.ww_resolve_vote(uuid) from public, anon, authenticated;

/** Moves the game on when its phase is over (everyone acted) or its time is up. Returns whether it moved. */
create or replace function private.ww_advance(p_room uuid, p_force boolean default false) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  moved boolean := false;
begin
  for i in 1..40 loop
    select * into g from private.ww_games where room_id = p_room for update skip locked;
    if not found or g.phase in ('lobby', 'ended') then exit; end if;
    if not (p_force or g.deadline <= now() or private.ww_phase_done(p_room)) then exit; end if;
    p_force := false;
    if g.phase = 'night' then perform private.ww_resolve_night(p_room);
    elsif g.phase = 'witch' then perform private.ww_resolve_witch(p_room);
    elsif g.phase = 'day' then perform private.ww_enter(p_room, 'vote');
    else perform private.ww_resolve_vote(p_room);
    end if;
    moved := true;
  end loop;
  return moved;
end $$;
revoke all on function private.ww_advance(uuid, boolean) from public, anon, authenticated;

-- ───────── What a player sees (the one view for humans and AI) ─────────
create or replace function private.ww_view_for(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  me private.ww_players;
  pack integer[];
  in_pack boolean;
  round_ integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into me from private.ww_players where room_id = p_room and seat = p_seat;
  pack := private.ww_pack(p_room, greatest(g.night, 1));
  in_pack := me.alive and me.camp = 'wolves' and coalesce(me.wolf_since, 0) <= greatest(g.night, 1);
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  return jsonb_build_object(
    'phase', g.phase, 'night', g.night, 'day', g.day, 'deadline', g.deadline, 'now', now(),
    'kind', g.kind, 'mode', g.mode, 'size', g.size, 'difficulty', g.difficulty, 'ranked', g.ranked,
    'composition', g.composition,
    'me', jsonb_build_object('seat', me.seat, 'card', me.card, 'camp', me.camp, 'alive', me.alive, 'charges', me.charges,
      'lover', me.lover, 'known', me.known,
      -- The pack, only to its members.
      'pack', case when in_pack then to_jsonb(pack) end),
    'players', (select jsonb_agg(jsonb_build_object('seat', p.seat, 'name', p.name, 'bot', p.bot, 'user_id', p.user_id, 'alive', p.alive,
        'acted', exists (select 1 from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p.seat)
          and g.phase in ('day', 'vote', 'revote'))
        order by p.seat) from private.ww_players p where p.room_id = p_room),
    'options', private.ww_options(p_room, p_seat),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('kind', a.kind, 'target', a.target, 'target2', a.target2)), '[]')
        from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p_seat),
    -- The Sorcière learns the victim only while her potion of life remains (V3 §3 phase 7).
    'victim', case when g.phase = 'witch' and me.card = 'witch' and me.alive and (me.charges ->> 'life')::integer > 0
      then g.night_state -> 'wolves' end,
    'pack_votes', case when in_pack and g.phase = 'night' then (select coalesce(jsonb_object_agg(a.seat::text, a.target), '{}')
        from private.ww_actions a where a.room_id = p_room and a.phase = 'night' and a.round = g.night and a.kind = 'wolf' and a.seat = any (pack)) end,
    'revote', to_jsonb(g.revote),
    'result', g.result,
    'log', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'kind', l.kind, 'data', l.data, 'audience', l.audience) order by l.id), '[]')
        from (select * from private.ww_log l where l.room_id = p_room
          and (l.audience = 'all' or l.audience = 'seat:' || p_seat or (l.audience = 'wolves' and in_pack))
          order by l.id desc limit 150) l)
  );
end $$;
revoke all on function private.ww_view_for(uuid, integer) from public, anon, authenticated;

create or replace function private.ww_my_seat(p_room uuid) returns integer
language sql stable security definer set search_path = public, private as $$
  select seat from private.ww_players where room_id = p_room and user_id = auth.uid()
$$;
revoke all on function private.ww_my_seat(uuid) from public, anon, authenticated;

-- ───────── AI players (V3 §11, §14): decide from their own view only ─────────
/** The suspicion an AI player has of each seat, from what it saw: votes, deaths, its own power, chat aimed at it. */
create or replace function private.ww_bot_suspicion(p_view jsonb, p_memory jsonb, p_difficulty text, p_room uuid) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  me integer := (p_view -> 'me' ->> 'seat')::integer;
  sus jsonb := '{}'::jsonb;
  p jsonb;
  e jsonb;
  k jsonb;
  s integer;
  victims integer[] := '{}';
  b record;
  noise double precision := case p_difficulty when 'beginner' then 3 when 'intermediate' then 1 else 0.4 end;
begin
  for p in select * from jsonb_array_elements(p_view -> 'players') loop
    s := (p ->> 'seat')::integer;
    if s <> me then
      -- A fixed noise per pair: the same AI keeps the same hunch.
      sus := sus || jsonb_build_object(s::text, (('x' || substr(md5(p_room::text || me || ':' || s), 1, 6))::bit(24)::integer / 16777216.0) * noise);
    end if;
  end loop;
  -- Players killed at night were not wolves: whoever pushed votes against them is suspicious (intermediate and expert).
  for e in select * from jsonb_array_elements(p_view -> 'log') loop
    if e ->> 'kind' = 'morning' then
      select victims || coalesce(array_agg(x::integer), '{}') into victims from jsonb_array_elements_text(e -> 'data' -> 'dead') x;
    end if;
  end loop;
  if p_difficulty <> 'beginner' then
    for e in select * from jsonb_array_elements(p_view -> 'log') where value ->> 'kind' = 'votes' loop
      for b in select key::integer voter, value::text::integer target from jsonb_each(e -> 'data' -> 'ballots') loop
        if b.target = any (victims) and b.voter <> me and sus ? b.voter::text then
          sus := jsonb_set(sus, array[b.voter::text], to_jsonb((sus ->> b.voter::text)::numeric + 1.5));
        end if;
        if b.target = me and sus ? b.voter::text then
          sus := jsonb_set(sus, array[b.voter::text], to_jsonb((sus ->> b.voter::text)::numeric + 0.7));
        end if;
      end loop;
    end loop;
  end if;
  -- What its own power told it.
  for k in select * from jsonb_array_elements(p_view -> 'me' -> 'known') loop
    if k ->> 'kind' = 'seer' and sus ? (k ->> 'seat') then
      sus := jsonb_set(sus, array[k ->> 'seat'], to_jsonb(case when k ->> 'card' = 'werewolf' then 100 else -100 end));
    elsif k ->> 'kind' = 'hint' then
      for s in select x::integer from jsonb_array_elements_text(k -> 'seats') x loop
        if sus ? s::text then sus := jsonb_set(sus, array[s::text], to_jsonb((sus ->> s::text)::numeric + 2)); end if;
      end loop;
    end if;
  end loop;
  -- Its lover is never suspected; who accused it in the chat is (memory).
  if p_view -> 'me' ->> 'lover' is not null and sus ? (p_view -> 'me' ->> 'lover') then
    sus := jsonb_set(sus, array[p_view -> 'me' ->> 'lover'], to_jsonb(-50));
  end if;
  for k in select * from jsonb_each(coalesce(p_memory -> 'accused_by', '{}')) loop
    if sus ? k.key then sus := jsonb_set(sus, array[k.key], to_jsonb((sus ->> k.key)::numeric + (k.value::text)::numeric)); end if;
  end loop;
  return sus;
end $$;
revoke all on function private.ww_bot_suspicion(jsonb, jsonb, text, uuid) from public, anon, authenticated;

/** The alive seat a bot suspects most among p_choices (or least, p_most false). */
create or replace function private.ww_bot_pick(p_sus jsonb, p_choices jsonb, p_most boolean default true) returns integer
language sql immutable as $$
  select (c::text)::integer from jsonb_array_elements(p_choices) c
  order by case when p_most then -coalesce((p_sus ->> (c::text))::numeric, 0) else coalesce((p_sus ->> (c::text))::numeric, 0) end, c::text
  limit 1
$$;
revoke all on function private.ww_bot_pick(jsonb, jsonb, boolean) from public, anon, authenticated;

create or replace function private.ww_bot_say(p_room uuid, p_seat integer, p_key text, p_data jsonb, p_channel text, p_delay integer) returns void
language sql volatile security definer set search_path = public as $$
  insert into public.game_messages (room_id, user_id, kind, body, data, channel, seat, created_at)
  values (p_room, null, 'bot', p_key, p_data, p_channel, p_seat, now() + make_interval(secs => p_delay))
$$;
revoke all on function private.ww_bot_say(uuid, integer, text, jsonb, text, integer) from public, anon, authenticated;

/** Every AI player acts for the phase just opened, from its own view (never the cards). */
create or replace function private.ww_bots_act(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  b private.ww_players;
  v jsonb;
  sus jsonb;
  opt jsonb;
  kind_ text;
  t integer;
  t2 integer;
  r double precision;
  diff text;
  top integer;
  top_score numeric;
  wolves_choice integer;
  pack jsonb;
  claim jsonb;
  said integer := 0;
begin
  select * into g from private.ww_games where room_id = p_room;
  diff := coalesce(g.difficulty, 'intermediate');
  for b in select * from private.ww_players where room_id = p_room and bot and alive order by seat loop
    v := private.ww_view_for(p_room, b.seat);
    sus := private.ww_bot_suspicion(v, b.memory, diff, p_room);
    pack := v -> 'me' -> 'pack';
    for opt in select * from jsonb_array_elements(v -> 'options') loop
      kind_ := opt ->> 'kind';
      t := null; t2 := null;
      r := private.ww_rand();
      if kind_ = 'wolf' then
        -- The pack agrees on one victim: the one who seems most dangerous to it (who voted against a wolf), else a fixed pick.
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          order by -(select count(*) from jsonb_array_elements(v -> 'log') e, jsonb_each(e -> 'data' -> 'ballots') bb
            where e ->> 'kind' = 'votes' and bb.key = c::text and pack @> bb.value), md5(p_room::text || g.night || c::text) limit 1;
      elsif kind_ = 'seer' then
        -- Someone not checked yet, the most suspected (beginner: anyone not checked).
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          where not exists (select 1 from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'kind' = 'seer' and k ->> 'seat' = c::text)
          order by case when diff = 'beginner' then random() else -coalesce((sus ->> c::text)::numeric, 0) end limit 1;
      elsif kind_ = 'protect' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          order by coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
      elsif kind_ = 'shoot' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        top_score := coalesce((sus ->> top::text)::numeric, 0);
        -- Shoot only when sure enough (beginner: sometimes, at random).
        if (diff = 'beginner' and g.night >= 2 and r < 0.25) or (diff = 'intermediate' and top_score >= 4) or (diff = 'expert' and top_score >= 3) then t := top; end if;
      elsif kind_ = 'hint' then
        if g.night >= (case diff when 'beginner' then 1 else 2 end) then kind_ := 'hint'; else kind_ := null; end if;
      elsif kind_ = 'link' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
        select (c::text)::integer into t2 from jsonb_array_elements(opt -> 'targets') c where (c::text)::integer <> t order by random() limit 1;
      elsif kind_ = 'steal' then
        -- Take the stronger card, keep the Voleur when both are plain villagers.
        select (i - 1)::integer into t from jsonb_array_elements_text(opt -> 'cards') with ordinality c(card, i)
          where card not in ('villager', 'thief')
          order by array_position(array['seer', 'witch', 'werewolf', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder'], card) limit 1;
        if t is null then t := -1; end if;
      elsif kind_ = 'heal' then
        if not ((diff = 'beginner' and r < 0.5) or diff = 'expert' or (diff = 'intermediate' and g.night <= 2)) then kind_ := null; else t := (opt -> 'targets' ->> 0)::integer; end if;
      elsif kind_ = 'poison' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        if coalesce((sus ->> top::text)::numeric, 0) >= (case diff when 'beginner' then 99 when 'intermediate' then 4 else 3 end) then t := top; else kind_ := null; end if;
      elsif kind_ = 'ready' then
        null;
      elsif kind_ = 'vote' then
        if pack is not null then
          -- A wolf votes with the crowd against a non-wolf, else against the villager it fears most.
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c where not pack @> c
            order by -coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
        else
          t := private.ww_bot_pick(sus, opt -> 'targets');
          if diff = 'beginner' and r < 0.4 then select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1; end if;
        end if;
      end if;
      if kind_ is null or (kind_ in ('wolf', 'seer', 'protect', 'shoot', 'poison', 'heal', 'vote') and t is null) or (kind_ = 'link' and (t is null or t2 is null)) then
        continue;
      end if;
      begin
        perform private.ww_submit(p_room, b.seat, kind_, t, t2);
      exception when others then
        -- A choice that is no longer valid: the bot passes.
        null;
      end;
    end loop;
    -- A bot with nothing chosen passes, so the phase does not wait for it.
    if jsonb_array_length(v -> 'options') > 0 and not exists (
        select 1 from private.ww_actions a where a.room_id = p_room and a.seat = b.seat and a.phase = g.phase
          and a.round = case when g.phase in ('night', 'witch') then g.night else g.day end) then
      perform private.ww_submit(p_room, b.seat, case when g.phase = 'day' then 'ready' else 'pass' end, null, null);
    end if;
    -- Talking (V3 §15): during the day, from what it saw; never a card it does not know.
    if g.phase = 'day' and g.kind = 'training' and said < 4 and private.ww_rand() < (case diff when 'beginner' then 0.45 else 0.65 end) then
      top := private.ww_bot_pick(sus, (select jsonb_agg(p -> 'seat') from jsonb_array_elements(v -> 'players') p
        where (p ->> 'alive')::boolean and (p ->> 'seat')::integer <> b.seat and (pack is null or not pack @> (p -> 'seat'))));
      select k into claim from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'kind' = 'seer' and k ->> 'card' = 'werewolf'
        and exists (select 1 from jsonb_array_elements(v -> 'players') p where p ->> 'seat' = k ->> 'seat' and (p ->> 'alive')::boolean) limit 1;
      if claim is not null and diff = 'expert' then
        perform private.ww_bot_say(p_room, b.seat, 'claim_seer_wolf', jsonb_build_object('target', (claim ->> 'seat')::integer), 'all', 4 + said * 7);
      elsif top is not null then
        perform private.ww_bot_say(p_room, b.seat, (array['accuse', 'doubt', 'watch', 'vote_for'])[1 + floor(private.ww_rand() * 4)::integer],
          jsonb_build_object('target', top), 'all', 4 + said * 7);
      else
        perform private.ww_bot_say(p_room, b.seat, 'unsure', '{}', 'all', 4 + said * 7);
      end if;
      said := said + 1;
    end if;
    if g.phase = 'night' and pack is not null and g.kind = 'training' and private.ww_rand() < 0.5 then
      perform private.ww_bot_say(p_room, b.seat, 'pack_plan', '{}', 'wolves', 3);
    end if;
  end loop;
end $$;
revoke all on function private.ww_bots_act(uuid) from public, anon, authenticated;

-- ───────── Chat visibility (V3 §22: night, wolves, the dead) ─────────
create or replace function private.ww_channel_ok(p_room uuid, p_channel text) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  me private.ww_players;
begin
  if p_channel = 'all' then return true; end if;
  select * into g from private.ww_games where room_id = p_room;
  if not found then return false; end if;
  if g.phase = 'ended' then return true; end if;
  select * into me from private.ww_players where room_id = p_room and user_id = auth.uid();
  if not found then return false; end if;
  if p_channel = 'wolves' then return me.alive and me.camp = 'wolves' and coalesce(me.wolf_since, 0) <= greatest(g.night, 1); end if;
  if p_channel = 'dead' then return not me.alive; end if;
  return false;
end $$;
revoke all on function private.ww_channel_ok(uuid, text) from public, anon;
grant execute on function private.ww_channel_ok(uuid, text) to authenticated;

drop policy if exists game_messages_read on public.game_messages;
create policy game_messages_read on public.game_messages for select to authenticated
  using (private.game_message_visible(room_id, user_id) and created_at <= now() and private.ww_channel_ok(room_id, channel));

-- ───────── Public functions ─────────
create or replace function public.ww_create(p_space text, p_visibility text default 'public', p_size integer default 8,
  p_kind text default 'online', p_composition jsonb default null, p_title text default null, p_lang text default 'fr') returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  c text;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_kind not in ('online', 'irl') then raise exception 'online or in person' using errcode = '22023'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'public or private' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_lang not in ('en', 'fr') then raise exception 'language: en or fr' using errcode = '22023'; end if;
  if (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.user_id = me and gp.left_at is null
      where r.status in ('waiting', 'playing')) >= 3 then
    raise exception 'you are already in three games' using errcode = '22023';
  end if;
  if p_composition is not null then perform private.ww_check_composition(p_size, p_composition); end if;
  -- In person, the table joins with the code (QR code): always private.
  c := case when p_visibility = 'private' or p_kind = 'irl' then private.game_new_code() end;
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind)
    values ('werewolf', sp, me, nullif(btrim(coalesce(p_title, '')), ''), case when p_kind = 'irl' then 'private' else p_visibility end, c, p_lang, p_size, p_kind)
    returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition) values (rid, p_kind, p_size, p_composition);
  return jsonb_build_object('id', rid, 'code', c);
end $$;
revoke all on function public.ww_create(text, text, integer, text, jsonb, text, text) from public, anon;
grant execute on function public.ww_create(text, text, integer, text, jsonb, text, text) to authenticated;

/** Training against AI players: starts at once, the member plays the role she chose. Never ranked. */
create or replace function public.ww_training(p_space text, p_size integer default 8, p_role text default null, p_difficulty text default 'intermediate') returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  comp jsonb;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_difficulty not in ('beginner', 'intermediate', 'expert') then raise exception 'difficulty: beginner, intermediate or expert' using errcode = '22023'; end if;
  comp := private.ww_default_composition(p_size);
  if p_role is not null then
    if not (p_role = any (private.ww_roles())) then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    -- A role not in the default deck takes a villager's place.
    if not comp ? p_role then
      comp := comp || jsonb_build_object(p_role, 1, 'villager', (comp ->> 'villager')::integer - 1 + case when p_role = 'thief' then 2 else 0 end);
    end if;
    perform private.ww_check_composition(p_size, comp);
  end if;
  -- One training at a time: an unfinished one is closed.
  update public.game_rooms r set status = 'abandoned', finished_at = now(), updated_at = now()
    where r.kind = 'training' and r.host_id = me and r.status in ('waiting', 'playing');
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind, status)
    values ('werewolf', sp, me, null, 'private', null, 'fr', p_size, 'training', 'waiting') returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition, difficulty, human_role) values (rid, 'training', p_size, comp, p_difficulty, p_role);
  perform private.ww_start(rid);
  return rid;
end $$;
revoke all on function public.ww_training(text, integer, text, text) from public, anon;
grant execute on function public.ww_training(text, integer, text, text) to authenticated;

create or replace function public.ww_view(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  seat_ integer;
  g private.ww_games;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into g from private.ww_games where room_id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  -- Reading moves a finished phase on (no one waits for the minute sweep).
  perform private.ww_advance(p_room);
  select * into g from private.ww_games where room_id = p_room;
  if g.phase = 'lobby' then
    -- The deck the game will use: the host's if it fits the players there, else the default one for them.
    seat_ := (select count(*) from public.game_participants gp where gp.room_id = p_room and gp.left_at is null);
    return jsonb_build_object('phase', 'lobby', 'kind', g.kind, 'size', g.size, 'mode', g.mode, 'ranked', g.ranked, 'present', seat_,
      'custom', g.composition is not null
        and private.ww_card_count(g.composition) = greatest(seat_, 6) + (case when g.composition ? 'thief' then 2 else 0 end),
      'composition', case when g.composition is not null
        and private.ww_card_count(g.composition) = greatest(seat_, 6) + (case when g.composition ? 'thief' then 2 else 0 end)
        then g.composition else private.ww_default_composition(greatest(seat_, 6)) end);
  end if;
  seat_ := private.ww_my_seat(p_room);
  if seat_ is null then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  return private.ww_view_for(p_room, seat_);
end $$;
revoke all on function public.ww_view(uuid) from public, anon;
grant execute on function public.ww_view(uuid) to authenticated;

create or replace function public.ww_act(p_room uuid, p_kind text, p_target integer default null, p_target2 integer default null) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  seat_ integer;
begin
  perform 1 from private.ww_games where room_id = p_room for update;
  if not found then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  seat_ := private.ww_my_seat(p_room);
  if seat_ is null then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  if (select phase from private.ww_games where room_id = p_room) in ('lobby', 'ended') then raise exception 'this game is not running' using errcode = '22023'; end if;
  perform private.ww_submit(p_room, seat_, p_kind, p_target, p_target2);
  perform private.ww_touch(p_room);
  perform private.ww_advance(p_room);
end $$;
revoke all on function public.ww_act(uuid, text, integer, integer) from public, anon;
grant execute on function public.ww_act(uuid, text, integer, integer) to authenticated;

create or replace function public.ww_say(p_room uuid, p_body text, p_channel text default 'all') returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  g private.ww_games;
  p private.ww_players;
  b text := btrim(coalesce(p_body, ''));
  bot private.ww_players;
begin
  select * into g from private.ww_games where room_id = p_room;
  if not found then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  if g.kind = 'irl' then raise exception 'in person, talk around the table' using errcode = '22023'; end if;
  select * into p from private.ww_players where room_id = p_room and user_id = me;
  if g.phase = 'lobby' then
    if not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
      raise exception 'you are not playing in this game' using errcode = '42501';
    end if;
    p_channel := 'all';
  elsif not found then
    raise exception 'you are not playing in this game' using errcode = '42501';
  elsif g.phase <> 'ended' then
    -- The dead talk among themselves; the pack at night; everyone alive by day (V3 §22).
    if not p.alive then
      if p_channel <> 'dead' then raise exception 'the dead only talk among themselves' using errcode = '22023'; end if;
    elsif p_channel = 'wolves' then
      if g.phase not in ('night', 'witch') or not private.ww_channel_ok(p_room, 'wolves') then raise exception 'you cannot talk here now' using errcode = '22023'; end if;
    elsif p_channel = 'all' then
      if g.phase not in ('day', 'vote', 'revote') then raise exception 'the village sleeps: no talking at night' using errcode = '22023'; end if;
    else
      raise exception 'you cannot talk here now' using errcode = '22023';
    end if;
  else
    p_channel := 'all';
  end if;
  if char_length(b) not between 1 and 300 then raise exception 'write 1 to 300 characters' using errcode = '22023'; end if;
  if (select count(*) from public.game_messages m where m.room_id = p_room and m.user_id = me and m.created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'slow down a little' using errcode = '22023';
  end if;
  insert into public.game_messages (room_id, user_id, body, channel, seat) values (p_room, me, b, p_channel, p.seat);
  -- In training, an AI player named in the day's chat answers, and remembers who named it.
  if g.kind = 'training' and g.phase in ('day', 'vote', 'revote') and p_channel = 'all' and p.alive then
    for bot in select * from private.ww_players where room_id = p_room and bot and alive
        and b ~* ('(^|[^[:alnum:]])' || regexp_replace(name, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($|[^[:alnum:]])') limit 2 loop
      update private.ww_players set memory = jsonb_set(memory, array['accused_by', p.seat::text],
        to_jsonb(coalesce((memory -> 'accused_by' ->> p.seat::text)::numeric, 0) + 1), true)
      where room_id = p_room and seat = bot.seat;
      perform private.ww_bot_say(p_room, bot.seat, (array['why_me', 'defend', 'calm'])[1 + floor(private.ww_rand() * 3)::integer],
        jsonb_build_object('target', p.seat), 'all', 3);
    end loop;
  end if;
end $$;
revoke all on function public.ww_say(uuid, text, text) from public, anon;
grant execute on function public.ww_say(uuid, text, text) to authenticated;

/** In person, the host ends the discussion and opens the vote. */
create or replace function public.ww_skip_day(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare me uuid := private.game_me();
begin
  if (select host_id from public.game_rooms where id = p_room) is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if (select phase from private.ww_games where room_id = p_room) <> 'day' then raise exception 'this game is not running' using errcode = '22023'; end if;
  perform private.ww_advance(p_room, true);
end $$;
revoke all on function public.ww_skip_day(uuid) from public, anon;
grant execute on function public.ww_skip_day(uuid) to authenticated;

/** My Loup-Garou games: online and in person, and training apart (V3 §16: never mixed with competition). */
create or replace function public.ww_stats() returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'played', count(*) filter (where g.kind <> 'training'),
    'won', count(*) filter (where g.kind <> 'training' and (g.result -> 'seats') @> to_jsonb(p.seat)),
    'training_played', count(*) filter (where g.kind = 'training'),
    'training_won', count(*) filter (where g.kind = 'training' and (g.result -> 'seats') @> to_jsonb(p.seat)),
    'cards_played', coalesce((select jsonb_agg(distinct q.card) from private.ww_players q join private.ww_games h on h.room_id = q.room_id
      where q.user_id = auth.uid() and h.phase = 'ended'), '[]'::jsonb))
  from private.ww_players p join private.ww_games g on g.room_id = p.room_id
  where p.user_id = auth.uid() and g.phase = 'ended'
$$;
revoke all on function public.ww_stats() from public, anon;
grant execute on function public.ww_stats() to authenticated;

/** The host changes the deck before the start (owner, 2026-11-10: a default deck the host may adjust within the rules). */
create or replace function public.ww_set_composition(p_room uuid, p_composition jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  n integer;
  comp jsonb;
begin
  if (select host_id from public.game_rooms where id = p_room) is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if (select phase from private.ww_games where room_id = p_room) is distinct from 'lobby' then raise exception 'this game has already started' using errcode = '22023'; end if;
  -- Checked for the players there now: at the start, a deck that no longer fits them gives way to the default one.
  n := private.ww_card_count(p_composition) - case when p_composition ? 'thief' then 2 else 0 end;
  if n not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  comp := case when p_composition is null then null else private.ww_check_composition(n, p_composition) end;
  update private.ww_games set composition = comp where room_id = p_room;
  perform private.ww_touch(p_room);
  return comp;
end $$;
revoke all on function public.ww_set_composition(uuid, jsonb) from public, anon;
grant execute on function public.ww_set_composition(uuid, jsonb) to authenticated;
