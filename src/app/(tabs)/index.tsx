import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyMark } from '@/brand/IrlyMark';
import { GuideCard, MeetCard, NearbyRow, Rail, ServicesGrid } from '@/components/cards/Blocks';
import { EventCard } from '@/components/cards/EventCards';
import { ActivityTile, CommunityCard, EditorialCard, PlaceCard, ServiceCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { HomeHeader } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Cover } from '@/components/visual/Cover';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import type { HomeSectionKey } from '@/data/types';
import { DestinationSheet } from '@/features/destination/DestinationSheet';
import { rankMatches } from '@/features/matching/match';
import { greeting, localClock } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { layout, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const COVER = 360;

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const dest = DESTINATIONS[city.destinationId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const [sheet, setSheet] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const scrollY = useSharedValue(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const coverH = COVER + insets.top;
  const greetingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, coverH * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, coverH], [0, -30], Extrapolation.CLAMP) }],
  }));

  const g = greeting(city, now);
  const tonight = content.events.filter((e) => e.when.dayOffset === 0).length + content.sessions.filter((s) => s.when.dayOffset === 0).length;
  const matches = useMemo(
    () =>
      rankMatches(profile, content.people, 'friends', (id) => city.areas.find((a) => a.id === id)?.name ?? city.name).map(
        (m) => m.person,
      ),
    [profile, content.people, city],
  );
  const cardW = Math.min(300, frame.width * 0.76);

  const sections: Record<HomeSectionKey, () => ReactNode> = {
    forYou: () => (
      <>
        <SectionHeader overline="Curated by IRLY" title="For you" />
        <Rail itemWidth={cardW}>
          {[...content.events.filter((e) => e.featured), ...content.events.filter((e) => !e.featured)].slice(0, 5).map((e) => (
            <EventCard key={e.id} event={e} width={cardW} />
          ))}
        </Rail>
      </>
    ),
    nearby: () => (
      <>
        <SectionHeader overline="Live" live title="Happening nearby" action="Social" onAction={() => router.push('/social')} />
        <View style={{ gap: 10 }}>
          {content.feed.slice(0, 3).map((plan, i) => (
            <NearbyRow key={plan.id} plan={plan} index={i} />
          ))}
        </View>
      </>
    ),
    meet: () => (
      <>
        <SectionHeader overline="Smart matching" title="Meet people" />
        <MeetCard city={city} people={matches} />
      </>
    ),
    activities: () => (
      <>
        <SectionHeader overline={`Popular in ${city.name}`} title="Activities" action="All" onAction={() => router.push('/activities')} />
        <Rail itemWidth={128}>
          {city.activityKinds.slice(0, 8).map((kind) => (
            <ActivityTile
              key={kind}
              kind={kind}
              city={city}
              size={128}
              count={content.sessions.filter((s) => s.kind === kind).length}
              onPress={() => router.push(`/activities/${kind}`)}
            />
          ))}
        </Rail>
      </>
    ),
    events: () => (
      <>
        <SectionHeader overline="This week" title="Events" action="See all" onAction={() => router.push('/events')} />
        <Rail itemWidth={236}>
          {content.events.slice(0, 8).map((e) => (
            <EventCard key={`ev-${e.id}`} event={e} width={236} height={300} />
          ))}
        </Rail>
      </>
    ),
    places: () => (
      <>
        <SectionHeader overline="Members love" title={city.id === 'bali' ? 'Beach clubs & places' : 'Places'} />
        <Rail itemWidth={210}>
          {content.places
            .filter((p) => p.kind !== 'coworking')
            .map((p) => (
              <PlaceCard key={p.id} place={p} width={210} />
            ))}
        </Rail>
      </>
    ),
    coworking: () => (
      <>
        <SectionHeader overline="Work from paradise" title="Coworking" action="Services" onAction={() => router.push('/services?category=coworking')} />
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          {content.services
            .filter((s) => s.category === 'coworking')
            .map((s) => (
              <ServiceCard key={s.id} service={s} />
            ))}
          {content.sessions
            .filter((s) => s.kind === 'networking')
            .slice(0, 1)
            .map((s) => (
              <PressableScale key={s.id} onPress={() => router.push('/business')} style={[styles.cowork, { borderColor: t.c.line }]}>
                <Icon name="handshake" size={18} color={t.accent} />
                <Text variant="label" style={{ flex: 1 }}>
                  {s.title} · tomorrow
                </Text>
                <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
              </PressableScale>
            ))}
        </View>
      </>
    ),
    services: () => (
      <>
        <SectionHeader overline="Curated & verified" title="City services" action="All" onAction={() => router.push('/services')} />
        <ServicesGrid city={city} />
      </>
    ),
    communities: () => (
      <>
        <SectionHeader overline="Belong" title="Communities" action="All" onAction={() => router.push('/communities')} />
        <Rail itemWidth={250}>
          {content.communities.map((c) => (
            <CommunityCard key={c.id} community={c} />
          ))}
        </Rail>
      </>
    ),
    business: () => (
      <>
        <SectionHeader overline="Build here" title="Business" action="Open" onAction={() => router.push('/business')} />
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          {content.guides.map((g) => (
            <GuideCard key={g.id} guide={g} onPress={() => router.push('/business')} />
          ))}
        </View>
      </>
    ),
    discover: () => (
      <>
        <SectionHeader overline="Guides" title={city.discoverTitle} />
        <Rail itemWidth={cardW}>
          {content.editorials.map((ed) => (
            <EditorialCard key={ed.id} editorial={ed} width={cardW} />
          ))}
        </Rail>
      </>
    ),
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView
        key={cityId}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
      >
        {/* Cover: the city, in a real photograph, with today's greeting */}
        <Cover
          visual={{ photo: city.photo }}
          light={city.light}
          height={coverH}
          scrollY={scrollY}
          shadow={t.shadow.card}
          style={styles.cover}
        >
          <Animated.View style={[styles.greeting, greetingStyle]}>
            <Animated.View entering={enter.fade(0)} style={styles.metaRow}>
              <Text variant="overline" color="rgba(255,255,255,0.8)">
                {dest.flag === '🇮🇩' ? '🌴' : dest.flag}  {localClock(city, now)} · {city.temperature}°C · {city.region}
              </Text>
            </Animated.View>
            <Animated.View entering={enter.rise(0, 60)}>
              <Text variant="displayXL" tone="onDark">
                {g.lead}
              </Text>
              <Text variant="displayXL" italic color={t.light.accent}>
                {g.place}
              </Text>
            </Animated.View>
            <Animated.View entering={enter.rise(1, 60)}>
              <Text variant="body" color="rgba(255,255,255,0.8)" style={{ marginTop: 8 }}>
                {tonight > 0 ? `${tonight} plans happening today near you.` : 'Plenty happening this week.'} {profile.name ? `Ready, ${profile.name}?` : ''}
              </Text>
            </Animated.View>
          </Animated.View>
        </Cover>

        {city.homeSections.map((key, i) => (
          <Animated.View key={key} entering={enter.rise(i + 2, 80)} style={styles.section}>
            {sections[key]()}
          </Animated.View>
        ))}

        <PressableScale haptic="select" scaleTo={0.98} onPress={() => setSheet(true)} style={styles.footer}>
          <IrlyMark size={34} state="static" ringColor={t.c.textTertiary} lensColor={t.c.brand} glow={false} />
          <Text variant="bodyS" tone="tertiary" align="center">
            You are in {dest.name} · {city.name}.{'\n'}Tap to switch destination.
          </Text>
        </PressableScale>
      </Animated.ScrollView>

      <HomeHeader scrollY={scrollY} onDestination={() => setSheet(true)} solidAt={coverH - insets.top - layout.headerHeight} />
      <DestinationSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  cover: { justifyContent: 'flex-end', marginBottom: space[8] },
  greeting: { paddingHorizontal: space.gutter, paddingBottom: space[7], gap: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  section: { marginBottom: space[9] },
  cowork: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
  },
  footer: { alignItems: 'center', gap: 12, paddingVertical: space[7] },
});
