// Requests per user action, measured by running the app's real sync layer
// (src/features/server/sync.ts), inbox and chat thread (src/features/server/chat.ts)
// and profile follow / friend (src/features/profile/member.ts) against a fake
// Supabase client, on a virtual clock, with realtime echoes delivered the way
// the server sends them (same transaction = same commit_timestamp; the server's
// clock is NOT the phone's). Other screens are stand-ins that read the server
// once per sync bump of their kinds, as their hooks do (useRefreshOn). Chat scenarios
// also check what is shown: no message lost, doubled or out of order (paging, catch-up,
// retry, leaving the chat), and a chat you were removed from stops listening.
//
//   npm run test:sync                         checks the expected counts
//   npm run test:sync -- --before <dir>       same scenarios with sync.ts + chat.ts from <dir>
//                                             (e.g. the previous version), printed side by side
import { register } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', 'src');
const args = process.argv.slice(2);
const beforeDir = args[args.indexOf('--before') + 1] && args.includes('--before') ? path.resolve(args[args.indexOf('--before') + 1]) : null;
const childMode = process.env.CHECK_SYNC_CHILD === '1';

/* ───────── Module stubs (React, React Native, expo, account, supabase) ───────── */
const stub = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
const H = 'globalThis.__h';
const STUBS: Record<string, string> = {
  react: stub(
    `const r = ${H}.react; export default r; export const { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useSyncExternalStore, useDebugValue } = r;`,
  ),
  'react-native': stub(`export const AppState = ${H}.AppState; export const Platform = { OS: 'ios' };`),
  'expo-router': stub(`export const useFocusEffect = (cb) => ${H}.react.useEffect(() => cb(), [cb]);`),
  '@/features/auth/account': stub(`export const useAccount = () => ({ userId: ${H}.uid }); export const withProfile = (fn) => fn();`),
  '@/lib/supabase': stub(
    `export const supabase = ${H}.supabase; let n = 0; export const topic = (s) => s + '#' + (++n); export const friendlyError = (m) => m; export const liveChannel = (name) => ${H}.supabase.channel(topic(name), { config: { postgres_changes_options: { wait: true } } }); export const whenListening = (catchUp) => (status) => { if (status === 'SUBSCRIBED') catchUp(); };`,
  ),
  '@/features/push/push': stub(`export const askPushInContext = async () => undefined;`),
  '@/features/moderation/moderation': stub(`const list = []; export const useBlocked = () => ({ list, refresh() {} });`),
  // chat.ts translates the text of a share whose content was removed (the dictionary needs the device locale).
  '@/i18n': stub(`export const t = (s) => s;`),
  './media': stub(`export const uploadChatPhoto = async () => 'p';`),
  './faces': stub(`export const primeFaces = () => undefined;`),
  // chat.ts keeps undelivered messages on the phone: an in-memory store stands for it here.
  '@react-native-async-storage/async-storage': stub(
    `const m = new Map(); export default { getItem: async (k) => (m.has(k) ? m.get(k) : null), setItem: async (k, v) => void m.set(k, v), removeItem: async (k) => void m.delete(k) };`,
  ),
};
const hooks = `
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const STUBS = ${JSON.stringify(STUBS)};
const SRC = ${JSON.stringify(SRC)};
const BEFORE = ${JSON.stringify(childMode ? (process.env.CHECK_SYNC_BEFORE ?? '') : '')};
const SWAP = new Set(['features/server/sync.ts', 'features/server/chat.ts']);
export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  let target = null;
  if (path.isAbsolute(specifier) && path.extname(specifier)) target = specifier.slice(0, -path.extname(specifier).length);
  else if (specifier.startsWith('@/')) target = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !path.extname(specifier))
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  if (target) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      if (!fs.existsSync(target + ext)) continue;
      let file = target + ext;
      const rel = path.relative(SRC, file).split(path.sep).join('/');
      if (BEFORE && SWAP.has(rel)) file = path.join(BEFORE, path.basename(file));
      return { url: pathToFileURL(file).href, shortCircuit: true };
    }
  }
  // Packages imported by a file outside the repo (the --before copies) resolve from the repo.
  if (BEFORE && context.parentURL?.startsWith(pathToFileURL(BEFORE).href)) return next(specifier, { ...context, parentURL: pathToFileURL(path.join(SRC, 'index.ts')).href });
  return next(specifier, context);
}`;
register(stub(hooks));

// A deterministic "random" delay.
let seed = 7;
const rand = (lo: number, hi: number) => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return lo + Math.floor((seed / 2147483648) * (hi - lo));
};

/* ───────── Virtual clock ───────── */
const EPOCH = Date.UTC(2026, 9, 15, 9, 0, 0);
let now = 0;
type Timer = { id: number; at: number; fn: () => void; every?: number };
let timers: Timer[] = [];
let timerId = 1;
const g = globalThis as Record<string, unknown>;
const realSetImmediate = setImmediate;
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a: unknown[]) {
    if (a.length) super(...(a as [number]));
    else super(EPOCH + now);
  }
  static now() {
    return EPOCH + now;
  }
}
/** From here on, time is virtual (installed once the modules are loaded: the module loader needs real timers). */
const install = () => {
  g.setTimeout = (fn: () => void, ms = 0) => {
    const id = timerId++;
    timers.push({ id, at: now + Math.max(0, ms), fn });
    return id;
  };
  g.clearTimeout = (id: number) => (timers = timers.filter((x) => x.id !== id));
  g.setInterval = (fn: () => void, ms = 0) => {
    const id = timerId++;
    timers.push({ id, at: now + ms, fn, every: ms });
    return id;
  };
  g.clearInterval = g.clearTimeout;
  g.Date = FakeDate;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
};
const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => realSetImmediate(r));
};
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** Runs `work` while virtual time passes (its requests answer on the virtual clock). */
async function during<T>(work: Promise<T>, limit = 120_000): Promise<T> {
  let done = false;
  const out = work.finally(() => (done = true));
  for (let t = 0; !done && t < limit; t += 10) await advance(10);
  if (!done) throw new Error('timed out');
  return out;
}
async function advance(ms: number) {
  const end = now + ms;
  for (;;) {
    await settle();
    timers.sort((a, b) => a.at - b.at || a.id - b.id);
    const next = timers[0];
    if (!next || next.at > end) break;
    now = next.at;
    if (next.every) next.at += next.every;
    else timers.shift();
    next.fn();
  }
  now = end;
  await settle();
}
/* ───────── A tiny React: enough for hooks in plain Node ───────── */
type Slot = Record<string, unknown>;
type Comp = { fn: () => void; slots: Slot[]; i: number; queued: (() => void)[]; scheduled: boolean; dead: boolean };
let current: Comp | null = null;
const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i])));
function render(c: Comp) {
  if (c.dead) return;
  c.i = 0;
  c.queued = [];
  current = c;
  try {
    c.fn();
  } finally {
    current = null;
  }
  c.queued.forEach((run) => run());
}
const schedule = (c: Comp) => {
  if (c.scheduled || c.dead) return;
  c.scheduled = true;
  queueMicrotask(() => {
    c.scheduled = false;
    render(c);
  });
};
const slot = () => {
  const c = current!;
  const i = c.i++;
  return { c, i, s: c.slots[i] };
};
const react = {
  useState<T>(init: T | (() => T)) {
    const { c, i, s } = slot();
    if (!s) {
      const box: Slot = { v: typeof init === 'function' ? (init as () => T)() : init };
      box.set = (x: unknown) => {
        const v = typeof x === 'function' ? (x as (p: unknown) => unknown)(box.v) : x;
        if (Object.is(v, box.v)) return;
        box.v = v;
        schedule(c);
      };
      c.slots[i] = box;
    }
    return [c.slots[i].v, c.slots[i].set];
  },
  useRef<T>(init: T) {
    const { c, i, s } = slot();
    if (!s) c.slots[i] = { current: init };
    return c.slots[i];
  },
  useMemo<T>(fn: () => T, deps: unknown[]) {
    const { c, i, s } = slot();
    if (!s || !same(s.deps as unknown[], deps)) c.slots[i] = { v: fn(), deps };
    return c.slots[i].v as T;
  },
  useCallback<T>(fn: T, deps: unknown[]) {
    return react.useMemo(() => fn, deps);
  },
  useEffect(fn: () => void | (() => void), deps?: unknown[]) {
    const { c, i, s } = slot();
    if (s && deps && same(s.deps as unknown[], deps)) return;
    const prev = s?.cleanup as (() => void) | undefined;
    const box: Slot = { deps, cleanup: undefined };
    c.slots[i] = box;
    c.queued.push(() => {
      prev?.();
      if (c.dead) return;
      const cl = fn();
      box.cleanup = typeof cl === 'function' ? cl : undefined;
    });
  },
  useLayoutEffect(fn: () => void | (() => void), deps?: unknown[]) {
    react.useEffect(fn, deps);
  },
  useSyncExternalStore<T>(subscribe: (cb: () => void) => () => void, get: () => T) {
    const { c, i, s } = slot();
    const box = (s ?? {}) as Slot;
    box.get = get;
    if (!s) {
      c.slots[i] = box;
      box.unsub = subscribe(() => {
        if (!Object.is(box.last, (box.get as () => T)())) schedule(c);
      });
    }
    box.last = get();
    return box.last as T;
  },
  useDebugValue() {},
};
function mount(fn: () => void): { unmount: () => void } {
  const c: Comp = { fn, slots: [], i: 0, queued: [], scheduled: false, dead: false };
  render(c);
  return {
    unmount: () => {
      c.dead = true;
      c.slots.forEach((s) => {
        (s?.cleanup as (() => void) | undefined)?.();
        (s?.unsub as (() => void) | undefined)?.();
      });
    },
  };
}

/* ───────── A fake Supabase: counts requests, sends realtime echoes ───────── */
const ME = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';
const CONV = '33333333-3333-4333-8333-333333333333';
const ACT = '44444444-4444-4444-8444-444444444444';
const SERVER_SKEW = 2_345; // the server's clock is 2.3 s ahead of the phone's
let requests: string[] = [];
type Change = { table: string; event: 'INSERT' | 'UPDATE'; row: Record<string, unknown> };
type Handler = { event: string; table: string; filter?: string; cb: (p: unknown) => void };
type Chan = { topic: string; handlers: Handler[]; dead: boolean; listening: boolean; on: (...a: unknown[]) => Chan; subscribe: (cb?: (s: string) => void) => Chan; send: () => Promise<string> };
let channels: Chan[] = [];
// How long a channel takes to really listen (the server's postgres_changes subscription).
let joinDelay = 5;
let coarse = false; // whole-second commit times, as some Realtime versions send
const stamp = (t: number) => {
  const d = new RealDate(EPOCH + t + SERVER_SKEW);
  if (coarse) return d.toISOString().replace(/\.\d+Z$/, 'Z');
  return d.toISOString().replace('Z', `${String(rand(0, 999)).padStart(3, '0')}+00:00`);
};
const matches = (filter: string | undefined, row: Record<string, unknown>) => {
  if (!filter) return true;
  const [col, rest] = filter.split('=');
  if (rest.startsWith('eq.')) return String(row[col]) === rest.slice(3);
  if (rest.startsWith('in.(')) return rest.slice(4, -1).split(',').includes(String(row[col]));
  return true;
};
/** One transaction: its changes share one commit time and reach the phone after a delivery delay. */
function commit(changes: Change[]) {
  const commitTs = stamp(now);
  for (const ch of changes)
    for (const c of channels.filter((x) => x.listening))
      for (const h of c.handlers) {
        if (h.table !== ch.table || (h.event !== '*' && h.event !== ch.event) || !matches(h.filter, ch.row)) continue;
        const payload = { schema: 'public', table: ch.table, commit_timestamp: commitTs, eventType: ch.event, new: ch.row, old: {}, errors: null };
        const delay = rand(120, 650);
        setTimeout(() => !c.dead && h.cb(payload), delay);
      }
}
// The server's state that matters here.
const server = {
  slow: 0,
  unread: 0,
  messages: [] as Record<string, unknown>[],
  rpcs: {} as Record<string, (args: Record<string, unknown>) => unknown>,
  // Still a member of CONV (RLS: a former member reads neither the chat nor its messages).
  member: true,
  // The next message inserts: 'offline' never reach the server; 'lost' are saved but the answer and the echo are lost (connection dropped).
  insertMode: null as null | 'offline' | 'lost',
};
const RTT = 140;
function answer<T>(name: string, value: () => T, onServer?: () => void): Promise<T> {
  requests.push(name);
  const rtt = RTT + server.slow;
  return new Promise((resolve) => {
    setTimeout(() => onServer?.(), RTT / 2);
    setTimeout(() => resolve(value()), rtt);
  });
}
const rows: Record<string, () => unknown> = {
  my_conversations: () => [{ conversation_id: CONV, kind: 'group', title: 'Padel', other_user_id: null, other_name: null, last_body: 'hi', last_sender: BOB, last_at: new RealDate(EPOCH).toISOString(), unread: server.unread, ref_id: null, other_photo: null, photo_path: null, members: 2, last_kind: 'text', last_sender_name: 'Bob', archived: false }],
  chat_members: () =>
    server.member
      ? [
          { user_id: ME, first_name: 'Me', photo_path: null, role: 'member' },
          { user_id: BOB, first_name: 'Bob', photo_path: null, role: 'admin' },
        ]
      : [],
};
type Filter = (row: Record<string, unknown>) => boolean;
/** created_at, then id: the order of a timestamptz and a uuid in Postgres (same-format strings here). */
const cmp = (a: Record<string, unknown>, b: Record<string, unknown>, col: string) => String(a[col]).localeCompare(String(b[col]));
/** PostgREST's or=(…) as chat.ts writes it: created_at.lt."t",and(created_at.eq."t",id.lt.x). */
function orFilter(expr: string): Filter {
  const m = /^created_at\.lt\."([^"]+)",and\(created_at\.eq\."([^"]+)",id\.lt\.([^)]+)\)$/.exec(expr);
  if (!m) throw new Error(`fake supabase: unsupported or(${expr})`);
  return (r) => String(r.created_at) < m[1] || (String(r.created_at) === m[2] && String(r.id) < m[3]);
}
function query(table: string) {
  let op = 'select';
  let single = false;
  let insertRow: Record<string, unknown> | null = null;
  const filters: Filter[] = [];
  const orders: { col: string; asc: boolean }[] = [];
  let limit = Infinity;
  const q: Record<string, unknown> = {};
  const chain = (...names: string[]) => names.forEach((n) => (q[n] = () => q));
  chain('select', 'is', 'gte', 'in', 'neq');
  q.eq = (col: string, v: unknown) => (filters.push((r) => String(r[col]) === String(v)), q);
  q.lt = (col: string, v: unknown) => (filters.push((r) => String(r[col]) < String(v)), q);
  q.or = (expr: string) => (filters.push(orFilter(expr)), q);
  q.order = (col: string, o?: { ascending?: boolean }) => (orders.push({ col, asc: o?.ascending ?? true }), q);
  q.limit = (n: number) => ((limit = n), q);
  q.insert = (r: Record<string, unknown>) => ((op = 'insert'), (insertRow = r), q);
  q.update = () => ((op = 'update'), q);
  q.upsert = () => ((op = 'upsert'), q);
  q.single = () => ((single = true), q);
  q.maybeSingle = () => ((single = true), q);
  q.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => {
    // What the server answers is read when the request reaches it (half the round trip), not when the answer arrives.
    let answered: { data: unknown; error: unknown } | null = null;
    const onServer =
      table === 'messages' && op === 'insert'
        ? () => (answered = insertMessage(insertRow!))
        : table === 'messages'
          ? () => {
              // Equal sort keys come back in no particular order (here: as stored), as in Postgres.
              const found = (server.member ? server.messages : [])
                .filter((r) => filters.every((f) => f(r)))
                .sort((a, b) => orders.reduce((d, o) => d || (o.asc ? 1 : -1) * cmp(a, b, o.col), 0))
                .slice(0, limit);
              answered = { data: single ? (found[0] ?? null) : found, error: null };
            }
          : undefined;
    const value = () => {
      if (table === 'messages') return answered!;
      if (table === 'conversations')
        return { data: single ? (server.member ? { id: CONV, kind: 'group', title: 'Padel', community_id: null, activity_id: null, photo_path: null, activities: null, communities: null } : null) : [], error: null };
      if (table === 'conversation_members') return { data: single ? { archived_at: null, role: 'member' } : [], error: null };
      return { data: single ? null : [], error: null };
    };
    return answer(`${table}.${op}`, value, onServer).then(ok, ko);
  };
  return q;
}
/** An insert from the app: refused when its id is there already (a retry), as the primary key does. */
function insertMessage(row: Record<string, unknown>): { data: unknown; error: unknown } {
  const offline = { data: null, error: { message: 'TypeError: Network request failed' } };
  if (server.insertMode === 'offline') return offline;
  if (server.messages.some((m) => m.id === row.id)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "messages_pkey"' } };
  const m = sendMessage(row, server.insertMode === 'lost');
  return server.insertMode === 'lost' ? offline : { data: m, error: null };
}
function sendMessage(row: Record<string, unknown>, quiet = false) {
  const m = { kind: 'text', ...row, created_at: new RealDate(EPOCH + now + SERVER_SKEW).toISOString() };
  server.messages.push(m);
  if (quiet) return m;
  const changes: Change[] = [
    { table: 'messages', event: 'INSERT', row: m },
    { table: 'conversations', event: 'UPDATE', row: { id: row.conversation_id, kind: 'group', title: 'Padel', last_message_at: m.created_at } },
  ];
  if (row.sender_id !== ME) {
    server.unread += 1;
    changes.push({ table: 'notifications', event: 'INSERT', row: { id: rand(1, 1e9), user_id: ME, kind: 'MESSAGE_CREATED' } });
  }
  commit(changes);
  return m;
}
const supabase = {
  rpc: (name: string, args: Record<string, unknown> = {}) => {
    const run = server.rpcs[name];
    return answer(name, () => ({ data: rows[name]?.() ?? null, error: null }), run ? () => run(args) : undefined);
  },
  from: (table: string) => query(table),
  channel: (topicName: string): Chan => {
    const c: Chan = {
      topic: `realtime:${topicName}`,
      handlers: [],
      dead: false,
      listening: false,
      on: (type: unknown, f: unknown, cb: unknown) => {
        if (type === 'postgres_changes') {
          const o = f as { event: string; table: string; filter?: string };
          c.handlers.push({ event: o.event, table: o.table, filter: o.filter, cb: cb as (p: unknown) => void });
        }
        return c;
      },
      subscribe: (cb?: (s: string) => void) => {
        // A change committed before this moment is never sent to this channel.
        setTimeout(() => {
          c.listening = true;
          cb?.('SUBSCRIBED');
        }, joinDelay);
        return c;
      },
      send: () => Promise.resolve('ok'),
    };
    channels.push(c);
    return c;
  },
  removeChannel: (c: Chan) => {
    c.dead = true;
    channels = channels.filter((x) => x !== c);
    return Promise.resolve('ok');
  },
  getChannels: () => channels,
  storage: { from: () => ({ remove: async () => ({}) }) },
};
server.rpcs.mark_conversation_read = () => {
  if (server.unread === 0) return; // the server's own "nothing to do"
  server.unread = 0;
  commit([
    { table: 'conversation_members', event: 'UPDATE', row: { conversation_id: CONV, user_id: ME, last_read_at: stamp(now), archived_at: null } },
    { table: 'notifications', event: 'UPDATE', row: { id: 1, user_id: ME, kind: 'MESSAGE_CREATED', read_at: stamp(now) } },
  ]);
};
server.rpcs.join_activity = () =>
  commit([
    { table: 'activity_participants', event: 'INSERT', row: { activity_id: ACT, user_id: ME, status: 'going' } },
    { table: 'conversation_members', event: 'INSERT', row: { conversation_id: CONV, user_id: ME } },
  ]);
server.rpcs.follow_user = () => commit([{ table: 'follows', event: 'INSERT', row: { follower_id: ME, followee_id: BOB } }]);
server.rpcs.add_friend = () => commit([{ table: 'friendships', event: 'INSERT', row: { user_a: ME, user_b: BOB, requested_by: ME, status: 'pending' } }]);
server.rpcs.create_activity = () =>
  commit([
    { table: 'activities', event: 'INSERT', row: { id: ACT, creator_id: ME, title: 'Padel' } },
    { table: 'activity_participants', event: 'INSERT', row: { activity_id: ACT, user_id: ME, status: 'going' } },
    { table: 'conversation_members', event: 'INSERT', row: { conversation_id: CONV, user_id: ME, role: 'admin' } },
  ]);
server.rpcs.post_live = () => commit([{ table: 'irl_posts', event: 'INSERT', row: { id: 'live-1', author_id: ME, city_id: 'dubai' } }]);

/* ───────── Wire the app's modules ───────── */
let appState = 'active';
const appListeners = new Set<(s: string) => void>();
g.__h = {
  react,
  uid: ME,
  supabase,
  AppState: {
    get currentState() {
      return appState;
    },
    addEventListener: (_: string, fn: (s: string) => void) => {
      appListeners.add(fn);
      return { remove: () => appListeners.delete(fn) };
    },
  },
};
const sync = (await import(path.join(SRC, 'features/server/sync.ts'))) as typeof import('../src/features/server/sync.ts');
const chat = (await import(path.join(SRC, 'features/server/chat.ts'))) as typeof import('../src/features/server/chat.ts');
const member = (await import(path.join(SRC, 'features/profile/member.ts'))) as typeof import('../src/features/profile/member.ts');
// Modules loaded: from here on, time is virtual.
install();

/** A screen that reads the server once on mount and once per sync bump of its kinds. */
const screen = (name: string, kinds: Parameters<typeof sync.useRefreshOn>[0]) => () => {
  const load = react.useCallback(() => void supabase.rpc(name), []);
  react.useEffect(load, [load]);
  sync.useRefreshOn(kinds, load);
};
// The chat photo (covers.ts useChatPhoto): conversationHead again on every inbox or communities bump.
const ChatPhoto = () => {
  const inboxV = sync.useSyncVersion('inbox');
  const communitiesV = sync.useSyncVersion('communities');
  react.useEffect(() => void chat.conversationHead(CONV, ME), [inboxV, communitiesV]);
};
// The Live feed (social.ts useServerIrl): one irl_feed per bumpIrl; its own echo is skipped (confirmedHere).
const LiveFeed = () => {
  react.useEffect(() => void supabase.rpc('irl_feed'), []);
};

type Result = { label: string; total: number; by: Record<string, number>; notes: string[] };
const results: Result[] = [];
async function scenario(label: string, setup: (() => Promise<void>) | null, act: () => Promise<string[] | void>, opts: { thread?: boolean; profile?: boolean } = {}) {
  // A fresh app: the root (SyncBridge, unread badge, bell), the tabs' lists, and what the scenario opens.
  sync.resetSyncEchoes?.();
  server.unread = 0;
  server.member = true;
  server.insertMode = null;
  server.messages = [{ id: 'm0', conversation_id: CONV, sender_id: BOB, kind: 'text', body: 'hi', created_at: new RealDate(EPOCH).toISOString() }];
  const mounted = [
    mount(() => sync.SyncBridge()),
    mount(() => chat.UnreadSync()),
    mount(screen('activities_list', ['activities'])),
    mount(screen('map_activities', ['activities'])),
    mount(screen('community_list', ['communities'])),
    mount(screen('notifications', ['notifs'])),
    mount(screen('friends', ['friends'])),
  ];
  let thread: { current: ReturnType<typeof chat.useServerThread> | null } = { current: null };
  if (setup) await setup();
  await advance(5_000);
  if (opts.thread) {
    mounted.push(mount(() => void (thread.current = chat.useServerThread(CONV))), mount(ChatPhoto));
    await advance(20_000);
  }
  if (opts.profile) {
    mounted.push(mount(() => void member.useMemberProfile(BOB)));
    await advance(5_000);
  }
  requests = [];
  (g.__h as Record<string, unknown>).thread = thread;
  const notes = (await during(act())) ?? [];
  await advance(30_000);
  const by: Record<string, number> = {};
  requests.forEach((r) => (by[r] = (by[r] ?? 0) + 1));
  results.push({ label, total: requests.length, by, notes });
  mounted.forEach((m) => m.unmount());
  thread = { current: null };
  await advance(60_000);
}
const threadNow = () => ((g.__h as Record<string, { current: ReturnType<typeof chat.useServerThread> | null }>).thread.current)!;

// The app opens while Bob renames a community: the list's first read is sent before the rename,
// and the channels only listen 2 s later, so no event will ever say so. They catch up once listening.
let missedBeforeListening = 0;
{
  joinDelay = 2_000;
  sync.resetSyncEchoes?.();
  const app = [mount(() => sync.SyncBridge()), mount(screen('community_list', ['communities']))];
  await advance(300);
  requests = [];
  commit([{ table: 'communities', event: 'UPDATE', row: { id: 'c-1', name: 'Padel crew (renamed)' } }]);
  await advance(10_000);
  missedBeforeListening = requests.filter((r) => r === 'community_list').length;
  app.forEach((m) => m.unmount());
  await advance(60_000);
  joinDelay = 5;
}
// The app opens and Bob writes before the inbox channels listen (2 s later): no event will say so.
// The inbox reads once as it opens and once after the channels listen (the app's sync catch-up,
// which the inbox's own catch-up no longer doubles), and that read has Bob's message.
let inboxOpening = 0;
let inboxAfterMessage = 0;
{
  joinDelay = 2_000;
  sync.resetSyncEchoes?.();
  server.unread = 0;
  requests = [];
  const app = [mount(() => sync.SyncBridge()), mount(() => chat.UnreadSync())];
  await advance(300);
  server.unread = 1;
  commit([{ table: 'messages', event: 'INSERT', row: { id: 'm-early', conversation_id: CONV, sender_id: BOB, created_at: new RealDate(EPOCH + now).toISOString() } }]);
  const before = requests.filter((r) => r === 'my_conversations').length;
  await advance(10_000);
  inboxOpening = requests.filter((r) => r === 'my_conversations').length;
  inboxAfterMessage = inboxOpening - before;
  app.forEach((m) => m.unmount());
  await advance(60_000);
  server.unread = 0;
  joinDelay = 5;
}

await scenario('create activity', null, async () => {
  await supabase.rpc('create_activity');
  sync.changed('activities', 'inbox'); // activities.ts createServerActivity
});
await scenario('join activity', null, async () => {
  await supabase.rpc('join_activity');
  sync.changed('activities', 'inbox'); // activities.ts joinServerActivity
  await supabase.from('conversations').select('id').eq('activity_id', ACT).maybeSingle();
});
await scenario(
  'open chat (2 unread)',
  async () => {
    server.unread = 2;
  },
  async () => {
    // Opening is measured from the mount: re-mount the thread with the unread waiting.
    const notes: string[] = [];
    server.unread = 2;
    const m = mount(() => void chat.useServerThread(CONV));
    const p = mount(ChatPhoto);
    await sleep(30_000);
    notes.push(`badge after: ${chat.useServerUnread.getState().n}`);
    m.unmount();
    p.unmount();
    return notes;
  },
);
await scenario(
  'send message in open chat',
  null,
  async () => {
    await threadNow().send('hello');
  },
  { thread: true },
);
await scenario(
  "someone else's message in open chat",
  null,
  async () => {
    sendMessage({ id: 'm-bob', conversation_id: CONV, sender_id: BOB, body: 'yo' });
    await sleep(30_000);
    const shown = threadNow().messages.some((m) => m.id === 'm-bob');
    return [`shown: ${shown}`, `badge after: ${chat.useServerUnread.getState().n}`];
  },
  { thread: true },
);
// Messaging: nothing shown is ever lost, doubled or out of order.
const msgId = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
await scenario(
  'history with equal times (3 per second): every page',
  async () => {
    // 120 messages, three per transaction time: a page boundary falls inside equal times.
    server.messages = Array.from({ length: 120 }, (_, i) => ({ id: msgId(i), conversation_id: CONV, sender_id: BOB, kind: 'text', body: `m${i}`, created_at: new RealDate(EPOCH - 3_600_000 + Math.floor(i / 3) * 1_000).toISOString() }));
  },
  async () => {
    for (let i = 0; i < 10 && threadNow().hasEarlier; i++) {
      await threadNow().loadEarlier();
      await sleep(1_000);
    }
    const ids = threadNow().messages.map((m) => m.id);
    const all = server.messages.map((m) => String(m.id));
    return [`shown: ${new Set(ids).size}/${all.length}`, `doubles: ${ids.length - new Set(ids).size}`, `in order: ${ids.join() === all.join()}`];
  },
  { thread: true },
);
await scenario(
  "Bob's message lands while the chat catches up",
  null,
  async () => {
    // Back to the app on a slow network: the catch-up page is read on the server first,
    // Bob's message is saved just after and heard live before that page's (late) answer.
    server.slow = 1_600;
    appListeners.forEach((fn) => fn('active'));
    await sleep(100);
    server.slow = 0;
    sendMessage({ id: 'm-late', conversation_id: CONV, sender_id: BOB, body: 'on my way' });
    await sleep(30_000);
    return [`shown: ${threadNow().messages.some((m) => m.id === 'm-late')}`];
  },
  { thread: true },
);
await scenario(
  'retry after a lost answer',
  null,
  async () => {
    // Saved on the server, but the answer and its echo are lost (the connection dropped): the bubble shows Retry.
    server.insertMode = 'lost';
    await threadNow().send('are you coming?').catch(() => undefined);
    server.insertMode = null;
    await sleep(1_000);
    const id = threadNow().messages.find((m) => m.status === 'failed')?.id ?? '';
    await threadNow().retry(id).catch(() => undefined);
    await sleep(30_000);
    const shown = threadNow().messages.filter((m) => m.id === id);
    return [`failed first: ${Boolean(id)}`, `after retry: ${shown.length === 1 && !shown[0].status ? 'sent' : shown.length ? shown[0].status : 'missing'}`, `saved: ${server.messages.filter((m) => m.id === id).length}`];
  },
  { thread: true },
);
await scenario(
  'lost answer, then the catch-up brings it',
  null,
  async () => {
    // Saved on the server, answer and echo lost: "Retry" at first. Back to the app, the catch-up
    // page has it: it is a sent message now (no Retry beside its own server copy, nothing kept).
    server.insertMode = 'lost';
    await threadNow().send('landed anyway').catch(() => undefined);
    server.insertMode = null;
    await sleep(1_000);
    const id = threadNow().messages.find((m) => m.status === 'failed')?.id ?? '';
    appListeners.forEach((fn) => fn('active'));
    await sleep(30_000);
    const shown = threadNow().messages.filter((m) => m.id === id);
    return [`failed first: ${Boolean(id)}`, `after catch-up: ${shown.length === 1 && !shown[0].status ? 'sent' : shown.length ? shown[0].status : 'missing'}`, `saved: ${server.messages.filter((m) => m.id === id).length}`];
  },
  { thread: true },
);
await scenario('a failed message after leaving the chat and coming back', null, async () => {
  const open = () => {
    const box: { t: ReturnType<typeof chat.useServerThread> | null } = { t: null };
    return { box, m: mount(() => void (box.t = chat.useServerThread(CONV))) };
  };
  const first = open();
  await sleep(5_000);
  server.insertMode = 'offline';
  await first.box.t!.send('see you at 8').catch(() => undefined);
  server.insertMode = null;
  await sleep(500);
  const id = first.box.t!.messages.find((m) => m.status === 'failed')?.id ?? '';
  first.m.unmount();
  await sleep(10_000);
  const again = open();
  await sleep(5_000);
  const back = again.box.t!.messages.find((m) => m.id === id);
  const notes = [`failed first: ${Boolean(id)}`, `back: ${back ? back.status : 'missing'}`];
  if (back) {
    await again.box.t!.retry(id).catch(() => undefined);
    await sleep(5_000);
    const sent = again.box.t!.messages.filter((m) => m.id === id);
    notes.push(`after retry: ${sent.length === 1 && !sent[0].status ? 'sent' : 'not sent'}`, `saved: ${server.messages.filter((m) => m.id === id).length}`);
  }
  again.m.unmount();
  return notes;
});
await scenario(
  'removed from the chat elsewhere',
  null,
  async () => {
    // Taken out of the group (or left its community / activity on another phone): the server says so through a signal.
    server.member = false;
    commit([{ table: 'sync_signals', event: 'INSERT', row: { user_id: ME, kind: 'inbox' } }]);
    await sleep(30_000);
    const open = channels.filter((c) => c.topic.includes(`thread-${CONV}`) || c.topic.includes(`thread-removals-${CONV}`)).length;
    return [`error: ${threadNow().error}`, `thread channels: ${open}`];
  },
  { thread: true },
);
await scenario(
  'post Live (with its activity)',
  null,
  async () => {
    const feed = mount(LiveFeed);
    requests = [];
    await supabase.rpc('create_activity');
    sync.changed('activities', 'inbox'); // createServerActivity, during the upload
    await sleep(1_500); // the photo uploads
    await supabase.rpc('post_live');
    sync.changed('activities', 'inbox'); // social.ts after the post, then bumpIrl
    feed.unmount();
    mount(LiveFeed).unmount();
  },
);
await scenario(
  'follow',
  null,
  async () => {
    await member.setFollow(BOB, true);
  },
  { profile: true },
);
await scenario(
  'friend request',
  null,
  async () => {
    await member.setFriend(BOB, 'add');
  },
  { profile: true },
);
await scenario(
  'follow, then Bob follows back 0.5 s later',
  null,
  async () => {
    await member.setFollow(BOB, true);
    await sleep(500);
    commit([{ table: 'follows', event: 'INSERT', row: { follower_id: BOB, followee_id: ME } }]);
  },
  { profile: true },
);
await scenario('join activity, answer 1.6 s late', null, async () => {
  server.slow = 1_600;
  await supabase.rpc('join_activity');
  server.slow = 0;
  sync.changed('activities', 'inbox');
});
await scenario('join activity, then Bob adds me to a group 0.3 s later', null, async () => {
  await supabase.rpc('join_activity');
  sync.changed('activities', 'inbox');
  await sleep(300);
  commit([{ table: 'conversation_members', event: 'INSERT', row: { conversation_id: 'g-1', user_id: ME } }]);
});
await scenario('whole-second commit times: join, then Bob adds me to a group 0.3 s later', null, async () => {
  coarse = true;
  await supabase.rpc('join_activity');
  sync.changed('activities', 'inbox');
  await sleep(300);
  commit([{ table: 'conversation_members', event: 'INSERT', row: { conversation_id: 'g-1', user_id: ME } }]);
  await sleep(5_000);
  coarse = false;
});
await scenario('Bob joins my activity (nothing done here)', null, async () => {
  commit([{ table: 'activity_participants', event: 'INSERT', row: { activity_id: ACT, user_id: BOB, status: 'going' } }]);
});

/* ───────── Report ───────── */
if (childMode) {
  process.stdout.write(JSON.stringify(results));
  process.exit(0);
}
let before: Result[] | null = null;
if (beforeDir) {
  const run = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], { env: { ...process.env, CHECK_SYNC_CHILD: '1', CHECK_SYNC_BEFORE: beforeDir }, encoding: 'utf8' });
  if (run.status !== 0) {
    console.error(run.stderr);
    process.exit(1);
  }
  before = JSON.parse(run.stdout) as Result[];
}
const fmt = (r: Result) =>
  `${String(r.total).padStart(3)}  ${Object.entries(r.by)
    .sort()
    .map(([k, v]) => `${k}×${v}`)
    .join(' ')}${r.notes.length ? `  [${r.notes.join(', ')}]` : ''}`;
for (const [i, r] of results.entries()) {
  console.log(`\n${r.label}`);
  if (before) console.log(`  before ${fmt(before[i])}`);
  console.log(`  ${before ? 'after ' : ''} ${fmt(r)}`);
}

let failed = 0;
const expect = (ok: boolean, label: string) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`);
  }
};
const get = (label: string) => results.find((r) => r.label === label)!;
const n = (label: string, key: string) => get(label).by[key] ?? 0;
console.log('');
for (const l of ['create activity', 'join activity', 'post Live (with its activity)']) {
  expect(n(l, 'activities_list') === (l.startsWith('post') ? 2 : 1) && n(l, 'map_activities') === n(l, 'activities_list'), `${l}: each activity list reloads once per changed() (no echo reload)`);
  expect(n(l, 'my_conversations') === (l.startsWith('post') ? 2 : 1), `${l}: the inbox reloads once per changed()`);
}
expect(n('open chat (2 unread)', 'my_conversations') === 0, 'open chat: no inbox reload for my own read');
expect(get('open chat (2 unread)').notes.includes('badge after: 0'), 'open chat: the badge drops to 0 at once');
expect(n('open chat (2 unread)', 'notifications') === 0, 'open chat: the bell is not re-read for its message notifications (it never lists them)');
expect(n('open chat (2 unread)', 'messages.select') <= 2, 'open chat: the first page and at most one catch-up once its channels listen');
expect(n("someone else's message in open chat", 'notifications') === 0, "someone else's message: the bell is not re-read (message notifications are not listed there)");
expect(n('send message in open chat', 'my_conversations') === 1, 'send: one inbox reload (the new preview)');
expect(n('send message in open chat', 'mark_conversation_read') === 0, 'send: no read receipt for my own message');
expect(n('send message in open chat', 'conversations.select') === 0 && n('send message in open chat', 'chat_members') === 0, 'send: the chat photo, title and members are not re-read');
expect(get("someone else's message in open chat").notes.includes('shown: true'), "someone else's message: shown live");
expect(n("someone else's message in open chat", 'my_conversations') >= 1, "someone else's message: the inbox reloads");
expect(get("someone else's message in open chat").notes.includes('badge after: 0'), "someone else's message in the open chat: read at once");
const notes = (label: string) => get(label).notes;
expect(notes('history with equal times (3 per second): every page').join() === 'shown: 120/120,doubles: 0,in order: true', 'history: older pages leave no gap and no double, in server order (equal times too)');
expect(notes("Bob's message lands while the chat catches up").includes('shown: true'), 'a message heard live while a catch-up page is on its way stays on screen');
expect(notes('retry after a lost answer').join() === 'failed first: true,after retry: sent,saved: 1', 'retry after a lost answer: shown as sent, saved once (same id)');
expect(
  notes('lost answer, then the catch-up brings it').join() === 'failed first: true,after catch-up: sent,saved: 1',
  'a send whose answer was lost but which landed shows as sent once the thread has it (never "Retry" beside its own copy)',
);
expect(
  notes('a failed message after leaving the chat and coming back').join() === 'failed first: true,back: failed,after retry: sent,saved: 1',
  'a failed message is still there (Retry) after leaving the chat, and sends once',
);
expect(notes('removed from the chat elsewhere').join() === 'error: You are no longer in this chat,thread channels: 0', 'removed from a chat: the thread says so and closes its channels');
expect(n('follow', 'public_profile') === 1, 'follow: the profile reloads once');
expect(n('friend request', 'public_profile') === 1 && n('friend request', 'friends') === 1, 'friend request: profile and friends reload once');
expect(n('follow, then Bob follows back 0.5 s later', 'public_profile') === 2, 'a real change right after my own action still reloads');
expect(n('Bob joins my activity (nothing done here)', 'activities_list') === 1, "other people's changes still reload");
expect(n('join activity, answer 1.6 s late', 'activities_list') === 1 && n('join activity, answer 1.6 s late', 'my_conversations') === 1, 'an echo heard before a slow answer waits for its reload (one reload)');
expect(n('whole-second commit times: join, then Bob adds me to a group 0.3 s later', 'my_conversations') === 2, 'whole-second commit times never hide a change');
expect(sync.stampMs('2026-10-15 09:00:01.5+04') === Date.UTC(2026, 9, 15, 5, 0, 1, 500) && Number.isNaN(sync.stampMs('soon')), 'commit times are read in any Postgres / ISO form');
expect(n('join activity, then Bob adds me to a group 0.3 s later', 'my_conversations') === 2, 'being added to a group right after my own join still reloads the inbox');
expect(missedBeforeListening === 1, `a change committed before the channels listen is caught up once they do (community list reloads: ${missedBeforeListening})`);
expect(inboxAfterMessage >= 1, `a message sent before the inbox listens is read once it does (inbox reads after it: ${inboxAfterMessage})`);
expect(inboxOpening <= 2, `opening the app: the inbox is read at most twice (first read, one catch-up; was 3) (reads: ${inboxOpening})`);
if (failed) {
  console.error(`\n${failed} sync check(s) failed`);
  process.exit(1);
}
console.log('\nsync ok');
