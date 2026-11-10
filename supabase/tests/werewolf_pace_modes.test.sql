-- IRLY Loup-Garou: pace against the AI and the All powers mode (20261115000000_irly_werewolf_pace_modes). The deck
-- with one more werewolf and no Seer is still checked as a function; the mode named Nightmare is, since
-- 20261116000000, the book's Nightmare (its own cards, tested in werewolf_v3.test.sql).
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL pace/modes: %', label; end if;
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
declare n integer; c jsonb; d jsonb; total integer;
begin
  for n in 6..20 loop
    c := private.ww_nightmare_composition(n);
    d := private.ww_default_composition(n);
    select sum(value::text::int) into total from jsonb_each(c);
    perform pg_temp.check(not c ? 'seer' and (c ->> 'werewolf')::int >= (d ->> 'werewolf')::int and (c ->> 'werewolf')::int * 2 < n
      and total = n + case when c ? 'thief' then 2 else 0 end, format('Nightmare deck for %s: no Seer, at least as many werewolves, one card per seat', n));
    c := private.ww_powers_composition(n);
    select sum(value::text::int) into total from jsonb_each(c);
    perform pg_temp.check(total = n and (c ->> 'werewolf')::int = private.ww_wolves_for(n) and (not c ? 'villager' or (c ? 'elder' and c ? 'seer')),
      format('All powers deck for %s: no villager before every special card is in', n));
  end loop;
  perform pg_temp.check((private.ww_nightmare_composition(8) ->> 'werewolf')::int = 3, 'Nightmare at 8: three werewolves');
  perform pg_temp.check(private.ww_default_for('classic', 8) = private.ww_default_composition(8), 'the Classic deck is unchanged');
end $$;

-- ───────── Timers ─────────
select pg_temp.check(private.ww_duration('training', 'vote') = 90 and private.ww_duration('training', 'night') = 75 and private.ww_duration('online', 'vote') = 60
  and private.ww_min_seconds('training') = 5 and private.ww_min_seconds('online') = 0, 'training leaves more time; online timers unchanged');

-- ───────── A training game does not rush: a phase lasts at least 5 s, then follows the member ─────────
do $$
declare me uuid := gen_random_uuid(); rid uuid; v jsonb; before_ text;
begin
  insert into auth.users (id) values (me);
  insert into public.profiles (id, first_name, birthdate, gender, city_id, onboarded_at) values (me, 'Pace', '1995-01-01', 'woman', 'dubai', now());
  perform set_config('request.jwt.claim.sub', me::text, true);
  rid := public.ww_training('mixte', 8, 'villager', 'intermediate', 'classic');
  -- A villager sleeps at night: every AI player has acted, yet the night is still there.
  v := public.ww_view(rid);
  perform pg_temp.check(v ->> 'phase' = 'night' and (v ->> 'night')::int = 1, 'training: the first night does not end at once, though every AI player has acted');
  perform pg_temp.check(not private.ww_advance(rid), '… and reading the game again does not move it');
  -- Five seconds later (the phase began 6 s ago), it moves on.
  update private.ww_games set deadline = deadline - interval '6 seconds' where room_id = rid;
  v := public.ww_view(rid);
  perform pg_temp.check(v ->> 'phase' <> 'night' or (v ->> 'night')::int > 1, format('… after its 5 seconds the night ends (now %s)', v ->> 'phase'));
  -- The new phase, again, waits.
  before_ := v ->> 'phase';
  if before_ not in ('ended', 'day') then
    perform pg_temp.check((public.ww_view(rid)) ->> 'phase' = before_, 'the next phase waits too');
  end if;
  -- New modes start, with their deck; an unknown mode is refused.
  rid := public.ww_training('mixte', 8, null, 'intermediate', 'powers');
  perform pg_temp.check((select mode = 'powers' and not composition ? 'villager' from private.ww_games where room_id = rid), 'an All powers training game starts with its deck');
  rid := public.ww_quickplay('mixte', 'powers');
  perform pg_temp.check((select mode = 'powers' from private.ww_games where room_id = rid), 'Play online opens an All powers table');
  perform pg_temp.check((public.ww_view(rid) -> 'composition') = private.ww_powers_composition(6), 'its lobby shows the mode''s deck');
  perform pg_temp.check(pg_temp.err($q$select public.ww_training('mixte', 8, null, 'intermediate', 'no_such_mode')$q$) = 'this mode is not available yet', 'an unknown mode is still refused');
  perform pg_temp.check(pg_temp.err($q$select public.ww_quickplay('mixte', 'no_such_mode')$q$) = 'this mode is not available yet', '… by Play online too');
end $$;

-- ───────── Whole games in the new modes, played by AI players ─────────
create or replace function pg_temp.msim(p_mode text, p_size integer) returns text language plpgsql as $$
declare rid uuid := gen_random_uuid(); steps integer := 0;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', p_size, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty, mode) values (rid, 'training', p_size, private.ww_default_for(p_mode, p_size), 'intermediate', p_mode);
  perform private.ww_deal(rid, '{}', p_size, null);
  perform private.ww_enter(rid, 'night');
  while (select phase from private.ww_games where room_id = rid) <> 'ended' and steps < 300 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  return coalesce((select result ->> 'winner' from private.ww_games where room_id = rid), 'stuck');
end $$;
do $$
declare m text; n integer; w text; wins jsonb;
begin
  foreach m in array array['powers'] loop
    wins := '{}'::jsonb;
    for n in 6..20 loop
      for k in 1..4 loop
        w := pg_temp.msim(m, n);
        wins := jsonb_set(wins, array[w], to_jsonb(coalesce((wins ->> w)::int, 0) + 1));
      end loop;
    end loop;
    raise notice '    % simulations: 60 games, results %', m, wins;
    perform pg_temp.check(not wins ? 'stuck', format('every simulated %s game ends', m));
  end loop;
end $$;

select pg_temp.check(not has_function_privilege('authenticated', 'private.ww_modes()', 'execute')
  and not has_function_privilege('authenticated', 'private.ww_powers_composition(integer)', 'execute')
  and not has_function_privilege('anon', 'public.ww_quickplay(text, text)', 'execute')
  and has_function_privilege('authenticated', 'public.ww_training(text, integer, text, text, text)', 'execute'), 'privileges kept on the changed functions');
