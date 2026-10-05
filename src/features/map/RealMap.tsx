import type { CityId } from '@/data/types';

/**
 * Web build: no native map module, the IRLY map (SVG) is used instead.
 * The real map lives in RealMap.native.tsx (Apple Maps / Google Maps).
 */
export const hasRealMap = false;

export function RealCityMap(_props: { cityId: CityId; areaId?: string }) {
  return null;
}
