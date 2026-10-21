import { useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useId, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { duration, ease, spring, staggerStep } from '@/motion/tokens';
import { useNetworkTone } from './tone';

/**
 * The motion of IRLY Network, one vocabulary for every Network screen:
 * - entry: the title rises first, then the blocks in order, then the first
 *   cards one by one (only the first batch: cards further down, or added
 *   later, simply appear);
 * - glass that answers the finger: a card sinks a touch and a light blooms
 *   on it while held, springs back on release;
 * - a very slow light drifting behind the top of the page, only while the
 *   screen is focused and never with « Reduce motion »;
 * - lists that re-flow (filters) instead of reloading.
 * Every preset respects « Reduce motion » (Reanimated's system default for
 * layout animations; loops are not started at all).
 */

/** Cards revealed one by one when a list first shows; the rest appear at once. */
export const REVEAL_BATCH = 6;

/** Entry of the n-th block of a Network page (after the title). */
export const blockIn = (index: number, base = 140) =>
  FadeInDown.springify(spring.soft.duration)
    .dampingRatio(0.92)
    .delay(base + index * 70);

/** Entry of the n-th card of a list: only the first batch is staggered. */
export const cardIn = (index: number, base = 0) =>
  index < REVEAL_BATCH
    ? FadeInDown.springify(spring.soft.duration)
        .dampingRatio(0.9)
        .delay(base + index * staggerStep * 1.3)
    : FadeIn.duration(duration.fast);

/** A card leaving a filtered list, and the list closing the gap. */
export const cardOut = FadeOut.duration(duration.fast);
export const reflow = LinearTransition.springify(spring.medium.duration).dampingRatio(0.92);

/** One state of a section swapping for another (loading → empty → filled). */
export const stateIn = FadeIn.duration(duration.base).easing(ease.enter);
export const stateOut = FadeOut.duration(duration.fast);

/** True while the screen is focused: decorative loops run only then. */
export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  return focused;
}

/**
 * Press depth for a glass card: returns the shared press value (0 → 1, for
 * NetworkPane's bloom) and the handlers to spread on the PressableScale.
 * The scale itself is PressableScale's.
 */
export function usePressLight() {
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const onPressIn = useCallback(() => {
    press.set(reduced ? 1 : withTiming(1, { duration: duration.micro, easing: ease.standard }));
  }, [press, reduced]);
  const onPressOut = useCallback(() => {
    press.set(reduced ? 0 : withTiming(0, { duration: duration.slow, easing: ease.standard }));
  }, [press, reduced]);
  return { press, onPressIn, onPressOut };
}

/**
 * The light of a Network page: two soft glows (silver in IRLY, violet and
 * ice in IRLY Girl) behind the top of the page, drifting very slowly, on a
 * 14 s loop. It moves only while the screen is focused and « Reduce motion »
 * is off; otherwise it holds still. With `scrollY` it lags the scroll a
 * little (parallax), then fades out as the page scrolls on.
 */
export const LightDrift = memo(function LightDrift({ height = 520, scrollY }: { height?: number; scrollY?: SharedValue<number> }) {
  const tone = useNetworkTone();
  const reduced = useReducedMotion();
  const focused = useScreenFocused();
  const live = focused && !reduced;
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const p = useSharedValue(0);
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.set(reduced ? 1 : withTiming(1, { duration: 900, easing: ease.enter }));
  }, [shown, reduced]);
  useEffect(() => {
    if (!live) {
      cancelAnimation(p);
      return;
    }
    p.set(withRepeat(withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(p);
  }, [live, p]);

  const a = useAnimatedStyle(() => ({
    opacity: shown.value * (scrollY ? interpolate(scrollY.value, [0, height], [1, 0.25], 'clamp') : 1),
    transform: [
      { translateY: scrollY ? scrollY.value * -0.18 : 0 },
      { translateX: interpolate(p.value, [0, 1], [-28, 34]) },
      { scale: interpolate(p.value, [0, 1], [1, 1.12]) },
    ],
  }));
  const b = useAnimatedStyle(() => ({
    opacity: shown.value * (scrollY ? interpolate(scrollY.value, [0, height], [1, 0.2], 'clamp') : 1),
    transform: [
      { translateY: (scrollY ? scrollY.value * -0.1 : 0) + interpolate(p.value, [0, 1], [18, -16]) },
      { translateX: interpolate(p.value, [0, 1], [30, -24]) },
    ],
  }));

  return (
    <View pointerEvents="none" style={[styles.drift, { height }]}>
      <Animated.View style={[styles.glowA, a]}>
        <Glow id={`${id}a`} color={tone.surface.drift[0]} />
      </Animated.View>
      <Animated.View style={[styles.glowB, b]}>
        <Glow id={`${id}b`} color={tone.surface.drift[1]} />
      </Animated.View>
    </View>
  );
});

function Glow({ id, color }: { id: string; color: string }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={color} stopOpacity={1} />
          <Stop offset="0.6" stopColor={color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={50} cy={50} rx={50} ry={50} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * A thin band of light running along the top of a list while it updates
 * (a filter changed, the old results stay on screen). Stops when done.
 */
export const UpdatingLine = memo(function UpdatingLine({ active }: { active: boolean }) {
  const tone = useNetworkTone();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    shown.set(withTiming(active ? 1 : 0, { duration: active ? duration.fast : duration.base }));
    if (active && !reduced) {
      x.set(0);
      x.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, false));
    } else cancelAnimation(x);
    return () => cancelAnimation(x);
  }, [active, reduced, x, shown]);
  const wrap = useAnimatedStyle(() => ({ opacity: shown.value }));
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + x.value * 200}%` }] }));
  return (
    <Animated.View pointerEvents="none" style={[styles.line, { backgroundColor: tone.softLine }, wrap]}>
      <Animated.View style={[StyleSheet.absoluteFill, band]}>
        <LinearGradient colors={['rgba(255,255,255,0)', tone.accent, 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
});

/** A small bump when a value changes (a count, a badge): felt, not seen. */
export function useBump(key: unknown) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    s.set(withSequence(withTiming(1.12, { duration: 110 }), withDelay(20, withSpring(1, spring.press))));
  }, [key, reduced, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
}

const styles = StyleSheet.create({
  drift: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  glowA: { position: 'absolute', top: -140, left: -120, width: 420, height: 380 },
  glowB: { position: 'absolute', top: 40, right: -150, width: 400, height: 340 },
  line: { height: 2, borderRadius: 1, overflow: 'hidden' },
});
