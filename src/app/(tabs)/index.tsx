import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { LiveStrip } from '@/features/live/LiveStrip';
import { Carousel, fromEvent, fromSession, HappeningRow, HighlightCard, PersonBubble, type Happening, type HomeGroup } from '@/components/cards/HomeCards';
import { openCreate } from '@/features/create/createStore';
import { CommunityCard } from '@/components/cards/ThingCards';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Chip, SectionHeader } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
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
  { id: 'networking', label: 'Networking' },
  { id: 'food', label: 'Food' },
  { id: 'coffee', label: 'Coffee' },
  { id: 'padel', label: 'Padel' },
  { id: 'beach', label: 'Beach' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'travel', label: 'Travel' },
  { id: 'wellness', label: 'Wellness' },
  { id: 'dogwalk', label: 'Dog walk' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'events', label: 'Events' },
];

/** The Home groups everything happening into the sections people think in. */
const GROUPS: { id: HomeGroup; title: string; overline: string; icon: IconName; empty: string }[] = [
  { id: 'sport', title: 'Sport', overline: 'Play together', icon: 'trophy', empty: 'No sport session yet' },
  { id: 'networking', title: 'Networking', overline: 'Meet people who build', icon: 'handshake', empty: 'No networking session yet' },
  { id: 'goingout', title: 'Going out', overline: 'Food, drinks, nights, culture', icon: 'martini', empty: 'Nothing planned for tonight yet' },
  { id: 'activities', title: 'Activities', overline: 'Beach, wellness, outdoors', icon: 'palm', empty: 'No activity yet' },
  { id: 'trips', title: 'Trips', overline: 'Day trips and getaways together', icon: 'plane', empty: 'No trip planned yet' },
  { id: 'pets', title: 'Pets', overline: 'Dog walks and pet friends', icon: 'heart', empty: 'No dog walk yet' },
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

  const filtered =
    filter === 'all'
      ? happenings
      : filter === 'events'
        ? happenings.filter((h) => h.type === 'event')
        : happenings.filter((h) => h.color === category[filter]);
  const highlight = filtered.find((h) => h.item.when.dayOffset === 0) ?? filtered[0];
  const rest = filtered.filter((h) => h !== highlight).slice(0, 6);
  const people = useMemo(
    () => [...content.people].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).slice(0, 12),
    [content.people],
  );

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
          <PressableScale haptic="select" scaleTo={0.97} onPress={() => setSheet(true)} style={styles.meta} accessibilityLabel={`${city.name}. Change destination`}>
            <Icon name="pin" size={14} color={t.c.textSecondary} />
            <Text variant="label" tone="secondary">
              {city.name} · {localClock(city, now)} · {city.temperature}°C
            </Text>
            <Icon name="chevronDown" size={14} color={t.c.textSecondary} />
          </PressableScale>
          <Text variant="displayL" accessibilityRole="header">
            What&apos;s happening today?
          </Text>
        </Animated.View>

        <Animated.View entering={enter.rise(1, 80)} style={styles.liveStrip}>
          <LiveStrip />
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

        {filter === 'all' ? (
          GROUPS.map((g, i) => {
            const items = happenings.filter((h) => h.group === g.id && h !== highlight).slice(0, 8);
            return (
              <Animated.View key={g.id} entering={enter.rise(Math.min(4 + i, 6), 80)} style={styles.section}>
                <SectionHeader overline={g.overline} title={g.title} action={items.length ? `${items.length}` : undefined} />
                {items.length ? (
                  <Rail itemWidth={260}>
                    {items.map((h) => (
                      <View key={h.id} style={{ width: 260 }}>
                        <HighlightCard h={h} height={260} compact />
                      </View>
                    ))}
                  </Rail>
                ) : (
                  <PressableScale
                    haptic="select"
                    scaleTo={0.98}
                    onPress={() => openCreate()}
                    style={[styles.emptyGroup, { borderColor: t.c.lineStrong, backgroundColor: t.c.surface }]}
                    accessibilityLabel={`${g.title}: nothing yet. Create one`}
                  >
                    <View style={[styles.emptyIcon, { backgroundColor: t.c.overlay }]}>
                      <Icon name={g.icon} size={20} color={t.c.text} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="titleS">{g.empty}</Text>
                      <Text variant="bodyS" tone="secondary">
                        Be the first: create one, people nearby will see it.
                      </Text>
                    </View>
                    <Icon name="plus" size={18} color={t.c.text} />
                  </PressableScale>
                )}
              </Animated.View>
            );
          })
        ) : (
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
        )}

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
  liveStrip: { marginTop: space[6] },
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
  emptyGroup: { marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 28, borderWidth: 1, borderStyle: 'dashed' },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
