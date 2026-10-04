import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { Carousel, fromEvent, fromSession, HappeningRow, HighlightCard, PersonBubble, type Happening } from '@/components/cards/HomeCards';
import { CommunityCard } from '@/components/cards/ThingCards';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { localClock } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId } from '@/state/store';
import { category, layout, space, type CategoryId } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Category filters of the Home, in the order of the brief. */
const FILTERS: { id: 'all' | CategoryId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'sport', label: 'Sport' },
  { id: 'padel', label: 'Padel' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'beach', label: 'Beach' },
  { id: 'food', label: 'Food' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'nightlife', label: 'Nightlife' },
];

/**
 * Home answers one question: what is happening today, with whom, near me.
 * On launch the page reveals itself top to bottom (header, question,
 * categories, the day's highlight, people, activities) on one spring, so
 * it reads like a sentence instead of popping in at once.
 */
export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const content = getCityContent(cityId);
  const [sheet, setSheet] = useState(false);
  const [filter, setFilter] = useState<'all' | CategoryId>('all');
  const [now, setNow] = useState(() => Date.now());
  const scrollY = useSharedValue(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  // Everything happening in the next days, soonest first.
  const happenings = useMemo<Happening[]>(() => {
    const list = [...content.sessions.map(fromSession), ...content.events.map(fromEvent)];
    return list.sort(
      (a, b) => a.item.when.dayOffset - b.item.when.dayOffset || a.item.when.time.localeCompare(b.item.when.time),
    );
  }, [content]);

  const filtered = filter === 'all' ? happenings : happenings.filter((h) => h.color === category[filter]);
  const highlight = filtered.find((h) => h.item.when.dayOffset === 0) ?? filtered[0];
  const rest = filtered.filter((h) => h !== highlight).slice(0, 6);
  const people = useMemo(
    () => [...content.people].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).slice(0, 12),
    [content.people],
  );
  const area = city.areas[0]?.name ?? city.name;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView
        key={cityId}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + space[4], paddingBottom: bottom }}
      >
        <Animated.View entering={enter.rise(0, 80)} style={styles.intro}>
          <View style={styles.meta}>
            <Icon name="pin" size={14} color={t.c.textSecondary} />
            <Text variant="label" tone="secondary">
              {area} · {localClock(city, now)} · {city.temperature}°C
            </Text>
          </View>
          <Text variant="displayL" accessibilityRole="header">
            What&apos;s happening today?
          </Text>
        </Animated.View>

        <Animated.View entering={enter.rise(1, 80)} style={styles.filters}>
          <Rail gap={8}>
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                size="sm"
                label={f.label}
                dot={f.id === 'all' ? undefined : category[f.id]}
                selected={filter === f.id}
                onPress={() => setFilter(f.id)}
              />
            ))}
          </Rail>
        </Animated.View>

        {highlight ? (
          <Animated.View key={`hl-${filter}`} entering={enter.rise(2, 80)} style={styles.block}>
            <HighlightCard h={highlight} />
          </Animated.View>
        ) : (
          <Animated.View entering={enter.fade(2)} style={[styles.empty, { borderColor: t.c.line }]}>
            <Text variant="titleS">Nothing in this category yet</Text>
            <Text variant="bodyS" tone="secondary" align="center">
              Start one: tap Create, people nearby will see it.
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={enter.rise(3, 80)} style={styles.section}>
          <SectionHeader title="People around you" action="See all" onAction={() => router.push('/match?intent=friends')} />
          <Carousel
            data={people}
            itemWidth={76}
            gap={10}
            keyOf={(p) => p.id}
            render={(p) => <PersonBubble person={p} city={city} />}
          />
        </Animated.View>

        <Animated.View entering={enter.rise(4, 80)} style={styles.section}>
          <SectionHeader title="Activities near you" action="Plans" onAction={() => router.push('/social')} />
          <View style={styles.rows}>
            {rest.map((h, i) => (
              <Animated.View key={`${filter}-${h.id}`} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
                <HappeningRow h={h} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={enter.rise(5, 80)} style={styles.section}>
          <SectionHeader title="Events this week" action="See all" onAction={() => router.push('/events')} />
          <Rail itemWidth={236}>
            {content.events.slice(0, 8).map((e) => (
              <EventCard key={`ev-${e.id}`} event={e} width={236} height={300} />
            ))}
          </Rail>
        </Animated.View>

        <Animated.View entering={enter.rise(6, 80)} style={styles.section}>
          <SectionHeader title="Groups" action="All" onAction={() => router.push('/communities')} />
          <Rail itemWidth={250}>
            {content.communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </Rail>
        </Animated.View>

        <PressableScale haptic="select" scaleTo={0.98} onPress={() => setSheet(true)} style={styles.footer}>
          <IrlyMark size={30} state="static" ringColor={t.c.textTertiary} lensColor={t.c.text} glow={false} />
          <Text variant="bodyS" tone="tertiary" align="center">
            You are in {dest.name} · {city.name}.{'\n'}Tap to switch destination.
          </Text>
        </PressableScale>
      </Animated.ScrollView>

      <HomeHeader scrollY={scrollY} onDestination={() => setSheet(true)} solidAt={24} />
      <DestinationSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { paddingHorizontal: space.gutter, gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  filters: { marginTop: space[6] },
  block: { paddingHorizontal: space.gutter, marginTop: space[6] },
  empty: {
    height: 160,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: space.gutter,
    marginTop: space[6],
    paddingHorizontal: space[6],
  },
  section: { marginTop: space[8] },
  rows: { paddingHorizontal: space.gutter, gap: 10 },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
