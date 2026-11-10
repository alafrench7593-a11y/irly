-- IRLY Games: a game shared in a community and on the Live (20261118000000_irly_game_share).
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
  if not coalesce(ok, false) then raise exception 'FAIL share: %', label; end if;
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
-- Free the test members from earlier files' games (a member plays in three at most).
update public.game_participants set left_at = now() where user_id::text like '7e570000-0000-0000-0000-00000000000_' and left_at is null;
insert into public.communities (id, city_id, name, category_id, girl_only) values
  ('7e57c000-0000-0000-0000-0000000000a1', 'dubai', 'Share Open Club', 'food', false),
  ('7e57c000-0000-0000-0000-0000000000a2', 'dubai', 'Share Second Club', 'food', false),
  ('7e57c000-0000-0000-0000-0000000000a3', 'dubai', 'Share Girls Club', 'girl', true);
insert into public.community_members (community_id, user_id, role)
  select c, pg_temp.uid(i), 'member' from generate_series(1, 2) i, unnest(array['7e57c000-0000-0000-0000-0000000000a1', '7e57c000-0000-0000-0000-0000000000a2', '7e57c000-0000-0000-0000-0000000000a3']::uuid[]) c;

do $$
declare
  open_c uuid := '7e57c000-0000-0000-0000-0000000000a1'; second_c uuid := '7e57c000-0000-0000-0000-0000000000a2'; girls_c uuid := '7e57c000-0000-0000-0000-0000000000a3';
  t uuid; priv uuid; tr uuid; p1 uuid; p2 uuid; pl uuid; pp uuid; card jsonb; i integer; n integer;
begin
  perform pg_temp.as_user(1);
  t := (public.ww_create('mixte', 'public', 6) ->> 'id')::uuid;
  -- ───── Share in a community: one post, the same on a second ask ─────
  p1 := public.game_share(t, open_c, false);
  perform pg_temp.check(p1 is not null and public.game_share(t, open_c, false) = p1, 'sharing a game in a community makes one post; sharing again gives the same post');
  perform pg_temp.check((select game_room_id = t and author_id = pg_temp.uid(1) and not in_live from public.community_posts where id = p1), 'the post carries the room, by its host, not on the Live');
  card := public.game_share_cards(array[p1]) -> p1::text;
  perform pg_temp.check((card ->> 'room_id')::uuid = t and (card ->> 'players')::int = 1 and (card ->> 'max')::int = 6 and card ->> 'status' = 'waiting'
    and card ->> 'mode' = 'classic' and card ->> 'comm' = 'text' and card ->> 'host' = 'W1' and (card ->> 'mine')::boolean, 'the card is read from the room: 1/6, waiting, Classic, text, the host');
  -- ───── On the Live: the same kind of record, flagged at publication, pointing to the same room ─────
  pl := public.game_share(t, second_c, true);
  perform pg_temp.check((select in_live and game_room_id = t from public.community_posts where id = pl) and pl <> p1, 'shared on the Live: one community post flagged in_live, the same room');
  perform pg_temp.check((select count(distinct game_room_id) = 1 and count(*) = 2 from public.community_posts where id in (p1, pl))
    and (select count(*) = 1 from public.game_rooms where host_id = pg_temp.uid(1) and status = 'waiting' and kind = 'online'), 'two posts, one room: sharing never creates another game');
  perform pg_temp.check(pg_temp.err(format('update public.community_posts set game_room_id = %L where id = %L', gen_random_uuid(), p1)) is not null, 'a post cannot be pointed to another game afterwards');
  -- Shared in a community first, then asked on the Live for the same community: one post still, now on the Live.
  p2 := public.game_share(t, open_c, true);
  perform pg_temp.check(p2 <> p1 and (select in_live from public.community_posts where id = p2) and (select deleted_at is not null from public.community_posts where id = p1)
    and (select count(*) = 1 from public.community_posts where game_room_id = t and community_id = open_c and deleted_at is null)
    and public.game_share(t, open_c, false) = p2, 'asked on the Live after the community: the post is published again on the Live, and there is still one');
  p1 := p2;
  -- ───── Who may share ─────
  perform pg_temp.as_user(2);
  perform pg_temp.check(pg_temp.err(format('select public.game_share(%L, %L, false)', t, second_c)) = 'only the host can do this' or public.game_share(t, second_c, false) = pl,
    'a member who is not the host cannot publish the game (she is given the host''s post)');
  perform pg_temp.check(pg_temp.err(format('insert into public.community_posts (community_id, author_id, body, game_room_id) values (%L, %L, %L, %L)', girls_c, pg_temp.uid(2), 'x', t)) = 'only the host can do this',
    'a direct insert by someone else is refused: only the host shares a game');
  perform pg_temp.as_user(1);
  perform pg_temp.check(pg_temp.err(format('select public.game_share(%L, %L, false)', t, girls_c)) = 'this game cannot be shared in this community', 'a Mixte game is never shared in an IRLY Girl community');
  tr := public.ww_training('mixte', 8, null, 'beginner');
  perform pg_temp.check(pg_temp.err(format('select public.game_share(%L, %L, false)', tr, open_c)) = 'a game against AI players is not shared', 'a game against AI players is not shared');
  perform pg_temp.as_user(4);
  priv := (public.ww_create('mixte', 'public', 6) ->> 'id')::uuid;
  perform pg_temp.check(pg_temp.err(format('select public.game_share(%L, %L, false)', priv, open_c)) is not null, 'a host who is not a member of the community cannot share there (the posts'' own rule)');
  perform public.game_leave(priv);
  -- ───── Join from the post: the real room, live numbers ─────
  perform pg_temp.as_user(2);
  perform pg_temp.check(public.game_join_shared(p1) = t, 'Join on the post enters the shared room itself');
  card := public.game_share_cards(array[p1, pl]);
  perform pg_temp.check((card -> p1::text ->> 'players')::int = 2 and (card -> pl::text ->> 'players')::int = 2 and (card -> p1::text ->> 'mine')::boolean, 'both posts show the same new number of players (2/6)');
  -- ───── Blocks ─────
  perform pg_temp.as_admin();
  insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(5), pg_temp.uid(1));
  perform pg_temp.as_user(5);
  perform pg_temp.check(public.game_share_cards(array[p1]) = '{}'::jsonb and pg_temp.err(format('select public.game_join_shared(%L)', p1)) = 'this game no longer exists', 'a member who blocked the host sees no card and cannot join from the post');
  perform pg_temp.as_admin();
  delete from public.blocks where blocker_id = pg_temp.uid(5);
  -- ───── The last seat ─────
  for i in 3..5 loop
    perform pg_temp.as_user(i);
    perform public.game_join_shared(case when i = 4 then pl else p1 end);
  end loop;
  perform pg_temp.as_user(6);
  perform public.game_join(t);
  perform pg_temp.check((public.game_share_cards(array[p1]) -> p1::text ->> 'status') = 'full' and (public.game_share_cards(array[p1]) -> p1::text ->> 'players')::int = 6, 'six of six: the post says the game is full');
  perform pg_temp.as_user(7);
  perform pg_temp.check(pg_temp.err(format('select public.game_join_shared(%L)', p1)) = 'this game is full', 'a seventh member is refused: this game is full');
  -- ───── Started, then over: the posts follow ─────
  perform pg_temp.as_user(1);
  perform public.game_start(t);
  perform pg_temp.check((public.game_share_cards(array[pl]) -> pl::text ->> 'status') = 'playing', 'the game started: the post says in progress');
  perform pg_temp.check(pg_temp.err(format('select public.game_share(%L, %L, false)', t, girls_c)) is not null, 'a game that started is not shared any more');
  perform pg_temp.as_user(7);
  perform pg_temp.check(pg_temp.err(format('select public.game_join_shared(%L)', pl)) = 'this game has already started', 'nobody joins from a post once the game started');
  perform pg_temp.as_admin();
  update public.game_rooms set status = 'finished' where id = t;
  update public.game_participants set left_at = now() where room_id = t;
  perform pg_temp.as_user(7);
  perform pg_temp.check((public.game_share_cards(array[p1]) -> p1::text ->> 'status') = 'finished', 'the game is over: the post says finished');
  -- ───── A private game: the host's share stands for the code, for readers of the post only ─────
  perform pg_temp.as_user(1);
  priv := (public.ww_create('mixte', 'private', 6) ->> 'id')::uuid;
  pp := public.game_share(priv, open_c, false);
  perform pg_temp.as_user(3);
  perform pg_temp.check(pg_temp.err(format('select public.game_join(%L)', priv)) = 'this game is private: ask for its code', 'a private game is still closed to its bare id (a link is not enough)');
  perform pg_temp.check(public.game_join_shared(pp) = priv, 'a private game shared by its host is joined from the post');
  -- ───── A removed post, a cancelled game ─────
  perform pg_temp.as_user(1);
  update public.community_posts set deleted_at = now() where id = pp;
  perform pg_temp.as_user(7);
  perform pg_temp.check(public.game_share_cards(array[pp]) = '{}'::jsonb and pg_temp.err(format('select public.game_join_shared(%L)', pp)) = 'this game no longer exists', 'a removed post gives no card and no way in');
  perform pg_temp.as_user(1);
  pp := public.game_share(priv, open_c, false);
  perform pg_temp.as_admin();
  update public.game_rooms set status = 'abandoned' where id = priv;
  perform pg_temp.as_user(7);
  perform pg_temp.check((public.game_share_cards(array[pp]) -> pp::text ->> 'status') = 'cancelled', 'the host left before the start: the post says cancelled');
  perform pg_temp.as_admin();
end $$;

select pg_temp.check(not has_function_privilege('anon', 'public.game_share(uuid, uuid, boolean)', 'execute') and not has_function_privilege('anon', 'public.game_share_cards(uuid[])', 'execute')
  and not has_function_privilege('anon', 'public.game_join_shared(uuid)', 'execute'), 'signed-out visitors can call none of the sharing functions');

-- ───── Chat by day against AI players (20261118000100): a message is accepted, and an AI player named in it answers ─────
do $$
declare tr uuid; ai_name text; n integer;
begin
  perform pg_temp.as_user(8);
  tr := public.ww_training('mixte', 8, 'villager', 'beginner');
  perform pg_temp.as_admin();
  update private.ww_games set phase = 'day', day = 1, deadline = now() + interval '1 hour' where room_id = tr;
  select name into ai_name from private.ww_players where room_id = tr and bot and alive order by seat limit 1;
  perform pg_temp.as_user(8);
  perform pg_temp.check(pg_temp.err(format('select public.ww_say(%L, %L, %L)', tr, 'bonjour le village', 'all')) is null, 'against AI players, a message written by day is accepted');
  perform pg_temp.check(pg_temp.err(format('select public.ww_say(%L, %L, %L)', tr, ai_name || ', tu mens ?', 'all')) is null, 'naming an AI player in the chat is accepted');
  perform pg_temp.as_admin();
  select count(*) into n from public.game_messages where room_id = tr and kind = 'bot' and (data ->> 'target')::int = (select seat from private.ww_players where room_id = tr and user_id = pg_temp.uid(8));
  perform pg_temp.check(n >= 1 and (select count(*) = 2 from public.game_messages where room_id = tr and user_id = pg_temp.uid(8)), 'the AI player named answers; both messages are stored');
end $$;
