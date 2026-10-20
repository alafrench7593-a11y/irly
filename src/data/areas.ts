import type { City, MapPoint } from './types';
import { zoneOf, zonesOf } from './zones';

/**
 * Neighbourhoods in an order people recognise, never the raw data order
 * (which starts with Deira in Dubai, so Deira used to come first in every
 * list and be picked silently as a default). Cities with zones list them
 * zone by zone, as the zones are defined (Marina & JBR, Downtown…), each
 * zone's neighbourhoods alphabetically; cities without zones alphabetically.
 */
export function areasForDisplay<A extends { id: string; name: string }>(city: { id: City['id'] }, areas: readonly A[]): A[] {
  const byName = (x: A, y: A) => x.name.localeCompare(y.name);
  const zones = zonesOf(city.id);
  if (!zones.length) return [...areas].sort(byName);
  const out: A[] = [];
  for (const z of zones) out.push(...areas.filter((a) => z.areas.includes(a.id)).sort(byName));
  out.push(...areas.filter((a) => !out.includes(a)).sort(byName));
  return out;
}

/**
 * The neighbourhood a form starts on: the one the member already chose,
 * when it belongs to this city, otherwise none (the form asks). A form never
 * picks a neighbourhood for the member.
 */
export function startArea(city: City, wanted?: string | null): string | null {
  return wanted && city.areas.some((a) => a.id === wanted) ? wanted : null;
}

/** The middle of a city's neighbourhoods: a neutral point where only a position is needed. */
export function cityCentre(city: City): MapPoint {
  const n = city.areas.length || 1;
  return {
    x: city.areas.reduce((s, a) => s + a.point.x, 0) / n,
    y: city.areas.reduce((s, a) => s + a.point.y, 0) / n,
  };
}

const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * What a neighbourhood picker lists. Typing ranks by how well the name
 * matches (exact, starts with, a word starts with, contains), then adds the
 * rest of a zone whose name starts with the term. Without a term: the zone's
 * neighbourhoods alphabetically, or the whole city in zone order.
 */
export function rankAreas<A extends { id: string; name: string }>(city: { id: City['id']; areas: readonly A[] }, query: string, zone?: string | null): A[] {
  const byName = (x: A, y: A) => x.name.localeCompare(y.name);
  const term = plain(query.trim());
  if (!term) {
    const z = zone ? zonesOf(city.id).find((x) => x.id === zone) : undefined;
    return z ? city.areas.filter((a) => z.areas.includes(a.id)).sort(byName) : areasForDisplay(city, city.areas);
  }
  const score = (name: string) => {
    const n = plain(name);
    if (n === term) return 0;
    if (n.startsWith(term)) return 1;
    if (n.split(/[^a-z0-9]+/).some((w) => w.startsWith(term))) return 2;
    return n.includes(term) ? 3 : -1;
  };
  const named = city.areas
    .map((a) => ({ a, s: score(a.name) }))
    .filter((x) => x.s >= 0)
    .sort((x, y) => x.s - y.s || byName(x.a, y.a))
    .map((x) => x.a);
  // Only a zone whose name starts with it: "dubai" must not pull in Deira
  // through "Creek & old Dubai".
  const zoneHit = (id: string) => plain(zoneOf(city.id, id)?.name ?? '').startsWith(term);
  return [...named, ...city.areas.filter((a) => !named.includes(a) && zoneHit(a.id)).sort(byName)];
}
