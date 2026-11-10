-- IRLY Loup-Garou V3 engine: what each card may do, and the night of the V3 modes in the book's order
-- (V3 §3: blocks, swaps and copies, protections, investigations, the pack, the Sorcière, hostile actions,
-- attacks, deferred effects, solo objectives, collective victories). Rules: docs/LOUP-GAROU-V3.md.
-- Classic, Dubaï and « all powers » games keep their own resolvers, unchanged.

-- ───────── Small helpers ─────────
/** The card whose night power a seat wields tonight: its own, or one lent by the Échangeur / copied by the Caméléon. */
create or replace function private.ww_acting(p_room uuid, p_seat integer) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select coalesce(
    (select jsonb_build_object('card', b ->> 'card', 'owner', (b ->> 'owner')::integer, 'copy', coalesce((b ->> 'copy')::boolean, false), 'borrowed', true)
       from private.ww_games g, lateral (select g.effects -> 'borrow' -> p_seat::text as b) x
       where g.room_id = p_room and b is not null and (b ->> 'night')::integer = g.night),
    (select jsonb_build_object('card', p.card, 'owner', p.seat, 'copy', false, 'borrowed', false)
       from private.ww_players p where p.room_id = p_room and p.seat = p_seat))
$$;

/** The charges behind that power: the lent card's own (they follow the card), fresh ones for a copy (one night). */
create or replace function private.ww_acting_charges(p_room uuid, p_seat integer) returns jsonb
language sql stable security definer set search_path = public, private as $$
  select case
    when (a ->> 'copy')::boolean then private.ww_fresh_charges(a ->> 'card')
    else (select p.charges from private.ww_players p where p.room_id = p_room and p.seat = (a ->> 'owner')::integer
      and (not (a ->> 'borrowed')::boolean or p.card = a ->> 'card')) end
  from (select private.ww_acting(p_room, p_seat) a) x
$$;

/** Uses a charge of the power a seat wields: on the card it belongs to (nothing for a one-night copy). */
create or replace function private.ww_spend(p_room uuid, p_seat integer, p_key text, p_delta integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare a jsonb := private.ww_acting(p_room, p_seat);
begin
  if (a ->> 'copy')::boolean then return; end if;
  update private.ww_players set charges = jsonb_set(charges, array[p_key], to_jsonb(greatest(0, coalesce((charges ->> p_key)::integer, 0) + p_delta)))
    where room_id = p_room and seat = (a ->> 'owner')::integer;
end $$;

/** A personal victory, for good (V3 §7): attached to the player, told once. */
create or replace function private.ww_solo_win(p_room uuid, p_seat integer, p_why text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
begin
  if coalesce((select (memory ->> 'solo_won')::boolean from private.ww_players where room_id = p_room and seat = p_seat), false) then return; end if;
  update private.ww_players set memory = jsonb_set(memory, '{solo_won}', 'true') where room_id = p_room and seat = p_seat;
  perform private.ww_log_add(p_room, 'seat:' || p_seat, 'solo_won', jsonb_build_object('why', p_why));
end $$;

/** One more step of a card's own objective (only its holder's, never through a lent or copied power). Returns the new count. */
create or replace function private.ww_progress(p_room uuid, p_seat integer, p_card text) returns integer
language plpgsql volatile security definer set search_path = public, private as $$
declare n integer;
begin
  update private.ww_players set charges = jsonb_set(charges, '{progress}', to_jsonb(coalesce((charges ->> 'progress')::integer, 0) + 1))
    where room_id = p_room and seat = p_seat and card = p_card returning (charges ->> 'progress')::integer into n;
  return coalesce(n, 0);
end $$;

/** How many wolves an objective asks for: two, or one in a game dealt with a single wolf (V3 §8, « adaptation aux petites parties »). */
create or replace function private.ww_goal_wolves(p_room uuid) returns integer
language sql stable security definer set search_path = public, private as $$
  select least(2, greatest(1, (select coalesce(sum((value::text)::integer), 0)::integer from private.ww_games g, jsonb_each(g.composition)
    where g.room_id = p_room and private.ww_camp(key) = 'wolves')))
$$;

/** What an investigation of roles sees of a seat tonight: null when hidden (Ninja), a borrowed face (Métamorphe), a lie (Usurpateur). */
create or replace function private.ww_seen_card(p_room uuid, p_target integer, p_ns jsonb) returns text
language sql stable security definer set search_path = public, private as $$
  select case
    when coalesce(p_ns -> 'hidden', '[]'::jsonb) @> to_jsonb(p_target) then null
    when p_ns -> 'fake' ? p_target::text then p_ns -> 'fake' ->> p_target::text
    when coalesce(p_ns -> 'forged', '[]'::jsonb) @> to_jsonb(p_target) then case when p.camp = 'wolves' then 'villager' else 'werewolf' end
    else p.card end
  from private.ww_players p where p.room_id = p_room and p.seat = p_target
$$;

/** What an investigation of camps sees: wolf or not; null when hidden. The Agent double shows as Village (V3 §8). */
create or replace function private.ww_seen_wolf(p_room uuid, p_target integer, p_ns jsonb) returns boolean
language sql stable security definer set search_path = public, private as $$
  select case
    when coalesce(p_ns -> 'hidden', '[]'::jsonb) @> to_jsonb(p_target) then null
    when coalesce(p_ns -> 'forged', '[]'::jsonb) @> to_jsonb(p_target) then p.camp <> 'wolves'
    when p_ns -> 'fake' ? p_target::text then private.ww_camp(p_ns -> 'fake' ->> p_target::text) = 'wolves'
    when p.card = 'double_agent' then false
    else p.camp = 'wolves' end
  from private.ww_players p where p.room_id = p_room and p.seat = p_target
$$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_acting(uuid, integer)', 'private.ww_acting_charges(uuid, integer)', 'private.ww_spend(uuid, integer, text, integer)',
    'private.ww_solo_win(uuid, integer, text)', 'private.ww_progress(uuid, integer, text)', 'private.ww_goal_wolves(uuid)',
    'private.ww_seen_card(uuid, integer, jsonb)', 'private.ww_seen_wolf(uuid, integer, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────── What each player may do now (every card of every mode) ─────────
create or replace function private.ww_options(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  p private.ww_players;
  alive_others integer[];
  alive_all integer[];
  dead_all integer[];
  out_ jsonb := '[]'::jsonb;
  seduced jsonb;
  ac text;
  ch jsonb;
  own boolean;
  declared text[];
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into p from private.ww_players where room_id = p_room and seat = p_seat;
  if not found or g.phase in ('lobby', 'ended') then return out_; end if;
  select coalesce(array_agg(seat order by seat) filter (where alive), '{}'), coalesce(array_agg(seat order by seat) filter (where not alive), '{}')
    into alive_all, dead_all from private.ww_players where room_id = p_room;
  alive_others := array_remove(alive_all, p_seat);
  if not p.alive then return out_; end if;
  -- The power wielded tonight: one's own card, or a lent / copied one (V3 modes).
  ac := p.card;
  ch := p.charges;
  own := true;
  if g.phase in ('night', 'witch') and g.effects -> 'borrow' ? p_seat::text and (g.effects -> 'borrow' -> p_seat::text ->> 'night')::integer = g.night then
    ac := private.ww_acting(p_room, p_seat) ->> 'card';
    ch := coalesce(private.ww_acting_charges(p_room, p_seat), '{}'::jsonb);
    own := false;
  end if;
  if g.phase = 'night' then
    if p_seat = any (private.ww_pack(p_room, g.night)) then
      out_ := out_ || jsonb_build_object('kind', 'wolf', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_all) s
        where (select camp from private.ww_players q where q.room_id = p_room and q.seat = s) <> 'wolves'));
    end if;
    if ac = 'seer' then out_ := out_ || jsonb_build_object('kind', 'seer', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'salvateur' then
      out_ := out_ || jsonb_build_object('kind', 'protect', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where s is distinct from (ch ->> 'last')::integer));
    end if;
    if ac = 'hunter' and (ch ->> 'shot')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'shoot', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'little_girl' and (ch ->> 'hint')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'hint', 'targets', '[]'::jsonb); end if;
    if ac = 'cupid' and own and g.night = 1 and (ch ->> 'link')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'link', 'targets', to_jsonb(alive_all)); end if;
    if ac = 'thief' and own and g.night = 1 and (ch ->> 'steal')::integer > 0 and jsonb_array_length(g.extras) = 2 then
      out_ := out_ || jsonb_build_object('kind', 'steal', 'targets', '[0, 1, -1]'::jsonb, 'cards', (select jsonb_agg(e -> 'role') from jsonb_array_elements(g.extras) e));
    end if;
    -- Dubaï, by night.
    if ac in ('entrepreneur', 'ecommerce') and (ch ->> 'shield')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'shield', 'targets', to_jsonb(alive_others));
    end if;
    if ac = 'golden_visa' and (ch ->> 'visa')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'visa', 'targets', jsonb_build_array(p_seat)); end if;
    if ac = 'tourist' and (ch ->> 'stay')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'stay', 'targets', '[]'::jsonb); end if;
    if ac = 'fake_millionaire' and (ch ->> 'bluff')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'bluff', 'targets', '[]'::jsonb); end if;
    if ac in ('investor', 'emirati', 'networker') and (ch ->> 'probe')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'probe', 'targets', to_jsonb(alive_others));
    end if;
    if ac = 'realtor' and (ch ->> 'listing')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'listing', 'targets', to_jsonb(alive_all)); end if;
    if ac = 'creator' and (ch ->> 'story')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'story', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'concierge' then
      out_ := out_ || jsonb_build_object('kind', 'watch', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where s is distinct from (ch ->> 'last')::integer));
    end if;
    if ac = 'single' and g.night = 1 and (ch ->> 'crush')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'crush', 'targets', to_jsonb(alive_others));
    end if;
    if ac = 'charo' then
      seduced := coalesce(p.memory -> 'seduced', '[]'::jsonb);
      out_ := out_ || jsonb_build_object('kind', 'seduce', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where not seduced @> to_jsonb(s) and s is distinct from (ch ->> 'last')::integer));
    end if;
    -- Chaos.
    if ac = 'scammer' and own and (ch ->> 'scam')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'scam', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'swapper' and own and (ch ->> 'exchange')::integer > 0 and cardinality(alive_others) >= 2 then
      out_ := out_ || jsonb_build_object('kind', 'exchange', 'targets', to_jsonb(alive_others));
    end if;
    if ac = 'gambler' and (ch ->> 'gamble')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'gamble', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'saboteur' and (ch ->> 'sabotage')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'sabotage', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'chameleon' and own and (ch ->> 'copy')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'copy', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'shapeshifter' and (ch ->> 'disguise')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'disguise', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'ninja' and (ch ->> 'hide')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'hide', 'targets', '[]'::jsonb); end if;
    -- Nightmare.
    if ac = 'exorcist' and (ch ->> 'exorcise')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'exorcise', 'targets', to_jsonb(alive_all)); end if;
    if ac = 'reaper' and (ch ->> 'mark')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'mark', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'spider' and (ch ->> 'web')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'web', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'vampire' and own and jsonb_array_length(coalesce(ch -> 'servants', '[]'::jsonb)) < 2 then
      out_ := out_ || jsonb_build_object('kind', 'bite', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where not coalesce(ch -> 'servants', '[]'::jsonb) @> to_jsonb(s)));
    end if;
    if ac = 'gravedigger' and cardinality(dead_all) > 0 then out_ := out_ || jsonb_build_object('kind', 'dig', 'targets', to_jsonb(dead_all)); end if;
    if ac = 'sleepwalker' then out_ := out_ || jsonb_build_object('kind', 'visit', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'dark_oracle' and (ch ->> 'omen')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'omen', 'targets', to_jsonb(alive_others)); end if;
    -- Manipulation.
    if ac = 'hacker' then out_ := out_ || jsonb_build_object('kind', 'hack', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'usurper' and (ch ->> 'forge')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'forge', 'targets', to_jsonb(alive_all)); end if;
    if ac = 'spy' and (ch ->> 'spy')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'spy', 'targets', to_jsonb(alive_others)); end if;
    -- Hybrids.
    if ac = 'bounty_hunter' and (ch ->> 'bounty')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'bounty', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'detective' then out_ := out_ || jsonb_build_object('kind', 'detect', 'targets', to_jsonb(alive_others)); end if;
    if ac = 'prophet' then
      out_ := out_ || jsonb_build_object('kind', 'predict_wolf', 'targets', to_jsonb(alive_others))
        || jsonb_build_object('kind', 'predict_village', 'targets', to_jsonb(alive_others));
    end if;
    if ac = 'guardian' then out_ := out_ || jsonb_build_object('kind', 'guard', 'targets', to_jsonb(alive_others)); end if;
  elsif g.phase = 'witch' and ac = 'witch' and not coalesce(g.night_state -> 'blocked', '[]'::jsonb) @> to_jsonb(p_seat) then
    if (ch ->> 'life')::integer > 0 and g.night_state ->> 'wolves' is not null and (g.night_state ->> 'wolves')::integer <> p_seat then
      out_ := out_ || jsonb_build_object('kind', 'heal', 'targets', jsonb_build_array((g.night_state ->> 'wolves')::integer));
    end if;
    if (ch ->> 'death')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'poison', 'targets', to_jsonb(alive_others)); end if;
  elsif g.phase in ('day', 'vote', 'revote') then
    select coalesce(array_agg(a.kind), '{}') into declared from private.ww_actions a
      where a.room_id = p_room and a.phase = 'power' and a.round = g.day and a.seat = p_seat;
    if g.phase = 'day' then
      out_ := out_ || jsonb_build_object('kind', 'ready', 'targets', '[]'::jsonb);
    -- No vote for a player silenced today (the Manipulateur) or under the Oracle noir's curse.
    elsif exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'mute' and x.target = p_seat)
        or (p.memory ->> 'cursed_day')::integer = g.day then
      null;
    elsif g.phase = 'vote' then
      out_ := out_ || jsonb_build_object('kind', 'vote', 'targets', to_jsonb(alive_others));
    else
      out_ := out_ || jsonb_build_object('kind', 'vote', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(g.revote) s where s <> p_seat and s = any (alive_all)));
    end if;
    -- Dubaï, by day (before the votes close; the CEO before the vote opens).
    if p.card = 'influencer' and (p.charges ->> 'buzz')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'buzz', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'ceo' and g.phase = 'day' and (p.charges ->> 'board')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'board', 'targets', '[]'::jsonb); end if;
    if p.card = 'newcomer' and (p.charges ->> 'fresh')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'fresh', 'targets', '[]'::jsonb); end if;
    if p.card = 'broker' and (p.charges ->> 'dump')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'dump', 'targets', to_jsonb(alive_others)); end if;
    -- Manipulation, by day: declared before the count, each once in the game.
    if p.card = 'manipulator' and (p.charges ->> 'mute')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'mute', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'corrupt' and (p.charges ->> 'bribe')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'bribe', 'targets', '[]'::jsonb); end if;
    if p.card = 'lawyer' and (p.charges ->> 'plead')::integer > 0 and not ('plead' = any (declared)) then
      out_ := out_ || jsonb_build_object('kind', 'plead', 'targets', to_jsonb(alive_all));
    end if;
    if p.card = 'dictator' and (p.charges ->> 'decree')::integer > 0 and not ('decree' = any (declared)) then
      out_ := out_ || jsonb_build_object('kind', 'decree', 'targets', '[]'::jsonb);
    end if;
  end if;
  return out_;
end $$;
revoke all on function private.ww_options(uuid, integer) from public, anon, authenticated;

create or replace function private.ww_submit(p_room uuid, p_seat integer, p_kind text, p_target integer, p_target2 integer) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  opts jsonb;
  opt jsonb;
  round_ integer;
  no_target constant text[] := array['ready', 'hint', 'board', 'fresh', 'stay', 'bluff', 'hide', 'bribe', 'decree'];
  two_targets constant text[] := array['link', 'exchange'];
begin
  select * into g from private.ww_games where room_id = p_room;
  opts := private.ww_options(p_room, p_seat);
  if p_kind = 'pass' then
    if jsonb_array_length(opts) = 0 then raise exception 'nothing to do now' using errcode = '22023'; end if;
  else
    select o into opt from jsonb_array_elements(opts) o where o ->> 'kind' = p_kind;
    if opt is null then raise exception 'you cannot do that now' using errcode = '22023'; end if;
    -- Every power aimed at someone needs a valid target (an empty list means no one is left to aim at).
    if not (p_kind = any (no_target)) and not (p_kind = any (two_targets))
        and (p_target is null or not (opt -> 'targets') @> to_jsonb(p_target)) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    if p_kind = any (two_targets) and (p_target is null or p_target2 is null or p_target = p_target2
        or not (opt -> 'targets') @> to_jsonb(p_target) or not (opt -> 'targets') @> to_jsonb(p_target2)) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    if p_kind in ('heal', 'poison') then
      delete from private.ww_actions where room_id = p_room and phase = 'witch' and round = g.night and seat = p_seat and kind in ('heal', 'poison', 'pass');
    end if;
    -- The Prophète says one thing about one player.
    if p_kind in ('predict_wolf', 'predict_village') then
      delete from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and seat = p_seat and kind in ('predict_wolf', 'predict_village');
    end if;
  end if;
  -- A power used by day is final at once (docs/LOUP-GAROU-DUBAI.md D2). Its charge goes now, except the Avocat's and the
  -- Dictateur's, used only if they come into play at the count; what is public is told, the rest stays with its player.
  if p_kind = any (private.ww_day_powers()) then
    insert into private.ww_actions (room_id, phase, round, seat, kind, target, target2)
      values (p_room, 'power', g.day, p_seat, p_kind, case when p_kind in ('board', 'fresh', 'bribe', 'decree') then p_seat else p_target end, null);
    if p_kind not in ('plead', 'decree') then
      update private.ww_players set charges = jsonb_set(charges, array[p_kind], '0') where room_id = p_room and seat = p_seat;
    end if;
    if p_kind = 'board' then perform private.ww_log_add(p_room, 'all', 'vote_doubled', jsonb_build_object('seat', p_seat, 'day', g.day, 'ceo', true));
    elsif p_kind = 'buzz' then perform private.ww_log_add(p_room, 'all', 'vote_doubled', jsonb_build_object('seat', p_target, 'day', g.day));
    elsif p_kind = 'fresh' then perform private.ww_log_add(p_room, 'all', 'immune', jsonb_build_object('seat', p_seat, 'day', g.day));
    elsif p_kind = 'dump' then perform private.ww_log_add(p_room, 'seat:' || p_seat, 'dumped', jsonb_build_object('seat', p_target, 'day', g.day));
    elsif p_kind = 'mute' then
      perform private.ww_log_add(p_room, 'seat:' || p_seat, 'muted', jsonb_build_object('seat', p_target, 'day', g.day));
      perform private.ww_log_add(p_room, 'seat:' || p_target, 'silenced', jsonb_build_object('day', g.day));
      -- A vote she had already cast today does not count.
      delete from private.ww_actions where room_id = p_room and phase in ('vote', 'revote') and round = g.day and seat = p_target;
    elsif p_kind = 'bribe' then perform private.ww_log_add(p_room, 'seat:' || p_seat, 'bribed', jsonb_build_object('day', g.day));
    elsif p_kind = 'plead' then perform private.ww_log_add(p_room, 'seat:' || p_seat, 'pleading', jsonb_build_object('seat', p_target, 'day', g.day));
    else perform private.ww_log_add(p_room, 'seat:' || p_seat, 'decree_ready', jsonb_build_object('day', g.day));
    end if;
    return;
  end if;
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  if p_kind = 'pass' then
    delete from private.ww_actions where room_id = p_room and phase = g.phase and round = round_ and seat = p_seat;
  else
    delete from private.ww_actions where room_id = p_room and phase = g.phase and round = round_ and seat = p_seat and kind = 'pass';
  end if;
  insert into private.ww_actions (room_id, phase, round, seat, kind, target, target2)
    values (p_room, g.phase, round_, p_seat, p_kind, p_target, p_target2)
    on conflict (room_id, phase, round, seat, kind) do update set target = excluded.target, target2 = excluded.target2, at = now();
end $$;
revoke all on function private.ww_submit(uuid, integer, text, integer, integer) from public, anon, authenticated;

-- ───────── Deaths with consequences, the Possédé's prey, the opening of a night ─────────
/** What a death sets off (V3 phase 9.10): the Revenant comes back at the next night, the Anomalie triggers an event. */
create or replace function private.ww_on_death(p_room uuid, p_dead integer[], p_night boolean) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  d private.ww_players;
  ev text;
begin
  select * into g from private.ww_games where room_id = p_room;
  if not private.ww_is_v3(g.mode) then return; end if;
  for d in select * from private.ww_players where room_id = p_room and seat = any (p_dead) order by seat loop
    if d.card = 'revenant' and p_night and (d.charges ->> 'revive')::integer > 0 then
      update private.ww_players set charges = jsonb_set(charges, '{revive}', '0') where room_id = p_room and seat = d.seat;
      update private.ww_games set effects = jsonb_set(effects, '{revivals}', coalesce(effects -> 'revivals', '[]'::jsonb)
        || jsonb_build_object('seat', d.seat, 'night', g.night + 1)) where room_id = p_room;
    end if;
    if d.card = 'anomaly' then
      -- Brouillard: no investigation gives a result next night. Couvre-feu: the pack does not attack next night.
      ev := case when private.ww_rand() < 0.5 then 'fog' else 'curfew' end;
      update private.ww_games set effects = jsonb_set(effects, array[ev], to_jsonb(g.night + 1)) where room_id = p_room;
      perform private.ww_log_add(p_room, 'all', 'anomaly_event', jsonb_build_object('seat', d.seat, 'event', ev, 'night', g.night + 1));
    end if;
  end loop;
end $$;

/** The Possédé's designated target: drawn by the server, known to him only, drawn again if it dies another way. */
create or replace function private.ww_upkeep(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  po private.ww_players;
  t integer;
begin
  for po in select * from private.ww_players where room_id = p_room and alive and card = 'possessed' loop
    if po.charges ->> 'prey' is null or not exists (select 1 from private.ww_players where room_id = p_room and seat = (po.charges ->> 'prey')::integer and alive) then
      select seat into t from private.ww_players where room_id = p_room and alive and seat <> po.seat order by md5(p_room::text || ':prey:' || seat || ':' || coalesce(po.charges ->> 'prey', '')) limit 1;
      if t is not null then
        update private.ww_players set charges = jsonb_set(charges, '{prey}', to_jsonb(t)) where room_id = p_room and seat = po.seat;
        perform private.ww_log_add(p_room, 'seat:' || po.seat, 'prey', jsonb_build_object('seat', t));
      end if;
    end if;
  end loop;
  -- A Vampire alive with two servants alive has won, for good; his servants with him.
  -- (An objective already reached does not follow the card to a new holder: V3 §7.)
  for po in select * from private.ww_players v where v.room_id = p_room and v.alive and v.card = 'vampire' and not coalesce((v.charges ->> 'done')::boolean, false)
      and (select count(*) from private.ww_players s where s.room_id = p_room and s.alive and v.charges -> 'servants' @> to_jsonb(s.seat)) >= 2 loop
    update private.ww_players set charges = jsonb_set(charges, '{done}', 'true') where room_id = p_room and seat = po.seat;
    perform private.ww_solo_win(p_room, po.seat, 'vampire');
    for t in select (x::text)::integer from jsonb_array_elements(po.charges -> 'servants') x loop
      perform private.ww_solo_win(p_room, t, 'servant');
    end loop;
  end loop;
end $$;

/**
 * V3 phase 0, then the night: the Revenants due come back, the Faucheur's marks due strike (an attack of one
 * player on another: a Miroir sends it back), their consequences, a check of the victories; then the night opens.
 */
create or replace function private.ww_to_night(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  next_ integer;
  e jsonb;
  revived integer[] := '{}';
  victims integer[] := '{}';
  dead integer[];
  v integer;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  if not private.ww_is_v3(g.mode) then
    perform private.ww_enter(p_room, 'night');
    return;
  end if;
  next_ := g.night + 1;
  for e in select * from jsonb_array_elements(coalesce(g.effects -> 'revivals', '[]'::jsonb)) loop
    if (e ->> 'night')::integer <= next_ and exists (select 1 from private.ww_players where room_id = p_room and seat = (e ->> 'seat')::integer and not alive) then
      update private.ww_players set alive = true, death = null, died_at = null where room_id = p_room and seat = (e ->> 'seat')::integer;
      revived := revived || (e ->> 'seat')::integer;
    end if;
  end loop;
  for e in select * from jsonb_array_elements(coalesce(g.effects -> 'marks', '[]'::jsonb)) loop
    if (e ->> 'night')::integer <= next_ then
      v := (e ->> 'seat')::integer;
      if exists (select 1 from private.ww_players where room_id = p_room and seat = v and alive and card = 'mirror' and (charges ->> 'mirror')::integer > 0) then
        update private.ww_players set charges = jsonb_set(charges, '{mirror}', '0') where room_id = p_room and seat = v;
        perform private.ww_log_add(p_room, 'seat:' || v, 'mirror_reflected', jsonb_build_object('night', next_));
        v := (e ->> 'by')::integer;
      end if;
      if exists (select 1 from private.ww_players where room_id = p_room and seat = v and alive) and not (v = any (victims)) then victims := victims || v; end if;
    end if;
  end loop;
  update private.ww_games set effects = effects
    || jsonb_build_object('revivals', coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(effects -> 'revivals', '[]'::jsonb)) x where (x ->> 'night')::integer > next_), '[]'::jsonb))
    || jsonb_build_object('marks', coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(effects -> 'marks', '[]'::jsonb)) x where (x ->> 'night')::integer > next_), '[]'::jsonb))
    where room_id = p_room;
  dead := private.ww_kill(p_room, victims, 'reaper', 'night ' || next_);
  if cardinality(dead) > 0 or cardinality(revived) > 0 then
    perform private.ww_log_add(p_room, 'all', 'opening', jsonb_build_object('night', next_, 'dead', to_jsonb(dead), 'revived', to_jsonb(revived)));
    perform private.ww_on_death(p_room, dead, true);
    perform private.ww_upkeep(p_room);
    if private.ww_check_victory(p_room) then return; end if;
  end if;
  perform private.ww_enter(p_room, 'night');
end $$;

create or replace function private.ww_enter(p_room uuid, p_phase text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare g private.ww_games;
begin
  select * into g from private.ww_games where room_id = p_room;
  update private.ww_games set phase = p_phase,
    night = case when p_phase = 'night' then night + 1 else night end,
    day = case when p_phase = 'day' then day + 1 else day end,
    night_state = case when p_phase = 'night' then '{}'::jsonb else night_state end,
    deadline = now() + make_interval(secs => private.ww_duration(g.kind, p_phase))
  where room_id = p_room;
  perform private.ww_log_add(p_room, 'all', 'phase', jsonb_build_object('phase', p_phase,
    'night', (select night from private.ww_games where room_id = p_room), 'day', (select day from private.ww_games where room_id = p_room)));
  if private.ww_is_v3(g.mode) then perform private.ww_upkeep(p_room); end if;
  perform private.ww_bots_act(p_room);
  perform private.ww_touch(p_room);
end $$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_on_death(uuid, integer[], boolean)', 'private.ww_upkeep(uuid)', 'private.ww_to_night(uuid)', 'private.ww_enter(uuid, text)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────── The night of the V3 modes ─────────
create or replace function private.ww_resolve_night_v3(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  a record;
  p private.ww_players;
  q private.ww_players;
  ns jsonb := '{}'::jsonb;
  blocked integer[] := '{}';
  prot integer[] := '{}';
  guards jsonb := '{}'::jsonb;
  hidden integer[] := '{}';
  forged integer[] := '{}';
  fake jsonb := '{}'::jsonb;
  swapped integer[] := '{}';
  borrow jsonb;
  fog boolean;
  curfew boolean;
  outcome text;
  pack integer[];
  tops integer[];
  target integer;
  wolf_seat integer;
  others integer[];
  hint integer[];
  seen text;
  wolfish boolean;
  c1 text;
  c2 text;
  n integer;
  removed integer;
  marks jsonb;
  gamble_looks jsonb := '[]'::jsonb;
  bounties jsonb := '[]'::jsonb;
  visits jsonb := '[]'::jsonb;
  pap record;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  fog := coalesce((g.effects ->> 'fog')::integer = g.night, false);
  curfew := coalesce((g.effects ->> 'curfew')::integer = g.night, false);
  borrow := coalesce(g.effects -> 'borrow', '{}'::jsonb);
  marks := coalesce(g.effects -> 'marks', '[]'::jsonb);

  -- Phase 2: blocks. The Saboteur first, then the Araignée; a blocked blocker blocks nobody. A blocked action
  -- is not played and keeps its charge (V3 phase 2).
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('sabotage', 'web')
      order by (kind = 'web'), at, seat loop
    if a.seat = any (blocked) then continue; end if;
    blocked := blocked || a.target;
    perform private.ww_spend(p_room, a.seat, a.kind, -1);
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'block_done', jsonb_build_object('seat', a.target, 'night', g.night));
  end loop;
  -- The Joueur de hasard: the server draws a protection, a block or an investigation on his target.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'gamble' order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    outcome := (array['protect', 'block', 'look'])[1 + floor(private.ww_rand() * 3)::integer];
    perform private.ww_spend(p_room, a.seat, 'gamble', -1);
    if outcome = 'block' then blocked := blocked || a.target;
    elsif outcome = 'protect' then prot := prot || a.target;
    else gamble_looks := gamble_looks || jsonb_build_object('by', a.seat, 'target', a.target);
    end if;
    if outcome <> 'look' then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'gamble_result', jsonb_build_object('seat', a.target, 'outcome', outcome));
    end if;
  end loop;
  for n in select distinct unnest(blocked) loop
    perform private.ww_log_add(p_room, 'seat:' || n, 'power_blocked', jsonb_build_object('night', g.night));
  end loop;

  -- Phase 3: the Scameur's permanent swap (V3 §4). A card is swapped once a night at most: the first validated wins,
  -- the other is cancelled and keeps its charge.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'scam' order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    select * into p from private.ww_players where room_id = p_room and seat = a.seat;
    select * into q from private.ww_players where room_id = p_room and seat = a.target;
    if p.card <> 'scammer' or not q.alive or a.seat = any (swapped) or a.target = any (swapped) then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'scam_cancelled', jsonb_build_object('seat', a.target));
      continue;
    end if;
    -- The cards change hands with their charges (the swap's own is spent) and their unfinished objectives, whose
    -- personal progress starts again (V3 §7). Lovers, memories and victories already won stay with the players.
    update private.ww_players set card = q.card,
      charges = case when q.charges ? 'progress' then jsonb_set(q.charges, '{progress}', '0') - 'found' || case when q.charges ? 'found' then '{"found": []}'::jsonb else '{}'::jsonb end else q.charges end,
      camp = q.camp, wolf_since = case when q.camp = 'wolves' then g.night + 1 end
      where room_id = p_room and seat = a.seat;
    update private.ww_players set card = 'scammer', charges = jsonb_set(p.charges, '{scam}', '0'), camp = p.camp, wolf_since = case when p.camp = 'wolves' then g.night + 1 end
      where room_id = p_room and seat = a.target;
    -- What both had planned for tonight with their old cards is void; nothing new is played before the next window.
    delete from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and seat in (a.seat, a.target) and kind <> 'pass';
    swapped := swapped || a.seat || a.target;
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'scam_done', jsonb_build_object('seat', a.target, 'card', q.card));
    perform private.ww_log_add(p_room, 'seat:' || a.target, 'scam_victim', jsonb_build_object('card', 'scammer'));
  end loop;
  -- The Échangeur: two players' active powers change hands for the next night. The Caméléon: one power copied for the next night.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('exchange', 'copy') order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    select card into c1 from private.ww_players where room_id = p_room and seat = a.target and alive;
    if a.kind = 'exchange' then
      select card into c2 from private.ww_players where room_id = p_room and seat = a.target2 and alive;
      if c1 = any (private.ww_active_cards()) and c2 = any (private.ww_active_cards()) and c1 <> c2
          and not borrow ? a.target::text and not borrow ? a.target2::text then
        borrow := borrow || jsonb_build_object(a.target::text, jsonb_build_object('card', c2, 'owner', a.target2, 'night', g.night + 1))
          || jsonb_build_object(a.target2::text, jsonb_build_object('card', c1, 'owner', a.target, 'night', g.night + 1));
        perform private.ww_spend(p_room, a.seat, 'exchange', -1);
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'exchange_done', jsonb_build_object('a', a.target, 'b', a.target2));
        perform private.ww_log_add(p_room, 'seat:' || a.target, 'power_lent', jsonb_build_object('card', c2, 'night', g.night + 1));
        perform private.ww_log_add(p_room, 'seat:' || a.target2, 'power_lent', jsonb_build_object('card', c1, 'night', g.night + 1));
      else
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'exchange_failed', jsonb_build_object('a', a.target, 'b', a.target2));
      end if;
    elsif c1 = any (private.ww_active_cards()) and not borrow ? a.seat::text then
      borrow := borrow || jsonb_build_object(a.seat::text, jsonb_build_object('card', c1, 'owner', a.target, 'night', g.night + 1, 'copy', true));
      perform private.ww_spend(p_room, a.seat, 'copy', -1);
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'copy_done', jsonb_build_object('seat', a.target, 'card', c1, 'night', g.night + 1));
    else
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'copy_failed', jsonb_build_object('seat', a.target));
    end if;
  end loop;
  -- Loans of nights past are forgotten.
  borrow := coalesce((select jsonb_object_agg(key, value) from jsonb_each(borrow) where (value ->> 'night')::integer > g.night), '{}'::jsonb);

  -- Cupidon (night 1): the link is between players, whatever happens to the cards (V3 §6).
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'link' loop
    if a.seat = any (blocked) then continue; end if;
    update private.ww_players set lover = a.target2 where room_id = p_room and seat = a.target;
    update private.ww_players set lover = a.target where room_id = p_room and seat = a.target2;
    update private.ww_players x set lover_opposed = (select count(distinct camp) from private.ww_players r where r.room_id = p_room and r.seat in (a.target, a.target2)) = 2
      where x.room_id = p_room and x.seat in (a.target, a.target2);
    update private.ww_players set charges = jsonb_set(charges, '{link}', '0') where room_id = p_room and seat = a.seat;
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'linked', jsonb_build_object('a', a.target, 'b', a.target2));
    perform private.ww_log_add(p_room, 'seat:' || a.target, 'lover', jsonb_build_object('seat', a.target2));
    perform private.ww_log_add(p_room, 'seat:' || a.target2, 'lover', jsonb_build_object('seat', a.target));
  end loop;

  -- Phase 4: protections, set before the attacks. Salvateur (not the same player two nights running), Gardien.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('protect', 'guard') order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    prot := prot || a.target;
    if a.kind = 'guard' then guards := guards || jsonb_build_object(a.target::text, a.seat);
    else update private.ww_players set charges = jsonb_set(charges, '{last}', to_jsonb(a.target)) where room_id = p_room and seat = a.seat and card = 'salvateur';
    end if;
  end loop;
  update private.ww_players set charges = jsonb_set(charges, '{last}', 'null') where room_id = p_room and card = 'salvateur'
    and not exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = ww_players.seat and x.kind = 'protect');
  -- Phase 5: falsifications first (Métamorphe, Ninja, Usurpateur), then the investigations, on the cards as they are
  -- after the swaps. In the Brouillard nothing is seen, and nothing is spent.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('disguise', 'hide', 'forge') order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    if a.kind = 'disguise' then fake := fake || jsonb_build_object(a.seat::text, (select card from private.ww_players where room_id = p_room and seat = a.target));
    elsif a.kind = 'hide' then hidden := hidden || a.seat;
    else forged := forged || a.target;
    end if;
    perform private.ww_spend(p_room, a.seat, a.kind, -1);
  end loop;
  ns := jsonb_build_object('blocked', to_jsonb(blocked), 'hidden', to_jsonb(hidden), 'forged', to_jsonb(forged), 'fake', fake);
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night
      and kind in ('seer', 'detect', 'predict_wolf', 'predict_village', 'omen', 'dig', 'hack', 'spy', 'hint') order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    if fog then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'fog_blind', jsonb_build_object('night', g.night));
      continue;
    end if;
    if a.kind = 'seer' then
      seen := private.ww_seen_card(p_room, a.target, ns);
      if seen is not null then
        update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'seer', 'night', g.night, 'seat', a.target, 'card', seen))
          where room_id = p_room and seat = a.seat;
      end if;
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'seer_saw', jsonb_build_object('seat', a.target, 'card', seen));
    elsif a.kind in ('detect', 'omen', 'predict_wolf', 'predict_village') then
      wolfish := private.ww_seen_wolf(p_room, a.target, ns);
      if wolfish is not null then
        update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'probe', 'night', g.night, 'seat', a.target, 'escroc', wolfish))
          where room_id = p_room and seat = a.seat;
      end if;
      if a.kind = 'detect' then
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'detect_result', jsonb_build_object('seat', a.target, 'wolf', wolfish));
        -- Objective: two different wolves identified (one in a game with a single wolf).
        if wolfish and exists (select 1 from private.ww_players where room_id = p_room and seat = a.seat and card = 'detective' and not charges -> 'found' @> to_jsonb(a.target)) then
          update private.ww_players set charges = jsonb_set(charges, '{found}', charges -> 'found' || to_jsonb(a.target)) where room_id = p_room and seat = a.seat;
          if private.ww_progress(p_room, a.seat, 'detective') >= private.ww_goal_wolves(p_room) then perform private.ww_solo_win(p_room, a.seat, 'detective'); end if;
        end if;
      elsif a.kind = 'omen' then
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'omen_result', jsonb_build_object('seat', a.target, 'camp',
          case when wolfish is null then null when wolfish then 'wolves'
            when (select camp from private.ww_players where room_id = p_room and seat = a.target) = 'solo' and not fake ? a.target::text then 'solo' else 'village' end));
        perform private.ww_spend(p_room, a.seat, 'omen', -1);
        -- After her second vision the Oracle noir is cursed for a day: no vote at the next scrutin.
        if exists (select 1 from private.ww_players where room_id = p_room and seat = a.seat and card = 'dark_oracle' and (charges ->> 'omen')::integer = 0) then
          update private.ww_players set memory = jsonb_set(memory, '{cursed_day}', to_jsonb(g.day + 1)) where room_id = p_room and seat = a.seat;
          perform private.ww_log_add(p_room, 'seat:' || a.seat, 'oracle_cursed', jsonb_build_object('day', g.day + 1));
        end if;
      else
        -- The Prophète: right when what he said is what an investigation of camps would see.
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'predict_result', jsonb_build_object('seat', a.target,
          'said', case when a.kind = 'predict_wolf' then 'wolves' else 'village' end, 'right', wolfish = (a.kind = 'predict_wolf')));
        if wolfish = (a.kind = 'predict_wolf') and private.ww_progress(p_room, a.seat, 'prophet') >= 3 then perform private.ww_solo_win(p_room, a.seat, 'prophet'); end if;
      end if;
    elsif a.kind = 'dig' then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'dig_result', jsonb_build_object('seat', a.target,
        'card', (select card from private.ww_players where room_id = p_room and seat = a.target and not alive)));
    elsif a.kind = 'hack' then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'hack_result', jsonb_build_object('seat', a.target,
        'acted', not (a.target = any (blocked)) and exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night
          and x.seat = a.target and x.kind not in ('pass', 'wolf'))));
    elsif a.kind = 'spy' then
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'spy_result', jsonb_build_object('seat', a.target,
        'target', (select x.target from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = a.target
          and x.kind <> 'pass' and x.target is not null and not (a.target = any (blocked)) order by (x.kind = 'wolf'), x.at limit 1)));
      perform private.ww_spend(p_room, a.seat, 'spy', -1);
    else
      -- Petite Fille: three seats, one of them a wolf.
      select seat into wolf_seat from private.ww_players where room_id = p_room and alive and camp = 'wolves' and seat <> a.seat order by gen_random_uuid() limit 1;
      if wolf_seat is not null then
        select coalesce(array_agg(seat), '{}') into others from (
          select seat from private.ww_players where room_id = p_room and alive and seat not in (a.seat, wolf_seat) order by gen_random_uuid() limit 2) x;
        select array_agg(s order by gen_random_uuid()) into hint from unnest(others || wolf_seat) s;
        perform private.ww_spend(p_room, a.seat, 'hint', -1);
        update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'hint', 'night', g.night, 'seats', to_jsonb(hint)))
          where room_id = p_room and seat = a.seat;
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'hint', jsonb_build_object('seats', to_jsonb(hint)));
      end if;
    end if;
  end loop;
  for a in select (x ->> 'by')::integer as seat, (x ->> 'target')::integer as target from jsonb_array_elements(gamble_looks) x loop
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'gamble_result', jsonb_build_object('seat', a.target, 'outcome', 'look',
      'card', case when fog then null else private.ww_seen_card(p_room, a.target, ns) end));
  end loop;
  -- The Paparazzi: one true thing about the night, each night: a player on whom a power was used (not which, not by whom).
  for p in select * from private.ww_players where room_id = p_room and alive and card = 'paparazzi' and not (seat = any (blocked)) loop
    select x.target into pap from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat <> p.seat
      and x.kind not in ('pass', 'wolf') and x.target is not null and not (x.seat = any (blocked)) order by md5(p_room::text || g.night || x.seat::text) limit 1;
    perform private.ww_log_add(p_room, 'seat:' || p.seat, 'paparazzi_result', jsonb_build_object('night', g.night,
      'target', case when fog then null else pap.target end));
  end loop;

  -- Phase 6: the pack's victim (most votes; ties: the server's fixed pick; no vote, or the Couvre-feu: no attack).
  -- Only the wolves who were in the pack before tonight, and are still wolves, vote (V3 §4).
  pack := private.ww_pack(p_room, g.night);
  select coalesce(array_agg(t), '{}') into tops from (
    select a2.target as t, count(*) c, max(count(*)) over () m
    from private.ww_actions a2
    where a2.room_id = p_room and a2.phase = 'night' and a2.round = g.night and a2.kind = 'wolf' and a2.seat = any (pack) and not (a2.seat = any (blocked))
      and exists (select 1 from private.ww_players x where x.room_id = p_room and x.seat = a2.target and x.alive and x.camp <> 'wolves')
    group by a2.target) v where c = m;
  target := case when cardinality(tops) > 0 and not curfew then private.ww_pick(p_room, 'wolves:' || g.night, tops) end;
  if target is not null then
    ns := ns || jsonb_build_object('wolves', target);
    perform private.ww_log_add(p_room, 'wolves', 'pack_target', jsonb_build_object('seat', target, 'night', g.night));
  end if;

  -- Phase 8: other hostile actions, locked now and played even if their author dies tonight.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('shoot', 'bounty', 'bite', 'mark', 'visit') order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    if a.kind = 'shoot' then
      ns := ns || jsonb_build_object('shot', jsonb_build_object('by', a.seat, 'target', a.target));
      perform private.ww_spend(p_room, a.seat, 'shot', -1);
    elsif a.kind = 'bounty' then
      bounties := bounties || jsonb_build_object('by', a.seat, 'target', a.target);
      perform private.ww_spend(p_room, a.seat, 'bounty', -1);
    elsif a.kind = 'bite' then
      ns := ns || jsonb_build_object('bite', jsonb_build_object('by', a.seat, 'target', a.target));
    elsif a.kind = 'mark' then
      -- Phase 10: the Faucheur's mark strikes at the opening of the next night.
      marks := marks || jsonb_build_object('seat', a.target, 'by', a.seat, 'night', g.night + 1);
      perform private.ww_spend(p_room, a.seat, 'mark', -1);
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'marked', jsonb_build_object('seat', a.target, 'night', g.night + 1));
    else
      visits := visits || jsonb_build_object('by', a.seat, 'target', a.target);
    end if;
  end loop;

  -- The Exorciste lifts what weighs on a player, before any attack is played: a Faucheur's mark (tonight's too),
  -- the Maudit's curse, the Oracle noir's, a Vampire's hold.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'exorcise' order by at, seat loop
    if a.seat = any (blocked) then continue; end if;
    removed := (select count(*) from jsonb_array_elements(marks) m where (m ->> 'seat')::integer = a.target);
    marks := coalesce((select jsonb_agg(m) from jsonb_array_elements(marks) m where (m ->> 'seat')::integer <> a.target), '[]'::jsonb);
    select * into q from private.ww_players where room_id = p_room and seat = a.target;
    if q.card = 'cursed' and q.camp = 'village' and (q.charges ->> 'curse')::integer > 0 then
      update private.ww_players set charges = jsonb_set(charges, '{curse}', '0') where room_id = p_room and seat = a.target;
      removed := removed + 1;
    end if;
    if q.memory ->> 'cursed_day' is not null then
      update private.ww_players set memory = memory - 'cursed_day' where room_id = p_room and seat = a.target;
      removed := removed + 1;
    end if;
    if q.memory ->> 'master' is not null then
      update private.ww_players set camp = private.ww_camp(card), memory = memory - 'master' where room_id = p_room and seat = a.target;
      update private.ww_players v set charges = jsonb_set(v.charges, '{servants}', coalesce((select jsonb_agg(s) from jsonb_array_elements(v.charges -> 'servants') s where s <> to_jsonb(a.target)), '[]'::jsonb))
        where v.room_id = p_room and v.card = 'vampire';
      perform private.ww_log_add(p_room, 'seat:' || a.target, 'freed', '{}');
      removed := removed + 1;
    end if;
    perform private.ww_spend(p_room, a.seat, 'exorcise', -1);
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'exorcise_result', jsonb_build_object('seat', a.target, 'removed', removed > 0));
  end loop;

  ns := ns || jsonb_build_object('prot', to_jsonb(prot), 'guards', guards, 'bounties', bounties, 'visits', visits);
  update private.ww_games set night_state = ns, effects = effects || jsonb_build_object('borrow', borrow, 'marks', marks) where room_id = p_room;
  -- Phase 7: the Sorcière (or whoever wields her power tonight), if she can still act; else the attacks now.
  if exists (select 1 from private.ww_players x where x.room_id = p_room and x.alive and not (x.seat = any (blocked))
      and private.ww_acting(p_room, x.seat) ->> 'card' = 'witch'
      and ((private.ww_acting_charges(p_room, x.seat) ->> 'life')::integer > 0 or (private.ww_acting_charges(p_room, x.seat) ->> 'death')::integer > 0)) then
    perform private.ww_enter(p_room, 'witch');
  else
    perform private.ww_resolve_attacks_v3(p_room);
  end if;
end $$;

create or replace function private.ww_resolve_witch_v3(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  a record;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  for a in select * from private.ww_actions where room_id = p_room and phase = 'witch' and round = g.night and kind in ('heal', 'poison') loop
    if a.kind = 'heal' then
      g.night_state := g.night_state || '{"healed": true}';
      perform private.ww_spend(p_room, a.seat, 'life', -1);
    else
      g.night_state := g.night_state || jsonb_build_object('poisoned', a.target, 'poisoner', a.seat);
      perform private.ww_spend(p_room, a.seat, 'death', -1);
    end if;
  end loop;
  update private.ww_games set night_state = g.night_state where room_id = p_room;
  perform private.ww_resolve_attacks_v3(p_room);
end $$;

/**
 * V3 phase 9: each attack is its own event, played in a fixed order (the pack, the potion, the Chasseur, the
 * Chasseur de primes). For each: redirection (the Miroir, attacks of one player only, never the Chasseur),
 * immunity (the Ancien), protection, conversion (the Maudit), then the deaths, what they set off, the lovers.
 */
create or replace function private.ww_resolve_attacks_v3(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  ns jsonb;
  attacks jsonb := '[]'::jsonb;
  atk jsonb;
  i integer := 0;
  v integer;
  by_ integer;
  src text;
  victims integer[] := '{}';
  attacked integer[] := '{}';
  killers jsonb := '{}'::jsonb;
  dead integer[];
  b jsonb;
  t private.ww_players;
  saved jsonb := '{}'::jsonb;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  ns := g.night_state;
  if ns ->> 'wolves' is not null and not coalesce((ns ->> 'healed')::boolean, false) then
    attacks := attacks || jsonb_build_object('victim', (ns ->> 'wolves')::integer, 'source', 'wolves');
  elsif ns ->> 'wolves' is not null then
    attacked := attacked || (ns ->> 'wolves')::integer;
  end if;
  if ns ->> 'poisoned' is not null then
    attacks := attacks || jsonb_build_object('victim', (ns ->> 'poisoned')::integer, 'source', 'poison', 'by', (ns ->> 'poisoner')::integer);
  end if;
  if ns -> 'shot' is not null then
    by_ := (ns -> 'shot' ->> 'by')::integer;
    v := (ns -> 'shot' ->> 'target')::integer;
    -- The target's camp after the night's swaps and before tonight's conversions are known: the Maudit turned
    -- tonight is checked below, once the pack's attack is played (V3 §5).
    attacks := attacks || jsonb_build_object('victim', v, 'source', 'hunter', 'by', by_);
  end if;
  for b in select * from jsonb_array_elements(coalesce(ns -> 'bounties', '[]'::jsonb)) loop
    attacks := attacks || jsonb_build_object('victim', (b ->> 'target')::integer, 'source', 'bounty', 'by', (b ->> 'by')::integer);
  end loop;

  while i < jsonb_array_length(attacks) loop
    atk := attacks -> i;
    i := i + 1;
    v := (atk ->> 'victim')::integer;
    src := atk ->> 'source';
    by_ := (atk ->> 'by')::integer;
    -- A shot is aimed at a camp: a wolf is hit; anyone else, the Chasseur's own shot comes back on him, the
    -- Chasseur de primes' is lost (docs: défaut H1).
    if src in ('hunter', 'bounty') then
      if (select camp from private.ww_players where room_id = p_room and seat = v) = 'wolves' then
        perform private.ww_log_add(p_room, 'seat:' || by_, 'shot_hit', jsonb_build_object('seat', v));
      else
        perform private.ww_log_add(p_room, 'seat:' || by_, 'shot_missed', jsonb_build_object('seat', v));
        if src = 'bounty' then continue; end if;
        v := by_;
        src := 'hunter_miss';
      end if;
    end if;
    attacked := attacked || v;
    select * into t from private.ww_players where room_id = p_room and seat = v;
    if not t.alive or v = any (victims) then continue; end if;
    -- Redirection: the Miroir sends back an attack of one player (potion, bounty), once. Never the Chasseur's.
    if src in ('poison', 'bounty') and t.card = 'mirror' and (t.charges ->> 'mirror')::integer > 0 then
      update private.ww_players set charges = jsonb_set(charges, '{mirror}', '0') where room_id = p_room and seat = v;
      perform private.ww_log_add(p_room, 'seat:' || v, 'mirror_reflected', jsonb_build_object('night', g.night));
      attacks := attacks || jsonb_build_object('victim', by_, 'source', 'reflected', 'by', v);
      continue;
    end if;
    -- Immunity: the Ancien survives the pack's first attack.
    if src = 'wolves' and t.card = 'elder' and (t.charges ->> 'life')::integer > 0 then
      update private.ww_players set charges = jsonb_set(charges, '{life}', '0') where room_id = p_room and seat = v;
      perform private.ww_log_add(p_room, 'seat:' || v, 'elder_resisted', '{}');
      continue;
    end if;
    -- Protection: stops every attack of the night on that player; the Gardien counts the attacks he stopped.
    if coalesce(ns -> 'prot', '[]'::jsonb) @> to_jsonb(v) then
      if ns -> 'guards' ? v::text then
        saved := saved || jsonb_build_object(ns -> 'guards' ->> v::text, coalesce((saved ->> (ns -> 'guards' ->> v::text))::integer, 0) + 1);
      end if;
      continue;
    end if;
    -- Conversion: the Maudit becomes a wolf when the pack's attack should kill him, the first time.
    if src = 'wolves' and t.card = 'cursed' and t.camp = 'village' and (t.charges ->> 'curse')::integer > 0 then
      update private.ww_players set camp = 'wolves', wolf_since = g.night + 1, charges = jsonb_set(charges, '{curse}', '0') where room_id = p_room and seat = v;
      perform private.ww_log_add(p_room, 'seat:' || v, 'cursed_turned', jsonb_build_object('night', g.night));
      continue;
    end if;
    victims := victims || v;
    if src = 'bounty' then killers := killers || jsonb_build_object(v::text, by_); end if;
  end loop;

  -- The Vampire's bite: a servant if the target is of the Village, alive at dawn and unprotected. Two at most.
  if ns -> 'bite' is not null then
    by_ := (ns -> 'bite' ->> 'by')::integer;
    v := (ns -> 'bite' ->> 'target')::integer;
    select * into t from private.ww_players where room_id = p_room and seat = v;
    if t.alive and not (v = any (victims)) and t.camp = 'village' and not coalesce(ns -> 'prot', '[]'::jsonb) @> to_jsonb(v)
        and exists (select 1 from private.ww_players where room_id = p_room and seat = by_ and card = 'vampire' and jsonb_array_length(charges -> 'servants') < 2) then
      update private.ww_players set camp = 'solo', memory = jsonb_set(memory, '{master}', to_jsonb(by_)) where room_id = p_room and seat = v;
      update private.ww_players set charges = jsonb_set(charges, '{servants}', charges -> 'servants' || to_jsonb(v)) where room_id = p_room and seat = by_;
      perform private.ww_log_add(p_room, 'seat:' || by_, 'bite_done', jsonb_build_object('seat', v));
      perform private.ww_log_add(p_room, 'seat:' || v, 'bitten', jsonb_build_object('seat', by_));
    else
      if coalesce(ns -> 'prot', '[]'::jsonb) @> to_jsonb(v) and ns -> 'guards' ? v::text then
        saved := saved || jsonb_build_object(ns -> 'guards' ->> v::text, coalesce((saved ->> (ns -> 'guards' ->> v::text))::integer, 0));
      end if;
      perform private.ww_log_add(p_room, 'seat:' || by_, 'bite_failed', jsonb_build_object('seat', v));
    end if;
  end if;

  dead := private.ww_kill(p_room, victims, 'night', 'night ' || g.night);
  -- Objectives (phase 11). The Chasseur de primes: two wolves killed by his own shots.
  for b in select jsonb_build_object('victim', key::integer, 'by', (value::text)::integer) from jsonb_each(killers) loop
    if (b ->> 'victim')::integer = any (dead) and private.ww_progress(p_room, (b ->> 'by')::integer, 'bounty_hunter') >= 2 then
      perform private.ww_solo_win(p_room, (b ->> 'by')::integer, 'bounty_hunter');
    end if;
  end loop;
  -- The Gardien: two mortal attacks stopped.
  for b in select jsonb_build_object('seat', key::integer, 'n', (value::text)::integer) from jsonb_each(saved) loop
    for i in 1 .. (b ->> 'n')::integer loop
      if private.ww_progress(p_room, (b ->> 'seat')::integer, 'guardian') >= 2 then perform private.ww_solo_win(p_room, (b ->> 'seat')::integer, 'guardian'); end if;
    end loop;
    if (b ->> 'n')::integer > 0 then
      perform private.ww_log_add(p_room, 'seat:' || (b ->> 'seat'), 'guard_saved', jsonb_build_object('night', g.night));
    end if;
  end loop;
  -- The Somnambule: was the player he visited the target of an attack tonight?
  for b in select * from jsonb_array_elements(coalesce(ns -> 'visits', '[]'::jsonb)) loop
    perform private.ww_log_add(p_room, 'seat:' || (b ->> 'by'), 'visit_result', jsonb_build_object('seat', (b ->> 'target')::integer,
      'attacked', (b ->> 'target')::integer = any (attacked)));
  end loop;
  perform private.ww_on_death(p_room, dead, true);
  perform private.ww_upkeep(p_room);
  perform private.ww_log_add(p_room, 'all', 'morning', jsonb_build_object('night', g.night, 'dead', to_jsonb(dead)));
  if private.ww_check_victory(p_room) then return; end if;
  perform private.ww_enter(p_room, 'day');
end $$;

-- ───────── The vote of the V3 modes (V3 §10) ─────────
create or replace function private.ww_resolve_vote_v3(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  tops integer[];
  ballots jsonb;
  counts jsonb;
  dead integer[];
  out_ integer;
  lw integer;
  dc integer;
  j private.ww_players;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  -- Electors, restrictions (a silenced or cursed player has no ballot), reinforced votes (the Corrompu's counts double).
  select coalesce(jsonb_object_agg(a.seat::text, a.target), '{}') into ballots
    from private.ww_actions a join private.ww_players p on p.room_id = a.room_id and p.seat = a.seat and p.alive
    where a.room_id = p_room and a.phase = g.phase and a.round = g.day and a.kind = 'vote'
      and not exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'mute' and x.target = a.seat)
      and (p.memory ->> 'cursed_day')::integer is distinct from g.day;
  select coalesce(jsonb_object_agg(t::text, w), '{}') into counts from (
    select (b.value::text)::integer t, sum(
      case when exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'bribe' and x.seat = b.key::integer) then 2 else 1 end) w
    from jsonb_each(ballots) b group by 1) x;
  select coalesce(array_agg(t order by t), '{}') into tops from (
    select key::integer t, (value::text)::integer c, max((value::text)::integer) over () m from jsonb_each(counts)) x where c = m;
  perform private.ww_log_add(p_room, 'all', 'votes', jsonb_build_object('day', g.day, 'round', g.phase, 'ballots', ballots, 'counts', counts));
  if cardinality(tops) > 1 and g.phase = 'vote' then
    update private.ww_games set revote = tops where room_id = p_room;
    perform private.ww_log_add(p_room, 'all', 'tie', jsonb_build_object('seats', to_jsonb(tops)));
    perform private.ww_enter(p_room, 'revote');
    return;
  end if;
  if cardinality(tops) = 1 then
    out_ := tops[1];
    -- The Avocat: the elimination of the player he pleads for is cancelled, once. A cancelled elimination sets off nothing.
    select a.seat into lw from private.ww_actions a join private.ww_players p on p.room_id = a.room_id and p.seat = a.seat and p.alive and p.card = 'lawyer' and (p.charges ->> 'plead')::integer > 0
      where a.room_id = p_room and a.phase = 'power' and a.round = g.day and a.kind = 'plead' and a.target = out_ order by a.at limit 1;
    if lw is not null then
      update private.ww_players set charges = jsonb_set(charges, '{plead}', '0') where room_id = p_room and seat = lw;
      perform private.ww_log_add(p_room, 'all', 'lawyer_saved', jsonb_build_object('seat', out_, 'day', g.day));
      perform private.ww_to_night(p_room);
      return;
    end if;
    dead := private.ww_kill(p_room, tops, 'vote', 'day ' || g.day);
    perform private.ww_log_add(p_room, 'all', 'voted_out', jsonb_build_object('seat', out_, 'dead', to_jsonb(dead)));
    -- Objectives: the Clown voted out; the Possédé whose prey is voted out; the Justicier who voted against a wolf voted out.
    if exists (select 1 from private.ww_players where room_id = p_room and seat = out_ and card = 'clown') then perform private.ww_solo_win(p_room, out_, 'clown'); end if;
    for j in select * from private.ww_players where room_id = p_room and card = 'possessed' and (charges ->> 'prey')::integer = out_ and (alive or seat = any (dead)) and seat <> out_ loop
      perform private.ww_solo_win(p_room, j.seat, 'possessed');
    end loop;
    if (select camp from private.ww_players where room_id = p_room and seat = out_) = 'wolves' then
      for j in select * from private.ww_players where room_id = p_room and card = 'vigilante' and (ballots ->> seat::text)::integer = out_ loop
        if private.ww_progress(p_room, j.seat, 'vigilante') >= private.ww_goal_wolves(p_room) then perform private.ww_solo_win(p_room, j.seat, 'vigilante'); end if;
      end loop;
    end if;
    perform private.ww_on_death(p_room, dead, false);
    perform private.ww_upkeep(p_room);
    if private.ww_check_victory(p_room) then return; end if;
    perform private.ww_to_night(p_room);
    return;
  end if;
  -- No elimination (a second tie, or no ballot). The Dictateur who declared today calls one more scrutin, once.
  perform private.ww_log_add(p_room, 'all', 'no_elimination', jsonb_build_object('day', g.day));
  select a.seat into dc from private.ww_actions a join private.ww_players p on p.room_id = a.room_id and p.seat = a.seat and p.alive and p.card = 'dictator' and (p.charges ->> 'decree')::integer > 0
    where a.room_id = p_room and a.phase = 'power' and a.round = g.day and a.kind = 'decree' order by a.at limit 1;
  if dc is not null then
    update private.ww_players set charges = jsonb_set(charges, '{decree}', '0') where room_id = p_room and seat = dc;
    delete from private.ww_actions where room_id = p_room and phase in ('vote', 'revote') and round = g.day;
    update private.ww_games set revote = null where room_id = p_room;
    perform private.ww_log_add(p_room, 'all', 'decree', jsonb_build_object('day', g.day));
    perform private.ww_enter(p_room, 'vote');
    return;
  end if;
  perform private.ww_to_night(p_room);
end $$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_resolve_night_v3(uuid)', 'private.ww_resolve_witch_v3(uuid)', 'private.ww_resolve_attacks_v3(uuid)', 'private.ww_resolve_vote_v3(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

create or replace function private.ww_advance(p_room uuid, p_force boolean default false) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  moved boolean := false;
  v3 boolean;
begin
  for i in 1..40 loop
    select * into g from private.ww_games where room_id = p_room for update skip locked;
    if not found or g.phase in ('lobby', 'ended') then exit; end if;
    if not (p_force or g.deadline <= now()
        or (private.ww_phase_done(p_room)
          and clock_timestamp() >= g.deadline - make_interval(secs => private.ww_duration(g.kind, g.phase) - private.ww_min_seconds(g.kind)))) then
      exit;
    end if;
    p_force := false;
    v3 := private.ww_is_v3(g.mode);
    if g.phase = 'night' and g.mode = 'dubai' then perform private.ww_resolve_night_dubai(p_room);
    elsif g.phase = 'night' and v3 then perform private.ww_resolve_night_v3(p_room);
    elsif g.phase = 'night' then perform private.ww_resolve_night(p_room);
    elsif g.phase = 'witch' and v3 then perform private.ww_resolve_witch_v3(p_room);
    elsif g.phase = 'witch' then perform private.ww_resolve_witch(p_room);
    elsif g.phase = 'day' then perform private.ww_enter(p_room, 'vote');
    elsif v3 then perform private.ww_resolve_vote_v3(p_room);
    else perform private.ww_resolve_vote(p_room);
    end if;
    moved := true;
  end loop;
  return moved;
end $$;
revoke all on function private.ww_advance(uuid, boolean) from public, anon, authenticated;

-- ───────── Victory: the hybrids' double victory; what each player sees of her own state ─────────
create or replace function private.ww_check_victory(p_room uuid) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  alive_n integer;
  wolves_n integer;
  lovers_alive integer;
  opposed boolean;
  winner text;
  winners integer[];
  solo integer[];
  double_ integer[];
begin
  select * into g from private.ww_games where room_id = p_room;
  select count(*), count(*) filter (where camp = 'wolves') into alive_n, wolves_n from private.ww_players where room_id = p_room and alive;
  select count(*) filter (where alive), bool_or(lover_opposed) into lovers_alive, opposed from private.ww_players where room_id = p_room and lover is not null;
  if alive_n = 0 then
    winner := 'draw';
  elsif coalesce(opposed, false) and lovers_alive = 2 and alive_n = 2 then
    winner := 'lovers';
  -- No wolf left, and none on the way (a Revenant due back is of the Village: nothing to wait for): the Village.
  elsif wolves_n = 0 then
    winner := 'village';
  elsif wolves_n >= alive_n - wolves_n then
    winner := 'wolves';
  else
    return false;
  end if;
  select coalesce(array_agg(seat order by seat), '{}') into winners from private.ww_players
  where room_id = p_room and case winner
    when 'lovers' then lover is not null
    when 'village' then camp = 'village' and not lover_opposed
    when 'wolves' then camp = 'wolves' and not lover_opposed
    else false end;
  -- A personal victory already won stays won, whatever happened since (V3 §7); the Faux Millionnaire wins alive at the end.
  select coalesce(array_agg(seat order by seat), '{}') into solo from private.ww_players
  where room_id = p_room and (coalesce((memory ->> 'solo_won')::boolean, false)
    or (card = 'fake_millionaire' and alive and winner <> 'draw'));
  -- Double victory: one's camp and one's own objective (the Networker; the hybrids of the V3).
  select coalesce(array_agg(seat order by seat), '{}') into double_ from private.ww_players
  where room_id = p_room and seat = any (winners)
    and ((card = 'networker' and alive and coalesce((memory ->> 'networked')::boolean, false))
      or (coalesce((memory ->> 'solo_won')::boolean, false) and camp = 'village'));
  winners := winners || (select coalesce(array_agg(s), '{}') from unnest(solo) s where not (s = any (winners)));
  perform private.ww_finish(p_room, winner, winners);
  if cardinality(solo) > 0 or cardinality(double_) > 0 then
    update private.ww_games set result = result || jsonb_build_object('solo', to_jsonb(solo), 'double', to_jsonb(double_)) where room_id = p_room;
  end if;
  return true;
end $$;
revoke all on function private.ww_check_victory(uuid) from public, anon, authenticated;

create or replace function private.ww_view_for(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  me private.ww_players;
  pack integer[];
  in_pack boolean;
  round_ integer;
  acting jsonb;
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into me from private.ww_players where room_id = p_room and seat = p_seat;
  pack := private.ww_pack(p_room, greatest(g.night, 1));
  in_pack := me.alive and me.camp = 'wolves' and coalesce(me.wolf_since, 0) <= greatest(g.night, 1);
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  acting := private.ww_acting(p_room, p_seat);
  return jsonb_build_object(
    'phase', g.phase, 'night', g.night, 'day', g.day, 'deadline', g.deadline, 'now', now(),
    'kind', g.kind, 'mode', g.mode, 'size', g.size, 'difficulty', g.difficulty, 'ranked', g.ranked,
    'composition', g.composition,
    'me', jsonb_build_object('seat', me.seat, 'card', me.card, 'camp', me.camp, 'alive', me.alive, 'charges', me.charges,
      'lover', me.lover, 'known', me.known,
      'seduced', case when me.card = 'charo' then coalesce(me.memory -> 'seduced', '[]'::jsonb) end,
      'pack', case when in_pack then to_jsonb(pack) end,
      -- V3: the power lent or copied for tonight, the Possédé's prey, the Vampire's servants and one's master, a personal victory.
      'borrowed', case when (acting ->> 'borrowed')::boolean and g.phase in ('night', 'witch') then acting ->> 'card' end,
      'prey', case when me.card = 'possessed' then me.charges -> 'prey' end,
      'servants', case when me.card = 'vampire' then me.charges -> 'servants' end,
      'master', me.memory -> 'master',
      'solo_won', coalesce((me.memory ->> 'solo_won')::boolean, false),
      'silenced', exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'mute' and x.target = p_seat)
        or (me.memory ->> 'cursed_day')::integer = g.day),
    'players', (select jsonb_agg(jsonb_build_object('seat', p.seat, 'name', p.name, 'bot', p.bot, 'user_id', p.user_id, 'alive', p.alive,
        'acted', exists (select 1 from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p.seat)
          and g.phase in ('day', 'vote', 'revote'))
        order by p.seat) from private.ww_players p where p.room_id = p_room),
    'options', private.ww_options(p_room, p_seat),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('kind', a.kind, 'target', a.target, 'target2', a.target2)), '[]')
        from private.ww_actions a where a.room_id = p_room and a.seat = p_seat
          and ((a.phase = g.phase and a.round = round_) or (a.phase = 'power' and a.round = g.day and g.phase in ('day', 'vote', 'revote')))),
    'victim', case when g.phase = 'witch' and acting ->> 'card' = 'witch' and me.alive and (private.ww_acting_charges(p_room, p_seat) ->> 'life')::integer > 0
      then g.night_state -> 'wolves' end,
    'pack_votes', case when in_pack and g.phase = 'night' then (select coalesce(jsonb_object_agg(a.seat::text, a.target), '{}')
        from private.ww_actions a where a.room_id = p_room and a.phase = 'night' and a.round = g.night and a.kind = 'wolf' and a.seat = any (pack)) end,
    'revote', to_jsonb(g.revote),
    'result', g.result,
    'log', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'kind', l.kind, 'data', l.data, 'audience', l.audience) order by l.id), '[]')
        from (select * from private.ww_log l where l.room_id = p_room
          and (l.audience = 'all' or l.audience = 'seat:' || p_seat or (l.audience = 'wolves' and in_pack))
          order by l.id desc limit 150) l)
  );
end $$;
revoke all on function private.ww_view_for(uuid, integer) from public, anon, authenticated;
