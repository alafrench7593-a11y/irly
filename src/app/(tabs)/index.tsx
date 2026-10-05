import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { Rail } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { Carousel, fromEvent, fromSession, HighlightCard, IdeaCard, PersonBubble, type Happening } from '@/components/cards/HomeCards';
import { CommunityCard } from '@/components/cards/ThingCards';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORIES, CATEGORY_BY_ID } from '@/data/catalog/categories';
import { openCreate } from '@/features/create/createStore';
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
type Idea = { key: string; title: string; place?: string; subId: string; activityId?: string };

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

  const moment = useMemo(() => momentFor(city, now, profile.interests), [city, now, profile.interests]);
  // Every category, straight on the Home, in the order that fits this
  // moment of the day for you: what is planned first, then ideas to start.
  const sections = useMemo(() => {
    const order = [...moment.categories, ...CATEGORIES.map((c) => c.id).filter((id) => !moment.categories.includes(id))];
    return order.map((id) => {
      const category = CATEGORY_BY_ID[id];
      const items = happenings.filter((h) => h.group === id).slice(0, 6);
      const ideas = category.subs
        .flatMap<Idea>((sub) =>
          sub.activities?.length
            ? sub.activities.map((act) => ({ key: act.id, title: act.label, place: act.place, subId: sub.id, activityId: act.id }))
            : [{ key: sub.id, title: sub.label, place: undefined, subId: sub.id, activityId: undefined }],
        )
        .slice(0, items.length ? 3 : 6);
      return { category, items, ideas };
    });
  }, [happenings, moment]);

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

        {girl ? (
          <Animated.View entering={enter.rise(2, 80)} style={styles.rows}>
            <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/category/girl')} style={[styles.mine, styles.girl]} accessibilityLabel="IRLY Girl">
              <Icon name="sparkles" size={18} color="#3A2A2A" />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color="#3A2A2A">
                  IRLY Girl
                </Text>
                <Text variant="bodyS" color="#8A7470">
                  Women only: brunch, padel, trips, wellness.
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color="#3A2A2A" />
            </PressableScale>
          </Animated.View>
        ) : null}

        {sections.map((sec, i) => (
          <Animated.View key={sec.category.id} entering={enter.rise(Math.min(2 + i, 6), 80)} style={styles.section}>
            <SectionHeader
              overline={i === 0 ? `For you · ${moment.title}` : sec.category.tagline}
              title={sec.category.label}
              action={sec.items.length ? `${sec.items.length}` : undefined}
            />
            <Rail itemWidth={sec.items.length ? 260 : 210}>
              {sec.items.map((h) => (
                <View key={h.id} style={{ width: 260 }}>
                  <HighlightCard h={h} height={260} compact />
                </View>
              ))}
              {sec.ideas.map((idea) => (
                <IdeaCard
                  key={idea.key}
                  title={idea.title}
                  place={idea.place}
                  color={sec.category.color}
                  icon={sec.category.icon}
                  onPress={() => openCreate(null, { categoryId: sec.category.id, subId: idea.subId, activityId: idea.activityId })}
                />
              ))}
            </Rail>
          </Animated.View>
        ))}

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
  girl: { backgroundColor: '#FBF6F1', marginTop: space[8] },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[8] },
});
