import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { isMissingFunction } from '@/features/live/livePublish';
import { changed, useRefreshOn } from '@/features/server/sync';
import { friendlyError, supabase } from '@/lib/supabase';
import { signedLinks } from '@/features/server/media';
import { cacheKey, load as loadCached, peek, warm, warmImages } from './cache';
import { fetchMembers } from './governance';
import { pinPost } from './groups';

/**
 * A community's social space on the client (docs/COMMUNITY-SPACE-CONTRACT.md,
 * « App agent G »): search, the media gallery, the paged and sorted feed,
 * pins with an end, and the owner's info (name, tagline, description, rules).
 *
 * One typed wrapper per server function. When the server has not been
 * updated yet (the function is missing), each read falls back to what
 * already exists: the feed to `community_feed`, the member search to
 * `community_members_list`, the gallery to an empty grid. The demo build has
 * no server: reads are empty and nothing throws.
 */

type Row = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());

function sb() {
  if (!supabase) throw new Error(DEMO ? 'Not available in the demo' : 'The IRLY server is not configured');
  return supabase;
}

/* ───────── Feed: one page, sorted ───────── */

export type FeedSort = 'recent' | 'popular';
export const FEED_PAGE = 20;

/**
 * One page of posts (`community_posts_page`), rows in the shape of
 * `community_feed`. `recent` pages with a cursor (`before`), `popular` with
 * an offset. Null when the server does not have the function yet: the caller
 * reads `community_feed` instead.
 */
export async function fetchPostsPage(communityId: string, sort: FeedSort, page: { before?: number | null; offset?: number; limit?: number } = {}): Promise<Row[] | null> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('community_posts_page', {
    p_community: communityId,
    p_sort: sort,
    p_before: sort === 'recent' ? iso(page.before) : null,
    p_offset: sort === 'popular' ? (page.offset ?? 0) : 0,
    p_limit: page.limit ?? FEED_PAGE,
  });
  if (error) {
    if (isMissingFunction(error)) return null;
    throw new Error(error.message);
  }
  return (data as Row[] | null) ?? [];
}

/** The old feed (`community_feed`), for a server without pages: most recent first. */
export async function fetchFeedFallback(communityId: string, limit = 50): Promise<Row[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('community_feed', { p_community: communityId, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}

/** Popular without the server's sort: likes + 2 × comments, fading with age (the same idea as the server). */
export function popularScore(r: { likes: number; comments: number; createdAt: number }, now = Date.now()): number {
  const hours = Math.max(0, (now - r.createdAt) / 3_600_000);
  return (r.likes + 2 * r.comments + 1) / Math.pow(hours + 2, 1.2);
}

/* ───────── Search ───────── */

export type SearchFilter = 'all' | 'recent' | 'popular' | 'media' | 'activities' | 'members' | 'pinned';
export const SEARCH_FILTERS: { key: SearchFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'recent', label: 'Recent' },
  { key: 'popular', label: 'Most popular' },
  { key: 'media', label: 'Media' },
  { key: 'activities', label: 'Activities' },
  { key: 'members', label: 'Members' },
  { key: 'pinned', label: 'Pinned' },
];
export type SearchKind = 'post' | 'announcement' | 'activity' | 'member' | 'media';
export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string | null;
  snippet: string | null;
  authorId: string | null;
  authorName: string | null;
  createdAt: number | null;
  mediaKind: 'photo' | 'video' | null;
  thumbPath: string | null;
  pinned: boolean;
  score: number;
};
const KINDS = new Set<SearchKind>(['post', 'announcement', 'activity', 'member', 'media']);
export const SEARCH_MIN = 2;

const toHit = (r: Row): SearchHit => ({
  kind: KINDS.has(r.kind as SearchKind) ? (r.kind as SearchKind) : 'post',
  id: String(r.id ?? ''),
  title: str(r.title),
  snippet: str(r.snippet),
  authorId: str(r.author_id),
  authorName: str(r.author_name),
  createdAt: time(r.created_at),
  mediaKind: r.media_kind === 'video' ? 'video' : r.media_kind === 'photo' ? 'photo' : null,
  thumbPath: str(r.thumb_path),
  pinned: Boolean(r.pinned),
  score: Number(r.score ?? 0),
});

/**
 * Searches a community (`community_search`): posts, announcements,
 * activities, members and media. Without the server function: its members
 * (`community_members_list`) and the posts of the latest feed whose text
 * matches, so search still answers something true.
 */
export async function searchCommunity(communityId: string, query: string, filter: SearchFilter = 'all', page: { before?: number | null; limit?: number } = {}): Promise<SearchHit[]> {
  const q = query.trim();
  if (!supabase || !communityId || q.length < SEARCH_MIN) return [];
  const { data, error } = await supabase.rpc('community_search', { p_community: communityId, p_query: q, p_filter: filter, p_limit: page.limit ?? 30, p_before: iso(page.before) });
  if (!error) return ((data as Row[] | null) ?? []).map(toHit).filter((h) => h.id);
  if (!isMissingFunction(error)) throw new Error(friendlyError(error.message));
  return searchFallback(communityId, q, filter);
}

async function searchFallback(communityId: string, q: string, filter: SearchFilter): Promise<SearchHit[]> {
  const out: SearchHit[] = [];
  if (filter === 'all' || filter === 'members') {
    const people = await fetchMembers(communityId, q, 20).catch(() => []);
    for (const m of people) out.push({ kind: 'member', id: m.userId, title: m.name, snippet: null, authorId: m.userId, authorName: m.name, createdAt: m.joinedAt, mediaKind: null, thumbPath: null, pinned: false, score: 1 });
  }
  if (filter !== 'members' && filter !== 'activities') {
    const needle = q.toLocaleLowerCase();
    const rows = await fetchFeedFallback(communityId, 100).catch(() => []);
    for (const r of rows) {
      const body = str(r.body) ?? '';
      if (!body.toLocaleLowerCase().includes(needle)) continue;
      const media = ((r.media_paths as string[] | null) ?? []).length > 0;
      if (filter === 'media' && !media) continue;
      if (filter === 'pinned' && !r.pinned_at) continue;
      out.push({
        kind: r.kind === 'announcement' ? 'announcement' : 'post',
        id: String(r.id),
        title: null,
        snippet: body.slice(0, 160),
        authorId: str(r.author_id),
        authorName: str(r.first_name),
        createdAt: time(r.created_at),
        mediaKind: media ? (r.media_kind === 'video' ? 'video' : 'photo') : null,
        thumbPath: str(r.thumb_path) ?? (media && r.media_kind !== 'video' ? ((r.media_paths as string[])[0] ?? null) : null),
        pinned: Boolean(r.pinned_at),
        score: Number(r.likes ?? 0) + 2 * Number(r.comments ?? 0),
      });
    }
  }
  if (filter === 'popular') out.sort((a, b) => b.score - a.score);
  return out;
}

/* ───────── Media gallery ───────── */

export type MediaItem = {
  /** One file of a post: a post with three photos is three items. */
  key: string;
  postId: string;
  path: string;
  kind: 'photo' | 'video';
  thumbPath: string | null;
  seconds: number | null;
  authorId: string | null;
  createdAt: number;
};
export const MEDIA_PAGE = 60;

/** The community's photos and videos, newest first (`community_media`). Missing on the server: an empty gallery. */
export async function fetchMedia(communityId: string, before: number | null = null, limit = MEDIA_PAGE): Promise<{ items: MediaItem[]; available: boolean }> {
  if (!supabase || !communityId) return { items: [], available: true };
  const { data, error } = await supabase.rpc('community_media', { p_community: communityId, p_before: iso(before), p_limit: limit });
  if (error) {
    if (isMissingFunction(error)) return { items: [], available: false };
    throw new Error(friendlyError(error.message));
  }
  const items = ((data as Row[] | null) ?? [])
    .map((r): MediaItem | null => {
      const path = str(r.path);
      const postId = str(r.post_id);
      const at = time(r.created_at);
      if (!path || !postId || at == null) return null;
      return { key: `${postId}:${path}`, postId, path, kind: r.kind === 'video' ? 'video' : 'photo', thumbPath: str(r.thumb_path), seconds: r.seconds == null ? null : Number(r.seconds), authorId: str(r.author_id), createdAt: at };
    })
    .filter((x): x is MediaItem => x !== null);
  return { items, available: true };
}

type MediaPage = { items: MediaItem[]; available: boolean };
const mediaKey = (uid: string, communityId: string) => cacheKey(uid, 'media', communityId);

/** What the gallery's first thumbnails show: a photo's file, a video's poster frame. */
const shownPath = (m: MediaItem) => (m.kind === 'video' ? m.thumbPath : m.path);

/**
 * Reads the gallery's first page ahead (the page is open, Media is not yet),
 * signs its first thumbnails in one request and fetches them into the image
 * cache: Media then opens filled. Once per half minute at most.
 */
export function prefetchMedia(uid: string, communityId: string, thumbs = 12): void {
  if (!supabase || !uid || !communityId) return;
  void warm(mediaKey(uid, communityId), () => fetchMedia(communityId)).then(async (page) => {
    const first = (page?.items ?? []).slice(0, thumbs);
    const paths = first.map(shownPath).filter((p): p is string => Boolean(p));
    if (!paths.length) return;
    const links = await signedLinks('post-media', paths);
    warmImages(paths.filter((p) => links[p]).map((p) => ({ uri: links[p], cacheKey: p })), thumbs);
  });
}

/** The gallery, paged by date: `more()` asks for the next files when the grid nears its end. */
export function useCommunityMedia(communityId: string, enabled = true) {
  const account = useAccount();
  const uid = account?.userId;
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [end, setEnd] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);
  const live = Boolean(uid && supabase && enabled && communityId);
  const ck = uid && communityId ? mediaKey(uid, communityId) : '';

  // Which gallery the state holds; until it holds this one, the first page read ahead
  // (page open, prefetchMedia) shows at once.
  const [loadedFor, setLoadedFor] = useState('');
  const read = useCallback(
    (join: boolean) => {
      if (!live) return;
      const n = ++seq.current;
      loadCached(ck, () => fetchMedia(communityId), join)
        .then(({ items: next, available }) => {
          if (n !== seq.current) return;
          setItems(next);
          setEnd(!available || next.length < MEDIA_PAGE);
          setError(null);
          setLoadedFor(ck);
        })
        .catch((e: unknown) => n === seq.current && setError(e instanceof Error ? e.message : 'Can’t reach IRLY right now'))
        .finally(() => n === seq.current && setLoading(false));
    },
    [communityId, live, ck],
  );
  const ahead = loadedFor === ck ? undefined : peek<MediaPage>(ck);
  const reload = useCallback(() => read(false), [read]);

  useEffect(() => {
    read(true);
    return () => {
      seq.current += 1;
    };
  }, [read]);
  useRefreshOn(['communities'], reload);

  const more = useCallback(() => {
    if (!live || end || loadingMore || !items.length) return;
    const n = seq.current;
    setLoadingMore(true);
    fetchMedia(communityId, items[items.length - 1].createdAt)
      .then(({ items: next }) => {
        if (n !== seq.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.key));
          return [...prev, ...next.filter((x) => !seen.has(x.key))];
        });
        if (next.length < MEDIA_PAGE) setEnd(true);
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false));
  }, [communityId, live, end, loadingMore, items]);

  if (ahead) return { items: live ? ahead.items : [], loading: false, error: null, loadingMore, end: live ? !ahead.available || ahead.items.length < MEDIA_PAGE : true, more, reload };
  return { items: live ? items : [], loading: live ? loading : false, error: live ? error : null, loadingMore, end: live ? end : true, more, reload };
}

/* ───────── Pins with an end ───────── */

export type PinFor = 'day' | 'week' | 'none';
export const PIN_FOR: { key: PinFor; label: string }[] = [
  { key: 'day', label: '24 hours' },
  { key: 'week', label: '7 days' },
  { key: 'none', label: 'No end' },
];
const pinUntil = (f: PinFor): number | null => (f === 'day' ? Date.now() + 86_400_000 : f === 'week' ? Date.now() + 7 * 86_400_000 : null);

/**
 * Pins (or unpins) a post, until a date when one is given (`pin_post` with
 * `p_until`). A server without the end yet pins it with no end.
 */
export async function pinPostFor(postId: string, on: boolean, f: PinFor = 'none'): Promise<void> {
  const until = on ? pinUntil(f) : null;
  if (!until) return pinPost(postId, on);
  const { error } = await sb().rpc('pin_post', { p_post: postId, p_on: on, p_until: iso(until) });
  if (!error) {
    changed('communities');
    return;
  }
  if (isMissingFunction(error)) return pinPost(postId, on);
  throw new Error(friendlyError(error.message));
}

/* ───────── Info and rules ───────── */

export const RULES_MAX = 4000;

/** The community's rules (`communities.rules`); null when it has none, or the server has no rules yet. */
export async function fetchRules(communityId: string): Promise<string | null> {
  if (!supabase || !communityId) return null;
  const { data, error } = await supabase.from('communities').select('rules').eq('id', communityId).maybeSingle();
  if (error) return null;
  return str((data as Row | null)?.rules)?.trim() || null;
}

export function useCommunityRules(communityId: string) {
  const account = useAccount();
  const uid = account?.userId;
  const [state, setState] = useState<{ key: string; rules: string | null }>({ key: '', rules: null });
  const key = `${uid ?? ''}|${communityId}`;
  // The last known rules show at once (About opens filled).
  const ck = uid && communityId ? cacheKey(uid, 'rules', communityId) : '';
  const read = useCallback(
    (join: boolean) => {
      if (!uid || !communityId) return;
      let alive = true;
      loadCached(ck, () => fetchRules(communityId), join).then((rules) => alive && setState({ key, rules }));
      return () => {
        alive = false;
      };
    },
    [uid, communityId, key, ck],
  );
  const load = useCallback(() => read(false), [read]);
  useEffect(() => read(true), [read]);
  useRefreshOn(['communities'], load);
  const known = peek<string | null>(ck);
  return { rules: state.key === key ? state.rules : (known ?? null), loading: Boolean(uid && communityId) && state.key !== key && known === undefined, reload: load };
}

export type CommunityInfo = { name?: string; tagline?: string | null; description?: string | null; rules?: string | null };

/**
 * The owner (or a co-admin with `settings`) edits the community's name,
 * tagline, description and rules (`community_update_info`; the server keeps
 * the fixed names of official communities and writes the journal). A server
 * without it saves the first three as before, and says the rules need the
 * update.
 */
export async function updateCommunityInfo(communityId: string, info: CommunityInfo): Promise<void> {
  const blank = (v: string | null | undefined) => (v === undefined ? null : (v ?? '').trim());
  const rules = info.rules === undefined ? undefined : (info.rules ?? '').trim().slice(0, RULES_MAX);
  const { error } = await sb().rpc('community_update_info', {
    p_community: communityId,
    p_name: info.name === undefined ? null : info.name.trim(),
    p_tagline: blank(info.tagline),
    p_description: blank(info.description),
    p_rules: rules === undefined ? null : rules,
  });
  if (!error) {
    changed('communities');
    return;
  }
  if (!isMissingFunction(error)) throw new Error(friendlyError(error.message));
  // Server not updated yet: name, tagline and description as before (row level security decides).
  const row: Row = {};
  if (info.name !== undefined) row.name = info.name.trim();
  if (info.tagline !== undefined) row.tagline = blank(info.tagline) || null;
  if (info.description !== undefined) row.description = blank(info.description) || null;
  const { data, error: e } = await sb().from('communities').update(row).eq('id', communityId).select('id');
  if (e) throw new Error(friendlyError(e.message));
  if (!data?.length) throw new Error('Only the community’s hosts can edit it');
  changed('communities');
  if (rules) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
}
