import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx, useT } from '@/i18n';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { GirlClosed, GirlLoading, isGirlRefusal, readGirlAccess, safeBack, withLimit } from '@/features/girl/access';
import { Photo } from '@/components/visual/Photo';
import { FEATURES } from '@/lib/features';
import { useAccount } from '@/features/auth/account';
import { openCreate } from '@/features/create/createStore';
import { matchApi, PAGE_SIZE, type MatchApi } from '@/features/girl/api';
import { CandidateCard } from '@/features/girl/CandidateCard';
import { GirlIntro } from '@/features/girl/GirlIntro';
import { MatchMoment } from '@/features/girl/MatchMoment';
import { FiltersSheet, ProfileSheet, SafetySheet } from '@/features/girl/Sheets';
import type { Suggestion } from '@/features/girl/suggest';
import { girl, GIRL_TINT, girlType } from '@/features/girl/theme';
import type { Candidate, Filters, MatchResult, MatchState, MatchSummary, Section } from '@/features/girl/types';
import { GButton, GIconWell, GlassFill } from '@/features/girl/ui';
import { GirlBackdrop, GirlHero } from '@/features/girl/GirlHero';
import { GirlMessages } from '@/features/girl/GirlMessages';
import { useUnread } from '@/components/navigation/Headers';
import { usePhotoLink } from '@/features/server/covers';
import { girlCommunityPhoto } from '@/features/girl/photos';
import { ScrollReveal } from '@/motion/ScrollReveal';
import { MomsView } from '@/features/girl/MomsView';
import { GIRL_KINDS, GirlFeed, KindRail, Shortcuts, Upcoming } from '@/features/girl/world';
import { GIRL_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useCommunitiesLike } from '@/features/bali/data';
import { useServerActivities } from '@/features/server/activities';
import { DEMO } from '@/config/app';
import { useDemoActivities, useDemoCommunitiesLike } from '@/features/girl/demo';
import type { PhotoKey } from '@/data/photos';
import { CITIES } from '@/data/destinations';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { useRefreshOn } from '@/features/server/sync';
import { friendlyError, supabase } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';
import { Flavor } from '@/theme/flavor';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { enter } from '@/motion/enter';
import { LinearGradient } from 'expo-linear-gradient';

// The demonstration build reads the example communities and plans, never the server.
const useGirlCommunities = DEMO ? useDemoCommunitiesLike : useCommunitiesLike;
const useGirlPlans = DEMO ? useDemoActivities : useServerActivities;

const BOOT_LIMIT = 25_000;
/** What the screen shows: the Match flow, or why IRLY Girl is closed for this account. */
type Screen = MatchState | 'loading' | 'error' | 'suspended' | 'signed_out';

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
function GirlHomeInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const window = useWindowDimensions();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const apiRef = useRef<MatchApi | null>(null);
  const [state, setState] = useState<Screen>('loading');
  const [filters, setFilters] = useState<Filters>({ section: 'for_you' });
  const [deck, setDeck] = useState<Candidate[]>([]);
  const [deckLoading, setDeckLoading] = useState(false);
  const [deckError, setDeckError] = useState<string | null>(null);
  // A refusal from the server while browsing: access is checked again (and the screen closes if it must).
  const [refused, setRefused] = useState(0);
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
  const serverCommunities = useGirlCommunities(cityId, '', true);
  const unread = useUnread();
  // Plans created in IRLY Girl (girls and moms): they show up right here.
  const { activities: girlPlans, loading: plansLoading, error: plansError, refresh: refreshPlans } = useGirlPlans(cityId, { girlOnly: true });
  const [kind, setKind] = useState<string | null>(null);
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
      // IRLY Girl closed meanwhile (access withdrawn): the whole screen says so.
      if (isGirlRefusal(e)) setRefused((r) => r + 1);
      else if (n === deckSeq.current) setDeckError(friendlyError(e instanceof Error ? e.message : 'Could not load profiles'));
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

  // Only the latest check may set the screen (a slow answer for a previous account never lands).
  const bootSeq = useRef(0);
  const boot = useCallback(async () => {
    const n = ++bootSeq.current;
    if (!booted.current) setState('loading');
    try {
      // Never an endless spinner: past BOOT_LIMIT the screen offers Try again
      // (each request has its own 20 s limit, and there are two in a row).
      const s = await withLimit(
        (async (): Promise<Screen> => {
          // IRLY Match is coming soon: IRLY Girl only asks who may enter (checked by the
          // server), never for a Match onboarding or profile, and loads no Match data.
          if (!FEATURES.girlMatch) {
            const a = await readGirlAccess();
            return a === 'open' ? 'ready' : a === 'suspended' ? 'suspended' : a === 'signed_out' ? 'signed_out' : 'ineligible';
          }
          const api = await matchApi();
          apiRef.current = api;
          // With the IRLY server, signed out: no on-device stand-in for a real account.
          if (supabase && api.mode === 'device') return 'signed_out';
          const st = await api.state();
          // Closed: say why (paused after reports, or not a woman's account) before showing anything.
          if (st === 'ineligible' && api.mode === 'server') return (await readGirlAccess().catch(() => 'not_eligible')) === 'suspended' ? 'suspended' : 'ineligible';
          return st;
        })(),
        BOOT_LIMIT,
      );
      if (n !== bootSeq.current) return;
      setState(s);
      if (!FEATURES.girlMatch) {
        if (s === 'ready') booted.current = true;
        return;
      }
      if (s === 'onboarding') router.replace('/girl/onboarding');
      else if (s === 'profile') router.replace('/girl/profile');
      else if (s === 'ready') {
        booted.current = true;
        loadDeck(filtersRef.current, 0);
        loadMatches();
      }
    } catch {
      // A failed re-check on focus keeps the screen that already works.
      if (!booted.current && n === bootSeq.current) setState('error');
    }
  }, [router, loadDeck, loadMatches]);
  // Another account on this device (signed in elsewhere, in another tab): nothing of the
  // previous one stays on screen, and access is checked again for the new one.
  const uid = useAccount()?.userId ?? null;
  const seenUid = useRef(uid);
  useEffect(() => {
    if (seenUid.current === uid) return;
    seenUid.current = uid;
    booted.current = false;
    deckSeq.current += 1;
    setDeck([]);
    setMatches([]);
    setOpen(null);
    setMoment(null);
    boot();
  }, [uid, boot]);
  useEffect(() => {
    if (refused) boot();
  }, [refused, boot]);

  // Re-check on focus: coming back from onboarding or profile edits.
  useFocusEffect(
    useCallback(() => {
      boot();
    }, [boot]),
  );
  // Back to the app after a while (or a profile changed): access may have changed too
  // (paused after reports). Only access is asked; the deck stays as it is.
  useRefreshOn(['people'], () => {
    if (!booted.current) return;
    readGirlAccess()
      .then((a) => {
        if (a !== 'open') boot();
      })
      .catch(() => undefined);
  });

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

  /** Resolves true once the server has recorded the decision. */
  const decide = async (c: Candidate, d: 'like' | 'pass'): Promise<boolean> => {
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
      return true;
    } catch (e) {
      // Put her back so nothing is lost.
      setDeck((list) => [c, ...list]);
      if (isGirlRefusal(e)) boot();
      else toast(friendlyError(e instanceof Error ? e.message : 'Something went wrong. Try again.'), 'x', 'live');
      return false;
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
      if (isGirlRefusal(e)) boot();
      else toast(friendlyError(e instanceof Error ? e.message : 'Could not save'), 'x', 'live');
    }
  };

  const top = deck[0];

  if (state === 'loading' || state === 'onboarding' || state === 'profile') return <GirlLoading />;
  if (state === 'error') return <GirlClosed reason="error" onRetry={boot} />;
  if (state === 'signed_out') return <GirlClosed reason="signed_out" />;
  if (state === 'suspended') return <GirlClosed reason="suspended" />;
  if (state === 'ineligible') return <GirlClosed reason="not_eligible" moms={mode === 'moms'} />;

  return (
    <View style={styles.root}>
      <GirlBackdrop mode={mode} scrollY={scrollY} width={frame.width || window.width} />
      <Animated.ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <GirlHero mode={mode} scrollY={scrollY} onBack={() => safeBack(router, '/')} onProfile={() => router.push(FEATURES.girlMatch ? '/girl/profile' : '/edit-profile')} onMessages={() => router.push('/messages')} unread={unread} />


        {FEATURES.girlMatch && matches.length ? (
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
          <GlassFill variant="bar" radius={26} />
          {/* The chosen side is a bead of plum glass that slides and stretches; pearl label on it. */}
          <Animated.View style={[styles.modeThumb, { width: (modesW - 8) / 2 }, thumb]}>
            <LinearGradient colors={girl.plumGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.thumbRim]} />
          </Animated.View>
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
              <Icon name={m === 'all' ? 'heart' : 'baby'} size={14} color={mode === m ? '#F4B3CF' : girl.ink} />
              <Text variant="label" color={mode === m ? girl.pearl : girl.ink}>
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
                  { icon: 'message', label: 'Messages', onPress: () => router.push('/messages') },
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
        ) : null}

        <View onLayout={(e) => record('women', e)} />
        {FEATURES.girlMatch ? (
          <>
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
                style={[styles.section, { backgroundColor: on ? girl.plum : 'transparent' }]}
              >
                {on ? null : <GlassLayer radius={radius.pill} level="thin" />}
                <Icon name={s.icon} size={14} color={on ? '#F4B3CF' : girl.ink} />
                <Text variant="label" color={on ? girl.pearl : girl.ink}>
                  {s.id === 'new' ? tr('New in {city}', { city: city.name }) : s.label(city.name)}
                </Text>
              </PressableScale>
            );
          })}
          <PressableScale haptic="select" scaleTo={0.96} onPress={() => setShowFilters(true)} accessibilityLabel="Filters" style={styles.section}>
            <GlassLayer radius={radius.pill} level="thin" />
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
            <Animated.View entering={enter.fade(0)} style={[styles.empty, { width, height }]}>
              <GlassLayer radius={32} />
              <ActivityIndicator color={girl.rose} />
              <Text variant="bodyS" color={girl.inkSoft}>
                Finding your kind of people…
              </Text>
            </Animated.View>
          ) : deckError ? (
            <Animated.View entering={enter.rise(0)} style={[styles.empty, { width, height }]}>
              <GlassLayer radius={32} />
              <GIconWell icon="globe" tone="error" />
              <Text variant="titleS" color={girl.ink} align="center">
                {/verify your profile/i.test(deckError) ? tx('Verify your profile to use Match: 3 photos of you and a selfie reviewed by IRLY.') : deckError}
              </Text>
              {/verify your profile/i.test(deckError) ? (
                <GButton label="Verify my profile" onPress={() => router.push('/verify')} />
              ) : (
                <GButton label="Retry" variant="secondary" onPress={() => loadDeck(filters, 0)} />
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={enter.rise(0)} style={[styles.empty, { width, height }]}>
              <GlassLayer radius={32} />
              <GIconWell icon="sparkles" />
              <Text variant="titleM" color={girl.ink} align="center" style={girlType.section}>
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
          </>
        ) : (
          // IRLY Match is coming soon: meanwhile, plans and communities.
          // A plum glass panel: the one dark moment of the page, pearl type, a rose action.
          <Animated.View entering={reduced ? undefined : enter.rise(1)} style={styles.soon}>
            <GlassLayer radius={radius.xl} variant="plum" />
            <View style={styles.soonBadge}>
              <Icon name="sparkles" size={13} color="#F4B3CF" />
              <Text variant="overline" color={girl.pearl}>
                Coming soon
              </Text>
            </View>
            <Text variant="titleM" color={girl.pearl} align="center" style={[girlType.section, { fontSize: 34, lineHeight: 38 }]}>
              IRLY <Text variant="titleM" color="#F4B3CF" style={[girlType.section, girlType.accent, { fontSize: 34, lineHeight: 38 }]}>Match</Text>
            </Text>
            <Text variant="bodyS" color="rgba(255,240,247,0.80)" align="center">
              Meet women who share your interests in {city.name}, matched on what you love. Until then, plan something with girls below.
            </Text>
            <GButton label="Plan something" icon="plus" onPress={() => goTo('plan')} />
          </Animated.View>
        )}

        <View onLayout={(e) => record('plan', e)} />
        <ScrollReveal scrollY={scrollY} style={{ marginTop: space[7], marginHorizontal: space.gutter, borderRadius: radius.xl, overflow: 'hidden', boxShadow: girl.shadowSoft }}>
          <GlassLayer radius={radius.xl} />
          <View style={{ height: 120 }}>
            <Photo tint={GIRL_TINT} visual={{ photo: 'brunchGirl' }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
            <Text variant="titleL" color="#FFFFFF" style={[girlType.section, { position: 'absolute', left: 16, bottom: 14 }]}>
              Plan something with girls
            </Text>
          </View>
          <View style={{ padding: 16 }}>
            <QuickPlan cityId={cityId} types={GIRL_PLANS} palette="girl" />
          </View>
        </ScrollReveal>

        <View onLayout={(e) => record('plans', e)} style={{ marginTop: space[7], gap: 12 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink} style={girlType.section}>
              What women plan together
            </Text>
            <Text variant="bodyS" color={girl.inkSoft}>
              Pick a kind of plan to see the next ones.
            </Text>
          </View>
          <KindRail kinds={GIRL_KINDS} value={kind} onChange={setKind} counts={kindCounts} />
          <Text variant="titleM" color={girl.ink} style={[girlType.section, { paddingHorizontal: space.gutter, marginTop: space[3] }]}>
            {"Girls' plans coming up"}
          </Text>
          <Upcoming activities={girlPlans} kinds={GIRL_KINDS} kind={kind} onKind={setKind} onPlan={() => goTo('plan')} emptyTitle="What if you organised the first meetup?" loading={plansLoading} error={plansError} onRetry={refreshPlans} grid />
        </View>

        <GirlMessages onCommunities={() => goTo('communities')} />

        <View onLayout={(e) => record('communities', e)} />
        <ScrollReveal scrollY={scrollY} style={{ marginTop: space[7], gap: 10 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink} style={girlType.section}>
              IRLY Girl communities
            </Text>
            <Text variant="bodyS" color={girl.inkSoft}>
              Join one and you are in its chat straight away.
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
            {!serverCommunities.data.length && serverCommunities.loading
              ? [0, 1].map((i) => <Skeleton key={i} width={168} height={200} radius={radius.xl} />)
              : null}
            {!serverCommunities.data.length && serverCommunities.error && !serverCommunities.loading ? (
              <View style={[styles.community, styles.newCommunity, { borderStyle: 'solid' }]}>
                <GlassLayer radius={radius.xl} />
                <GIconWell icon="globe" tone="error" size={36} />
                <Text variant="bodyS" color={girl.inkSoft}>
                  Communities could not load.
                </Text>
                <GButton label="Try again" variant="secondary" onPress={serverCommunities.reload} />
              </View>
            ) : null}
            {serverCommunities.data.map((c) => (
              <CommunityTile key={c.id} c={c} away={c.cityId !== cityId} onPress={() => router.push(`/c/${c.id}`)} />
            ))}
            <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push('/girl/new-community')} style={[styles.community, styles.newCommunity]} accessibilityLabel="Create a community">
              <GlassLayer radius={radius.xl} />
              <GIconWell icon="plus" size={36} />
              <Text variant="titleS" color={girl.ink} style={{ marginTop: 'auto' }}>
                {serverCommunities.data.length || serverCommunities.loading || serverCommunities.error ? 'Create a community' : 'Start the first community'}
              </Text>
              <Text variant="caption" color={girl.inkSoft}>
                Women only, with its own chat.
              </Text>
            </PressableScale>
          </ScrollView>
        </ScrollReveal>

        <View onLayout={(e) => record('posts', e)} style={{ marginTop: space[7], gap: 12 }}>
          <View style={{ paddingHorizontal: space.gutter }}>
            <Text variant="titleM" color={girl.ink} style={girlType.section}>
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
        onHide={async () => {
          const c = safetyFor;
          setSafetyFor(null);
          // Confirmed by the server first: on failure decide() puts her back and says why.
          if (c && (await decide(c, 'pass'))) toast('Hidden from your discovery', 'eye', 'brand');
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
            toast(friendlyError(e instanceof Error ? e.message : 'Could not block'), 'x', 'live');
          }
        }}
        onReport={async (category, details) => {
          const c = safetyFor;
          if (!c) return;
          try {
            await apiRef.current!.report(c.userId, category, details);
            toast('Report sent. Thank you for keeping IRLY safe.', 'flag', 'brand');
          } catch (e) {
            toast(friendlyError(e instanceof Error ? e.message : 'Could not send the report'), 'x', 'live');
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
          router.push(s.preset.categoryId ? `/category/${s.preset.categoryId}` : '/discover');
        }}
      />

      <GirlIntro />
    </View>
  );
}

/** Deck actions: the rose lacquer for « Connect », plum when saved, pearl glass for the rest. */
function ActionButton({ icon, label, onPress, big, small, active }: { icon: IconName; label: string; onPress: () => void; big?: boolean; small?: boolean; active?: boolean }) {
  const size = big ? 68 : small ? 46 : 56;
  return (
    <PressableScale
      haptic={big ? 'press' : 'select'}
      scaleTo={0.88}
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={active ? { selected: true } : undefined}
      style={[styles.action, { width: size, height: size, borderRadius: size / 2, boxShadow: big ? girl.glow : active ? girl.shadowPlum : girl.shadowSoft }]}
    >
      {big ? (
        <>
          <LinearGradient colors={girl.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, zIndex: -1 }]} />
          <LinearGradient colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, zIndex: -1 }]} />
        </>
      ) : (
        <GlassFill radius={size / 2} variant={active ? 'plum' : 'chip'} />
      )}
      <Icon name={icon} size={big ? 28 : 20} color={big ? '#FFFFFF' : active ? '#F4B3CF' : girl.ink} fill={active ? '#F4B3CF' : 'none'} />
    </PressableScale>
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

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', marginHorizontal: space.gutter, marginTop: -26, padding: 4, borderRadius: 26, zIndex: 0, boxShadow: girl.shadowSoft },
  modeThumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 22, boxShadow: girl.shadowPlum },
  thumbRim: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,205,226,0.26)' },
  mode: { flex: 1, flexDirection: 'row', gap: 6, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moving: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.gutter, marginTop: space[5], padding: 14, borderRadius: radius.xl, boxShadow: girl.shadowSoft },
  root: { flex: 1, backgroundColor: girl.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: girl.surface, alignItems: 'center', justifyContent: 'center' },
  matchItem: { alignItems: 'center', gap: 6, width: 64 },
  soon: { marginTop: space[5], marginHorizontal: space.gutter, paddingHorizontal: 22, paddingVertical: 24, gap: 10, alignItems: 'center', borderRadius: radius.xl, boxShadow: girl.shadowPlum },
  soonBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,205,226,0.30)', backgroundColor: 'rgba(255,255,255,0.08)' },
  matchRing: { padding: 2, borderRadius: 32, borderWidth: 2, borderColor: girl.rose },
  sections: { paddingHorizontal: space.gutter, gap: 8, marginTop: space[5], marginBottom: space[4] },
  section: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: radius.pill, boxShadow: girl.shadowSoft },
  deck: { alignItems: 'center' },
  deckLayer: { alignItems: 'center' },
  empty: { borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, boxShadow: girl.shadowSoft },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: space[4] },
  action: { alignItems: 'center', justifyContent: 'center', zIndex: 0 },
  community: { width: 168, height: 200, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', boxShadow: girl.shadowSoft },
  newCommunity: { padding: 14, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(185,43,105,0.30)', justifyContent: 'flex-start' },
  plan: { width: 220, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  planPhoto: { height: 120, overflow: 'hidden' },
  communityBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' },
});

/** IRLY Girl: the shared components of IRLY, rendered in the Girl flavor (palette, glass, ambient light). */
export default function GirlHome() {
  return (
    <Flavor value="girl">
      <GirlHomeInner />
    </Flavor>
  );
}
