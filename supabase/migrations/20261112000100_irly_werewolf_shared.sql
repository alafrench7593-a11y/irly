-- IRLY Loup-Garou, step A: the shared game functions know Loup-Garou
-- (20261112000000_irly_werewolf). Same functions as 20261111000000_irly_games,
-- with a Loup-Garou branch each; Ludo is unchanged. Training tables are never
-- counted, listed or offered to others. Idempotent.

create or replace function public.game_create(p_game text, p_space text, p_visibility text default 'public', p_max integer default 4,
                                              p_title text default null, p_lang text default 'en') returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  c text;
begin
  -- Loup-Garou: its own table (6 to 20 players, online, unranked).
  if p_game = 'werewolf' then return public.ww_create(p_space, p_visibility, coalesce(p_max, 8), 'online', null, p_title, p_lang); end if;
  if p_game is distinct from 'ludo' then raise exception 'unknown game' using errcode = '22023'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'public or private' using errcode = '22023'; end if;
  if p_max is null or p_max not between 2 and 4 then raise exception 'Ludo: 2 to 4 players' using errcode = '22023'; end if;
  if p_lang not in ('en', 'fr') then raise exception 'language: en or fr' using errcode = '22023'; end if;
  -- One open room at a time per host (no flooding the list).
  if (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.user_id = me and gp.left_at is null
      where r.status in ('waiting', 'playing')) >= 3 then
    raise exception 'you are already in three games' using errcode = '22023';
  end if;
  c := case when p_visibility = 'private' then private.game_new_code() end;
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players)
    values ('ludo', sp, me, nullif(btrim(coalesce(p_title, '')), ''), p_visibility, c, p_lang, p_max)
    returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  return jsonb_build_object('id', rid, 'code', c);
end $$;
revoke all on function public.game_create(text, text, text, integer, text, text) from public, anon;
grant execute on function public.game_create(text, text, text, integer, text, text) to authenticated;

create or replace function public.game_quickplay(p_game text, p_space text) returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  r record;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  for r in
    select g.id from public.game_rooms g
    where g.game = p_game and g.space = sp and g.visibility = 'public' and g.status = 'waiting' and g.kind = 'online'
      and (select count(*) from public.game_participants gp where gp.room_id = g.id and gp.left_at is null) < g.max_players
      and not exists (select 1 from private.game_kicks k where k.room_id = g.id and k.user_id = me)
      and not exists (select 1 from public.game_participants gp where gp.room_id = g.id and gp.left_at is null and private.blocked_unchecked(me, gp.user_id))
    order by g.created_at
    limit 5
  loop
    begin
      return private.game_enter(r.id, me, false);
    exception when others then
      -- Taken meanwhile: try the next one.
    end;
  end loop;
  if p_game = 'werewolf' then return (public.ww_create(p_space, 'public', 8, 'online', null, null, 'fr') ->> 'id')::uuid; end if;
  return (public.game_create(p_game, p_space, 'public', 4, null, 'en') ->> 'id')::uuid;
end $$;
revoke all on function public.game_quickplay(text, text) from public, anon;
grant execute on function public.game_quickplay(text, text) to authenticated;

create or replace function public.game_start(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  r public.game_rooms;
  players jsonb;
  n integer;
  colors jsonb;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or r.host_id is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if r.status <> 'waiting' then raise exception 'this game has already started' using errcode = '22023'; end if;
  if r.game = 'werewolf' then
    perform private.ww_start(p_room);
    return;
  end if;
  select jsonb_agg(gp.user_id order by gp.seat), count(*) into players, n
    from public.game_participants gp where gp.room_id = p_room and gp.left_at is null;
  if n < 2 then raise exception 'two players are needed to start' using errcode = '22023'; end if;
  -- Two players sit opposite each other (red and yellow).
  colors := case n when 2 then '[0,2]' when 3 then '[0,1,2]' else '[0,1,2,3]' end::jsonb;
  update public.game_rooms set status = 'playing', started_at = now(), updated_at = now(),
    turn_deadline = now() + interval '30 seconds',
    state = jsonb_build_object(
      'players', players, 'colors', colors,
      'tokens', (select jsonb_agg('[-1,-1,-1,-1]'::jsonb) from generate_series(1, n)),
      'turn', 0, 'die', null, 'sixes', 0,
      'idle', (select jsonb_agg(0) from generate_series(1, n)),
      'out', (select jsonb_agg(false) from generate_series(1, n)),
      'last', null)
    where id = p_room;
  perform private.game_system(p_room, 'start');
end $$;
revoke all on function public.game_start(uuid) from public, anon;
grant execute on function public.game_start(uuid) to authenticated;

create or replace function public.game_tick(p_room uuid) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
begin
  if not private.game_is_player(p_room, auth.uid()) then return false; end if;
  if (select game from public.game_rooms where id = p_room) = 'werewolf' then return private.ww_advance(p_room); end if;
  return private.game_advance(p_room);
end $$;
revoke all on function public.game_tick(uuid) from public, anon;
grant execute on function public.game_tick(uuid) to authenticated;

create or replace function public.game_leave(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  r public.game_rooms;
  idx integer;
  next_host uuid;
begin
  select * into r from public.game_rooms where id = p_room for update;
  if not found or not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
    return;
  end if;
  update public.game_participants set left_at = now() where room_id = p_room and user_id = me;
  perform private.game_system(p_room, 'left', jsonb_build_object('user', me));
  if r.status = 'waiting' then
    select gp.user_id into next_host from public.game_participants gp where gp.room_id = p_room and gp.left_at is null order by gp.joined_at limit 1;
    if next_host is null then
      update public.game_rooms set status = 'abandoned', finished_at = now(), updated_at = now() where id = p_room;
    elsif r.host_id = me then
      update public.game_rooms set host_id = next_host, updated_at = now() where id = p_room;
    else
      update public.game_rooms set updated_at = now() where id = p_room;
    end if;
  elsif r.status = 'playing' and r.game = 'werewolf' then
    -- Leaving a running Loup-Garou game: out of the game (no card shown), lovers follow.
    select seat into idx from private.ww_players where room_id = p_room and user_id = me and alive;
    if idx is not null then
      perform private.ww_kill(p_room, array[idx], 'left', 'left');
      perform private.ww_log_add(p_room, 'all', 'left_game', jsonb_build_object('seat', idx));
      if not private.ww_check_victory(p_room) then perform private.ww_touch(p_room); end if;
    end if;
  elsif r.status = 'playing' and r.game = 'ludo' then
    select (i.idx - 1)::integer into idx from jsonb_array_elements_text(r.state -> 'players') with ordinality i(uid, idx) where i.uid::uuid = me;
    if idx is not null then perform private.ludo_drop(p_room, idx); end if;
  end if;
end $$;
revoke all on function public.game_leave(uuid) from public, anon;
grant execute on function public.game_leave(uuid) to authenticated;

create or replace function public.game_say(p_room uuid, p_body text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  b text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from public.game_participants gp where gp.room_id = p_room and gp.user_id = me and gp.left_at is null) then
    raise exception 'you are not playing in this game' using errcode = '42501';
  end if;
  -- Loup-Garou's chat follows the night, the pack and the dead: ww_say.
  if (select game from public.game_rooms where id = p_room) = 'werewolf' then
    perform public.ww_say(p_room, p_body, 'all');
    return;
  end if;
  if char_length(b) not between 1 and 300 then raise exception 'write 1 to 300 characters' using errcode = '22023'; end if;
  if (select count(*) from public.game_messages m where m.room_id = p_room and m.user_id = me and m.created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'slow down a little' using errcode = '22023';
  end if;
  insert into public.game_messages (room_id, user_id, body) values (p_room, me, b);
end $$;
revoke all on function public.game_say(uuid, text) from public, anon;
grant execute on function public.game_say(uuid, text) to authenticated;

create or replace function public.games_overview(p_space text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  sp text := private.game_scope(p_space);
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  return jsonb_build_object(
    'online', (select count(*) from public.game_presence p where p.space = sp and p.seen_at > now() - interval '90 seconds'),
    'games', (
    select jsonb_agg(jsonb_build_object(
      'game', g.game,
      'in_game', (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.left_at is null
                  where r.game = g.game and r.space = sp and r.status = 'playing' and r.kind <> 'training'),
      'waiting', (select count(*) from public.game_rooms r where r.game = g.game and r.space = sp and r.visibility = 'public' and r.status = 'waiting' and r.kind <> 'training'),
      'playing', (select count(*) from public.game_rooms r where r.game = g.game and r.space = sp and r.status = 'playing' and r.kind <> 'training'),
      'open_seats', (select coalesce(sum(r.max_players - (select count(*) from public.game_participants gp where gp.room_id = r.id and gp.left_at is null)), 0)
                     from public.game_rooms r where r.game = g.game and r.space = sp and r.visibility = 'public' and r.status = 'waiting' and r.kind <> 'training')
    ) order by g.ord)
    from (values ('ludo', 1), ('werewolf', 2)) g(game, ord))
  );
end $$;
revoke all on function public.games_overview(text) from public, anon;
grant execute on function public.games_overview(text) to authenticated;

create or replace function public.game_rooms_open(p_game text, p_space text) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  sp text := private.game_scope(p_space);
  me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x.card order by x.mine desc, x.waiting desc, x.created_at desc)
    from (
      select private.game_room_card(r, me) as card, r.created_at, (r.status = 'waiting') as waiting,
        exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = me and gp.left_at is null) as mine
      from public.game_rooms r
      where r.game = p_game and r.space = sp and r.status in ('waiting', 'playing') and r.kind <> 'training'
        and (exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = me and gp.left_at is null)
          or (r.visibility = 'public'
            -- A host who blocked me, or whom I blocked: the room is not offered.
            and (r.host_id is null or not private.blocked_unchecked(me, r.host_id))))
      order by 4 desc, 3 desc, 2 desc
      limit 40
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.game_rooms_open(text, text) from public, anon;
grant execute on function public.game_rooms_open(text, text) to authenticated;

create or replace function private.games_sweep() returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare r record;
begin
  for r in select id from public.game_rooms where status = 'playing' and turn_deadline < now() limit 200 loop
    perform private.game_advance(r.id);
  end loop;
  -- Loup-Garou: phases whose time is up move on even when nobody has the game open.
  for r in select w.room_id as id from private.ww_games w where w.phase not in ('lobby', 'ended') and w.deadline < now() limit 200 loop
    perform private.ww_advance(r.id);
  end loop;
  -- A waiting room left two hours without anyone, or a game without a move for an hour.
  update public.game_rooms set status = 'abandoned', finished_at = now(), turn_deadline = null, updated_at = now()
    where (status = 'waiting' and updated_at < now() - interval '2 hours')
       or (status = 'playing' and updated_at < now() - interval '1 hour');
  delete from public.game_presence where seen_at < now() - interval '1 day';
end $$;
revoke all on function private.games_sweep() from public, anon, authenticated;

-- Room cards say the kind of table (online, training, in person) and when it last changed.
create or replace function private.game_room_card(r public.game_rooms, p_me uuid) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select jsonb_build_object(
    'id', r.id, 'game', r.game, 'kind', r.kind, 'updated_at', r.updated_at, 'title', r.title, 'visibility', r.visibility, 'lang', r.lang,
    'max', r.max_players, 'status', r.status, 'created_at', r.created_at,
    'host', private.game_first_name(r.host_id), 'host_id', r.host_id,
    'players', (select count(*) from public.game_participants gp where gp.room_id = r.id and gp.left_at is null),
    'mine', exists (select 1 from public.game_participants gp where gp.room_id = r.id and gp.user_id = p_me and gp.left_at is null)
  )
$$;
revoke all on function private.game_room_card(public.game_rooms, uuid) from public, anon, authenticated;
