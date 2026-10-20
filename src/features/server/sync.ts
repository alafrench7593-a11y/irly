import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { useAccount } from '@/features/auth/account';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, topic } from '@/lib/supabase';

/**
 * One living system. The server is the only source of truth; screens never
 * keep their own copy of a fact. Every server-backed hook reads one of these
 * versions, and a version moves whenever that kind of data changes, by
 * anyone, anywhere:
 *   · your own actions (create, edit, join, leave, delete) call changed();
 *   · everyone else's arrive through ONE realtime channel (SyncBridge),
 *     mounted once for the whole app;
 *   · coming back to the app, or back online, refreshes everything once.
 * So an activity created, joined, renamed or deleted on one screen (or on
 * another phone) shows up, updated, on every screen that shows it.
 *
 * Each change reloads ONCE. Your own action reloads at once (changed()); its
 * realtime echo, a second later, is dropped when a reload of the same kinds
 * already started after that write was committed (see "Echoes" below). A
 * change committed after the last reload (anyone's) always reloads.
 */
export type SyncKind = 'activities' | 'communities' | 'inbox' | 'people' | 'saved' | 'notifs' | 'follows' | 'friends';
const KINDS: SyncKind[] = ['activities', 'communities', 'inbox', 'people', 'saved', 'notifs', 'follows', 'friends'];

type Versions = Record<SyncKind, number> & { online: boolean };
const useVersions = create<Versions>(() => ({ activities: 0, communities: 0, inbox: 0, people: 0, saved: 0, notifs: 0, follows: 0, friends: 0, online: true }));

/** The version of a kind of data: put it in an effect's dependencies to reload when it changes. */
export const useSyncVersion = (kind: SyncKind) => useVersions((s) => s[kind]);
/** False while the device is offline (web), so screens can say "will sync". */
export const useOnline = () => useVersions((s) => s.online);

/* ───────── Echoes ─────────
 *
 * A realtime event carries commit_timestamp: when its transaction committed,
 * on the server's clock. The phone's clock is not the server's, but every
 * event is heard AFTER its commit, so for each event
 *     (heard on the phone) − (commit on the server) = clock offset + delivery delay ≥ clock offset.
 * The smallest such difference seen (`skew`) is therefore never below the
 * offset, and `commit + skew` is never earlier than the commit, on the
 * phone's clock (a monotonic one, so it never jumps forward). If a reload of
 * every kind the event concerns started after that instant, the reload read
 * the change already: the event needs nothing more. Otherwise (a change made
 * after the last reload, by anyone) it reloads, as before.
 * An event without a usable timestamp is never dropped by this rule.
 */
type Clock = { now?: () => number };
/** A clock that never goes back or jumps forward (performance.now where there is one). */
export const syncNow = (): number => {
  const p = (globalThis as { performance?: Clock }).performance;
  return typeof p?.now === 'function' ? p.now() : Date.now();
};
const STAMP = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;
/**
 * A Postgres / ISO timestamp: `at`, in epoch milliseconds, cut down to what it
 * says, and `grain`, how much later the real instant may be (1 ms for
 * milliseconds or finer, 1000 for whole seconds). NaN when it cannot be read.
 */
export function readStamp(stamp: unknown): { at: number; grain: number } {
  const m = typeof stamp === 'string' ? STAMP.exec(stamp.trim()) : null;
  if (!m) return { at: NaN, grain: 0 };
  const [, y, mo, d, h, mi, s, frac = '', zone = 'Z'] = m;
  let t = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s), Number(`${frac}000`.slice(0, 3)));
  if (zone.toUpperCase() !== 'Z') {
    const digits = zone.slice(1).replace(':', '');
    const minutes = Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4) || 0);
    t -= (zone[0] === '-' ? -1 : 1) * minutes * 60_000;
  }
  return { at: t, grain: frac.length >= 3 ? 1 : 10 ** (3 - frac.length) };
}
export const stampMs = (stamp: unknown) => readStamp(stamp).at;
let skew = Infinity;
type Payload = { commit_timestamp?: unknown; new?: unknown } | null | undefined;
/**
 * An event heard now: the latest its commit can be on the server's clock
 * (NaN when unknown). The earliest it can be teaches the skew: both stay on
 * the safe side whatever the timestamp's precision.
 */
function heardAt(payload: Payload): number {
  const { at, grain } = readStamp(payload?.commit_timestamp);
  if (!Number.isFinite(at)) return NaN;
  skew = Math.min(skew, syncNow() - at);
  return at + grain;
}
/**
 * The latest moment (syncNow clock) at which a change committed at `at` (server
 * clock) can have happened. Infinity: unknown. Asked as late as possible: every
 * event heard meanwhile can only tighten the skew.
 */
const bound = (at: number) => (Number.isFinite(at) ? at + skew : Infinity);
/** A commit time precise enough to tell two transactions apart (milliseconds or finer). */
const precise = (commit: string | null): commit is string => Boolean(commit) && readStamp(commit).grain === 1;
/** For an event heard now: the latest moment (syncNow clock) its change can have been committed. */
export const commitBound = (payload: Payload): number => bound(heardAt(payload));

/**
 * Realtime events that make a screen reload itself (its own channel): a burst
 * becomes one reload `wait` ms after the first event, and none at all when a
 * load that started after every one of them was committed (`lastStart`, on
 * the syncNow clock) already brought them, such as the reload your own
 * action asked for.
 */
export function echoGate(reload: () => void, wait: number, lastStart: () => number) {
  // The latest commit heard in this burst (server clock); NaN once one had no time.
  let latest = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    latest = -Infinity;
  };
  return {
    heard: (payload?: Payload) => {
      const at = heardAt(payload);
      latest = Number.isFinite(at) && !Number.isNaN(latest) ? Math.max(latest, at) : NaN;
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        const b = bound(latest);
        latest = -Infinity;
        if (lastStart() >= b) return;
        reload();
      }, wait);
    },
    cancel,
  };
}

// When each kind last reloaded everywhere (a version bump; screens read the server just after).
const reloadedAt: Record<SyncKind, number> = { activities: -Infinity, communities: -Infinity, inbox: -Infinity, people: -Infinity, saved: -Infinity, notifs: -Infinity, follows: -Infinity, friends: -Infinity };

// Bursts (ten people joining, a big cascade) become one reload per kind.
const pending = new Set<SyncKind>();
let timer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  timer = null;
  const at = syncNow();
  const next = { ...useVersions.getState() };
  pending.forEach((k) => {
    next[k] += 1;
    reloadedAt[k] = at;
  });
  pending.clear();
  useVersions.setState(next);
};

/** True while a reload of this kind is already on its way (a direct refresh now would be a second one). */
export const willReload = (kind: SyncKind) => pending.has(kind);

/** Something of these kinds changed: every screen showing them reloads. */
export function changed(...kinds: SyncKind[]) {
  kinds.forEach((k) => pending.add(k));
  if (!timer) timer = setTimeout(flush, 120);
}

/*
 * Other people's changes (and the echoes of yours): a little slower, so a
 * lively chat or a wave of joins becomes one reload per kind instead of one
 * per event. Each event is weighed when the burst ends:
 *   1. read already: a reload of every kind it concerns started after its
 *      commit (the rule above): nothing to do, whoever made the change;
 *   2. your own write: a row only you can have written (you created, joined,
 *      followed, asked, accepted, saved), or another change of that same
 *      transaction, while your action's own reload of those kinds happened
 *      around it (it calls changed() once the server has answered). If that
 *      reload has not happened yet (a slow answer), the event waits for it,
 *      at most 3 s, then reloads anyway;
 *   3. anything else reloads, as before.
 */
type Heard = { table: string; type: string; row: Record<string, unknown>; commit: string | null; kinds: SyncKind[]; at: number; heardAt: number };
let heard: Heard[] = [];
let remoteTimer: ReturnType<typeof setTimeout> | null = null;
let me = '';
/** Rows only the signed-in member can have written (the server writes them for auth.uid() only). */
function writtenByMe(e: Heard): boolean {
  const r = e.row;
  if (!me) return false;
  if (e.type === 'INSERT') {
    if (e.table === 'activities') return r.creator_id === me;
    if (e.table === 'activity_participants' || e.table === 'community_members' || e.table === 'saves') return r.user_id === me;
    if (e.table === 'communities') return r.created_by === me;
    if (e.table === 'follows') return r.follower_id === me;
    if (e.table === 'friendships') return r.requested_by === me;
  }
  // Accepting is done by the one who did not ask.
  if (e.type === 'UPDATE' && e.table === 'friendships') return r.status === 'accepted' && typeof r.requested_by === 'string' && r.requested_by !== me;
  return false;
}
// How long an echo of your own write waits for your action's reload, and how far before it that reload may be.
const OWN_WAIT_MS = 3000;
const OWN_BEFORE_MS = 1500;
function weigh() {
  remoteTimer = null;
  const now = syncNow();
  const events = heard;
  heard = [];
  // Transactions that contain a write of mine: all their changes are my action's.
  const mine = new Set(events.filter(writtenByMe).map((e) => e.commit).filter(precise));
  const kinds = new Set<SyncKind>();
  for (const e of events) {
    if (ownEcho(e, now) || messageBump(e, now)) continue;
    const b = bound(e.at);
    const left = e.kinds.filter((k) => !(reloadedAt[k] >= b));
    if (!left.length) continue;
    if (writtenByMe(e) || (precise(e.commit) && mine.has(e.commit))) {
      if (left.every((k) => reloadedAt[k] >= e.heardAt - OWN_BEFORE_MS)) continue;
      if (now < e.heardAt + OWN_WAIT_MS) {
        heard.push({ ...e, kinds: left });
        continue;
      }
    }
    left.forEach((k) => kinds.add(k));
  }
  if (heard.length && !remoteTimer) remoteTimer = setTimeout(weigh, 1000);
  if (kinds.size) changed(...kinds);
}
function hear(table: string, payload: Payload & { eventType?: unknown }, kinds: SyncKind[]) {
  const row = payload?.new && typeof payload.new === 'object' ? (payload.new as Record<string, unknown>) : {};
  const commit = typeof payload?.commit_timestamp === 'string' ? payload.commit_timestamp : null;
  heard.push({ table, type: String(payload?.eventType ?? ''), row, commit, kinds, at: heardAt(payload), heardAt: syncNow() });
  if (!remoteTimer) remoteTimer = setTimeout(weigh, 1000);
}

/*
 * Writes of yours that change no list: their echo is not a reason to reload.
 * Reading a chat updates your membership row (conversation_members), whose
 * echo reloaded the inbox, and in an open chat its photo, title and member
 * list: the screen already shows the chat as read.
 */
type Expected = { table: string; match: (row: Record<string, unknown>) => boolean; until: number };
let expected: Expected[] = [];
/** The realtime echo of a write of yours that this screen already shows: one such event within `ms` is not reloaded for. */
export function expectEcho(table: string, match: (row: Record<string, unknown>) => boolean, ms = 5000) {
  const now = syncNow();
  expected = expected.filter((x) => x.until > now);
  expected.push({ table, match, until: now + ms });
}
function ownEcho(e: Heard, now: number): boolean {
  const i = expected.findIndex((x) => x.until > now && x.table === e.table && x.match(e.row));
  if (i < 0) return false;
  expected.splice(i, 1);
  return true;
}

/*
 * Every message updates its conversation (last_message_at) in the same
 * transaction. The inbox already reloads for the message itself (chat.ts,
 * listenInbox), so that conversation UPDATE is not a second reason to reload
 * the inbox, nor the photo, title and members of an open chat.
 */
const messages = new Map<string, number>();
/** A new message heard by the inbox (which reloads itself for it). */
export function heardMessage(payload: Payload) {
  const m = payload?.new as { conversation_id?: unknown; created_at?: unknown } | undefined;
  const commit = payload?.commit_timestamp;
  if (!m || typeof commit !== 'string' || !precise(commit) || typeof m.conversation_id !== 'string') return;
  const now = syncNow();
  if (messages.size > 200) messages.forEach((until, k) => until <= now && messages.delete(k));
  messages.set(`${commit}|${m.conversation_id}|${stampMs(m.created_at)}`, now + 10_000);
}
function messageBump(e: Heard, now: number): boolean {
  if (e.table !== 'conversations' || !e.commit || typeof e.row.id !== 'string') return false;
  // Same transaction AND the time of that very message: a rename or a new photo never matches.
  const until = messages.get(`${e.commit}|${e.row.id}|${stampMs(e.row.last_message_at)}`);
  return until !== undefined && until > now;
}

/** Forgets the echoes being waited for (signed out, another account). */
export function resetSyncEchoes() {
  if (remoteTimer) clearTimeout(remoteTimer);
  remoteTimer = null;
  heard = [];
  expected = [];
  messages.clear();
  me = '';
  KINDS.forEach((k) => (reloadedAt[k] = -Infinity));
}

export const changedAll = () => changed(...KINDS);

/** What each server signal (public.sync_signals.kind) reloads. */
const SIGNAL_KINDS: Record<string, SyncKind[]> = {
  activities: ['activities'],
  communities: ['communities'],
  // Leaving a chat often means its activity or community went away too (a deleted community is
  // hidden from you, so its own change never reaches you): reload those as well, as before.
  inbox: ['inbox', 'activities', 'communities'],
  follows: ['follows'],
  friends: ['friends'],
  saved: ['saved'],
  // A notification taken back (its Live, post or comment removed): Realtime cannot hear that DELETE.
  notifs: ['notifs'],
};
const SIGNAL_CATCH_UP: SyncKind[] = ['activities', 'communities', 'inbox', 'follows', 'friends', 'saved'];

type Watched = { table: string; filter?: string; event?: '*' | 'INSERT' | 'UPDATE'; kinds: SyncKind[]; ignore?: (row: Record<string, unknown>) => boolean };
const watched = (uid: string): Watched[] => [
  { table: 'activities', kinds: ['activities'] },
  // Joins and status changes you may see (the read rule limits them); leaves arrive as signals.
  { table: 'activity_participants', event: 'INSERT', kinds: ['activities'] },
  { table: 'activity_participants', event: 'UPDATE', kinds: ['activities'] },
  { table: 'communities', kinds: ['communities', 'inbox'] },
  // Your own memberships (other people's joins move communities.members_count).
  { table: 'community_members', filter: `user_id=eq.${uid}`, event: 'INSERT', kinds: ['communities'] },
  { table: 'community_members', filter: `user_id=eq.${uid}`, event: 'UPDATE', kinds: ['communities'] },
  { table: 'community_activity_pins', kinds: ['activities'] },
  { table: 'community_channels', kinds: ['communities'] },
  { table: 'community_pins', kinds: ['communities'] },
  // A new chat is the inbox only: the join that made it (activity, community) already
  // signals its own table, so opening a chat no longer reloads every list.
  // Reading, archiving or hiding a chat (an UPDATE, on every message read) is the inbox only.
  { table: 'conversation_members', filter: `user_id=eq.${uid}`, event: 'INSERT', kinds: ['inbox'] },
  { table: 'conversation_members', filter: `user_id=eq.${uid}`, event: 'UPDATE', kinds: ['inbox'] },
  { table: 'conversations', event: 'UPDATE', kinds: ['inbox'] },
  { table: 'profiles', event: 'UPDATE', kinds: ['people'] },
  { table: 'saves', filter: `user_id=eq.${uid}`, event: 'INSERT', kinds: ['saved'] },
  // One MESSAGE_CREATED row per chat message received (and its read receipt): the bell never
  // lists them (the inbox shows messages), so they are not a reason to re-read it.
  { table: 'notifications', filter: `user_id=eq.${uid}`, kinds: ['notifs'], ignore: (row) => row.kind === 'MESSAGE_CREATED' },
  // Follows you are part of (the read rule limits them): counts and buttons everywhere.
  { table: 'follows', event: 'INSERT', kinds: ['follows'] },
  // Friend requests and friendships you are part of (the read rule limits them):
  // Add / Requested / Accept / Friends, the bell and who may message whom.
  { table: 'friendships', event: 'INSERT', kinds: ['friends'] },
  { table: 'friendships', event: 'UPDATE', kinds: ['friends'] },
];

/**
 * The app's realtime channels for one account, until the returned stop.
 * Row-level security decides what each member hears; filters keep personal
 * tables personal.
 */
export function startSync(uid: string): () => void {
  const sb = supabase;
  if (!sb) return () => undefined;
  resetSyncEchoes();
  me = uid;
  // The membership / relationship tables (activity_participants,
  // community_members, conversation_members, saves, follows, friendships)
  // are never heard for DELETE: Realtime cannot check deletes against
  // row-level security, so the server strips their keys (migration
  // irly_sync_signals) and tells the people concerned through sync_signals.
  // A change committed before a channel listens is never sent to it: the screens' first
  // load, or the last one before a reconnection, may have missed it. So each channel
  // catches up once it really listens (`wait`: SUBSCRIBED only once the server's
  // postgres_changes subscription is active, not merely the channel joined), the first
  // time too. Channels become ready within moments of each other: one reload per kind.
  const behind = new Set<SyncKind>();
  let catchUp: ReturnType<typeof setTimeout> | null = null;
  const watch = (name: string, kinds: SyncKind[], bind: (c: RealtimeChannel) => RealtimeChannel) =>
    bind(sb.channel(topic(`sync:${name}:${uid}`), { config: { postgres_changes_options: { wait: true } } })).subscribe((status) => {
      if (status !== 'SUBSCRIBED') return;
      kinds.forEach((k) => behind.add(k));
      if (catchUp) clearTimeout(catchUp);
      catchUp = setTimeout(() => {
        catchUp = null;
        const kinds = [...behind];
        behind.clear();
        changed(...kinds);
      }, 300);
    });
  // One channel per table: a table the server does not publish (yet) can
  // only silence itself, never the others.
  const channels = watched(uid).map(({ table, filter, event = '*', kinds, ignore }) =>
    watch(`${table}:${event}`, kinds, (c) =>
      c.on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, (payload) => {
        if (ignore?.((payload.new ?? {}) as Record<string, unknown>)) return;
        hear(table, payload, kinds);
      }),
    ),
  );
  // Leaves, removals, unfriends, unfollows and unsaves that concern you,
  // told by the server to you alone (owner-only rows, RLS-checked inserts).
  channels.push(
    watch('signals', SIGNAL_CATCH_UP, (c) =>
      c.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sync_signals', filter: `user_id=eq.${uid}` }, (payload) => {
        const kinds = SIGNAL_KINDS[String((payload.new as { kind?: unknown }).kind)];
        if (kinds) hear('sync_signals', payload, kinds);
      }),
    ),
  );
  // Back to the app: whatever happened meanwhile.
  // A quick switch to another app (a link, a photo) reloads nothing.
  let away = 0;
  const app = AppState.addEventListener('change', (s) => {
    if (s !== 'active') {
      if (!away) away = Date.now();
      return;
    }
    if (away && Date.now() - away > 30_000) changedAll();
    away = 0;
  });
  // Back online (web): resync; offline: screens can say so.
  const online = () => {
    useVersions.setState({ online: true });
    changedAll();
  };
  const offline = () => useVersions.setState({ online: false });
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  if (web) {
    useVersions.setState({ online: navigator.onLine !== false });
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
  }
  return () => {
    channels.forEach((c) => void sb.removeChannel(c));
    if (catchUp) clearTimeout(catchUp);
    app.remove();
    if (web) {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    }
    resetSyncEchoes();
  };
}

/** The app's single realtime channel set, mounted once at the root. */
export function SyncBridge() {
  const uid = useAccount()?.userId;
  useEffect(() => {
    if (!uid) return;
    return startSync(uid);
  }, [uid]);
  return null;
}

/**
 * Reload when any of these kinds of data changes (skips the first render:
 * the hook's own effect has just loaded).
 */
export function useRefreshOn(kinds: SyncKind[], refresh: () => void) {
  const v = useVersions((s) => kinds.reduce((sum, k) => sum + s[k], 0));
  const last = useRef(v);
  const fn = useRef(refresh);
  useEffect(() => {
    fn.current = refresh;
  });
  useEffect(() => {
    if (v === last.current) return;
    last.current = v;
    fn.current();
  }, [v]);
}
