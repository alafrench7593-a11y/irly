import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * The IRLY selection moment, shared by every choice in the app (chips,
 * IRLY Girl chips, option cards):
 * - the colour floods in from the centre like a drop and recedes the same
 *   way when you unselect,
 * - the content crossfades to its selected colours as the drop covers it,
 * - the control springs up a touch, then settles,
 * - a thin band of light sweeps across once.
 * Nothing moves when the screen opens: only a change animates. With
 * « Reduce motion » the state simply switches.
 */
export function useSelection(selected: boolean) {
  const reduced = useReducedMotion();
  const p = useSharedValue(selected ? 1 : 0);
  const bump = useSharedValue(1);
  const sweep = useSharedValue(-1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      p.set(selected ? 1 : 0);
      return;
    }
    p.set(withSpring(selected ? 1 : 0, { duration: selected ? 520 : 380, dampingRatio: selected ? 0.82 : 1 }));
    if (selected) {
      bump.set(withSequence(withTiming(1.07, { duration: 110, easing: Easing.out(Easing.quad) }), withSpring(1, { duration: 520, dampingRatio: 0.55 })));
      sweep.set(-1);
      sweep.set(withTiming(1, { duration: 620, easing: Easing.bezier(0.35, 0, 0.2, 1) }));
    } else {
      bump.set(withSequence(withTiming(0.97, { duration: 90 }), withSpring(1, { duration: 360, dampingRatio: 0.8 })));
    }
  }, [selected, reduced, p, bump, sweep]);
  const outer = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return { p, sweep, outer };
}

/**
 * The inside of a selectable pill or card: base content, the drop of colour,
 * the selected content on top (crossfaded), and the light sweep.
 */
export function SelectionLayers({
  p,
  sweep,
  fill,
  radius,
  base,
  chosen,
}: {
  p: SharedValue<number>;
  sweep: SharedValue<number>;
  /** Colour of the drop (the selected background). */
  fill: string;
  radius: number;
  /** Content drawn in resting colours (sets the size). */
  base: ReactNode;
  /** Same content in selected colours. */
  chosen: ReactNode;
}) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - box.w) > 0.5 || Math.abs(height - box.h) > 0.5) setBox({ w: width, h: height });
  };
  const d = Math.hypot(box.w, box.h) + 4;
  const drop = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(p.value, [0, 1], [0.001, 1]) }], opacity: p.value > 0.002 ? 1 : 0 }));
  const top = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.25, 0.8], [0, 1], Extrapolation.CLAMP) }));
  const under = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.25, 0.8], [1, 0], Extrapolation.CLAMP) }));
  const light = useAnimatedStyle(() => ({
    opacity: sweep.value > -1 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: interpolate(sweep.value, [-1, 1], [-box.w * 0.6, box.w * 1.2]) }, { skewX: '-18deg' }],
  }));
  return (
    <View onLayout={onLayout} style={{ borderRadius: radius, overflow: 'hidden' }}>
      <Animated.View style={under}>{base}</Animated.View>
      {box.w ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: (box.w - d) / 2, top: (box.h - d) / 2, width: d, height: d, borderRadius: d / 2, backgroundColor: fill }, drop]}
        />
      ) : null}
      {/* The selected copy is visual only: screen readers read the label once. */}
      <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden style={[StyleSheet.absoluteFill, top]}>
        {chosen}
      </Animated.View>
      {box.w ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: Math.max(24, box.w * 0.35) }, light]}>
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}
