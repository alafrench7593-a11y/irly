/**
 * Loup-Garou tables: what an open game screen asks (src/features/games/api.ts, werewolf/api.ts).
 * A running table is read every 5 s (the room, the player's view, the table's messages) and a waiting
 * one every 6 s; presence every 30 s; a living player votes now and then while the table is voting.
 * Each virtual user is one seat of one table prepared by the orchestrator.
 */
import { sleep } from 'k6';
import { SEATS, get, json, one, ordinal, rpc, skipped } from './lib.js';

export function werewolf() {
  if (!SEATS.length) {
    skipped.add(1);
    sleep(30);
    return;
  }
  const s = SEATS[ordinal() % SEATS.length];
  const g = 'werewolf';
  let pinged = 0;
  for (;;) {
    if (Date.now() - pinged > 30000) {
      pinged = Date.now();
      one(rpc(g, s.t, 'game_ping', { p_space: 'mixte', p_room: s.room }));
    }
    one(rpc(g, s.t, 'game_room', { p_room: s.room }));
    if (s.kind !== 'running') {
      sleep(6);
      continue;
    }
    const view = json(one(rpc(g, s.t, 'ww_view', { p_room: s.room })));
    one(get(g, 'game_messages', s.t, `select=id,room_id,user_id,kind,body,data,created_at,channel,seat&room_id=eq.${s.room}&order=id.desc&limit=80`));
    // The last seat never votes, so the vote stays open for the whole stage.
    if (view && view.phase === 'vote' && view.me && view.me.alive && s.seat < s.seats - 1 && Math.random() < 0.15) {
      const vote = (view.options || []).filter((o) => o.kind === 'vote')[0];
      const targets = vote && vote.targets ? vote.targets : [];
      if (targets.length) one(rpc(g, s.t, 'ww_act', { p_room: s.room, p_kind: 'vote', p_target: targets[Math.floor(Math.random() * targets.length)], p_target2: null }));
    }
    sleep(5);
  }
}
