import { useFocusEffect, useRouter } from 'expo-router';
import { t as tx, useT } from '@/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeOut, LinearTransition, useAnimatedScrollHandler, useReducedMotion, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { GirlClosed, GirlLoading, isGirlRefusal, readGirlAccess, safeBack, withLimit } from '@/features/girl/access';
import { FEATURES } from '@/lib/features';
import { useAccount } from '@/features/auth/account';
import { openCreate } from '@/features/create/createStore';
import { matchApi, PAGE_SIZE, type MatchApi } from '@/features/girl/api';
import { CandidateTile } from '@/features/girl/CandidateCard';
import { GRID_GAP, gridColumns, tileWidth } from '@/features/match/grid';
import { MatchMoment } from '@/features/girl/MatchMoment';
import { FiltersSheet, ProfileSheet, SafetySheet } from '@/features/girl/Sheets';
import type { Suggestion } from '@/features/girl/suggest';
import { girl, girlType } from '@/features/girl/theme';
import type { Candidate, Filters, MatchResult, MatchState, MatchSummary, Section } from '@/features/girl/types';
import { GButton, GIconWell, GlassFill } from '@/features/girl/ui';
import { GirlBackdrop } from '@/features/girl/GirlHero';
import { GirlHeaderMark } from '@/features/girl/GirlMark';
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
 * IRLY Girl Match (/girl/match, from the IRLY Match card of the Home in
 * IRLY Girl). Women only (checked server-side), onboarding and a
 * Match profile first, then discovery: sections, filters, a grid of
 * profiles (two side by side on a phone of 360 pt or more, one below, more
 * on a tablet) with Not now / Connect on each, your matches on top. A match opens its private chat and the
 * question that matters: what will you do together?
 */
function GirlMatchInner() {
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
  const tr = useT();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const reduced = useReducedMotion();

  const screenW = frame.width || window.width;
  const columns = gridColumns(screenW);
  const inner = Math.min(screenW, 1120) - space.gutter * 2;
  const tileW = tileWidth(inner, columns);

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

  if (state === 'loading' || state === 'onboarding' || state === 'profile') return <GirlLoading />;
  if (state === 'error') return <GirlClosed reason="error" onRetry={boot} />;
  if (state === 'signed_out') return <GirlClosed reason="signed_out" />;
  if (state === 'suspended') return <GirlClosed reason="suspended" />;
  if (state === 'ineligible') return <GirlClosed reason="not_eligible" />;

  return (
    <View style={styles.root}>
      <GirlBackdrop mode="all" scrollY={scrollY} width={frame.width || window.width} />
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale haptic="tap" scaleTo={0.9} onPress={() => safeBack(router, '/')} accessibilityLabel="Back" style={styles.round}>
            <GlassFill radius={20} variant="chip" />
            <Icon name="chevronLeft" size={20} color={girl.ink} />
          </PressableScale>
          <GirlHeaderMark size={16} />
          <Text variant="titleM" color={girl.ink} style={[girlType.section, { fontSize: 26, lineHeight: 30 }]}>
            Match
          </Text>
        </View>

        {FEATURES.girlMatch && matches.length ? (
          <View style={{ marginTop: space[5], gap: 10 }}>
            <Text variant="overline" color={girl.inkSoft} style={{ paddingHorizontal: space.gutter }}>
              Your matches · {matches.length}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 14 }}>
              {matches.map((m) => (
                <PressableScale key={m.matchId} haptic="select" scaleTo={0.94} onPress={() => router.push(`/messages/${m.conversationId}`)} style={styles.matchItem} accessibilityLabel={tx('Chat with {name}', { name: m.firstName })}>
                  <View style={styles.matchRing}>
                    <Avatar name={m.firstName} hue={m.hue} size={56} photo={m.photoUrls[0]} userId={m.userId} />
                  </View>
                  <Text variant="caption" color={girl.ink} numberOfLines={1} raw>
                    {m.firstName}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

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
                <Icon name={s.icon} size={14} color={on ? '#C9B6FF' : girl.ink} />
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

        <View style={[styles.grid, { width: inner }]}>
          {deck.length ? (
            deck.map((c, i) => (
              <Animated.View
                key={c.userId}
                entering={reduced ? undefined : enter.rise(Math.min(i % PAGE_SIZE, 6))}
                exiting={reduced ? undefined : FadeOut.duration(160)}
                layout={reduced ? undefined : LinearTransition.springify(420)}
                style={{ width: tileW }}
              >
                <CandidateTile candidate={c} width={tileW} onOpen={() => setOpen(c)} onPass={() => decide(c, 'pass')} onConnect={() => decide(c, 'like')} />
              </Animated.View>
            ))
          ) : deckLoading ? (
            <View style={[styles.grid, { width: inner }]} accessible accessibilityLabel={tx('Finding your kind of people…')}>
              {Array.from({ length: columns * 2 }, (_, i) => (
                <Animated.View key={i} entering={enter.fade(i)} style={[styles.skeleton, { width: tileW, height: Math.round(tileW * 1.25) + 128 }]} />
              ))}
            </View>
          ) : deckError ? (
            <Animated.View entering={enter.rise(0)} style={[styles.empty, { width: inner }]}>
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
            <Animated.View entering={enter.rise(0)} style={[styles.empty, { width: inner }]}>
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

        {deck.length && !exhausted ? (
          <View style={styles.more}>
            {deckLoading ? <ActivityIndicator color={girl.rose} /> : deckError ? <GButton label="Retry" variant="secondary" onPress={() => loadDeck(filters, offset)} /> : <GButton label="Show more" variant="secondary" onPress={() => loadDeck(filters, offset)} />}
          </View>
        ) : null}
          </>
        ) : (
          // IRLY Match is coming soon: meanwhile, plans and communities.
          // A plum glass panel: the one dark moment of the page, pearl type, a rose action.
          <Animated.View entering={reduced ? undefined : enter.rise(1)} style={styles.soon}>
            <GlassLayer radius={radius.xl} variant="plum" />
            <View style={styles.soonBadge}>
              <Icon name="sparkles" size={13} color="#C9B6FF" />
              <Text variant="overline" color={girl.pearl}>
                Coming soon
              </Text>
            </View>
            <Text variant="titleM" color={girl.pearl} align="center" style={[girlType.section, { fontSize: 34, lineHeight: 38 }]}>
              IRLY <Text variant="titleM" color="#C9B6FF" style={[girlType.section, girlType.accent, { fontSize: 34, lineHeight: 38 }]}>Match</Text>
            </Text>
            <Text variant="bodyS" color="rgba(240,236,255,0.80)" align="center">
              {tx('Meet women who share your interests in {city}, matched on what you love. Until then, plan something with girls.', { city: city.name })}
            </Text>
            <GButton label="Plan something" icon="plus" onPress={() => openCreate(null)} />
          </Animated.View>
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
          // Without a category, the plans of IRLY Girl on the Home.
          if (s.preset.categoryId) router.push(`/category/${s.preset.categoryId}`);
          else router.dismissTo('/(tabs)');
        }}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', marginHorizontal: space.gutter, marginTop: -26, padding: 4, borderRadius: 26, zIndex: 0, boxShadow: girl.shadowSoft },
  modeThumb: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 22, boxShadow: girl.shadowPlum },
  thumbRim: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(201,182,255,0.26)' },
  mode: { flex: 1, flexDirection: 'row', gap: 6, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  moving: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.gutter, marginTop: space[5], padding: 14, borderRadius: radius.xl, boxShadow: girl.shadowSoft },
  root: { flex: 1, backgroundColor: girl.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: girl.surface, alignItems: 'center', justifyContent: 'center' },
  matchItem: { alignItems: 'center', gap: 6, width: 64 },
  soon: { marginTop: space[5], marginHorizontal: space.gutter, paddingHorizontal: 22, paddingVertical: 24, gap: 10, alignItems: 'center', borderRadius: radius.xl, boxShadow: girl.shadowPlum },
  soonBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 26, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(201,182,255,0.30)', backgroundColor: 'rgba(255,255,255,0.08)' },
  matchRing: { padding: 2, borderRadius: 32, borderWidth: 2, borderColor: girl.rose },
  sections: { paddingHorizontal: space.gutter, gap: 8, marginTop: space[5], marginBottom: space[4] },
  section: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 13, borderRadius: radius.pill, boxShadow: girl.shadowSoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, alignSelf: 'center' },
  skeleton: { borderRadius: 24, backgroundColor: girl.blush, opacity: 0.7 },
  more: { alignItems: 'center', marginTop: space[5], minHeight: 48, justifyContent: 'center' },
  empty: { minHeight: 320, borderRadius: 32, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, boxShadow: girl.shadowSoft },
  community: { width: 168, height: 200, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', boxShadow: girl.shadowSoft },
  newCommunity: { padding: 14, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(106,59,238,0.30)', justifyContent: 'flex-start' },
  plan: { width: 220, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  planPhoto: { height: 120, overflow: 'hidden' },
  communityBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(251,250,255,0.92)', alignItems: 'center', justifyContent: 'center' },
});

/** IRLY Girl Match: the shared components of IRLY, rendered in the Girl flavor (palette, glass, ambient light). */
export default function GirlMatch() {
  return (
    <Flavor value="girl">
      <GirlMatchInner />
    </Flavor>
  );
}
