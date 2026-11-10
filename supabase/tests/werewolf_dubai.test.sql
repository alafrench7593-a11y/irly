-- IRLY Loup-Garou, mode Dubaï (20261113000000_irly_werewolf_dubai). Rules: docs/LOUP-GAROU-DUBAI.md.
-- Engine checks on crafted games (seats driven by the test), then whole games played by AI players.
\set ON_ERROR_STOP 1

create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL dubai: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
/** A crafted Dubaï game: the given cards in seat order, at night 1. */
create or replace function pg_temp.dgame(p_cards text[]) returns uuid language plpgsql as $$
declare rid uuid := gen_random_uuid();
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', array_length(p_cards, 1), 'online', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, mode) values (rid, 'online', array_length(p_cards, 1), '{}', 'dubai');
  for i in 1..array_length(p_cards, 1) loop
    insert into private.ww_players (room_id, seat, bot, name, card, charges, camp, wolf_since)
      values (rid, i - 1, false, 'P' || (i - 1), p_cards[i], private.ww_fresh_charges(p_cards[i]), private.ww_camp(p_cards[i]),
        case when private.ww_camp(p_cards[i]) = 'wolves' then 0 end);
  end loop;
  update private.ww_games set phase = 'night', night = 1, deadline = now() + interval '1 hour' where room_id = rid;
  return rid;
end $$;
create or replace function pg_temp.act(r uuid, s integer, k text, t integer default null) returns void language sql as $$
  select private.ww_submit(r, s, k, t, null)
$$;
create or replace function pg_temp.alive(r uuid, s integer) returns boolean language sql as $$
  select alive from private.ww_players where room_id = r and seat = s
$$;
create or replace function pg_temp.phase(r uuid) returns text language sql as $$
  select phase from private.ww_games where room_id = r
$$;
create or replace function pg_temp.next(r uuid) returns void language sql as $$
  select private.ww_advance(r, true)
$$;
/** The last private line of a kind for a seat. */
create or replace function pg_temp.said(r uuid, s integer, k text) returns jsonb language sql as $$
  select data from private.ww_log where room_id = r and audience = 'seat:' || s and kind = k order by id desc limit 1
$$;
/** From the day to its vote, then everyone votes as given (seat → target). */
create or replace function pg_temp.vote(r uuid, ballots jsonb) returns void language plpgsql as $$
declare b record;
begin
  if pg_temp.phase(r) = 'day' then perform pg_temp.next(r); end if;
  for b in select key::integer s, value::text::integer t from jsonb_each(ballots) loop perform pg_temp.act(r, b.s, 'vote', b.t); end loop;
  perform pg_temp.next(r);
end $$;

-- ───────── Compositions ─────────
do $$
declare n integer; c jsonb; w integer; k integer; e integer;
  esc constant integer[] := array[1, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5];
  ind constant integer[] := array[0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2];
begin
  for n in 6..20 loop
    c := private.ww_dubai_composition(n);
    select coalesce(sum((value::text)::integer) filter (where private.ww_camp(key) = 'wolves'), 0),
           coalesce(sum((value::text)::integer) filter (where private.ww_camp(key) = 'solo'), 0)
      into w, k from jsonb_each(c);
    if private.ww_card_count(c) <> n or w <> esc[n - 5] or k <> ind[n - 5] or (c ->> 'expat')::integer < 2 then
      raise exception 'FAIL dubai: deck for % is wrong: %', n, c;
    end if;
    perform private.ww_dubai_check(n, c);
  end loop;
  perform pg_temp.check(true, 'decks 6 to 20 follow the owner''s table (Escrocs, Indépendants), keep 2+ plain Expats and pass the caps');
  perform pg_temp.check(pg_temp.err($q$select private.ww_dubai_check(8, '{"escroc": 2, "entrepreneur": 1, "ecommerce": 1, "golden_visa": 1, "expat": 3}')$q$)
    = 'composition: too many protections for this size', 'three protections under 15 players: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_dubai_check(8, '{"escroc": 2, "ceo": 1, "influencer": 1, "expat": 4}')$q$)
    = 'composition: the CEO and the Influenceuse together from 15 players', 'CEO + Influenceuse under 15: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_dubai_check(6, '{"expat": 6}')$q$) = 'composition: at least one escroc', 'no Escroc: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_dubai_check(6, '{"escroc": 1, "seer": 1, "expat": 4}')$q$) = 'composition: unknown card', 'a Classic card in Dubaï: refused');
  perform pg_temp.check(pg_temp.err($q$select private.ww_check_composition(6, '{"werewolf": 1, "investor": 1, "villager": 4}')$q$) = 'composition: unknown card', 'a Dubaï card in Classic: refused');
end $$;

-- ───────── Protections (D4, D5, D6) ─────────
do $$
declare r uuid;
begin
  -- 0 escroc, 1 entrepreneur, 2 expat, 3 expat, 4 expat, 5 expat
  r := pg_temp.dgame(array['escroc', 'entrepreneur', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.check(pg_temp.err($q$select private.ww_submit('$q$ || r || $q$', 1, 'shield', 1, null)$q$) = 'not a valid target', 'the Entrepreneur cannot shield himself');
  perform pg_temp.act(r, 1, 'shield', 2);
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 2), 'Business Plan: the shielded player survives the Escrocs');
  perform pg_temp.check((select (charges ->> 'shield')::int = 0 from private.ww_players where room_id = r and seat = 1)
    and not exists (select 1 from jsonb_array_elements(private.ww_options(r, 1)) o where o ->> 'kind' = 'shield'), '… once per game');

  -- Golden Visa protects himself only; the Touriste is out of reach without anyone being told.
  r := pg_temp.dgame(array['escroc', 'golden_visa', 'tourist', 'expat', 'expat', 'expat']);
  perform pg_temp.check((select o -> 'targets' = '[1]'::jsonb from jsonb_array_elements(private.ww_options(r, 1)) o where o ->> 'kind' = 'visa'), 'Résidence protégée: himself only');
  perform pg_temp.act(r, 1, 'visa', 1);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 1), 'Golden Visa: survives the attack on him');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 2, 'stay');
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 2), 'Court séjour: the Touriste cannot be hit that night');
  perform pg_temp.check(not exists (select 1 from private.ww_log where room_id = r and audience in ('all', 'wolves') and data::text like '%stay%'),
    '… and nothing tells the Escrocs why');

  -- The Millionnaire survives once; protected, he keeps his Seconde Chance.
  r := pg_temp.dgame(array['escroc', 'millionaire', 'ecommerce', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 2, 'shield', 1);
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 1) and (select (charges ->> 'life')::int = 1 from private.ww_players where room_id = r and seat = 1),
    'a shielded Millionnaire keeps his Seconde Chance');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.alive(r, 1) and pg_temp.said(r, 1, 'second_chance') is not null, 'Seconde Chance: the Millionnaire survives the Escrocs once');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 0, 'wolf', 1);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 1), '… not twice');
end $$;

-- ───────── Investigations and falsifications ─────────
do $$
declare r uuid;
begin
  -- 0 escroc, 1 realtor, 2 investor, 3 emirati, 4 networker, 5 fake_millionaire, 6 expat, 7 expat, 8 expat
  r := pg_temp.dgame(array['escroc', 'realtor', 'investor', 'emirati', 'networker', 'fake_millionaire', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 2, 'probe', 0);
  perform pg_temp.act(r, 3, 'probe', 6);
  perform pg_temp.act(r, 4, 'probe', 5);
  perform pg_temp.next(r);
  perform pg_temp.check((pg_temp.said(r, 2, 'probe_result') ->> 'escroc')::boolean, 'Due Diligence: an Escroc is found Escroc');
  perform pg_temp.check(not (pg_temp.said(r, 3, 'probe_result') ->> 'escroc')::boolean, 'Connaissance du terrain: an Expat is not an Escroc');
  perform pg_temp.check(pg_temp.said(r, 4, 'network_result') ->> 'faction' = 'independents', 'Carnet d''adresses: the faction of an Indépendant');
  perform pg_temp.check(not exists (select 1 from private.ww_log where room_id = r and audience = 'all' and kind like '%result%'), 'results are private');

  -- The Agent immobilier turns the answer round on his target that night; the Bluff shows Expats.
  r := pg_temp.dgame(array['escroc', 'realtor', 'investor', 'networker', 'fake_millionaire', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 1, 'listing', 0);
  perform pg_temp.act(r, 2, 'probe', 0);
  perform pg_temp.act(r, 4, 'bluff');
  perform pg_temp.act(r, 3, 'probe', 4);
  perform pg_temp.next(r);
  perform pg_temp.check(not (pg_temp.said(r, 2, 'probe_result') ->> 'escroc')::boolean, 'Fausse annonce: the Escroc looks clean');
  perform pg_temp.check((select camp = 'wolves' from private.ww_players where room_id = r and seat = 0), '… his real camp does not change');
  perform pg_temp.check(pg_temp.said(r, 3, 'network_result') ->> 'faction' = 'expats', 'Bluff: the Faux Millionnaire looks like an Expat');

  -- Story exclusive and Accès VIP.
  r := pg_temp.dgame(array['escroc', 'creator', 'concierge', 'investor', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 1, 'story', 3);
  perform pg_temp.act(r, 3, 'probe', 4);
  perform pg_temp.act(r, 2, 'watch', 4);
  perform pg_temp.act(r, 0, 'wolf', 5);
  perform pg_temp.next(r);
  perform pg_temp.check((pg_temp.said(r, 1, 'story_result') ->> 'acted')::boolean, 'Story exclusive: the Investisseur acted tonight');
  perform pg_temp.check((pg_temp.said(r, 2, 'watch_result') ->> 'visited')::boolean, 'Accès VIP: the player investigated got a visit');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(private.ww_options(r, 2)) o where o ->> 'kind' = 'watch' and o -> 'targets' @> '4'),
    '… not the same player two nights in a row');
end $$;

-- ───────── The Charo, the Célibataire, the Networker ─────────
do $$
declare r uuid;
begin
  -- 0 escroc, 1 charo, 2..8 expats
  r := pg_temp.dgame(array['escroc', 'charo', 'expat', 'expat', 'expat', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 1, 'seduce', 2);
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.said(r, 1, 'seduce_failed') is not null, 'a seduction whose target dies that night does not count');
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(private.ww_options(r, 1)) o where o ->> 'kind' = 'seduce' and o -> 'targets' @> '1'), 'the Charo cannot seduce himself');
  perform pg_temp.act(r, 1, 'seduce', 3);
  perform pg_temp.next(r);
  perform pg_temp.vote(r, '{}');
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(private.ww_options(r, 1)) o where o ->> 'kind' = 'seduce' and o -> 'targets' @> '3'), 'nor seduce the same player twice');
  perform pg_temp.act(r, 1, 'seduce', 4);
  perform pg_temp.next(r);
  perform pg_temp.vote(r, '{}');
  perform pg_temp.act(r, 1, 'seduce', 5);
  perform pg_temp.next(r);
  perform pg_temp.check((select (memory ->> 'solo_won')::boolean from private.ww_players where room_id = r and seat = 1), 'three alive seductions: the Charo''s solo victory is won');
  -- He dies; the village wins; he still wins.
  perform pg_temp.vote(r, '{"0": 1, "3": 1, "4": 1, "5": 1, "6": 1, "7": 1, "8": 1}');
  perform pg_temp.check(not pg_temp.alive(r, 1), '(the Charo is voted out)');
  perform pg_temp.act(r, 0, 'wolf', 3);
  perform pg_temp.next(r);
  perform pg_temp.vote(r, '{"4": 0, "5": 0, "6": 0, "7": 0, "8": 0}');
  perform pg_temp.check(pg_temp.phase(r) = 'ended' and (select result ->> 'winner' from private.ww_games where room_id = r) = 'village'
    and (select (result -> 'seats') @> '1' and (result -> 'solo') @> '1' from private.ww_games where room_id = r), 'the Expats win, and the dead Charo wins too (definitive)');

  -- Coup de cœur: the Célibataire and his choice are lovers; one dies, the other too.
  r := pg_temp.dgame(array['escroc', 'single', 'expat', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 1, 'crush', 2);
  perform pg_temp.act(r, 0, 'wolf', 2);
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 2) and not pg_temp.alive(r, 1), 'Coup de cœur: when his love dies, the Célibataire dies too');

  -- The Networker: an Escroc investigated and alive at the Expats' victory = a double victory.
  r := pg_temp.dgame(array['escroc', 'networker', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.act(r, 1, 'probe', 0);
  perform pg_temp.next(r);
  perform pg_temp.vote(r, '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}');
  perform pg_temp.check((select result ->> 'winner' = 'village' and (result -> 'double') @> '1' from private.ww_games where room_id = r), 'Networker: Expats'' victory + personal objective');

  -- The Faux Millionnaire wins if he is alive at the end, whoever wins.
  r := pg_temp.dgame(array['escroc', 'fake_millionaire', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.next(r);
  perform pg_temp.vote(r, '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}');
  perform pg_temp.check((select (result -> 'seats') @> '1' and (result -> 'solo') @> '1' from private.ww_games where room_id = r), 'Faux Millionnaire alive at the end: a personal victory');
end $$;

-- ───────── The vote: cancelled, doubled, immune (annulations, then multiplications) ─────────
do $$
declare r uuid;
begin
  -- 0 escroc, 1 escroc, 2 broker, 3 ceo, 4 influencer, 5 newcomer, 6..11 expats
  r := pg_temp.dgame(array['escroc', 'escroc', 'broker', 'ceo', 'influencer', 'newcomer', 'expat', 'expat', 'expat', 'expat', 'expat', 'expat']);
  perform pg_temp.next(r);
  perform pg_temp.check(pg_temp.phase(r) = 'day', '(day 1)');
  perform pg_temp.act(r, 3, 'board');
  perform pg_temp.check(exists (select 1 from private.ww_log where room_id = r and audience = 'all' and kind = 'vote_doubled' and (data ->> 'seat')::int = 3),
    'the CEO''s Conseil d''administration is announced');
  perform pg_temp.next(r);
  perform pg_temp.check(not exists (select 1 from jsonb_array_elements(private.ww_options(r, 3)) o where o ->> 'kind' = 'board'), 'the CEO announces before the vote, not during it');
  perform pg_temp.act(r, 4, 'buzz', 6);
  perform pg_temp.act(r, 2, 'dump', 7);
  perform pg_temp.check(pg_temp.said(r, 2, 'dumped') is not null and not exists (select 1 from private.ww_log where room_id = r and audience = 'all' and kind = 'dumped'),
    'the Broker''s cancellation stays secret');
  -- 3 (×2) and 6 (×2) vote 9: 4 points; 7 (cancelled), 8, 10, 11 vote 10: 3 points. The rest abstain.
  perform pg_temp.act(r, 3, 'vote', 9); perform pg_temp.act(r, 6, 'vote', 9);
  perform pg_temp.act(r, 7, 'vote', 10); perform pg_temp.act(r, 8, 'vote', 10); perform pg_temp.act(r, 10, 'vote', 11); perform pg_temp.act(r, 11, 'vote', 10);
  perform pg_temp.check(pg_temp.phase(r) = 'vote', 'using a day power does not count as voting (the vote stays open)');
  perform pg_temp.next(r);
  perform pg_temp.check(not pg_temp.alive(r, 9) and pg_temp.alive(r, 10), 'two double votes beat four votes with one cancelled (4 against 3)');
  perform pg_temp.check((select (data -> 'counts' ->> '9')::int = 4 and (data -> 'counts' ->> '10')::int = 2 from private.ww_log where room_id = r and kind = 'votes' order by id desc limit 1),
    '… counts: 9 → 4, 10 → 2 (7''s vote cancelled), 11 → 1');
  perform pg_temp.check((select (charges ->> 'board')::int = 0 and (select (charges ->> 'buzz')::int = 0 from private.ww_players where room_id = r and seat = 4)
    from private.ww_players where room_id = r and seat = 3), 'day powers are used once');

  -- Nouveau départ: the most voted is immune that day, nobody is out.
  perform pg_temp.next(r);
  perform pg_temp.next(r);
  perform pg_temp.act(r, 5, 'fresh');
  perform pg_temp.vote(r, '{"0": 5, "1": 5, "2": 5, "6": 5}');
  perform pg_temp.check(pg_temp.alive(r, 5) and exists (select 1 from private.ww_log where room_id = r and kind = 'immune_saved'), 'Nouveau départ: the Nouvel Arrivant survives the vote');
end $$;

-- ───────── Classic mode unchanged by the Dubaï cards ─────────
do $$
declare r uuid := gen_random_uuid();
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (r, 'werewolf', 'irly', 6, 'online', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition) values (r, 'online', 6, '{}');
  perform pg_temp.check((select mode = 'classic' from private.ww_games where room_id = r), 'a game is Classic unless created in Dubaï');
  perform pg_temp.check((private.ww_default_for('classic', 8) ->> 'werewolf')::int = 2 and not private.ww_default_for('classic', 8) ? 'escroc', 'the Classic deck has no Dubaï card');
end $$;

-- ───────── Whole games played by AI players, 6 to 20 ─────────
create or replace function pg_temp.dsim(p_size integer, p_diff text) returns text language plpgsql as $$
declare rid uuid := gen_random_uuid(); steps integer := 0;
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (rid, 'werewolf', 'irly', p_size, 'training', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, difficulty, mode) values (rid, 'training', p_size, private.ww_dubai_composition(p_size), p_diff, 'dubai');
  perform private.ww_deal(rid, '{}', p_size, null);
  perform private.ww_enter(rid, 'night');
  while pg_temp.phase(rid) <> 'ended' and steps < 300 loop
    perform private.ww_advance(rid, true);
    steps := steps + 1;
  end loop;
  return coalesce((select result ->> 'winner' from private.ww_games where room_id = rid), 'stuck') || ':' ||
    (select greatest(night, day) from private.ww_games where room_id = rid) || ':' ||
    (select coalesce(jsonb_array_length(result -> 'solo'), 0) from private.ww_games where room_id = rid);
end $$;

do $$
declare
  n integer; d text; res text; games integer := 0; stuck integer := 0; solo integer := 0;
  wins jsonb := '{}'::jsonb; w text; longest integer := 0;
begin
  for n in 6..20 loop
    foreach d in array array['beginner', 'intermediate', 'expert'] loop
      for k in 1..4 loop
        res := pg_temp.dsim(n, d);
        games := games + 1;
        w := split_part(res, ':', 1);
        if w = 'stuck' then stuck := stuck + 1; end if;
        longest := greatest(longest, split_part(res, ':', 2)::int);
        solo := solo + split_part(res, ':', 3)::int;
        wins := jsonb_set(wins, array[w], to_jsonb(coalesce((wins ->> w)::int, 0) + 1));
      end loop;
    end loop;
  end loop;
  raise notice '    Dubaï simulations: % games, results %, solo victories %, longest % rounds', games, wins, solo, longest;
  perform pg_temp.check(stuck = 0, format('every simulated Dubaï game ends (%s games, none stuck)', games));
  perform pg_temp.check(coalesce((wins ->> 'village')::int, 0) > 0 and coalesce((wins ->> 'wolves')::int, 0) > 0, 'both the Expats and the Escrocs win some games');
end $$;

-- Members cannot call the new engine parts.
select pg_temp.check(not has_function_privilege('authenticated', 'private.ww_resolve_night_dubai(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'private.ww_dubai_check(integer, jsonb)', 'execute'), 'members cannot call the Dubaï engine');
