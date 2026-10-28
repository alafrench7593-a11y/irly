import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { DEMO, storageName } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import type { AppSpace } from '@/state/appSpace';
import { checkLayout, type LayoutEntry } from './layout';
import { cleanFeed, cleanNews, cleanPoll, type HomeFeed, type NewsArticle, type NewsCard, type NewsPoll } from './model';

export * from './model';

/**
 * What the team publishes for the Home (migration 20261028500000_irly_admin_cms),
 * read in ONE call, home_feed(space): the published layout of the flavour,
 * its news and its banners. The server decides what a member may see
 * (an IRLY Girl item only for IRLY Girl members); this only shows it.
 *
 * Kept on the phone (the last good answer shows first, and stays when the
 * network fails), read again when the Home comes back into view or the app
 * wakes up, at most once a minute (STALE_MS), one request at a time per
 * flavour: no polling.
 */
const STORE = storageName('irly.homeFeed.v1');
export const STALE_MS = 60_000;

type Entry = { feed: HomeFeed; at: number };
const useFeeds = create<{ feeds: Partial<Record<AppSpace, Entry>> }>(() => ({ feeds: {} }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchFeed(space: AppSpace): Promise<unknown> {
  if (DEMO && !supabase) return (await import('./demo')).demoCms('home_feed', { p_space: space });
  if (!supabase) throw new Error('Not connected');
  const { data, error } = await supabase.rpc('home_feed', { p_space: space });
  if (error) throw new Error(error.message);
  return data;
}

let hydrated: Promise<void> | null = null;
function hydrate(): Promise<void> {
  hydrated ??= AsyncStorage.getItem(STORE)
    .then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Record<AppSpace, unknown>>;
      const feeds: Partial<Record<AppSpace, Entry>> = {};
      for (const space of ['mixte', 'girl'] as const) {
        const f = cleanFeed(saved[space], space);
        // Known from an earlier visit: shown at once, read again on the first look (at: 0).
        if (f) feeds[space] = { feed: f, at: 0 };
      }
      // The server's answer, if it came first, wins.
      useFeeds.setState((s) => ({ feeds: { ...feeds, ...s.feeds } }));
    })
    .catch(() => undefined);
  return hydrated;
}

function persist() {
  const out: Partial<Record<AppSpace, HomeFeed>> = {};
  for (const [k, v] of Object.entries(useFeeds.getState().feeds)) if (v) out[k as AppSpace] = v.feed;
  AsyncStorage.setItem(STORE, JSON.stringify(out)).catch(() => undefined);
}

const inflight = new Map<AppSpace, Promise<void>>();

/**
 * Reads the flavour's feed from the server unless it was read less than a
 * minute ago (force: now). Joins a request already on its way. A failure
 * keeps what is shown.
 */
export function refreshHomeFeed(space: AppSpace, force = false): Promise<void> {
  const running = inflight.get(space);
  if (running) return running;
  const at = useFeeds.getState().feeds[space]?.at ?? 0;
  if (!force && Date.now() - at < STALE_MS) return Promise.resolve();
  const p = (async () => {
    try {
      await hydrate();
      const feed = cleanFeed(await fetchFeed(space), space);
      if (!feed) return;
      useFeeds.setState((s) => ({ feeds: { ...s.feeds, [space]: { feed, at: Date.now() } } }));
      persist();
    } catch {
      // Offline, server unreachable: the last good feed stays on screen.
    } finally {
      inflight.delete(space);
    }
  })();
  inflight.set(space, p);
  return p;
}

/** After the team changed something here: every flavour is read again on its next look. */
export function staleHomeFeeds() {
  useFeeds.setState((s) => ({ feeds: Object.fromEntries(Object.entries(s.feeds).map(([k, v]) => [k, v ? { ...v, at: 0 } : v])) }));
}

let lastUid: string | null | undefined;

/** The flavour's feed (null until known): from the phone first, then the server, again on focus and on wake-up. */
export function useHomeFeed(space: AppSpace): HomeFeed | null {
  const uid = useAccount()?.userId ?? null;
  const entry = useFeeds((s) => s.feeds[space]);
  useEffect(() => {
    void hydrate();
    // Another account (signed in or out): what it may see differs, read now.
    const changed = lastUid !== undefined && lastUid !== uid;
    lastUid = uid;
    void refreshHomeFeed(space, changed);
  }, [space, uid]);
  useFocusEffect(
    useCallback(() => {
      void refreshHomeFeed(space);
    }, [space]),
  );
  useRefreshOn(['communities'], () => void refreshHomeFeed(space));
  return entry?.feed ?? null;
}

/**
 * The back office's preview: the Home drawn with a draft layout in a flavour,
 * on this screen only (nothing is saved, no member sees it).
 */
export const useCmsPreview = create<{ preview: { space: AppSpace; entries: LayoutEntry[] } | null }>(() => ({ preview: null }));

/** The space the Home draws (the preview's while one is open). */
export function useHomeSpace(own: AppSpace): AppSpace {
  return useCmsPreview((s) => s.preview?.space) ?? own;
}

/** The Home's sections in order: the preview's, else the published layout, else the app's own. */
export function useHomeLayout(space: AppSpace): { entries: LayoutEntry[]; feed: HomeFeed | null } {
  const preview = useCmsPreview((s) => s.preview);
  const feed = useHomeFeed(space);
  const entries = useMemo(() => checkLayout(preview ? preview.entries : (feed?.layout ?? [])), [preview, feed?.layout]);
  return { entries, feed };
}

/**
 * One news item for its page: the card already known shows at once, the full
 * text follows. undefined while loading, null when it is not (or no longer)
 * for this account.
 */
export function useNewsItem(id: string | undefined): { item: NewsArticle | null | undefined; error: string | null; retry: () => void } {
  const uid = useAccount()?.userId ?? null;
  const [state, setState] = useState<{ for: string; item: NewsArticle | null | undefined; error: string | null }>({ for: '', item: undefined, error: null });
  const [tick, setTick] = useState(0);
  const key = `${id}|${uid}|${tick}`;
  const valid = Boolean(id && UUID.test(id));
  useEffect(() => {
    if (!valid || !id) return;
    let alive = true;
    (async () => {
      if (DEMO && !supabase) return (await import('./demo')).demoCms('news_item', { p_id: id });
      if (!supabase) throw new Error('Not connected');
      const { data, error } = await supabase.rpc('news_item', { p_id: id });
      if (error) throw new Error(error.message);
      return data;
    })().then(
      (data) => alive && setState({ for: key, item: cleanNews(data), error: null }),
      (e) => alive && setState({ for: key, item: undefined, error: e instanceof Error ? e.message : 'Could not load' }),
    );
    return () => {
      alive = false;
    };
  }, [id, key, valid]);
  const retry = useCallback(() => setTick((n) => n + 1), []);
  if (!valid) return { item: null, error: null, retry };
  return state.for === key ? { item: state.item, error: state.error, retry } : { item: undefined, error: null, retry };
}

/** A card of this item already in a feed on the phone (its title and photo while the page loads). */
export function useKnownNews(id: string | undefined): NewsCard | undefined {
  return useFeeds((s) => {
    for (const e of Object.values(s.feeds)) {
      const hit = e?.feed.news.find((n) => n.id === id);
      if (hit) return hit;
    }
    return undefined;
  });
}

/**
 * Votes on a news item's poll, or changes the vote (news_poll_vote): the
 * server checks that this account may read the item now and answers with
 * the poll's new counts.
 */
export async function voteNewsPoll(id: string, option: number): Promise<NewsPoll | undefined> {
  if (DEMO && !supabase) return cleanPoll((await import('./demo')).demoCms('news_poll_vote', { p_id: id, p_option: option }));
  if (!supabase) throw new Error('Not connected');
  const { data, error } = await supabase.rpc('news_poll_vote', { p_id: id, p_option: option });
  if (error) throw new Error(error.message);
  return cleanPoll(data);
}
