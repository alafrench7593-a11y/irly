import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Rail } from '@/components/cards/Blocks';
import { PersonCard } from '@/components/cards/PeopleCards';
import { SectionHeader } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { DEMO } from '@/config/app';
import { CATEGORIES } from '@/data/catalog/categories';
import { GIRL_PEOPLE } from '@/data/content/girls';
import { areaName, CITIES } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';
import type { CityId, Person } from '@/data/types';
import { useCommunitiesLike } from '@/features/bali/data';
import { DoorTile, type PageProps } from '@/features/discover/DiscoverPages';
import { scoreMatch } from '@/features/matching/match';
import { openCreate } from '@/features/create/createStore';
import { useServerActivities } from '@/features/server/activities';
import { usePhotoLink } from '@/features/server/covers';
import { FEATURES } from '@/lib/features';
import { PressableScale } from '@/motion/PressableScale';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { setAppSpace, useAppSpace } from '@/state/appSpace';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useDemoActivities, useDemoCommunitiesLike } from './demo';
import { MomsView } from './MomsView';
import { girlCommunityPhoto } from './photos';
import { girl, GIRL_TINT, girlType } from './theme';
import { GButton, GIconWell, GlassFill } from './ui';
import { GIRL_KINDS, KindRail, Upcoming } from './world';

/**
 * The parts of IRLY Girl that have no IRLY (Mixte) twin, laid into the same
 * tabs: on the Home and in Discover, at the place the Mixte page has its
 * own content (plans, communities, people), in the Girl look. Women only:
 * the server returns IRLY Girl rows to eligible women and nobody else.
 */

// The demonstration build reads the example communities and plans, never the server.
export const useGirlCommunities = DEMO ? useDemoCommunitiesLike : useCommunitiesLike;
export const useGirlPlans = DEMO ? useDemoActivities : useServerActivities;

/** Women to meet in this city: the example members in the demo build; the server's (Match) otherwise. */
export function useGirlPeople(cityId: CityId): Person[] {
  return useMemo(() => (DEMO ? [...GIRL_PEOPLE.values()].filter((p) => p.cityId === cityId) : []), [cityId]);
}

/**
 * Switch between IRLY and IRLY Girl, at the place the « IRLY Girl » entry
 * sits in IRLY. Into IRLY Girl goes through its door (/girl: the server
 * check); back to IRLY is immediate.
 */
export function SpaceSwitchCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const t = useTheme();
  const space = useAppSpace();
  const inGirl = space === 'girl';
  const onPress = () => {
    if (!inGirl) {
      router.push('/girl');
      return;
    }
    setAppSpace('mixte');
    toast('Back to IRLY', 'globe', 'brand');
  };
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={inGirl ? tx('Switch to IRLY Mixte') : tx('Open IRLY Girl')}
      style={[styles.switch, compact && { marginHorizontal: 0 }]}
    >
      <GlassLayer radius={radius.xl} />
      <View style={[styles.switchIcon, { backgroundColor: t.c.brandSoft }]}>
        <Icon name={inGirl ? 'globe' : 'sparkles'} size={18} color={t.c.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS">{inGirl ? 'Switch to IRLY Mixte' : 'Open IRLY Girl'}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {inGirl ? 'The same app, for everyone. Come back to IRLY Girl anytime.' : 'Women only · checked by IRLY'}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
    </PressableScale>
  );
}

/** IRLY Match inside IRLY Girl: coming soon, or the way into the deck once it is open. */
export function MatchCard() {
  const router = useRouter();
  const city = CITIES[useCityId()];
  return (
    <View style={styles.soon}>
      <GlassLayer radius={radius.xl} variant="plum" />
      <View style={styles.soonBadge}>
        <Icon name="sparkles" size={13} color="#F4B3CF" />
        <Text variant="overline" color={girl.pearl}>
          {FEATURES.girlMatch ? 'Women only' : 'Coming soon'}
        </Text>
      </View>
      <Text variant="titleM" color={girl.pearl} align="center" style={[girlType.section, { fontSize: 34, lineHeight: 38 }]}>
        IRLY <Text variant="titleM" color="#F4B3CF" style={[girlType.section, girlType.accent, { fontSize: 34, lineHeight: 38 }]}>Match</Text>
      </Text>
      <Text variant="bodyS" color="rgba(255,240,247,0.80)" align="center">
        {tx('Meet women who share your interests in {city}, matched on what you love.', { city: city.name })}
      </Text>
      {FEATURES.girlMatch ? <GButton label="Open IRLY Match" icon="heartHandshake" onPress={() => router.push('/girl/match')} /> : null}
    </View>
  );
}

/** « Girls moving to Bali »: in Bali, at the place IRLY shows its Bali card. */
export function GirlMovingCard() {
  const router = useRouter();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/girl/moving')} style={styles.moving} accessibilityLabel="Girls moving to Bali">
      <GlassLayer radius={radius.xl} />
      <GIconWell icon="plane" size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="titleS" color={girl.ink}>
          Girls moving to Bali
        </Text>
        <Text variant="caption" color={girl.inkSoft}>
          Meet women before you arrive
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={girl.inkSoft} />
    </PressableScale>
  );
}

/**
 * All girls | Moms: the plum bead slides and stretches to the side you
 * pick. IRLY Moms lives inside IRLY Girl (same women-only rule).
 */
export function GirlModes({ mode, onMode }: { mode: 'all' | 'moms'; onMode: (m: 'all' | 'moms') => void }) {
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const stretch = useSharedValue(1);
  const seen = useRef(mode);
  useEffect(() => {
    if (seen.current === mode || reduced) return;
    seen.current = mode;
    stretch.set(withSequence(withTiming(1.2, { duration: 150 }), withSpring(1, { duration: 520, dampingRatio: 0.5 })));
  }, [mode, reduced, stretch]);
  const thumb = useAnimatedStyle(() => {
    const x = mode === 'moms' ? (w - 8) / 2 : 0;
    return { transform: [{ translateX: reduced ? x : withSpring(x, { duration: 520, dampingRatio: 0.8 }) }, { scaleX: stretch.value }, { scaleY: 1 / Math.sqrt(stretch.value) }] };
  });
  return (
    <View style={styles.modes} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <GlassFill variant="bar" radius={26} />
      <Animated.View style={[styles.modeThumb, { width: (w - 8) / 2 }, thumb]}>
        <LinearGradient colors={girl.plumGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.thumbRim]} />
      </Animated.View>
      {(['all', 'moms'] as const).map((m) => (
        <PressableScale
          key={m}
          haptic="select"
          scaleTo={0.96}
          onPress={() => onMode(m)}
          style={styles.mode}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === m }}
          accessibilityLabel={m === 'all' ? 'All girls' : 'Moms'}
        >
          <Icon name={m === 'all' ? 'heart' : 'baby'} size={14} color={mode === m ? '#F4B3CF' : girl.ink} />
          <Text variant="label" color={mode === m ? girl.pearl : girl.ink}>
            {m === 'all' ? 'All girls' : 'Moms'}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

/**
 * The girls' plans coming up: kinds of plans, then the next ones as a
 * two-column grid of photo cards (Home) or as rows (Discover).
 */
export function GirlPlans({ cityId, grid = false, onPlan }: { cityId: CityId; grid?: boolean; onPlan: () => void }) {
  const { activities, loading, error, refresh } = useGirlPlans(cityId, { girlOnly: true });
  const [kind, setKind] = useState<string | null>(null);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of GIRL_KINDS) out[k.id] = activities.filter((a) => k.match.test(a.title) || Boolean(k.cats?.includes(a.categoryId))).length;
    return out;
  }, [activities]);
  return (
    <View style={{ gap: 12 }}>
      <KindRail kinds={GIRL_KINDS} value={kind} onChange={setKind} counts={counts} />
      <Upcoming activities={activities} kinds={GIRL_KINDS} kind={kind} onKind={setKind} onPlan={onPlan} emptyTitle="What if you organised the first meetup?" loading={loading} error={error} onRetry={refresh} grid={grid} />
    </View>
  );
}

/** The IRLY Girl communities near you, and a tile to start one (women only, with its own chat). */
export function GirlCommunities({ cityId }: { cityId: CityId }) {
  const router = useRouter();
  const list = useGirlCommunities(cityId, '', true);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
      {!list.data.length && list.loading ? [0, 1].map((i) => <Skeleton key={i} width={168} height={200} radius={radius.xl} />) : null}
      {!list.data.length && list.error && !list.loading ? (
        <View style={[styles.community, styles.newCommunity, { borderStyle: 'solid' }]}>
          <GlassLayer radius={radius.xl} />
          <GIconWell icon="globe" tone="error" size={36} />
          <Text variant="bodyS" color={girl.inkSoft}>
            Communities could not load.
          </Text>
          <GButton label="Try again" variant="secondary" onPress={list.reload} />
        </View>
      ) : null}
      {list.data.map((c) => (
        <CommunityTile key={c.id} c={c} away={c.cityId !== cityId} onPress={() => router.push(`/c/${c.id}`)} />
      ))}
      <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push('/girl/new-community')} style={[styles.community, styles.newCommunity]} accessibilityLabel="Create a community">
        <GlassLayer radius={radius.xl} />
        <GIconWell icon="plus" size={36} />
        <Text variant="titleS" color={girl.ink} style={{ marginTop: 'auto' }}>
          {list.data.length || list.loading || list.error ? 'Create a community' : 'Start the first community'}
        </Text>
        <Text variant="caption" color={girl.inkSoft}>
          Women only, with its own chat.
        </Text>
      </PressableScale>
    </ScrollView>
  );
}

/** A community in IRLY Girl: its own photo when it has one, its name, its members, and whether you are in. */
function CommunityTile({ c, away, onPress }: { c: { id: string; name: string; member: boolean; members: number; cityId: string; coverPath: string | null; photo?: PhotoKey }; away: boolean; onPress: () => void }) {
  const uri = usePhotoLink(c.coverPath);
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} style={styles.community} accessibilityLabel={tx('{name}, {n} members', { name: c.name, n: c.members })}>
      <Photo pinned tint={GIRL_TINT} visual={{ photo: c.photo ?? girlCommunityPhoto(c.name), uri: uri ?? undefined }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={400} recyclingKey={`gc-${c.id}-${c.coverPath ?? 'app'}`} />
      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View style={styles.communityBadge}>
          <Icon name={c.member ? 'check' : 'users'} size={14} color={girl.rose} />
        </View>
        <View style={{ gap: 2 }}>
          {away ? (
            <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
              {CITIES[c.cityId as keyof typeof CITIES]?.name}
            </Text>
          ) : null}
          <Text variant="titleS" color="#FFFFFF" numberOfLines={2} raw style={girlType.card}>
            {c.name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.88)">
            {c.member ? tx('Joined · {n} members', { n: c.members }) : tx('{n} members', { n: c.members })}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/* ───────── Discover, in IRLY Girl ───────── */

function PageScroll({ scrollY, top, bottom, children }: { scrollY: SharedValue<number>; top: number; bottom: number; children: ReactNode }) {
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  return (
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: top, paddingBottom: bottom }}>
      {children}
    </Animated.ScrollView>
  );
}

/**
 * Discover › People in IRLY Girl: the same page as in IRLY (find someone,
 * people for you, the space, communities), with women and IRLY Girl
 * communities only.
 */
export function GirlPeoplePage({ cityId, scrollY, top, bottom }: PageProps) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[cityId];
  const profile = useStore((s) => s.profile);
  const women = useGirlPeople(cityId);
  const [moms, setMoms] = useState(false);
  const matches = useMemo(() => women.map((p) => scoreMatch(profile, p, 'friends', (id) => areaName(city, id))).sort((a, b) => b.score - a.score).slice(0, 8), [women, profile, city]);
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      <ScrollReveal scrollY={scrollY} style={styles.first}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <MatchCard />
        </View>
      </ScrollReveal>

      {matches.length ? (
        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader overline="Women only · Not dating" title="Women for you" />
          <Rail itemWidth={290}>
            {matches.map((m) => (
              <PersonCard key={m.person.id} match={m} width={290} />
            ))}
          </Rail>
        </ScrollReveal>
      ) : null}

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="With kids or without" title="IRLY Moms" />
        <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
          <PressableScale haptic="select" scaleTo={0.98} onPress={() => setMoms((m) => !m)} accessibilityRole="button" accessibilityState={{ expanded: moms }} style={styles.moving}>
            <GlassLayer radius={radius.xl} />
            <GIconWell icon="baby" size={40} />
            <View style={{ flex: 1 }}>
              <Text variant="titleS">{moms ? 'Hide IRLY Moms' : 'Open IRLY Moms'}</Text>
              <Text variant="caption" tone="secondary">
                Moms near you, playdates, family-friendly places
              </Text>
            </View>
            <Icon name={moms ? 'chevronUp' : 'chevronDown'} size={18} color={t.c.textSecondary} />
          </PressableScale>
        </View>
        {moms ? <MomsView cityId={cityId} /> : null}
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SectionHeader overline="Women only · with their own chat" title="Communities" action="All" onAction={() => router.push('/communities')} />
        <GirlCommunities cityId={cityId} />
      </ScrollReveal>

      <ScrollReveal scrollY={scrollY} style={styles.section}>
        <SpaceSwitchCard />
      </ScrollReveal>
    </PageScroll>
  );
}

/** Discover › Activities in IRLY Girl: the girls' plans coming up, then every kind of plan (same doors as IRLY). */
export function GirlActivitiesPage({ cityId, scrollY, top, bottom }: PageProps) {
  const router = useRouter();
  const city = CITIES[cityId];
  const [w, setW] = useState(0);
  const doorW = (w - space.gutter * 2 - 12) / 2;
  return (
    <PageScroll scrollY={scrollY} top={top} bottom={bottom}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} />
      <ScrollReveal scrollY={scrollY} style={styles.first}>
        <SectionHeader overline="Join in" title="Girls' plans coming up" action="Plans" onAction={() => router.push('/social')} />
        <GirlPlans cityId={cityId} onPlan={() => openCreate(null)} />
      </ScrollReveal>

      {w ? (
        <ScrollReveal scrollY={scrollY} style={styles.section}>
          <SectionHeader overline="Every kind of plan" title="Find something to do" />
          <View style={styles.doors}>
            {CATEGORIES.map((c) => (
              <DoorTile key={c.id} door={{ label: c.label, caption: c.tagline, icon: c.icon, photo: c.photo, href: `/category/${c.id}` }} width={doorW} light={city.light} />
            ))}
          </View>
        </ScrollReveal>
      ) : null}
    </PageScroll>
  );
}

const styles = StyleSheet.create({
  first: { marginTop: space[5] },
  section: { marginTop: space[9] },
  doors: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  switch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.gutter, padding: 14, borderRadius: radius.xl, overflow: 'hidden' },
  switchIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modes: { flexDirection: 'row', marginHorizontal: space.gutter, padding: 4, borderRadius: 26, zIndex: 0, boxShadow: girl.shadowSoft },
  modeThumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 22, boxShadow: girl.shadowPlum },
  thumbRim: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,205,226,0.26)' },
  mode: { flex: 1, flexDirection: 'row', gap: 6, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moving: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, boxShadow: girl.shadowSoft },
  soon: { paddingHorizontal: 22, paddingVertical: 24, gap: 10, alignItems: 'center', borderRadius: radius.xl, boxShadow: girl.shadowPlum },
  soonBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,205,226,0.30)', backgroundColor: 'rgba(255,255,255,0.08)' },
  community: { width: 168, height: 200, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', boxShadow: girl.shadowSoft },
  newCommunity: { padding: 14, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(185,43,105,0.30)', justifyContent: 'flex-start' },
  communityBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' },
});
