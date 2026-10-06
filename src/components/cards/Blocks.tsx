import { useRouter } from 'expo-router';
import { Children, isValidElement, memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { BUSINESS_TOPICS, INTENTS, SERVICE_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { findEvent, findSession, peopleByIds } from '@/data/repo';
import type { BusinessGuide, City, FeedPlan, Intent, Person, ServiceCategoryId } from '@/data/types';
import { openHero } from '@/features/hero/heroStore';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Avatar, AvatarStack } from '../ui/Avatar';
import { LiveDot } from '../ui/Controls';
import { Icon } from '../ui/Icon';
import { Text } from '../ui/Text';
import { planHeadline } from './PeopleCards';

/* ───────── Horizontal rail with snapping and depth ───────── */

/**
 * Horizontal rail. With an `itemWidth`, the cards have depth: the card
 * peeking in from the right edge is smaller and dimmer and grows into
 * place as it slides in; the one leaving on the left recedes. Driven by
 * the scroll position on the UI thread.
 */
export function Rail({ children, itemWidth, gap = 12 }: { children: ReactNode; itemWidth?: number; gap?: number }) {
  const x = useSharedValue(0);
  const viewport = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: space.gutter, gap }}
      decelerationRate="fast"
      snapToInterval={itemWidth ? itemWidth + gap : undefined}
      snapToAlignment="start"
      onScroll={onScroll}
      scrollEventThrottle={16}
      onLayout={(e) => viewport.set(e.nativeEvent.layout.width)}
    >
      {itemWidth
        ? Children.toArray(children).map((child, i) => (
            <RailItem key={isValidElement(child) && child.key != null ? child.key : i} index={i} x={x} viewport={viewport} width={itemWidth} gap={gap}>
              {child}
            </RailItem>
          ))
        : children}
    </Animated.ScrollView>
  );
}

function RailItem({
  index,
  x,
  viewport,
  width,
  gap,
  children,
}: {
  index: number;
  x: SharedValue<number>;
  viewport: SharedValue<number>;
  width: number;
  gap: number;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const vw = viewport.value;
    if (reduced || !vw) return { opacity: 1, transform: [{ scale: 1 }, { translateY: 0 }] };
    const left = space.gutter + index * (width + gap) - x.value;
    const arriving = interpolate(left, [vw - width * 0.6, vw - 6], [1, 0], Extrapolation.CLAMP);
    const leaving = interpolate(left + width, [6, width * 0.6], [0, 1], Extrapolation.CLAMP);
    const p = Math.min(arriving, leaving);
    return { opacity: 0.35 + 0.65 * p, transform: [{ scale: 0.88 + 0.12 * p }, { translateY: (1 - p) * 14 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

/* ───────── Happening nearby: one real-life plan per row ───────── */

export const NearbyRow = memo(function NearbyRow({ plan, index }: { plan: FeedPlan; index: number }) {
  const t = useTheme();
  const info = planHeadline(plan);
  const ref = plan.ref.type === 'session' ? findSession(plan.ref.id) : findEvent(plan.ref.id);
  if (!info || !ref) return null;
  const today = ref.when.dayOffset === 0;
  return (
    <Animated.View entering={enter.rise(index)}>
      <PressableScale
        onPress={() => openHero({ kind: plan.ref.type, id: plan.ref.id })}
        style={[styles.nearby, { borderColor: t.c.line, backgroundColor: t.c.surface }]}
      >
        <AvatarStack people={peopleByIds(ref.goingIds)} size={30} max={3} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" numberOfLines={2}>
            {info.headline}
          </Text>
          <View style={styles.row}>
            {today ? <LiveDot size={6} /> : null}
            <Text variant="caption" tone={today ? 'live' : 'tertiary'} numberOfLines={1} style={{ flex: 1 }}>
              {info.when}
            </Text>
          </View>
        </View>
        <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
      </PressableScale>
    </Animated.View>
  );
});

/* ───────── Meet people: the matching entry point ───────── */

const INTENT_ORDER: Intent[] = ['similar', 'friends', 'sports', 'business', 'activities', 'explore'];

export const MeetCard = memo(function MeetCard({ city, people }: { city: City; people: Person[] }) {
  const t = useTheme();
  const router = useRouter();
  const setIntent = useStore((s) => s.setIntent);
  const shown = people.slice(0, 5);
  return (
    <View style={[styles.meet, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={styles.meetCluster}>
        {shown.map((p, i) => (
          <View
            key={p.id}
            style={{
              position: 'absolute',
              left: [0, 46, 92, 22, 70][i],
              top: [6, 0, 10, 46, 50][i],
              transform: [{ scale: [1, 0.86, 0.94, 0.8, 1.04][i] }],
            }}
          >
            <Avatar name={p.name} hue={p.hue} size={48} ring online={p.online} />
          </View>
        ))}
      </View>
      <Text variant="displayM">Who would you like to meet?</Text>
      <Text variant="bodyS" tone="secondary" style={{ marginTop: 4 }}>
        {city.stats.communities * 9} members in {city.name} are open to meeting this week.
      </Text>
      <View style={styles.intents}>
        {INTENT_ORDER.map((intent) => (
          <PressableScale
            key={intent}
            haptic="select"
            scaleTo={0.94}
            onPress={() => {
              setIntent(intent);
              router.push(`/match?intent=${intent}`);
            }}
            style={[styles.intent, { backgroundColor: t.c.raised, borderColor: t.c.line }]}
          >
            <Icon name={INTENTS[intent].icon} size={16} color={t.c.brand} />
            <Text variant="label">{INTENTS[intent].label}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
});

/* ───────── City services grid ───────── */

export const ServicesGrid = memo(function ServicesGrid({ city, columns = 3 }: { city: City; columns?: number }) {
  const t = useTheme();
  const router = useRouter();
  const cats = city.serviceCategories.slice(0, columns * 2);
  return (
    <View style={[styles.grid, { paddingHorizontal: space.gutter - 5 }]}>
      {cats.map((id: ServiceCategoryId, i) => (
        <Animated.View key={id} entering={enter.pop(i)} style={{ width: `${100 / columns}%`, padding: 5 }}>
          <PressableScale
            onPress={() => router.push(`/services?category=${id}`)}
            style={[styles.serviceTile, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
            accessibilityLabel={SERVICE_CATEGORIES[id].label}
          >
            <View style={[styles.serviceIcon, { backgroundColor: t.c.brandSoft }]}>
              <Icon name={SERVICE_CATEGORIES[id].icon} size={20} color={t.c.brand} />
            </View>
            <Text variant="label" align="center" numberOfLines={1}>
              {SERVICE_CATEGORIES[id].label}
            </Text>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
});

/* ───────── Business guide card ───────── */

export const GuideCard = memo(function GuideCard({ guide, onPress }: { guide: BusinessGuide; onPress: () => void }) {
  const t = useTheme();
  const topic = BUSINESS_TOPICS[guide.topic];
  return (
    <PressableScale onPress={onPress} style={[styles.guide, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={styles.row}>
        <View style={[styles.serviceIcon, { backgroundColor: t.light.accentSoft }]}>
          <Icon name={topic.icon} size={20} color={t.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="overline" tone="tertiary" style={{ fontSize: 10 }}>
            {topic.label}
          </Text>
          <Text variant="titleS" numberOfLines={1}>
            {guide.title}
          </Text>
        </View>
        <Icon name="arrowUpRight" size={18} color={t.c.textTertiary} />
      </View>
      <View style={[styles.facts, { borderTopColor: t.c.line }]}>
        {guide.facts.map((f) => (
          <View key={f.label} style={{ flex: 1 }}>
            <Text variant="titleM">{f.value}</Text>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>
    </PressableScale>
  );
});

export function openPlan(plan: FeedPlan) {
  openHero({ kind: plan.ref.type, id: plan.ref.id });
}

export function cityOf(id: City['id']) {
  return CITIES[id];
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nearby: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    marginHorizontal: space.gutter,
  },
  meet: {
    marginHorizontal: space.gutter,
    padding: 20,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  meetCluster: { height: 104, width: 150, marginBottom: 12 },
  intents: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  intent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  serviceTile: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  serviceIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  guide: { padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, gap: 14 },
  facts: { flexDirection: 'row', gap: 10, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth * 2 },
});
