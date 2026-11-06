import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { storageName } from '@/config/app';

/**
 * The last known answer of each community read (its page, header, rights,
 * first page of posts, members, channels…), per account: a screen shows it at
 * once and reads the server again behind it (stale while revalidate).
 *
 * - One request per key at a time: every screen, hook and prefetch asking
 *   for the same thing while it is on its way shares it (`join`). A read
 *   asked after a change (`join: false`) always sends a new request, and an
 *   older answer never replaces a newer one.
 * - The page of the last few communities opened (`PERSIST` kinds) is also
 *   kept on the phone, so the page opens filled after a restart too. Logging
 *   out wipes it (state/wipe, clearCommunityCache), as the Home feed.
 * - Keys always start with the account id: another account never sees them.
 */

const STORE = storageName('irly-community-cache');
/** What is kept on the phone, for the last KEEP communities opened. */
const PERSIST = new Set(['detail', 'header', 'rights', 'feed', 'channels', 'extras', 'rules']);
const KEEP = 12;
/** A prefetch skips what was read this recently. */
export const FRESH_MS = 30_000;
/** A first load joins an answer this recent instead of asking again (pressed, then opened). */
const REUSE_MS = 5_000;

type Entry = { v: unknown; at: number };
const mem = new Map<string, Entry>();
const inflight = new Map<string, { p: Promise<unknown>; n: number }>();
/** Per key: the number of the latest request started; only its answer (or a later one) is kept. */
const started = new Map<string, number>();
let counter = 0;
/** Counts the wipes: an answer to a request sent before the last wipe is dropped. */
let wiped = 0;

export const cacheKey = (uid: string, kind: string, ...parts: (string | number | null | undefined)[]) => [uid, kind, ...parts.map((p) => (p == null ? '' : String(p)))].join('|');
const communityOf = (key: string) => key.split('|')[2] ?? '';
const kindOf = (key: string) => key.split('|')[1] ?? '';

/** The last known value (undefined: never read on this phone for this account). */
export function peek<T>(key: string): T | undefined {
  if (!key) return undefined;
  return mem.get(key)?.v as T | undefined;
}

/** When it was last read (0: never, or only known from the phone). */
export function readAt(key: string): number {
  return mem.get(key)?.at ?? 0;
}

/** Stores a value read now (a screen that read it without `load`, or an optimistic change). */
export function put<T>(key: string, v: T, at = Date.now()): void {
  if (!key) return;
  mem.set(key, { v, at });
  if (PERSIST.has(kindOf(key))) schedulePersist();
}

/**
 * Reads `key` with `run`. `join`: a request for the same key already on its
 * way answers this caller too (first loads, prefetch); otherwise a new one is
 * sent (a reload after a change must not get an answer read before it).
 */
export function load<T>(key: string, run: () => Promise<T>, join = false): Promise<T> {
  const running = inflight.get(key);
  if (join && running) return running.p as Promise<T>;
  // Read a moment ago (the prefetch on press, then the page opening): that answer, no second request.
  const hit = join ? mem.get(key) : undefined;
  if (hit && Date.now() - hit.at < REUSE_MS) return Promise.resolve(hit.v as T);
  const n = ++counter;
  const round = wiped;
  started.set(key, n);
  const p = run().then((v) => {
    if (round === wiped && (started.get(key) ?? 0) <= n) put(key, v);
    return v;
  });
  const entry = { p, n };
  inflight.set(key, entry);
  const done = () => {
    if (inflight.get(key) === entry) inflight.delete(key);
  };
  p.then(done, done);
  return p;
}

/** Reads `key` unless it was read less than `maxAge` ago or is on its way (a prefetch). */
export function warm<T>(key: string, run: () => Promise<T>, maxAge = FRESH_MS): Promise<T | undefined> {
  if (!key) return Promise.resolve(undefined);
  if (inflight.has(key)) return inflight.get(key)!.p as Promise<T>;
  if (Date.now() - readAt(key) < maxAge) return Promise.resolve(peek<T>(key));
  return load(key, run, true).catch(() => undefined);
}

/* ───────── On the phone ───────── */

let hydrated: Promise<void> | null = null;
/** Reads what the phone kept (once). The answers the server gave meanwhile win. */
export function hydrateCommunityCache(): Promise<void> {
  hydrated ??= AsyncStorage.getItem(STORE)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      if (!saved || typeof saved !== 'object') return;
      for (const [k, v] of Object.entries(saved)) {
        // Known from an earlier visit: shown at once, read again on the first look (at: 0).
        if (!mem.has(k) && PERSIST.has(kindOf(k))) mem.set(k, { v, at: 0 });
      }
    })
    .catch(() => undefined);
  return hydrated;
}

/** The communities opened most recently first (the order their page was last read). */
let timer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const round = wiped;
    void hydrateCommunityCache().then(() => {
      if (round !== wiped) return;
      const last = new Map<string, number>();
      for (const [k, e] of mem) if (PERSIST.has(kindOf(k))) last.set(communityOf(k), Math.max(last.get(communityOf(k)) ?? 0, e.at));
      const keep = new Set([...last.entries()].sort((a, b) => b[1] - a[1]).slice(0, KEEP).map(([c]) => c));
      const out: Record<string, unknown> = {};
      for (const [k, e] of mem) if (PERSIST.has(kindOf(k)) && keep.has(communityOf(k))) out[k] = e.v;
      AsyncStorage.setItem(STORE, JSON.stringify(out)).catch(() => undefined);
    });
  }, 1500);
}

/**
 * Logging out (state/wipe): everything read for the account that left is
 * forgotten, in memory and on the phone; an answer still on its way is not kept.
 */
export function clearCommunityCache(): void {
  wiped++;
  mem.clear();
  inflight.clear();
  started.clear();
  if (timer) clearTimeout(timer);
  timer = null;
  hydrated = Promise.resolve();
  AsyncStorage.removeItem(STORE).catch(() => undefined);
}

/* ───────── Pictures ───────── */

const warmed = new Set<string>();
/**
 * Fetches pictures before they are shown (the first photos of the feed, the
 * gallery's first thumbnails), into the same image cache the views read:
 * on the web by their link (the views load that link), on a phone under the
 * same cache key the views give (the stored path), so a new link signed for
 * the same file is still a hit. At most a few at a time; each once.
 */
export function warmImages(items: { uri: string; cacheKey: string }[], max = 8): void {
  const todo = items.filter((i) => i.uri && !warmed.has(i.cacheKey)).slice(0, max);
  if (!todo.length) return;
  for (const i of todo) warmed.add(i.cacheKey);
  if (warmed.size > 2000) warmed.clear();
  if (Platform.OS === 'web') {
    void Image.prefetch(
      todo.map((i) => i.uri),
      { cachePolicy: 'memory-disk' },
    ).catch(() => undefined);
    return;
  }
  for (const i of todo) {
    // Loaded through the views' own loader and disk cache (same cache key), then let go.
    Image.loadAsync({ uri: i.uri, cacheKey: i.cacheKey })
      .then((ref) => ref.release())
      .catch(() => warmed.delete(i.cacheKey));
  }
}
