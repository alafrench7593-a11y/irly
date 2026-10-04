import { useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
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
import { areaName, CITIES } from '@/data/destinations';
import { goingCount, peopleByIds } from '@/data/repo';
import type { ActivitySession, City, IrlEvent, Person } from '@/data/types';
import { useHeroCard } from '@/features/hero/useHeroCard';
import { isHappeningNow, whenLabel } from '@/lib/time';
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

/* ───────── One shape for "something happening" ───────── */

export type Happening = {
  type: 'session' | 'event';
  id: string;
  title: string;
  label: string;
  icon: IconName;
  color: string;
  item: ActivitySession | IrlEvent;
};

export function fromSession(s: ActivitySession): Happening {
  const a = ACTIVITIES[s.kind];
  return { type: 'session', id: s.id, title: s.title, label: a.label, icon: a.icon, color: activityColor(s.kind), item: s };
}

export function fromEvent(e: IrlEvent): Happening {
  const c = EVENT_CATEGORIES[e.category];
  return { type: 'event', id: e.id, title: e.title, label: c.label, icon: c.icon, color: eventColor(e.category), item: e };
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
export const HighlightCard = memo(function HighlightCard({ h, height = 236 }: { h: Happening; height?: number }) {
  const city = CITIES[h.item.cityId];
  const { ref, onPress, hidden } = useHeroCard(h.type, h.id);
  const joined = useStore((s) => Boolean(s.joined[h.id]));
  const live = isHappeningNow(h.item.when, city);
  return (
    <PressableScale
      ref={ref}
      onPress={onPress}
      style={{ height, opacity: hidden ? 0 : 1 }}
      accessibilityLabel={`${h.title}, ${whenLabel(h.item.when, city)}`}
    >
      <Photo visual={photoOf(h)} light={city.light} scrim="strong" style={[StyleSheet.absoluteFill, styles.highlight]} recyclingKey={h.id} width={900}>
        <View style={styles.highlightTop}>
          <Glass dark style={styles.timePill}>
            {live ? <LiveDot size={6} color={status.live} /> : null}
            <Text variant="overline" tone="onDark">
              {live ? `Live · ${h.item.when.time}` : whenLabel(h.item.when, city)}
            </Text>
          </Glass>
        </View>
        <View style={styles.highlightBottom}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="overline" color={h.color}>
              {h.label}
            </Text>
            <Text variant="cardTitle" tone="onDark" numberOfLines={2}>
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
      style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.line, opacity: hidden ? 0 : 1 }]}
      accessibilityLabel={`${h.title}, ${whenLabel(h.item.when, city)}`}
    >
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
  return (
    <PressableScale
      onPress={() => router.push(`/person/${person.id}`)}
      scaleTo={0.94}
      style={styles.person}
      accessibilityLabel={`${person.name}, ${now ? 'available now' : 'available later'}, ${areaName(city, person.areaId)}`}
    >
      <View style={[styles.personRing, { borderColor: t.c.text, boxShadow: `0px 0px 24px ${now ? 'rgba(50,215,75,0.35)' : 'rgba(255,159,10,0.28)'}` }]}>
        <Avatar name={person.name} hue={person.hue} size={56} />
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
  highlight: { borderRadius: radius.xxl, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.08)' },
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
