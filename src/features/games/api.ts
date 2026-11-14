import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from 'expo-router';
import { AppState } from 'react-native';
import { useAccount } from '@/features/auth/account';
import { primeFaces } from '@/features/server/faces';
import { liveChannel, supabase, whenListening } from '@/lib/supabase';
import { useAppSpace } from '@/state/appSpace';

/**
 * IRLY Games on the server (supabase/migrations/20261111000000_irly_games.sql).
 * Every rule is the server's: the phone reads the room and asks for actions.
 * The counts shown are the server's real rows, never made up.
 */

export type GameId = 'ludo' | 'werewolf';
export type GameCount = { game: GameId; in_game: number; waiting: number; playing: number; open_seats: number };
export type GamesOverview = { online: number; games: GameCount[] };

export type RoomCard = {
  id: string;
  /** online, training (against AI players), irl (in person). */
  kind?: 'online' | 'training' | 'irl';
  game: GameId;
  title: string | null;
  visibility: 'public' | 'private';
  lang: 'en' | 'fr';
  max: number;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
  created_at: string;
  /** Moved by the server on every change of the room (a seat, the deck, text or voice, a move). */
  updated_at?: string;
  host: string | null;
  host_id: string | null;
  players: number;
  mine: boolean;
};

export type LudoState = {
  players: string[];
  colors: number[];
  tokens: number[][];
  turn: number;
  die: number | null;
  sixes: number;
  idle: number[];
  out: boolean[];
  last: { player: number; roll?: number; token?: number; die?: number; captured?: [number, number][]; home?: boolean; at: string } | null;
};

export type RoomPerson = { id: string; seat: number; left: boolean; place: number | null; name: string | null; photo: string | null; blocked: boolean };

export type Room = RoomCard & {
  space: 'irly' | 'irly_girl';
  code: string | null;
  state: Partial<LudoState>;
  deadline: string | null;
  now: string;
  winner_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  people: RoomPerson[];
};

export type GameMessage = {
  id: number;
  room_id: string;
  user_id: string | null;
  kind: 'chat' | 'system' | 'bot';
  body: string;
  data: Record<string, string | number> | null;
  created_at: string;
  /** Loup-Garou: the table, the pack at night, or the dead. */
  channel?: 'all' | 'wolves' | 'dead';
  /** Loup-Garou: the seat of who wrote (AI players have no account). */
  seat?: number | null;
};

export type RecentGame = {
  id: string;
  game: GameId;
  space: string;
  finished_at: string;
  winner_id: string | null;
  title: string | null;
  people: { id: string; name: string | null; place: number | null; photo: string | null }[] | null;
};

const spaceArg = (space: string) => (space === 'girl' ? 'girl' : 'mixte');

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Sign in to play');
  const { data, error, status } = await supabase.rpc(fn, args);
  // The HTTP status goes with the error: a poll tells a server in trouble from a refusal.
  if (error) throw Object.assign(new Error(error.message), { status });
  return data as T;
}

// ───────── Polling ─────────

/** A read that failed because the network or the server is struggling (no answer, 5xx, 429), not because it was refused. */
export const struggling = (e: unknown): boolean => {
  const status = (e as { status?: number } | null)?.status;
  return !status || status >= 500 || status === 429;
};
/** After such a failure the poll waits twice as long (30 s at most); the first answer brings the normal period back. */
export const slower = (slow: number) => Math.min(slow * 2, 16);
const POLL_MAX_MS = 30_000;
/** True while a request sent at `sentAt` (0: none) has not answered. After 30 s it is taken for lost, so a poll never stops for good. */
export const unanswered = (sentAt: number) => sentAt > 0 && Date.now() - sentAt < POLL_MAX_MS;

/**
 * Calls `tick` every `ms` (times `slow.current`, 30 s at most) while `on`.
 * Nothing is asked while the app is in the background: a phone left in a
 * pocket costs the server nothing. One call at once when the app comes back
 * in front, and when `on` comes back after a pause (the screen shown again).
 */
export function usePoll(on: boolean, ms: number, slow: { current: number }, tick: () => void) {
  // The latest tick, without restarting the timer each time what it reads changes.
  const fn = useRef(tick);
  useEffect(() => {
    fn.current = tick;
  });
  // Stopped after having run (not: never started yet).
  const ran = useRef(false);
  const paused = useRef(false);
  useEffect(() => {
    if (!on) {
      paused.current = ran.current;
      return;
    }
    if (paused.current) fn.current();
    paused.current = false;
    ran.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(
        () => {
          if (AppState.currentState === 'active') fn.current();
          next();
        },
        Math.min(ms * slow.current, POLL_MAX_MS),
      );
    };
    next();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') fn.current();
    });
    return () => {
      clearTimeout(timer);
      app.remove();
    };
  }, [on, ms, slow]);
}

// ───────── Actions ─────────
export const createRoom = (space: string, opts: { visibility: 'public' | 'private'; max: number; title?: string; lang: 'en' | 'fr' }) =>
  rpc<{ id: string; code: string | null }>('game_create', {
    p_game: 'ludo',
    p_space: spaceArg(space),
    p_visibility: opts.visibility,
    p_max: opts.max,
    p_title: opts.title?.trim() || null,
    p_lang: opts.lang,
  });
export const joinRoom = (room: string) => rpc<string>('game_join', { p_room: room });
export const joinByCode = (code: string) => rpc<string>('game_join_code', { p_code: code });
export const quickplay = (space: string, game: GameId = 'ludo') => rpc<string>('game_quickplay', { p_game: game, p_space: spaceArg(space) });
export const leaveRoom = (room: string) => rpc<void>('game_leave', { p_room: room });
export const kickPlayer = (room: string, user: string) => rpc<void>('game_kick', { p_room: room, p_user: user });
export const startRoom = (room: string) => rpc<void>('game_start', { p_room: room });
export const rollDie = (room: string) => rpc<number>('ludo_roll', { p_room: room });
export const moveToken = (room: string, token: number) => rpc<void>('ludo_move', { p_room: room, p_token: token });
export const sayInRoom = (room: string, body: string) => rpc<void>('game_say', { p_room: room, p_body: body });

// ───────── Reading ─────────

/** The real counts for the space shown, read again every 20 s while on screen. */
export function useGamesOverview(): { data: GamesOverview | null; failed: boolean; reload: () => void } {
  const uid = useAccount()?.userId;
  const space = useAppSpace();
  const [state, setState] = useState<{ key: string; data: GamesOverview | null; failed: boolean }>({ key: '', data: null, failed: false });
  const key = `${uid}|${space}`;
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    rpc<GamesOverview>('games_overview', { p_space: spaceArg(space) })
      .then((data) => setState({ key, data, failed: false }))
      .catch(() => setState((s) => ({ key, data: s.key === key ? s.data : null, failed: true })));
  }, [uid, space, key]);
  // Only while its screen is the one shown and the app is in front (as useGamesPresence).
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, 20_000);
    return () => clearInterval(timer);
  }, [load, focused]);
  return { data: state.key === key ? state.data : null, failed: state.key === key && state.failed, reload: load };
}

/** Counts this member as on a games screen (online), every 30 s while the app is open. */
export function useGamesPresence(room?: string | null) {
  const uid = useAccount()?.userId;
  const space = useAppSpace();
  useEffect(() => {
    if (!uid || !supabase) return;
    const ping = () => {
      if (AppState.currentState !== 'active') return;
      void supabase?.rpc('game_ping', { p_space: spaceArg(space), p_room: room ?? null });
    };
    ping();
    const timer = setInterval(ping, 30_000);
    return () => clearInterval(timer);
  }, [uid, space, room]);
}

export function useOpenRooms(game: GameId = 'ludo') {
  const uid = useAccount()?.userId;
  const space = useAppSpace();
  const [rooms, setRooms] = useState<RoomCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    rpc<RoomCard[]>('game_rooms_open', { p_game: game, p_space: spaceArg(space) })
      .then((r) => {
        setRooms(r ?? []);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [uid, space, game]);
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    load();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') load();
    }, 15_000);
    return () => clearInterval(timer);
  }, [load, focused]);
  return { rooms, failed, reload: load };
}

export function useRecentGames() {
  const uid = useAccount()?.userId;
  const [games, setGames] = useState<RecentGame[] | null>(null);
  useEffect(() => {
    if (!uid || !supabase) return;
    rpc<RecentGame[]>('games_recent', {})
      .then((g) => {
        setGames(g ?? []);
        primeFaces((g ?? []).flatMap((x) => (x.people ?? []).map((p) => ({ id: p.id, path: p.photo }))));
      })
      .catch(() => setGames([]));
  }, [uid]);
  return games;
}

/**
 * A room, live: read again when the server says it changed (realtime), every
 * 5 s while a game runs (in case a live update was missed), and when the
 * player whose turn it is runs out of time (the server then plays for them).
 */
export function useRoom(roomId: string | undefined) {
  const uid = useAccount()?.userId;
  const [room, setRoom] = useState<Room | null>(null);
  const [missing, setMissing] = useState(false);
  // The server's refusal when the room could not be read (anything but « it no longer exists »).
  const [failed, setFailed] = useState<string | null>(null);
  const [messages, setMessages] = useState<GameMessage[]>([]);
  // Server clock minus phone clock, measured on each read (deadlines are the server's).
  const [skew, setSkew] = useState(0);
  const seq = useRef(0);
  // For the polls below: when the read on its way was sent (0: none), and how much they slowed down after errors.
  const sentAt = useRef(0);
  const slow = useRef(1);

  const load = useCallback(() => {
    if (!uid || !supabase || !roomId) return;
    const n = ++seq.current;
    sentAt.current = Date.now();
    rpc<Room>('game_room', { p_room: roomId })
      .then((r) => {
        slow.current = 1;
        if (n !== seq.current) return;
        sentAt.current = 0;
        setRoom(r);
        setSkew(Date.parse(r.now) - Date.now());
        setMissing(false);
        setFailed(null);
        primeFaces(r.people.map((p) => ({ id: p.id, path: p.photo })));
      })
      .catch((e: Error) => {
        if (struggling(e)) slow.current = slower(slow.current);
        if (n !== seq.current) return;
        sentAt.current = 0;
        // An id that is not one (a mistyped link) is a game that does not exist.
        if (/no longer exists|invalid input syntax for type uuid/.test(e.message)) setMissing(true);
        else setFailed(e.message);
      });
  }, [uid, roomId]);

  const loadMessages = useCallback(() => {
    if (!uid || !supabase || !roomId) return;
    void supabase
      .from('game_messages')
      .select('id, room_id, user_id, kind, body, data, created_at, channel, seat')
      .eq('room_id', roomId)
      .order('id', { ascending: false })
      .limit(80)
      .then(({ data }) => {
        if (data) setMessages((data as GameMessage[]).reverse());
      });
  }, [uid, roomId]);

  useEffect(() => {
    if (!uid || !supabase || !roomId) return;
    load();
    loadMessages();
    const channel = liveChannel(`game-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: `id=eq.${roomId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_participants', filter: `room_id=eq.${roomId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_messages', filter: `room_id=eq.${roomId}` }, (p) => {
        const m = p.new as GameMessage;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m].slice(-120)));
      })
      .subscribe(
        whenListening(() => {
          load();
          loadMessages();
        }),
      );
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [uid, roomId, load, loadMessages]);

  // A running game: read again every 5 s, and past the deadline ask the server to play the late turn.
  // A waiting room: every 6 s, in case a live update was missed (someone joined, the host started).
  // One timer for both (usePoll): it no longer restarts on every answer, waits for the previous
  // answer before asking again, and stops while the app is in the background.
  const status = room?.status;
  const deadline = room?.deadline;
  usePoll(Boolean(roomId) && (status === 'playing' || status === 'waiting'), status === 'playing' ? 5000 : 6000, slow, () => {
    if (!roomId || unanswered(sentAt.current)) return;
    if (status !== 'playing') {
      load();
      return;
    }
    if (deadline && Date.now() + skew > Date.parse(deadline) + 500) {
      // Counts as the read on its way until the room is read after it.
      sentAt.current = Date.now();
      void supabase?.rpc('game_tick', { p_room: roomId }).then(() => load());
    } else {
      load();
    }
    // AI players' lines show a few seconds after they are written, and a missed live message comes back.
    loadMessages();
  });

  return { room, missing, failed, messages, reload: load, skew };
}
