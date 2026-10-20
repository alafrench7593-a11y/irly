import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CityId } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { displayCommunityName } from '@/features/community/name';
import { useCityFilter } from '@/features/server/scope';
import { useRefreshOn } from '@/features/server/sync';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
import { useAppSpace } from '@/state/appSpace';

/**
 * The IRLY Network page beyond member profiles, from real data only:
 *  - networking communities: the communities of the city whose category is
 *    Networking, and IRLY's official business ones (Network, Entrepreneurs,
 *    Ecom, Tech, AI), from community_list (the server's own read rules; in
 *    IRLY Girl, IRLY Girl communities only, like every community list);
 *  - their latest posts, read from community_posts under its row level
 *    security (the community must be visible to you, blocks apply), with the
 *    same like and comment counts as everywhere else (engagement).
 * Meetups (useServerActivities, Networking category) and business news
 * (useNews, Business category) come from their own hooks.
 */

/** Official IRLY communities about business, by topic (migration 20261008003400). */
export const NETWORK_TOPICS = new Set(['network', 'entrepreneurs', 'ecom', 'tech', 'ai']);
export const NETWORK_CATEGORY = 'networking';

export type NetCommunity = {
  id: string;
  name: string;
  tagline: string | null;
  emoji: string | null;
  members: number;
  postsWeek: number;
  isMember: boolean;
  official: boolean;
  girlOnly: boolean;
  cityId: string | null;
};

export type NetPost = {
  id: string;
  body: string;
  communityId: string;
  communityName: string;
  authorName: string | null;
  at: number;
  likes: number;
  comments: number;
  hasMedia: boolean;
  kind: string | null;
};

type Row = Record<string, unknown>;

const netError = (e: unknown) => (/fetch|network|failed/i.test(String(e)) ? 'Can’t reach IRLY right now' : e instanceof Error ? e.message : 'Could not load');

export const isNetworkCommunity = (c: { categoryId?: string | null; category_id?: unknown; topic?: string | null }) =>
  (c.categoryId ?? (c.category_id as string | null | undefined)) === NETWORK_CATEGORY || (c.topic != null && NETWORK_TOPICS.has(c.topic));

/** Networking communities of the destination (your city first, most active next). */
export function useNetworkCommunities(cityId: CityId) {
  const uid = useAccount()?.userId;
  const girlSpace = useAppSpace() === 'girl';
  const key = `${uid ?? ''}|${cityId}`;
  const [state, setState] = useState<{ for: string; list: NetCommunity[]; error: string | null }>({ for: '', list: [], error: null });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    const n = ++seq.current;
    supabase.rpc('community_list', { p_city: cityId }).then(({ data, error }) => {
      if (n !== seq.current) return;
      // A failed reload keeps the list on screen and says so.
      if (error) return setState((s) => ({ ...s, for: key, error: netError(error.message) }));
      const list = ((data as Row[] | null) ?? [])
        .filter((r) => isNetworkCommunity({ category_id: r.category_id, topic: (r.topic as string | null) ?? null }))
        .map((r) => ({
          id: r.id as string,
          name: displayCommunityName(r as { name: string | null; topic: string | null; category_id: string | null; city_id: string | null }),
          tagline: (r.tagline as string | null) ?? null,
          emoji: (r.emoji as string | null) ?? null,
          members: Number(r.members ?? 0),
          postsWeek: Number(r.posts_week ?? 0),
          isMember: Boolean(r.is_member),
          official: Boolean(r.official),
          girlOnly: Boolean(r.girl_only),
          cityId: (r.city_id as string | null) ?? null,
        }));
      setState({ for: key, list, error: null });
    });
  }, [uid, cityId, key]);
  useEffect(load, [load]);
  useRefreshOn(['communities'], load);
  const { keep } = useCityFilter(cityId);
  const list = useMemo(
    () =>
      state.list
        // Same rule as every community list: in IRLY Girl, IRLY Girl communities only.
        .filter((c) => keep(c.cityId) && (!girlSpace || c.girlOnly))
        .sort((a, b) => Number(b.cityId === cityId) - Number(a.cityId === cityId) || b.postsWeek - a.postsWeek || b.members - a.members),
    [state.list, keep, girlSpace, cityId],
  );
  const on = Boolean(uid && supabase);
  const ready = state.for === key;
  return { list: on ? list : (NONE as NetCommunity[]), loading: on && !ready, error: on && ready ? state.error : null, retry: load };
}

/** The latest posts of these communities (newest first). */
export function useNetworkPosts(communities: NetCommunity[], limit = 6) {
  const uid = useAccount()?.userId;
  const ids = useMemo(() => communities.map((c) => c.id).sort(), [communities]);
  const names = useMemo(() => new Map(communities.map((c) => [c.id, c.name])), [communities]);
  const key = `${uid ?? ''}|${ids.join(',')}`;
  const [state, setState] = useState<{ for: string; list: Omit<NetPost, 'communityName'>[]; error: string | null }>({ for: '', list: [], error: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!uid || !supabase) return;
    const sb = supabase;
    const n = ++seq.current;
    const idList = key.split('|')[1] ? key.split('|')[1].split(',') : [];
    if (!idList.length) return setState({ for: key, list: [], error: null });
    try {
      const { data, error } = await sb
        .from('community_posts')
        .select('id, body, created_at, community_id, author_id, kind, media_kind')
        .in('community_id', idList)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      const rows = (data as Row[] | null) ?? [];
      const postIds = rows.map((r) => r.id as string);
      const authors = [...new Set(rows.map((r) => r.author_id as string))];
      // Counts and first names are extras: the posts show without them if they fail.
      const [counts, people] = await Promise.all([
        postIds.length ? sb.rpc('engagement', { p_type: 'community_post', p_ids: postIds }) : Promise.resolve({ data: [] }),
        authors.length ? sb.from('profiles_public').select('id, first_name').in('id', authors) : Promise.resolve({ data: [] }),
      ]);
      const by = new Map(((counts.data as { target_id: string; likes: number; comments: number }[] | null) ?? []).map((c) => [c.target_id, c]));
      const who = new Map(((people.data as { id: string; first_name: string | null }[] | null) ?? []).map((p) => [p.id, p.first_name]));
      if (n !== seq.current) return;
      setState({
        for: key,
        error: null,
        list: rows
          .filter((r) => typeof r.body === 'string' && (r.body as string).trim().length > 0)
          .map((r) => ({
            id: r.id as string,
            body: (r.body as string).trim(),
            communityId: r.community_id as string,
            authorName: who.get(r.author_id as string) ?? null,
            at: Date.parse(r.created_at as string),
            likes: Number(by.get(r.id as string)?.likes ?? 0),
            comments: Number(by.get(r.id as string)?.comments ?? 0),
            hasMedia: r.media_kind != null,
            kind: (r.kind as string | null) ?? null,
          })),
      });
    } catch (e) {
      if (n === seq.current) setState((s) => ({ ...s, for: key, error: netError(e) }));
    }
  }, [uid, key, limit]);
  useEffect(() => {
    void load();
  }, [load]);
  useRefreshOn(['communities'], () => void load());
  const on = Boolean(uid && supabase);
  const ready = state.for === key;
  const list = useMemo(() => state.list.map((p) => ({ ...p, communityName: names.get(p.communityId) ?? '' })), [state.list, names]);
  return { list: on ? list : (NONE as NetPost[]), loading: on && !ready, error: on && ready ? state.error : null, retry: () => void load() };
}
