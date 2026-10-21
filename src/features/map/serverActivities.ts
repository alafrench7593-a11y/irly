import { useCallback, useEffect, useRef, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { useAppSpace } from '@/state/appSpace';
import { useRefreshOn } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { offsetOf } from '@/lib/time';
import { displayCommunityName } from '@/features/community/name';

/**
 * Activities on the map: the server's, only those the member may see, only
 * where their position is reliable (a listed place, or an address the
 * geocoder matched precisely). Never placed at a guessed point.
 */
export type MapWhen = 'any' | 'today' | 'week';
export type MapFilters = { when: MapWhen; category: string | null; community: string | null; km: number | null };
export const NO_FILTERS: MapFilters = { when: 'any', category: null, community: null, km: null };

export type MapActivity = {
  id: string;
  title: string;
  description: string | null;
  startsAt: number;
  place: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  categoryId: string;
  /** The community running it, when one does (the Communities map places it there). */
  communityId: string | null;
  communityName: string | null;
  status: 'upcoming' | 'ongoing';
  going: number;
  capacity: number | null;
  distanceKm: number | null;
};

const until = (when: MapWhen, cityId: string): string | null => {
  if (when === 'any') return null;
  if (when === 'week') return new Date(Date.now() + 7 * 86_400_000).toISOString();
  // "Today" ends at midnight in the city shown, not on the phone's clock (a Dubai phone browsing Bali).
  const shift = offsetOf(cityId) * 3_600_000;
  const local = new Date(Date.now() + shift);
  const endLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - 1;
  return new Date(endLocal - shift).toISOString();
};

export function useMapActivities(cityId: string, filters: MapFilters, origin: { latitude: number; longitude: number } | null): { list: MapActivity[]; ready: boolean } {
  const uid = useAccount()?.userId;
  // Each space shows its own plans: IRLY Girl's women-only ones there, none of them in IRLY (as every other list).
  const girl = useAppSpace() === 'girl';
  const lat = origin?.latitude ?? null;
  const lng = origin?.longitude ?? null;
  // The list is tagged with what it was read for: another account, city or space never shows it,
  // and a new filter keeps the markers until its answer (no empty state before the first answer).
  const base = `${uid}|${cityId}|${girl}`;
  const key = `${base}|${filters.when}|${filters.category}|${filters.community}|${filters.km}|${lat}|${lng}`;
  const [state, setState] = useState<{ base: string; key: string; list: MapActivity[] }>({ base: '', key: '', list: [] });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    const n = ++seq.current;
    supabase
      .rpc('map_activities', {
        p_city: cityId,
        p_to: until(filters.when, cityId),
        p_category: filters.category,
        p_community: filters.community,
        p_lat: filters.km && lat != null ? lat : null,
        p_lng: filters.km && lng != null ? lng : null,
        p_km: filters.km && lat != null ? filters.km : null,
        p_limit: 300,
        p_girl_only: girl,
      })
      .then(
        ({ data, error }) => {
          // Server not updated yet, offline, or IRLY Girl refused: no activity markers (never a guess).
          if (n !== seq.current) return;
          if (error) return setState({ base, key, list: [] });
          setState({
            base,
            key,
            list: ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
              id: r.id as string,
              title: r.title as string,
              description: (r.description as string | null) ?? null,
              startsAt: Date.parse(r.starts_at as string),
              place: (r.place_name as string | null) ?? null,
              address: (r.address as string | null) ?? null,
              latitude: Number(r.lat),
              longitude: Number(r.lng),
              categoryId: r.category_id as string,
              communityId: (r.community_id as string | null) ?? null,
              communityName: r.community_name ? displayCommunityName({ name: r.community_name as string }) : null,
              status: r.status === 'ongoing' ? 'ongoing' : 'upcoming',
              going: Number(r.going ?? 0),
              capacity: r.capacity == null ? null : Number(r.capacity),
              distanceKm: r.distance_km == null ? null : Number(r.distance_km),
            })),
          });
        },
        () => n === seq.current && setState({ base, key, list: [] }),
      );
  }, [uid, cityId, girl, base, key, filters.when, filters.category, filters.community, filters.km, lat, lng]);
  useEffect(load, [load]);
  // Created, edited, cancelled or deleted anywhere: the map follows.
  useRefreshOn(['activities'], load);
  // Signed out or without a server: nothing to wait for.
  if (!uid || !supabase) return { list: [], ready: true };
  return { list: state.base === base ? state.list : [], ready: state.key === key };
}
