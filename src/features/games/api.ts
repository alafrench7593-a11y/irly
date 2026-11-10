import { useCallback, useEffect, useRef, useState } from 'react';
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
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
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
  useEffect(() => {
    load();
    const timer = setInterval(load, 20_000);
    return () => clearInterval(timer);
  }, [load]);
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
  useEffect(() => {
    load();
    const timer = setInterval(load, 15_000);
    return () => clearInterval(timer);
  }, [load]);
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
  const [messages, setMessages] = useState<GameMessage[]>([]);
  // Server clock minus phone clock, measured on each read (deadlines are the server's).
  const [skew, setSkew] = useState(0);
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!uid || !supabase || !roomId) return;
    const n = ++seq.current;
    rpc<Room>('game_room', { p_room: roomId })
      .then((r) => {
        if (n !== seq.current) return;
        setRoom(r);
        setSkew(Date.parse(r.now) - Date.now());
        setMissing(false);
        primeFaces(r.people.map((p) => ({ id: p.id, path: p.photo })));
      })
      .catch((e: Error) => {
        if (n === seq.current && /no longer exists/.test(e.message)) setMissing(true);
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
  const status = room?.status;
  const deadline = room?.deadline;
  useEffect(() => {
    if (status !== 'playing' || !roomId) return;
    const timer = setInterval(() => {
      if (deadline && Date.now() + skew > Date.parse(deadline) + 500) {
        void supabase?.rpc('game_tick', { p_room: roomId }).then(() => load());
      } else {
        load();
      }
      // AI players' lines show a few seconds after they are written, and a missed live message comes back.
      loadMessages();
    }, 5000);
    return () => clearInterval(timer);
  }, [status, deadline, skew, roomId, load, loadMessages]);

  return { room, missing, messages, reload: load, skew };
}
