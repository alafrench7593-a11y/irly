import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * IRLY Loup-Garou on the server (supabase/migrations/20261112000000_irly_werewolf.sql).
 * The phone reads its player's view (never the other cards) and sends intentions.
 */

export type WwPhase = 'lobby' | 'night' | 'witch' | 'day' | 'vote' | 'revote' | 'ended';
export type WwOption = { kind: string; targets: number[]; cards?: string[] };
export type WwPlayer = { seat: number; name: string; bot: boolean; user_id: string | null; alive: boolean; acted: boolean };
export type WwLog = { id: number; at: string; kind: string; data: Record<string, unknown>; audience: string };
export type WwKnown = { kind: 'seer' | 'hint'; night: number; seat?: number; card?: string; seats?: number[] };
export type WwResultCard = { seat: number; name: string; bot: boolean; card: string; camp: string; alive: boolean; death: string | null; lover: number | null; won: boolean };

export type WwView = {
  phase: WwPhase;
  night?: number;
  day?: number;
  deadline?: string | null;
  now?: string;
  kind: 'online' | 'training' | 'irl';
  mode: string;
  size: number;
  ranked: boolean;
  difficulty?: string | null;
  composition: Record<string, number>;
  /** Lobby only: players there now, and whether the host's deck is the one used. */
  present?: number;
  custom?: boolean;
  me?: { seat: number; card: string; camp: 'village' | 'wolves'; alive: boolean; charges: Record<string, number | null>; lover: number | null; known: WwKnown[]; pack: number[] | null };
  players?: WwPlayer[];
  options?: WwOption[];
  mine?: { kind: string; target: number | null; target2: number | null }[];
  victim?: number | null;
  pack_votes?: Record<string, number> | null;
  revote?: number[] | null;
  result?: { winner: 'village' | 'wolves' | 'lovers' | 'draw'; seats: number[]; ranked: boolean } | null;
  log?: WwLog[];
};

const spaceArg = (space: string) => (space === 'girl' ? 'girl' : 'mixte');

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Sign in to play');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const wwCreate = (space: string, opts: { kind: 'online' | 'irl'; visibility: 'public' | 'private'; size: number; title?: string; lang: 'en' | 'fr' }) =>
  rpc<{ id: string; code: string | null }>('ww_create', {
    p_space: spaceArg(space),
    p_visibility: opts.visibility,
    p_size: opts.size,
    p_kind: opts.kind,
    p_composition: null,
    p_title: opts.title?.trim() || null,
    p_lang: opts.lang,
  });
export const wwTraining = (space: string, size: number, role: string | null, difficulty: 'beginner' | 'intermediate' | 'expert') =>
  rpc<string>('ww_training', { p_space: spaceArg(space), p_size: size, p_role: role, p_difficulty: difficulty });
export const wwAct = (room: string, kind: string, target?: number | null, target2?: number | null) =>
  rpc<void>('ww_act', { p_room: room, p_kind: kind, p_target: target ?? null, p_target2: target2 ?? null });
export const wwSay = (room: string, body: string, channel: 'all' | 'wolves' | 'dead') => rpc<void>('ww_say', { p_room: room, p_body: body, p_channel: channel });
export const wwSetComposition = (room: string, composition: Record<string, number> | null) => rpc<Record<string, number>>('ww_set_composition', { p_room: room, p_composition: composition });
export const wwSkipDay = (room: string) => rpc<void>('ww_skip_day', { p_room: room });

/**
 * My player's view of a game: read again when the room changes (realtime),
 * every 3 s while it runs (the clock, AI players), and when its phase's time is up.
 */
export function useWwView(roomId: string | undefined, changed: unknown) {
  const [view, setView] = useState<WwView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [skew, setSkew] = useState(0);
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!roomId || !supabase) return;
    const n = ++seq.current;
    rpc<WwView>('ww_view', { p_room: roomId })
      .then((v) => {
        if (n !== seq.current) return;
        setView(v);
        if (v.now) setSkew(Date.parse(v.now) - Date.now());
        setFailed(null);
      })
      .catch((e: Error) => {
        if (n === seq.current) setFailed(e.message);
      });
  }, [roomId]);
  useEffect(() => {
    load();
  }, [load, changed]);
  const running = view ? view.phase !== 'lobby' && view.phase !== 'ended' : false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [running, load]);
  return { view, failed, reload: load, skew };
}
