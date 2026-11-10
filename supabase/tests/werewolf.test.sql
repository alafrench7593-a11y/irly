-- IRLY Loup-Garou, Classic mode (20261112000000_irly_werewolf + _shared).
-- Rules: docs/LOUP-GAROU.md. Runs after irly_test.sql (scripts/test-db.sh).
-- TEST accounts only, ids prefixed 7e57000…. Engine checks run as the
-- database (crafted games); access checks run as members.
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
  if not coalesce(ok, false) then raise exception 'FAIL werewolf: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

/** A crafted game: the given cards in seat order, all AI-free (seats driven by the test), at night 1. */
create or replace function pg_temp.game(p_cards text[], p_extras text[] default null) returns uuid language plpgsql as $$
declare rid uuid := gen_random_uuid();
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', array_length(p_cards, 1), 'online', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, extras) values (rid, 'online', array_length(p_cards, 1), '{}',
    coalesce((select jsonb_agg(jsonb_build_object('role', r, 'charges', private.ww_fresh_charges(r))) from unnest(p_extras) r), '[]'::jsonb));
  for i in 1..array_length(p_cards, 1) loop
    insert into private.ww_players (room_id, seat, bot, name, card, charges, camp, wolf_since)
      values (rid, i - 1, false, 'P' || (i - 1), p_cards[i], private.ww_fresh_charges(p_cards[i]), private.ww_camp(p_cards[i]), case when p_cards[i] = 'werewolf' then 0 end);
  end loop;
  update private.ww_games set phase = 'night', night = 1, deadline = now() + interval '1 hour' where room_id = rid;
  return rid;
end $$;
create or replace function pg_temp.act(r uuid, s integer, k text, t integer default null, t2 integer default null) returns void language sql as $$
  select private.ww_submit(r, s, k, t, t2)
$$;
create or replace function pg_temp.alive(r uuid, s integer) returns boolean language sql as $$
  select alive from private.ww_players where room_id = r and seat = s
$$;
create or replace function pg_temp.phase(r uuid) returns text language sql as $$
  select phase from private.ww_games where room_id = r
$$;
/** Ends the current phase now (as its deadline would). */
create or replace function pg_temp.next(r uuid) returns void language sql as $$
  select private.ww_advance(r, true)
$$;

select pg_temp.as_admin();

-- ───────── Compositions (V3 §2) ─────────
do $$
declare n integer; c jsonb; total integer; w integer;
begin
  for n in 6..20 loop
    c := private.ww_default_composition(n);
    total := private.ww_card_count(c);
    w := (c ->> 'werewolf')::integer;
    if total <> n + (case when c ? 'thief' then 2 else 0 end) or w < 1 or w * 2 >= n or (c ->> 'villager')::integer < 0 then
      raise exception 'FAIL werewolf: default composition for % is wrong: %', n, c;
    end if;
    perform private.ww_check_composition(n, c);
  end loop;
  perform pg_temp.check(true, 'default decks 6 to 20: one card per player (+2 with the Voleur), wolves 1 to 5, fewer than half');
  perform pg_temp.check((private.ww_default_composition(6) ->> 'werewolf')::int = 1 and (private.ww_default_composition(8) ->> 'werewolf')::int = 2
    and (private.ww_default_composition(12) ->> 'werewolf')::int = 3 and (private.ww_default_composition(15) ->> 'werewolf')::int = 4
    and (private.ww_default_composition(20) ->> 'werewolf')::int = 5, 'wolves follow the V3 table (6:1, 8:2, 12:3, 15:4, 20:5)');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"villager": 6}')$q$) = 'composition: at least one werewolf', 'no werewolf: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"werewolf": 3, "villager": 3}')$q$) = 'composition: werewolves must be fewer than half the players', 'half wolves: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"werewolf": 1, "seer": 2, "villager": 3}')$q$) = 'composition: one of each special card', 'two seers: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"werewolf": 1, "villager": 4}')$q$) = 'composition: one card per player (two more with the thief)', 'a card missing: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"werewolf": 1, "dragon": 1, "villager": 4}')$q$) = 'composition: unknown card', 'an unknown card: refused');
end $$;

-- ───────── The IRLY Chasseur (V3 §5) ─────────
do $$
declare r uuid;
begin
  -- 0 hunter, 1 wolf, 2 villager, 3 villager, 4 villager, 5 villager
  r := pg_temp.game(array['hunter', 'werewolf', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'shoot', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 1) and pg_temp.alive(r, 0), 'hunter shoots a wolf: the wolf dies, the hunter lives');
  perform pg_temp.check((select (charges ->> 'shot')::int = 0 from private.ww_players where room_id = r and seat = 0), '… the shot is used');
  perform pg_temp.check(pg_temp.phase(r) = 'ended' and (select result ->> 'winner' from private.ww_games where room_id = r) = 'village', '… last wolf dead: the village wins');

  r := pg_temp.game(array['hunter', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'werewolf', 'villager']);
  perform pg_temp.act(r, 0, 'shoot', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 0) and pg_temp.alive(r, 2), 'hunter shoots a villager: the hunter dies, the target lives');
  perform pg_temp.check((select (charges ->> 'shot')::int = 0 from private.ww_players where room_id = r and seat = 0), '… the shot is used too');

  -- Protected by the Salvateur, a hunter who missed survives; the shot is still used.
  r := pg_temp.game(array['hunter', 'werewolf', 'salvateur', 'villager', 'villager', 'villager', 'werewolf', 'villager']);
  perform pg_temp.act(r, 0, 'shoot', 3);
  perform pg_temp.act(r, 2, 'protect', 0);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 0) and pg_temp.alive(r, 3) and (select (charges ->> 'shot')::int = 0 from private.ww_players where room_id = r and seat = 0),
    'a protected hunter who missed survives; the shot is used');

  -- The witch's potion of life cannot cancel the hunter's shot.
  r := pg_temp.game(array['hunter', 'werewolf', 'witch', 'villager', 'villager', 'villager', 'werewolf', 'villager']);
  perform pg_temp.act(r, 0, 'shoot', 3);
  perform pg_temp.act(r, 1, 'wolf', 4);
  perform pg_temp.act(r, 6, 'wolf', 4);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.phase(r) = 'witch', 'the witch is called after the wolves');
  perform pg_temp.act(r, 2, 'heal', 4);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 4) and not pg_temp.alive(r, 0), 'the potion saves the wolves'' victim, not the hunter who missed');

  -- A shot validated stays active when the hunter dies the same night.
  r := pg_temp.game(array['hunter', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'werewolf', 'villager']);
  perform pg_temp.act(r, 0, 'shoot', 6);
  perform pg_temp.act(r, 1, 'wolf', 0);
  perform pg_temp.act(r, 6, 'wolf', 0);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 0) and not pg_temp.alive(r, 6), 'the hunter killed by the wolves still kills the wolf he shot (same night)');
end $$;

-- ───────── Sorcière, Salvateur, Ancien ─────────
do $$
declare r uuid; v jsonb;
begin
  -- 0 witch, 1 wolf, 2 salvateur, 3..7 villagers, 8 wolf
  r := pg_temp.game(array['witch', 'werewolf', 'salvateur', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.check(pg_temp.err(format('select private.ww_submit(%L, 2, %L, 2, null)', r, 'protect')) = 'not a valid target', 'the salvateur cannot protect himself (owner)');
  perform pg_temp.act(r, 2, 'protect', 3);
  perform pg_temp.act(r, 1, 'wolf', 0);
  perform pg_temp.act(r, 8, 'wolf', 0);
  perform pg_temp.next(r);
  v := private.ww_view_for(r, 0);
  perform pg_temp.check((v ->> 'victim')::int = 0 and not (v -> 'options') @> '[{"kind": "heal"}]', 'the witch sees she is the victim, but cannot heal herself (owner)');
  perform pg_temp.check(pg_temp.err(format('select private.ww_submit(%L, 0, %L, 0, null)', r, 'poison')) = 'not a valid target', 'nor poison herself');
  perform pg_temp.act(r, 0, 'poison', 4);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 0) and not pg_temp.alive(r, 4), 'the wolves'' victim and the poisoned player die');
  perform pg_temp.check((select (charges ->> 'death')::int = 0 and (charges ->> 'life')::int = 1 from private.ww_players where room_id = r and seat = 0), 'the potion of death is used, the other kept');

  -- One potion per night, and a used potion is gone.
  r := pg_temp.game(array['witch', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 1, 'wolf', 2);
  perform pg_temp.act(r, 7, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.act(r, 0, 'heal', 2);
  perform pg_temp.act(r, 0, 'poison', 3);
  perform pg_temp.check((select count(*) = 1 from private.ww_actions where room_id = r and phase = 'witch' and seat = 0), 'one potion per night: the last choice replaces the first');
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 3) and not pg_temp.alive(r, 2), '… so the poison was used, and the victim was not healed');

  -- Salvateur: not the same player two nights in a row; his protection stops the wolves.
  r := pg_temp.game(array['salvateur', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 0, 'protect', 2);
  perform pg_temp.act(r, 1, 'wolf', 2);
  perform pg_temp.act(r, 7, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 2) and (select (data -> 'dead') = '[]'::jsonb from private.ww_log where room_id = r and kind = 'morning'), 'protected: the wolves'' victim lives, a quiet night');
  perform pg_temp.next(r); -- day → vote
  perform pg_temp.next(r); -- vote (no ballots) → night 2
  perform pg_temp.check(pg_temp.err(format('select private.ww_submit(%L, 0, %L, 2, null)', r, 'protect')) = 'not a valid target', 'not the same player two nights in a row');

  -- Ancien: survives the first attack of the wolves, not the second.
  r := pg_temp.game(array['elder', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 1, 'wolf', 0);
  perform pg_temp.act(r, 7, 'wolf', 0);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 0), 'the Ancien survives the first attack of the wolves');
  perform pg_temp.next(r); perform pg_temp.next(r);
  perform pg_temp.act(r, 1, 'wolf', 0);
  perform pg_temp.act(r, 7, 'wolf', 0);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 0), '… not the second');
end $$;

-- ───────── Amoureux (V3 §6) ─────────
do $$
declare r uuid;
begin
  -- Same camp: one dies, the other too (once, no loop).
  r := pg_temp.game(array['cupid', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 0, 'link', 2, 3);
  perform pg_temp.act(r, 1, 'wolf', 2);
  perform pg_temp.act(r, 7, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 2) and not pg_temp.alive(r, 3)
    and (select death from private.ww_players where room_id = r and seat = 3) = 'love', 'a lover killed by the wolves takes the other with her');
  perform pg_temp.check((select count(*) = 2 from private.ww_log where room_id = r and kind = 'lover'), 'each lover was told the other''s name');
  perform pg_temp.check(not exists (select 1 from private.ww_log where room_id = r and kind = 'lover' and data ? 'card'), '… never the other''s card');

  -- Opposite camps: they win when they are the last two alive, not with their camps.
  r := pg_temp.game(array['cupid', 'werewolf', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'link', 1, 2);
  perform pg_temp.next(r);
  perform pg_temp.check((select bool_and(lover_opposed) from private.ww_players where room_id = r and seat in (1, 2)), 'a wolf and a villager in love: opposite camps');
  update private.ww_players set alive = false where room_id = r and seat in (0, 3, 4, 5);
  perform pg_temp.check(private.ww_check_victory(r), 'the two opposite lovers alone: the game ends');
  perform pg_temp.check((select result ->> 'winner' from private.ww_games where room_id = r) = 'lovers'
    and (select result -> 'seats' from private.ww_games where room_id = r) = '[1, 2]'::jsonb, 'the two opposite lovers alone: the lovers win, not the wolves');
end $$;

-- ───────── Voleur, Voyante, Petite Fille ─────────
do $$
declare r uuid; v jsonb;
begin
  -- 0 thief (extras: a werewolf and a seer), 1 wolf, 2 seer…
  r := pg_temp.game(array['thief', 'werewolf', 'seer', 'villager', 'villager', 'villager', 'villager', 'villager'], array['werewolf', 'hunter']);
  v := private.ww_view_for(r, 0);
  perform pg_temp.check((v -> 'options' -> 0 -> 'cards') = '["werewolf", "hunter"]'::jsonb, 'the thief sees the two extra cards');
  perform pg_temp.act(r, 0, 'steal', 0);
  perform pg_temp.act(r, 2, 'seer', 0);
  perform pg_temp.next(r);
  perform pg_temp.check((select card = 'werewolf' and camp = 'wolves' and wolf_since = 2 from private.ww_players where room_id = r and seat = 0),
    'the thief takes the werewolf: wolves camp, in the pack from the next night (V3 §4)');
  perform pg_temp.check((select known -> 0 ->> 'card' from private.ww_players where room_id = r and seat = 2) = 'werewolf', 'the seer sees the card after the swap (V3 phase 5)');
  perform pg_temp.check(not (0 = any (private.ww_pack(r, 1))) and 0 = any (private.ww_pack(r, 2)), 'not in the pack on night 1, in it on night 2');

  r := pg_temp.game(array['thief', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], array['werewolf', 'werewolf']);
  perform pg_temp.act(r, 0, 'steal', -1);
  perform pg_temp.next(r);
  perform pg_temp.check((select card = 'thief' and camp = 'village' from private.ww_players where room_id = r and seat = 0), 'the thief may keep his card, even facing two wolves (owner)');

  r := pg_temp.game(array['little_girl', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 0, 'hint');
  perform pg_temp.next(r);
  v := (select known -> 0 from private.ww_players where room_id = r and seat = 0);
  perform pg_temp.check(jsonb_array_length(v -> 'seats') = 3 and not (v -> 'seats') @> '[0]'
    and exists (select 1 from jsonb_array_elements_text(v -> 'seats') x where x::int in (1, 7)), 'the little girl gets 3 players, at least one a wolf, never herself (owner)');
  perform pg_temp.check(not (private.ww_view_for(r, 0) -> 'options') @> '[{"kind": "hint"}]', '… once per game');
end $$;

-- ───────── Votes (V3 §10) ─────────
do $$
declare r uuid;
begin
  r := pg_temp.game(array['villager', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.next(r); -- quiet night
  perform pg_temp.next(r); -- day → vote
  perform pg_temp.act(r, 0, 'vote', 1); perform pg_temp.act(r, 2, 'vote', 1);
  perform pg_temp.act(r, 3, 'vote', 2); perform pg_temp.act(r, 4, 'vote', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.phase(r) = 'revote' and (select revote = '{1,2}' from private.ww_games where room_id = r), 'a tie: a second round between the tied');
  perform pg_temp.check(pg_temp.err(format('select private.ww_submit(%L, 0, %L, 3, null)', r, 'vote')) = 'not a valid target', '… only the tied can be voted for');
  perform pg_temp.act(r, 0, 'vote', 1); perform pg_temp.act(r, 3, 'vote', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 1) and pg_temp.alive(r, 2) and pg_temp.phase(r) = 'night'
    and exists (select 1 from private.ww_log where room_id = r and kind = 'no_elimination'), 'a second tie: nobody is eliminated');
  perform pg_temp.next(r); perform pg_temp.next(r);
  perform pg_temp.act(r, 0, 'vote', 7); perform pg_temp.act(r, 2, 'vote', 7); perform pg_temp.act(r, 3, 'vote', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 7) and (select death from private.ww_players where room_id = r and seat = 7) = 'vote', 'the most voted is eliminated');
  perform pg_temp.check(pg_temp.err(format('select private.ww_submit(%L, 7, %L, 1, null)', r, 'pass')) = 'nothing to do now', 'the dead do nothing');
end $$;

-- ───────── Victories ─────────
do $$
declare r uuid;
begin
  r := pg_temp.game(array['villager', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  update private.ww_players set alive = false where room_id = r and seat in (0, 2, 3, 4);
  perform pg_temp.check(private.ww_check_victory(r), 'wolves as many as the others: the game ends');
  perform pg_temp.check((select result ->> 'winner' from private.ww_games where room_id = r) = 'wolves'
    and (select result -> 'seats' from private.ww_games where room_id = r) = '[1, 7]'::jsonb, 'wolves as many as the others: the wolves win (the whole pack)');
  perform pg_temp.check((select status from public.game_rooms where id = r) = 'finished'
    and exists (select 1 from private.ww_log where room_id = r and kind = 'game_over' and jsonb_array_length(data -> 'cards') = 8), 'the end reveals every card');
  r := pg_temp.game(array['villager', 'werewolf', 'villager', 'villager', 'villager', 'villager']);
  update private.ww_players set alive = false where room_id = r;
  perform pg_temp.check(private.ww_check_victory(r), 'everyone dead: the game ends');
  perform pg_temp.check((select result ->> 'winner' from private.ww_games where room_id = r) = 'draw', '… in a draw');
end $$;

-- ───────── Secrets (V3 §16) ─────────
do $$
declare r uuid; v jsonb;
begin
  r := pg_temp.game(array['seer', 'werewolf', 'villager', 'villager', 'villager', 'villager', 'villager', 'werewolf']);
  perform pg_temp.act(r, 1, 'wolf', 2);
  perform pg_temp.act(r, 0, 'seer', 7);
  v := private.ww_view_for(r, 3);
  perform pg_temp.check(v -> 'me' ->> 'card' = 'villager' and v -> 'me' -> 'pack' = 'null'::jsonb and v -> 'pack_votes' = 'null'::jsonb, 'a villager sees her card, not the pack');
  perform pg_temp.check(position('werewolf' in (v - 'composition')::text) = 0, '… and no werewolf anywhere in her view (only in the public deck)');
  v := private.ww_view_for(r, 1);
  perform pg_temp.check(v -> 'me' -> 'pack' = '[1, 7]'::jsonb and v -> 'pack_votes' ->> '1' = '2', 'a wolf sees the pack and its votes');
  perform pg_temp.next(r);
  v := private.ww_view_for(r, 3);
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(v -> 'log') e where e ->> 'kind' in ('seer_saw', 'pack_target')), 'the seer''s result and the pack''s target stay out of others'' logs');
  v := private.ww_view_for(r, 0);
  perform pg_temp.check(exists (select 1 from jsonb_array_elements(v -> 'log') e where e ->> 'kind' = 'seer_saw' and e -> 'data' ->> 'card' = 'werewolf'), 'the seer reads her own result');
end $$;

-- ───────── Members: tables, training, chat ─────────
select pg_temp.as_admin();
insert into auth.users (id) select ('7e570000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 9) i;
insert into public.profiles (id, first_name, birthdate, gender, city_id)
  select ('7e570000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid, 'W' || i, '1994-04-04', case when i % 2 = 0 then 'woman' else 'man' end, 'dubai'
  from generate_series(1, 9) i;

select pg_temp.as_user('7e570000-0000-0000-0000-000000000001');
do $$
declare t uuid; v jsonb; o jsonb; before jsonb;
begin
  perform pg_temp.check(pg_temp.err($q$select public.ww_create('mixte', 'public', 5)$q$) = 'Loup-Garou: 6 to 20 players', 'Loup-Garou tables: 6 to 20 players');
  before := public.games_overview('mixte');
  -- Training: starts at once, the chosen role, AI players fill the table, never ranked.
  t := public.ww_training('mixte', 8, 'seer', 'expert');
  perform set_config('ww.training', t::text, false);
  v := public.ww_view(t);
  perform pg_temp.check(v -> 'me' ->> 'card' = 'seer' and v ->> 'phase' in ('night', 'witch', 'day') and (v ->> 'ranked')::boolean = false,
    'training: the member is the seer she chose, the game runs, unranked');
  perform pg_temp.check(jsonb_array_length(v -> 'players') = 8 and (select count(*) from jsonb_array_elements(v -> 'players') p where (p ->> 'bot')::boolean) = 7, '… with 7 AI players');
  o := public.games_overview('mixte');
  perform pg_temp.check(o -> 'games' -> 1 = before -> 'games' -> 1, 'training is never counted as a game running (counts unchanged)');
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(public.game_rooms_open('werewolf', 'mixte')) x where x ->> 'id' = t::text), '… nor listed');
  perform pg_temp.check(pg_temp.err(format('update private.ww_games set ranked = true where room_id = %L', t)) is not null, 'a phone cannot touch the game');
end $$;
-- The member plays her training to the end through the public functions (as the app does).
do $$
declare t uuid := current_setting('ww.training')::uuid; v jsonb; o jsonb; i integer := 0;
begin
  loop
    v := public.ww_view(t);
    exit when v ->> 'phase' = 'ended' or i > 400;
    i := i + 1;
    o := v -> 'options' -> 0;
    if o is not null and jsonb_array_length(v -> 'mine') = 0 then
      if o ->> 'kind' in ('ready', 'hint') then perform public.ww_act(t, o ->> 'kind');
      elsif o ->> 'kind' = 'steal' then perform public.ww_act(t, 'steal', -1);
      elsif o ->> 'kind' = 'link' then perform public.ww_act(t, 'link', (o -> 'targets' ->> 0)::int, (o -> 'targets' ->> 1)::int);
      elsif o ->> 'kind' in ('vote', 'wolf', 'seer') then perform public.ww_act(t, o ->> 'kind', (o -> 'targets' ->> 0)::int);
      else perform public.ww_act(t, 'pass');
      end if;
    else
      -- Nothing for her now: the phase's time runs out (as the clock would).
      perform pg_temp.as_admin();
      update private.ww_games set deadline = now() - interval '1 second' where room_id = t;
      perform pg_temp.as_user('7e570000-0000-0000-0000-000000000001');
    end if;
  end loop;
  perform pg_temp.check(v ->> 'phase' = 'ended' and (v -> 'result' ->> 'ranked')::boolean = false, format('training: her whole game, through the app''s functions, ends unranked (%s moves)', i));
  perform pg_temp.check((public.ww_stats() ->> 'training_played')::int = 1 and (public.ww_stats() ->> 'played')::int = 0, 'training is counted apart from real games');
end $$;

select pg_temp.as_admin();
select pg_temp.check(pg_temp.err(format('update private.ww_games set ranked = true where room_id = %L', current_setting('ww.training'))) like '%ww_%unranked%',
  'even the database refuses a ranked training game (V3 §16)');

-- An online table: six members, the host starts, chat by phase.
select pg_temp.as_user('7e570000-0000-0000-0000-000000000001');
do $$
declare t jsonb := public.ww_create('mixte', 'private', 6, 'online', null, 'Test night', 'fr');
begin
  perform set_config('ww.room', t ->> 'id', false);
  perform set_config('ww.code', t ->> 'code', false);
end $$;
select pg_temp.as_admin();
do $$
declare i integer;
begin
  for i in 2..6 loop
    perform pg_temp.as_user(('7e570000-0000-0000-0000-00000000000' || i)::uuid);
    perform public.game_join_code(current_setting('ww.code'));
  end loop;
end $$;
select pg_temp.as_user('7e570000-0000-0000-0000-000000000002');
select pg_temp.check(pg_temp.err(format('select public.game_start(%L)', current_setting('ww.room'))) = 'only the host can do this', 'only the host starts');
select pg_temp.as_user('7e570000-0000-0000-0000-000000000001');
select public.game_start(current_setting('ww.room')::uuid);
select pg_temp.as_admin();
do $$
declare r uuid := current_setting('ww.room')::uuid; v jsonb; villager uuid; wolf uuid; i integer;
begin
  perform pg_temp.check((select count(*) = 6 and bool_and(not bot) from private.ww_players where room_id = r) and pg_temp.phase(r) = 'night', 'six members dealt, night 1');
  select user_id into wolf from private.ww_players where room_id = r and camp = 'wolves' limit 1;
  select user_id into villager from private.ww_players where room_id = r and camp = 'village' limit 1;
  perform pg_temp.as_user(villager);
  v := public.ww_view(r);
  perform pg_temp.check((select count(*) from jsonb_array_elements(v -> 'players') p where p ? 'card') = 0, 'the table lists players, never their cards');
  perform pg_temp.check(pg_temp.err(format('select public.ww_say(%L, %L, %L)', r, 'hello', 'all')) = 'the village sleeps: no talking at night', 'no village talk at night');
  perform pg_temp.check(pg_temp.err(format('select public.ww_say(%L, %L, %L)', r, 'hello', 'wolves')) = 'you cannot talk here now', 'a villager cannot write in the wolves'' chat');
  perform pg_temp.as_user(wolf);
  perform public.ww_say(r, 'on prend qui ?', 'wolves');
  perform pg_temp.check(pg_temp.err(format('select public.game_say(%L, %L)', r, 'psst')) = 'the village sleeps: no talking at night', 'the Ludo chat path follows the same rules');
  perform pg_temp.as_user(villager);
  perform pg_temp.check(not exists (select 1 from public.game_messages where room_id = r and channel = 'wolves'), 'a villager reads none of the wolves'' chat');
  perform pg_temp.as_user(wolf);
  perform pg_temp.check(exists (select 1 from public.game_messages where room_id = r and channel = 'wolves'), 'a wolf reads it');
  perform pg_temp.check(pg_temp.err(format('select public.ww_act(%L, %L, %s)', r, 'vote', 0)) = 'you cannot do that now', 'no vote at night');
end $$;

-- A member who leaves a running game is out of it (no card shown).
select pg_temp.as_admin();
do $$
declare r uuid := current_setting('ww.room')::uuid; u uuid;
begin
  select user_id into u from private.ww_players where room_id = r and camp = 'village' and card <> 'werewolf' order by seat desc limit 1;
  perform pg_temp.as_user(u);
  perform public.game_leave(r);
  perform pg_temp.as_admin();
  perform pg_temp.check((select not alive and death = 'left' from private.ww_players where room_id = r and user_id = u)
    and exists (select 1 from private.ww_log where room_id = r and kind = 'left_game' and not data ? 'card'), 'leaving: out of the game, the card stays secret');
end $$;

-- ───────── AI players play whole games: simulations 6 to 20 (V3 §17) ─────────
select pg_temp.as_admin();
create or replace function pg_temp.sim(p_size integer, p_diff text) returns text language plpgsql as $$
declare rid uuid := gen_random_uuid(); steps integer := 0;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', p_size, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty) values (rid, 'training', p_size, private.ww_default_composition(p_size), p_diff);
  perform private.ww_deal(rid, '{}', p_size, null);
  perform private.ww_enter(rid, 'night');
  while pg_temp.phase(rid) <> 'ended' and steps < 300 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  return coalesce((select result ->> 'winner' from private.ww_games where room_id = rid), 'stuck') || ':' ||
    (select greatest(night, day) from private.ww_games where room_id = rid);
end $$;

do $$
declare
  n integer; d text; res text; games integer := 0; stuck integer := 0;
  wins jsonb := '{}'::jsonb; w text; longest integer := 0;
begin
  for n in 6..20 loop
    foreach d in array array['beginner', 'intermediate', 'expert'] loop
      for k in 1..3 loop
        res := pg_temp.sim(n, d);
        games := games + 1;
        w := split_part(res, ':', 1);
        if w = 'stuck' then stuck := stuck + 1; end if;
        longest := greatest(longest, split_part(res, ':', 2)::int);
        wins := jsonb_set(wins, array[w], to_jsonb(coalesce((wins ->> w)::int, 0) + 1));
      end loop;
    end loop;
  end loop;
  raise notice '    simulations: % games (6 to 20 players × 3 difficulties × 3), results %, longest % rounds', games, wins, longest;
  perform pg_temp.check(stuck = 0, format('every simulated game ends (%s games, none stuck)', games));
  perform pg_temp.check(coalesce((wins ->> 'village')::int, 0) > 0 and coalesce((wins ->> 'wolves')::int, 0) > 0, 'both the village and the wolves win some games');
  perform pg_temp.check(not exists (select 1 from private.ww_games g where g.kind = 'training' and g.ranked), 'no training game is ranked');
end $$;

-- The AI players never read a card they should not: their view is the members' view.
do $$
declare rid uuid := gen_random_uuid(); v jsonb; b record;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', 10, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty) values (rid, 'training', 10, private.ww_default_composition(10), 'expert');
  perform private.ww_deal(rid, '{}', 10, null);
  for b in select * from private.ww_players where room_id = rid and camp = 'village' and card <> 'seer' loop
    v := private.ww_view_for(rid, b.seat);
    if (select count(*) from jsonb_array_elements(v -> 'players') p where p ? 'card') > 0 or v -> 'me' -> 'pack' <> 'null'::jsonb then
      raise exception 'FAIL werewolf: an AI villager''s view shows cards';
    end if;
  end loop;
  perform pg_temp.check(true, 'an AI villager decides from a view without anyone''s card (the same view as a member)');
end $$;

-- Members cannot call the engine.
select pg_temp.check(not has_function_privilege('authenticated', 'private.ww_advance(uuid, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'private.ww_view_for(uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.ww_submit(uuid, integer, text, integer, integer)', 'execute'), 'members cannot call the engine or read another seat''s view');
