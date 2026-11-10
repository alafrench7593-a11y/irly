-- IRLY Loup-Garou: writing in the chat by day in a game against AI players.
--
-- ww_say (20261112000000) failed there with « column reference "bot" is ambiguous »: the loop that lets an AI
-- player named in the chat answer used a variable called bot beside the column bot of ww_players. Every message
-- written by day in a training game was refused. Online and in-person games never reached that loop.
-- Same function, the variable renamed and the columns qualified. Nothing else changes.

create or replace function public.ww_say(p_room uuid, p_body text, p_channel text default 'all') returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  g private.ww_games;
  p private.ww_players;
  b text := btrim(coalesce(p_body, ''));
  ai private.ww_players;
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
    for ai in select w.* from private.ww_players w where w.room_id = p_room and w.bot and w.alive
        and b ~* ('(^|[^[:alnum:]])' || regexp_replace(w.name, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '($|[^[:alnum:]])') limit 2 loop
      update private.ww_players set memory = jsonb_set(memory, array['accused_by', p.seat::text],
        to_jsonb(coalesce((memory -> 'accused_by' ->> p.seat::text)::numeric, 0) + 1), true)
      where room_id = p_room and seat = ai.seat;
      perform private.ww_bot_say(p_room, ai.seat, (array['why_me', 'defend', 'calm'])[1 + floor(private.ww_rand() * 3)::integer],
        jsonb_build_object('target', p.seat), 'all', 3);
    end loop;
  end if;
end $$;
revoke all on function public.ww_say(uuid, text, text) from public, anon;
grant execute on function public.ww_say(uuid, text, text) to authenticated;
