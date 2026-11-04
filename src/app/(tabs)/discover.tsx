import { useLocalSearchParams, useNavigation } from 'expo-router';
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
import { FrameContext, useFrame } from '@/components/layout/AppFrame';
import { COLUMN_MAX, useLayout } from '@/components/layout/responsive';
import { contentWidth, WIDE_MIN } from '@/components/layout/wide';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Field } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { InboxButtons, MapButton } from '@/components/navigation/Headers';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ACTIVITIES, SERVICE_CATEGORIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import { getCityContent } from '@/data/repo';
import { FILTER_COLUMN, SEARCH_WIDE, SearchFilters, SearchResults, type ResultKind } from '@/features/search/SearchResults';
import { DiscoverTabs } from '@/features/discover/DiscoverTabs';
import { ActivitiesPage, EventsPage, PeoplePage, PlacesPage } from '@/features/discover/DiscoverPages';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Ambient } from '@/components/visual/Ambient';
import { useAppSpace } from '@/state/appSpace';
import { useGirlPeople } from '@/features/girl/GirlSections';
import { firstParam } from '@/lib/params';

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
  const full = useFrame();
  const { sizeClass } = useLayout();
  const bottom = useTabBarSpace();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const linkParams = useLocalSearchParams<{ q?: string | string[]; tab?: string | string[] }>();
  const params = { q: firstParam(linkParams.q), tab: firstParam(linkParams.tab) };
  const navigation = useNavigation();
  const [q, setQ] = useState(params.q ?? '');
  // The tab stays mounted: a new /search?q=… must replace the old query.
  const [seenParam, setSeenParam] = useState(params.q);
  if (params.q !== seenParam) {
    setSeenParam(params.q);
    setQ(params.q ?? '');
  }

  const inGirl = useAppSpace() === 'girl';
  const girlPeople = useGirlPeople(cityId);
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return null;
    const has = (...fields: string[]) => fields.some((f) => f.toLowerCase().includes(term));
    // IRLY Girl space: the guide's people, sessions and communities are open to
    // everyone (they do not say who is a woman). People found are the women of
    // IRLY Girl; women-only plans and communities come from the server search.
    return {
      events: content.events.filter((e) => has(e.title, e.venue, e.description, e.category)),
      sessions: inGirl ? [] : content.sessions.filter((s) => has(s.title, s.venue, ACTIVITIES[s.kind].label)),
      places: content.places.filter((p) => has(p.name, p.blurb, ...p.tags)),
      communities: inGirl ? [] : content.communities.filter((c) => has(c.name, c.tagline, c.description)),
      services: content.services.filter((s) => has(s.name, s.tagline, SERVICE_CATEGORIES[s.category].label)),
      people: (inGirl ? girlPeople : content.people).filter((p) => has(p.name, p.headline, p.bio)),
    };
  }, [q, content, inGirl, girlPeople]);
  const total = results ? Object.values(results).reduce((n, list) => n + list.length, 0) : 0;
  const [kind, setKind] = useState<ResultKind>('all');

  // Wide (the tab has the whole width): from WIDE_MIN the four pages take it all and lay
  // their content out in grids, capped and centred (components/layout/wide); search and
  // tabs share one row. Just under it, a readable column. A search spreads out, filters
  // in a side column and results in grids.
  // Same tree in every size: the query, the page and the pager stay put on a resize.
  const wideSearch = Boolean(results) && full.width >= SEARCH_WIDE;
  const widePages = !results && full.width >= WIDE_MIN;
  const W = sizeClass === 'expanded' && !wideSearch && !widePages ? Math.min(full.width, COLUMN_MAX) : full.width;
  const frame = useMemo(() => ({ ...full, width: W }), [full, W]);
  const resultsW = wideSearch ? W - FILTER_COLUMN : W;
  const narrowHead = W < 360;
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

  // IRLY Girl: the same four pages, section for section; People and Activities show women, girls' plans and IRLY Girl communities.
  const pages = [PeoplePage, ActivitiesPage, PlacesPage, EventsPage];

  // The tab stays mounted: a new /discover?tab=… (the IRLY Mom Community door) turns to that page. The param is then
  // cleared, so the same link opened again (after a swipe to another page) turns to it again.
  const [seenTab, setSeenTab] = useState(params.tab);
  if (params.tab !== seenTab) {
    setSeenTab(params.tab);
    const i = TABS.findIndex((tab) => tab.id === params.tab);
    if (i >= 0) {
      setMounted((m) => (m.has(i) ? m : new Set([...m, i])));
      setActive(i);
    }
  }
  useEffect(() => {
    const i = TABS.findIndex((tab) => tab.id === seenTab);
    if (i >= 0) pager.current?.scrollTo({ x: i * W, animated: false });
    if (seenTab !== undefined) navigation.setParams({ tab: undefined } as never);
    // Only a new link turns the page, never a resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenTab]);

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <View style={[styles.column, { width: W }]}>
        <FrameContext.Provider value={frame}>
          {results ? (
            <Animated.ScrollView
              onScroll={onResults}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: headerH + space[5], paddingBottom: bottom, paddingLeft: wideSearch ? FILTER_COLUMN : 0 }}
            >
              <SearchResults q={q} cityId={cityId} results={results} total={total} width={wideSearch ? resultsW : undefined} kind={wideSearch ? kind : 'all'} />
            </Animated.ScrollView>
          ) : (
            <Animated.ScrollView keyboardShouldPersistTaps="handled"
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
          {/* Wide search: what to show, beside the results (it folds up with the header). */}
          {results && wideSearch ? (
            <Animated.View style={[styles.filters, { paddingTop: headerH + space[5] }, headerStyle]}>
              <SearchFilters results={results} total={total} kind={kind} onKind={setKind} onTry={setQ} />
            </Animated.View>
          ) : null}

          <Animated.View style={[styles.header, headerStyle]} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
            <Glass level="thick" border={false} highlight={false} style={StyleSheet.absoluteFill} />
            <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
            <View style={[styles.headInner, { paddingTop: insets.top + space[3] }, widePages ? { width: contentWidth(W) } : null]}>
              <Animated.View style={[styles.head, titleStyle]}>
                <View style={styles.headRow}>
                  <MapButton />
                  <View style={{ flex: 1 }}>
                    <Text variant="overline" tone="secondary">
                      {city.name}
                    </Text>
                    {narrowHead ? null : (
                      <Text variant="displayM" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        Discover
                      </Text>
                    )}
                  </View>
                  <InboxButtons />
                </View>
                {/* Below 360 pt the inbox buttons leave ~95 pt beside the avatar: "Découvrir" broke mid-word, so it gets its own line. */}
                {narrowHead ? (
                  <Text variant="displayM" numberOfLines={1}>
                    Discover
                  </Text>
                ) : null}
              </Animated.View>
              <View style={[styles.tools, widePages ? styles.toolsWide : null]}>
                <View style={widePages ? styles.flex : null}>
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
                </View>
                {!results ? (
                  <View style={widePages ? styles.tabsWide : null}>
                    <DiscoverTabs tabs={TABS} x={x} pageWidth={W} active={active} onPress={goTo} />
                  </View>
                ) : null}
              </View>
            </View>
          </Animated.View>
        </FrameContext.Provider>
      </View>
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
  column: { flex: 1, alignSelf: 'center', maxWidth: '100%' },
  filters: { position: 'absolute', left: space.gutter, top: 0, width: FILTER_COLUMN - space.gutter },
  head: { paddingHorizontal: space.gutter, marginBottom: space[5], gap: 2 },
  headInner: { alignSelf: 'center', width: '100%', maxWidth: '100%' },
  flex: { flex: 1 },
  tools: { paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[4] },
  // Wide pages: the search and the four tabs on one row.
  toolsWide: { flexDirection: 'row', alignItems: 'center' },
  tabsWide: { width: 460 },
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
