import { create } from 'zustand';
import { DEMO } from '@/config/app';
import { CITIES } from '@/data/destinations';
import type { CityId, DestinationId } from '@/data/types';
import { isMissingFunction } from '@/features/live/livePublish';
import { changed } from '@/features/server/sync';
import { friendlyError, supabase } from '@/lib/supabase';
import { useStore } from '@/state/store';

/**
 * Regions: where a member lives decides what she sees (migration
 * 20261125000000). One IRLY account, one region at a time: IRLY Emirates
 * for people who live in the United Arab Emirates, IRLY Bali for people
 * who live in Bali. Inside a region the city is hers to switch; moving to
 * another region is asked for here, with a declaration, and the server
 * decides (one move every 90 days, the communities of the region left are
 * left with it, private chats stay).
 *
 * The region is the server's country id of the destination. A destination
 * opened later only needs its line here and its cities on the server.
 */
export const REGION_OF: Partial<Record<DestinationId, string>> = { emirates: 'ae', bali: 'id' };

export const regionOfCity = (cityId: CityId | null | undefined): string | null => (cityId && CITIES[cityId] ? (REGION_OF[CITIES[cityId].destinationId] ?? null) : null);

export type MyRegion = { regionId: string | null; cityId: string | null; declaredAt: number | null; canChangeAt: number | null };

type Row = Record<string, unknown>;
const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
const toRegion = (r: Row | null): MyRegion => ({
  regionId: typeof r?.region_id === 'string' ? r.region_id : null,
  cityId: typeof r?.city_id === 'string' ? r.city_id : null,
  declaredAt: time(r?.declared_at),
  canChangeAt: time(r?.can_change_at),
});

function sb() {
  if (!supabase) throw new Error(DEMO ? 'Not available in the demo' : 'The IRLY server is not configured');
  return supabase;
}

function fail(error: { code?: string | null; message: string }): never {
  if (isMissingFunction(error)) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
  throw new Error(friendlyError(error.message));
}

/** My region on the server; null when it cannot be read (no account, a server not updated yet). */
export async function fetchMyRegion(): Promise<MyRegion | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_region');
  if (error) return null;
  return toRegion((Array.isArray(data) ? data[0] : data) as Row | null);
}

/**
 * « I live in this region », recorded once with its date. A statement on
 * the member's honour: IRLY checks no document.
 */
export async function declareResidency(regionId: string): Promise<void> {
  const { error } = await sb().rpc('declare_residency', { p_region: regionId });
  if (error && !isMissingFunction(error)) fail(error);
}

/** Moves the account to another region. The server leaves the old region's communities and coming activities. */
export async function changeRegion(cityId: CityId): Promise<{ leftCommunities: number; leftActivities: number }> {
  const regionId = regionOfCity(cityId);
  if (!regionId) throw new Error('This region is not open yet');
  const { data, error } = await sb().rpc('change_region', { p_region: regionId, p_city: cityId, p_resident: true });
  if (error) fail(error);
  const r = ((Array.isArray(data) ? data[0] : data) ?? {}) as Row;
  // The server moved the account: this phone follows, and every list reloads for the new region.
  useStore.getState().forceCity(cityId);
  changed('communities', 'activities', 'people', 'inbox');
  return { leftCommunities: Number(r.left_communities) || 0, leftActivities: Number(r.left_activities) || 0 };
}

/* ───────── the request to move, opened from wherever a city of another region is picked ───────── */

export const useRegionChange = create<{ target: CityId | null }>(() => ({ target: null }));
export const askRegionChange = (cityId: CityId) => useRegionChange.setState({ target: cityId });
export const closeRegionChange = () => useRegionChange.setState({ target: null });
