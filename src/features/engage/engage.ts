import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { storageName } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';

/**
 * Reasons to come back that are real: today's activities, what happened in
 * my communities, groups that fit me, badges for what members actually did,
 * shared challenges with real counts, and a recap of what I missed. Nothing
 * is invented and nothing pushes: it is read when the member opens IRLY.
 */
type Row = Record<string, unknown>;

/** A server read, kept fresh on the given kinds of change. */
function useRpc<T>(fn: string, args: Record<string, unknown> | null, map: (r: Row) => T, kinds: Parameters<typeof useRefreshOn>[0]) {
  const uid = useAccount()?.userId;
  const key = `${uid}|${fn}|${JSON.stringify(args)}`;
  const [state, setState] = useState<{ for: string; items: T[] }>({ for: '', items: [] });
  const mapRef = useRef(map);
  useEffect(() => {
    mapRef.current = map;
  });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase || !args) return;
    const n = ++seq.current;
    supabase.rpc(fn, args).then(
      ({ data }) => {
        if (n === seq.current) setState({ for: key, items: ((data as Row[] | null) ?? []).map((r) => mapRef.current(r)) });
      },
      // Never a spinner forever: a failed read ends the load (empty).
      () => n === seq.current && setState({ for: key, items: [] }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key]);
  useEffect(load, [load]);
  useRefreshOn(kinds, load);
  return { items: state.for === key ? state.items : [], loading: Boolean(uid) && state.for !== key, reload: load };
}

export type TodayActivity = { id: string; title: string; startsAt: number; place: string | null; areaId: string; organizer: string | null; going: number; spotsLeft: number | null; iGo: boolean };
export function useToday(cityId: string) {
  return useRpc(
    'today_activities',
    { p_city: cityId, p_limit: 20 },
    (r): TodayActivity => ({
      id: r.id as string,
      title: r.title as string,
      startsAt: Date.parse(r.starts_at as string),
      place: (r.place_name as string | null) ?? null,
      areaId: r.area_id as string,
      organizer: (r.organizer_name as string | null) ?? null,
      going: Number(r.going ?? 0),
      spotsLeft: r.spots_left == null ? null : Number(r.spots_left),
      iGo: Boolean(r.i_go),
    }),
    ['activities'],
  );
}

export type ForYouPost = { id: string; communityId: string | null; communityName: string | null; authorId: string; firstName: string; body: string; kind: string; mediaPaths: string[]; mediaKind: 'photo' | 'video' | null; at: number; comments: number; likes: number; why: 'community' | 'people' };
export function useForYou() {
  return useRpc(
    'for_you_feed',
    { p_limit: 20 },
    (r): ForYouPost => ({
      id: r.id as string,
      communityId: (r.community_id as string | null) ?? null,
      communityName: (r.community_name as string | null) ?? null,
      authorId: r.author_id as string,
      firstName: (r.first_name as string) ?? 'Member',
      body: r.body as string,
      kind: r.kind as string,
      mediaPaths: (r.media_paths as string[] | null) ?? [],
      mediaKind: (r.media_kind as 'photo' | 'video' | null) ?? null,
      at: Date.parse(r.created_at as string),
      comments: Number(r.comments ?? 0),
      likes: Number(r.likes ?? 0),
      why: r.why as ForYouPost['why'],
    }),
    ['communities', 'people'],
  );
}

export type GroupSuggestion = { id: string; name: string; emoji: string | null; parentName: string; members: number; postsWeek: number; reason: 'in_your_community' | 'your_interests' };
export function useGroupSuggestions(cityId: string) {
  return useRpc(
    'suggest_groups',
    { p_city: cityId, p_limit: 8 },
    (r): GroupSuggestion => ({
      id: r.id as string,
      name: r.name as string,
      emoji: (r.emoji as string | null) ?? null,
      parentName: r.parent_name as string,
      members: Number(r.members ?? 0),
      postsWeek: Number(r.posts_week ?? 0),
      reason: r.reason as GroupSuggestion['reason'],
    }),
    ['communities'],
  );
}

export type Badge = { badge: 'organizer' | 'helper' | 'explorer'; level: number; count: number };
export function useBadges(userId: string | null | undefined) {
  return useRpc('member_badges', userId ? { p_user: userId } : null, (r): Badge => ({ badge: r.badge as Badge['badge'], level: Number(r.level), count: Number(r.count) }), ['activities', 'communities']);
}

export type Challenge = { challenge: 'activities' | 'places' | 'answers'; goal: number; done: number; mine: number };
export function useChallenges(cityId: string) {
  return useRpc('city_challenges', { p_city: cityId }, (r): Challenge => ({ challenge: r.challenge as Challenge['challenge'], goal: Number(r.goal), done: Number(r.done), mine: Number(r.mine) }), ['activities', 'communities']);
}

export type RecapItem = { section: 'discussion' | 'upcoming' | 'community' | 'for_you'; id: string; title: string; detail: string | null; at: number | null; n: number };

const SEEN = storageName('irly-recap-seen');
/** The recap since my last look at it; opening it moves the mark (after showing it). */
export function useRecap(cityId: string) {
  const [since, setSince] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem(SEEN)
      .then((v) => setSince(v))
      .catch(() => setSince(null));
  }, []);
  const r = useRpc(
    'my_recap',
    since === undefined ? null : { p_city: cityId, p_since: since },
    (x): RecapItem => ({
      section: x.section as RecapItem['section'],
      id: x.ref_id as string,
      title: (x.title as string) ?? '',
      detail: (x.detail as string | null) ?? null,
      at: x.at ? Date.parse(x.at as string) : null,
      n: Number(x.n ?? 0),
    }),
    ['activities', 'communities'],
  );
  const markSeen = useCallback(() => {
    AsyncStorage.setItem(SEEN, new Date().toISOString()).catch(() => undefined);
  }, []);
  return { ...r, since: since ?? null, markSeen };
}
