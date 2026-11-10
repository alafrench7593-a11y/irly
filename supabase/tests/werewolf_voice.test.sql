-- IRLY Loup-Garou: voice games (20261117000000_irly_werewolf_voice).
-- What the database decides: who may speak and listen on which voice channel in each phase, and which audio
-- rooms must be closed when that changes. The sound itself is not tested here (it never passes through the database).
-- TEST accounts only, ids prefixed 7e57000….
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

create or replace function pg_temp.as_user(n integer) returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '7e570000-0000-0000-0000-00000000000' || n, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;
create or replace function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAIL voice: %', label; end if;
  raise notice 'ok  %', label;
end $$;
create or replace function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;
create or replace function pg_temp.uid(n integer) returns uuid language sql as $$ select ('7e570000-0000-0000-0000-00000000000' || n)::uuid $$;
/** What member n may do: 'all:speak+listen dead:listen …', in channel order; '' when nothing. */
create or replace function pg_temp.rights(r uuid, n integer) returns text language sql as $$
  select coalesce(string_agg(c.channel || ':' || case when c.speak then 'speak+' else '' end || 'listen', ' ' order by c.channel), '')
  from private.ww_voice_channels(r, pg_temp.uid(n)) c where private.ww_voice_room(r, c.channel) is not null
$$;
/** The grant member n gets, or the refusal. */
create or replace function pg_temp.grant_of(r uuid, n integer) returns jsonb language plpgsql as $$
declare j jsonb;
begin
  perform pg_temp.as_user(n);
  begin
    j := public.ww_voice_grant(r);
  exception when others then
    j := jsonb_build_object('refused', sqlerrm);
  end;
  perform pg_temp.as_admin();
  return j;
end $$;
create or replace function pg_temp.room_of(j jsonb, ch text) returns text language sql as $$
  select c ->> 'room' from jsonb_array_elements(j -> 'channels') c where c ->> 'channel' = ch
$$;
/** A crafted online voice game: members 1..n hold the given cards in seat order, at night 1. */
create or replace function pg_temp.voice_game(p_cards text[], p_mode text default 'classic') returns uuid language plpgsql as $$
declare rid uuid := gen_random_uuid();
begin
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility, host_id) values (rid, 'werewolf', 'irly', array_length(p_cards, 1), 'online', 'playing', 'private', pg_temp.uid(1));
  insert into private.ww_games (room_id, kind, mode, size, composition, comm) values (rid, 'online', p_mode, array_length(p_cards, 1), '{}', 'voice');
  for i in 1..array_length(p_cards, 1) loop
    insert into public.game_participants (room_id, user_id, seat) values (rid, pg_temp.uid(i), i - 1);
    insert into private.ww_players (room_id, seat, user_id, bot, name, card, charges, camp, wolf_since)
      values (rid, i - 1, pg_temp.uid(i), false, 'P' || (i - 1), p_cards[i], private.ww_fresh_charges(p_cards[i]), private.ww_camp(p_cards[i]),
        case when private.ww_camp(p_cards[i]) = 'wolves' then 0 end);
  end loop;
  update private.ww_games set phase = 'night', night = 1, deadline = now() + interval '1 hour' where room_id = rid;
  return rid;
end $$;

select pg_temp.as_admin();
insert into auth.users (id) select pg_temp.uid(i) from generate_series(1, 9) i on conflict do nothing;
insert into public.profiles (id, first_name, birthdate, gender, city_id)
  select pg_temp.uid(i), 'W' || i, '1994-04-04', case when i % 2 = 0 then 'woman' else 'man' end, 'dubai' from generate_series(1, 9) i
  on conflict do nothing;

-- ───────── The host's choice, kept by the server (text by default) ─────────
do $$
declare t uuid; tr uuid; s jsonb; g jsonb; g2 jsonb; i integer;
begin
  perform pg_temp.as_user(1);
  t := (public.ww_create('mixte', 'public', 8) ->> 'id')::uuid;
  perform pg_temp.check((public.ww_voice_state(t) ->> 'comm') = 'text' and public.ww_voice_state(t) -> 'channels' = '[]'::jsonb, 'a new game is played in writing: no voice channel');
  perform pg_temp.check(pg_temp.err(format('select public.ww_voice_grant(%L)', t)) = 'this game is played in writing', 'L · a text game gives no voice access');
  perform pg_temp.as_user(2);
  perform public.game_join(t);
  perform pg_temp.check(pg_temp.err(format('select public.ww_set_comm(%L, %L)', t, 'voice')) = 'only the host can do this', 'only the host chooses text or voice');
  perform pg_temp.as_user(1);
  perform pg_temp.check(pg_temp.err(format('select public.ww_set_comm(%L, %L)', t, 'video')) = 'choose text or voice', 'only text or voice');
  perform pg_temp.check(public.ww_set_comm(t, 'voice') = 'voice', 'the host turns voice on');
  perform pg_temp.check((public.ww_comms(array[t]) ->> t::text) = 'voice' and (public.ww_voice_state(t) ->> 'comm') = 'voice', 'everyone who sees the game is told it is a voice game');
  -- A · the lobby: everyone there may speak, nobody else.
  s := public.ww_voice_state(t);
  perform pg_temp.check(s -> 'channels' = '[{"listen": true, "speak": true, "channel": "all"}]'::jsonb, 'A · lobby: the host speaks and listens on « all »');
  perform pg_temp.as_admin();
  g := pg_temp.grant_of(t, 1);
  g2 := pg_temp.grant_of(t, 2);
  perform pg_temp.check(pg_temp.room_of(g, 'all') is not null and pg_temp.room_of(g, 'all') = pg_temp.room_of(g2, 'all') and (g ->> 'identity') = pg_temp.uid(1)::text,
    'A · lobby: two members get the same audio room, each under their own identity');
  perform pg_temp.check(pg_temp.grant_of(t, 3) ->> 'refused' = 'you cannot talk here now', 'K · someone who has not joined gets no access to the lobby room');
  -- Removed from the lobby: no access, and the room everyone was in is closed.
  perform pg_temp.as_user(1);
  perform public.game_kick(t, pg_temp.uid(2));
  perform pg_temp.as_admin();
  perform pg_temp.check(pg_temp.grant_of(t, 2) ->> 'refused' = 'you cannot talk here now', 'removed by the host: no voice access any more');
  g2 := pg_temp.grant_of(t, 1);
  perform pg_temp.check(pg_temp.room_of(g2, 'all') <> pg_temp.room_of(g, 'all') and g2 -> 'retire' ? pg_temp.room_of(g, 'all'),
    'removed by the host: the lobby moves to a new audio room and the old one is closed');
  -- Training and in-person games never have voice.
  perform pg_temp.as_user(1);
  tr := public.ww_training('mixte', 8, null, 'beginner');
  perform pg_temp.check(pg_temp.err(format('select public.ww_set_comm(%L, %L)', tr, 'voice')) is not null and (public.ww_voice_state(tr) ->> 'comm') = 'text',
    'against AI players: no voice, the game is unchanged');
  perform pg_temp.as_admin();
end $$;

-- ───────── Night, day, death (tests B, C, D, F, H, K) ─────────
do $$
declare r uuid; g1 jsonb; g2 jsonb; day_room text; wolves_room text; n integer;
begin
  r := pg_temp.voice_game(array['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager']);
  -- C · night: « all » is closed for everyone.
  perform pg_temp.check(pg_temp.rights(r, 3) = '' and pg_temp.rights(r, 5) = '', 'C · night: a villager has no voice channel at all');
  perform pg_temp.check(pg_temp.grant_of(r, 3) ->> 'refused' = 'you cannot talk here now', 'C · night: a villager is refused by the server');
  -- D · the pack has its own channel.
  perform pg_temp.check(pg_temp.rights(r, 1) = 'wolves:speak+listen' and pg_temp.rights(r, 2) = 'wolves:speak+listen', 'D · night: the two wolves speak on « wolves » only');
  g1 := pg_temp.grant_of(r, 1);
  g2 := pg_temp.grant_of(r, 2);
  wolves_room := pg_temp.room_of(g1, 'wolves');
  perform pg_temp.check(wolves_room is not null and wolves_room = pg_temp.room_of(g2, 'wolves') and jsonb_array_length(g1 -> 'channels') = 1, 'D · the two wolves are given the same room, and nothing else');
  -- K · nobody else is ever handed that room, in any phase.
  for n in 3..6 loop
    perform pg_temp.check(coalesce(pg_temp.grant_of(r, n) -> 'channels', '[]'::jsonb)::text not like '%' || wolves_room || '%', format('K · seat %s is never given the pack''s room', n - 1));
  end loop;
  perform pg_temp.check(pg_temp.grant_of(r, 9) ->> 'refused' is not null, 'K · a member who is not in the game is refused');
  -- B · day: the six living players speak together.
  update private.ww_games set phase = 'day', day = 1 where room_id = r;
  perform pg_temp.check((select bool_and(pg_temp.rights(r, i) = 'all:speak+listen') from generate_series(1, 6) i), 'B · day: the six living players speak and listen on « all »');
  g1 := pg_temp.grant_of(r, 1);
  day_room := pg_temp.room_of(g1, 'all');
  perform pg_temp.check((select count(distinct pg_temp.room_of(pg_temp.grant_of(r, i), 'all')) = 1 from generate_series(1, 6) i), 'B · day: one audio room for the six');
  perform pg_temp.check(g1 -> 'retire' ? wolves_room and pg_temp.room_of(g1, 'wolves') is null, 'day: the pack''s room of the night is closed, wolves hold no private channel by day');
  update private.ww_games set phase = 'vote' where room_id = r;
  perform pg_temp.check(pg_temp.room_of(pg_temp.grant_of(r, 3), 'all') = day_room, 'vote: the debate goes on in the same room (no reconnection)');
  -- F · elimination: the dead lose the right to speak to the living, at once.
  update private.ww_players set alive = false, death = 'vote' where room_id = r and seat = 4;
  perform pg_temp.check(pg_temp.rights(r, 5) = 'all:listen dead:speak+listen', 'F · eliminated: listens to the debate, speaks only among the dead');
  g2 := pg_temp.grant_of(r, 5);
  perform pg_temp.check(pg_temp.room_of(g2, 'all') <> day_room and g2 -> 'retire' ? day_room, 'F · the room where the dead player could speak is closed; the living move to a new one');
  perform pg_temp.check(exists (select 1 from jsonb_array_elements(g2 -> 'channels') c where c ->> 'channel' = 'all' and c ->> 'speak' = 'false'), 'F · the server''s grant itself says: no speaking on « all »');
  perform pg_temp.check((select count(*) = 0 from generate_series(1, 4) i where pg_temp.grant_of(r, i) -> 'channels' @> '[{"channel": "dead"}]'), 'F · no living player is given the room of the dead');
  -- Night again: the dead stay among themselves, the living villagers are silent.
  update private.ww_games set phase = 'night', night = 2 where room_id = r;
  perform pg_temp.check(pg_temp.rights(r, 5) = 'dead:speak+listen' and pg_temp.rights(r, 6) = '' and pg_temp.rights(r, 1) = 'wolves:speak+listen', 'night 2: dead among the dead, pack in the pack, the village silent');
  perform pg_temp.check(pg_temp.room_of(pg_temp.grant_of(r, 1), 'wolves') <> wolves_room, 'each night the pack gets a new room');
  -- A dead wolf loses the pack's channel.
  update private.ww_players set alive = false, death = 'witch' where room_id = r and seat = 1;
  perform pg_temp.check(pg_temp.rights(r, 2) = 'dead:speak+listen' and (pg_temp.grant_of(r, 2) -> 'channels')::text not like '%wolves%', 'a dead wolf no longer hears the pack');
  -- H · reconnection: asking again gives the current rights only, and the same rooms.
  g1 := pg_temp.grant_of(r, 1);
  perform pg_temp.check(pg_temp.grant_of(r, 1) -> 'channels' = g1 -> 'channels' and jsonb_array_length(g1 -> 'channels') = 1, 'H · reconnecting gives the same room and the present rights, nothing from before');
  -- The end: everyone talks again.
  update private.ww_games set phase = 'ended' where room_id = r;
  perform pg_temp.check((select bool_and(pg_temp.rights(r, i) = 'all:speak+listen') from generate_series(1, 6) i), 'the game is over: every player speaks on « all » again');
end $$;

-- ───────── E · Dubaï: the Escrocs' private channel ─────────
do $$
declare r uuid; g jsonb; n integer;
begin
  r := pg_temp.voice_game(array['escroc', 'escroc', 'expat', 'influencer', 'emirati', 'expat'], 'dubai');
  perform pg_temp.check(pg_temp.rights(r, 1) = 'wolves:speak+listen' and pg_temp.rights(r, 2) = 'wolves:speak+listen', 'E · Dubaï night: the Escrocs speak on their private channel');
  g := pg_temp.grant_of(r, 1);
  for n in 3..6 loop
    perform pg_temp.check(pg_temp.rights(r, n) = '' and pg_temp.grant_of(r, n) ->> 'refused' = 'you cannot talk here now', format('E · Dubaï night: seat %s (an Expat) cannot listen', n - 1));
  end loop;
end $$;

-- ───────── G · a card changes hands (the Scameur): rights follow the card, the old room closes ─────────
do $$
declare r uuid; before_ jsonb; after_ jsonb; old_room text;
begin
  r := pg_temp.voice_game(array['werewolf', 'werewolf', 'scammer', 'seer', 'villager', 'villager', 'villager'], 'chaos');
  before_ := pg_temp.grant_of(r, 1);
  old_room := pg_temp.room_of(before_, 'wolves');
  perform pg_temp.check(pg_temp.rights(r, 3) = '', 'G · before the swap the Scameur has no channel at night');
  -- The Scameur (seat 2) takes the card of the werewolf at seat 0: resolved by the real engine.
  perform private.ww_submit(r, 2, 'scam', 0, null);
  perform private.ww_submit(r, 1, 'wolf', 4, null);
  perform private.ww_advance(r, true);
  perform pg_temp.check((select card = 'werewolf' and camp = 'wolves' from private.ww_players where room_id = r and seat = 2)
    and (select camp = 'village' from private.ww_players where room_id = r and seat = 0), 'G · the engine swapped the cards: seat 2 is now a werewolf, seat 0 is not');
  -- Go to the next night with whoever is alive.
  update private.ww_games set phase = 'night', night = 2, deadline = now() + interval '1 hour' where room_id = r;
  update private.ww_players set alive = true, death = null where room_id = r;
  perform pg_temp.check(pg_temp.rights(r, 1) = '', 'G · the former wolf has lost the pack''s channel');
  perform pg_temp.check(pg_temp.grant_of(r, 1) ->> 'refused' = 'you cannot talk here now', 'G · the former wolf is refused by the server');
  after_ := pg_temp.grant_of(r, 2);
  perform pg_temp.check(pg_temp.room_of(after_, 'wolves') is not null and pg_temp.room_of(after_, 'wolves') <> old_room, 'G · the pack now meets in a new room the former wolf never had');
  perform pg_temp.check((select wolf_since from private.ww_players where room_id = r and seat = 2) is not null
    and (pg_temp.rights(r, 3) = 'wolves:speak+listen') = (select coalesce(wolf_since, 0) <= 2 from private.ww_players where room_id = r and seat = 2),
    'G · the new wolf joins the pack''s channel exactly when the written pack chat opens to it');
  perform pg_temp.check((select replaced_at is not null from private.ww_voice_rooms where room_id = r and name = old_room), 'G · the old pack room is marked to be closed on the audio server');
end $$;

-- ───────── J · twenty players ─────────
do $$
declare r uuid := gen_random_uuid(); j integer; rooms integer;
begin
  insert into auth.users (id) select ('7e570000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid from generate_series(1, 20) i on conflict do nothing;
  insert into public.profiles (id, first_name, birthdate, gender, city_id)
    select ('7e570000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'V' || i, '1994-04-04', 'man', 'dubai' from generate_series(1, 20) i on conflict do nothing;
  insert into public.game_rooms (id, game, space, max_players, kind, status, visibility) values (r, 'werewolf', 'irly', 20, 'online', 'playing', 'private');
  insert into private.ww_games (room_id, kind, size, composition, comm, phase, day, night, deadline) values (r, 'online', 20, '{}', 'voice', 'day', 1, 1, now() + interval '1 hour');
  for j in 1..20 loop
    insert into private.ww_players (room_id, seat, user_id, bot, name, card, charges, camp, wolf_since)
      values (r, j - 1, ('7e570000-0000-0000-0000-0000000001' || lpad(j::text, 2, '0'))::uuid, false, 'V' || j, case when j <= 4 then 'werewolf' else 'villager' end, '{}',
        case when j <= 4 then 'wolves' else 'village' end, case when j <= 4 then 0 end);
  end loop;
  select count(distinct c.name) into rooms from generate_series(1, 20) i,
    lateral (select private.ww_voice_room(r, ch.channel) as name from private.ww_voice_channels(r, ('7e570000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid) ch where ch.speak) c;
  perform pg_temp.check(rooms = 1, 'J · twenty living players by day: all twenty may speak, in one single audio room');
  update private.ww_games set phase = 'night', night = 2 where room_id = r;
  perform pg_temp.check((select count(*) = 4 from generate_series(1, 20) i where exists (select 1 from private.ww_voice_channels(r, ('7e570000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid))),
    'J · twenty players by night: only the four wolves hold a channel');
end $$;

-- ───────── Nothing is readable or writable from outside ─────────
select pg_temp.as_user(3);
select pg_temp.check(pg_temp.err('select * from private.ww_voice_rooms') is not null, 'members cannot read the list of audio rooms');
select pg_temp.check(pg_temp.err($q$select private.ww_voice_room(gen_random_uuid(), 'wolves')$q$) is not null and pg_temp.err($q$select * from private.ww_voice_channels(gen_random_uuid(), gen_random_uuid())$q$) is not null,
  'members cannot ask for another player''s rights or a room''s name');
select pg_temp.as_admin();
select pg_temp.check(not has_function_privilege('anon', 'public.ww_voice_grant(uuid)', 'execute') and not has_function_privilege('anon', 'public.ww_voice_state(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.ww_set_comm(uuid, text)', 'execute'), 'signed-out visitors can call none of the voice functions');
