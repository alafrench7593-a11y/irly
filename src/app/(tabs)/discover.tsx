import { useLocalSearchParams } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Rail } from '@/components/cards/Blocks';
import { EventRow } from '@/components/cards/EventCards';
import { PersonCard } from '@/components/cards/PeopleCards';
import { CommunityCard, PlaceCard, ServiceCard, SessionCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Field } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { InboxButtons } from '@/components/navigation/Headers';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, SERVICE_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { scoreMatch } from '@/features/matching/match';
import { ServerResults } from '@/features/search/ServerResults';
import { DiscoverTabs } from '@/features/discover/DiscoverTabs';
import { ActivitiesPage, EventsPage, PeoplePage, PlacesPage } from '@/features/discover/DiscoverPages';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TABS = [
  { id: 'people', label: 'People' },
  { id: 'activities', label: 'Activities' },
  { id: 'places', label: 'Places' },
  { id: 'events', label: 'Events' },
] as const;
type TabId = (typeof TABS)[number]['id'];

/** How far the title row folds away as a page scrolls. */
const FOLD = 58;

/**
 * Discover: PEOPLE | ACTIVITIES | PLACES | EVENTS, four pages you swipe
 * between or reach from the tabs. The white pill is glued to the pager;
 * the page you leave shrinks and dims while the next one arrives; the
 * title row folds away as you scroll and comes back as you return to the
 * top (blended between pages while you swipe, so it never jumps). Search
 * replaces the pages with results across the whole city guide.
 */
export default function Discover() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const profile = useStore((s) => s.profile);
  const params = useLocalSearchParams<{ q?: string; tab?: string }>();
  const [q, setQ] = useState(params.q ?? '');
  // The tab stays mounted: a new /search?q=… must replace the old query.
  const [seenParam, setSeenParam] = useState(params.q);
  if (params.q !== seenParam) {
    setSeenParam(params.q);
    setQ(params.q ?? '');
  }

  const W = frame.width;
  const initial = Math.max(0, TABS.findIndex((x) => x.id === (params.tab as TabId)));
  const [active, setActive] = useState(initial);
  const [mounted, setMounted] = useState<Set<number>>(() => new Set([initial]));
  const pager = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(initial * W);
  const s0 = useSharedValue(0);
  const s1 = useSharedValue(0);
  const s2 = useSharedValue(0);
  const s3 = useSharedValue(0);
  const pageScroll = [s0, s1, s2, s3];
  const [headerH, setHeaderH] = useState(insets.top + 190);
  const resultsY = useSharedValue(0);

  // Neighbouring pages mount just after the visible one, so a swipe never lands on a blank page.
  useEffect(() => {
    const id = setTimeout(() => {
      setMounted((m) => {
        const next = new Set(m);
        next.add(active);
        if (active > 0) next.add(active - 1);
        if (active < TABS.length - 1) next.add(active + 1);
        return next.size === m.size ? m : next;
      });
    }, 350);
    return () => clearTimeout(id);
  }, [active]);

  const onPager = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });
  const settle = (offset: number) => {
    const i = Math.round(offset / W);
    if (i !== active) {
      haptic('select');
      setActive(i);
      setMounted((m) => (m.has(i) ? m : new Set([...m, i])));
    }
  };
  const goTo = (i: number) => {
    setMounted((m) => (m.has(i) ? m : new Set([...m, i])));
    setActive(i);
    pager.current?.scrollTo({ x: i * W, animated: true });
  };

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return null;
    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(term));
    return {
      events: content.events.filter((e) => has(e.title, e.venue, e.description, e.category)),
      sessions: content.sessions.filter((s) => has(s.title, s.venue, ACTIVITIES[s.kind].label)),
      places: content.places.filter((p) => has(p.name, p.blurb, ...p.tags)),
      communities: content.communities.filter((c) => has(c.name, c.tagline, c.description)),
      services: content.services.filter((s) => has(s.name, s.tagline, SERVICE_CATEGORIES[s.category].label)),
      people: content.people.filter((p) => has(p.name, p.headline, p.bio)),
    };
  }, [q, content]);
  const total = results ? Object.values(results).reduce((n, list) => n + list.length, 0) : 0;

  // The header folds with the page under it, blended across a swipe.
  const fold = useDerivedValue(() => {
    const clamp = (v: number) => Math.max(0, Math.min(FOLD, v));
    if (results) return clamp(resultsY.value);
    const vals = [s0.value, s1.value, s2.value, s3.value];
    const p = W ? x.value / W : 0;
    const i0 = Math.max(0, Math.min(TABS.length - 1, Math.floor(p)));
    const i1 = Math.min(TABS.length - 1, i0 + 1);
    const f = Math.max(0, Math.min(1, p - i0));
    return clamp(vals[i0]) * (1 - f) + clamp(vals[i1]) * f;
  });
  const headerStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -fold.value }] }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(fold.value, [0, FOLD * 0.7], [1, 0], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(fold.value, [0, FOLD], [1, 0.94], Extrapolation.CLAMP) }],
  }));
  const onResults = useAnimatedScrollHandler((e) => {
    resultsY.set(e.contentOffset.y);
  });

  const pages = [PeoplePage, ActivitiesPage, PlacesPage, EventsPage];

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      {results ? (
        <Animated.ScrollView
          onScroll={onResults}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: headerH + space[5], paddingBottom: bottom }}
        >
          <View style={{ gap: space[7] }}>
            <ServerResults q={q} cityId={cityId} />
            <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
              {total ? tx('{n} results for “{q}” in the city guide', { n: total, q: q.trim() }) : tx('Nothing in the city guide for “{q}”. Try “run”, “dinner” or “visa”.', { q: q.trim() })}
            </Text>
            {results.events.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Events
                </Text>
                {results.events.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </View>
            ) : null}
            {results.sessions.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Activities
                </Text>
                {results.sessions.map((s) => (
                  <SessionCard key={s.id} session={s} />
                ))}
              </View>
            ) : null}
            {results.people.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  People
                </Text>
                <Rail itemWidth={290}>
                  {results.people.map((p) => (
                    <PersonCard key={p.id} width={290} match={scoreMatch(profile, p, 'friends', (id) => city.areas.find((a) => a.id === id)?.name ?? city.name)} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.places.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  Places
                </Text>
                <Rail itemWidth={200}>
                  {results.places.map((p) => (
                    <PlaceCard key={p.id} place={p} width={200} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.communities.length ? (
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
                  Communities
                </Text>
                <Rail itemWidth={250}>
                  {results.communities.map((c) => (
                    <CommunityCard key={c.id} community={c} />
                  ))}
                </Rail>
              </View>
            ) : null}
            {results.services.length ? (
              <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  Services
                </Text>
                {results.services.map((s) => (
                  <ServiceCard key={s.id} service={s} />
                ))}
              </View>
            ) : null}
          </View>
        </Animated.ScrollView>
      ) : (
        <Animated.ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onScroll={onPager}
          scrollEventThrottle={16}
          contentOffset={{ x: initial * W, y: 0 }}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
          onScrollEndDrag={(e) => {
            // Web has no momentum events: settle on the snapped page.
            if (Platform.OS === 'web') settle(e.nativeEvent.contentOffset.x);
          }}
          style={StyleSheet.absoluteFill}
        >
          {pages.map((PageView, i) => (
            <PagerPage key={TABS[i].id} index={i} x={x} width={W}>
              {mounted.has(i) ? <PageView cityId={cityId} scrollY={pageScroll[i]} top={headerH + space[2]} bottom={bottom} /> : null}
            </PagerPage>
          ))}
        </Animated.ScrollView>
      )}

      <Animated.View style={[styles.header, headerStyle]} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <Glass level="thick" border={false} highlight={false} style={StyleSheet.absoluteFill} />
        <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
        <View style={{ paddingTop: insets.top + space[3] }}>
          <Animated.View style={[styles.head, styles.headRow, titleStyle]}>
            <View style={{ flex: 1 }}>
              <Text variant="overline" tone="secondary">
                {city.name}
              </Text>
              <Text variant="displayM">Discover</Text>
            </View>
            <InboxButtons />
          </Animated.View>
          <View style={{ paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[4] }}>
            <Field
              icon="search"
              placeholder={tx('Search {city}: padel, rooftop, visa…', { city: city.name })}
              value={q}
              onChangeText={setQ}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search"
              trailing={
                q ? (
                  <PressableScale onPress={() => setQ('')} haptic="select" accessibilityLabel="Clear search">
                    <Icon name="x" size={18} color={t.c.textTertiary} />
                  </PressableScale>
                ) : null
              }
            />
            {!results ? <DiscoverTabs tabs={TABS} x={x} pageWidth={W} active={active} onPress={goTo} /> : null}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/** A page of the pager: it shrinks and dims as it slides away (depth). */
function PagerPage({ index, x, width, children }: { index: number; x: SharedValue<number>; width: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const style = useAnimatedStyle(() => {
    if (reduced || !width) return { opacity: 1, transform: [{ scale: 1 }] };
    const d = Math.min(1, Math.abs(x.value / width - index));
    return { opacity: 1 - d * 0.45, transform: [{ scale: 1 - d * 0.06 }] };
  });
  return <Animated.View style={[{ width, height: '100%' }, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, overflow: 'hidden' },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  people: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24 },
  peopleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, marginBottom: space[5], gap: 2 },
  doors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter, marginBottom: space[9] },
  door: { height: 150, borderRadius: radius.lg },
  doorInner: { flex: 1, padding: 14, justifyContent: 'space-between' },
  doorIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  section: { marginBottom: space[9] },
  areas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: space.gutter },
  area: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
