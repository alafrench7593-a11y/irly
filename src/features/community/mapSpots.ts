import { useMemo } from 'react';
import { DEMO } from '@/config/app';
import { DEMO_PLANS } from '@/data/content/girlDemo';
import { CITIES } from '@/data/destinations';
import { areaCoords, cityCoords, type LatLng } from '@/data/geo';
import type { CityId } from '@/data/types';
import { planStartsAt } from '@/features/girl/demo';
import { NO_FILTERS, useMapActivities } from '@/features/map/serverActivities';

/** What the Communities map needs of a community, whichever list it comes from. */
export type MapCommunity = {
  id: string;
  name: string;
  topic: string | null;
  categoryId: string | null;
  cityId: string | null;
  emoji: string | null;
  members: number;
  isMember: boolean;
};

/** A community's next meetup with a known place (a real activity, never a guess). */
export type Meetup = { communityId: string; coords: LatLng; place: string | null; startsAt: number };

/**
 * One marker of the map. `meetup`: where a community's next activity takes
 * place (the place the activity lists). `city`: communities with no meetup
 * placed yet, shown at their city (the only place the server records for a
 * community), never at an invented street.
 */
export type Spot = {
  id: string;
  kind: 'meetup' | 'city';
  coords: LatLng;
  label: string;
  communities: { c: MapCommunity; next: Meetup | null }[];
};

/** Real meetups of the communities around the city: the server's, or the demo's plans in the demo build. */
export function useCommunityMeetups(cityId: CityId): Meetup[] {
  const rows = useMapActivities(cityId, NO_FILTERS, null);
  return useMemo(() => {
    if (DEMO) {
      return DEMO_PLANS.flatMap((p) => {
        const coords = p.community ? areaCoords('dubai', p.area) : undefined;
        return p.community && coords ? [{ communityId: p.community, coords, place: p.place, startsAt: planStartsAt(p) }] : [];
      });
    }
    return rows.flatMap((r) =>
      r.communityId && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)
        ? [{ communityId: r.communityId, coords: { latitude: r.latitude, longitude: r.longitude }, place: r.place, startsAt: r.startsAt }]
        : [],
    );
  }, [rows]);
}

/**
 * Markers for a list: each community once, at its next meetup when it has
 * one, else at its city. Communities at the same place (about 100 m) share
 * a marker with their count. `unplaced` counts the ones with no position.
 */
export function buildSpots(list: MapCommunity[], meetups: Meetup[]): { spots: Spot[]; unplaced: number } {
  const next = new Map<string, Meetup>();
  for (const m of meetups) {
    const cur = next.get(m.communityId);
    if (!cur || m.startsAt < cur.startsAt) next.set(m.communityId, m);
  }
  const spots = new Map<string, Spot>();
  let unplaced = 0;
  for (const c of list) {
    const m = next.get(c.id) ?? null;
    const city = c.cityId ? CITIES[c.cityId as CityId] : undefined;
    const home = city ? cityCoords(city.id) : undefined;
    let key: string;
    let spot: Omit<Spot, 'communities'>;
    if (m) {
      key = `m:${m.coords.latitude.toFixed(3)},${m.coords.longitude.toFixed(3)}`;
      spot = { id: key, kind: 'meetup', coords: m.coords, label: m.place ?? city?.name ?? '' };
    } else if (city && home) {
      key = `c:${city.id}`;
      spot = { id: key, kind: 'city', coords: home, label: city.name };
    } else {
      unplaced++;
      continue;
    }
    const s = spots.get(key);
    if (s) s.communities.push({ c, next: m });
    else spots.set(key, { ...spot, communities: [{ c, next: m }] });
  }
  return { spots: [...spots.values()], unplaced };
}

/** Latitude / longitude box around the spots (or the city when there are none). */
export function spotBounds(spots: Spot[], cityId: CityId): { sw: LatLng; ne: LatLng } {
  const pts = spots.length ? spots.map((s) => s.coords) : [cityCoords(cityId) ?? { latitude: 25.2, longitude: 55.27 }];
  const lats = pts.map((p) => p.latitude);
  const lngs = pts.map((p) => p.longitude);
  // Never closer than a few streets, even for one marker.
  const pad = 0.02;
  return {
    sw: { latitude: Math.min(...lats) - pad, longitude: Math.min(...lngs) - pad },
    ne: { latitude: Math.max(...lats) + pad, longitude: Math.max(...lngs) + pad },
  };
}
