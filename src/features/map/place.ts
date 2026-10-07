import type { LatLng } from '@/data/geo';
import type { Layer } from './MapControls';
import type { MapMarkerData, MarkerType } from './markers';

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type Located = MapMarkerData & { coords: LatLng };
export type Placed = { kind: 'marker'; m: Located } | { kind: 'cluster'; id: string; coords: LatLng; members: MapMarkerData[]; colors: string[] };

/** Map spans (latitude delta) for the zoom bands of the spec. */
export const STREET = 0.045;
export const CITY = 0.14;

const MIN_SPAN: Record<MarkerType, number> = {
  live: Infinity,
  activity: Infinity,
  event: Infinity,
  group: CITY,
  person: STREET,
  place: STREET,
};

/**
 * What the real map shows for a region: the layer's markers that are on
 * screen (plus a margin), grouped into clusters on a screen-sized grid,
 * at most 150 things. Shared by the native and web maps.
 */
export function placeMarkers(all: Located[], layer: Layer, region: Region, frame: { width: number; height: number }): Placed[] {
  const shown = all.filter((m) => (layer === 'all' ? region.latitudeDelta <= MIN_SPAN[m.type] : m.type === layer));
  const inView = shown.filter(
    (m) => Math.abs(m.coords.latitude - region.latitude) < region.latitudeDelta && Math.abs(m.coords.longitude - region.longitude) < region.longitudeDelta,
  );
  const cellLat = (region.latitudeDelta * (region.latitudeDelta > CITY ? 110 : 58)) / frame.height;
  const cellLng = (region.longitudeDelta * (region.latitudeDelta > CITY ? 110 : 58)) / frame.width;
  const grid = new Map<string, Located[]>();
  for (const m of inView) {
    const key = `${Math.floor(m.coords.latitude / cellLat)}:${Math.floor(m.coords.longitude / cellLng)}`;
    const list = grid.get(key);
    if (list) list.push(m);
    else grid.set(key, [m]);
  }
  const out: Placed[] = [];
  for (const [key, members] of grid) {
    if (members.length === 1) {
      out.push({ kind: 'marker', m: members[0] });
      continue;
    }
    const latitude = members.reduce((s, m) => s + m.coords.latitude, 0) / members.length;
    const longitude = members.reduce((s, m) => s + m.coords.longitude, 0) / members.length;
    out.push({ kind: 'cluster', id: `cl-${key}-${members.length}`, coords: { latitude, longitude }, members, colors: [...new Set(members.map((m) => m.color))].slice(0, 4) });
  }
  return out.slice(0, 150);
}
