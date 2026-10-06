import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { DotField } from '@/brand/DotField';
import { useFrame } from '@/components/layout/AppFrame';
import { Badge } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { DESTINATIONS, UPCOMING_DESTINATIONS } from '@/data/destinations';
import type { Destination } from '@/data/types';
import { IrlyStory } from '@/features/onboarding/IrlyStory';
import { useExpand } from '@/features/onboarding/useExpand';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { easing, spring } from '@/motion/tokens';
import { useParallax } from '@/motion/useParallax';
import { useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';

let introPlayed = false;

export default function Welcome() {
  const router = useRouter();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const setDestination = useStore((s) => s.setDestination);
  // intro (the logo) → story (what IRLY is) → choose (where you are going)
  const [phase, setPhase] = useState<'intro' | 'story' | 'choose'>(introPlayed ? 'choose' : 'intro');
  const { overlay, expand, reset } = useExpand();
  const parallax = useParallax(phase === 'choose');

  const H = frame.height;
  const lift = -(H / 2 - insets.top - 74);

  // Intro choreography
  const glow = useSharedValue(introPlayed ? 1 : 0);
  const word = useSharedValue(introPlayed ? 1 : 0);
  const tagline = useSharedValue(0);
  const group = useSharedValue(introPlayed ? 1 : 0);
  // The field dims while the story tells what IRLY is.
  const dim = useSharedValue(0);

  const toStory = () => {
    word.set(withTiming(0, { duration: 260 }));
    tagline.set(withTiming(0, { duration: 200 }));
    dim.set(withTiming(1, { duration: 500 }));
    setPhase('story');
  };
  const toChoose = () => {
    introPlayed = true;
    dim.set(withTiming(0, { duration: 500 }));
    word.set(withSpring(1, spring.smooth));
    group.set(withSpring(1, { duration: 760, dampingRatio: 0.92 }));
    setPhase('choose');
  };

  useEffect(() => {
    if (introPlayed) return;
    glow.set(withTiming(1, { duration: 1200, easing: easing.emphasized }));
    word.set(withDelay(320, withSpring(1, spring.smooth)));
    tagline.set(withDelay(700, withTiming(1, { duration: 600, easing: easing.standard })));
    const t1 = setTimeout(() => haptic('tap'), 360);
    const t2 = setTimeout(toStory, 2150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glow, word, tagline, group]);

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: group.value * lift }, { scale: 1 - group.value * 0.42 }],
  }));
  // The field dims once the destination cards arrive, so they stay readable.
  const fieldStyle = useAnimatedStyle(() => ({ opacity: glow.value * (1 - group.value * 0.55) * (1 - dim.value * 0.6) }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value }));

  const choose = (dest: Destination, ref: RefObject<View | null>) => {
    haptic('press');
    setDestination(dest.id);
    expand(ref, { photo: dest.photo }, dest.light, () => {
      router.push(dest.id === 'emirates' ? '/onboarding/emirates' : '/onboarding/you');
    });
  };

  const skip = () => {
    if (phase === 'intro') toStory();
  };

  return (
    <View style={[styles.root, { backgroundColor: '#000000' }]}>
      <LinearGradient
        colors={['#0D0D0D', '#000000', '#000000']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* The halftone field: light drifting behind a screen of dots */}
      <Animated.View style={[StyleSheet.absoluteFill, fieldStyle]} pointerEvents="none">
        <DotField />
      </Animated.View>

      {/* Logo group: centred during the intro, then lifts into place */}
      <Animated.View style={[styles.center, groupStyle]} pointerEvents="none">
        <Animated.View style={wordStyle}>
          <IrlyWordmark size={64} color="#FFFFFF" accentColor="#FFFFFF" animated />
        </Animated.View>
        <Animated.View style={[{ marginTop: 14 }, taglineStyle]}>
          <Text variant="label" color="rgba(255,255,255,0.62)" style={{ letterSpacing: 2.2, textAlign: 'center', paddingHorizontal: space.gutter, maxWidth: frame.width }}>
            CONNECT · RELOCATE · BELONG
          </Text>
        </Animated.View>
      </Animated.View>

      {phase === 'intro' ? (
        <PressableScale haptic={false} scaleTo={1} onPress={skip} style={StyleSheet.absoluteFill} accessibilityLabel="Skip intro" />
      ) : phase === 'story' ? (
        <IrlyStory onDone={toChoose} />
      ) : (
        <View style={[styles.choose, { paddingTop: insets.top + 132, paddingBottom: insets.bottom + space[5] }]}>
          <Animated.View entering={enter.rise(0, 120)} style={{ paddingHorizontal: space.gutter }}>
            <Text variant="displayL" tone="onDark">
              Where are you going?
            </Text>
            <Text variant="body" color="rgba(255,255,255,0.6)" style={{ marginTop: 6 }}>
              Pick your IRLY. You can switch destination anytime.
            </Text>
          </Animated.View>
          <View style={styles.cards}>
            {(['emirates', 'bali'] as const).map((id, i) => (
              <Animated.View key={id} entering={enter.rise(i + 1, 180)} style={{ flex: 1 }}>
                <DestinationCard dest={DESTINATIONS[id]} index={i} parallax={parallax} onChoose={choose} />
              </Animated.View>
            ))}
          </View>
          <Animated.View entering={FadeIn.delay(700).duration(500)} style={styles.soon}>
            <Icon name="globe" size={14} color="rgba(255,255,255,0.5)" />
            <Text variant="bodyS" color="rgba(255,255,255,0.5)">
              Next: {UPCOMING_DESTINATIONS.map((d) => DESTINATIONS[d].shortName).join(' · ')}
            </Text>
          </Animated.View>
        </View>
      )}
      {overlay}
    </View>
  );
}

function DestinationCard({
  dest,
  index,
  parallax,
  onChoose,
}: {
  dest: Destination;
  index: number;
  parallax: { x: SharedValue<number>; y: SharedValue<number> };
  onChoose: (d: Destination, ref: RefObject<View | null>) => void;
}) {
  const ref = useRef<View>(null);
  const dir = index === 0 ? 1 : -1;
  const layer = useAnimatedStyle(() => ({
    transform: [
      { translateX: parallax.x.value * 12 * dir },
      { translateY: parallax.y.value * 9 },
      { scale: 1.14 },
    ],
  }));
  const isEmirates = dest.id === 'emirates';
  return (
    <PressableScale
      ref={ref}
      haptic={false}
      onPress={() => onChoose(dest, ref)}
      style={[styles.card, { boxShadow: '0px 20px 50px rgba(0,0,0,0.5)' }]}
      accessibilityLabel={`${dest.name}. ${dest.tagline}`}
    >
      <Animated.View style={[StyleSheet.absoluteFill, layer]}>
        <Photo visual={{ photo: dest.photo }} light={dest.light} scrim="strong" width={1000} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.cardTop}>
        <Glass dark style={styles.flag}>
          <Text style={{ fontSize: 20 }}>{isEmirates ? dest.flag : '🌴'}</Text>
        </Glass>
        <Badge kind="live" onDark label={isEmirates ? '7 emirates · live' : 'Island-wide · live'} />
      </View>
      <Glass dark style={styles.cardPanel} intensity={30}>
        <View style={{ flex: 1 }}>
          <Text variant="displayM" tone="onDark">
            {dest.name}
          </Text>
          <Text variant="bodyS" color="rgba(255,255,255,0.72)" numberOfLines={1}>
            {dest.tagline}
          </Text>
        </View>
        <View style={styles.arrow}>
          <Icon name="arrowRight" size={20} color="#000000" strokeWidth={2.4} />
        </View>
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  choose: { flex: 1 },
  cards: { flex: 1, gap: 14, paddingHorizontal: space.gutter, paddingTop: space[6], paddingBottom: space[5] },
  card: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  flag: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardPanel: {
    margin: 10,
    padding: 16,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  arrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  soon: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
