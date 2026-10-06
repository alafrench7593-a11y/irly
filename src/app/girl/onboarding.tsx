import { useRouter } from 'expo-router';
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
import type { PhotoKey } from '@/data/photos';
import { matchApi } from '@/features/girl/api';
import { girl } from '@/features/girl/theme';
import { GButton } from '@/features/girl/ui';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';

type Slide = { photo: PhotoKey; title: string; body: string; points?: { icon: IconName; text: string }[]; flow?: string[] };

const SLIDES: Slide[] = [
  {
    photo: 'girlFriends',
    title: 'Meet people who get you.',
    body: 'Discover girls in Dubai who share your interests, your personality and your lifestyle.',
  },
  {
    photo: 'girlFitness',
    title: 'Not just another swipe.',
    body: 'IRLY Match is built for real friendships. Every match is a reason to do something together, in real life.',
  },
  {
    photo: 'girlCoffee',
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
    photo: 'girlSunset',
    title: 'From match to real life.',
    body: 'A match can turn into coffee, brunch, padel, the gym, the beach, shopping, dinner, a trip, an event.',
    flow: ['Match', 'Chat', 'Activity', 'Meet IRL'],
  },
  {
    photo: 'girlTravel',
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
export default function GirlOnboarding() {
  const router = useRouter();
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
      toast(e instanceof Error ? e.message : 'Could not continue. Try again.', 'x', 'live');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: girl.bg }]}>
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
          <SlideView key={s.title} slide={s} i={i} x={x} width={width} top={insets.top} />
        ))}
      </Animated.ScrollView>

      <View style={[styles.close, { top: insets.top + 10 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={() => router.back()} accessibilityLabel="Close" style={styles.closeBtn}>
          <Glass dark style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} />
          <Icon name="x" size={18} color="#FFFFFF" />
        </PressableScale>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <Dot key={s.title} i={i} x={x} width={width} />
          ))}
        </View>
        <GButton label={last ? 'Create my IRLY Match profile' : 'Next'} icon={last ? 'sparkles' : undefined} onPress={next} loading={saving} />
      </View>
    </View>
  );
}

function SlideView({ slide, i, x, width, top }: { slide: Slide; i: number; x: SharedValue<number>; width: number; top: number }) {
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
          <Photo visual={{ photo: slide.photo }} light="dubai" scrim="soft" style={StyleSheet.absoluteFill} width={1000} />
        </Animated.View>
        <View style={[styles.brand, { top: top + 18 }]}>
          <Text variant="overline" color="#FFFFFF" style={{ letterSpacing: 3 }}>
            IRLY GIRL
          </Text>
        </View>
      </View>
      <Animated.View style={[styles.card, text]}>
        <Text variant="displayM" color={girl.ink}>
          {slide.title}
        </Text>
        <Text variant="body" color={girl.inkSoft}>
          {slide.body}
        </Text>
        {slide.points ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            {slide.points.map((p) => (
              <View key={p.text} style={styles.point}>
                <View style={styles.pointIcon}>
                  <Icon name={p.icon} size={15} color={girl.rose} />
                </View>
                <Text variant="bodyS" color={girl.ink} style={{ flex: 1 }}>
                  {p.text}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        {slide.flow ? (
          <View style={styles.flow}>
            {slide.flow.map((f, k) => (
              <View key={f} style={styles.flowItem}>
                <View style={[styles.flowPill, k === slide.flow!.length - 1 ? { backgroundColor: girl.ink } : null]}>
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
  card: { marginTop: -40, marginHorizontal: space.gutter, padding: 22, gap: 10, borderRadius: radius.xxl, backgroundColor: girl.surface, boxShadow: girl.shadow },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: girl.blush, alignItems: 'center', justifyContent: 'center' },
  flow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  flowItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flowPill: { paddingHorizontal: 10, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: girl.blush },
  close: { position: 'absolute', left: space.gutter },
  closeBtn: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.gutter, paddingTop: 12, gap: 16 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4, backgroundColor: girl.ink },
});
