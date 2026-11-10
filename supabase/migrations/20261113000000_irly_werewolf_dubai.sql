-- IRLY Loup-Garou, mode Dubaï (9th mode): Expats vs Escrocs, 20 cards.
-- Rules: docs/LOUP-GAROU-DUBAI.md. Same engine as the Classic mode (20261112000000_irly_werewolf):
-- the Escrocs are the wolves' camp, the Expats the village's, the Indépendants a 'solo' camp.
-- Every card power is decided here; the phone only sends intentions and reads its own view.

-- ───────── Schema ─────────
alter table private.ww_games drop constraint if exists ww_games_mode_check;
alter table private.ww_games add constraint ww_games_mode_check check (mode in ('classic', 'dubai'));
alter table private.ww_players drop constraint if exists ww_players_camp_check;
alter table private.ww_players add constraint ww_players_camp_check check (camp in ('village', 'wolves', 'solo'));

-- ───────── Cards ─────────
create or replace function private.ww_dubai_roles() returns text[]
language sql immutable as $$
  select array['expat', 'escroc', 'influencer', 'entrepreneur', 'millionaire', 'single', 'charo', 'golden_visa', 'investor', 'ceo',
    'ecommerce', 'newcomer', 'emirati', 'realtor', 'creator', 'broker', 'tourist', 'concierge', 'fake_millionaire', 'networker']
$$;

create or replace function private.ww_mode_roles(p_mode text) returns text[]
language sql immutable as $$
  select case when p_mode = 'dubai' then private.ww_dubai_roles() else private.ww_roles() end
$$;

create or replace function private.ww_camp(p_role text) returns text
language sql immutable as $$
  select case
    when p_role in ('werewolf', 'escroc', 'realtor', 'broker') then 'wolves'
    when p_role in ('charo', 'fake_millionaire') then 'solo'
    else 'village' end
$$;

create or replace function private.ww_fresh_charges(p_role text) returns jsonb
language sql immutable as $$
  select case p_role
    when 'witch' then '{"life": 1, "death": 1}'
    when 'hunter' then '{"shot": 1}'
    when 'elder' then '{"life": 1}'
    when 'little_girl' then '{"hint": 1}'
    when 'cupid' then '{"link": 1}'
    when 'thief' then '{"steal": 1}'
    when 'salvateur' then '{"last": null}'
    -- Dubaï: one use each, except the Concierge and the Charo (every night).
    when 'influencer' then '{"buzz": 1}'
    when 'entrepreneur' then '{"shield": 1}'
    when 'ecommerce' then '{"shield": 1}'
    when 'millionaire' then '{"life": 1}'
    when 'single' then '{"crush": 1}'
    when 'golden_visa' then '{"visa": 1}'
    when 'investor' then '{"probe": 1}'
    when 'emirati' then '{"probe": 1}'
    when 'networker' then '{"probe": 1}'
    when 'ceo' then '{"board": 1}'
    when 'newcomer' then '{"fresh": 1}'
    when 'realtor' then '{"listing": 1}'
    when 'creator' then '{"story": 1}'
    when 'broker' then '{"dump": 1}'
    when 'tourist' then '{"stay": 1}'
    when 'concierge' then '{"last": null}'
    when 'charo' then '{"last": null}'
    when 'fake_millionaire' then '{"bluff": 1}'
    else '{}' end::jsonb
$$;

-- Powers used by day, kept apart from the vote (phase 'power', round = the day).
create or replace function private.ww_day_powers() returns text[]
language sql immutable as $$ select array['buzz', 'board', 'fresh', 'dump'] $$;

/** The Dubaï deck by size (docs/LOUP-GAROU-DUBAI.md §6): owner's table of Escrocs and Indépendants,
 * then power cards by priority within caps (protections, camp investigations, double votes). */
create or replace function private.ww_dubai_composition(p_size integer) returns jsonb
language plpgsql immutable as $$
declare
  w integer := case when p_size < 7 then 1 when p_size < 11 then 2 when p_size < 14 then 3 when p_size < 18 then 4 else 5 end;
  k integer := case when p_size < 9 then 0 when p_size < 16 then 1 else 2 end;
  e integer;
  powered integer;
  cap integer := case when p_size < 15 then 2 else 3 end;
  prot integer := 0;
  probes integer := 0;
  added integer := 0;
  c jsonb := '{}'::jsonb;
  specials integer := 0;
  r text;
begin
  e := p_size - w - k;
  if p_size >= 10 then c := c || '{"realtor": 1}'; specials := specials + 1; end if;
  if p_size >= 12 and w >= 3 then c := c || '{"broker": 1}'; specials := specials + 1; end if;
  c := c || jsonb_build_object('escroc', w - specials);
  if k >= 1 then c := c || '{"charo": 1}'; end if;
  if k >= 2 then c := c || '{"fake_millionaire": 1}'; end if;
  powered := e - greatest(2, e / 3);
  foreach r in array array['investor', 'entrepreneur', 'influencer', 'concierge', 'millionaire', 'single', 'creator', 'ceo',
      'networker', 'golden_visa', 'newcomer', 'emirati', 'tourist', 'ecommerce'] loop
    exit when added >= powered;
    if r in ('entrepreneur', 'millionaire', 'golden_visa', 'tourist', 'ecommerce') then
      if prot >= cap then continue; end if;
      prot := prot + 1;
    elsif r in ('investor', 'emirati', 'networker') then
      if probes >= cap then continue; end if;
      probes := probes + 1;
    elsif r = 'ceo' and c ? 'influencer' and p_size < 15 then
      continue;
    end if;
    c := c || jsonb_build_object(r, 1);
    added := added + 1;
  end loop;
  return c || jsonb_build_object('expat', e - added);
end $$;

/** A Dubaï deck the host sent, checked (V3 §2 limits + the Dubaï caps). */
create or replace function private.ww_dubai_check(p_size integer, p_comp jsonb) returns jsonb
language plpgsql immutable as $$
declare
  k text;
  v jsonb;
  n integer;
  total integer := 0;
  wolves integer := 0;
  prot integer := 0;
  probes integer := 0;
  cap integer := case when p_size < 15 then 2 else 3 end;
  out_ jsonb := '{}'::jsonb;
begin
  if p_comp is null then return private.ww_dubai_composition(p_size); end if;
  if jsonb_typeof(p_comp) <> 'object' then raise exception 'composition: a list of cards' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_comp) loop
    if not (k = any (private.ww_dubai_roles())) then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::integer < 0 then
      raise exception 'composition: a whole number per card' using errcode = '22023';
    end if;
    n := (v::text)::integer;
    if k not in ('escroc', 'expat') and n > 1 then raise exception 'composition: one of each special card' using errcode = '22023'; end if;
    if n > 0 then out_ := out_ || jsonb_build_object(k, n); end if;
    total := total + n;
    if private.ww_camp(k) = 'wolves' then wolves := wolves + n; end if;
    if k in ('entrepreneur', 'millionaire', 'golden_visa', 'tourist', 'ecommerce') then prot := prot + n; end if;
    if k in ('investor', 'emirati', 'networker') then probes := probes + n; end if;
  end loop;
  if wolves < 1 then raise exception 'composition: at least one escroc' using errcode = '22023'; end if;
  if wolves * 2 >= p_size then raise exception 'composition: escrocs must be fewer than half the players' using errcode = '22023'; end if;
  if total <> p_size then raise exception 'composition: one card per player' using errcode = '22023'; end if;
  if prot > cap then raise exception 'composition: too many protections for this size' using errcode = '22023'; end if;
  if probes > cap then raise exception 'composition: too many investigations for this size' using errcode = '22023'; end if;
  if out_ ? 'ceo' and out_ ? 'influencer' and p_size < 15 then
    raise exception 'composition: the CEO and the Influenceuse together from 15 players' using errcode = '22023';
  end if;
  return out_;
end $$;

create or replace function private.ww_default_for(p_mode text, p_size integer) returns jsonb
language sql immutable as $$
  select case when p_mode = 'dubai' then private.ww_dubai_composition(p_size) else private.ww_default_composition(p_size) end
$$;

create or replace function private.ww_check_for(p_mode text, p_size integer, p_comp jsonb) returns jsonb
language sql immutable as $$
  select case when p_mode = 'dubai' then private.ww_dubai_check(p_size, p_comp) else private.ww_check_composition(p_size, p_comp) end
$$;

/** Cards beyond the players: the Voleur's two (Classic only). */
create or replace function private.ww_extra_cards(p_comp jsonb) returns integer
language sql immutable as $$ select case when p_comp ? 'thief' then 2 else 0 end $$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_dubai_roles()', 'private.ww_mode_roles(text)', 'private.ww_camp(text)', 'private.ww_fresh_charges(text)',
    'private.ww_day_powers()', 'private.ww_dubai_composition(integer)', 'private.ww_dubai_check(integer, jsonb)',
    'private.ww_default_for(text, integer)', 'private.ww_check_for(text, integer, jsonb)', 'private.ww_extra_cards(jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────── Dealing: every card of the wolves' camp is in the pack from the first night ─────────
create or replace function private.ww_deal(p_room uuid, p_humans uuid[], p_bots integer, p_human_role text) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  deck text[];
  k text;
  v jsonb;
  n integer;
  tries integer := 0;
  names constant text[] := array['Léo', 'Inès', 'Sam', 'Nora', 'Yanis', 'Maya', 'Hugo', 'Lina', 'Adam', 'Jade', 'Noah', 'Zoé', 'Malik', 'Sofia', 'Elias', 'Rania', 'Tom', 'Aya', 'Nils', 'Lou'];
  bot_names text[];
  role_ text;
  pos integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  n := g.size;
  loop
    deck := '{}';
    for k, v in select * from jsonb_each(g.composition) loop
      for i in 1..(v::text)::integer loop deck := deck || k; end loop;
    end loop;
    select array_agg(x order by gen_random_uuid()) into deck from unnest(deck) x;
    if p_human_role is not null then
      if not (p_human_role = any (deck)) then raise exception 'composition: that role is not in this game' using errcode = '22023'; end if;
      pos := array_position(deck, p_human_role);
      deck := array[p_human_role] || coalesce((select array_agg(x order by gen_random_uuid()) from unnest(deck[1:pos - 1] || deck[pos + 1:]) x), '{}');
    end if;
    tries := tries + 1;
    exit when exists (select 1 from unnest(deck[1:n]) r where private.ww_camp(r) = 'wolves')
      and exists (select 1 from unnest(deck[1:n]) r where private.ww_camp(r) <> 'wolves') or tries > 60;
  end loop;
  select array_agg(x order by gen_random_uuid()) into bot_names from unnest(names) x;
  delete from private.ww_players where room_id = p_room;
  for s in 0..n - 1 loop
    role_ := deck[s + 1];
    insert into private.ww_players (room_id, seat, user_id, bot, name, card, charges, camp, wolf_since)
    values (p_room, s,
      case when s < coalesce(array_length(p_humans, 1), 0) then p_humans[s + 1] end,
      s >= coalesce(array_length(p_humans, 1), 0),
      case when s < coalesce(array_length(p_humans, 1), 0)
        then coalesce((select p.first_name from public.profiles p where p.id = p_humans[s + 1]), 'A player')
        else bot_names[s - coalesce(array_length(p_humans, 1), 0) + 1] end,
      role_, private.ww_fresh_charges(role_), private.ww_camp(role_), case when private.ww_camp(role_) = 'wolves' then 0 end);
  end loop;
  update private.ww_games set extras = coalesce((
    select jsonb_agg(jsonb_build_object('role', r, 'charges', private.ww_fresh_charges(r))) from unnest(deck[n + 1:n + 2]) r), '[]'::jsonb)
  where room_id = p_room;
end $$;
revoke all on function private.ww_deal(uuid, uuid[], integer, text) from public, anon, authenticated;

create or replace function private.ww_start(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  humans uuid[];
  n integer;
  comp jsonb;
begin
  select * into g from private.ww_games where room_id = p_room for update;
  if g.phase <> 'lobby' then raise exception 'this game has already started' using errcode = '22023'; end if;
  select array_agg(gp.user_id order by gp.seat) into humans from public.game_participants gp where gp.room_id = p_room and gp.left_at is null;
  n := coalesce(array_length(humans, 1), 0);
  if g.kind <> 'training' then
    if n < 6 then raise exception 'six players are needed to start' using errcode = '22023'; end if;
    comp := case when g.composition is not null and private.ww_card_count(g.composition) = n + private.ww_extra_cards(g.composition)
      then private.ww_check_for(g.mode, n, g.composition) else private.ww_default_for(g.mode, n) end;
    update private.ww_games set size = n, composition = comp where room_id = p_room;
  end if;
  perform private.ww_deal(p_room, humans, (select size from private.ww_games where room_id = p_room) - n, g.human_role);
  update private.ww_games set started_at = now() where room_id = p_room;
  update public.game_rooms set status = 'playing', started_at = now(), updated_at = now() where id = p_room;
  perform private.ww_log_add(p_room, 'all', 'start', jsonb_build_object('size', (select size from private.ww_games where room_id = p_room),
    'mode', g.mode, 'composition', (select composition from private.ww_games where room_id = p_room)));
  perform private.ww_enter(p_room, 'night');
end $$;
revoke all on function private.ww_start(uuid) from public, anon, authenticated;

-- ───────── What each player may do now ─────────
create or replace function private.ww_options(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  p private.ww_players;
  alive_others integer[];
  alive_all integer[];
  out_ jsonb := '[]'::jsonb;
  seduced jsonb;
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into p from private.ww_players where room_id = p_room and seat = p_seat;
  if not found or g.phase in ('lobby', 'ended') then return out_; end if;
  select coalesce(array_agg(seat order by seat), '{}') into alive_all from private.ww_players where room_id = p_room and alive;
  alive_others := array_remove(alive_all, p_seat);
  if not p.alive then return out_; end if;
  if g.phase = 'night' then
    if p_seat = any (private.ww_pack(p_room, g.night)) then
      out_ := out_ || jsonb_build_object('kind', 'wolf', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_all) s
        where (select camp from private.ww_players q where q.room_id = p_room and q.seat = s) <> 'wolves'));
    end if;
    if p.card = 'seer' then out_ := out_ || jsonb_build_object('kind', 'seer', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'salvateur' then
      out_ := out_ || jsonb_build_object('kind', 'protect', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where s is distinct from (p.charges ->> 'last')::integer));
    end if;
    if p.card = 'hunter' and (p.charges ->> 'shot')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'shoot', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'little_girl' and (p.charges ->> 'hint')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'hint', 'targets', '[]'::jsonb); end if;
    if p.card = 'cupid' and g.night = 1 and (p.charges ->> 'link')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'link', 'targets', to_jsonb(alive_all)); end if;
    if p.card = 'thief' and g.night = 1 and (p.charges ->> 'steal')::integer > 0 and jsonb_array_length(g.extras) = 2 then
      out_ := out_ || jsonb_build_object('kind', 'steal', 'targets', '[0, 1, -1]'::jsonb, 'cards', (select jsonb_agg(e -> 'role') from jsonb_array_elements(g.extras) e));
    end if;
    -- Dubaï, by night.
    if p.card in ('entrepreneur', 'ecommerce') and (p.charges ->> 'shield')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'shield', 'targets', to_jsonb(alive_others));
    end if;
    if p.card = 'golden_visa' and (p.charges ->> 'visa')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'visa', 'targets', jsonb_build_array(p_seat)); end if;
    if p.card = 'tourist' and (p.charges ->> 'stay')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'stay', 'targets', '[]'::jsonb); end if;
    if p.card = 'fake_millionaire' and (p.charges ->> 'bluff')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'bluff', 'targets', '[]'::jsonb); end if;
    if p.card in ('investor', 'emirati', 'networker') and (p.charges ->> 'probe')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'probe', 'targets', to_jsonb(alive_others));
    end if;
    if p.card = 'realtor' and (p.charges ->> 'listing')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'listing', 'targets', to_jsonb(alive_all)); end if;
    if p.card = 'creator' and (p.charges ->> 'story')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'story', 'targets', to_jsonb(alive_others)); end if;
    if p.card = 'concierge' then
      out_ := out_ || jsonb_build_object('kind', 'watch', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where s is distinct from (p.charges ->> 'last')::integer));
    end if;
    if p.card = 'single' and g.night = 1 and (p.charges ->> 'crush')::integer > 0 then
      out_ := out_ || jsonb_build_object('kind', 'crush', 'targets', to_jsonb(alive_others));
    end if;
    if p.card = 'charo' then
      seduced := coalesce(p.memory -> 'seduced', '[]'::jsonb);
      out_ := out_ || jsonb_build_object('kind', 'seduce', 'targets', (select coalesce(jsonb_agg(s), '[]') from unnest(alive_others) s
        where not seduced @> to_jsonb(s) and s is distinct from (p.charges ->> 'last')::integer));
    end if;
  elsif g.phase = 'witch' and p.card = 'witch' then
    if (p.charges ->> 'life')::integer > 0 and g.night_state ->> 'wolves' is not null and (g.night_state ->> 'wolves')::integer <> p_seat then
      out_ := out_ || jsonb_build_object('kind', 'heal', 'targets', jsonb_build_array((g.night_state ->> 'wolves')::integer));
    end if;
    if (p.charges ->> 'death')::integer > 0 then out_ := out_ || jsonb_build_object('kind', 'poison', 'targets', to_jsonb(alive_others)); end if;
  elsif g.phase in ('day', 'vote', 'revote') then
    if g.phase = 'day' then
      out_ := out_ || jsonb_build_object('kind', 'ready', 'targets', '[]'::jsonb);
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
begin
  select * into g from private.ww_games where room_id = p_room;
  opts := private.ww_options(p_room, p_seat);
  if p_kind = 'pass' then
    if jsonb_array_length(opts) = 0 then raise exception 'nothing to do now' using errcode = '22023'; end if;
  else
    select o into opt from jsonb_array_elements(opts) o where o ->> 'kind' = p_kind;
    if opt is null then raise exception 'you cannot do that now' using errcode = '22023'; end if;
    -- Every power aimed at someone needs a valid target (an empty list means no one is left to aim at).
    if p_kind not in ('ready', 'hint', 'board', 'fresh', 'stay', 'bluff', 'link')
        and (p_target is null or not (opt -> 'targets') @> to_jsonb(p_target)) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    if p_kind = 'link' and (p_target is null or p_target2 is null or p_target = p_target2
        or not (opt -> 'targets') @> to_jsonb(p_target) or not (opt -> 'targets') @> to_jsonb(p_target2)) then
      raise exception 'not a valid target' using errcode = '22023';
    end if;
    if p_kind in ('heal', 'poison') then
      delete from private.ww_actions where room_id = p_room and phase = 'witch' and round = g.night and seat = p_seat and kind in ('heal', 'poison', 'pass');
    end if;
  end if;
  -- A power used by day is final at once: its charge goes, and the public part is told (docs/LOUP-GAROU-DUBAI.md D2).
  if p_kind = any (private.ww_day_powers()) then
    insert into private.ww_actions (room_id, phase, round, seat, kind, target, target2)
      values (p_room, 'power', g.day, p_seat, p_kind, case when p_kind in ('board', 'fresh') then p_seat else p_target end, null);
    update private.ww_players set charges = jsonb_set(charges, array[p_kind], '0') where room_id = p_room and seat = p_seat;
    if p_kind = 'board' then perform private.ww_log_add(p_room, 'all', 'vote_doubled', jsonb_build_object('seat', p_seat, 'day', g.day, 'ceo', true));
    elsif p_kind = 'buzz' then perform private.ww_log_add(p_room, 'all', 'vote_doubled', jsonb_build_object('seat', p_target, 'day', g.day));
    elsif p_kind = 'fresh' then perform private.ww_log_add(p_room, 'all', 'immune', jsonb_build_object('seat', p_seat, 'day', g.day));
    else perform private.ww_log_add(p_room, 'seat:' || p_seat, 'dumped', jsonb_build_object('seat', p_target, 'day', g.day));
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

/** In a vote, a seat has acted once it voted or passed (a power used by day is not a vote). */
create or replace function private.ww_phase_done(p_room uuid) returns boolean
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  round_ integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  if g.phase = 'day' and g.kind <> 'training' then return false; end if;
  return not exists (
    select 1 from private.ww_players p
    where p.room_id = p_room and p.alive and jsonb_array_length(private.ww_options(p_room, p.seat)) > 0
      and not exists (select 1 from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p.seat
        and (g.phase not in ('vote', 'revote') or a.kind in ('vote', 'pass')))
  );
end $$;
revoke all on function private.ww_phase_done(uuid) from public, anon, authenticated;

-- ───────── Victory: collective, then the Indépendants and the Double Jeu (V3 §7, §3 phase 11-12) ─────────
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
  -- Solo victories already won stay won (the Charo, even dead); the Faux Millionnaire wins alive at the end.
  select coalesce(array_agg(seat order by seat), '{}') into solo from private.ww_players
  where room_id = p_room and (coalesce((memory ->> 'solo_won')::boolean, false)
    or (card = 'fake_millionaire' and alive and winner <> 'draw'));
  -- The Networker's personal objective, on top of the Expats' victory: an Escroc investigated, and alive.
  select coalesce(array_agg(seat order by seat), '{}') into double_ from private.ww_players
  where room_id = p_room and card = 'networker' and alive and seat = any (winners) and coalesce((memory ->> 'networked')::boolean, false);
  winners := winners || (select coalesce(array_agg(s), '{}') from unnest(solo) s where not (s = any (winners)));
  perform private.ww_finish(p_room, winner, winners);
  if cardinality(solo) > 0 or cardinality(double_) > 0 then
    update private.ww_games set result = result || jsonb_build_object('solo', to_jsonb(solo), 'double', to_jsonb(double_)) where room_id = p_room;
  end if;
  return true;
end $$;
revoke all on function private.ww_check_victory(uuid) from public, anon, authenticated;

-- ───────── The Dubaï night (V3 §3 order) ─────────
create or replace function private.ww_resolve_night_dubai(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  a record;
  prot integer[] := '{}';
  untouchable integer[] := '{}';
  fakes integer[] := '{}';
  bluffs integer[] := '{}';
  pack integer[];
  tops integer[];
  target integer;
  tcamp text;
  esc boolean;
  f text;
  victims integer[] := '{}';
  dead integer[];
  seduced jsonb;
  alive_seduced integer;
begin
  select * into g from private.ww_games where room_id = p_room for update;

  -- Phase 3: the Célibataire falls for someone (night 1): he and his choice become lovers (V3 §6).
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'crush' loop
    update private.ww_players set lover = a.target where room_id = p_room and seat = a.seat;
    update private.ww_players set lover = a.seat where room_id = p_room and seat = a.target;
    update private.ww_players q set lover_opposed = (select count(distinct camp) from private.ww_players r where r.room_id = p_room and r.seat in (a.seat, a.target)) = 2
      where q.room_id = p_room and q.seat in (a.seat, a.target);
    update private.ww_players set charges = jsonb_set(charges, '{crush}', '0') where room_id = p_room and seat = a.seat;
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'lover', jsonb_build_object('seat', a.target));
    perform private.ww_log_add(p_room, 'seat:' || a.target, 'lover', jsonb_build_object('seat', a.seat));
  end loop;

  -- Phase 4: protections against the Escrocs' attack, and the Touriste out of reach.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('shield', 'visa', 'stay') loop
    if a.kind = 'stay' then untouchable := untouchable || a.seat; else prot := prot || a.target; end if;
    update private.ww_players set charges = jsonb_set(charges, array[a.kind], '0') where room_id = p_room and seat = a.seat;
  end loop;

  -- Phase 5: falsifications first (Agent immobilier, Faux Millionnaire), then the investigations.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind in ('listing', 'bluff') loop
    if a.kind = 'listing' then fakes := fakes || a.target; else bluffs := bluffs || a.seat; end if;
    update private.ww_players set charges = jsonb_set(charges, array[a.kind], '0') where room_id = p_room and seat = a.seat;
  end loop;
  for a in select x.*, p.card from private.ww_actions x join private.ww_players p on p.room_id = x.room_id and p.seat = x.seat
      where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.kind = 'probe' loop
    select camp into tcamp from private.ww_players where room_id = p_room and seat = a.target;
    if a.card = 'networker' then
      -- The faction (Expats, Escrocs, Indépendants); the Bluff shows Expats; a fake listing turns Escrocs and the others round.
      f := case tcamp when 'wolves' then 'escrocs' when 'solo' then 'independents' else 'expats' end;
      if a.target = any (bluffs) then f := 'expats'; end if;
      if a.target = any (fakes) then f := case when f = 'escrocs' then 'expats' else 'escrocs' end; end if;
      update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'network', 'night', g.night, 'seat', a.target, 'faction', f)),
        memory = case when tcamp = 'wolves' then jsonb_set(memory, '{networked}', 'true') else memory end
      where room_id = p_room and seat = a.seat;
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'network_result', jsonb_build_object('seat', a.target, 'faction', f));
    else
      esc := tcamp = 'wolves';
      if a.target = any (fakes) then esc := not esc; end if;
      update private.ww_players set known = known || jsonb_build_array(jsonb_build_object('kind', 'probe', 'night', g.night, 'seat', a.target, 'escroc', esc))
      where room_id = p_room and seat = a.seat;
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'probe_result', jsonb_build_object('seat', a.target, 'escroc', esc));
    end if;
    update private.ww_players set charges = jsonb_set(charges, '{probe}', '0') where room_id = p_room and seat = a.seat;
  end loop;
  -- The Créateur de contenu: did that player act tonight (not whom, not how)?
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'story' loop
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'story_result', jsonb_build_object('seat', a.target,
      'acted', exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = a.target and x.kind <> 'pass')));
    update private.ww_players set charges = jsonb_set(charges, '{story}', '0') where room_id = p_room and seat = a.seat;
  end loop;

  -- Phase 6: the Escrocs' victim (most votes; ties: the server's fixed pick; no vote: no attack).
  pack := private.ww_pack(p_room, g.night);
  select coalesce(array_agg(t), '{}') into tops from (
    select a2.target as t, count(*) c, max(count(*)) over () m
    from private.ww_actions a2
    where a2.room_id = p_room and a2.phase = 'night' and a2.round = g.night and a2.kind = 'wolf' and a2.seat = any (pack)
      and exists (select 1 from private.ww_players q where q.room_id = p_room and q.seat = a2.target and q.alive and q.camp <> 'wolves')
    group by a2.target) v where c = m;
  target := case when cardinality(tops) > 0 then private.ww_pick(p_room, 'wolves:' || g.night, tops) end;
  if target is not null then
    perform private.ww_log_add(p_room, 'wolves', 'pack_target', jsonb_build_object('seat', target, 'night', g.night));
  end if;

  -- The Concierge: did the player he watched get at least one visit (any night action of another player aimed at him)?
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'watch' loop
    perform private.ww_log_add(p_room, 'seat:' || a.seat, 'watch_result', jsonb_build_object('seat', a.target,
      'visited', exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night
        and x.seat not in (a.seat, a.target) and x.kind <> 'pass' and (x.target = a.target or x.target2 = a.target))));
    update private.ww_players set charges = jsonb_set(charges, '{last}', to_jsonb(a.target)) where room_id = p_room and seat = a.seat;
  end loop;
  update private.ww_players set charges = jsonb_set(charges, '{last}', 'null') where room_id = p_room and card = 'concierge'
    and not exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = ww_players.seat and x.kind = 'watch');

  -- Phase 9: the attack. Out of reach (Touriste), protected, then the Millionnaire's Seconde Chance (D4, D5, D6).
  if target is not null and not (target = any (untouchable)) and not (target = any (prot)) then
    if exists (select 1 from private.ww_players where room_id = p_room and seat = target and card = 'millionaire' and (charges ->> 'life')::integer > 0) then
      update private.ww_players set charges = jsonb_set(charges, '{life}', '0') where room_id = p_room and seat = target;
      perform private.ww_log_add(p_room, 'seat:' || target, 'second_chance', '{}');
    else
      victims := array[target];
    end if;
  end if;
  dead := private.ww_kill(p_room, victims, 'night', 'night ' || g.night);

  -- Phase 11: the Charo's seductions count when the player is still alive; three alive at the third: a solo victory, for good.
  for a in select * from private.ww_actions where room_id = p_room and phase = 'night' and round = g.night and kind = 'seduce' loop
    update private.ww_players set charges = jsonb_set(charges, '{last}', to_jsonb(a.target)) where room_id = p_room and seat = a.seat;
    if (select alive from private.ww_players where room_id = p_room and seat = a.target) then
      update private.ww_players set memory = jsonb_set(memory, '{seduced}', coalesce(memory -> 'seduced', '[]'::jsonb) || to_jsonb(a.target))
        where room_id = p_room and seat = a.seat;
      select memory -> 'seduced' into seduced from private.ww_players where room_id = p_room and seat = a.seat;
      select count(*) into alive_seduced from private.ww_players q where q.room_id = p_room and q.alive and seduced @> to_jsonb(q.seat);
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'seduced', jsonb_build_object('seat', a.target, 'count', jsonb_array_length(seduced)));
      if jsonb_array_length(seduced) >= 3 and alive_seduced >= 3
          and not coalesce((select (memory ->> 'solo_won')::boolean from private.ww_players where room_id = p_room and seat = a.seat), false) then
        update private.ww_players set memory = jsonb_set(memory, '{solo_won}', 'true') where room_id = p_room and seat = a.seat;
        perform private.ww_log_add(p_room, 'seat:' || a.seat, 'solo_won', jsonb_build_object('night', g.night));
      end if;
    else
      perform private.ww_log_add(p_room, 'seat:' || a.seat, 'seduce_failed', jsonb_build_object('seat', a.target));
    end if;
  end loop;

  perform private.ww_log_add(p_room, 'all', 'morning', jsonb_build_object('night', g.night, 'dead', to_jsonb(dead)));
  if private.ww_check_victory(p_room) then return; end if;
  perform private.ww_enter(p_room, 'day');
end $$;
revoke all on function private.ww_resolve_night_dubai(uuid) from public, anon, authenticated;

-- The Classic night is unchanged; the Dubaï mode has its own (no Sorcière phase).
create or replace function private.ww_advance(p_room uuid, p_force boolean default false) returns boolean
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  moved boolean := false;
begin
  for i in 1..40 loop
    select * into g from private.ww_games where room_id = p_room for update skip locked;
    if not found or g.phase in ('lobby', 'ended') then exit; end if;
    if not (p_force or g.deadline <= now() or private.ww_phase_done(p_room)) then exit; end if;
    p_force := false;
    if g.phase = 'night' and g.mode = 'dubai' then perform private.ww_resolve_night_dubai(p_room);
    elsif g.phase = 'night' then perform private.ww_resolve_night(p_room);
    elsif g.phase = 'witch' then perform private.ww_resolve_witch(p_room);
    elsif g.phase = 'day' then perform private.ww_enter(p_room, 'vote');
    else perform private.ww_resolve_vote(p_room);
    end if;
    moved := true;
  end loop;
  return moved;
end $$;
revoke all on function private.ww_advance(uuid, boolean) from public, anon, authenticated;

/** V3 §10 with the Dubaï powers: cancelled votes, then double votes (at most two), the most voted, a second round
 * on a tie, then the Nouvel Arrivant's immunity. In the Classic mode every vote weighs one, as before. */
create or replace function private.ww_resolve_vote(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  tops integer[];
  ballots jsonb;
  counts jsonb;
  dead integer[];
begin
  select * into g from private.ww_games where room_id = p_room for update;
  select coalesce(jsonb_object_agg(a.seat::text, a.target), '{}') into ballots
    from private.ww_actions a join private.ww_players p on p.room_id = a.room_id and p.seat = a.seat and p.alive
    where a.room_id = p_room and a.phase = g.phase and a.round = g.day and a.kind = 'vote';
  select coalesce(jsonb_object_agg(t::text, w), '{}') into counts from (
    select (b.value::text)::integer t, sum(
      case when exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'dump' and x.target = b.key::integer) then 0
        when exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind in ('board', 'buzz') and x.target = b.key::integer) then 2
        else 1 end) w
    from jsonb_each(ballots) b group by 1) x where w > 0;
  select coalesce(array_agg(t order by t), '{}') into tops from (
    select key::integer t, (value::text)::integer c, max((value::text)::integer) over () m from jsonb_each(counts)) x where c = m;
  perform private.ww_log_add(p_room, 'all', 'votes', jsonb_build_object('day', g.day, 'round', g.phase, 'ballots', ballots)
    || case when g.mode = 'dubai' then jsonb_build_object('counts', counts) else '{}'::jsonb end);
  if cardinality(tops) = 1 and exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'power' and x.round = g.day and x.kind = 'fresh' and x.seat = tops[1]) then
    perform private.ww_log_add(p_room, 'all', 'immune_saved', jsonb_build_object('seat', tops[1], 'day', g.day));
    perform private.ww_enter(p_room, 'night');
  elsif cardinality(tops) = 1 then
    dead := private.ww_kill(p_room, tops, 'vote', 'day ' || g.day);
    perform private.ww_log_add(p_room, 'all', 'voted_out', jsonb_build_object('seat', tops[1], 'dead', to_jsonb(dead)));
    if private.ww_check_victory(p_room) then return; end if;
    perform private.ww_enter(p_room, 'night');
  elsif cardinality(tops) > 1 and g.phase = 'vote' then
    update private.ww_games set revote = tops where room_id = p_room;
    perform private.ww_log_add(p_room, 'all', 'tie', jsonb_build_object('seats', to_jsonb(tops)));
    perform private.ww_enter(p_room, 'revote');
  else
    perform private.ww_log_add(p_room, 'all', 'no_elimination', jsonb_build_object('day', g.day));
    perform private.ww_enter(p_room, 'night');
  end if;
end $$;
revoke all on function private.ww_resolve_vote(uuid) from public, anon, authenticated;

-- ───────── The player's view: also the day powers used today ─────────
create or replace function private.ww_view_for(p_room uuid, p_seat integer) returns jsonb
language plpgsql stable security definer set search_path = public, private as $$
declare
  g private.ww_games;
  me private.ww_players;
  pack integer[];
  in_pack boolean;
  round_ integer;
begin
  select * into g from private.ww_games where room_id = p_room;
  select * into me from private.ww_players where room_id = p_room and seat = p_seat;
  pack := private.ww_pack(p_room, greatest(g.night, 1));
  in_pack := me.alive and me.camp = 'wolves' and coalesce(me.wolf_since, 0) <= greatest(g.night, 1);
  round_ := case when g.phase in ('night', 'witch') then g.night else g.day end;
  return jsonb_build_object(
    'phase', g.phase, 'night', g.night, 'day', g.day, 'deadline', g.deadline, 'now', now(),
    'kind', g.kind, 'mode', g.mode, 'size', g.size, 'difficulty', g.difficulty, 'ranked', g.ranked,
    'composition', g.composition,
    'me', jsonb_build_object('seat', me.seat, 'card', me.card, 'camp', me.camp, 'alive', me.alive, 'charges', me.charges,
      'lover', me.lover, 'known', me.known,
      'seduced', case when me.card = 'charo' then coalesce(me.memory -> 'seduced', '[]'::jsonb) end,
      'pack', case when in_pack then to_jsonb(pack) end),
    'players', (select jsonb_agg(jsonb_build_object('seat', p.seat, 'name', p.name, 'bot', p.bot, 'user_id', p.user_id, 'alive', p.alive,
        'acted', exists (select 1 from private.ww_actions a where a.room_id = p_room and a.phase = g.phase and a.round = round_ and a.seat = p.seat)
          and g.phase in ('day', 'vote', 'revote'))
        order by p.seat) from private.ww_players p where p.room_id = p_room),
    'options', private.ww_options(p_room, p_seat),
    'mine', (select coalesce(jsonb_agg(jsonb_build_object('kind', a.kind, 'target', a.target, 'target2', a.target2)), '[]')
        from private.ww_actions a where a.room_id = p_room and a.seat = p_seat
          and ((a.phase = g.phase and a.round = round_) or (a.phase = 'power' and a.round = g.day and g.phase in ('day', 'vote', 'revote')))),
    'victim', case when g.phase = 'witch' and me.card = 'witch' and me.alive and (me.charges ->> 'life')::integer > 0
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

-- ───────── AI players: the Dubaï powers too, from their own view only ─────────
create or replace function private.ww_bot_suspicion(p_view jsonb, p_memory jsonb, p_difficulty text, p_room uuid) returns jsonb
language plpgsql stable set search_path = public as $$
declare
  me integer := (p_view -> 'me' ->> 'seat')::integer;
  sus jsonb := '{}'::jsonb;
  p jsonb;
  e jsonb;
  k jsonb;
  s integer;
  victims integer[] := '{}';
  b record;
  noise double precision := case p_difficulty when 'beginner' then 3 when 'intermediate' then 1 else 0.4 end;
begin
  for p in select * from jsonb_array_elements(p_view -> 'players') loop
    s := (p ->> 'seat')::integer;
    if s <> me then
      sus := sus || jsonb_build_object(s::text, (('x' || substr(md5(p_room::text || me || ':' || s), 1, 6))::bit(24)::integer / 16777216.0) * noise);
    end if;
  end loop;
  for e in select * from jsonb_array_elements(p_view -> 'log') loop
    if e ->> 'kind' = 'morning' then
      select victims || coalesce(array_agg(x::integer), '{}') into victims from jsonb_array_elements_text(e -> 'data' -> 'dead') x;
    end if;
  end loop;
  if p_difficulty <> 'beginner' then
    for e in select * from jsonb_array_elements(p_view -> 'log') where value ->> 'kind' = 'votes' loop
      for b in select key::integer voter, value::text::integer target from jsonb_each(e -> 'data' -> 'ballots') loop
        if b.target = any (victims) and b.voter <> me and sus ? b.voter::text then
          sus := jsonb_set(sus, array[b.voter::text], to_jsonb((sus ->> b.voter::text)::numeric + 1.5));
        end if;
        if b.target = me and sus ? b.voter::text then
          sus := jsonb_set(sus, array[b.voter::text], to_jsonb((sus ->> b.voter::text)::numeric + 0.7));
        end if;
      end loop;
    end loop;
  end if;
  for k in select * from jsonb_array_elements(p_view -> 'me' -> 'known') loop
    if k ->> 'kind' = 'seer' and sus ? (k ->> 'seat') then
      sus := jsonb_set(sus, array[k ->> 'seat'], to_jsonb(case when k ->> 'card' in ('werewolf') then 100 else -100 end));
    elsif k ->> 'kind' = 'probe' and sus ? (k ->> 'seat') then
      sus := jsonb_set(sus, array[k ->> 'seat'], to_jsonb(case when (k ->> 'escroc')::boolean then 100 else -60 end));
    elsif k ->> 'kind' = 'network' and sus ? (k ->> 'seat') then
      sus := jsonb_set(sus, array[k ->> 'seat'], to_jsonb(case when k ->> 'faction' = 'escrocs' then 100 else -60 end));
    elsif k ->> 'kind' = 'hint' then
      for s in select x::integer from jsonb_array_elements_text(k -> 'seats') x loop
        if sus ? s::text then sus := jsonb_set(sus, array[s::text], to_jsonb((sus ->> s::text)::numeric + 2)); end if;
      end loop;
    end if;
  end loop;
  if p_view -> 'me' ->> 'lover' is not null and sus ? (p_view -> 'me' ->> 'lover') then
    sus := jsonb_set(sus, array[p_view -> 'me' ->> 'lover'], to_jsonb(-50));
  end if;
  for k in select * from jsonb_each(coalesce(p_memory -> 'accused_by', '{}')) loop
    if sus ? k.key then sus := jsonb_set(sus, array[k.key], to_jsonb((sus ->> k.key)::numeric + (k.value::text)::numeric)); end if;
  end loop;
  return sus;
end $$;
revoke all on function private.ww_bot_suspicion(jsonb, jsonb, text, uuid) from public, anon, authenticated;

create or replace function private.ww_bots_act(p_room uuid) returns void
language plpgsql volatile security definer set search_path = public, private as $$
declare
  g private.ww_games;
  b private.ww_players;
  v jsonb;
  sus jsonb;
  opt jsonb;
  kind_ text;
  t integer;
  t2 integer;
  r double precision;
  diff text;
  top integer;
  top_score numeric;
  pack jsonb;
  claim jsonb;
  said integer := 0;
begin
  select * into g from private.ww_games where room_id = p_room;
  diff := coalesce(g.difficulty, 'intermediate');
  for b in select * from private.ww_players where room_id = p_room and bot and alive order by seat loop
    v := private.ww_view_for(p_room, b.seat);
    sus := private.ww_bot_suspicion(v, b.memory, diff, p_room);
    pack := v -> 'me' -> 'pack';
    for opt in select * from jsonb_array_elements(v -> 'options') loop
      kind_ := opt ->> 'kind';
      t := null; t2 := null;
      r := private.ww_rand();
      if kind_ = 'wolf' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          order by -(select count(*) from jsonb_array_elements(v -> 'log') e, jsonb_each(e -> 'data' -> 'ballots') bb
            where e ->> 'kind' = 'votes' and bb.key = c::text and pack @> bb.value), md5(p_room::text || g.night || c::text) limit 1;
      elsif kind_ = 'seer' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          where not exists (select 1 from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'kind' = 'seer' and k ->> 'seat' = c::text)
          order by case when diff = 'beginner' then random() else -coalesce((sus ->> c::text)::numeric, 0) end limit 1;
      elsif kind_ in ('protect', 'shield') then
        if kind_ = 'shield' and r > (case diff when 'beginner' then 0.3 else 0.45 end) then kind_ := null;
        else select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
        end if;
      elsif kind_ = 'visa' then
        if g.night >= 2 and r < 0.4 then t := b.seat; else kind_ := null; end if;
      elsif kind_ in ('stay', 'bluff') then
        if not (g.night >= 2 and r < 0.35) then kind_ := null; end if;
      elsif kind_ in ('probe', 'story') then
        if diff = 'beginner' or g.night >= 2 or r < 0.5 then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
            where not exists (select 1 from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'seat' = c::text)
            order by case when diff = 'beginner' then random() else -coalesce((sus ->> c::text)::numeric, 0) end limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'listing' then
        -- Covers a fellow Escroc (the one most voted against so far), sometimes.
        if r < 0.35 and pack is not null then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c where pack @> c order by random() limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'watch' then
        t := private.ww_bot_pick(sus, opt -> 'targets');
      elsif kind_ in ('crush', 'seduce') then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
      elsif kind_ = 'buzz' then
        if g.phase = 'vote' and r < 0.3 then t := private.ww_bot_pick(sus, opt -> 'targets', false); else kind_ := null; end if;
      elsif kind_ = 'board' then
        if g.day >= 2 and r < 0.35 then null; else kind_ := null; end if;
      elsif kind_ = 'fresh' then
        if not (g.phase = 'vote' and r < 0.15) then kind_ := null; end if;
      elsif kind_ = 'dump' then
        if g.phase = 'vote' and r < 0.3 then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c where pack is null or not pack @> c
            order by -coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'shoot' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        top_score := coalesce((sus ->> top::text)::numeric, 0);
        if (diff = 'beginner' and g.night >= 2 and r < 0.25) or (diff = 'intermediate' and top_score >= 4) or (diff = 'expert' and top_score >= 3) then t := top; end if;
      elsif kind_ = 'hint' then
        if g.night >= (case diff when 'beginner' then 1 else 2 end) then kind_ := 'hint'; else kind_ := null; end if;
      elsif kind_ = 'link' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
        select (c::text)::integer into t2 from jsonb_array_elements(opt -> 'targets') c where (c::text)::integer <> t order by random() limit 1;
      elsif kind_ = 'steal' then
        select (i - 1)::integer into t from jsonb_array_elements_text(opt -> 'cards') with ordinality c(card, i)
          where card not in ('villager', 'thief')
          order by array_position(array['seer', 'witch', 'werewolf', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder'], card) limit 1;
        if t is null then t := -1; end if;
      elsif kind_ = 'heal' then
        if not ((diff = 'beginner' and r < 0.5) or diff = 'expert' or (diff = 'intermediate' and g.night <= 2)) then kind_ := null; else t := (opt -> 'targets' ->> 0)::integer; end if;
      elsif kind_ = 'poison' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        if coalesce((sus ->> top::text)::numeric, 0) >= (case diff when 'beginner' then 99 when 'intermediate' then 4 else 3 end) then t := top; else kind_ := null; end if;
      elsif kind_ = 'ready' then
        null;
      elsif kind_ = 'vote' then
        if pack is not null then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c where not pack @> c
            order by -coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
        else
          t := private.ww_bot_pick(sus, opt -> 'targets');
          if diff = 'beginner' and r < 0.4 then select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1; end if;
        end if;
      else
        kind_ := null;
      end if;
      if kind_ is null or (jsonb_array_length(opt -> 'targets') > 0 and t is null) or (kind_ = 'link' and (t is null or t2 is null)) then
        continue;
      end if;
      begin
        perform private.ww_submit(p_room, b.seat, kind_, t, t2);
      exception when others then
        null;
      end;
    end loop;
    if exists (select 1 from jsonb_array_elements(v -> 'options') o where not ((o ->> 'kind') = any (private.ww_day_powers()))) and not exists (
        select 1 from private.ww_actions a where a.room_id = p_room and a.seat = b.seat and a.phase = g.phase
          and a.round = case when g.phase in ('night', 'witch') then g.night else g.day end
          and (g.phase not in ('vote', 'revote') or a.kind in ('vote', 'pass'))) then
      perform private.ww_submit(p_room, b.seat, case when g.phase = 'day' then 'ready' else 'pass' end, null, null);
    end if;
    if g.phase = 'day' and g.kind = 'training' and said < 4 and private.ww_rand() < (case diff when 'beginner' then 0.45 else 0.65 end) then
      top := private.ww_bot_pick(sus, (select jsonb_agg(p -> 'seat') from jsonb_array_elements(v -> 'players') p
        where (p ->> 'alive')::boolean and (p ->> 'seat')::integer <> b.seat and (pack is null or not pack @> (p -> 'seat'))));
      select k into claim from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'kind' = 'seer' and k ->> 'card' = 'werewolf'
        and exists (select 1 from jsonb_array_elements(v -> 'players') p where p ->> 'seat' = k ->> 'seat' and (p ->> 'alive')::boolean) limit 1;
      if claim is not null and diff = 'expert' then
        perform private.ww_bot_say(p_room, b.seat, 'claim_seer_wolf', jsonb_build_object('target', (claim ->> 'seat')::integer), 'all', 4 + said * 7);
      elsif top is not null then
        perform private.ww_bot_say(p_room, b.seat, (array['accuse', 'doubt', 'watch', 'vote_for'])[1 + floor(private.ww_rand() * 4)::integer],
          jsonb_build_object('target', top), 'all', 4 + said * 7);
      else
        perform private.ww_bot_say(p_room, b.seat, 'unsure', '{}', 'all', 4 + said * 7);
      end if;
      said := said + 1;
    end if;
    if g.phase = 'night' and pack is not null and g.kind = 'training' and private.ww_rand() < 0.5 then
      perform private.ww_bot_say(p_room, b.seat, 'pack_plan', '{}', 'wolves', 3);
    end if;
  end loop;
end $$;
revoke all on function private.ww_bots_act(uuid) from public, anon, authenticated;

-- ───────── Public functions: the mode is chosen at creation ─────────
drop function if exists public.ww_create(text, text, integer, text, jsonb, text, text);
create or replace function public.ww_create(p_space text, p_visibility text default 'public', p_size integer default 8,
  p_kind text default 'online', p_composition jsonb default null, p_title text default null, p_lang text default 'fr',
  p_mode text default 'classic') returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  c text;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_kind not in ('online', 'irl') then raise exception 'online or in person' using errcode = '22023'; end if;
  if p_visibility not in ('public', 'private') then raise exception 'public or private' using errcode = '22023'; end if;
  if p_mode not in ('classic', 'dubai') then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_lang not in ('en', 'fr') then raise exception 'language: en or fr' using errcode = '22023'; end if;
  if (select count(*) from public.game_rooms r join public.game_participants gp on gp.room_id = r.id and gp.user_id = me and gp.left_at is null
      where r.status in ('waiting', 'playing')) >= 3 then
    raise exception 'you are already in three games' using errcode = '22023';
  end if;
  if p_composition is not null then perform private.ww_check_for(p_mode, p_size, p_composition); end if;
  c := case when p_visibility = 'private' or p_kind = 'irl' then private.game_new_code() end;
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind)
    values ('werewolf', sp, me, nullif(btrim(coalesce(p_title, '')), ''), case when p_kind = 'irl' then 'private' else p_visibility end, c, p_lang, p_size, p_kind)
    returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition, mode) values (rid, p_kind, p_size, p_composition, p_mode);
  return jsonb_build_object('id', rid, 'code', c);
end $$;
revoke all on function public.ww_create(text, text, integer, text, jsonb, text, text, text) from public, anon;
grant execute on function public.ww_create(text, text, integer, text, jsonb, text, text, text) to authenticated;

drop function if exists public.ww_training(text, integer, text, text);
create or replace function public.ww_training(p_space text, p_size integer default 8, p_role text default null,
  p_difficulty text default 'intermediate', p_mode text default 'classic') returns uuid
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  sp text := private.game_scope(p_space);
  rid uuid;
  comp jsonb;
  plain text;
begin
  if not private.game_space_ok(sp, me) then raise exception 'IRLY Girl games are for IRLY Girl members' using errcode = '42501'; end if;
  if p_mode not in ('classic', 'dubai') then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_difficulty not in ('beginner', 'intermediate', 'expert') then raise exception 'difficulty: beginner, intermediate or expert' using errcode = '22023'; end if;
  comp := private.ww_default_for(p_mode, p_size);
  if p_role is not null then
    if not (p_role = any (private.ww_mode_roles(p_mode))) then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    -- A role not in the default deck takes a plain card's place (villager, expat; an Escroc's for an Escrocs' card).
    if not comp ? p_role then
      plain := case when p_mode = 'dubai' then case when private.ww_camp(p_role) = 'wolves' then 'escroc' else 'expat' end else 'villager' end;
      if coalesce((comp ->> plain)::integer, 0) < 1 or (plain = 'escroc' and (comp ->> 'escroc')::integer < 1) then
        raise exception 'composition: that role cannot be added at this size' using errcode = '22023';
      end if;
      comp := comp || jsonb_build_object(p_role, 1, plain, (comp ->> plain)::integer - 1 + case when p_role = 'thief' then 2 else 0 end);
      if (comp ->> plain)::integer = 0 then comp := comp - plain; end if;
    end if;
    -- Training lets a member try any card: the size caps are not applied to her own choice.
    if p_mode = 'classic' then perform private.ww_check_composition(p_size, comp); end if;
  end if;
  update public.game_rooms r set status = 'abandoned', finished_at = now(), updated_at = now()
    where r.kind = 'training' and r.host_id = me and r.status in ('waiting', 'playing');
  insert into public.game_rooms (game, space, host_id, title, visibility, code, lang, max_players, kind, status)
    values ('werewolf', sp, me, null, 'private', null, 'fr', p_size, 'training', 'waiting') returning id into rid;
  insert into public.game_participants (room_id, user_id, seat) values (rid, me, 0);
  insert into private.ww_games (room_id, kind, size, composition, difficulty, human_role, mode) values (rid, 'training', p_size, comp, p_difficulty, p_role, p_mode);
  perform private.ww_start(rid);
  return rid;
end $$;
revoke all on function public.ww_training(text, integer, text, text, text) from public, anon;
grant execute on function public.ww_training(text, integer, text, text, text) to authenticated;

create or replace function public.ww_view(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := auth.uid();
  seat_ integer;
  g private.ww_games;
  fits boolean;
begin
  if me is null then raise exception 'sign in to play' using errcode = '42501'; end if;
  select * into g from private.ww_games where room_id = p_room;
  if not found or not private.game_can_read(p_room) then raise exception 'this game no longer exists' using errcode = 'P0002'; end if;
  perform private.ww_advance(p_room);
  select * into g from private.ww_games where room_id = p_room;
  if g.phase = 'lobby' then
    seat_ := (select count(*) from public.game_participants gp where gp.room_id = p_room and gp.left_at is null);
    fits := g.composition is not null and private.ww_card_count(g.composition) = greatest(seat_, 6) + private.ww_extra_cards(g.composition);
    return jsonb_build_object('phase', 'lobby', 'kind', g.kind, 'size', g.size, 'mode', g.mode, 'ranked', g.ranked, 'present', seat_,
      'custom', fits,
      'composition', case when fits then g.composition else private.ww_default_for(g.mode, greatest(seat_, 6)) end);
  end if;
  seat_ := private.ww_my_seat(p_room);
  if seat_ is null then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  return private.ww_view_for(p_room, seat_);
end $$;
revoke all on function public.ww_view(uuid) from public, anon;
grant execute on function public.ww_view(uuid) to authenticated;

create or replace function public.ww_set_composition(p_room uuid, p_composition jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public, private as $$
declare
  me uuid := private.game_me();
  n integer;
  comp jsonb;
  mode_ text;
begin
  if (select host_id from public.game_rooms where id = p_room) is distinct from me then raise exception 'only the host can do this' using errcode = '42501'; end if;
  if (select phase from private.ww_games where room_id = p_room) is distinct from 'lobby' then raise exception 'this game has already started' using errcode = '22023'; end if;
  select mode into mode_ from private.ww_games where room_id = p_room;
  n := private.ww_card_count(p_composition) - private.ww_extra_cards(p_composition);
  if p_composition is not null and n not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  comp := case when p_composition is null then null else private.ww_check_for(mode_, n, p_composition) end;
  update private.ww_games set composition = comp where room_id = p_room;
  perform private.ww_touch(p_room);
  return comp;
end $$;
revoke all on function public.ww_set_composition(uuid, jsonb) from public, anon;
grant execute on function public.ww_set_composition(uuid, jsonb) to authenticated;
