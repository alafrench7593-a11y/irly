import type { CityId, MapPoint } from './types';

export type LatLng = { latitude: number; longitude: number };

/**
 * Real coordinates of every neighbourhood IRLY knows, by city. Centres are
 * approximate (a neighbourhood, not an address): good enough to place
 * plans and people around an area, never precise enough to locate anyone.
 */
const AREAS: Record<CityId, Record<string, [number, number]>> = {
  dubai: {
    deira: [25.2697, 55.3095],
    burdubai: [25.2532, 55.2972],
    difc: [25.213, 55.2795],
    downtown: [25.1972, 55.2744],
    businessbay: [25.1857, 55.265],
    jumeirah: [25.2062, 55.2393],
    alquoz: [25.1386, 55.2302],
    kitebeach: [25.159, 55.1985],
    palm: [25.1124, 55.139],
    marina: [25.0805, 55.1403],
    jlt: [25.0693, 55.1447],
    hills: [25.1093, 55.2459],
    alqudra: [24.838, 55.38],
  },
  abudhabi: {
    saadiyat: [24.54, 54.43],
    minazayed: [24.523, 54.379],
    corniche: [24.476, 54.333],
    reem: [24.499, 54.404],
    maryah: [24.501, 54.389],
    yas: [24.488, 54.603],
    khalifa: [24.42, 54.577],
  },
  sharjah: {
    alkhan: [25.327, 55.358],
    majaz: [25.324, 55.383],
    qasba: [25.323, 55.376],
    heritage: [25.36, 55.388],
    aljada: [25.308, 55.461],
    unicity: [25.29, 55.48],
  },
  ajman: {
    corniche: [25.414, 55.435],
    alzorah: [25.443, 55.487],
    nuaimiya: [25.399, 55.447],
    aljurf: [25.41, 55.502],
  },
  rak: {
    marjan: [25.664, 55.74],
    hamra: [25.69, 55.78],
    minaalarab: [25.729, 55.834],
    rakcity: [25.7895, 55.9432],
    jebeljais: [25.953, 56.126],
  },
  fujairah: {
    dibba: [25.619, 56.273],
    alaqah: [25.496, 56.36],
    fujcity: [25.1288, 56.3265],
    masafi: [25.307, 56.164],
    wadi: [25.45, 56.28],
  },
  uaq: {
    mangroves: [25.553, 55.59],
    oldtown: [25.565, 55.555],
    lagoon: [25.54, 55.62],
    alsalam: [25.51, 55.635],
  },
  bali: {
    ubud: [-8.5069, 115.2625],
    pererenan: [-8.645, 115.121],
    canggu: [-8.6478, 115.1385],
    seminyak: [-8.6913, 115.1682],
    sanur: [-8.6939, 115.2622],
    kuta: [-8.718, 115.169],
    jimbaran: [-8.79, 115.16],
    bingin: [-8.806, 115.113],
    uluwatu: [-8.829, 115.087],
  },
};

export function areaCoords(cityId: CityId, areaId: string): LatLng | undefined {
  const c = AREAS[cityId]?.[areaId];
  return c ? { latitude: c[0], longitude: c[1] } : undefined;
}

/**
 * Real position of something IRLY placed on its own canvas: the centre of
 * its neighbourhood plus the same small, fixed offset it had on the canvas
 * (about 100 to 900 m). Never an address.
 */
export function toLatLng(cityId: CityId, areaId: string, areaPoint: MapPoint, point: MapPoint): LatLng | undefined {
  const base = areaCoords(cityId, areaId);
  if (!base) return undefined;
  const k = 0.16;
  return { latitude: base.latitude - (point.y - areaPoint.y) * k, longitude: base.longitude + (point.x - areaPoint.x) * k };
}
