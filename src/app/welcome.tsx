import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { IrlyMark } from '@/brand/IrlyMark';
import { useFrame } from '@/components/layout/AppFrame';
import { Badge } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { DESTINATIONS, UPCOMING_DESTINATIONS } from '@/data/destinations';
import type { Destination } from '@/data/types';
import { useExpand } from '@/features/onboarding/useExpand';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { easing, spring } from '@/motion/tokens';
import { useParallax } from '@/motion/useParallax';
import { useStore } from '@/state/store';
import { palettes, radius, space } from '@/theme/tokens';

let introPlayed = false;

const BRAND = palettes.night.brand;

export default function Welcome() {
  const router = useRouter();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const setDestination = useStore((s) => s.setDestination);
  const [phase, setPhase] = useState<'intro' | 'choose'>(introPlayed ? 'choose' : 'intro');
  const { overlay, expand, reset } = useExpand();
  const parallax = useParallax(phase === 'choose');

  const H = frame.height;
  const lift = -(H / 2 - insets.top - 74);

  // Intro choreography
  const glow = useSharedValue(0);
  const word = useSharedValue(0);
  const tagline = useSharedValue(0);
  const sweep = useSharedValue(0);
  const group = useSharedValue(introPlayed ? 1 : 0);

  useEffect(() => {
    if (introPlayed) return;
    glow.set(withSequence(withTiming(1, { duration: 900, easing: easing.emphasized }), withTiming(0.65, { duration: 900 })));
    word.set(withDelay(320, withSpring(1, spring.smooth)));
    sweep.set(withDelay(520, withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.cubic) })));
    tagline.set(withDelay(700, withTiming(1, { duration: 600, easing: easing.standard })));
    const t1 = setTimeout(() => haptic('tap'), 360);
    const t2 = setTimeout(() => {
      introPlayed = true;
      group.set(withSpring(1, { duration: 760, dampingRatio: 0.92 }));
      tagline.set(withTiming(0, { duration: 220 }));
      setPhase('choose');
    }, 2150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [glow, word, sweep, tagline, group]);

  useFocusEffect(
    useCallback(() => {
      reset();
    }, [reset]),
  );

  const groupStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: group.value * lift }, { scale: 1 - group.value * 0.42 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * (1 - group.value * 0.6),
    transform: [{ scale: 0.6 + glow.value * 0.7 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 14 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: tagline.value }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 0.55 : 0,
    transform: [{ translateX: -260 + sweep.value * 520 }, { rotate: '18deg' }],
  }));

  const choose = (dest: Destination, ref: RefObject<View | null>) => {
    haptic('press');
    setDestination(dest.id);
    expand(ref, { photo: dest.photo }, dest.light, () => {
      router.push(dest.id === 'emirates' ? '/onboarding/emirates' : '/onboarding/you');
    });
  };

  const skip = () => {
    if (phase === 'intro') {
      introPlayed = true;
      group.set(withSpring(1, { duration: 600, dampingRatio: 0.92 }));
      tagline.set(withTiming(0, { duration: 160 }));
      setPhase('choose');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: '#08080C' }]}>
      <LinearGradient
        colors={['#120D2B', '#08080C', '#08080C']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Logo group: centred during the intro, then lifts into place */}
      <Animated.View style={[styles.center, groupStyle]} pointerEvents="none">
        <Animated.View style={[styles.glow, glowStyle]}>
          <Svg width={360} height={360}>
            <Defs>
              <RadialGradient id="wGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={BRAND} stopOpacity={0.5} />
                <Stop offset="0.5" stopColor={BRAND} stopOpacity={0.12} />
                <Stop offset="1" stopColor={BRAND} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={180} cy={180} r={180} fill="url(#wGlow)" />
          </Svg>
        </Animated.View>
        <IrlyMark size={104} state="idle" lensColor={BRAND} />
        <Animated.View style={[{ marginTop: 26, overflow: 'hidden', paddingHorizontal: 12 }, wordStyle]}>
          <IrlyWordmark size={34} color="#FFFFFF" />
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
        <Animated.View style={[{ marginTop: 14 }, taglineStyle]}>
          <Text variant="label" color="rgba(255,255,255,0.62)" style={{ letterSpacing: 2.2 }}>
            CONNECT · RELOCATE · BELONG
          </Text>
        </Animated.View>
      </Animated.View>

      {phase === 'intro' ? (
        <PressableScale haptic={false} scaleTo={1} onPress={skip} style={StyleSheet.absoluteFill} accessibilityLabel="Skip intro" />
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
          <Icon name="arrowRight" size={20} color="#08080C" strokeWidth={2.4} />
        </View>
      </Glass>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: 360, height: 360 },
  sweep: { position: 'absolute', top: -20, bottom: -20, width: 70 },
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
