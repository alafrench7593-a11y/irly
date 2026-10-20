import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { memo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { ACTIVITIES, EVENT_CATEGORIES } from '@/data/catalog';
import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { EVENT_CATEGORY, SESSION_CATEGORY } from '@/data/catalog/mapping';
import { areaName, CITIES } from '@/data/destinations';
import { goingCount, peopleByIds } from '@/data/repo';
import type { PhotoKey } from '@/data/photos';
import type { ActivitySession, City, IrlEvent, Person, Visual } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { flyFrom } from '@/features/flight/avatarFlight';
import { useHeroCard } from '@/features/hero/useHeroCard';
import { cityDayKey, cityWhen, isHappeningNow, offsetOf, whenLabel } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { activityColor, eventColor } from '@/theme/categories';
import { radius, space, status } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Avatar, AvatarStack } from '../ui/Avatar';
import { LiveDot } from '../ui/Controls';
import { Glass } from '../ui/Glass';
import { Icon, type IconName } from '../ui/Icon';
import { Text } from '../ui/Text';
import { Photo } from '../visual/Photo';
import { GlassLayer } from '@/components/ui/GlassLayer';

/* ───────── One shape for "something happening" ───────── */

export type Happening = {
  type: 'session' | 'event';
  /** Catalog category the plan belongs to. */
  group: CategoryKey;
  id: string;
  title: string;
  label: string;
  icon: IconName;
  color: string;
  item: ActivitySession | IrlEvent;
};

export function fromSession(s: ActivitySession): Happening {
  const a = ACTIVITIES[s.kind];
  return { type: 'session', group: SESSION_CATEGORY[s.kind], id: s.id, title: s.title, label: a.label, icon: a.icon, color: activityColor(s.kind), item: s };
}

export function fromEvent(e: IrlEvent): Happening {
  const c = EVENT_CATEGORIES[e.category];
  return { type: 'event', group: EVENT_CATEGORY[e.category], id: e.id, title: e.title, label: c.label, icon: c.icon, color: eventColor(e.category), item: e };
}

function photoOf(h: Happening) {
  if (h.type === 'event') return (h.item as IrlEvent).visual;
  const s = h.item as ActivitySession;
  return s.visual ?? { photo: ACTIVITIES[s.kind].photo };
}

/* ───────── PADEL TONIGHT: the one big card of the day ───────── */

/**
 * The day's highlight. Tapping it grows the card into the activity page
 * (shared element: same photo, same title, same place, same people).
 */
export const HighlightCard = memo(function HighlightCard({ h, height = 236, compact }: { h: Happening; height?: number; compact?: boolean }) {
  const city = CITIES[h.item.cityId];
  const { ref, onPress, hidden } = useHeroCard(h.type, h.id);
  const joined = useStore((s) => Boolean(s.joined[h.id]));
  const live = isHappeningNow(h.item.when, city);
  const t = useTheme();
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      style={{ height, opacity: hidden ? 0 : 1 }}
      accessibilityLabel={`${h.title}, ${whenLabel(h.item.when, city)}`}
    >
      <Photo visual={photoOf(h)} light={city.light} scrim="strong" style={[StyleSheet.absoluteFill, styles.highlight, { borderColor: t.c.line }]} recyclingKey={h.id} width={900}>
        <View style={styles.highlightTop}>
          <Glass dark style={styles.timePill}>
            {live ? <LiveDot size={6} color={status.live} /> : null}
            <Text variant="overline" tone="onDark">
              {live ? tx('Live · {time}', { time: h.item.when.time }) : whenLabel(h.item.when, city)}
            </Text>
          </Glass>
        </View>
        <View style={styles.highlightBottom}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="overline" color={h.color}>
              {h.label}
            </Text>
            <Text variant={compact ? 'titleM' : 'cardTitle'} tone="onDark" numberOfLines={2}>
              {h.title}
            </Text>
            <Text variant="bodyS" color="rgba(255,255,255,0.72)" numberOfLines={1}>
              {h.item.venue} · {areaName(city, h.item.areaId)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <AvatarStack people={peopleByIds(h.item.goingIds)} size={28} max={2} extra={h.item.extraGoing} />
            <Text variant="caption" tone="onDark">
              {goingCount(h.item, joined)} going
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

/* ───────── Activities near you: a tile of the Home grid ───────── */

/**
 * One plan in the Home's two-column grid: its photo on top inside a glass
 * card (lit edge, soft shadow), then category, title, place and when.
 * Tapping it grows into the activity page like the big card.
 */
export const ActivityTile = memo(function ActivityTile({ h, width }: { h: Happening; width: number }) {
  const t = useTheme();
  const city = CITIES[h.item.cityId];
  const { ref, onPress, hidden } = useHeroCard(h.type, h.id);
  const live = isHappeningNow(h.item.when, city);
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      scaleTo={0.97}
      style={[styles.tile, { width, boxShadow: t.shadow.card, opacity: hidden ? 0 : 1 }]}
      accessibilityLabel={`${h.title}, ${h.label}, ${whenLabel(h.item.when, city)}`}
    >
      <GlassLayer radius={radius.xl} />
      <View style={[styles.tilePhoto, { height: Math.round(width * 0.78) }]}>
        <Photo visual={photoOf(h)} light={city.light} style={StyleSheet.absoluteFill} width={500} recyclingKey={`${h.id}-tile`} />
        {live ? (
          <Glass dark style={styles.tileLive}>
            <LiveDot size={6} color={status.live} />
            <Text variant="overline" tone="onDark">
              Live
            </Text>
          </Glass>
        ) : null}
      </View>
      <View style={styles.tileBody}>
        <View style={styles.inline}>
          <Icon name={h.icon} size={12} color={h.color} />
          <Text variant="overline" color={h.color} numberOfLines={1} style={{ flexShrink: 1 }}>
            {h.label}
          </Text>
        </View>
        <Text variant="titleS" numberOfLines={2}>
          {h.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {h.item.venue} · {areaName(city, h.item.areaId)}
        </Text>
        <View style={styles.inline}>
          <Icon name="clock" size={12} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {whenLabel(h.item.when, city)}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/* ───────── Activities near you: one row per plan ───────── */

export const HappeningRow = memo(function HappeningRow({ h }: { h: Happening }) {
  const t = useTheme();
  const city = CITIES[h.item.cityId];
  const { ref, onPress, hidden } = useHeroCard(h.type, h.id);
  const joined = useStore((s) => Boolean(s.joined[h.id]));
  const live = isHappeningNow(h.item.when, city);
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      scaleTo={0.98}
      style={[styles.row, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent', opacity: hidden ? 0 : 1 }]}
      accessibilityLabel={`${h.title}, ${whenLabel(h.item.when, city)}`}
    >
      <GlassLayer radius={radius.xl} />
      <Photo visual={photoOf(h)} light={city.light} style={styles.thumb} width={200} recyclingKey={`${h.id}-thumb`} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.inline}>
          <Icon name={h.icon} size={13} color={h.color} />
          <Text variant="overline" tone="secondary">
            {h.label}
          </Text>
        </View>
        <Text variant="titleS" numberOfLines={1}>
          {h.title}
        </Text>
        <View style={styles.inline}>
          {live ? <LiveDot size={6} color={status.live} /> : null}
          <Text variant="bodyS" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
            {whenLabel(h.item.when, city)} · {goingCount(h.item, joined)} going
          </Text>
        </View>
      </View>
      {joined ? (
        <View style={[styles.joined, { backgroundColor: t.c.positiveSoft }]}>
          <Icon name="check" size={14} color={t.c.positive} strokeWidth={2.6} />
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
      )}
    </PressableScale>
  );
});

/* ───────── Horizontal carousel with depth ───────── */

type CarouselProps<T> = {
  data: T[];
  itemWidth: number;
  gap?: number;
  keyOf: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  /** Scale reached by the item closest to the centre. */
  focusScale?: number;
};

/**
 * Native-feeling horizontal list: snapping, real inertia, and depth. The
 * item nearest the centre grows a touch and the others recede, driven by
 * the scroll position on the UI thread (no re-render while scrolling).
 */
export function Carousel<T>({ data, itemWidth, gap = 12, keyOf, render, focusScale = 1.06 }: CarouselProps<T>) {
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
    width.set(e.layoutMeasurement.width);
  });
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(e) => width.set(e.nativeEvent.layout.width)}
      decelerationRate="fast"
      snapToInterval={itemWidth + gap}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: space.gutter, gap, paddingVertical: 8 }}
    >
      {data.map((item, i) => (
        <CarouselItem key={keyOf(item)} index={i} x={x} viewport={width} itemWidth={itemWidth} gap={gap} focusScale={focusScale}>
          {render(item, i)}
        </CarouselItem>
      ))}
    </Animated.ScrollView>
  );
}

function CarouselItem({
  index,
  x,
  viewport,
  itemWidth,
  gap,
  focusScale,
  children,
}: {
  index: number;
  x: SharedValue<number>;
  viewport: SharedValue<number>;
  itemWidth: number;
  gap: number;
  focusScale: number;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const center = space.gutter + index * (itemWidth + gap) + itemWidth / 2 - x.value;
    const mid = (viewport.value || 390) / 2;
    const d = Math.abs(center - mid) / (viewport.value || 390);
    return {
      opacity: interpolate(d, [0, 0.6], [1, 0.55], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 0.5], [focusScale, 0.94], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width: itemWidth }, style]}>{children}</Animated.View>;
}

/* ───────── People around you ───────── */

export const PersonBubble = memo(function PersonBubble({ person, city }: { person: Person; city: City }) {
  const t = useTheme();
  const router = useRouter();
  const now = Boolean(person.online);
  const face = useRef<View>(null);
  return (
    <PressableScale
      onPress={() => flyFrom(face.current, person, () => router.push(`/person/${person.id}`))}
      scaleTo={0.94}
      style={styles.person}
      accessibilityLabel={`${person.name}, ${tx(now ? 'available now' : 'available later')}, ${areaName(city, person.areaId)}`}
    >
      <View style={[styles.personRing, { borderColor: t.c.text, boxShadow: `0px 0px 24px ${now ? 'rgba(50,215,75,0.35)' : 'rgba(255,159,10,0.28)'}` }]}>
        <View ref={face} collapsable={false}>
          <Avatar name={person.name} hue={person.hue} size={56} photo={person.photo} />
        </View>
        <View style={[styles.status, { backgroundColor: now ? status.availableNow : status.availableLater, borderColor: t.c.bg }]} />
      </View>
      <Text variant="label" numberOfLines={1}>
        {person.name.split(' ')[0]}
      </Text>
      <Text variant="caption" tone="tertiary" numberOfLines={1}>
        {areaName(city, person.areaId)}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { borderRadius: radius.xl, overflow: 'hidden' },
  tilePhoto: { margin: 6, marginBottom: 0, borderRadius: radius.xl - 6, overflow: 'hidden' },
  tileLive: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 5, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  tileBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  category: { borderRadius: radius.xxl },
  categoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  categoryIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  categoryCount: { height: 26, paddingHorizontal: 10, borderRadius: 13, justifyContent: 'center' },
  categoryBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, gap: 4 },
  categoryBar: { width: 24, height: 4, borderRadius: 2, marginBottom: 6 },
  highlight: { borderRadius: radius.xxl, borderWidth: StyleSheet.hairlineWidth * 2 },
  highlightTop: { flexDirection: 'row', padding: 16 },
  timePill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  highlightBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  thumb: { width: 60, height: 60, borderRadius: 18 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  joined: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  person: { alignItems: 'center', gap: 4 },
  personRing: { borderRadius: 32, borderWidth: 2, padding: 2, marginBottom: 4 },
  status: { position: 'absolute', right: 1, bottom: 1, width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
});

/* ───────── Category card: the door to a whole world ───────── */

/**
 * Large photo card for a category ("Sport · Find people to play with"),
 * with the number of things happening in it. Opens the category page.
 */
export const CategoryCard = memo(function CategoryCard({
  label,
  tagline,
  icon,
  color,
  photo,
  count,
  onPress,
  width = 200,
  height = 248,
}: {
  label: string;
  tagline: string;
  icon: IconName;
  color: string;
  photo: PhotoKey;
  count?: number;
  onPress: () => void;
  width?: number;
  height?: number;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.97} style={{ width, height }} accessibilityLabel={`${label}. ${tagline}`}>
      <Photo visual={{ photo }} light="dubai" scrim="strong" style={[StyleSheet.absoluteFill, styles.category]} width={600} recyclingKey={`cat-${label}`}>
        <View style={styles.categoryTop}>
          <Glass dark style={styles.categoryIcon}>
            <Icon name={icon} size={18} color="#FFFFFF" />
          </Glass>
          {count ? (
            <Glass dark style={styles.categoryCount}>
              <Text variant="caption" tone="onDark">
                {count} near you
              </Text>
            </Glass>
          ) : null}
        </View>
        <View style={styles.categoryBottom}>
          <View style={[styles.categoryBar, { backgroundColor: color }]} />
          <Text variant="titleL" tone="onDark" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="bodyS" color="rgba(255,255,255,0.8)" numberOfLines={2}>
            {tagline}
          </Text>
        </View>
      </Photo>
    </PressableScale>
  );
});

/* ───────── Idea card: something to do, one tap from a session ───────── */

/**
 * A thing you can do in a category ("Dog walk · Kite Beach"), on its photo.
 * Tapping it opens Create already filled in, so an idea becomes a session
 * in one tap.
 */
export const IdeaCard = memo(function IdeaCard({
  title,
  place,
  icon,
  color,
  photo,
  onPress,
}: {
  title: string;
  place?: string;
  icon: IconName;
  color: string;
  photo: PhotoKey;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" onPress={onPress} scaleTo={0.97} style={[ideaStyles.card, { boxShadow: t.shadow.card }]} accessibilityLabel={`${tx(title)}. ${tx('Create an activity')}`}>
      <Photo visual={{ photo }} light="dubai" scrim="strong" style={[StyleSheet.absoluteFill, ideaStyles.photo]} width={500} recyclingKey={`idea-${title}`}>
        <View style={ideaStyles.top}>
          <Glass dark style={ideaStyles.icon}>
            <Icon name={icon} size={16} color="#FFFFFF" />
          </Glass>
        </View>
        <View style={ideaStyles.bottom}>
          <View style={[ideaStyles.bar, { backgroundColor: color }]} />
          <Text variant="titleS" tone="onDark" numberOfLines={2}>
            {title}
          </Text>
          {place ? (
            <Text variant="bodyS" color="rgba(255,255,255,0.8)" numberOfLines={1}>
              {place}
            </Text>
          ) : null}
          <View style={ideaStyles.cta}>
            <Icon name="plus" size={14} color="#0A0A0A" />
            <Text variant="label" color="#0A0A0A">
              Create
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

const ideaStyles = StyleSheet.create({
  card: { width: 210, height: 260, borderRadius: radius.xl },
  photo: { borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between' },
  top: { padding: 12, flexDirection: 'row' },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  bottom: { padding: 14, gap: 4 },
  bar: { width: 24, height: 3, borderRadius: 2, marginBottom: 4 },
  cta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, paddingHorizontal: 12, height: 30, borderRadius: 15, marginTop: 8, backgroundColor: '#FFFFFF' },
});

/* ───────── Activity grids: one card shape for both spaces ───────── */

/** The gap between two cards of an activity grid (rows and columns). */
export const GRID_GAP = 12;

/**
 * Columns and card width of an activity grid for the app surface width
 * (`useFrame().width`): exactly two on phones, three or four on wider
 * screens, always the same geometry in IRLY and IRLY Girl.
 */
export function gridTile(surfaceWidth: number): { columns: number; width: number } {
  const columns = surfaceWidth >= 900 ? 4 : surfaceWidth >= 600 ? 3 : 2;
  const inner = surfaceWidth - space.gutter * 2 - GRID_GAP * (columns - 1);
  return { columns, width: Math.floor(inner / columns) };
}

/** One activity, as a grid card shows it (a server activity, or a demo plan in the demo build). */
export type ActivityCardItem = {
  id: string;
  title: string;
  /** Catalog category (label, icon and colour); an unknown id reads as « Activity ». */
  categoryId: string;
  /** Saved photo first (`uri`), the category's photo otherwise. */
  visual: Visual;
  light: LightId;
  cityId: string;
  startsAt: number;
  /** Place or area, already written for the viewer's city. */
  place: string;
  /** « Free » or the price. */
  price: string;
  /** People going, when known. */
  going: number | null;
  /** Spots in all, only when the host set a limit. */
  capacity: number | null;
  joined?: boolean;
  mine?: boolean;
  /** The host's first name, when the viewer may see it. */
  organiser?: string | null;
};

const DAY_MS = 24 * 3600_000;
const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

/** « Today », « Tonight », « Tomorrow » or « Sat 12 Oct », in the activity's city time. */
export function cardDay(ms: number, cityId: string, now = Date.now()): string {
  const key = cityDayKey(ms, cityId);
  if (key === cityDayKey(now, cityId)) return tx(new Date(ms + offsetOf(cityId) * 3600_000).getUTCHours() >= 17 ? 'Tonight' : 'Today');
  if (key === cityDayKey(now + DAY_MS, cityId)) return tx('Tomorrow');
  return cityWhen(ms, cityId, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** « 19:30 » in the activity's city time. */
export function cardTime(ms: number, cityId: string): string {
  const d = new Date(ms + offsetOf(cityId) * 3600_000);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** « Full » or « 3 spots left », only when the host set a limit. */
function availability(item: ActivityCardItem): { label: string; full: boolean } | null {
  if (item.capacity == null || item.going == null) return null;
  const left = item.capacity - item.going;
  if (left <= 0) return { label: tx('Full'), full: true };
  return { label: tx(left === 1 ? '{n} spot left' : '{n} spots left', { n: left }), full: false };
}

function categoryOf(id: string) {
  return CATEGORY_BY_ID[id as CategoryKey] ?? null;
}

/**
 * « Find something to do »: photo (fixed 4:3, cropped, never stretched),
 * category, title on two lines at most, date and time, place, people going
 * and the price. Every card of a row has the same height (the title keeps
 * its two lines), so the grid stays straight.
 */
export const ActivityCard = memo(function ActivityCard({ item, width, onPress }: { item: ActivityCardItem; width: number; onPress: () => void }) {
  const t = useTheme();
  const category = categoryOf(item.categoryId);
  const color = category?.color ?? t.c.textSecondary;
  const spots = availability(item);
  const photoW = width - 12;
  const day = cardDay(item.startsAt, item.cityId);
  const time = cardTime(item.startsAt, item.cityId);
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.97}
      style={[styles.tile, { width, boxShadow: t.shadow.card }]}
      accessibilityRole="button"
      accessibilityLabel={[item.title, tx(category?.label ?? 'Activity'), `${day} ${time}`, item.place, item.price, spots?.label].filter(Boolean).join(', ')}
    >
      <GlassLayer radius={radius.xl} />
      <View style={[styles.tilePhoto, { width: photoW, height: Math.round(photoW * 0.75) }]}>
        <Photo visual={item.visual} light={item.light} style={StyleSheet.absoluteFill} width={500} recyclingKey={`srv-${item.id}`} />
        {spots ? (
          <Glass dark style={styles.tileLive}>
            <Text variant="overline" tone="onDark" raw>
              {spots.label}
            </Text>
          </Glass>
        ) : null}
        {item.joined ? (
          <View style={[gridStyles.badge, { backgroundColor: t.c.positive }]}>
            <Icon name="check" size={13} color="#FFFFFF" strokeWidth={2.8} />
          </View>
        ) : null}
      </View>
      <View style={styles.tileBody}>
        <View style={styles.inline}>
          <Icon name={category?.icon ?? 'sparkles'} size={12} color={color} />
          <Text variant="overline" color={color} numberOfLines={1} style={{ flexShrink: 1 }}>
            {category?.label ?? 'Activity'}
          </Text>
        </View>
        <Text variant="titleS" raw numberOfLines={2} style={gridStyles.title}>
          {item.title}
        </Text>
        <View style={styles.inline}>
          <Icon name="clock" size={12} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary" raw numberOfLines={1} style={{ flexShrink: 1 }}>
            {day} · {time}
          </Text>
        </View>
        <View style={styles.inline}>
          <Icon name="pin" size={12} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary" raw numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.place}
          </Text>
        </View>
        <View style={gridStyles.footer}>
          <View style={[styles.inline, { flexShrink: 1 }]}>
            {item.going != null ? (
              <>
                <Icon name="users" size={12} color={t.c.textSecondary} />
                <Text variant="caption" tone="secondary" raw numberOfLines={1}>
                  {tx('{n} going', { n: item.going })}
                </Text>
              </>
            ) : null}
          </View>
          <Text variant="label" raw numberOfLines={1} color={spots?.full ? t.c.textTertiary : t.c.text}>
            {item.price}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
});

/**
 * « Planned by members »: the compact card (a shorter photo, smaller type)
 * with who organises it. Same width as the big grid, about a fifth shorter.
 */
export const ActivityTileCompact = memo(function ActivityTileCompact({ item, width, onPress }: { item: ActivityCardItem; width: number; onPress: () => void }) {
  const t = useTheme();
  const spots = availability(item);
  const day = cardDay(item.startsAt, item.cityId);
  const time = cardTime(item.startsAt, item.cityId);
  const meta = [item.price, item.going != null ? tx('{n} going', { n: item.going }) : null, spots?.full ? spots.label : null].filter(Boolean).join(' · ');
  return (
    <PressableScale
      onPress={onPress}
      haptic="select"
      scaleTo={0.97}
      style={[gridStyles.compact, { width, boxShadow: t.shadow.card }]}
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.organiser ? tx('By {name}', { name: item.organiser }) : null, `${day} ${time}`, item.place, meta].filter(Boolean).join(', ')}
    >
      <GlassLayer radius={radius.lg} />
      <View style={{ width, height: Math.round(width * 0.56) }}>
        <Photo visual={item.visual} light={item.light} style={StyleSheet.absoluteFill} width={360} recyclingKey={`srv-${item.id}`} />
        {item.mine || item.joined ? (
          <Glass dark style={gridStyles.compactBadge}>
            <Icon name={item.mine ? 'star' : 'check'} size={10} color="#FFFFFF" strokeWidth={2.6} />
            <Text variant="overline" tone="onDark">
              {item.mine ? 'Your plan' : 'Going'}
            </Text>
          </Glass>
        ) : null}
      </View>
      <View style={gridStyles.compactBody}>
        <Text variant="label" raw numberOfLines={2} style={gridStyles.compactTitle}>
          {item.title}
        </Text>
        <Text variant="caption" tone="tertiary" raw numberOfLines={1}>
          {item.organiser ? tx('By {name}', { name: item.organiser }) : tx('By a member')}
        </Text>
        <Text variant="caption" tone="secondary" raw numberOfLines={1}>
          {day} · {time}
        </Text>
        <Text variant="caption" tone="secondary" raw numberOfLines={1}>
          {item.place}
        </Text>
        <Text variant="caption" raw numberOfLines={1} color={t.c.text}>
          {meta}
        </Text>
      </View>
    </PressableScale>
  );
});

const gridStyles = StyleSheet.create({
  // Two lines kept even when the title needs one: cards of a row stay the same height.
  title: { minHeight: 42 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  badge: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  compact: { borderRadius: radius.lg, overflow: 'hidden' },
  compactBody: { paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, gap: 2 },
  compactTitle: { minHeight: 32, marginBottom: 2 },
  compactBadge: { position: 'absolute', top: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, height: 20, paddingHorizontal: 7, borderRadius: 10 },
});
