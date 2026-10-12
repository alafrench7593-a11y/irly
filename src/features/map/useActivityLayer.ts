import { useMemo, useState } from 'react';
import type { City } from '@/data/types';
import { CATEGORIES } from '@/data/catalog/categories';
import { useMyCommunityOptions } from '@/features/server/activities';
import { cityWhen } from '@/lib/time';
import { activityMarkers, type MapMarkerData } from './markers';
import { NO_FILTERS, useMapActivities, type MapFilters } from './serverActivities';

/** Real activities for a map screen: markers, filters and the options to show. */
export function useActivityLayer(city: City, origin: { latitude: number; longitude: number } | null = null) {
  const [filters, setFilters] = useState<MapFilters>(NO_FILTERS);
  const rows = useMapActivities(city.id, filters, origin);
  const mine = useMyCommunityOptions();
  const markers: MapMarkerData[] = useMemo(() => activityMarkers(city, rows, (ms) => cityWhen(ms, city.id)), [city, rows]);
  const filterOptions = useMemo(
    () => ({
      // Only categories that have activities on the map right now, plus the one chosen.
      categories: CATEGORIES.filter((c) => c.id === filters.category || rows.some((r) => r.categoryId === c.id)).map((c) => ({ id: c.id as string, label: c.label })),
      communities: mine.filter((c) => !c.groupOf).map((c) => ({ id: c.id, name: c.name })),
      canDistance: Boolean(origin),
    }),
    [rows, mine, origin, filters.category],
  );
  return { markers, filters, setFilters, filterOptions };
}
