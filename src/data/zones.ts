import { CITIES } from './destinations';
import type { CityId } from './types';

export type Zone = { id: string; name: string; areas: string[] };

/**
 * Neighbourhoods grouped the way people think of the city ("Marina side",
 * "Creek", "MBR City"), so a picker shows a few zones instead of 66 chips.
 * A city without zones here shows its neighbourhoods directly.
 */
const ZONES: Partial<Record<CityId, Zone[]>> = {
  dubai: [
    { id: 'marina', name: 'Marina & JBR', areas: ['marina', 'jbr', 'jlt', 'bluewaters', 'dubaiharbour', 'palm', 'greens', 'mediacity', 'barshaheights', 'sufouh'] },
    { id: 'downtown', name: 'Downtown & Business Bay', areas: ['downtown', 'businessbay', 'difc', 'citywalk', 'd3'] },
    { id: 'coast', name: 'Jumeirah & the coast', areas: ['jumeirah', 'kitebeach', 'umsuqeim', 'wasl', 'lamer', 'satwa'] },
    { id: 'creek', name: 'Creek & old Dubai', areas: ['deira', 'burdubai', 'karama', 'jaddaf', 'creekharbour', 'festivalcity', 'garhoud', 'portrashid', 'mamzar', 'qusais', 'nahdadubai'] },
    { id: 'mbr', name: 'MBR City & Meydan', areas: ['meydan', 'sobha', 'azizi', 'mbrcity', 'nadalsheba', 'barari', 'alquoz'] },
    { id: 'newdubai', name: 'JVC, Hills & new Dubai', areas: ['jvc', 'jvt', 'hills', 'albarsha', 'springs', 'jumeirahpark', 'alfurjan', 'discoverygardens', 'impz', 'arjan', 'motorcity', 'sportscity', 'tilalalghaf'] },
    { id: 'villas', name: 'Villa communities & desert', areas: ['ranches', 'damachills', 'townsquare', 'dubailand', 'alqudra'] },
    { id: 'east', name: 'Mirdif & the east', areas: ['mirdif', 'siliconoasis', 'warqa', 'khawaneej', 'internationalcity'] },
    { id: 'south', name: 'Jebel Ali, Expo & Hatta', areas: ['jebelali', 'dubaisouth', 'expocity', 'hatta'] },
  ],
};

export function zonesOf(cityId: CityId): Zone[] {
  return ZONES[cityId] ?? [];
}

/** The zone a neighbourhood belongs to (null when the city has no zones). */
export function zoneOf(cityId: CityId, areaId: string): Zone | null {
  return zonesOf(cityId).find((z) => z.areas.includes(areaId)) ?? null;
}

/** Every neighbourhood of a city with zones is in exactly one zone. */
export function zoneGaps(): string[] {
  const out: string[] = [];
  for (const [cityId, zones] of Object.entries(ZONES)) {
    const ids = CITIES[cityId as CityId].areas.map((a) => a.id);
    const seen = zones!.flatMap((z) => z.areas);
    for (const id of ids) if (!seen.includes(id)) out.push(`${cityId}:${id} has no zone`);
    for (const id of seen) if (!ids.includes(id)) out.push(`${cityId}:${id} is not a neighbourhood`);
    for (const id of new Set(seen)) if (seen.filter((x) => x === id).length > 1) out.push(`${cityId}:${id} is in two zones`);
  }
  return out;
}
