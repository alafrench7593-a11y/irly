import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Icon } from '@/components/ui/Icon';
import { easing, spring } from '@/motion/tokens';

/**
 * The IRLY mark: "Common Ground".
 *
 * Two rings (two people, two worlds) and the lens where they overlap,
 * lit in the brand colour. It is IRLY's promise drawn literally: we find
 * the place where your life and someone else's meet.
 *
 * States
 * - idle: the rings breathe toward each other, the lens glows softly
 * - loading: the rings orbit their common centre
 * - success: the rings converge into one, a check appears
 * - transition: the lens expands until it fills the screen
 * - static: no motion (lists, headers, reduced motion)
 */
export type MarkState = 'idle' | 'loading' | 'success' | 'transition' | 'static';

type Props = {
  size?: number;
  state?: MarkState;
  ringColor?: string;
  lensColor?: string;
  glow?: boolean;
  /** Called when the success or transition animation has finished. */
  onDone?: () => void;
};

export const IrlyMark = memo(function IrlyMark({
  size = 64,
  state = 'idle',
  ringColor = '#FFFFFF',
  lensColor = '#8B6CFF',
  glow = true,
  onDone,
}: Props) {
  const d = size * 0.62;
  const rest = d * 0.58;
  const stroke = Math.max(1.5, d * 0.075);
  const left = (size - d) / 2;

  const sep = useSharedValue(state === 'success' ? 0 : rest);
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);
  const ringOpacity = useSharedValue(1);
  const check = useSharedValue(state === 'success' ? 1 : 0);

  useEffect(() => {
    cancelAnimation(sep);
    cancelAnimation(spin);
    cancelAnimation(glowOpacity);
    const breathe = (lo: number, hi: number, ms: number) =>
      withRepeat(
        withSequence(
          withTiming(hi, { duration: ms, easing: easing.inOut }),
          withTiming(lo, { duration: ms, easing: easing.inOut }),
        ),
        -1,
        true,
      );

    switch (state) {
      case 'idle':
        scale.set(withSpring(1, spring.smooth));
        ringOpacity.set(withTiming(1, { duration: 300 }));
        check.set(withTiming(0, { duration: 150 }));
        spin.set(withTiming(0, { duration: 400 }));
        sep.set(breathe(rest * 0.86, rest * 1.04, 1700));
        glowOpacity.set(breathe(0.35, 0.7, 1700));
        break;
      case 'loading':
        check.set(withTiming(0, { duration: 150 }));
        sep.set(breathe(rest * 0.55, rest * 1.0, 650));
        spin.set(withRepeat(withTiming(360, { duration: 1300, easing: Easing.linear }), -1, false));
        glowOpacity.set(breathe(0.4, 0.85, 650));
        break;
      case 'success':
        spin.set(withTiming(Math.ceil(spin.value / 180) * 180, { duration: 500, easing: easing.standard }));
        sep.set(withSpring(0, spring.bouncy));
        glowOpacity.set(withTiming(0.9, { duration: 300 }));
        check.set(withDelay(220, withSpring(1, spring.bouncy)));
        break;
      case 'transition':
        sep.set(withTiming(0, { duration: 260, easing: easing.standard }));
        ringOpacity.set(withTiming(0, { duration: 220 }));
        check.set(withTiming(0, { duration: 120 }));
        scale.set(withDelay(120, withTiming(40, { duration: 720, easing: easing.emphasized })));
        break;
      case 'static':
        sep.set(rest);
        spin.set(0);
        glowOpacity.set(0.5);
        break;
    }
    // Callbacks are fired from JS timers: they stay in sync with the
    // animation durations above and keep the worklets serialisable.
    if (onDone && (state === 'success' || state === 'transition')) {
      const t = setTimeout(onDone, state === 'success' ? 900 : 760);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, rest]);

  const container = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }, { scale: scale.value }],
  }));
  const ringA = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ translateX: -sep.value / 2 }],
  }));
  const ringB = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ translateX: sep.value / 2 }],
  }));
  const clipA = useAnimatedStyle(() => ({ transform: [{ translateX: -sep.value / 2 }] }));
  const innerB = useAnimatedStyle(() => ({ transform: [{ translateX: sep.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value * ringOpacity.value }));
  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.4 + check.value * 0.6 }],
  }));

  const circle = { width: d, height: d, borderRadius: d / 2, left, top: 0, position: 'absolute' as const };

  return (
    <Animated.View style={[{ width: size, height: d }, container]} pointerEvents="none">
      {glow ? (
        <Animated.View style={[styles.glow, { left: size / 2 - d, top: -d / 2, width: d * 2, height: d * 2 }, glowStyle]}>
          <Svg width={d * 2} height={d * 2}>
            <Defs>
              <RadialGradient id="irlyGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={lensColor} stopOpacity={0.55} />
                <Stop offset="0.45" stopColor={lensColor} stopOpacity={0.16} />
                <Stop offset="1" stopColor={lensColor} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={d} cy={d} r={d} fill="url(#irlyGlow)" />
          </Svg>
        </Animated.View>
      ) : null}

      {/* Lens: circle B seen through circle A */}
      <Animated.View style={[circle, { overflow: 'hidden' }, clipA]}>
        <Animated.View
          style={[{ position: 'absolute', left: 0, top: 0, width: d, height: d, borderRadius: d / 2, backgroundColor: lensColor }, innerB]}
        />
      </Animated.View>

      <Animated.View style={[circle, { borderWidth: stroke, borderColor: ringColor }, ringA]} />
      <Animated.View style={[circle, { borderWidth: stroke, borderColor: ringColor }, ringB]} />

      <Animated.View style={[StyleSheet.absoluteFill, styles.center, checkStyle]}>
        <View>
          <Icon name="check" size={d * 0.5} color="#FFFFFF" strokeWidth={2.6} />
        </View>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
