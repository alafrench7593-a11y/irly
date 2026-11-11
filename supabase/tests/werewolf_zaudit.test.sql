-- IRLY Games: the server fixes of the audit (20261119000000_irly_games_audit).
-- TEST accounts only, ids prefixed 7e57000… (created by werewolf.test.sql).
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
  if not coalesce(ok, false) then raise exception 'FAIL audit: %', label; end if;
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

select pg_temp.as_admin();
insert into auth.users (id) select pg_temp.uid(i) from generate_series(1, 9) i on conflict do nothing;
insert into public.profiles (id, first_name, birthdate, gender, city_id)
  select pg_temp.uid(i), 'W' || i, '1994-04-04', case when i % 2 = 0 then 'woman' else 'man' end, 'dubai' from generate_series(1, 9) i
  on conflict do nothing;
update public.game_participants set left_at = now() where user_id::text like '7e570000-0000-0000-0000-00000000000_' and left_at is null;
delete from public.game_presence where user_id::text like '7e570000-0000-0000-0000-00000000000_';

do $$
declare
  t uuid; g uuid; w uuid; code text; n integer; i integer; s integer;
begin
  -- ───── The Thief out of the deck ─────
  perform pg_temp.check(private.ww_extra_cards('{"thief": 0, "villager": 4}') = 0 and private.ww_extra_cards('{"thief": 1}') = 2 and private.ww_extra_cards('{"villager": 6}') = 0,
    'the Thief''s two extra cards count only when the Thief is in the deck (« thief: 0 » adds none)');

  -- ───── A member removed by the host, a member who left ─────
  perform pg_temp.as_user(1);
  t := (public.ww_create('mixte', 'private', 6) ->> 'id')::uuid;
  code := public.game_room(t) ->> 'code';
  perform pg_temp.check(code is not null, 'the host reads the private table''s code');
  perform pg_temp.as_user(2);
  perform public.game_join_code(code);
  perform pg_temp.as_user(3);
  perform public.game_join_code(code);
  perform pg_temp.as_user(1);
  perform public.game_say(t, 'before anyone goes');
  perform public.game_kick(t, pg_temp.uid(2));
  perform pg_temp.as_user(3);
  perform public.game_leave(t);
  perform pg_temp.as_user(1);
  perform public.game_say(t, 'after they went');
  -- One transaction has one clock: put the first message and the departures clearly before the second message.
  perform pg_temp.as_admin();
  update public.game_messages set created_at = now() - interval '2 minutes' where room_id = t and body = 'before anyone goes';
  update public.game_participants set left_at = now() - interval '1 minute' where room_id = t and left_at is not null;
  perform pg_temp.as_user(2);
  select count(*) into n from public.game_messages where room_id = t;
  perform pg_temp.check(n = 0, 'a member removed by the host reads nothing of the table''s chat');
  perform pg_temp.check(pg_temp.err(format('select public.game_room(%L)', t)) = 'this game no longer exists', '… and the private table is closed to them (no code, no players)');
  perform pg_temp.as_user(3);
  perform pg_temp.check((select count(*) = 1 from public.game_messages where room_id = t and body = 'before anyone goes')
    and (select count(*) = 0 from public.game_messages where room_id = t and body = 'after they went'),
    'a member who left keeps what was said while they were there, and reads nothing said after');
  perform pg_temp.check(public.game_room(t) ->> 'code' is null, '… and no longer reads the table''s code');
  perform pg_temp.as_user(1);
  perform pg_temp.check((select count(*) = 2 from public.game_messages where room_id = t and kind = 'chat'), 'the host, still seated, reads both messages');
  perform public.game_leave(t);

  -- ───── A waiting room whose host is away ─────
  perform pg_temp.as_user(1);
  w := (public.ww_create('mixte', 'public', 6) ->> 'id')::uuid;
  perform pg_temp.as_user(2);
  perform public.game_join(w);
  perform pg_temp.as_admin();
  update public.game_rooms set created_at = now() - interval '3 minutes' where id = w;
  perform private.games_sweep();
  perform pg_temp.check((select host_id = pg_temp.uid(1) from public.game_rooms where id = w), 'nobody present in the waiting room: the table keeps its host');
  perform pg_temp.as_user(1);
  perform public.game_ping('mixte', w);
  perform pg_temp.as_user(2);
  perform public.game_ping('mixte', w);
  perform pg_temp.as_admin();
  perform private.games_sweep();
  perform pg_temp.check((select host_id = pg_temp.uid(1) from public.game_rooms where id = w), 'the host is present: the table keeps its host');
  update public.game_presence set seen_at = now() - interval '3 minutes' where user_id = pg_temp.uid(1);
  perform private.games_sweep();
  perform pg_temp.check((select host_id = pg_temp.uid(2) from public.game_rooms where id = w), 'the host away two minutes: the table passes to the member present');
  perform pg_temp.as_user(2);
  perform pg_temp.check(pg_temp.err(format('select public.game_kick(%L, %L)', w, pg_temp.uid(1))) is null, '… who now holds the host''s rights');
  perform public.game_leave(w);

  -- ───── A game of six ─────
  perform pg_temp.as_user(1);
  g := (public.ww_create('mixte', 'public', 6) ->> 'id')::uuid;
  for i in 2 .. 6 loop
    perform pg_temp.as_user(i);
    perform public.game_join(g);
  end loop;
  perform pg_temp.as_user(1);
  perform public.game_start(g);
  perform pg_temp.as_admin();
  perform pg_temp.check((select phase not in ('lobby', 'ended') from private.ww_games where room_id = g), 'six members start a game');

  -- An action that aims at no one carries no seat.
  insert into private.ww_actions (room_id, phase, round, seat, kind, target, target2) values (g, 'night', 99, 1, 'stay', 3, 4), (g, 'night', 99, 2, 'hide', 5, null),
    (g, 'vote', 99, 3, 'vote', 4, 5), (g, 'night', 99, 4, 'link', 1, 2), (g, 'power', 99, 5, 'board', 5, null);
  perform pg_temp.check((select target is null and target2 is null from private.ww_actions where room_id = g and round = 99 and kind = 'stay')
    and (select target is null from private.ww_actions where room_id = g and round = 99 and kind = 'hide'),
    'an action that aims at no one stores no seat, whatever was sent with it');
  perform pg_temp.check((select target = 4 and target2 is null from private.ww_actions where room_id = g and round = 99 and kind = 'vote')
    and (select target = 1 and target2 = 2 from private.ww_actions where room_id = g and round = 99 and kind = 'link')
    and (select target = 5 from private.ww_actions where room_id = g and round = 99 and kind = 'board'),
    'a vote keeps its one seat, the Cupid''s link its two, a power used by day its own');
  delete from private.ww_actions where room_id = g and round = 99;

  -- The last thing a member did.
  update private.ww_games set last_human_at = null where room_id = g;
  select seat into s from private.ww_players where room_id = g and user_id = pg_temp.uid(1);
  insert into private.ww_actions (room_id, phase, round, seat, kind, target) values (g, 'vote', 98, s, 'vote', null);
  perform pg_temp.check((select last_human_at is not null from private.ww_games where room_id = g), 'a member''s action is remembered as the game''s last sign of life');
  delete from private.ww_actions where room_id = g and round = 98;

  -- A host who left no longer cuts the day short.
  update private.ww_games set phase = 'day', day = greatest(day, 1), deadline = now() + interval '1 hour' where room_id = g;
  perform pg_temp.as_user(2);
  perform pg_temp.check(pg_temp.err(format('select public.ww_skip_day(%L)', g)) = 'only the host can do this', 'a player who is not the host cannot cut the day short');
  perform pg_temp.as_user(1);
  perform public.game_leave(g);
  perform pg_temp.check(pg_temp.err(format('select public.ww_skip_day(%L)', g)) = 'only the host can do this', 'a host who left the game cannot cut the day short either');

  -- Nobody plays any more.
  perform pg_temp.as_admin();
  perform pg_temp.check((select status = 'playing' from public.game_rooms where id = g), 'the game goes on with five');
  update private.ww_games set last_human_at = now() - interval '10 minutes', deadline = now() + interval '1 hour' where room_id = g;
  perform private.games_sweep();
  perform pg_temp.check((select status = 'playing' from public.game_rooms where id = g), 'ten minutes without a sign of life: the game is still on');
  update private.ww_games set last_human_at = now() - interval '21 minutes' where room_id = g;
  perform private.games_sweep();
  perform pg_temp.check((select status = 'finished' from public.game_rooms where id = g)
    and (select phase = 'ended' and result ->> 'winner' = 'draw' from private.ww_games where room_id = g),
    'twenty minutes without one action or message from a member: the game ends as a draw');
  perform pg_temp.check((select count(*) = 1 from private.ww_log where room_id = g and kind = 'idle_end'), '… and the log says why');
  perform pg_temp.as_user(2);
  perform pg_temp.check(pg_temp.err('select public.ww_create(''mixte'', ''public'', 6)') is null, '… and its seats no longer count against the three-games limit');
end $$;
