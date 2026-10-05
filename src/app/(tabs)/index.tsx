import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { Carousel, CategoryCard, fromEvent, fromSession, HappeningRow, HighlightCard, PersonBubble, type Happening } from '@/components/cards/HomeCards';
import { CommunityCard } from '@/components/cards/ThingCards';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORIES } from '@/data/catalog/categories';
import { planDisplay } from '@/data/catalog/mapping';
import { areaName, CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { momentFor } from '@/features/home/moment';
import { LiveStrip } from '@/features/live/LiveStrip';
import { localClock } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Home answers one question: "I just arrived. What can I do, and who can I
 * do it with?" It opens on what is live right now, then every category as
 * a door (sport, networking, food, trips...), then what fits this moment of
 * the day for you, sessions near you, people, groups and events. The page
 * reveals itself top to bottom on one spring.
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
  const profile = useStore((s) => s.profile);
  const myPlans = useStore((s) => s.myPlans).filter((p) => p.cityId === cityId);
  const [sheet, setSheet] = useState(false);
  const now = useNow();
  const scrollY = useSharedValue(0);

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

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    happenings.forEach((h) => m.set(h.group, (m.get(h.group) ?? 0) + 1));
    return m;
  }, [happenings]);

  const moment = useMemo(() => momentFor(city, now, profile.interests), [city, now, profile.interests]);
  const recommended = useMemo(() => {
    const rank = (h: Happening) => {
      const i = moment.categories.indexOf(h.group);
      return (i < 0 ? 10 : i) + h.item.when.dayOffset * 0.5;
    };
    return [...happenings].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  }, [happenings, moment]);

  const nearby = happenings.filter((h) => !recommended.includes(h)).slice(0, 5);
  const people = useMemo(
    () => [...content.people].sort((a, b) => Number(Boolean(b.online)) - Number(Boolean(a.online))).slice(0, 12),
    [content.people],
  );
  const girl = profile.gender === 'woman';

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

        <Animated.View entering={enter.rise(1, 80)} style={styles.firstSection}>
          <LiveStrip />
        </Animated.View>

        <Animated.View entering={enter.rise(2, 80)} style={styles.section}>
          <SectionHeader overline="Everything you can do" title="Explore" action="Discover" onAction={() => router.push('/discover')} />
          <Rail itemWidth={200}>
            {CATEGORIES.map((c) => (
              <CategoryCard
                key={c.id}
                label={c.label}
                tagline={c.tagline}
                icon={c.icon}
                color={c.color}
                photo={c.photo}
                count={counts.get(c.id)}
                onPress={() => router.push(`/category/${c.id}`)}
              />
            ))}
            {girl ? (
              <CategoryCard label="IRLY Girl" tagline="Find your girls" icon="heart" color="#E8A0A8" photo="brunch" onPress={() => router.push('/category/girl')} />
            ) : null}
            <CategoryCard label="Communities" tagline="Belong somewhere" icon="users" color="#5E5E5E" photo="dinnerGroup" onPress={() => router.push('/communities')} />
            <CategoryCard label="Events" tagline="This week in the city" icon="ticket" color="#FF3B30" photo="djSunset" onPress={() => router.push('/events')} />
          </Rail>
        </Animated.View>

        <Animated.View entering={enter.rise(3, 80)} style={styles.section}>
          <SectionHeader overline={moment.title} title="Recommended for you" />
          <Rail itemWidth={280}>
            {recommended.map((h) => (
              <View key={h.id} style={{ width: 280 }}>
                <HighlightCard h={h} height={300} />
              </View>
            ))}
          </Rail>
        </Animated.View>

        {myPlans.length ? (
          <Animated.View entering={enter.rise(4, 80)} style={styles.section}>
            <SectionHeader title="Your sessions" action="All" onAction={() => router.push('/social')} />
            <View style={styles.rows}>
              {myPlans.slice(0, 3).map((p) => {
                const d = planDisplay(p);
                return (
                  <View key={p.id} style={[styles.mine, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
                    <View style={[styles.mineIcon, { backgroundColor: `${d.color}1F` }]}>
                      <Icon name={d.icon} size={18} color={d.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="titleS" numberOfLines={1}>
                        {d.title}
                      </Text>
                      <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                        {p.day} · {p.time} · {p.place ?? areaName(city, p.areaId)} · {p.spots} spots
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter.rise(4, 80)} style={styles.section}>
          <SectionHeader title="Sessions near you" action="Map" onAction={() => router.push('/map')} />
          <View style={styles.rows}>
            {nearby.map((h, i) => (
              <Animated.View key={h.id} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
                <HappeningRow h={h} />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={enter.rise(5, 80)} style={styles.section}>
          <SectionHeader title="People you may connect with" action="See all" onAction={() => router.push('/match?intent=friends')} />
          <Carousel data={people} itemWidth={76} gap={10} keyOf={(p) => p.id} render={(p) => <PersonBubble person={p} city={city} />} />
        </Animated.View>

        <Animated.View entering={enter.rise(6, 80)} style={styles.section}>
          <SectionHeader title="Communities near you" action="All" onAction={() => router.push('/communities')} />
          <Rail itemWidth={250}>
            {content.communities.map((c) => (
              <CommunityCard key={c.id} community={c} />
            ))}
          </Rail>
        </Animated.View>

        <Animated.View entering={enter.rise(6, 80)} style={styles.section}>
          <SectionHeader title="Events this week" action="See all" onAction={() => router.push('/events')} />
          <Rail itemWidth={236}>
            {content.events.slice(0, 8).map((e) => (
              <EventCard key={`ev-${e.id}`} event={e} width={236} height={300} />
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

      <HomeHeader scrollY={scrollY} solidAt={24} />
      <DestinationSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { paddingHorizontal: space.gutter, gap: 10 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  firstSection: { marginTop: space[6] },
  section: { marginTop: space[8] },
  rows: { paddingHorizontal: space.gutter, gap: 10 },
  mine: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl },
  mineIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
