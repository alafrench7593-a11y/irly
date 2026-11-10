import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * A game shared in a community or on the Live
 * (supabase/migrations/20261118000000_irly_game_share.sql): one community
 * post that carries the room. What a post shows is read from the room itself,
 * again every few seconds while it is on screen: players, seats, status.
 */

/** The words the server gives a shared game's post: how a post card knows to ask for the game. */
export const GAME_SHARE_MARK = '🐺 Loup-Garou';

export type GameShareStatus = 'waiting' | 'full' | 'playing' | 'finished' | 'cancelled';
export type GameShare = {
  room_id: string;
  game: string;
  kind: string;
  title: string | null;
  visibility: 'public' | 'private';
  max: number;
  host: string | null;
  host_id: string | null;
  mode: string | null;
  comm: 'text' | 'voice' | null;
  players: number;
  status: GameShareStatus;
  mine: boolean;
};

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Sign in to play');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Publishes the game in a community (and on the Live with `live`). The same post if it is already there. */
export const shareGame = (room: string, community: string, live: boolean) => rpc<string>('game_share', { p_room: room, p_community: community, p_live: live });
/** Joins the game a post shares; the server checks everything again. */
export const joinSharedGame = (post: string) => rpc<string>('game_join_shared', { p_post: post });

// Every card on screen asks in the same request.
const waiting = new Map<string, ((card: GameShare | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;
function ask(post: string): Promise<GameShare | null> {
  return new Promise((resolve) => {
    waiting.set(post, [...(waiting.get(post) ?? []), resolve]);
    timer ??= setTimeout(() => {
      timer = null;
      const batch = new Map(waiting);
      waiting.clear();
      rpc<Record<string, GameShare>>('game_share_cards', { p_posts: [...batch.keys()] })
        .then((cards) => batch.forEach((fns, id) => fns.forEach((fn) => fn(cards?.[id] ?? null))))
        .catch(() => batch.forEach((fns) => fns.forEach((fn) => fn(null))));
    }, 30);
  });
}

const REFRESH_MS = 8000;

/** The shared game of a post, kept up to date while the card is shown; null when the post shares no game I may see. */
export function useGameShare(post: string | null): { card: GameShare | null; loaded: boolean; reload: () => void } {
  const [card, setCard] = useState<GameShare | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!post) return;
    let live = true;
    ask(post).then((c) => {
      if (!live) return;
      setCard(c);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [post, tick]);
  // A game that is over or cancelled no longer changes.
  const moving = card ? card.status === 'waiting' || card.status === 'full' || card.status === 'playing' : false;
  useEffect(() => {
    if (!post || !moving) return;
    const t = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(t);
  }, [post, moving]);
  return { card, loaded, reload: () => setTick((n) => n + 1) };
}
