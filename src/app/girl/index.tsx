import { useFocusEffect, useRouter } from 'expo-router';
import { t as tx, useT } from '@/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useSharedValue } from 'react-native-reanimated';
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
import { MomsView } from '@/features/girl/MomsView';
import { GIRL_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useCommunitiesLike } from '@/features/bali/data';
import { CITIES } from '@/data/destinations';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
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

const COMMUNITIES: { name: string; photo: 'padel' | 'brunch' | 'founders' | 'gym' | 'beachSunset' | 'dubaiNight' | 'coffeeBar' | 'baliTemple' | 'dubai' }[] = [
  { name: 'Dubai Girls', photo: 'dubai' },
  { name: 'Girls Padel Dubai', photo: 'padel' },
  { name: 'Dubai Brunch Girls', photo: 'brunch' },
  { name: 'Women Entrepreneurs Dubai', photo: 'founders' },
  { name: 'Dubai Fitness Girls', photo: 'gym' },
  { name: 'Girls Who Travel', photo: 'beachSunset' },
  { name: 'French Girls Dubai', photo: 'coffeeBar' },
  { name: 'Dubai Beauty', photo: 'dubaiNight' },
  { name: 'Bali Girls', photo: 'baliTemple' },
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
  const [mode, setMode] = useState<'all' | 'moms'>('all');
  const serverCommunities = useCommunitiesLike(cityId, '', true);
  const fling = useSharedValue(0);
  const tr = useT();

  const width = Math.min((frame.width || window.width) - space.gutter * 2, 420);
  const height = Math.min(width * 1.32, (frame.height || window.height) * 0.56);

  const loadDeck = useCallback(async (f: Filters, from: number) => {
    const api = apiRef.current;
    if (!api) return;
    setDeckLoading(true);
    setDeckError(null);
    try {
      const page = await api.discover(f, from);
      setDeck((d) => (from === 0 ? page : [...d, ...page.filter((p) => !d.some((x) => x.userId === p.userId))]));
      setOffset(from + page.length);
      setExhausted(page.length < PAGE_SIZE);
    } catch (e) {
      setDeckError(e instanceof Error ? e.message : 'Could not load profiles');
    } finally {
      setDeckLoading(false);
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

  const boot = useCallback(async () => {
    setState('loading');
    try {
      const api = await matchApi();
      apiRef.current = api;
      const s = await api.state();
      setState(s);
      if (s === 'onboarding') router.replace('/girl/onboarding');
      else if (s === 'profile') router.replace('/girl/profile');
      else if (s === 'ready') {
        loadDeck({ section: 'for_you' }, 0);
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
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale haptic="tap" scaleTo={0.9} onPress={() => router.back()} accessibilityLabel="Back to IRLY" style={styles.round}>
            <Icon name="chevronLeft" size={20} color={girl.ink} />
          </PressableScale>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleM" color={girl.ink} style={{ letterSpacing: 2 }}>
              IRLY <Text variant="titleM" color={girl.rose} style={{ letterSpacing: 2 }}>GIRL</Text>
            </Text>
            <Text variant="caption" color={girl.inkSoft}>
              Find girls you actually get along with
            </Text>
          </View>
          <PressableScale haptic="select" scaleTo={0.9} onPress={() => router.push('/girl/profile')} accessibilityLabel="Edit my IRLY Match profile" style={styles.round}>
            <Icon name="user" size={18} color={girl.ink} />
          </PressableScale>
        </View>

        {matches.length ? (
          <View style={{ marginTop: space[5], gap: 10 }}>
            <Text variant="overline" color={girl.inkSoft} style={{ paddingHorizontal: space.gutter }}>
              Your matches · {matches.length}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 14 }}>
              {matches.map((m) => (
                <PressableScale key={m.matchId} haptic="select" scaleTo={0.94} onPress={() => router.push(`/messages/${m.conversationId}`)} style={styles.matchItem} accessibilityLabel={`Chat with ${m.firstName}`}>
                  <View style={styles.matchRing}>
                    <Avatar name={m.firstName} hue={m.hue} size={56} photo={m.photoUrls[0]} />
                  </View>
                  <Text variant="caption" color={girl.ink} numberOfLines={1}>
                    {m.firstName}
                  </Text>
                </PressableScale>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.modes}>
          {(['all', 'moms'] as const).map((m) => (
            <PressableScale
              key={m}
              haptic="select"
              scaleTo={0.96}
              onPress={() => setMode(m)}
              style={[styles.mode, mode === m ? { backgroundColor: girl.ink } : null]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              accessibilityLabel={m === 'all' ? 'All girls' : 'Moms'}
            >
              <Text variant="label" color={mode === m ? '#FFFFFF' : girl.ink}>
                {m === 'all' ? 'All girls' : 'Moms'}
              </Text>
            </PressableScale>
          ))}
        </View>

        {mode === 'moms' ? (
          <MomsView cityId={cityId} />
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

        <View style={{ marginTop: space[7], marginHorizontal: space.gutter, padding: 16, gap: 10, borderRadius: radius.xl, backgroundColor: girl.surface }}>
          <Text variant="titleM" color={girl.ink}>
            Plan something with girls
          </Text>
          <QuickPlan cityId={cityId} types={GIRL_PLANS} palette="girl" />
        </View>

        <View style={{ marginTop: space[7], gap: 10 }}>
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
                style={[styles.community, { backgroundColor: girl.blush }]}
                accessibilityLabel={c.name}
              >
                <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
                  <Icon name={c.member ? 'check' : 'users'} size={18} color={girl.rose} />
                  <Text variant="titleS" color={girl.ink} numberOfLines={2}>
                    {c.name}
                  </Text>
                </View>
              </PressableScale>
            ))}
            {(serverCommunities.data.length ? [] : COMMUNITIES).map((c) => (
              <PressableScale key={c.name} haptic="select" scaleTo={0.96} onPress={() => router.push('/category/girl')} style={styles.community} accessibilityLabel={c.name}>
                <Photo visual={{ photo: c.photo }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={400} />
                <Text variant="titleS" color="#FFFFFF" numberOfLines={2} style={{ padding: 12 }}>
                  {c.name}
                </Text>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
          </>
        )}
      </ScrollView>

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
  modes: { flexDirection: 'row', alignSelf: 'center', marginTop: space[5], padding: 4, gap: 4, borderRadius: 22, backgroundColor: girl.surface },
  mode: { paddingHorizontal: 18, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
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
  community: { width: 150, height: 120, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
});
