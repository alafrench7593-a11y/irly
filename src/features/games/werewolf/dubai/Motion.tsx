import { Image } from 'expo-image';
import { memo, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { DX } from './theme';

/**
 * The Dubaï mode's motion: a slow camera move on the scenes, gold dust in the
 * light, a breathing glow on what to press, falling gold at a victory. Every
 * effect stops (or never starts) with Reduce Motion, and none blocks the game.
 */

/** A scene that drifts slowly (Ken Burns), cross-faded when it changes (night, day, victory). */
export const LivingScene = memo(function LivingScene({ source, style }: { source: ImageSourcePropType; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.set(withRepeat(withTiming(1, { duration: 18000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [reduced, t]);
  const move = useAnimatedStyle(() => ({ transform: [{ scale: 1.04 + t.get() * 0.06 }, { translateY: -t.get() * 10 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, move]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={900} accessibilityIgnoresInvertColors />
      </Animated.View>
    </View>
  );
});

/** Specks of gold drifting up in the light. */
export const GoldDust = memo(function GoldDust({ count = 14, height = 400 }: { count?: number; height?: number }) {
  const reduced = useReducedMotion();
  const specks = useMemo(
    () => Array.from({ length: count }, (_, i) => ({ left: ((i * 37) % 100) + 0.5, size: 2 + (i % 3), delay: (i * 613) % 5000, duration: 6000 + ((i * 977) % 5000) })),
    [count],
  );
  if (reduced) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {specks.map((s, i) => (
        <Speck key={i} {...s} height={height} />
      ))}
    </View>
  );
});

const Speck = memo(function Speck({ left, size, delay, duration, height }: { left: number; size: number; delay: number; duration: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)));
  }, [t, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.get() * Math.PI) * 0.8,
    transform: [{ translateY: height * (1 - t.get()) }, { translateX: Math.sin(t.get() * Math.PI * 2) * 8 }],
  }));
  return <Animated.View style={[styles.speck, { left: `${left}%`, width: size, height: size, borderRadius: size / 2 }, style]} />;
});

/** A soft gold glow that breathes behind a call to action. */
export const Breathe = memo(function Breathe({ children, active = true, color = DX.gold }: { children: ReactNode; active?: boolean; color?: string }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !active) {
      t.set(0);
      return;
    }
    t.set(withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1, false));
  }, [reduced, active, t]);
  const glow = useAnimatedStyle(() => ({ shadowOpacity: 0.25 + t.get() * 0.45, shadowRadius: 8 + t.get() * 10 }));
  return <Animated.View style={[{ shadowColor: color, shadowOffset: { width: 0, height: 0 }, borderRadius: 18 }, glow]}>{children}</Animated.View>;
});

/** Gold confetti falling over the victory scene. */
export const GoldConfetti = memo(function GoldConfetti({ count = 26, height = 700 }: { count?: number; height?: number }) {
  const reduced = useReducedMotion();
  const bits = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i * 53) % 100,
        delay: (i * 211) % 2600,
        duration: 3800 + ((i * 397) % 2400),
        w: 5 + (i % 3) * 2,
        color: i % 4 === 0 ? DX.goldLight : i % 4 === 1 ? DX.gold : i % 4 === 2 ? '#FFF3C4' : DX.goldDark,
      })),
    [count],
  );
  if (reduced) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bits.map((b, i) => (
        <Bit key={i} {...b} height={height} />
      ))}
    </View>
  );
});

const Bit = memo(function Bit({ left, delay, duration, w, color, height }: { left: number; delay: number; duration: number; w: number; color: string; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.in(Easing.quad) }), -1, false)));
  }, [t, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: t.get() < 0.05 ? t.get() * 20 : 1 - Math.max(0, t.get() - 0.8) * 5,
    transform: [{ translateY: -20 + height * t.get() }, { translateX: Math.sin(t.get() * 9) * 14 }, { rotate: `${t.get() * 720}deg` }],
  }));
  return <Animated.View style={[styles.bit, { left: `${left}%`, width: w, height: w * 1.8, backgroundColor: color }, style]} />;
});

/** A value that goes 0 → 1 once, after a delay (staged entrances). */
export function useEntrance(delay: number, duration = 520): SharedValue<number> {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    t.set(withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) })));
  }, [t, delay, duration, reduced]);
  return t;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  speck: { position: 'absolute', top: 0, backgroundColor: DX.goldLight },
  bit: { position: 'absolute', top: 0, borderRadius: 1.5 },
});
