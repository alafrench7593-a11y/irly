import type { IconName } from '@/components/ui/Icon';
import { t as tx } from '@/i18n';
import { ACTIVITIES, EVENT_CATEGORIES, PLACE_KINDS } from '@/data/catalog';
import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { cityCentre } from '@/data/areas';
import { DEMO_PLANS } from '@/data/content/girlDemo';
import { GIRL_PEOPLE } from '@/data/content/girls';
import { areaCoords, toLatLng, type LatLng } from '@/data/geo';
import { findPerson } from '@/data/repo';
import type { City, CityContent, CityId, MapPoint } from '@/data/types';
import type { HeroKind } from '@/features/hero/heroStore';
import type { Live } from '@/features/live/liveStore';
import { planStartsAt } from '@/features/girl/demo';
import { formatCount } from '@/lib/format';
import { cityWhen, planDate, whenLabel } from '@/lib/time';
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
  /** A member account (server): her own profile photo is shown, read by id. */
  userId?: string;
  goingIds?: string[];
  count?: number;
  live?: boolean;
  /** Events: « OCT » and « 20 ». */
  month?: string;
  day?: string;
  /** Free text for the sheet. */
  body?: string;
  /** A server activity: its page (the same record everywhere). */
  href?: string;
};

/**
 * People (members, their lives) and things to do (activities, events,
 * groups, places) never share a bubble: each family clusters on its own.
 */
export type Family = 'people' | 'plans';
export const familyOf = (type: MarkerType): Family => (type === 'person' || type === 'live' ? 'people' : 'plans');

export type Cluster = { id: string; point: MapPoint; members: MapMarkerData[]; colors: string[]; family: Family };

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

/**
 * Server activities at their real position (a listed place, or an address
 * matched precisely by the server). On the IRLY canvas the same position is
 * drawn relative to the nearest neighbourhood; on real maps it is exact.
 */
export function activityMarkers(city: City, rows: MapActivityRow[], whenText: (ms: number) => string): MapMarkerData[] {
  const anchors = city.areas
    .map((a) => ({ a, c: areaCoords(city.id, a.id) }))
    .filter((x): x is { a: City['areas'][number]; c: LatLng } => Boolean(x.c));
  if (!anchors.length) return [];
  const k = 0.16;
  return rows.map((r) => {
    const near = anchors.reduce((best, x) =>
      Math.hypot(x.c.latitude - r.latitude, x.c.longitude - r.longitude) < Math.hypot(best.c.latitude - r.latitude, best.c.longitude - r.longitude) ? x : best,
    );
    const point = {
      x: Math.min(0.99, Math.max(0.01, near.a.point.x + (r.longitude - near.c.longitude) / k)),
      y: Math.min(0.99, Math.max(0.01, near.a.point.y - (r.latitude - near.c.latitude) / k)),
    };
    return {
      id: `a:${r.id}`,
      type: 'activity' as const,
      areaId: near.a.id,
      point,
      coords: { latitude: r.latitude, longitude: r.longitude },
      title: r.title,
      subtitle: [r.status === 'ongoing' ? tx('Happening now') : whenText(r.startsAt), r.place ?? r.address, r.communityName ? tx(r.communityName) : null].filter(Boolean).join(' · '),
      // The activity's own category: its icon and colour, so a plan reads at a glance (and never as a person).
      icon: CATEGORY_BY_ID[r.categoryId as CategoryKey]?.icon ?? ('calendar' as const),
      color: CATEGORY_BY_ID[r.categoryId as CategoryKey]?.color ?? category.business,
      count: r.going,
      live: r.status === 'ongoing',
      body: r.description ?? r.address ?? undefined,
      href: `/a/${r.id}`,
    };
  });
}
export type MapActivityRow = { id: string; title: string; description: string | null; startsAt: number; place: string | null; address: string | null; latitude: number; longitude: number; categoryId: string; communityName: string | null; status: 'upcoming' | 'ongoing'; going: number };

/** A member the server placed on the map: her neighbourhood, never finer (see map_people). */
export type MapPersonRow = { id: string; firstName: string; username: string | null; cityId: string; areaId: string; verified: boolean };

/** People colour on the map: one for every member, so a person never reads as a plan. */
export const PERSON_COLOR = category.networking;

/**
 * Members who chose to appear, around their neighbourhood: its centre plus
 * a fixed offset drawn from their id (the same every time, so watching the
 * map tells nothing more than the neighbourhood).
 */
export function peopleMarkers(city: City, rows: MapPersonRow[]): MapMarkerData[] {
  return rows.flatMap((r) => {
    const base = areaCoords(r.cityId as CityId, r.areaId);
    if (!base) return [];
    const area = city.areas.find((a) => a.id === r.areaId);
    const anchor = area?.point ?? cityCentre(city);
    const point = jitter(anchor, r.id, 0.05);
    return [
      {
        id: `u:${r.id}`,
        type: 'person' as const,
        areaId: r.areaId,
        point,
        coords: { latitude: base.latitude - (point.y - anchor.y) * 0.16, longitude: base.longitude + (point.x - anchor.x) * 0.16 },
        title: r.firstName,
        subtitle: [r.username ? `@${r.username}` : null, area?.name ?? null].filter(Boolean).join(' · '),
        icon: 'user' as const,
        color: PERSON_COLOR,
        userId: r.id,
      },
    ];
  });
}

/**
 * The example content of the demonstration build (production content is
 * empty: see data/repo). In IRLY Girl: the example women and the example
 * IRLY Girl plans only, never the IRLY ones.
 */
export function buildMarkers(city: City, content: CityContent, lives: Live[] = [], girl = false): MapMarkerData[] {
  const pt = (areaId: string) => city.areas.find((a) => a.id === areaId)?.point ?? cityCentre(city);
  const list: MapMarkerData[] = [];
  lives.forEach((l) => {
    // The author of the live (IRLY or IRLY Girl example member), never someone else's name or photo.
    const p = l.authorId === 'me' ? undefined : findPerson(l.authorId);
    if (l.authorId !== 'me' && !p) return;
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
  if (girl) {
    girlDemo(city, pt).forEach((m) => list.push(m));
    content.places.forEach((p) => list.push(placeMarker(p, pt)));
    return list.map((m) => ({ ...m, coords: m.coords ?? toLatLng(city.id, m.areaId, pt(m.areaId), m.point) }));
  }
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
      title: tx(s.title),
      subtitle: `${tx(s.venue)} · ${whenLabel(s.when, city)}`,
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
      title: tx(e.title),
      subtitle: `${tx(e.venue)} · ${whenLabel(e.when, city)}`,
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
      subtitle: `${tx('{n} members', { n: formatCount(c.members) })} · ${tx(c.rhythm)}`,
      icon: 'users',
      color: category.business,
      hero: { kind: 'community', id: c.id },
      goingIds: c.memberIds,
      count: c.members,
    }),
  );
  content.places.forEach((p) => list.push(placeMarker(p, pt)));
  return list.map((m) => ({ ...m, coords: toLatLng(city.id, m.areaId, pt(m.areaId), m.point) }));
}

function placeMarker(p: CityContent['places'][number], pt: (areaId: string) => MapPoint): MapMarkerData {
  return {
    id: p.id,
    type: 'place',
    areaId: p.areaId,
    point: jitter(pt(p.areaId), p.id),
    title: p.name,
    subtitle: `${tx(PLACE_KINDS[p.kind].label)} · ★ ${p.rating.toFixed(1)}`,
    icon: PLACE_KINDS[p.kind].icon,
    color: placeColor(p.kind),
    hero: { kind: 'place', id: p.id },
    body: p.blurb,
  };
}

const DEMO_PLAN_CATEGORY: Record<string, CategoryKey> = { padel: 'sport', yoga: 'wellness', brunch: 'food', coffee: 'food', walk: 'culture', beach: 'outdoor' } as Record<string, CategoryKey>;

/** IRLY Girl in the demo build: its example women (around their neighbourhood) and its example plans (their page opens on tap). */
function girlDemo(city: City, pt: (areaId: string) => MapPoint): MapMarkerData[] {
  const out: MapMarkerData[] = [];
  [...GIRL_PEOPLE.values()]
    .filter((p) => p.cityId === city.id)
    .forEach((p) =>
      out.push({
        id: p.id,
        type: 'person',
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
  if (city.id !== 'dubai') return out;
  DEMO_PLANS.forEach((p) => {
    const cat = DEMO_PLAN_CATEGORY[p.kind] ? CATEGORY_BY_ID[DEMO_PLAN_CATEGORY[p.kind]] : undefined;
    out.push({
      id: `a:${p.id}`,
      type: 'activity',
      areaId: p.area,
      point: jitter(pt(p.area), p.id),
      title: tx(p.title),
      subtitle: `${tx(p.place)} · ${cityWhen(planStartsAt(p), city.id)}`,
      icon: cat?.icon ?? 'calendar',
      color: cat?.color ?? category.activities,
      goingIds: p.going,
      count: p.going.length,
      href: `/a/${p.id}`,
    });
  });
  return out;
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
    const key = `${familyOf(m.type)}:${Math.floor(m.point.x / cell)}:${Math.floor(m.point.y / cell)}`;
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
    out.push({ kind: 'cluster', c: { id: `cl-${key}-${members.length}`, point: { x, y }, members, colors, family: familyOf(members[0].type) } });
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
