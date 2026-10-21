import { useMemo, useState } from 'react';
import type { City } from '@/data/types';
import { CATEGORIES } from '@/data/catalog/categories';
import { getCityContent } from '@/data/repo';
import { useLives } from '@/features/live/liveStore';
import { useMyCommunityOptions } from '@/features/server/activities';
import { cityWhen } from '@/lib/time';
import { useAppSpace } from '@/state/appSpace';
import { activityMarkers, buildMarkers, peopleMarkers, type MapMarkerData } from './markers';
import { useMapPeople } from './people';
import { NO_FILTERS, useMapActivities, type MapFilters } from './serverActivities';

/** Real activities for a map screen: markers, filters and the options to show. */
export function useActivityLayer(city: City, origin: { latitude: number; longitude: number } | null = null, layer?: string) {
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS);
  // The filters are shown on the Activities layer only, so they apply there only.
  const { list: rows, ready } = useMapActivities(city.id, layer && layer !== 'activity' ? NO_FILTERS : filters, origin);
  const mine = useMyCommunityOptions();
  const girl = useAppSpace() === 'girl';
  const markers: MapMarkerData[] = useMemo(() => activityMarkers(city, rows, (ms) => cityWhen(ms, city.id)), [city, rows]);
  const filterOptions = useMemo(
    () => ({
      // Only categories that have activities on the map right now, plus the one chosen.
      categories: CATEGORIES.filter((c) => c.id === filters.category || rows.some((r) => r.categoryId === c.id)).map((c) => ({ id: c.id as string, label: c.label })),
      // The communities of the space shown (IRLY Girl's in IRLY Girl, the others in IRLY).
      communities: mine.filter((c) => !c.groupOf && c.girlOnly === girl).map((c) => ({ id: c.id, name: c.name })),
      canDistance: Boolean(origin),
    }),
    [rows, mine, origin, filters.category, girl],
  );
  return { markers, filters, setFilters, filterOptions, ready };
}

/**
 * Everything a map screen shows, for the space the member is in: the
 * server's activities (shown whoever goes), the members who chose to
 * appear (their neighbourhood only), and the example content of the demo
 * build. People and plans stay separate layers (see familyOf).
 */
export function useMapLayers(city: City, origin: { latitude: number; longitude: number } | null, layer: string) {
  const content = getCityContent(city.id);
  const lives = useLives();
  const girl = useAppSpace() === 'girl';
  const acts = useActivityLayer(city, origin, layer);
  const people = useMapPeople(city.id);
  const all = useMemo(
    () => [...buildMarkers(city, content, lives, girl), ...peopleMarkers(city, people.list), ...acts.markers],
    [city, content, lives, girl, people.list, acts.markers],
  );
  return { all, acts, ready: acts.ready && people.ready };
}
