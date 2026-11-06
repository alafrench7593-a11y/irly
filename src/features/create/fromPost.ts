import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import type { EventActivity } from '@/features/events/goTogether';
import { coverLinks } from '@/features/server/activities';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { rpcInSpace } from '@/features/universe/spaceRpc';
import { useAppSpace, type AppSpace } from '@/state/appSpace';

/**
 * « Create an activity » from a post: the post card opens the composer with
 * openCreateFromPost (createStore.ts); the activity keeps the post's id in
 * activities.source_post_id (20261110300000_irly_activity_from_post.sql).
 * The post's card asks `post_activities` for the plans made from it, with
 * every visibility rule of activities (IRLY Girl, members-only, blocks,
 * cancelled, removed, finished).
 */

/** A plan made from a post, as the post's card shows it (same shape as an event's plans). */
export type PostActivity = EventActivity;

type Row = {
  id: string;
  title: string;
  category_id: string;
  city_id: string;
  area_id: string;
  place_name: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  going: number;
  girl_only: boolean;
  community_id: string | null;
  community_name: string | null;
  creator_id: string;
  creator_name: string | null;
  cover_url: string | null;
  my_status: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The rows of `post_activities` as the app reads them (cover links signed). */
export async function fetchPostActivities(postId: string, space: AppSpace, limit = 5): Promise<PostActivity[]> {
  if (!supabase || !UUID.test(postId)) return [];
  // This app space's plans only (20261110700000): never a women-only plan in Mixte.
  const { data, error } = await rpcInSpace(supabase, 'post_activities', { p_post: postId, p_limit: limit }, space);
  if (error) throw new Error(error.message);
  const rows = (data as Row[] | null) ?? [];
  const links = await coverLinks(rows.map((r) => r.cover_url)).catch(() => ({}) as Record<string, string>);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    categoryId: r.category_id,
    cityId: r.city_id,
    areaId: r.area_id,
    placeName: r.place_name,
    startsAt: Date.parse(r.starts_at),
    endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
    capacity: r.capacity,
    going: r.going,
    girlOnly: r.girl_only,
    communityId: r.community_id,
    communityName: r.community_name,
    creatorId: r.creator_id,
    creatorName: r.creator_name,
    coverUrl: r.cover_url ? (links[r.cover_url] ?? null) : null,
    myStatus: r.my_status,
  }));
}

/**
 * The plans made from this post that I may see (upcoming or under way, by
 * start). Signed out, in the demo (no server) or for a pending post (no
 * server id yet): an empty list, never an error.
 */
export function usePostActivities(postId: string | null | undefined, limit = 5): { items: PostActivity[]; loading: boolean; error: string | null; refresh: () => void } {
  const uid = useAccount()?.userId;
  const space = useAppSpace();
  const key = postId && UUID.test(postId) ? postId : null;
  const enabled = Boolean(supabase && uid && key);
  const asked = `${uid ?? ''}|${key ?? ''}|${space}`;
  const [result, setResult] = useState<{ for: string; items: PostActivity[]; error: string | null }>({ for: '', items: [], error: null });
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!supabase || !uid || !key) return;
    const mine = ++seq.current;
    const at = `${uid}|${key}|${space}`;
    fetchPostActivities(key, space, limit).then(
      (items) => mine === seq.current && setResult({ for: at, items, error: null }),
      // A failure keeps what is shown and says so.
      (e: unknown) => mine === seq.current && setResult((prev) => ({ for: at, items: prev.for === at ? prev.items : [], error: e instanceof Error ? e.message : 'offline' })),
    );
  }, [uid, key, limit, space]);

  useEffect(load, [load]);
  // Created, joined, left, cancelled anywhere in the app: the list follows.
  useRefreshOn(['activities'], load);

  const current = enabled && result.for === asked;
  return { items: current ? result.items : [], loading: enabled && !current, error: current ? result.error : null, refresh: load };
}
