-- IRLY Loup-Garou V3: the AI players use every card of every mode, from their own view only (V3 §11).
-- Same function as 20261113000000_irly_werewolf_dubai, with the V3 cards added; a deterministic fallback
-- (pass, or ready by day) keeps a game moving whatever the card.
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
      -- ───── V3 cards (docs/LOUP-GAROU-V3.md, « IA ») ─────
      elsif kind_ in ('detect', 'hack', 'visit') then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          where not exists (select 1 from jsonb_array_elements(v -> 'me' -> 'known') k where k ->> 'seat' = c::text)
          order by case when diff = 'beginner' then random() else -coalesce((sus ->> c::text)::numeric, 0) end limit 1;
        if t is null then select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1; end if;
      elsif kind_ in ('omen', 'spy') then
        if r < 0.6 then t := private.ww_bot_pick(sus, opt -> 'targets'); else kind_ := null; end if;
      elsif kind_ in ('sabotage', 'web') then
        if r < 0.5 then t := private.ww_bot_pick(sus, opt -> 'targets'); else kind_ := null; end if;
      elsif kind_ = 'mark' then
        if g.night >= 2 or r < 0.4 then t := private.ww_bot_pick(sus, opt -> 'targets'); else kind_ := null; end if;
      elsif kind_ in ('gamble', 'copy', 'disguise') then
        if r < (case kind_ when 'disguise' then 0.3 else 0.55 end) then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'hide' then
        if r >= 0.3 then kind_ := null; end if;
      elsif kind_ = 'scam' then
        if g.night >= 2 and r < 0.4 then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'exchange' then
        if r < 0.4 then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1;
          select (c::text)::integer into t2 from jsonb_array_elements(opt -> 'targets') c where (c::text)::integer <> t order by random() limit 1;
        else kind_ := null; end if;
      elsif kind_ in ('bite', 'guard') then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
      elsif kind_ = 'exorcise' then
        if r < 0.35 then select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by random() limit 1; else kind_ := null; end if;
      elsif kind_ = 'bounty' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        top_score := coalesce((sus ->> top::text)::numeric, 0);
        if (diff = 'beginner' and g.night >= 2 and r < 0.2) or (diff = 'intermediate' and top_score >= 4) or (diff = 'expert' and top_score >= 3) then t := top; else kind_ := null; end if;
      elsif kind_ = 'predict_wolf' then
        top := private.ww_bot_pick(sus, opt -> 'targets');
        if coalesce((sus ->> top::text)::numeric, 0) >= 1.2 then t := top; else kind_ := null; end if;
      elsif kind_ = 'predict_village' then
        if exists (select 1 from private.ww_actions x where x.room_id = p_room and x.phase = 'night' and x.round = g.night and x.seat = b.seat and x.kind = 'predict_wolf') then kind_ := null;
        else select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c order by coalesce((sus ->> c::text)::numeric, 0), random() limit 1;
        end if;
      elsif kind_ = 'dig' then
        select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c
          where not exists (select 1 from jsonb_array_elements(v -> 'log') e where e ->> 'kind' = 'dig_result' and e -> 'data' ->> 'seat' = c::text)
          order by random() limit 1;
        if t is null then kind_ := null; end if;
      elsif kind_ = 'forge' then
        if r < 0.4 and pack is not null then
          select (c::text)::integer into t from jsonb_array_elements(opt -> 'targets') c where pack @> c order by random() limit 1;
        else kind_ := null; end if;
      elsif kind_ = 'mute' then
        if g.phase = 'vote' and r < 0.4 then t := private.ww_bot_pick(sus, opt -> 'targets'); else kind_ := null; end if;
      elsif kind_ = 'bribe' then
        if not (g.phase = 'vote' and r < 0.4) then kind_ := null; end if;
      elsif kind_ = 'plead' then
        if g.phase = 'vote' and r < 0.5 then t := b.seat; else kind_ := null; end if;
      elsif kind_ = 'decree' then
        if r >= 0.8 then kind_ := null; end if;
      else
        kind_ := null;
      end if;
      if kind_ is null or (jsonb_array_length(opt -> 'targets') > 0 and t is null) or (kind_ in ('link', 'exchange') and (t is null or t2 is null)) then
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
