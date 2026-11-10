-- IRLY Loup-Garou, mode Chaos (20261114000000_irly_werewolf_chaos): random secret Classic deck.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL chaos: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

-- ───────── Decks ─────────
do $$
declare n integer; k integer; c jsonb; w integer; total integer; seen jsonb := '{}'::jsonb; distinct_decks integer;
begin
  for n in 6..20 loop
    for k in 1..20 loop
      c := private.ww_chaos_composition(n);
      w := (c ->> 'werewolf')::int;
      select sum(value::text::int) into total from jsonb_each(c);
      perform pg_temp.check(total = n and w >= 1 and w * 2 < n and not c ? 'thief'
        and not exists (select 1 from jsonb_each(c) e where e.key not in ('werewolf', 'villager') and e.value::text::int <> 1)
        and not exists (select 1 from jsonb_object_keys(c) x where not (x = any (private.ww_roles()))), format('a valid Chaos deck for %s players', n));
      seen := seen || jsonb_build_object(c::text, 1);
    end loop;
  end loop;
  select count(*) into distinct_decks from jsonb_object_keys(seen);
  perform pg_temp.check(distinct_decks > 100, format('Chaos decks vary (%s different decks in 300 draws)', distinct_decks));
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_for('chaos', 8, '{"werewolf": 2, "villager": 6}')$q$) = 'Chaos: the deck is drawn in secret',
    'a host cannot choose a Chaos deck');
  perform pg_temp.check((private.ww_default_for('classic', 8) ->> 'werewolf')::int = 2 and private.ww_default_for('classic', 8) = private.ww_default_composition(8),
    'the Classic deck is unchanged');
end $$;

-- ───────── A training game: the deck stays secret until the end ─────────
do $$
declare
  me uuid := gen_random_uuid();
  rid uuid;
  v jsonb;
  steps integer := 0;
begin
  insert into auth.users (id) values (me);
  insert into public.profiles (id, first_name, birthdate, gender, city_id, onboarded_at) values (me, 'Chaos', '1995-01-01', 'woman', 'dubai', now());
  perform set_config('request.jwt.claim.sub', me::text, true);
  rid := public.ww_training('mixte', 9, null, 'intermediate', 'chaos');
  perform pg_temp.check((select mode = 'chaos' and phase = 'night' from private.ww_games where room_id = rid), 'a Chaos training game starts');
  v := public.ww_view(rid);
  perform pg_temp.check(v ->> 'phase' = 'ended' or not v ? 'composition', format('a Chaos player does not see the deck (phase %s, keys %s)', v ->> 'phase', (select string_agg(k, ',') from jsonb_object_keys(v) k)));
  perform pg_temp.check(v ->> 'phase' = 'ended' or not exists (select 1 from jsonb_array_elements(v -> 'log') e where e -> 'data' ? 'composition'), 'nor in the log');
  while (select phase from private.ww_games where room_id = rid) <> 'ended' and steps < 300 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  v := public.ww_view(rid);
  perform pg_temp.check(v ->> 'phase' = 'ended' and v ? 'composition', 'the deck is shown once the game is over');
  perform pg_temp.check(pg_temp.err(format($q$select public.ww_create('mixte', 'private', 8, 'online', '{"werewolf": 2, "villager": 6}', null, 'fr', 'chaos')$q$)) = 'Chaos: the deck is drawn in secret',
    'a Chaos table refuses a chosen deck');
  perform pg_temp.check(pg_temp.err($q$select public.ww_training('mixte', 8, null, 'intermediate', 'nightmare')$q$) = 'this mode is not available yet',
    'an unknown mode is refused');
end $$;

-- ───────── Whole Chaos games played by AI players ─────────
create or replace function pg_temp.csim(p_size integer, p_diff text) returns text language plpgsql as $$
declare rid uuid := gen_random_uuid(); steps integer := 0;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', p_size, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty, mode) values (rid, 'training', p_size, private.ww_chaos_composition(p_size), p_diff, 'chaos');
  perform private.ww_deal(rid, '{}', p_size, null);
  perform private.ww_enter(rid, 'night');
  while (select phase from private.ww_games where room_id = rid) <> 'ended' and steps < 300 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  return coalesce((select result ->> 'winner' from private.ww_games where room_id = rid), 'stuck');
end $$;

do $$
declare n integer; d text; w text; games integer := 0; wins jsonb := '{}'::jsonb;
begin
  for n in 6..20 loop
    foreach d in array array['beginner', 'expert'] loop
      for k in 1..3 loop
        w := pg_temp.csim(n, d);
        games := games + 1;
        wins := jsonb_set(wins, array[w], to_jsonb(coalesce((wins ->> w)::int, 0) + 1));
      end loop;
    end loop;
  end loop;
  raise notice '    Chaos simulations: % games, results %', games, wins;
  perform pg_temp.check(not wins ? 'stuck', format('every simulated Chaos game ends (%s games)', games));
end $$;

select pg_temp.check(not has_function_privilege('authenticated', 'private.ww_chaos_composition(integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.ww_hide_chaos(uuid, jsonb)', 'execute'), 'members cannot call the Chaos helpers');

-- ───────── Play in a mode: joins a table of that mode, never another ─────────
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); ra uuid; rb uuid; rc uuid;
begin
  insert into auth.users (id) values (a), (b);
  insert into public.profiles (id, first_name, birthdate, gender, city_id, onboarded_at) values
    (a, 'Ana', '1995-01-01', 'woman', 'dubai', now()), (b, 'Bob', '1994-01-01', 'man', 'dubai', now());
  perform set_config('request.jwt.claim.sub', a::text, true);
  ra := public.ww_quickplay('mixte', 'dubai');
  perform pg_temp.check((select mode = 'dubai' from private.ww_games where room_id = ra), 'Play in Dubaï opens a Dubaï table');
  perform set_config('request.jwt.claim.sub', b::text, true);
  rb := public.ww_quickplay('mixte', 'chaos');
  perform pg_temp.check(rb <> ra and (select mode = 'chaos' from private.ww_games where room_id = rb), 'Play in Chaos does not join the Dubaï table');
  rc := public.ww_quickplay('mixte', 'dubai');
  perform pg_temp.check(rc = ra, 'Play in Dubaï joins the open Dubaï table');
end $$;
