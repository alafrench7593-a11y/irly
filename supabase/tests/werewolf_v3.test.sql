-- IRLY Loup-Garou V3 (20261116* migrations): one forced scenario per power of the Chaos, Nightmare, Manipulation
-- and Hybrid cards, the lists of V3 §17 (Scameur, Chasseur, Sorcière, Amoureux, Solo), then whole games played by
-- AI players in the seven V3 modes. Rules: docs/LOUP-GAROU-V3.md.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL v3: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
/** A crafted game: the given cards in seat order, at night 1, in a V3 mode. */
create or replace function pg_temp.vgame(p_cards text[], p_mode text default 'apocalypse') returns uuid language plpgsql as $$
declare rid uuid := gen_random_uuid();
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', greatest(array_length(p_cards, 1), 6), 'online', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, mode) values (rid, 'online', greatest(array_length(p_cards, 1), 6),
    (select jsonb_object_agg(c, n) from (select c, count(*) n from unnest(p_cards) c group by c) x), p_mode);
  for i in 1..array_length(p_cards, 1) loop
    insert into private.ww_players (room_id, seat, bot, name, card, charges, camp, wolf_since)
      values (rid, i - 1, false, 'P' || (i - 1), p_cards[i], private.ww_fresh_charges(p_cards[i]), private.ww_camp(p_cards[i]),
        case when private.ww_camp(p_cards[i]) = 'wolves' then 0 end);
  end loop;
  update private.ww_games set phase = 'night', night = 1, deadline = now() + interval '1 hour' where room_id = rid;
  perform private.ww_upkeep(rid);
  return rid;
end $$;
create or replace function pg_temp.act(r uuid, s integer, k text, t integer default null, t2 integer default null) returns void language sql as $$
  select private.ww_submit(r, s, k, t, t2)
$$;
create or replace function pg_temp.alive(r uuid, s integer) returns boolean language sql as $$ select alive from private.ww_players where room_id = r and seat = s $$;
create or replace function pg_temp.card(r uuid, s integer) returns text language sql as $$ select card from private.ww_players where room_id = r and seat = s $$;
create or replace function pg_temp.camp(r uuid, s integer) returns text language sql as $$ select camp from private.ww_players where room_id = r and seat = s $$;
create or replace function pg_temp.ch(r uuid, s integer) returns jsonb language sql as $$ select charges from private.ww_players where room_id = r and seat = s $$;
create or replace function pg_temp.won(r uuid, s integer) returns boolean language sql as $$
  select coalesce((memory ->> 'solo_won')::boolean, false) from private.ww_players where room_id = r and seat = s
$$;
create or replace function pg_temp.phase(r uuid) returns text language sql as $$ select phase from private.ww_games where room_id = r $$;
create or replace function pg_temp.next(r uuid) returns void language sql as $$ select private.ww_advance(r, true) $$;
/** Plays on until the given phase (nobody acting on the way). */
create or replace function pg_temp.upto(r uuid, p text) returns void language plpgsql as $$
begin
  for i in 1..8 loop
    exit when pg_temp.phase(r) in (p, 'ended');
    perform pg_temp.next(r);
  end loop;
  if pg_temp.phase(r) <> p then raise exception 'FAIL v3: could not reach % (at %)', p, pg_temp.phase(r); end if;
end $$;
/** The last private line of a kind for a seat; the last public line of a kind. */
create or replace function pg_temp.said(r uuid, s integer, k text) returns jsonb language sql as $$
  select data from private.ww_log where room_id = r and audience = 'seat:' || s and kind = k order by id desc limit 1
$$;
create or replace function pg_temp.pub(r uuid, k text) returns jsonb language sql as $$
  select data from private.ww_log where room_id = r and audience = 'all' and kind = k order by id desc limit 1
$$;
create or replace function pg_temp.opts(r uuid, s integer) returns text[] language sql as $$
  select coalesce(array_agg(o ->> 'kind'), '{}') from jsonb_array_elements(private.ww_options(r, s)) o
$$;
/** To the vote of the day, everyone votes as given (seat → target), the vote is counted. */
create or replace function pg_temp.vote(r uuid, ballots jsonb) returns void language plpgsql as $$
declare b record;
begin
  perform pg_temp.upto(r, 'vote');
  for b in select key::integer s, value::text::integer t from jsonb_each(ballots) loop perform pg_temp.act(r, b.s, 'vote', b.t); end loop;
  perform pg_temp.next(r);
end $$;

-- ═════════ Decks and modes ═════════
do $$
declare m text; n integer; c jsonb; total integer; wolves integer; solos integer; fam text; r text;
begin
  foreach m in array array['chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse'] loop
    for n in 6..20 loop
      for k in 1..6 loop
        c := private.ww_v3_composition(m, n);
        select sum(value::text::int), sum(value::text::int) filter (where private.ww_camp(key) = 'wolves'), coalesce(sum(value::text::int) filter (where private.ww_camp(key) = 'solo'), 0)
          into total, wolves, solos from jsonb_each(c);
        perform pg_temp.check(total = n and wolves = private.ww_wolves_for(n) and wolves * 2 < n and c ? 'villager' and c ? 'seer' and not c ? 'thief'
          and solos <= case when n < 8 then 0 when n < 12 then 1 else 2 end
          and not exists (select 1 from jsonb_object_keys(c) x where not (x = any (private.ww_mode_roles(m))))
          and private.ww_v3_check(m, n, c) = c, format('%s deck for %s: wolves and Village present, cards of the mode, solo cap', m, n));
        if n >= 9 then
          foreach fam in array private.ww_mode_families(m) loop
            if fam <> 'hybrid' or n >= 12 then
              perform pg_temp.check(exists (select 1 from jsonb_object_keys(c) x where x = any (private.ww_family_cards(fam))), format('%s deck for %s holds a %s card', m, n, fam));
            end if;
          end loop;
        end if;
      end loop;
    end loop;
  end loop;
  -- Every card of every family is dealt in some deck of Apocalypse (none is left out of the game).
  foreach fam in array array['chaos', 'nightmare', 'manipulation', 'hybrid'] loop
    foreach r in array private.ww_family_cards(fam) loop
      perform pg_temp.check(exists (select 1 from generate_series(1, 400) g where private.ww_v3_composition('apocalypse', 20) ? r), format('the %s is dealt in Apocalypse', r));
    end loop;
  end loop;
  perform pg_temp.check(pg_temp.err($q$select private.ww_v3_check('chaos', 8, '{"werewolf": 2, "vampire": 1, "villager": 5}')$q$) = 'composition: unknown card', 'a Chaos deck refuses a Nightmare card');
  perform pg_temp.check(private.ww_default_for('classic', 8) = private.ww_default_composition(8), 'the Classic deck is unchanged');
end $$;

-- ═════════ CHAOS ═════════
-- Scameur (V3 §4, §17).
do $$
declare r uuid;
begin
  -- With a villager.
  r := pg_temp.vgame(array['werewolf', 'scammer', 'villager', 'villager', 'villager', 'seer', 'villager']);
  perform pg_temp.act(r, 1, 'scam', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.card(r, 1) = 'villager' and pg_temp.card(r, 2) = 'scammer' and (pg_temp.ch(r, 2) ->> 'scam')::int = 0, 'Scameur ↔ Villageois: the cards change hands, the swap is spent on the card');
  perform pg_temp.check(pg_temp.said(r, 2, 'scam_victim') ->> 'card' = 'scammer' and pg_temp.said(r, 1, 'scam_done') ->> 'card' = 'villager', '… both are told their new card, privately');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not ('scam' = any (pg_temp.opts(r, 2))) and not ('scam' = any (pg_temp.opts(r, 1))), '… one use in the game: nobody can swap again');

  -- With a wolf: camps at once, the old wolf out of the pack at once, the new one in from the next night.
  r := pg_temp.vgame(array['werewolf', 'werewolf', 'scammer', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 3);
  perform pg_temp.act(r, 1, 'wolf', 4);
  perform pg_temp.act(r, 2, 'scam', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 2) = 'wolves' and pg_temp.camp(r, 0) = 'village' and pg_temp.card(r, 0) = 'scammer', 'Scameur ↔ Loup: the camps change at once');
  perform pg_temp.check(not pg_temp.alive(r, 4) and pg_temp.alive(r, 3), '… the old wolf''s vote for the pack no longer counts that night');
  perform pg_temp.check(private.ww_view_for(r, 0) -> 'me' -> 'pack' = 'null'::jsonb and private.ww_view_for(r, 2) -> 'me' -> 'pack' = 'null'::jsonb, '… the old wolf is out of the pack at once; the new one not in yet');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(private.ww_pack(r, 2) = array[1, 2] and 'wolf' = any (pg_temp.opts(r, 2)) and not ('wolf' = any (pg_temp.opts(r, 0))), '… the new wolf joins the pack and its vote at the next night');

  -- With a Solo: the unfinished objective follows the card.
  r := pg_temp.vgame(array['werewolf', 'scammer', 'clown', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'scam', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 1) = 'solo' and pg_temp.card(r, 1) = 'clown' and pg_temp.camp(r, 2) = 'village', 'Scameur ↔ Solo: he is the Clown now');
  perform pg_temp.vote(r, '{"0": 1, "2": 1, "3": 1}');
  perform pg_temp.check(pg_temp.won(r, 1) and not pg_temp.won(r, 2), '… and wins as the Clown when voted out; the old Clown does not');

  -- With a hybrid: the objective follows the card, its personal progress starts again; charges never come back.
  r := pg_temp.vgame(array['werewolf', 'scammer', 'detective', 'witch', 'villager', 'villager', 'villager']);
  update private.ww_players set charges = '{"progress": 1, "found": [0]}' where room_id = r and seat = 2;
  perform pg_temp.act(r, 1, 'scam', 2);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.card(r, 1) = 'detective' and pg_temp.ch(r, 1) = '{"progress": 0, "found": []}'::jsonb, 'Scameur ↔ hybride: the objective follows the card, its progress starts again');
  r := pg_temp.vgame(array['werewolf', 'scammer', 'witch', 'villager', 'villager', 'villager', 'villager']);
  update private.ww_players set charges = '{"life": 0, "death": 1}' where room_id = r and seat = 2;
  perform pg_temp.act(r, 1, 'scam', 2);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.check(pg_temp.card(r, 1) = 'witch' and pg_temp.ch(r, 1) = '{"life": 0, "death": 1}'::jsonb, 'Scameur ↔ carte déjà utilisée: a spent charge stays spent');
  perform pg_temp.check(pg_temp.opts(r, 1) = array['poison'] and pg_temp.opts(r, 2) = '{}', '… and the new holder plays the card from the next window (here the potions, tonight)');

  -- Two swaps on the same card the same night: the first validated wins, the other keeps its charge.
  r := pg_temp.vgame(array['werewolf', 'scammer', 'scammer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'scam', 3);
  perform pg_temp.act(r, 2, 'scam', 3);
  update private.ww_actions set at = now() - interval '5 seconds' where room_id = r and seat = 1;
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.card(r, 3) = 'scammer' and pg_temp.card(r, 1) = 'villager' and pg_temp.card(r, 2) = 'scammer' and (pg_temp.ch(r, 2) ->> 'scam')::int = 1
    and pg_temp.said(r, 2, 'scam_cancelled') is not null, 'Échanges simultanés: one permanent swap per card and night; the cancelled one keeps its charge');

  -- The lovers' link stays with the players (V3 §6).
  r := pg_temp.vgame(array['werewolf', 'scammer', 'cupid', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'link', 1, 3);
  perform pg_temp.act(r, 1, 'scam', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((select lover from private.ww_players where room_id = r and seat = 1) = 3 and (select lover from private.ww_players where room_id = r and seat = 0) is null
    and pg_temp.camp(r, 1) = 'wolves', 'Scameur amoureux: the link stays with the player, not the card');
end $$;

-- Échangeur, Caméléon, Joueur de hasard.
do $$
declare r uuid; o text;
begin
  r := pg_temp.vgame(array['werewolf', 'swapper', 'seer', 'salvateur', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'exchange', 2, 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.ch(r, 1) ->> 'exchange')::int = 0 and pg_temp.said(r, 2, 'power_lent') ->> 'card' = 'salvateur' and pg_temp.said(r, 3, 'power_lent') ->> 'card' = 'seer', 'Échangeur: two active powers change hands for the next night; both players are told');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.opts(r, 2) = array['protect'] and pg_temp.opts(r, 3) = array['seer'] and pg_temp.card(r, 2) = 'seer' and pg_temp.camp(r, 2) = 'village', '… that night each plays the other''s power; cards and camps are unchanged');
  perform pg_temp.act(r, 0, 'wolf', 4);
  perform pg_temp.act(r, 2, 'protect', 4);
  perform pg_temp.act(r, 3, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 4) and pg_temp.said(r, 3, 'seer_saw') ->> 'card' = 'werewolf', '… and the powers really work in their new hands');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.opts(r, 2) = array['seer'] and pg_temp.opts(r, 3) = array['protect'], '… for one night only');
  r := pg_temp.vgame(array['werewolf', 'swapper', 'seer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'exchange', 2, 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.ch(r, 1) ->> 'exchange')::int = 1 and pg_temp.said(r, 1, 'exchange_failed') is not null, 'Échangeur: with a card that has no active power, nothing happens and the charge is kept');

  r := pg_temp.vgame(array['werewolf', 'chameleon', 'seer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'copy', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.opts(r, 1) = array['seer'] and pg_temp.opts(r, 2) = array['seer'] and pg_temp.card(r, 1) = 'chameleon', 'Caméléon: the copied power is his for the next night; the owner keeps hers');
  perform pg_temp.act(r, 1, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 1, 'seer_saw') ->> 'card' = 'werewolf' and (pg_temp.ch(r, 1) ->> 'copy')::int = 0, '… the copy works, once');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.opts(r, 1) = '{}', '… and is gone the night after');

  r := pg_temp.vgame(array['werewolf', 'gambler', 'seer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'gamble', 0);
  perform pg_temp.upto(r, 'day');
  o := pg_temp.said(r, 1, 'gamble_result') ->> 'outcome';
  perform pg_temp.check(o in ('protect', 'block', 'look') and (pg_temp.ch(r, 1) ->> 'gamble')::int = 0
    and (o <> 'look' or pg_temp.said(r, 1, 'gamble_result') ->> 'card' = 'werewolf')
    and (o <> 'block' or pg_temp.said(r, 0, 'power_blocked') is not null), format('Joueur de hasard: the server draws a protection, a block or an investigation (here: %s), once', o));
end $$;

-- Miroir, Saboteur, Clown, Métamorphe, Ninja, Anomalie.
do $$
declare r uuid; ev text;
begin
  r := pg_temp.vgame(array['werewolf', 'mirror', 'witch', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.act(r, 2, 'poison', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 1) and not pg_temp.alive(r, 2) and (pg_temp.ch(r, 1) ->> 'mirror')::int = 0, 'Miroir: the potion comes back on the Sorcière, once');
  r := pg_temp.vgame(array['werewolf', 'mirror', 'hunter', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'shoot', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 1) and not pg_temp.alive(r, 2) and (pg_temp.ch(r, 1) ->> 'mirror')::int = 1, 'Chasseur contre Miroir: never reflected, the Miroir keeps its charge (the Chasseur missed: he dies of his own shot)');
  r := pg_temp.vgame(array['werewolf', 'mirror', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 1), 'Miroir: the pack''s collective attack is not reflected');

  r := pg_temp.vgame(array['werewolf', 'saboteur', 'seer', 'hunter', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'sabotage', 2);
  perform pg_temp.act(r, 2, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') is null and pg_temp.said(r, 2, 'power_blocked') is not null and (pg_temp.ch(r, 1) ->> 'sabotage')::int = 1, 'Saboteur: the Voyante''s power is not played; she is told; one of his two uses is spent');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'sabotage', 3);
  perform pg_temp.act(r, 3, 'shoot', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 0) and (pg_temp.ch(r, 3) ->> 'shot')::int = 1 and (pg_temp.ch(r, 1) ->> 'sabotage')::int = 0, 'Saboteur: a blocked Chasseur keeps his shot; second and last use');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not ('sabotage' = any (pg_temp.opts(r, 1))), '… then no more');
  r := pg_temp.vgame(array['werewolf', 'saboteur', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.act(r, 1, 'sabotage', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 2), 'Saboteur: a blocked wolf''s vote for the pack does not count');

  r := pg_temp.vgame(array['werewolf', 'clown', 'lawyer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 2, 'plead', 1);
  perform pg_temp.vote(r, '{"0": 1, "3": 1, "4": 1}');
  perform pg_temp.check(pg_temp.alive(r, 1) and not pg_temp.won(r, 1) and pg_temp.pub(r, 'lawyer_saved') ->> 'seat' = '1', 'Clown: an elimination cancelled by the Avocat is no victory');
  perform pg_temp.vote(r, '{"0": 1, "3": 1, "4": 1}');
  perform pg_temp.check(not pg_temp.alive(r, 1) and pg_temp.won(r, 1) and pg_temp.phase(r) = 'night', 'Clown: voted out for real, he wins for good; the game goes on');

  r := pg_temp.vgame(array['werewolf', 'shapeshifter', 'seer', 'detective', 'ninja', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'disguise', 0);
  perform pg_temp.act(r, 2, 'seer', 1);
  perform pg_temp.act(r, 3, 'detect', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') ->> 'card' = 'werewolf' and (pg_temp.said(r, 3, 'detect_result') ->> 'wolf')::boolean and (pg_temp.ch(r, 1) ->> 'disguise')::int = 1, 'Métamorphe: shows another player''s role to the investigations of the night');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 4, 'hide');
  perform pg_temp.act(r, 2, 'seer', 4);
  perform pg_temp.act(r, 3, 'detect', 4);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') -> 'card' = 'null'::jsonb and pg_temp.said(r, 3, 'detect_result') -> 'wolf' = 'null'::jsonb and (pg_temp.ch(r, 4) ->> 'hide')::int = 1, 'Ninja: nothing is seen of him that night');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'seer', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') ->> 'card' = 'shapeshifter', '… and without their powers, both are seen as they are');

  r := pg_temp.vgame(array['werewolf', 'anomaly', 'seer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.vote(r, '{"0": 1, "2": 1, "3": 1}');
  ev := pg_temp.pub(r, 'anomaly_event') ->> 'event';
  perform pg_temp.check(ev in ('fog', 'curfew') and (pg_temp.pub(r, 'anomaly_event') ->> 'night')::int = 2, format('Anomalie: its elimination triggers an event for the next night (here: %s), told to all', ev));
  -- Both events, each on its night.
  update private.ww_games set effects = effects || '{"fog": 2, "curfew": 0}' where room_id = r;
  perform pg_temp.act(r, 2, 'seer', 0);
  perform pg_temp.act(r, 0, 'wolf', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') is null and pg_temp.said(r, 2, 'fog_blind') is not null and not pg_temp.alive(r, 3), 'Brouillard: no investigation gives a result that night; the pack still attacks');
  perform pg_temp.vote(r, '{}');
  update private.ww_games set effects = effects || '{"curfew": 3}' where room_id = r;
  perform pg_temp.act(r, 2, 'seer', 0);
  perform pg_temp.act(r, 0, 'wolf', 4);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 4) and pg_temp.said(r, 2, 'seer_saw') ->> 'card' = 'werewolf', 'Couvre-feu: the pack does not attack that night; the investigations work');
end $$;

-- ═════════ NIGHTMARE ═════════
do $$
declare r uuid; prey integer; other integer;
begin
  -- Revenant.
  r := pg_temp.vgame(array['werewolf', 'revenant', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 1), 'Revenant: killed at night, he is dead by day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.alive(r, 1) and pg_temp.phase(r) = 'night' and pg_temp.pub(r, 'opening') -> 'revived' = '[1]'::jsonb and 'wolf' = any (pg_temp.opts(r, 0)), 'Revenant: back at the opening of the next night, told to all');
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not pg_temp.alive(r, 1), '… once only');
  r := pg_temp.vgame(array['werewolf', 'revenant', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.vote(r, '{"0": 1, "2": 1, "3": 1}');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not pg_temp.alive(r, 1) and (pg_temp.ch(r, 1) ->> 'revive')::int = 1, 'Revenant: voted out, he does not come back (only a death at night)');

  -- Maudit.
  r := pg_temp.vgame(array['werewolf', 'cursed', 'hunter', 'salvateur', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.act(r, 3, 'protect', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 1) = 'village' and (pg_temp.ch(r, 1) ->> 'curse')::int = 1, 'Maudit protégé: the attack would not have killed him, he does not turn');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 1) and pg_temp.camp(r, 1) = 'wolves' and pg_temp.said(r, 1, 'cursed_turned') is not null and pg_temp.card(r, 1) = 'cursed', 'Maudit: the pack''s first mortal attack turns him into a wolf; he lives');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(private.ww_pack(r, 3) = array[0, 1] and 'wolf' = any (pg_temp.opts(r, 1)), '… in the pack from the next night');
  r := pg_temp.vgame(array['werewolf', 'cursed', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.act(r, 2, 'shoot', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 1) and pg_temp.alive(r, 2) and pg_temp.said(r, 2, 'shot_hit') is not null, 'Chasseur contre Maudit: the camp is checked after the night''s conversions: turned tonight, he is hit');

  -- Exorciste.
  r := pg_temp.vgame(array['werewolf', 'cursed', 'exorcist', 'reaper', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'exorcise', 1);
  perform pg_temp.act(r, 3, 'mark', 4);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.ch(r, 1) ->> 'curse')::int = 0 and (pg_temp.said(r, 2, 'exorcise_result') ->> 'removed')::boolean and (pg_temp.ch(r, 2) ->> 'exorcise')::int = 1, 'Exorciste: lifts the Maudit''s curse');
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 4) and pg_temp.pub(r, 'opening') -> 'dead' = '[4]'::jsonb, 'Faucheur: his mark strikes at the opening of the next night');
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 1), '… and the Maudit freed of his curse dies like anyone');
  r := pg_temp.vgame(array['werewolf', 'villager', 'exorcist', 'reaper', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 3, 'mark', 4);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  -- Night 2 has opened: the mark struck already. A mark lifted the same night never strikes.
  r := pg_temp.vgame(array['werewolf', 'villager', 'exorcist', 'reaper', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 3, 'mark', 4);
  perform pg_temp.act(r, 2, 'exorcise', 4);
  update private.ww_actions set at = now() - interval '5 seconds' where room_id = r and seat = 3;
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.alive(r, 4) and (pg_temp.ch(r, 3) ->> 'mark')::int = 0, 'Exorciste: a mark lifted before it strikes never strikes (the Faucheur''s use is spent)');
  r := pg_temp.vgame(array['werewolf', 'mirror', 'villager', 'reaper', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 3, 'mark', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(pg_temp.alive(r, 1) and not pg_temp.alive(r, 3), 'Faucheur contre Miroir: the deferred attack comes back on him');

  -- Possédé.
  r := pg_temp.vgame(array['werewolf', 'possessed', 'villager', 'villager', 'villager', 'villager', 'villager']);
  prey := (pg_temp.ch(r, 1) ->> 'prey')::int;
  perform pg_temp.check(prey is not null and prey <> 1 and (pg_temp.said(r, 1, 'prey') ->> 'seat')::int = prey
    and (private.ww_view_for(r, 1) -> 'me' ->> 'prey')::int = prey and private.ww_view_for(r, 2) -> 'me' -> 'prey' = 'null'::jsonb, 'Possédé: the server designates his target; he alone knows it');
  if prey <> 0 then
    perform pg_temp.act(r, 0, 'wolf', prey);
    perform pg_temp.upto(r, 'day');
    other := (pg_temp.ch(r, 1) ->> 'prey')::int;
    perform pg_temp.check(other <> prey and pg_temp.alive(r, other) and not pg_temp.won(r, 1), 'Possédé: his target dead another way, a new one is designated');
    prey := other;
  end if;
  perform pg_temp.vote(r, (select jsonb_object_agg(seat::text, prey) from private.ww_players where room_id = r and alive and seat <> prey));
  perform pg_temp.check(not pg_temp.alive(r, prey) and pg_temp.won(r, 1), 'Possédé: his target voted out, he wins for good');

  -- Araignée.
  r := pg_temp.vgame(array['werewolf', 'spider', 'seer', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'web', 2);
  perform pg_temp.act(r, 2, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 2, 'seer_saw') is null and (pg_temp.ch(r, 1) ->> 'web')::int = 1, 'Araignée: blocks an active power, two uses');
  r := pg_temp.vgame(array['werewolf', 'spider', 'saboteur', 'seer', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'sabotage', 1);
  perform pg_temp.act(r, 1, 'web', 3);
  perform pg_temp.act(r, 3, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 3, 'seer_saw') ->> 'card' = 'werewolf' and (pg_temp.ch(r, 1) ->> 'web')::int = 2, 'Saboteur avant Araignée: a blocked blocker blocks nobody and keeps its use');

  -- Vampire.
  r := pg_temp.vgame(array['werewolf', 'vampire', 'villager', 'villager', 'salvateur', 'scammer', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'bite', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 1, 'bite_failed') is not null and pg_temp.camp(r, 0) = 'wolves' and pg_temp.ch(r, 1) -> 'servants' = '[]'::jsonb, 'Vampire: a wolf cannot be made a servant');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'bite', 2);
  perform pg_temp.act(r, 4, 'protect', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 2) = 'village' and pg_temp.said(r, 1, 'bite_failed') ->> 'seat' = '2', 'Vampire: a protected player is not converted');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'bite', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 2) = 'solo' and pg_temp.ch(r, 1) -> 'servants' = '[2]'::jsonb and pg_temp.said(r, 2, 'bitten') ->> 'seat' = '1' and not pg_temp.won(r, 1)
    and (private.ww_view_for(r, 2) -> 'me' ->> 'master')::int = 1, 'Vampire: a villager becomes his servant, and knows it');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'bite', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.won(r, 1) and pg_temp.won(r, 2) and pg_temp.won(r, 3) and pg_temp.phase(r) = 'day', 'Vampire: alive with two servants alive, he has won for good, his servants with him; the game goes on');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not ('bite' = any (pg_temp.opts(r, 1))), '… two servants at most');
  -- Victory, then a swap, then death, then the collective defeat (V3 §7, §17).
  perform pg_temp.act(r, 5, 'scam', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.card(r, 5) = 'vampire' and pg_temp.won(r, 1) and not pg_temp.won(r, 5), 'Victoire Solo puis échange: the victory stays with the player, it does not follow the card');
  perform pg_temp.vote(r, '{"0": 1, "2": 1, "3": 1, "4": 1}');
  perform pg_temp.check(not pg_temp.alive(r, 1) and pg_temp.won(r, 1), 'Victoire Solo puis mort: still won');
  update private.ww_players set alive = false where room_id = r and seat in (3, 4, 5, 6, 7, 8);
  perform private.ww_check_victory(r);
  perform pg_temp.check((select result ->> 'winner' = 'wolves' and result -> 'solo' @> '[1, 2, 3]'::jsonb and result -> 'seats' @> '[0, 1, 2, 3]'::jsonb
    and not result -> 'solo' @> '[5]'::jsonb from private.ww_games where room_id = r), 'Victoire Solo puis défaite collective: the wolves win, the Vampire and his servants keep their own victory (several Solo victories)');

  -- Exorciste on a servant.
  r := pg_temp.vgame(array['werewolf', 'vampire', 'villager', 'exorcist', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'bite', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 3, 'exorcise', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 2) = 'village' and pg_temp.ch(r, 1) -> 'servants' = '[]'::jsonb and pg_temp.said(r, 2, 'freed') is not null, 'Exorciste: frees a servant of the Vampire');

  -- Fossoyeur, Somnambule, Oracle noir.
  r := pg_temp.vgame(array['werewolf', 'gravedigger', 'sleepwalker', 'salvateur', 'dark_oracle', 'double_agent', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.check(not ('dig' = any (pg_temp.opts(r, 1))), 'Fossoyeur: nobody to look at while nobody is dead');
  perform pg_temp.act(r, 0, 'wolf', 6);
  perform pg_temp.act(r, 5, 'wolf', 6);
  perform pg_temp.act(r, 2, 'visit', 7);
  perform pg_temp.act(r, 4, 'omen', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not (pg_temp.said(r, 2, 'visit_result') ->> 'attacked')::boolean and pg_temp.said(r, 4, 'omen_result') ->> 'camp' = 'wolves' and (pg_temp.ch(r, 4) ->> 'omen')::int = 1, 'Somnambule: nothing happened where he was; Oracle noir: the camp of a player');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'dig', 6);
  perform pg_temp.act(r, 0, 'wolf', 7);
  perform pg_temp.act(r, 5, 'wolf', 7);
  perform pg_temp.act(r, 3, 'protect', 7);
  perform pg_temp.act(r, 2, 'visit', 7);
  perform pg_temp.act(r, 4, 'omen', 5);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 1, 'dig_result') ->> 'card' = 'villager', 'Fossoyeur: the role of an eliminated player');
  perform pg_temp.check(pg_temp.alive(r, 7) and (pg_temp.said(r, 2, 'visit_result') ->> 'attacked')::boolean, 'Somnambule: an attack aimed at the player he visited, even stopped');
  perform pg_temp.check(pg_temp.said(r, 4, 'omen_result') ->> 'camp' = 'village' and (pg_temp.ch(r, 4) ->> 'omen')::int = 0 and pg_temp.said(r, 4, 'oracle_cursed') is not null, 'Oracle noir: the Agent double shows as Village; after the second vision, the curse');
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.check(not ('vote' = any (pg_temp.opts(r, 4))) and 'vote' = any (pg_temp.opts(r, 1)) and (private.ww_view_for(r, 4) -> 'me' ->> 'silenced')::boolean, 'Oracle noir maudit: no vote at the next scrutin');
  perform pg_temp.next(r);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.check('vote' = any (pg_temp.opts(r, 4)) and not ('omen' = any (pg_temp.opts(r, 4))), '… for one day; her two visions are spent');
end $$;

-- ═════════ MANIPULATION ═════════
do $$
declare r uuid; t integer;
begin
  -- Manipulateur, Corrompu.
  r := pg_temp.vgame(array['werewolf', 'manipulator', 'corrupt', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 3, 'vote', 1);
  perform pg_temp.act(r, 1, 'mute', 3);
  perform pg_temp.check(not ('vote' = any (pg_temp.opts(r, 3))) and pg_temp.said(r, 3, 'silenced') is not null and (pg_temp.ch(r, 1) ->> 'mute')::int = 0
    and pg_temp.err(format('select private.ww_submit(%L, 3, %L, 1, null)', r, 'vote')) = 'you cannot do that now', 'Manipulateur: his target has no ballot in that scrutin (a vote already cast is void), once');
  perform pg_temp.act(r, 2, 'bribe');
  perform pg_temp.act(r, 2, 'vote', 0);
  perform pg_temp.act(r, 0, 'vote', 4);
  perform pg_temp.act(r, 1, 'vote', 5);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 0) and (pg_temp.pub(r, 'votes') -> 'counts' ->> '0')::int = 2 and (pg_temp.ch(r, 2) ->> 'bribe')::int = 0
    and not pg_temp.pub(r, 'votes') -> 'ballots' ? '3', 'Corrompu: his vote counts double, once; the silenced player''s does not count');

  -- Hacker, Espion, Paparazzi.
  r := pg_temp.vgame(array['werewolf', 'hacker', 'spy', 'paparazzi', 'seer', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 4, 'seer', 5);
  perform pg_temp.act(r, 1, 'hack', 4);
  perform pg_temp.act(r, 2, 'spy', 4);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.said(r, 1, 'hack_result') ->> 'acted')::boolean and (pg_temp.said(r, 2, 'spy_result') ->> 'target')::int = 5 and (pg_temp.ch(r, 2) ->> 'spy')::int = 1, 'Hacker: she used a power; Espion: on whom');
  t := (pg_temp.said(r, 3, 'paparazzi_result') ->> 'target')::int;
  perform pg_temp.check(t in (4, 5), format('Paparazzi: a true clue on a night action (a power was used on seat %s)', t));
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'hack', 5);
  perform pg_temp.act(r, 2, 'spy', 5);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not (pg_temp.said(r, 1, 'hack_result') ->> 'acted')::boolean and pg_temp.said(r, 2, 'spy_result') -> 'target' = 'null'::jsonb and (pg_temp.ch(r, 2) ->> 'spy')::int = 0, 'Hacker, Espion: a villager did nothing');

  -- Agent double, Usurpateur.
  r := pg_temp.vgame(array['werewolf', 'double_agent', 'usurper', 'seer', 'detective', 'hunter', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.check(private.ww_pack(r, 1) = array[0, 1, 2] and 'wolf' = any (pg_temp.opts(r, 1)), 'Agent double, Usurpateur: of the wolves'' camp, in the pack from the first night');
  perform pg_temp.act(r, 2, 'forge', 0);
  perform pg_temp.act(r, 3, 'seer', 0);
  perform pg_temp.act(r, 4, 'detect', 1);
  perform pg_temp.act(r, 5, 'shoot', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 3, 'seer_saw') ->> 'card' = 'villager' and (pg_temp.ch(r, 2) ->> 'forge')::int = 0, 'Usurpateur: falsifies the investigation on a player, once');
  perform pg_temp.check(not (pg_temp.said(r, 4, 'detect_result') ->> 'wolf')::boolean and pg_temp.ch(r, 4) -> 'found' = '[]'::jsonb, 'Agent double: shows as Village to an investigation of camps');
  perform pg_temp.check(not pg_temp.alive(r, 1) and pg_temp.alive(r, 5), 'Chasseur contre Agent double: he is really a wolf, the shot hits');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 3, 'seer', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.said(r, 3, 'seer_saw') ->> 'card' = 'werewolf', '… the lie lasts one night');

  -- Avocat.
  r := pg_temp.vgame(array['werewolf', 'lawyer', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 1, 'plead', 2);
  perform pg_temp.vote(r, '{"0": 3, "4": 3, "5": 3}');
  perform pg_temp.check(not pg_temp.alive(r, 3) and (pg_temp.ch(r, 1) ->> 'plead')::int = 1, 'Avocat: another player voted out, his plea is not used up');
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 1, 'plead', 2);
  perform pg_temp.vote(r, '{"0": 2, "4": 2, "5": 2}');
  perform pg_temp.check(pg_temp.alive(r, 2) and (pg_temp.ch(r, 1) ->> 'plead')::int = 0 and pg_temp.phase(r) = 'night', 'Avocat: cancels the elimination of the player he pleads for, once');
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.check(not ('plead' = any (pg_temp.opts(r, 1))), '… then no more');

  -- Dictateur.
  r := pg_temp.vgame(array['werewolf', 'dictator', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 1, 'decree');
  perform pg_temp.act(r, 0, 'vote', 2);
  perform pg_temp.act(r, 2, 'vote', 3);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.phase(r) = 'revote', 'a tie: a second round between the tied');
  perform pg_temp.act(r, 0, 'vote', 2);
  perform pg_temp.act(r, 1, 'vote', 3);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.phase(r) = 'vote' and pg_temp.pub(r, 'decree') is not null and (pg_temp.ch(r, 1) ->> 'decree')::int = 0
    and not exists (select 1 from private.ww_actions where room_id = r and phase in ('vote', 'revote')), 'Dictateur: after a vote without elimination, one more scrutin the same day, once');
  perform pg_temp.act(r, 0, 'vote', 2);
  perform pg_temp.act(r, 1, 'vote', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 2) and pg_temp.phase(r) = 'night', '… which eliminates as any other');
  r := pg_temp.vgame(array['werewolf', 'dictator', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.upto(r, 'vote');
  perform pg_temp.act(r, 1, 'decree');
  perform pg_temp.vote(r, '{"0": 2, "3": 2}');
  perform pg_temp.check(not pg_temp.alive(r, 2) and (pg_temp.ch(r, 1) ->> 'decree')::int = 1, 'Dictateur: a vote that eliminates leaves his decree unused');
end $$;

-- ═════════ HYBRIDS ═════════
do $$
declare r uuid;
begin
  -- Chasseur de primes.
  r := pg_temp.vgame(array['werewolf', 'werewolf', 'bounty_hunter', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'bounty', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 3) and pg_temp.alive(r, 2) and (pg_temp.ch(r, 2) ->> 'bounty')::int = 1 and pg_temp.said(r, 2, 'shot_missed') is not null, 'Chasseur de primes: a shot at a non-wolf is lost; nobody dies');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'bounty', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 0) and (pg_temp.ch(r, 2) ->> 'bounty')::int = 0 and (pg_temp.ch(r, 2) ->> 'progress')::int = 1 and not pg_temp.won(r, 2), 'Chasseur de primes: a wolf shot dies; two shots in all');
  r := pg_temp.vgame(array['werewolf', 'werewolf', 'bounty_hunter', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'bounty', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'bounty', 1);
  perform pg_temp.upto(r, 'ended');
  perform pg_temp.check(pg_temp.won(r, 2) and (select result ->> 'winner' = 'village' and result -> 'double' @> '[2]'::jsonb from private.ww_games where room_id = r), 'Chasseur de primes: two wolves killed by his own shots: his objective, and the Village''s victory (double victory)');

  -- Détective.
  r := pg_temp.vgame(array['werewolf', 'werewolf', 'detective', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'detect', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.said(r, 2, 'detect_result') ->> 'wolf')::boolean and (pg_temp.ch(r, 2) ->> 'progress')::int = 1 and not pg_temp.won(r, 2), 'Détective: one wolf identified');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'detect', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.ch(r, 2) ->> 'progress')::int = 1, '… the same wolf twice counts once');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'detect', 1);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.won(r, 2), 'Détective: two different wolves identified: his objective');
  r := pg_temp.vgame(array['werewolf', 'detective', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'detect', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.won(r, 1), 'Détective, petite partie: with a single wolf dealt, one is enough');

  -- Justicier.
  r := pg_temp.vgame(array['werewolf', 'werewolf', 'vigilante', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.vote(r, '{"2": 0, "3": 0, "4": 0}');
  perform pg_temp.check((pg_temp.ch(r, 2) ->> 'progress')::int = 1 and not pg_temp.won(r, 2), 'Justicier: he voted against a wolf who is voted out');
  perform pg_temp.vote(r, '{"2": 3, "5": 3, "4": 3}');
  perform pg_temp.check((pg_temp.ch(r, 2) ->> 'progress')::int = 1, '… a villager voted out does not count');
  perform pg_temp.vote(r, '{"2": 1, "5": 1, "4": 1}');
  perform pg_temp.check(pg_temp.won(r, 2), 'Justicier: two wolves voted out with his vote: his objective');

  -- Prophète.
  r := pg_temp.vgame(array['werewolf', 'prophet', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'predict_wolf', 2);
  perform pg_temp.act(r, 1, 'predict_village', 2);
  perform pg_temp.check((select count(*) from private.ww_actions where room_id = r and seat = 1) = 1, 'Prophète: one prediction a night');
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check((pg_temp.said(r, 1, 'predict_result') ->> 'right')::boolean and (pg_temp.ch(r, 1) ->> 'progress')::int = 1, 'Prophète: a right prediction');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'predict_village', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not (pg_temp.said(r, 1, 'predict_result') ->> 'right')::boolean and (pg_temp.ch(r, 1) ->> 'progress')::int = 1, '… a wrong one does not count');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'predict_wolf', 0);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'predict_village', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.won(r, 1), 'Prophète: three right predictions: his objective');

  -- Gardien.
  r := pg_temp.vgame(array['werewolf', 'guardian', 'witch', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 3);
  perform pg_temp.act(r, 1, 'guard', 3);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.act(r, 2, 'poison', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 3) and pg_temp.won(r, 1) and (pg_temp.ch(r, 1) ->> 'progress')::int = 2, 'Gardien: his protection stops the pack and the potion (attaques multiples); two mortal attacks stopped: his objective');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check('guard' = any (pg_temp.opts(r, 1)), '… and he protects every night');
end $$;

-- ═════════ V3 §17: Sorcière, Chasseur, Amoureux in the V3 engine ═════════
do $$
declare r uuid;
begin
  r := pg_temp.vgame(array['werewolf', 'witch', 'salvateur', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 3);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.check((private.ww_view_for(r, 1) ->> 'victim')::int = 3 and private.ww_view_for(r, 2) -> 'victim' = 'null'::jsonb, 'Sorcière: she alone learns the pack''s victim');
  perform pg_temp.act(r, 1, 'heal', 3);
  perform pg_temp.act(r, 1, 'poison', 4);
  perform pg_temp.check((select count(*) from private.ww_actions where room_id = r and phase = 'witch') = 1, 'Sorcière: one potion a night');
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(not pg_temp.alive(r, 3) and not pg_temp.alive(r, 4) and pg_temp.ch(r, 1) = '{"life": 1, "death": 0}'::jsonb, 'Sorcière: the potion of death, the pack''s victim not healed');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 0, 'wolf', 5);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.check(pg_temp.opts(r, 1) = array['heal'], 'Sorcière: a potion already used is gone');
  perform pg_temp.act(r, 1, 'heal', 5);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 5) and pg_temp.ch(r, 1) = '{"life": 0, "death": 0}'::jsonb, 'Sorcière: heals the pack''s victim');
  r := pg_temp.vgame(array['werewolf', 'witch', 'salvateur', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 2, 'protect', 3);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.act(r, 1, 'poison', 3);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 3) and (pg_temp.ch(r, 1) ->> 'death')::int = 0, 'Sorcière, cible protégée: the potion is spent, the protected player lives');

  -- Chasseur: hit, miss, protected, potion without effect, shot kept though he dies.
  r := pg_temp.vgame(array['werewolf', 'hunter', 'salvateur', 'witch', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'shoot', 4);
  perform pg_temp.act(r, 2, 'protect', 1);
  perform pg_temp.upto(r, 'witch');
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.alive(r, 1) and pg_temp.alive(r, 4) and (pg_temp.ch(r, 1) ->> 'shot')::int = 0, 'Chasseur contre Salvateur: he missed but was protected: he lives, his shot is spent');
  r := pg_temp.vgame(array['werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.act(r, 1, 'shoot', 0);
  perform pg_temp.upto(r, 'ended');
  perform pg_temp.check(not pg_temp.alive(r, 0) and not pg_temp.alive(r, 1) and (select result ->> 'winner' = 'village' from private.ww_games where room_id = r), 'Chasseur, tir simultané à une attaque: his shot stays valid though he dies that night');

  -- Amoureux: same camp, opposed camps, a transformation, the chain.
  r := pg_temp.vgame(array['werewolf', 'cupid', 'cursed', 'villager', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'link', 2, 3);
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.upto(r, 'day');
  perform pg_temp.check(pg_temp.camp(r, 2) = 'wolves' and not (select lover_opposed from private.ww_players where room_id = r and seat = 2), 'Amoureux et transformation: lovers of the same camp at the link stay so, their objective is not recomputed');
  perform pg_temp.vote(r, '{"0": 3, "4": 3, "5": 3}');
  perform pg_temp.check(not pg_temp.alive(r, 3) and not pg_temp.alive(r, 2) and (select death from private.ww_players where room_id = r and seat = 2) = 'love', 'Amoureux: one dies, the other follows; the chain ends');
  r := pg_temp.vgame(array['werewolf', 'cupid', 'villager', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'link', 0, 2);
  perform pg_temp.upto(r, 'day');
  update private.ww_players set alive = false where room_id = r and seat in (1, 3, 4, 5);
  perform private.ww_check_victory(r);
  perform pg_temp.check((select result ->> 'winner' = 'lovers' and result -> 'seats' = '[0, 2]'::jsonb from private.ww_games where room_id = r), 'Amoureux de camps opposés: the last two alive, they win together');
end $$;

-- ═════════ What a player never sees ═════════
do $$
declare r uuid; v jsonb;
begin
  r := pg_temp.vgame(array['werewolf', 'scammer', 'vampire', 'possessed', 'seer', 'villager', 'villager', 'villager']);
  perform pg_temp.act(r, 1, 'scam', 0);
  perform pg_temp.act(r, 2, 'bite', 5);
  perform pg_temp.upto(r, 'day');
  v := private.ww_view_for(r, 6);
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(v -> 'players') p where p ? 'card' or p ? 'camp')
    and not exists (select 1 from jsonb_array_elements(v -> 'log') e where e ->> 'kind' in ('scam_done', 'scam_victim', 'bite_done', 'bitten', 'prey', 'seer_saw')),
    'a villager sees no card, no camp, and none of the private lines of the others');
  perform pg_temp.check(not has_function_privilege('authenticated', 'private.ww_resolve_night_v3(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.ww_to_night(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'private.ww_spend(uuid, integer, text, integer)', 'execute')
    and not has_function_privilege('authenticated', 'private.ww_v3_composition(text, integer)', 'execute')
    and not has_function_privilege('anon', 'public.ww_training(text, integer, text, text, text)', 'execute'), 'members cannot call the V3 engine');
end $$;

-- ═════════ A member trains with any card of any mode ═════════
do $$
declare me uuid := gen_random_uuid(); rid uuid; m text; r text; v jsonb; n integer := 0;
begin
  insert into auth.users (id) values (me);
  insert into public.profiles (id, first_name, birthdate, gender, city_id, onboarded_at) values (me, 'V3', '1995-01-01', 'woman', 'dubai', now());
  perform set_config('request.jwt.claim.sub', me::text, true);
  foreach m in array array['chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse'] loop
    foreach r in array private.ww_mode_roles(m) loop
      continue when r = 'thief';
      rid := public.ww_training('mixte', 10, r, 'intermediate', m);
      v := public.ww_view(rid);
      if v -> 'me' ->> 'card' <> r or v ->> 'mode' <> m or jsonb_array_length(v -> 'players') <> 10 then
        raise exception 'FAIL v3: training as % in % gave %', r, m, v -> 'me' ->> 'card';
      end if;
      n := n + 1;
    end loop;
  end loop;
  perform pg_temp.check(n > 150, format('training starts with the chosen card, for every card of every V3 mode (%s games started)', n));
  perform pg_temp.check(pg_temp.err($q$select public.ww_training('mixte', 8, 'vampire', 'intermediate', 'chaos')$q$) = 'composition: unknown card', 'a card of another family is refused');
  rid := public.ww_quickplay('mixte', 'apocalypse');
  perform pg_temp.check((public.ww_view(rid)) ->> 'mode' = 'apocalypse' and (public.ww_view(rid)) -> 'composition' = 'null'::jsonb, 'an Apocalypse table opens; its deck is drawn at the start');
end $$;

-- ═════════ Whole games played by AI players: seven modes, 6 to 20 players, three difficulties ═════════
create or replace function pg_temp.sim(p_mode text, p_size integer, p_diff text) returns uuid language plpgsql as $$
declare rid uuid := gen_random_uuid(); steps integer := 0;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', p_size, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty, mode) values (rid, 'training', p_size, private.ww_default_for(p_mode, p_size), p_diff, p_mode);
  perform private.ww_deal(rid, '{}', p_size, null);
  perform private.ww_enter(rid, 'night');
  while (select phase from private.ww_games where room_id = rid) <> 'ended' and steps < 400 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  return rid;
end $$;
create temp table v3_sims (mode text, room uuid);
do $$
declare m text; n integer; d text; rid uuid; wins jsonb; w text; total integer := 0; missing text[];
begin
  foreach m in array array['chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse'] loop
    wins := '{}'::jsonb;
    for n in 6..20 loop
      foreach d in array array['beginner', 'intermediate', 'expert'] loop
        rid := pg_temp.sim(m, n, d);
        insert into v3_sims values (m, rid);
        w := coalesce((select result ->> 'winner' from private.ww_games where room_id = rid), 'stuck');
        wins := jsonb_set(wins, array[w], to_jsonb(coalesce((wins ->> w)::int, 0) + 1));
        total := total + 1;
      end loop;
    end loop;
    raise notice '    % simulations: 45 games, results %, personal victories %', m, wins,
      (select count(*) from private.ww_players p join v3_sims s on s.room = p.room_id where s.mode = m and (p.memory ->> 'solo_won')::boolean);
    perform pg_temp.check(not wins ? 'stuck', format('every simulated %s game ends', m));
  end loop;
  -- Every power must really be played by an AI player, and every effect must really happen. Which cards are dealt and
  -- when an AI player uses a one-shot power are draws: more Apocalypse games (every card can be dealt there) are
  -- played until each has been seen, within a fixed limit. A power never seen by then fails the test.
  for k in 1..80 loop
    exit when not exists (select 1 from unnest(array['scam', 'exchange', 'gamble', 'sabotage', 'copy', 'disguise', 'hide', 'exorcise', 'mark', 'web', 'bite', 'dig', 'visit', 'omen',
        'hack', 'forge', 'spy', 'bounty', 'detect', 'predict_wolf', 'predict_village', 'guard', 'mute', 'bribe', 'plead', 'decree']) x
        where not exists (select 1 from private.ww_actions a join v3_sims s on s.room = a.room_id where a.kind = x))
      and not exists (select 1 from unnest(array['scam_done', 'exchange_done', 'copy_done', 'gamble_result', 'power_blocked', 'mirror_reflected', 'anomaly_event', 'opening',
        'cursed_turned', 'exorcise_result', 'prey', 'marked', 'bite_done', 'dig_result', 'visit_result', 'omen_result', 'hack_result', 'spy_result', 'paparazzi_result',
        'detect_result', 'predict_result', 'muted', 'bribed', 'lawyer_saved', 'decree', 'solo_won']) x
        where not exists (select 1 from private.ww_log l join v3_sims s on s.room = l.room_id where l.kind = x));
    rid := pg_temp.sim('apocalypse', 14 + k % 7, (array['beginner', 'intermediate', 'expert'])[1 + k % 3]);
    insert into v3_sims values ('apocalypse+', rid);
    perform pg_temp.check((select phase = 'ended' from private.ww_games where room_id = rid), 'an extra Apocalypse game ends');
    total := total + 1;
  end loop;
  -- Every power was really played by an AI player in these games.
  select array_agg(k) into missing from unnest(array['scam', 'exchange', 'gamble', 'sabotage', 'copy', 'disguise', 'hide', 'exorcise', 'mark', 'web', 'bite', 'dig', 'visit', 'omen',
    'hack', 'forge', 'spy', 'bounty', 'detect', 'predict_wolf', 'predict_village', 'guard', 'mute', 'bribe', 'plead', 'decree',
    'seer', 'protect', 'shoot', 'hint', 'link', 'heal', 'poison', 'wolf', 'vote']) k
    where not exists (select 1 from private.ww_actions a join v3_sims s on s.room = a.room_id where a.kind = k);
  perform pg_temp.check(missing is null, format('every power is used by AI players across the %s games (never used: %s)', total, coalesce(array_to_string(missing, ', '), 'none')));
  select array_agg(k) into missing from unnest(array['scam_done', 'exchange_done', 'copy_done', 'gamble_result', 'power_blocked', 'mirror_reflected', 'anomaly_event', 'opening',
    'cursed_turned', 'exorcise_result', 'prey', 'marked', 'bite_done', 'dig_result', 'visit_result', 'omen_result', 'hack_result', 'spy_result', 'paparazzi_result',
    'detect_result', 'predict_result', 'muted', 'bribed', 'lawyer_saved', 'decree', 'solo_won']) k
    where not exists (select 1 from private.ww_log l join v3_sims s on s.room = l.room_id where l.kind = k);
  perform pg_temp.check(missing is null, format('every effect really happened in some game (never seen: %s)', coalesce(array_to_string(missing, ', '), 'none')));
end $$;
