import { useCallback } from 'react';
import { cityScope } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useStore } from '@/state/store';

/**
 * Which cities a list shows. In the Emirates the default is all seven
 * emirates; « My emirate » narrows every list to the member's own city.
 * Bali is a single city, so there is nothing to choose.
 */
export function useCityFilter(cityId: CityId) {
  const only = useStore((s) => s.emirateOnly);
  const multi = cityScope(cityId).length > 1;
  const narrow = multi && only;
  const keep = useCallback((c: string | null | undefined) => !narrow || !c || c === cityId, [narrow, cityId]);
  return { multi, narrow, keep };
}
