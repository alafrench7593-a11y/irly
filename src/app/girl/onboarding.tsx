import { a11y, t as tx } from '@/i18n';
import { Redirect, useRouter } from 'expo-router';
import { FEATURES } from '@/lib/features';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';
import { GirlGate, isGirlRefusal, safeBack } from '@/features/girl/access';
import { matchApi } from '@/features/girl/api';
import { GirlMark } from '@/features/girl/GirlMark';
import { girl, GIRL_TINT, girlType } from '@/features/girl/theme';
import { GButton } from '@/features/girl/ui';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { friendlyError } from '@/lib/supabase';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { Flavor } from '@/theme/flavor';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';

type Slide = { photo: PhotoKey; title: string; body: string; points?: { icon: IconName; text: string }[]; flow?: string[] };

const SLIDES: Slide[] = [
  {
    photo: 'poolGirl',
    title: 'Meet people who get you.',
    // {city}: the member's destination (filled in when shown).
    body: 'Discover girls in {city} who share your interests, your personality and your lifestyle.',
  },
  {
    photo: 'padelGirl',
    title: 'Not just another swipe.',
    body: 'IRLY Match is built for real friendships. Every match is a reason to do something together, in real life.',
  },
  {
    photo: 'drinksGirl',
    title: 'Find your kind of people.',
    body: 'We match you on what actually makes a friendship work:',
    points: [
      { icon: 'heart', text: 'Interests, sports and activities' },
      { icon: 'sun', text: 'Lifestyle and personality' },
      { icon: 'languages', text: 'Languages and travel' },
      { icon: 'clock', text: 'When you are free, where you like to go' },
      { icon: 'heartHandshake', text: 'What you are looking for, your communities' },
    ],
  },
  {
    photo: 'yachtGirl',
    title: 'From match to real life.',
    body: 'A match can turn into coffee, brunch, padel, the gym, the beach, shopping, dinner, a trip, an event.',
    flow: ['Match', 'Chat', 'Activity', 'Meet IRL'],
  },
  {
    photo: 'spaGirl',
    title: 'Your privacy matters.',
    body: 'IRLY Girl is for women only, checked by our servers, not just the app.',
    points: [
      { icon: 'pin', text: 'Your exact location is never shown, only your area' },
      { icon: 'lock', text: 'You choose what your profile shows' },
      { icon: 'shield', text: 'Block, report, hide or unmatch anytime' },
    ],
  },
];

/**
 * IRLY Girl onboarding, required once before IRLY Match. Five slides, the
 * photo drifting slower than the text (parallax), progress dots that
 * stretch for the current slide. Completion is stored server-side.
 */
/** IRLY Match is coming soon: its onboarding and profile wait, IRLY Girl opens instead. */
function GirlOnboardingScreenGateInner() {
  return FEATURES.girlMatch ? <GirlOnboardingScreen /> : <Redirect href="/girl" />;
}

function GirlOnboardingScreen() {
  return (
    <GirlGate>
      <GirlOnboarding />
    </GirlGate>
  );
}

function GirlOnboarding() {
  const router = useRouter();
  const cityName = CITIES[useCityId()]?.name ?? 'Dubai';
  const insets = useSafeAreaInsets();
  const frame = useFrame();
  const window = useWindowDimensions();
  const width = frame.width || window.width;
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  const last = index === SLIDES.length - 1;

  const next = async () => {
    if (!last) {
      haptic('select');
      scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
      setIndex(index + 1);
      return;
    }
    setSaving(true);
    try {
      const api = await matchApi();
      await api.completeOnboarding();
      haptic('success');
      router.replace('/girl/profile');
    } catch (e) {
      // Closed meanwhile: IRLY Girl says why (the gate re-checks on the way).
      if (isGirlRefusal(e)) router.replace('/girl');
      else toast(friendlyError(e instanceof Error ? e.message : 'Could not continue. Try again.'), 'x', 'live');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: girl.bg }]}>
      <Ambient variant="hero" />
      <Animated.ScrollView
        ref={scrollRef as never}
        style={{ flex: 1 }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {SLIDES.map((s, i) => (
          <SlideView key={s.title} slide={s} i={i} x={x} width={width} top={insets.top} city={cityName} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.close, { top: insets.top + 10 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={() => safeBack(router, '/')} accessibilityLabel="Close" style={styles.closeBtn}>
          <Glass dark style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
          {/* Its own layer: on the web a bare icon was painted under the glass. */}
          <View style={styles.closeIcon}>
            <Icon name="x" size={18} color="#FFFFFF" />
          </View>
        </PressableScale>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots} accessibilityLabel={a11y(tx('Step {n} of {total}', { n: index + 1, total: SLIDES.length }))}>
          {SLIDES.map((s, i) => (
            <Dot key={s.title} i={i} x={x} width={width} />
          ))}
        </View>
        <GButton label={last ? 'Create my IRLY Match profile' : 'Next'} icon={last ? 'sparkles' : undefined} onPress={next} loading={saving} />
      </View>
    </View>
  );
}

function SlideView({ slide, i, x, width, top, city }: { slide: Slide; i: number; x: SharedValue<number>; width: number; top: number; city: string }) {
  const photo = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, [(i - 1) * width, i * width, (i + 1) * width], [-width * 0.35, 0, width * 0.35], Extrapolation.CLAMP) }],
  }));
  const text = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [(i - 0.6) * width, i * width, (i + 0.6) * width], [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(x.value, [(i - 1) * width, i * width, (i + 1) * width], [24, 0, 24], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={{ width, flex: 1 }}>
      <View style={styles.photoWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, photo]}>
          <Photo tint={GIRL_TINT} visual={{ photo: slide.photo }} light="dubai" scrim="soft" style={StyleSheet.absoluteFill} width={1000} />
        </Animated.View>
        <View style={[styles.brand, { top: top + 18 }]}>
          <GirlMark variant="header" size={16} onDark />
        </View>
      </View>
      <Animated.View style={[styles.card, text]}>
        <GlassLayer radius={radius.xxl} level="thick" />
        <Text variant="overline" raw color={girl.rose} style={styles.step}>
          {`${String(i + 1).padStart(2, '0')} / ${String(SLIDES.length).padStart(2, '0')}`}
        </Text>
        <Text variant="displayM" color={girl.ink} style={girlType.display}>
          {slide.title}
        </Text>
        <Text variant="body" color={girl.inkSoft}>
          {tx(slide.body, { city })}
        </Text>
        {slide.points ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            {slide.points.map((p, k) => (
              <Point key={p.text} icon={p.icon} text={p.text} k={k} i={i} x={x} width={width} />
            ))}
          </View>
        ) : null}
        {slide.flow ? (
          <View style={styles.flow}>
            {slide.flow.map((f, k) => (
              <View key={f} style={styles.flowItem}>
                <View style={[styles.flowPill, k === slide.flow!.length - 1 ? { backgroundColor: girl.rose } : null]}>
                  <Text variant="caption" color={k === slide.flow!.length - 1 ? '#FFFFFF' : girl.ink}>
                    {f}
                  </Text>
                </View>
                {k < slide.flow!.length - 1 ? <Icon name="arrowRight" size={13} color={girl.inkFaint} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** A point of a slide: the rows arrive one after the other as the slide comes in. */
function Point({ icon, text, k, i, x, width }: { icon: IconName; text: string; k: number; i: number; x: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(x.value / width - i));
    const lag = Math.min(1, d * (1 + k * 0.45));
    return { opacity: 1 - lag, transform: [{ translateX: lag * (18 + k * 6) }] };
  });
  return (
    <Animated.View style={[styles.point, style]}>
      <View style={styles.pointIcon}>
        <Icon name={icon} size={15} color={girl.rose} />
      </View>
      <Text variant="bodyS" color={girl.ink} style={{ flex: 1 }}>
        {text}
      </Text>
    </Animated.View>
  );
}

function Dot({ i, x, width }: { i: number; x: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(x.value / width - i));
    return { width: 8 + (1 - d) * 18, opacity: 0.35 + (1 - d) * 0.65 };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  photoWrap: { height: '50%', overflow: 'hidden', borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  brand: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  step: { letterSpacing: 2, fontVariant: ['tabular-nums'] },
  card: { marginTop: -40, marginHorizontal: space.gutter, padding: 22, gap: 10, borderRadius: radius.xxl, boxShadow: girl.shadow },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: girl.blush, alignItems: 'center', justifyContent: 'center' },
  flow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  flowItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowPill: { paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: girl.blush },
  close: { position: 'absolute', left: space.gutter },
  closeIcon: { zIndex: 1 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 16 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: girl.rose },
});

/** IRLY Girl: the shared components of IRLY, rendered in the Girl flavor (palette, glass, ambient light). */
export default function GirlOnboardingScreenGate() {
  return (
    <Flavor value="girl">
      <GirlOnboardingScreenGateInner />
    </Flavor>
  );
}
