import type { IconName } from '@/components/ui/Icon';
import { t as tx } from '@/i18n';
import { ACTIVITIES, EVENT_CATEGORIES, PLACE_KINDS } from '@/data/catalog';
import { toLatLng, type LatLng } from '@/data/geo';
import type { City, CityContent, MapPoint } from '@/data/types';
import type { HeroKind } from '@/features/hero/heroStore';
import type { Live } from '@/features/live/liveStore';
import { formatCount } from '@/lib/format';
import { planDate, whenLabel } from '@/lib/time';
import { activityColor, eventColor, placeColor } from '@/theme/categories';
import { category, status } from '@/theme/tokens';

export type MarkerType = 'person' | 'activity' | 'event' | 'group' | 'place' | 'live';

export type MapMarkerData = {
  id: string;
  type: MarkerType;
  point: MapPoint;
  /** Neighbourhood the marker belongs to. */
  areaId: string;
  /** Real position (neighbourhood centre + fixed offset), for the real map. */
  coords?: LatLng;
  title: string;
  subtitle: string;
  icon: IconName;
  /** Category or status colour: icon, dot, halo or ring. Never a fill. */
  color: string;
  hero?: { kind: HeroKind; id: string };
  personId?: string;
  goingIds?: string[];
  count?: number;
  live?: boolean;
  /** Events: « OCT » and « 20 ». */
  month?: string;
  day?: string;
  /** Free text for the sheet. */
  body?: string;
};

export type Cluster = { id: string; point: MapPoint; members: MapMarkerData[]; colors: string[] };

export type Placed = { kind: 'marker'; m: MapMarkerData } | { kind: 'cluster'; c: Cluster };

/**
 * Zoom bands, in IRLY camera scale (1 = whole city fits). They mirror the
 * Google zoom levels of the spec: city view (clusters only), neighbourhood
 * (activities, events, groups), street (people and places too).
 */
export const ZOOM = { neighbourhood: 1.0, street: 1.45 } as const;

const MIN_ZOOM: Record<MarkerType, number> = {
  live: 0,
  activity: 0,
  event: 0,
  group: ZOOM.neighbourhood,
  person: ZOOM.street,
  place: ZOOM.street,
};

export function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic offset around an area centre, so a neighbourhood is not one dot. */
export function jitter(p: MapPoint, id: string, spread = 0.045): MapPoint {
  const h = hash(id);
  const angle = (h % 360) * (Math.PI / 180);
  const r = spread * (0.35 + ((h >> 8) % 100) / 160);
  return { x: Math.min(0.97, Math.max(0.03, p.x + Math.cos(angle) * r)), y: Math.min(0.97, Math.max(0.03, p.y + Math.sin(angle) * r)) };
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function buildMarkers(city: City, content: CityContent, lives: Live[] = []): MapMarkerData[] {
  const pt = (areaId: string) => (city.areas.find((a) => a.id === areaId) ?? city.areas[0]).point;
  const list: MapMarkerData[] = [];
  lives.forEach((l) => {
    const p = l.authorId === 'me' ? undefined : content.people.find((x) => x.id === l.authorId);
    list.push({
      id: l.id,
      type: 'live',
      // A live is placed at its neighbourhood, never at an address.
      areaId: l.areaId,
      point: jitter(pt(l.areaId), l.id, 0.03),
      title: p ? tx('{name} is live', { name: p.name }) : tx('You are live'),
      subtitle: `${tx(l.place)} · ${tx('now')}`,
      icon: 'zap',
      color: status.live,
      personId: p?.id,
      body: l.text,
      live: true,
    });
  });
  content.people.forEach((p) =>
    list.push({
      id: p.id,
      type: 'person',
      // Privacy: a person is never shown at an address, only around their
      // neighbourhood, with a fixed per-person offset.
      areaId: p.areaId,
      point: jitter(pt(p.areaId), p.id, 0.05),
      title: p.name,
      subtitle: p.headline,
      icon: 'user',
      color: p.online ? status.availableNow : status.availableLater,
      personId: p.id,
      body: p.bio,
    }),
  );
  content.sessions.forEach((s) =>
    list.push({
      id: s.id,
      type: 'activity',
      areaId: s.areaId,
      point: jitter(pt(s.areaId), s.id),
      title: s.title,
      subtitle: `${s.venue} · ${whenLabel(s.when, city)}`,
      icon: ACTIVITIES[s.kind].icon,
      color: activityColor(s.kind),
      hero: { kind: 'session', id: s.id },
      goingIds: s.goingIds,
      count: s.goingIds.length + s.extraGoing,
      live: s.when.dayOffset === 0,
    }),
  );
  content.events.forEach((e) => {
    const d = planDate(e.when, city);
    list.push({
      id: e.id,
      type: 'event',
      areaId: e.areaId,
      point: jitter(pt(e.areaId), e.id),
      title: e.title,
      subtitle: `${e.venue} · ${whenLabel(e.when, city)}`,
      icon: EVENT_CATEGORIES[e.category].icon,
      color: eventColor(e.category),
      hero: { kind: 'event', id: e.id },
      goingIds: e.goingIds,
      count: e.goingIds.length + e.extraGoing,
      live: e.when.dayOffset === 0,
      month: MONTHS[d.getUTCMonth()],
      day: String(d.getUTCDate()),
      body: e.description,
    });
  });
  content.communities.forEach((c) =>
    list.push({
      id: c.id,
      type: 'group',
      areaId: city.areas[hash(c.id) % city.areas.length].id,
      point: jitter(pt(city.areas[hash(c.id) % city.areas.length].id), c.id),
      title: c.name,
      subtitle: `${formatCount(c.members)} members · ${c.rhythm}`,
      icon: 'users',
      color: category.business,
      hero: { kind: 'community', id: c.id },
      goingIds: c.memberIds,
      count: c.members,
    }),
  );
  content.places.forEach((p) =>
    list.push({
      id: p.id,
      type: 'place',
      areaId: p.areaId,
      point: jitter(pt(p.areaId), p.id),
      title: p.name,
      subtitle: `${PLACE_KINDS[p.kind].label} · ★ ${p.rating.toFixed(1)}`,
      icon: PLACE_KINDS[p.kind].icon,
      color: placeColor(p.kind),
      hero: { kind: 'place', id: p.id },
      body: p.blurb,
    }),
  );
  return list.map((m) => ({ ...m, coords: toLatLng(city.id, m.areaId, pt(m.areaId), m.point) }));
}

/**
 * Markers to draw at a zoom level. Grid clustering in screen space: two
 * markers closer than `cellPx` on screen merge into a bubble. Below the
 * neighbourhood band everything clusters; above it, only true overlaps do.
 */
export function placeMarkers(all: MapMarkerData[], zoom: number, S: number, cellPx = 52, max = 150): Placed[] {
  const shown = all.filter((m) => zoom >= MIN_ZOOM[m.type]);
  // Street level: no bubbles, overlapping markers are pushed apart so each
  // stays tappable (a few relaxation passes, they stay near their area).
  if (zoom >= ZOOM.street && shown.length <= max) {
    return declutter(shown, 46 / (S * zoom)).map((m) => ({ kind: 'marker' as const, m }));
  }
  const city = zoom < ZOOM.neighbourhood;
  const cell = (city ? cellPx * 1.8 : cellPx) / (S * zoom);
  const grid = new Map<string, MapMarkerData[]>();
  for (const m of shown) {
    const key = `${Math.floor(m.point.x / cell)}:${Math.floor(m.point.y / cell)}`;
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
    const x = members.reduce((s, m) => s + m.point.x, 0) / members.length;
    const y = members.reduce((s, m) => s + m.point.y, 0) / members.length;
    const colors = [...new Set(members.map((m) => m.color))].slice(0, 4);
    out.push({ kind: 'cluster', c: { id: `cl-${key}-${members.length}`, point: { x, y }, members, colors } });
  }
  // Never more than `max` things on screen: the rest stays in bubbles.
  return out.slice(0, max);
}

/** Pushes overlapping points apart until they are at least `minDist` apart. */
function declutter(list: MapMarkerData[], minDist: number): MapMarkerData[] {
  const pts = list.map((m) => ({ ...m.point }));
  for (let pass = 0; pass < 24; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x;
        let dy = pts[j].y - pts[i].y;
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 1e-6) {
          dx = Math.cos(i + j);
          dy = Math.sin(i + j);
          d = 1;
        }
        const push = (minDist - Math.min(d, minDist)) / 2;
        pts[i].x -= (dx / d) * push;
        pts[i].y -= (dy / d) * push;
        pts[j].x += (dx / d) * push;
        pts[j].y += (dy / d) * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return list.map((m, i) => ({ ...m, point: pts[i] }));
}
