import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT_CATEGORY } from '@/data/catalog/mapping';
import { CITIES } from '@/data/destinations';
import { photo } from '@/data/photos';
import type { IrlEvent } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import type { CreatePreset } from '@/features/create/createStore';
import { isLibraryUrl } from '@/features/create/photoLibrary';
import { addDays, cityParts, type When } from '@/features/create/when';
import { coverLinks } from '@/features/server/activities';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { rpcInSpace } from '@/features/universe/spaceRpc';
import { useAppSpace } from '@/state/appSpace';

/**
 * « Y aller ensemble »: activities members create around an IRLY event.
 *
 * IRLY's events are catalogue content shipped with the app (src/data/content),
 * not rows of the database: an activity made from one stores the event's
 * stable id (« e-d1 », « e-abudhabi-0 ») in activities.event_key, checked by
 * the server (20261109200000_irly_event_activities.sql). The event page asks
 * `event_activities` for the plans linked to it, with every visibility rule
 * of activities (IRLY Girl, members-only, blocks, cancelled, removed).
 */

/** The format the server accepts for an event key (same pattern as its check). */
export const EVENT_KEY = /^e-[a-z0-9]+(-[a-z0-9]+)*$/;
export const isEventKey = (key: string | null | undefined): key is string => Boolean(key && key.length <= 64 && EVENT_KEY.test(key));

/** The event's date and time as the activity form holds them, in the city's time. */
export function eventWhen(e: IrlEvent, now = Date.now()): When {
  const offset = CITIES[e.cityId]?.utcOffset ?? 4;
  const today = cityParts(now, offset).day;
  const [h, m] = e.when.time.split(':').map((x) => Number(x) || 0);
  const startMin = h * 60 + m;
  // An end only for a plan of less than 12 hours (longer is a whole-day event: the member sets it).
  const len = e.when.durationMin;
  const endMin = len > 0 && len < 12 * 60 ? (startMin + len) % (24 * 60) : null;
  return {
    day: addDays(today, Math.max(0, e.when.dayOffset)),
    start: { h, m },
    end: endMin == null ? null : { h: Math.floor(endMin / 60), m: endMin % 60 },
  };
}

/** The activity form, filled from the event: its name, category, emirate, neighbourhood, venue, date, time and photo. */
export function presetFromEvent(e: IrlEvent): CreatePreset {
  const cover = photo(e.visual.photo, 900, undefined, true);
  return {
    eventKey: e.id,
    eventTitle: e.title,
    title: e.title,
    categoryId: EVENT_CATEGORY[e.category],
    cityId: e.cityId,
    areaId: e.areaId,
    place: e.venue,
    when: eventWhen(e),
    // Only an IRLY library photo can be an activity's photo (the server checks it too).
    cover: isLibraryUrl(cover) ? cover : undefined,
  };
}

/** A member activity linked to an event, as its page lists it. */
export type EventActivity = {
  id: string;
  title: string;
  categoryId: string;
  cityId: string;
  areaId: string;
  placeName: string | null;
  startsAt: number;
  endsAt: number | null;
  capacity: number | null;
  going: number;
  girlOnly: boolean;
  communityId: string | null;
  communityName: string | null;
  creatorId: string;
  creatorName: string | null;
  coverUrl: string | null;
  myStatus: string | null;
};

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

/**
 * The plans members made for this event that I may see. Signed out, in the
 * demo (no server) or for an id that is not an event key: an empty list,
 * never an error.
 */
export function useEventActivities(eventId: string): { items: EventActivity[]; loading: boolean; error: string | null; refresh: () => void } {
  const uid = useAccount()?.userId;
  // This app space's plans only (20261110700000): never a women-only plan in Mixte.
  const space = useAppSpace();
  const key = isEventKey(eventId) ? eventId : null;
  const enabled = Boolean(supabase && uid && key);
  // Which question the list answers: until its first answer arrives, it is loading.
  const asked = `${uid ?? ''}|${key ?? ''}|${space}`;
  const [result, setResult] = useState<{ for: string; items: EventActivity[]; error: string | null }>({ for: '', items: [], error: null });
  const seq = useRef(0);

  const load = useCallback(() => {
    if (!supabase || !uid || !key) return;
    const mine = ++seq.current;
    const sb = supabase;
    (async () => {
      const { data, error: e } = await rpcInSpace(sb, 'event_activities', { p_event: key, p_limit: 50 }, space);
      if (e) throw new Error(e.message);
      const rows = (data as Row[] | null) ?? [];
      const links = await coverLinks(rows.map((r) => r.cover_url)).catch(() => ({}) as Record<string, string>);
      return rows.map(
        (r): EventActivity => ({
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
        }),
      );
    })().then(
      (list) => mine === seq.current && setResult({ for: `${uid}|${key}|${space}`, items: list, error: null }),
      // A failure keeps what is shown and says so.
      (e: unknown) =>
        mine === seq.current &&
        setResult((prev) => ({ for: `${uid}|${key}|${space}`, items: prev.for === `${uid}|${key}|${space}` ? prev.items : [], error: e instanceof Error ? e.message : 'offline' })),
    );
  }, [uid, key, space]);

  useEffect(load, [load]);
  // Created, joined, left, cancelled anywhere in the app: the list follows.
  useRefreshOn(['activities'], load);

  const current = enabled && result.for === asked;
  return { items: current ? result.items : [], loading: enabled && !current, error: current ? result.error : null, refresh: load };
}

/** The event an activity was made for (its key), or null. Readable whenever the activity is. */
export function useActivityEventKey(activityId: string): string | null {
  const uid = useAccount()?.userId;
  const [key, setKey] = useState<{ for: string; key: string | null }>({ for: '', key: null });
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    supabase
      .from('activities')
      .select('event_key')
      .eq('id', activityId)
      .maybeSingle()
      .then(({ data }) => {
        const k = (data as { event_key?: string | null } | null)?.event_key ?? null;
        if (alive) setKey({ for: activityId, key: isEventKey(k) ? k : null });
      });
    return () => {
      alive = false;
    };
  }, [activityId, uid]);
  return key.for === activityId ? key.key : null;
}
