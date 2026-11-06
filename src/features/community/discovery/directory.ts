import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { toast } from '@/components/ui/Toast';
import { DEMO_PLANS } from '@/data/content/girlDemo';
import { useAccount } from '@/features/auth/account';
import { useCommunitiesVersion, type CommunitySummary } from '@/features/community/data';
import { displayCommunityName } from '@/features/community/name';
import { GIRL_OFFICIAL_TOPICS, NETWORK_OFFICIAL_TOPICS } from '@/features/community/official';
import { isDemoId } from '@/features/girl/demo';
import { belongsToSpace } from '@/features/universe/universe';
import { t as tx } from '@/i18n';
import { friendlyError, supabase } from '@/lib/supabase';

/**
 * Community discovery on the IRLY server: the city's directory (sorted and
 * searched server side) and the member's favourites. The two RPCs come
 * from the communities contract (docs/COMMUNITIES-CONTRACT.md, migration B):
 *
 *   community_directory(p_city, p_sort, p_search, p_limit)
 *   toggle_community_favorite(p_community) → boolean
 *
 * Every count shown comes from the server: an unknown one stays null and
 * the cards say « — », never a guess.
 */

export type DirectorySort = 'members' | 'active' | 'recent' | 'activities';
export const DIRECTORY_SORTS: readonly DirectorySort[] = ['members', 'active', 'recent', 'activities'];

/** One row of public.community_directory, as the server returns it. */
type DirectoryRow = {
  id: string;
  name: string | null;
  tagline: string | null;
  description: string | null;
  emoji: string | null;
  category_id: string | null;
  topic: string | null;
  official: boolean | null;
  girl_only: boolean | null;
  members_count: number | string | null;
  upcoming_count: number | string | null;
  posts_week: number | string | null;
  created_at: string | null;
  is_member: boolean | null;
  is_favorite: boolean | null;
  /** Its own photo (20261110200000); absent from an older server. */
  cover_path?: string | null;
};

type DirectoryArgs = { p_city: string; p_sort: DirectorySort; p_search: string | null; p_limit: number };

/** A community as discovery shows it. Counts are null when unknown. */
export type DirectoryCommunity = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  emoji: string | null;
  categoryId: string | null;
  topic: string | null;
  cityId: string | null;
  official: boolean;
  girlOnly: boolean;
  members: number | null;
  upcoming: number | null;
  postsWeek: number | null;
  createdAt: number | null;
  isMember: boolean;
  /** null: the server did not say (the directory has not answered). */
  isFavorite: boolean | null;
  /** Its own photo (a storage path), null: none. Undefined: not said, looked up by id. */
  coverPath?: string | null;
};

const count = (v: number | string | null | undefined): number | null => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fromRow = (r: DirectoryRow): DirectoryCommunity => ({
  id: r.id,
  // Never an id or a test code as its title (name.ts).
  name: displayCommunityName({ name: r.name, topic: r.topic, category_id: r.category_id, city_id: null }),
  tagline: r.tagline ?? null,
  description: r.description ?? null,
  emoji: r.emoji ?? null,
  categoryId: r.category_id ?? null,
  topic: r.topic ?? null,
  cityId: null,
  official: Boolean(r.official),
  girlOnly: Boolean(r.girl_only),
  members: count(r.members_count),
  upcoming: count(r.upcoming_count),
  postsWeek: count(r.posts_week),
  createdAt: r.created_at ? Date.parse(r.created_at) : null,
  isMember: Boolean(r.is_member),
  isFavorite: r.is_favorite == null ? null : Boolean(r.is_favorite),
  coverPath: 'cover_path' in r ? (r.cover_path ?? null) : undefined,
});

/** A row of community_list, for when the directory has not answered: its upcoming count is unknown. */
export const fromSummary = (c: CommunitySummary): DirectoryCommunity => ({
  id: c.id,
  name: c.name,
  tagline: c.tagline,
  description: null,
  emoji: c.emoji,
  categoryId: c.categoryId,
  topic: c.topic,
  cityId: c.cityId,
  official: c.official,
  girlOnly: c.girlOnly,
  members: c.members,
  upcoming: null,
  postsWeek: c.postsWeek,
  createdAt: c.createdAt,
  isMember: c.isMember,
  isFavorite: null,
  coverPath: c.coverPath,
});

/** The demo's own communities: their upcoming count is the demo's plans linked to each (example content). */
export const fromDemo = (c: CommunitySummary): DirectoryCommunity => ({ ...fromSummary(c), upcoming: DEMO_PLANS.filter((p) => p.community === c.id).length });

export async function fetchDirectory(cityId: string, sort: DirectorySort, search: string | null, limit = 200): Promise<DirectoryCommunity[]> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const args: DirectoryArgs = { p_city: cityId, p_sort: sort, p_search: search, p_limit: limit };
  const { data, error } = await supabase.rpc('community_directory', args);
  if (error) throw new Error(friendlyError(error.message));
  return ((data as DirectoryRow[] | null) ?? []).map(fromRow);
}

/** Adds or removes a favourite; the server answers whether it is one now. */
export async function toggleCommunityFavorite(communityId: string): Promise<boolean> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data, error } = await supabase.rpc('toggle_community_favorite', { p_community: communityId });
  if (error) throw new Error(friendlyError(error.message));
  return Boolean(data);
}

/**
 * Each space lists its own, as community_list does: its universes (universe.ts), and IRLY Network's own
 * community lives in its section. A woman's Mixte communities never show in IRLY Girl, nor her Girl ones in Mixte.
 */
export const inSpace = (c: Pick<DirectoryCommunity, 'girlOnly' | 'official' | 'topic' | 'categoryId'>, girl: boolean) =>
  belongsToSpace(c, girl ? 'girl' : 'mixte') &&
  (girl
    ? c.girlOnly && (!c.official || (GIRL_OFFICIAL_TOPICS as readonly (string | null)[]).includes(c.topic))
    : !c.girlOnly && !(c.official && NETWORK_OFFICIAL_TOPICS.includes(c.topic)));

/** Same order as the server, for lists the server did not sort (demo, or no answer yet). Unknown counts go last. */
export function sortLocally(list: DirectoryCommunity[], sort: DirectorySort): DirectoryCommunity[] {
  const key = (c: DirectoryCommunity): number | null =>
    sort === 'members' ? c.members : sort === 'recent' ? c.createdAt : sort === 'activities' ? c.upcoming : c.postsWeek;
  return list
    .map((c, i) => ({ c, i, k: key(c) }))
    .sort((a, b) => (a.k == null ? (b.k == null ? a.i - b.i : 1) : b.k == null ? -1 : b.k - a.k || a.i - b.i))
    .map((x) => x.c);
}

/**
 * The directory for a city, sorted and (optionally) searched on the server.
 * Reloads whenever communities change; a failed reload keeps what is shown.
 */
export function useDirectory(cityId: string, sort: DirectorySort, search: string | null, enabled = true) {
  const uid = useAccount()?.userId;
  const version = useCommunitiesVersion();
  const key = `${cityId}|${sort}|${search ?? ''}`;
  const [state, setState] = useState<{ key: string; list: DirectoryCommunity[] | null; error: string | null }>({ key: '', list: null, error: null });
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  const on = enabled && Boolean(uid) && Boolean(supabase);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    fetchDirectory(cityId, sort, search).then(
      (list) => alive && setState({ key, list, error: null }),
      (e: unknown) => alive && setState((s) => ({ key, list: s.key === key ? s.list : null, error: e instanceof Error ? e.message : 'offline' })),
    );
    return () => {
      alive = false;
    };
  }, [on, key, cityId, sort, search, version, n]);
  const mine = state.key === key;
  return { list: on && mine ? state.list : null, error: on && mine ? state.error : null, loading: on && (!mine || (state.list === null && state.error === null)), refresh };
}

/* ───────── Sort: remembered for the session ───────── */

export const useDirectorySort = create<{ sort: DirectorySort; setSort: (s: DirectorySort) => void }>((set) => ({
  sort: 'members',
  setSort: (sort) => set({ sort }),
}));

/* ───────── Favourites: optimistic, rolled back on error ───────── */

type FavoriteState = {
  /** What the member chose in this session, over what the directory said. */
  chosen: Record<string, boolean>;
  pending: Record<string, boolean>;
  patch: (id: string, value: boolean | undefined, pending: boolean) => void;
};

export const useFavorites = create<FavoriteState>((set) => ({
  chosen: {},
  pending: {},
  patch: (id, value, pending) =>
    set((s) => {
      const chosen = { ...s.chosen };
      if (value === undefined) delete chosen[id];
      else chosen[id] = value;
      return { chosen, pending: { ...s.pending, [id]: pending } };
    }),
}));

/** Whether a community is a favourite: the member's choice in this session, else the server's, else no. */
export function useIsFavorite(id: string, known: boolean | null | undefined): boolean {
  const chosen = useFavorites((s) => s.chosen[id]);
  return chosen ?? known ?? false;
}

/**
 * Stars or unstars at once; the server's answer settles it, an error puts
 * the star back as it was and says so. Demo communities stay in this tab.
 */
export async function toggleFavorite(id: string, current: boolean, name: string): Promise<void> {
  const store = useFavorites.getState();
  if (store.pending[id]) return;
  const before = store.chosen[id];
  const next = !current;
  store.patch(id, next, !isDemoId(id));
  if (isDemoId(id)) {
    toast(next ? tx('{name} added to your favourites', { name }) : tx('{name} removed from your favourites', { name }), 'star');
    return;
  }
  try {
    const now = await toggleCommunityFavorite(id);
    useFavorites.getState().patch(id, now, false);
  } catch (e) {
    useFavorites.getState().patch(id, before, false);
    toast(e instanceof Error ? e.message : tx('Could not change your favourites. Try again.'), 'x', 'live');
  }
}
