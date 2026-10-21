import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';
import { coverLinks } from './activities';
import { useRefreshOn } from './sync';

/**
 * The live card of an activity: what a share in a chat, the header of an
 * activity chat and a community's feed show. Always read from the activity
 * itself (activity_cards, under the reader's own rules), never from the text
 * of a message: an edit, a join or a cancellation shows everywhere at once,
 * and an activity the reader may not see (private, IRLY Girl, deleted) has no
 * card at all: « Activity not available ».
 */

export type ActivityCardState = 'open' | 'full' | 'ongoing' | 'ended' | 'cancelled';

export type ActivityCard = {
  id: string;
  title: string;
  startsAt: number;
  endsAt: number | null;
  placeName: string | null;
  areaId: string;
  cityId: string;
  categoryId: string;
  /** The app's photo of its subject, shown when it has no photo of its own. */
  photo: PhotoKey;
  coverUrl: string | null;
  priceMinor: number;
  currency: string;
  capacity: number | null;
  going: number;
  state: ActivityCardState;
  girlOnly: boolean;
  communityId: string | null;
  communityName: string | null;
  creatorId: string;
  creatorName: string | null;
  myStatus: string | null;
  /** Its chat, when I am in it (participants and organiser). */
  conversationId: string | null;
  /** « Contact the organiser »: allowed by her messaging settings (the server's own rule). */
  canMessageHost: boolean;
  pinned: boolean;
};

type Row = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  place_name: string | null;
  area_id: string;
  city_id: string;
  category_id: string;
  sub_id: string | null;
  cover: string | null;
  price_minor: number;
  currency: string;
  capacity: number | null;
  going: number;
  status: string;
  girl_only: boolean;
  community_id: string | null;
  community_name: string | null;
  creator_id: string;
  creator_name: string | null;
  my_status: string | null;
  conversation_id: string | null;
  can_message_host: boolean | null;
  pinned_at?: string | null;
};

/** The state a member reads: open, full, happening now, ended or cancelled. */
export function cardState(status: string, going: number, capacity: number | null, mine: boolean): ActivityCardState {
  if (status === 'cancelled') return 'cancelled';
  if (status === 'finished') return 'ended';
  if (status === 'ongoing') return 'ongoing';
  return capacity != null && going >= capacity && !mine ? 'full' : 'open';
}

async function toCards(rows: Row[]): Promise<ActivityCard[]> {
  const links = await coverLinks(rows.map((r) => r.cover));
  return rows.map((r) => {
    const cat = (r.category_id in CATEGORY_BY_ID ? r.category_id : 'sport') as CategoryKey;
    const going = Number(r.going ?? 0);
    return {
      id: r.id,
      title: r.title,
      startsAt: Date.parse(r.starts_at),
      endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
      placeName: r.place_name,
      areaId: r.area_id,
      cityId: r.city_id,
      categoryId: r.category_id,
      photo: ideaPhoto(cat, r.title, r.place_name ?? undefined, r.sub_id),
      coverUrl: r.cover ? (links[r.cover] ?? null) : null,
      priceMinor: r.price_minor,
      currency: r.currency,
      capacity: r.capacity,
      going,
      state: cardState(r.status, going, r.capacity, r.my_status === 'going'),
      girlOnly: Boolean(r.girl_only),
      communityId: r.community_id,
      communityName: r.community_name,
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      myStatus: r.my_status,
      conversationId: r.conversation_id,
      canMessageHost: Boolean(r.can_message_host),
      pinned: Boolean(r.pinned_at),
    };
  });
}

/**
 * Cards of these activities, live (reloaded whenever activities change, by
 * anyone: the app's one sync channel). `get(id)`: the card, `null` when the
 * reader may not see it (« not available »), `undefined` while loading or
 * when the server cannot answer (the caller then shows what it had before).
 */
export function useActivityCards(ids: (string | null | undefined)[]): { get: (id: string) => ActivityCard | null | undefined; failed: boolean } {
  const uid = useAccount()?.userId;
  const list = [...new Set(ids.filter((x): x is string => Boolean(x)))].sort().join(',');
  const [state, setState] = useState<{ list: string; map: Record<string, ActivityCard>; failed: boolean }>({ list: '', map: {}, failed: false });
  const load = useCallback(() => {
    if (!supabase || !uid || !list) return () => undefined;
    let alive = true;
    supabase.rpc('activity_cards', { p_ids: list.split(',').slice(0, 50) }).then(
      async ({ data, error }) => {
        if (!alive) return;
        // Not on this server yet, or offline: nothing is said « not available » on that basis.
        if (error) return setState((s) => ({ ...s, list, failed: true }));
        const cards = await toCards((data as Row[]) ?? []);
        if (alive) setState({ list, map: Object.fromEntries(cards.map((c) => [c.id, c])), failed: false });
      },
      () => alive && setState((s) => ({ ...s, list, failed: true })),
    );
    return () => {
      alive = false;
    };
  }, [list, uid]);
  useEffect(() => load(), [load]);
  useRefreshOn(['activities'], () => void load());
  const answered = state.list === list && !state.failed;
  const get = useCallback((id: string) => (state.map[id] ?? (answered ? null : undefined)), [state.map, answered]);
  return { get, failed: state.list === list && state.failed };
}

/**
 * A community's activities for its feed (its own and its groups'), pinned
 * first, each with its real state. Empty (never an error on screen) when the
 * server does not have the feed yet: the Activities tab still lists them.
 */
export function useCommunityActivityCards(communityId: string, limit = 6): { cards: ActivityCard[]; loading: boolean; refresh: () => void } {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ key: string; cards: ActivityCard[] }>({ key: '', cards: [] });
  const key = `${uid ?? ''}|${communityId}|${limit}`;
  const load = useCallback(() => {
    if (!supabase || !uid) return () => undefined;
    let alive = true;
    supabase.rpc('community_activity_cards', { p_community: communityId, p_limit: limit }).then(
      async ({ data, error }) => {
        if (!alive) return;
        if (error) return setState({ key, cards: [] });
        const cards = await toCards((data as Row[]) ?? []);
        if (alive) setState({ key, cards });
      },
      () => alive && setState((s) => ({ key, cards: s.key === key ? s.cards : [] })),
    );
    return () => {
      alive = false;
    };
  }, [communityId, limit, uid, key]);
  useEffect(() => load(), [load]);
  useRefreshOn(['activities'], () => void load());
  const cards = useMemo(() => (state.key === key ? state.cards : []), [state, key]);
  return { cards, loading: Boolean(uid && supabase) && state.key !== key, refresh: () => void load() };
}
