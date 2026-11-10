-- IRLY Loup-Garou, étape B du livre V3: the Chaos, Nightmare, Manipulation and Hybrid cards, and the
-- official modes that play them (Chaos, Nightmare, Manipulation, Nightmare Chaos, Manipulation Chaos,
-- Nightmare Manipulation, Apocalypse). Rules and every default taken where the book is silent:
-- docs/LOUP-GAROU-V3.md. This file: the cards (camps, charges), the modes and their decks.
-- The engine that plays them is 20261116000100_irly_werewolf_v3_engine.sql.
--
-- The two modes shipped under the names « chaos » (a secret random Classic deck) and « nightmare »
-- (one more werewolf, no Seer) were not the book's: from here on those names are the book's modes.

alter table private.ww_games add column if not exists effects jsonb not null default '{}'::jsonb;

create or replace function private.ww_modes() returns text[]
language sql immutable as $$
  select array['classic', 'dubai', 'chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos',
    'nightmare_manipulation', 'apocalypse', 'powers']
$$;
alter table private.ww_games drop constraint if exists ww_games_mode_check;
alter table private.ww_games add constraint ww_games_mode_check check (mode in ('classic', 'dubai', 'chaos', 'nightmare', 'manipulation',
  'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse', 'powers'));

/** The modes played by the V3 engine (every mode but Classic, Dubaï and the « all powers » variant). */
create or replace function private.ww_is_v3(p_mode text) returns boolean
language sql immutable as $$
  select p_mode in ('chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse')
$$;

create or replace function private.ww_family_cards(p_family text) returns text[]
language sql immutable as $$
  select case p_family
    when 'chaos' then array['scammer', 'swapper', 'gambler', 'mirror', 'saboteur', 'chameleon', 'clown', 'shapeshifter', 'anomaly', 'ninja']
    when 'nightmare' then array['revenant', 'cursed', 'exorcist', 'possessed', 'reaper', 'spider', 'vampire', 'gravedigger', 'sleepwalker', 'dark_oracle']
    when 'manipulation' then array['manipulator', 'hacker', 'double_agent', 'corrupt', 'lawyer', 'paparazzi', 'usurper', 'spy', 'dictator']
    when 'hybrid' then array['bounty_hunter', 'detective', 'vigilante', 'prophet', 'guardian']
    else '{}'::text[] end
$$;

/** The families a mode plays, on top of the Classic cards (the hybrids come with the fusions and Apocalypse). */
create or replace function private.ww_mode_families(p_mode text) returns text[]
language sql immutable as $$
  select case p_mode
    when 'chaos' then array['chaos']
    when 'nightmare' then array['nightmare']
    when 'manipulation' then array['manipulation']
    when 'nightmare_chaos' then array['nightmare', 'chaos', 'hybrid']
    when 'manipulation_chaos' then array['manipulation', 'chaos', 'hybrid']
    when 'nightmare_manipulation' then array['nightmare', 'manipulation', 'hybrid']
    when 'apocalypse' then array['chaos', 'nightmare', 'manipulation', 'hybrid']
    else '{}'::text[] end
$$;

create or replace function private.ww_mode_roles(p_mode text) returns text[]
language sql immutable as $$
  select case when p_mode = 'dubai' then private.ww_dubai_roles()
    else private.ww_roles() || coalesce((select array_agg(c order by o, i)
      from unnest(private.ww_mode_families(p_mode)) with ordinality f(fam, o), unnest(private.ww_family_cards(fam)) with ordinality x(c, i)), '{}') end
$$;

create or replace function private.ww_camp(p_role text) returns text
language sql immutable as $$
  select case
    when p_role in ('werewolf', 'escroc', 'realtor', 'broker', 'double_agent', 'usurper') then 'wolves'
    when p_role in ('charo', 'fake_millionaire', 'clown', 'possessed', 'vampire') then 'solo'
    else 'village' end
$$;

/** What a card can still do. Charges follow the card (V3 §2); « progress » is the card's objective, reset by a permanent swap (V3 §7). */
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
    -- Dubaï.
    when 'entrepreneur' then '{"shield": 1}'
    when 'ecommerce' then '{"shield": 1}'
    when 'millionaire' then '{"life": 1}'
    when 'golden_visa' then '{"visa": 1}'
    when 'tourist' then '{"stay": 1}'
    when 'investor' then '{"probe": 1}'
    when 'emirati' then '{"probe": 1}'
    when 'networker' then '{"probe": 1}'
    when 'creator' then '{"story": 1}'
    when 'concierge' then '{"last": null}'
    when 'influencer' then '{"buzz": 1}'
    when 'ceo' then '{"board": 1}'
    when 'broker' then '{"dump": 1}'
    when 'realtor' then '{"listing": 1}'
    when 'fake_millionaire' then '{"bluff": 1}'
    when 'newcomer' then '{"fresh": 1}'
    when 'single' then '{"crush": 1}'
    when 'charo' then '{"last": null}'
    -- Chaos.
    when 'scammer' then '{"scam": 1}'
    when 'swapper' then '{"exchange": 1}'
    when 'gambler' then '{"gamble": 1}'
    when 'mirror' then '{"mirror": 1}'
    when 'saboteur' then '{"sabotage": 2}'
    when 'chameleon' then '{"copy": 1}'
    when 'shapeshifter' then '{"disguise": 2}'
    when 'ninja' then '{"hide": 2}'
    -- Nightmare.
    when 'revenant' then '{"revive": 1}'
    when 'cursed' then '{"curse": 1}'
    when 'exorcist' then '{"exorcise": 2}'
    when 'possessed' then '{"prey": null}'
    when 'reaper' then '{"mark": 1}'
    when 'spider' then '{"web": 2}'
    when 'vampire' then '{"servants": []}'
    when 'dark_oracle' then '{"omen": 2}'
    -- Manipulation.
    when 'manipulator' then '{"mute": 1}'
    when 'corrupt' then '{"bribe": 1}'
    when 'lawyer' then '{"plead": 1}'
    when 'usurper' then '{"forge": 1}'
    when 'spy' then '{"spy": 2}'
    when 'dictator' then '{"decree": 1}'
    -- Hybrids.
    when 'bounty_hunter' then '{"bounty": 2, "progress": 0}'
    when 'detective' then '{"progress": 0, "found": []}'
    when 'vigilante' then '{"progress": 0}'
    when 'prophet' then '{"progress": 0}'
    when 'guardian' then '{"progress": 0}'
    else '{}' end::jsonb
$$;

-- Dubaï's charges were defined in 20261113000000 with the same values; this keeps one function for every card.
do $$
declare r text;
begin
  foreach r in array private.ww_dubai_roles() loop
    if private.ww_fresh_charges(r) is null then raise exception 'ww v3: no charges for %', r; end if;
  end loop;
end $$;

/** Cards with a power used at night on one's own: the only ones the Échangeur can swap and the Caméléon can copy. */
create or replace function private.ww_active_cards() returns text[]
language sql immutable as $$
  select array['seer', 'salvateur', 'hunter', 'little_girl', 'witch', 'gambler', 'saboteur', 'shapeshifter', 'ninja', 'exorcist', 'reaper', 'spider',
    'gravedigger', 'sleepwalker', 'dark_oracle', 'hacker', 'usurper', 'spy', 'bounty_hunter', 'detective', 'prophet', 'guardian']
$$;

create or replace function private.ww_day_powers() returns text[]
language sql immutable as $$ select array['buzz', 'board', 'fresh', 'dump', 'mute', 'bribe', 'plead', 'decree'] $$;

/**
 * The deck of a V3 mode for p_size players (docs/LOUP-GAROU-V3.md, « Compositions »): the usual number of
 * wolves (one is the Agent double from 8 players and one the Usurpateur from 12, where the mode has them),
 * the Seer, then special cards drawn from the mode's families (one of each family at least, the rest from
 * the families and the Classic specials), villagers for the rest (one at least per five players).
 * Solo cards: none under 8 players, one under 12, two from 12.
 */
create or replace function private.ww_v3_composition(p_mode text, p_size integer) returns jsonb
language plpgsql volatile as $$
declare
  fams text[] := private.ww_mode_families(p_mode);
  wolves integer := private.ww_wolves_for(p_size);
  villagers integer := greatest(1, p_size / 5);
  slots integer;
  solo_cap integer := case when p_size < 8 then 0 when p_size < 12 then 1 else 2 end;
  solo_n integer := 0;
  c jsonb := '{}'::jsonb;
  fam text;
  card text;
  pool text[];
begin
  if 'manipulation' = any (fams) and p_size >= 8 then c := c || '{"double_agent": 1}'; wolves := wolves - 1; end if;
  if 'manipulation' = any (fams) and p_size >= 12 then c := c || '{"usurper": 1}'; wolves := wolves - 1; end if;
  c := c || jsonb_build_object('werewolf', wolves) || '{"seer": 1}';
  slots := p_size - private.ww_wolves_for(p_size) - villagers - 1;
  -- One card of each family first.
  foreach fam in array fams loop
    exit when slots <= 0;
    select x into card from unnest(private.ww_family_cards(fam)) x
      where not c ? x and private.ww_camp(x) <> 'wolves' and (private.ww_camp(x) <> 'solo' or solo_n < solo_cap) order by random() limit 1;
    if card is not null then
      c := c || jsonb_build_object(card, 1);
      slots := slots - 1;
      if private.ww_camp(card) = 'solo' then solo_n := solo_n + 1; end if;
    end if;
  end loop;
  -- Then from the families (twice as likely) and the Classic specials.
  while slots > 0 loop
    select array_agg(x) into pool from (
      select x from unnest(fams) f, unnest(private.ww_family_cards(f)) x
      union all select x from unnest(fams) f, unnest(private.ww_family_cards(f)) x
      union all select unnest(array['witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder'])) q
      where not c ? x and private.ww_camp(x) <> 'wolves' and (private.ww_camp(x) <> 'solo' or solo_n < solo_cap);
    exit when pool is null;
    card := pool[1 + floor(random() * cardinality(pool))::integer];
    c := c || jsonb_build_object(card, 1);
    slots := slots - 1;
    if private.ww_camp(card) = 'solo' then solo_n := solo_n + 1; end if;
  end loop;
  return c || jsonb_build_object('villager', villagers + slots);
end $$;

/** A deck sent by a host for a V3 mode, checked (cards of the mode, one of each special, wolves fewer than half, the solo cap). */
create or replace function private.ww_v3_check(p_mode text, p_size integer, p_comp jsonb) returns jsonb
language plpgsql volatile as $$
declare
  k text;
  v jsonb;
  total integer := 0;
  wolves integer := 0;
  solos integer := 0;
  out_ jsonb := '{}'::jsonb;
begin
  if p_comp is null then return private.ww_v3_composition(p_mode, p_size); end if;
  if jsonb_typeof(p_comp) <> 'object' then raise exception 'composition: a list of cards' using errcode = '22023'; end if;
  for k, v in select * from jsonb_each(p_comp) loop
    if not (k = any (private.ww_mode_roles(p_mode))) or k = 'thief' then raise exception 'composition: unknown card' using errcode = '22023'; end if;
    if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::integer < 0 then
      raise exception 'composition: a whole number per card' using errcode = '22023';
    end if;
    if k not in ('werewolf', 'villager') and (v::text)::integer > 1 then raise exception 'composition: one of each special card' using errcode = '22023'; end if;
    if (v::text)::integer > 0 then out_ := out_ || jsonb_build_object(k, (v::text)::integer); end if;
    total := total + (v::text)::integer;
    if private.ww_camp(k) = 'wolves' then wolves := wolves + (v::text)::integer; end if;
    if private.ww_camp(k) = 'solo' then solos := solos + (v::text)::integer; end if;
  end loop;
  if wolves < 1 then raise exception 'composition: at least one werewolf' using errcode = '22023'; end if;
  if wolves * 2 >= p_size then raise exception 'composition: werewolves must be fewer than half the players' using errcode = '22023'; end if;
  if total <> p_size then raise exception 'composition: one card per player (two more with the thief)' using errcode = '22023'; end if;
  if total - wolves - solos < 1 then raise exception 'composition: at least one villager card' using errcode = '22023'; end if;
  return out_;
end $$;

create or replace function private.ww_default_for(p_mode text, p_size integer) returns jsonb
language sql volatile as $$
  select case
    when p_mode = 'dubai' then private.ww_dubai_composition(p_size)
    when p_mode = 'powers' then private.ww_powers_composition(p_size)
    when private.ww_is_v3(p_mode) then private.ww_v3_composition(p_mode, p_size)
    else private.ww_default_composition(p_size) end
$$;

create or replace function private.ww_check_for(p_mode text, p_size integer, p_comp jsonb) returns jsonb
language plpgsql volatile as $$
begin
  if private.ww_is_v3(p_mode) then return private.ww_v3_check(p_mode, p_size, p_comp); end if;
  return case when p_mode = 'dubai' then private.ww_dubai_check(p_size, p_comp) else private.ww_check_composition(p_size, p_comp) end;
end $$;

do $$
declare f text;
begin
  foreach f in array array['private.ww_modes()', 'private.ww_is_v3(text)', 'private.ww_family_cards(text)', 'private.ww_mode_families(text)',
    'private.ww_mode_roles(text)', 'private.ww_camp(text)', 'private.ww_fresh_charges(text)', 'private.ww_active_cards()', 'private.ww_day_powers()',
    'private.ww_v3_composition(text, integer)', 'private.ww_v3_check(text, integer, jsonb)', 'private.ww_default_for(text, integer)',
    'private.ww_check_for(text, integer, jsonb)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ───────── Training: any card of the mode; the lobby shows the deck of every mode ─────────
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
  if not (p_mode = any (private.ww_modes())) then raise exception 'this mode is not available yet' using errcode = '22023'; end if;
  if p_size is null or p_size not between 6 and 20 then raise exception 'Loup-Garou: 6 to 20 players' using errcode = '22023'; end if;
  if p_difficulty not in ('beginner', 'intermediate', 'expert') then raise exception 'difficulty: beginner, intermediate or expert' using errcode = '22023'; end if;
  comp := private.ww_default_for(p_mode, p_size);
  if p_role is not null then
    if not (p_role = any (private.ww_mode_roles(p_mode))) or (p_role = 'thief' and private.ww_is_v3(p_mode)) then
      raise exception 'composition: unknown card' using errcode = '22023';
    end if;
    -- A role not in the deck takes the place of a card of its own side: a plain one first (villager, expat, werewolf,
    -- escroc), else, in the V3 modes, another special card of that side. Training lets a member try any card:
    -- the size caps are not applied to her own choice.
    if not comp ? p_role then
      plain := case when p_mode = 'dubai' then case when private.ww_camp(p_role) = 'wolves' then 'escroc' else 'expat' end
        else case when private.ww_camp(p_role) = 'wolves' then 'werewolf' else 'villager' end end;
      if plain = 'werewolf' and p_role = 'werewolf' then plain := 'villager'; end if;
      if coalesce((comp ->> plain)::integer, 0) < 1 or (plain in ('escroc', 'werewolf') and (comp ->> plain)::integer < 2 and not exists (
          select 1 from jsonb_object_keys(comp) k where k <> plain and private.ww_camp(k) = 'wolves')) then
        if not private.ww_is_v3(p_mode) then raise exception 'composition: that role cannot be added at this size' using errcode = '22023'; end if;
        select k into plain from jsonb_object_keys(comp) k
          where k not in ('werewolf', 'seer') and private.ww_camp(k) <> 'wolves' order by (private.ww_camp(k) = 'solo') desc, random() limit 1;
        if plain is null then raise exception 'composition: that role cannot be added at this size' using errcode = '22023'; end if;
      end if;
      comp := comp || jsonb_build_object(p_role, 1, plain, (comp ->> plain)::integer - 1 + case when p_role = 'thief' then 2 else 0 end);
      if (comp ->> plain)::integer = 0 then comp := comp - plain; end if;
    end if;
    if p_mode in ('classic', 'powers') then perform private.ww_check_composition(p_size, comp); end if;
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
    -- A V3 deck is drawn when the game starts (it depends on who is there): the lobby names the mode, not the cards.
    return jsonb_build_object('phase', 'lobby', 'kind', g.kind, 'size', g.size, 'mode', g.mode, 'ranked', g.ranked, 'present', seat_,
      'custom', fits,
      'composition', case when fits then g.composition when private.ww_is_v3(g.mode) then null else private.ww_default_for(g.mode, greatest(seat_, 6)) end);
  end if;
  seat_ := private.ww_my_seat(p_room);
  if seat_ is null then raise exception 'you are not playing in this game' using errcode = '42501'; end if;
  return private.ww_view_for(p_room, seat_);
end $$;
revoke all on function public.ww_view(uuid) from public, anon;
grant execute on function public.ww_view(uuid) to authenticated;
