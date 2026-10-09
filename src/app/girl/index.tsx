import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx, useT } from '@/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { openCreate } from '@/features/create/createStore';
import { matchApi, PAGE_SIZE, type MatchApi } from '@/features/girl/api';
import { CandidateCard } from '@/features/girl/CandidateCard';
import { GirlIntro } from '@/features/girl/GirlIntro';
import { MatchMoment } from '@/features/girl/MatchMoment';
import { FiltersSheet, ProfileSheet, SafetySheet } from '@/features/girl/Sheets';
import type { Suggestion } from '@/features/girl/suggest';
import { girl } from '@/features/girl/theme';
import type { Candidate, Filters, MatchResult, MatchState, MatchSummary, Section } from '@/features/girl/types';
import { GButton } from '@/features/girl/ui';
import { GirlHero } from '@/features/girl/GirlHero';
import { girlPhotoFor } from '@/features/girl/photos';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { MomsView } from '@/features/girl/MomsView';
import { GIRL_KINDS, GirlFeed, KindRail, Shortcuts, Upcoming } from '@/features/girl/world';
import { GIRL_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useCommunitiesLike } from '@/features/bali/data';
import { useServerActivities } from '@/features/server/activities';
import { CITIES } from '@/data/destinations';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { supabase } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';

const SECTIONS: { id: Section; label: (city: string) => string; icon: IconName }[] = [
  { id: 'for_you', label: () => 'For you', icon: 'sparkles' },
  { id: 'new', label: (c) => `New in ${c}`, icon: 'plane' },
  { id: 'active', label: () => 'Active now', icon: 'zap' },
  { id: 'interests', label: () => 'Same interests', icon: 'heart' },
  { id: 'sports', label: () => 'Same sports', icon: 'trophy' },
  { id: 'travel', label: () => 'Travel girls', icon: 'globe' },
  { id: 'nearby', label: () => 'Nearby', icon: 'pin' },
  { id: 'saved', label: () => 'Saved', icon: 'bookmark' },
];

/**
 * IRLY Girl Match. Women only (checked server-side), onboarding and a
 * Match profile first, then discovery: sections, filters, a deck you swipe
 * or tap, your matches on top. A match opens its private chat and the
 * question that matters: what will you do together?
 */
export default function GirlHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const window = useWindowDimensions();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const apiRef = useRef<MatchApi | null>(null);
  const [state, setState] = useState<MatchState | 'loading' | 'error'>('loading');
  const [filters, setFilters] = useState<Filters>({ section: 'for_you' });
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [open, setOpen] = useState<Candidate | null>(null);
  const [safetyFor, setSafetyFor] = useState<Candidate | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [moment, setMoment] = useState<{ match: MatchResult; person: Candidate } | null>(null);
  // « IRLY Moms » on the Home opens this world on the Moms side.
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'all' | 'moms'>(params.mode === 'moms' ? 'moms' : 'all');
  const serverCommunities = useCommunitiesLike(cityId, '', true);
  // Plans created in IRLY Girl (girls and moms): they show up right here.
  const { activities: girlPlans } = useServerActivities(cityId, { girlOnly: true });
  const [kind, setKind] = useState<string | null>(null);
  // Why IRLY Girl is closed for this account (asked only when it is).
  const [closed, setClosed] = useState<string | null>(null);
  useEffect(() => {
    if (state !== 'ineligible' || !supabase) return;
    let alive = true;
    supabase.rpc('my_girl_status').then(({ data }) => alive && setClosed((data as string) ?? null));
    return () => {
      alive = false;
    };
  }, [state]);
  const kindCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of GIRL_KINDS) out[k.id] = girlPlans.filter((a) => k.match.test(a.title) || Boolean(k.cats?.includes(a.categoryId))).length;
    return out;
  }, [girlPlans]);
  // Shortcuts under the hero scroll to these sections (y inside the page).
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const marks = useRef<Record<string, number>>({});
  const record = (name: string, e: LayoutChangeEvent) => {
    marks.current[name] = e.nativeEvent.layout.y;
  };
  const momsSection = (name: string, y: number) => {
    if (name === 'goPlan') goTo('momsPlan');
    else if (name === 'goCommunities') goTo('momsCommunities');
    else marks.current[name] = (marks.current.momsBase ?? 0) + y;
  };
  const goTo = (name: string) => {
    const y = marks.current[name];
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - insets.top - 8), animated: !reduced });
  };
  const fling = useSharedValue(0);
  const tr = useT();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const reduced = useReducedMotion();
  const [modesW, setModesW] = useState(0);
  const stretch = useSharedValue(1);
  const modeSeen = useRef(mode);
  useEffect(() => {
    if (modeSeen.current === mode || reduced) return;
    modeSeen.current = mode;
    stretch.set(withSequence(withTiming(1.2, { duration: 150 }), withSpring(1, { duration: 520, dampingRatio: 0.5 })));
  }, [mode, reduced, stretch]);
  const thumb = useAnimatedStyle(() => {
    const x = mode === 'moms' ? (modesW - 8) / 2 : 0;
    return { transform: [{ translateX: reduced ? x : withSpring(x, { duration: 520, dampingRatio: 0.8 }) }, { scaleX: stretch.value }, { scaleY: 1 / Math.sqrt(stretch.value) }] };
  });

  const width = Math.min((frame.width || window.width) - space.gutter * 2, 420);
  const height = Math.min(width * 1.32, (frame.height || window.height) * 0.56);

  // Only the latest request may write the deck (a slow "for you" page must
  // not land after the member switched to "new" or changed filters).
  const deckSeq = useRef(0);
  const loadDeck = useCallback(async (f: Filters, from: number) => {
    const api = apiRef.current;
    if (!api) return;
    const n = ++deckSeq.current;
    setDeckLoading(true);
    setDeckError(null);
    try {
      const page = await api.discover(f, from);
      if (n !== deckSeq.current) return;
      setDeck((d) => (from === 0 ? page : [...d, ...page.filter((p) => !d.some((x) => x.userId === p.userId))]));
      setOffset(from + page.length);
      setExhausted(page.length < PAGE_SIZE);
    } catch (e) {
      if (n === deckSeq.current) setDeckError(e instanceof Error ? e.message : 'Could not load profiles');
    } finally {
      if (n === deckSeq.current) setDeckLoading(false);
    }
  }, []);

  const loadMatches = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      setMatches(await api.matches());
    } catch {
      // Matches are secondary on this screen; discovery keeps working.
    }
  }, []);

  // Focus re-checks reuse the current filters and keep the screen (no spinner flash).
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);
  const booted = useRef(false);

  const boot = useCallback(async () => {
    if (!booted.current) setState('loading');
    try {
      const api = await matchApi();
      apiRef.current = api;
      const s = await api.state();
      setState(s);
      if (s === 'onboarding') router.replace('/girl/onboarding');
      else if (s === 'profile') router.replace('/girl/profile');
      else if (s === 'ready') {
        booted.current = true;
        loadDeck(filtersRef.current, 0);
        loadMatches();
      }
    } catch {
      setState('error');
    }
  }, [router, loadDeck, loadMatches]);

  // Re-check on focus: coming back from onboarding or profile edits.
  useFocusEffect(
    useCallback(() => {
      boot();
    }, [boot]),
  );

  // Keep the deck full: fetch the next page before it runs out.
  useEffect(() => {
    if (state === 'ready' && deck.length < 3 && !exhausted && !deckLoading && !deckError && offset > 0) loadDeck(filters, offset);
  }, [state, deck.length, exhausted, deckLoading, deckError, offset, filters, loadDeck]);

  const applyFilters = (f: Filters) => {
    setFilters(f);
    setShowFilters(false);
    setDeck([]);
    loadDeck(f, 0);
  };

  const decide = async (c: Candidate, d: 'like' | 'pass') => {
    setDeck((list) => list.filter((x) => x.userId !== c.userId));
    setOpen(null);
    try {
      const result = await apiRef.current!.act(c.userId, d);
      if (result) {
        setMoment({ match: result, person: c });
        loadMatches();
      } else if (d === 'like') {
        toast(tx('{name} will see you want to connect', { name: c.firstName }), 'heartHandshake', 'brand');
      }
    } catch (e) {
      // Put her back so nothing is lost.
      setDeck((list) => [c, ...list]);
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', 'x', 'live');
    }
  };

  const save = async (c: Candidate) => {
    try {
      await apiRef.current!.act(c.userId, c.saved ? 'unsave' : 'save');
      haptic('select');
      const update = (x: Candidate) => (x.userId === c.userId ? { ...x, saved: !c.saved } : x);
      setDeck((list) => list.map(update));
      setOpen((o) => (o ? update(o) : o));
      toast(c.saved ? 'Removed from saved' : tx('{name} saved', { name: c.firstName }), 'bookmark', 'brand');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    }
  };

  const top = deck[0];

  if (state === 'loading' || state === 'onboarding' || state === 'profile') {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={girl.rose} />
      </View>
    );
  }

  if (state === 'error') {
    return (
      <View style={[styles.root, styles.center, { padding: space.gutter, gap: 16 }]}>
        <Icon name="globe" size={28} color={girl.ink} />
        <Text variant="titleM" color={girl.ink} align="center">
          IRLY Girl could not load
        </Text>
        <Text variant="body" color={girl.inkSoft} align="center">
          Check your connection and try again.
        </Text>
        <GButton label="Try again" onPress={boot} />
        <GButton label="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    );
  }

  if (state === 'ineligible') {
    if (closed === 'suspended')
      return (
        <View style={[styles.root, styles.center, { padding: space.gutter + 8, gap: 16, paddingTop: insets.top + 40 }]}>
          <Icon name="shield" size={28} color={girl.ink} />
          <Text variant="displayM" align="center" color={girl.ink}>
            IRLY Girl is paused for your account
          </Text>
          <Text variant="body" align="center" color={girl.inkSoft}>
            After reports, our team paused your access to IRLY Girl. The rest of IRLY works as usual. If you think this is a mistake, write to us.
          </Text>
          <GButton label="Contact support" onPress={() => router.push('/support')} />
          <GButton label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      );
    return (
      <View style={[styles.root, styles.center, { padding: space.gutter + 8, gap: 16, paddingTop: insets.top + 40 }]}>
        <Icon name="lock" size={28} color={girl.ink} />
        <Text variant="displayM" align="center" color={girl.ink}>
          IRLY Girl is reserved for women
        </Text>
        <Text variant="body" align="center" color={girl.inkSoft}>
          A space where women meet other women: brunches, padel, travel, wellness. Access is checked by our servers.
        </Text>
        <GButton label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <GirlHero mode={mode} scrollY={scrollY} width={frame.width || window.width} onBack={() => router.back()} onProfile={() => router.push('/girl/profile')} />


        {matches.length ? (
          <View style={{ marginTop: space[5], gap: 10 }}>
            <Text variant="overline" color={girl.inkSoft} style={{ paddingHorizontal: space.gutter }}>
              Your matches · {matches.length}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 14 }}>
              {matches.map((m) => (
                <PressableScale key={m.matchId} haptic="select" scaleTo={0.94} onPress={() => router.push(`/messages/${m.conversationId}`)} style={styles.matchItem} accessibilityLabel={tx('Chat with {name}', { name: m.firstName })}>
                  <View style={styles.matchRing}>
                    <Avatar name={m.firstName} hue={m.hue} size={56} photo={m.photoUrls[0]} />
                  </View>
                  <Text variant="caption" color={girl.ink} numberOfLines={1} raw>
                    {m.firstName}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.modes} onLayout={(e) => setModesW(e.nativeEvent.layout.width)}>
          <Animated.View style={[styles.modeThumb, { width: (modesW - 8) / 2 }, thumb]} />
          {(['all', 'moms'] as const).map((m) => (
            <PressableScale
              key={m}
              haptic="select"
              scaleTo={0.96}
              onPress={() => setMode(m)}
              style={styles.mode}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              accessibilityLabel={m === 'all' ? 'All girls' : 'Moms'}
            >
              <Icon name={m === 'all' ? 'heart' : 'baby'} size={14} color={mode === m ? '#FFFFFF' : girl.ink} />
              <Text variant="label" color={mode === m ? '#FFFFFF' : girl.ink}>
                {m === 'all' ? 'All girls' : 'Moms'}
              </Text>
            </PressableScale>
          ))}
        </View>

        <Shortcuts
          items={
            mode === 'moms'
              ? [
                  { icon: 'baby', label: 'Moms', onPress: () => goTo('moms') },
                  { icon: 'calendar', label: 'Activities', onPress: () => goTo('momsPlans') },
                  { icon: 'users', label: 'Communities', onPress: () => goTo('momsCommunities') },
                  { icon: 'plus', label: 'Plan', onPress: () => goTo('momsPlan') },
                ]
              : [
                  { icon: 'heartHandshake', label: 'Women', onPress: () => goTo('women') },
                  { icon: 'calendar', label: 'Activities', onPress: () => goTo('plans') },
                  { icon: 'users', label: 'Communities', onPress: () => goTo('communities') },
                  { icon: 'message', label: 'Posts', onPress: () => goTo('posts') },
                ]
          }
        />

        {mode === 'moms' ? (
          <View onLayout={(e) => record('momsBase', e)}>
            <MomsView cityId={cityId} onSection={momsSection} />
          </View>
        ) : (
          <>
        {cityId === 'bali' ? (
          <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/girl/moving')} style={styles.moving} accessibilityLabel="Girls moving to Bali">
            <Icon name="plane" size={20} color={girl.rose} />
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
        ) : null}

        <View onLayout={(e) => record('women', e)} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sections}>
          {SECTIONS.map((s) => {
            const on = filters.section === s.id;
            return (
              <PressableScale
                key={s.id}
                haptic="select"
                scaleTo={0.96}
                onPress={() => applyFilters({ ...filters, section: s.id })}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.section, { backgroundColor: on ? girl.ink : girl.surface }]}
              >
                <Icon name={s.icon} size={14} color={on ? '#FFFFFF' : girl.ink} />
                <Text variant="label" color={on ? '#FFFFFF' : girl.ink}>
                  {s.id === 'new' ? tr('New in {city}', { city: city.name }) : s.label(city.name)}
                </Text>
              </PressableScale>
            );
          })}
          <PressableScale haptic="select" scaleTo={0.96} onPress={() => setShowFilters(true)} accessibilityLabel="Filters" style={[styles.section, { backgroundColor: girl.blush }]}>
            <Icon name="sliders" size={14} color={girl.ink} />
            <Text variant="label" color={girl.ink}>
              Filters
            </Text>
          </PressableScale>
        </ScrollView>

        <View style={[styles.deck, { height: height + 8 }]}>
          {deck.length ? (
            deck
              .slice(0, 3)
              .reverse()
              .map((c, i, arr) => {
                const depth = arr.length - 1 - i;
                return (
                  <View
                    key={c.userId}
                    style={[StyleSheet.absoluteFill, styles.deckLayer, { transform: [{ translateY: depth * 10 }, { scale: 1 - depth * 0.04 }], opacity: depth > 1 ? 0.6 : 1 }]}
                    pointerEvents={depth === 0 ? 'auto' : 'none'}
                  >
                    <CandidateCard candidate={c} width={width} height={height} active={depth === 0} fling={fling} onDecide={(d) => decide(c, d)} onOpen={() => setOpen(c)} />
                  </View>
                );
              })
          ) : deckLoading ? (
            <View style={[styles.empty, { width, height }]}>
              <ActivityIndicator color={girl.rose} />
              <Text variant="bodyS" color={girl.inkSoft}>
                Finding your kind of people…
              </Text>
            </View>
          ) : deckError ? (
            <View style={[styles.empty, { width, height }]}>
              <Icon name="globe" size={24} color={girl.ink} />
              <Text variant="titleS" color={girl.ink} align="center">
                {deckError}
              </Text>
              <GButton label="Retry" variant="secondary" onPress={() => loadDeck(filters, 0)} />
            </View>
          ) : (
            <Animated.View entering={FadeIn} style={[styles.empty, { width, height }]}>
              <Icon name="sparkles" size={26} color={girl.rose} />
              <Text variant="titleM" color={girl.ink} align="center">
                {filters.section === 'saved' ? 'Nobody saved yet' : "You've seen everyone here for now"}
              </Text>
              <Text variant="bodyS" color={girl.inkSoft} align="center">
                {filters.section === 'saved' ? 'Tap the bookmark on a profile to keep it for later.' : 'Try another section, loosen your filters, or check back tomorrow: new girls join every day.'}
              </Text>
              <GButton label="Show everyone" variant="secondary" onPress={() => applyFilters({ section: 'for_you' })} />
            </Animated.View>
          )}
        </View>

        {top ? (
          <View style={styles.actions}>
            <ActionButton icon="x" label={tx('Not now, {name}', { name: top.firstName })} onPress={() => fling.set(-1)} />
            <ActionButton icon="bookmark" label={top.saved ? 'Remove from saved' : 'Save for later'} small onPress={() => save(top)} active={top.saved} />
            <ActionButton icon="heartHandshake" label={tx('Connect with {name}', { name: top.firstName })} big onPress={() => fling.set(1)} />
            <ActionButton icon="user" label={tx("View {name}'s profile", { name: top.firstName })} small onPress={() => setOpen(top)} />
            <ActionButton icon="shield" label="Block or report" onPress={() => setSafetyFor(top)} />
          </View>
        ) : null}

        <View onLayout={(e) => record('plan', e)} />
        <ScrollReveal scrollY={scrollY} style={{ marginTop: space[7], marginHorizontal: space.gutter, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: girl.surface, boxShadow: girl.shadowSoft }}>
          <View style={{ height: 120 }}>
            <Photo visual={{ photo: 'girlSunset' }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
            <Text variant="titleL" color="#FFFFFF" style={{ position: 'absolute', left: 16, bottom: 14 }}>
              Plan something with girls
            </Text>
          </View>
          <View style={{ padding: 16 }}>
            <QuickPlan cityId={cityId} types={GIRL_PLANS} palette="girl" />
          </View>
        </ScrollReveal>

        <View onLayout={(e) => record('plans', e)} style={{ marginTop: space[7], gap: 12 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink}>
              What women plan together
            </Text>
            <Text variant="bodyS" color={girl.inkSoft}>
              Pick a kind of plan to see the next ones.
            </Text>
          </View>
          <KindRail kinds={GIRL_KINDS} value={kind} onChange={setKind} counts={kindCounts} />
          <Text variant="titleM" color={girl.ink} style={{ paddingHorizontal: space.gutter, marginTop: space[3] }}>
            {"Girls' plans coming up"}
          </Text>
          <Upcoming activities={girlPlans} kinds={GIRL_KINDS} kind={kind} onKind={setKind} onPlan={() => goTo('plan')} emptyTitle="What if you organised the first meetup?" />
        </View>

        <View onLayout={(e) => record('communities', e)} />
        <ScrollReveal scrollY={scrollY} style={{ marginTop: space[7], gap: 10 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink}>
              IRLY Girl communities
            </Text>
            <Text variant="bodyS" color={girl.inkSoft}>
              Join one and you are in its chat straight away.
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
            {serverCommunities.data.map((c) => (
              <PressableScale
                key={c.id}
                haptic="select"
                scaleTo={0.96}
                onPress={() => router.push(`/c/${c.id}`)}
                style={styles.community}
                accessibilityLabel={c.name}
              >
                <Photo visual={{ photo: girlPhotoFor(c.name) }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={400} />
                <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
                  <View style={styles.communityBadge}>
                    <Icon name={c.member ? 'check' : 'users'} size={14} color={girl.rose} />
                  </View>
                  <View>
                    {c.cityId !== cityId ? (
                      <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                        {CITIES[c.cityId as keyof typeof CITIES]?.name}
                      </Text>
                    ) : null}
                    <Text variant="titleS" color="#FFFFFF" numberOfLines={2} raw>
                      {c.name}
                    </Text>
                  </View>
                </View>
              </PressableScale>
            ))}
            <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push('/community/new')} style={[styles.community, styles.newCommunity]} accessibilityLabel="Create a community">
              <View style={styles.communityBadge}>
                <Icon name="plus" size={16} color={girl.rose} />
              </View>
              <Text variant="titleS" color={girl.ink}>
                {serverCommunities.data.length ? 'Create a community' : 'Start the first community'}
              </Text>
              <Text variant="caption" color={girl.inkSoft}>
                Public, private or by invitation.
              </Text>
            </PressableScale>
          </ScrollView>
        </ScrollReveal>

        <View onLayout={(e) => record('posts', e)} style={{ marginTop: space[7], gap: 12 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink}>
              Recent posts
            </Text>
            <Text variant="bodyS" color={girl.inkSoft}>
              From the IRLY Girl communities near you.
            </Text>
          </View>
          <GirlFeed cityId={cityId} moms={false} onCommunities={() => goTo('communities')} />
        </View>
          </>
        )}
      </Animated.ScrollView>

      <ProfileSheet
        candidate={open}
        onClose={() => setOpen(null)}
        onConnect={() => open && decide(open, 'like')}
        onPass={() => open && decide(open, 'pass')}
        onSave={() => open && save(open)}
        onSafety={() => {
          setSafetyFor(open);
          setOpen(null);
        }}
      />

      <SafetySheet
        name={safetyFor?.firstName ?? ''}
        visible={Boolean(safetyFor)}
        onClose={() => setSafetyFor(null)}
        onHide={() => {
          if (safetyFor) decide(safetyFor, 'pass');
          setSafetyFor(null);
          toast('Hidden from your discovery', 'eye', 'brand');
        }}
        onBlock={async () => {
          const c = safetyFor;
          if (!c) return;
          setDeck((list) => list.filter((x) => x.userId !== c.userId));
          try {
            await apiRef.current!.block(c.userId);
            toast(tx('{name} is blocked', { name: c.firstName }), 'shield', 'brand');
            loadMatches();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not block', 'x', 'live');
          }
        }}
        onReport={async (category, details) => {
          const c = safetyFor;
          if (!c) return;
          try {
            await apiRef.current!.report(c.userId, category, details);
            toast('Report sent. Thank you for keeping IRLY safe.', 'flag', 'brand');
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not send the report', 'x', 'live');
          }
        }}
      />

      {showFilters ? <FiltersSheet visible cityId={cityId} value={filters} onApply={applyFilters} onClose={() => setShowFilters(false)} /> : null}

      <MatchMoment
        match={moment?.match ?? null}
        person={moment?.person ?? null}
        onClose={() => setMoment(null)}
        onHello={() => {
          const id = moment?.match.conversationId;
          setMoment(null);
          if (id) router.push(`/messages/${id}`);
        }}
        onSuggestion={(s: Suggestion) => {
          setMoment(null);
          setTimeout(() => openCreate(null, s.preset), 250);
        }}
        onFindExisting={(s: Suggestion) => {
          setMoment(null);
          if (s.preset.categoryId) router.push(`/category/${s.preset.categoryId}`);
        }}
      />

      <GirlIntro />
    </View>
  );
}

function ActionButton({ icon, label, onPress, big, small, active }: { icon: IconName; label: string; onPress: () => void; big?: boolean; small?: boolean; active?: boolean }) {
  const size = big ? 68 : small ? 46 : 56;
  return (
    <PressableScale
      haptic={big ? 'press' : 'select'}
      scaleTo={0.88}
      onPress={onPress}
      accessibilityLabel={label}
      style={[
        styles.action,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: big ? girl.ink : active ? girl.blush : girl.surface },
      ]}
    >
      <Icon name={icon} size={big ? 28 : 20} color={big ? '#FFFFFF' : girl.ink} fill={active ? girl.ink : 'none'} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', marginHorizontal: space.gutter, marginTop: -26, padding: 4, borderRadius: 26, backgroundColor: girl.surface, boxShadow: girl.shadow },
  modeThumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 22, backgroundColor: girl.ink },
  mode: { flex: 1, flexDirection: 'row', gap: 6, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moving: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.gutter, marginTop: space[5], padding: 14, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  root: { flex: 1, backgroundColor: girl.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: girl.surface, alignItems: 'center', justifyContent: 'center' },
  matchItem: { alignItems: 'center', gap: 6, width: 64 },
  matchRing: { padding: 2, borderRadius: 32, borderWidth: 2, borderColor: girl.rose },
  sections: { paddingHorizontal: space.gutter, gap: 8, marginTop: space[5], marginBottom: space[4] },
  section: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: radius.pill, boxShadow: girl.shadowSoft },
  deck: { alignItems: 'center' },
  deckLayer: { alignItems: 'center' },
  empty: { borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: space[4] },
  action: { alignItems: 'center', justifyContent: 'center', boxShadow: girl.shadowSoft },
  community: { width: 168, height: 200, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', boxShadow: girl.shadowSoft },
  newCommunity: { backgroundColor: girl.surface, padding: 14, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: girl.blushStrong },
  plan: { width: 220, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  planPhoto: { height: 120, overflow: 'hidden' },
  communityBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' },
});
