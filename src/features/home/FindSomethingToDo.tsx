import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { ActivityCard, fromEvent, fromSession, gridTile, GRID_GAP, type ActivityCardItem, type Happening } from '@/components/cards/HomeCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { DEMO } from '@/config/app';
import { ACTIVITIES } from '@/data/catalog';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { CITIES, placeLabel } from '@/data/destinations';
import { findPerson, getCityContent, goingCount } from '@/data/repo';
import type { ActivitySession, CityId, IrlEvent } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { openCreate } from '@/features/create/createStore';
import { demoName, useDemoActivities } from '@/features/girl/demo';
import { openHero } from '@/features/hero/heroStore';
import { useServerActivities, type ServerActivity } from '@/features/server/activities';
import { t as tx, useLang } from '@/i18n';
import { formatPrice } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { useAppSpace } from '@/state/appSpace';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';

/* ───────── The filters: what members look for, on the catalog's categories ───────── */

export type FindKey = 'sport' | 'food' | 'beach' | 'nights' | 'shopping' | 'walks' | 'travel' | 'networking' | 'culture' | 'local' | 'other';

/** The chips, in this order. Each one only shows when it has at least one activity. */
export const FIND_FILTERS: { key: FindKey; label: string; icon: IconName }[] = [
  { key: 'sport', label: 'Sport & fitness', icon: 'dumbbell' },
  { key: 'food', label: 'Restaurants & cafés', icon: 'utensils' },
  { key: 'beach', label: 'Beach & beach clubs', icon: 'palm' },
  { key: 'nights', label: 'Nights out', icon: 'martini' },
  { key: 'shopping', label: 'Shopping', icon: 'shoppingBag' },
  { key: 'walks', label: 'Walks & dog walks', icon: 'pawPrint' },
  { key: 'travel', label: 'Travel & trips', icon: 'plane' },
  { key: 'networking', label: 'Networking', icon: 'handshake' },
  { key: 'culture', label: 'Culture', icon: 'landmark' },
  { key: 'local', label: 'Local experiences', icon: 'compass' },
  { key: 'other', label: 'Other', icon: 'sparkles' },
];

// Subcategories (catalog ids, src/data/catalog/categories.ts) that read better under another chip.
const OUTDOOR_WALKS = new Set(['hiking']);
const OUTDOOR_LOCAL = new Set(['desert', 'camping']);
const SHOWS = new Set(['concerts', 'comedy', 'theatre', 'live-shows', 'festivals']);

/**
 * The chip of an activity, from the category (and subcategory) it was
 * created with. Only ids the catalog really has are read; anything else
 * (no category, an older id) is « Other », never guessed from its title.
 */
export function findKeyOf(categoryId: string, subId?: string | null): FindKey {
  switch (categoryId as CategoryKey) {
    case 'sport':
    case 'wellness':
      return 'sport';
    case 'food':
      return 'food';
    case 'outdoor':
      if (subId && OUTDOOR_WALKS.has(subId)) return 'walks';
      if (subId && OUTDOOR_LOCAL.has(subId)) return 'local';
      return 'beach';
    case 'nightlife':
      return subId === 'beach-clubs' ? 'beach' : 'nights';
    case 'entertainment':
      // The server's default when nothing was chosen: without a subcategory it is not known to be a night out.
      if (!subId) return 'other';
      return SHOWS.has(subId) ? 'nights' : 'local';
    case 'shopping':
      return 'shopping';
    case 'animals':
      return 'walks';
    case 'travel':
      return 'travel';
    case 'networking':
      return 'networking';
    case 'culture':
    case 'creative':
      return 'culture';
    case 'learning':
    case 'family':
      // Classes, family days out, kids' activities: things to do locally.
      return 'local';
    default:
      return 'other';
  }
}

/* ───────── The data: real activities (the demo's own in the demo build) ───────── */

export type HomeActivity = ActivityCardItem & {
  find: FindKey;
  creatorId: string | null;
  /** Opens its real page. */
  open: (router: ReturnType<typeof useRouter>) => void;
};

const HOUR = 3600_000;

function fromServer(a: ServerActivity, viewer: CityId, demo: boolean): HomeActivity {
  const city = CITIES[a.cityId as CityId] ?? CITIES[viewer];
  const cat = (CATEGORY_BY_ID[a.categoryId as CategoryKey] ? a.categoryId : 'sport') as CategoryKey;
  return {
    id: a.id,
    title: a.title,
    categoryId: a.categoryId,
    find: findKeyOf(a.categoryId, a.subId),
    // The saved photo first (signed link, or an IRLY library photo), the category's photo otherwise.
    visual: { photo: ideaPhoto(cat, a.title, a.placeName ?? undefined, a.subId), uri: a.coverUrl },
    light: city.light,
    cityId: city.id,
    startsAt: a.startsAt,
    place: placeLabel(viewer, a.cityId, a.areaId, a.placeName),
    price: a.priceMinor ? `${a.currency} ${(a.priceMinor / 100).toLocaleString('en-US')}` : tx('Free'),
    going: a.going,
    capacity: a.capacity,
    joined: a.joined,
    creatorId: a.creatorId,
    organiser: demo ? demoName(a.creatorId) || null : null,
    open: (router) => router.push(`/a/${a.id}`),
  };
}

/** Demo build only (Mixte): the demo city's example sessions and events, opened on their own demo page. */
function fromDemo(h: Happening, joined: Record<string, boolean>, now: number): HomeActivity {
  const city = CITIES[h.item.cityId];
  const [hh, mm] = h.item.when.time.split(':').map(Number);
  const midnight = Math.floor((now + city.utcOffset * HOUR) / (24 * HOUR)) * 24 * HOUR - city.utcOffset * HOUR;
  const session = h.type === 'session' ? (h.item as ActivitySession) : null;
  const visual = session ? (session.visual ?? { photo: ACTIVITIES[session.kind].photo }) : (h.item as IrlEvent).visual;
  const capacity = session ? session.spots : (h.item as IrlEvent).capacity;
  return {
    id: h.id,
    // The demo's own example plans have French in the dictionary (the cards show their text as is).
    title: tx(h.title),
    categoryId: h.group,
    find: findKeyOf(h.group, session?.kind ?? null),
    visual,
    light: city.light,
    cityId: city.id,
    startsAt: midnight + h.item.when.dayOffset * 24 * HOUR + hh * HOUR + (mm || 0) * 60_000,
    place: tx(h.item.venue),
    price: tx(formatPrice(h.item.price, city.currency)),
    going: goingCount(h.item, Boolean(joined[h.id])),
    capacity: capacity || null,
    joined: Boolean(joined[h.id]),
    // Events are run by venues and organisers, sessions by members.
    creatorId: session ? session.hostId : null,
    organiser: session ? (findPerson(session.hostId)?.name.split(' ')[0] ?? null) : null,
    open: () => openHero({ kind: h.type, id: h.id }),
  };
}

/**
 * Every upcoming activity of the destination for the Home's grids, the same
 * in IRLY and IRLY Girl (in IRLY Girl the server only returns IRLY Girl
 * plans, to women). Production: the server's activities, nothing else. The
 * demo build (EXPO_PUBLIC_DEMO=1) shows its own example plans instead.
 */
export function useHomeActivities(cityId: CityId): { items: HomeActivity[]; loading: boolean; error: string | null; refresh: () => void; signedIn: boolean } {
  const server = useServerActivities(cityId);
  const demoGirl = useDemoActivities(cityId);
  const inGirl = useAppSpace() === 'girl';
  const joined = useStore((s) => s.joined);
  const signedIn = Boolean(useAccount());
  const now = useNow();
  // Prices ("Free") and the demo's texts are translated when the list is built.
  const lang = useLang();
  const content = DEMO ? getCityContent(cityId) : null;
  const items = useMemo(() => {
    void lang; // rebuilt when the language changes
    let list: HomeActivity[];
    if (DEMO && inGirl) list = demoGirl.activities.map((a) => fromServer(a, cityId, true));
    else if (DEMO && content) list = [...content.sessions.map(fromSession), ...content.events.map(fromEvent)].map((h) => fromDemo(h, joined, now));
    else list = server.activities.map((a) => fromServer(a, cityId, false));
    // Over (two hours after the start, as the server's join): never listed.
    return list.filter((a) => a.startsAt + 2 * HOUR >= now).sort((a, b) => a.startsAt - b.startsAt);
  }, [inGirl, demoGirl.activities, content, joined, now, server.activities, cityId, lang]);
  if (DEMO) return { items, loading: false, error: null, refresh: () => undefined, signedIn: true };
  return { items, loading: server.loading, error: server.error, refresh: server.refresh, signedIn };
}

/* ───────── The section ───────── */

const PAGE = 8;

/**
 * « Find something to do »: the activities of the destination as a grid of
 * photo cards (two per row on phones, three or four on wider screens),
 * filtered by what you feel like. The same section, at the same size, in
 * IRLY and IRLY Girl.
 */
export function FindSomethingToDo({ cityId: given }: { cityId?: CityId } = {}) {
  const current = useCityId();
  const cityId = given ?? current;
  const router = useRouter();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const { items, loading, error, refresh, signedIn } = useHomeActivities(cityId);
  const [filter, setFilter] = useState<FindKey | null>(null);
  const [shown, setShown] = useState(PAGE);
  // The section's own width (the framed phone on tablets is narrower than its frame by its borders).
  const [surface, setSurface] = useState(frame.width);
  const { width } = gridTile(surface);

  const counts = useMemo(() => {
    const m = new Map<FindKey, number>();
    for (const a of items) m.set(a.find, (m.get(a.find) ?? 0) + 1);
    return m;
  }, [items]);
  const chips = FIND_FILTERS.filter((f) => (counts.get(f.key) ?? 0) > 0);
  // A chip whose activities are all gone (joined full, cancelled) falls back to everything.
  const active = filter && counts.get(filter) ? filter : null;
  const list = useMemo(() => (active ? items.filter((a) => a.find === active) : items), [items, active]);
  const visible = list.slice(0, shown);
  const pick = (k: FindKey | null) => {
    setFilter(k);
    setShown(PAGE);
  };

  return (
    <View onLayout={(e) => setSurface(Math.floor(e.nativeEvent.layout.width) || frame.width)}>
      <SectionHeader overline="Everything to do" title="Find something to do" />
      {chips.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip size="sm" label="All" selected={!active} onPress={() => pick(null)} />
          {chips.map((f) => (
            <Chip key={f.key} size="sm" label={f.label} icon={f.icon} selected={active === f.key} onPress={() => pick(active === f.key ? null : f.key)} />
          ))}
        </ScrollView>
      ) : null}

      {!items.length && loading ? (
        <View style={styles.grid} accessibilityLabel={tx('Loading activities')}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={width} height={Math.round((width - 12) * 0.75) + 160} radius={radius.xl} />
          ))}
        </View>
      ) : !items.length && error ? (
        <View style={styles.state}>
          <Text variant="body" tone="secondary" align="center">
            Can’t load activities right now.
          </Text>
          <Button label="Try again" size="sm" variant="secondary" icon="repeat" onPress={refresh} />
        </View>
      ) : !items.length && !signedIn ? (
        <View style={styles.state}>
          <Text variant="body" tone="secondary" align="center">
            Sign in to see what members are planning near you.
          </Text>
          <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
        </View>
      ) : !items.length ? (
        <View style={styles.state}>
          <Text variant="body" tone="secondary" align="center">
            {tx('Nothing planned in {city} yet. Plan the first one.', { city: CITIES[cityId].name })}
          </Text>
          <Button label="Plan something" size="sm" icon="plus" onPress={() => openCreate(null)} />
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {visible.map((a, i) => (
              <Animated.View key={`${active ?? 'all'}-${a.id}`} entering={reduced ? undefined : enter.rise(Math.min(i % PAGE, 6))}>
                <ActivityCard item={a} width={width} onPress={() => a.open(router)} />
              </Animated.View>
            ))}
          </View>
          {list.length > shown ? (
            <View style={styles.more}>
              <Button label={tx('Show more ({n})', { n: list.length - shown })} size="sm" variant="secondary" icon="chevronDown" onPress={() => setShown((n) => n + PAGE)} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: space.gutter, gap: 8, paddingBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: space.gutter },
  state: { paddingHorizontal: space.gutter, paddingVertical: space[5], alignItems: 'center', gap: space[4] },
  more: { alignItems: 'center', marginTop: space[5] },
});
