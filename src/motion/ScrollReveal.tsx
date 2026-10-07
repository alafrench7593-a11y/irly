import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/AppFrame';

type Props = {
  /** Vertical offset of the page's scroll view. */
  scrollY: SharedValue<number>;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** How far the section travels up as it arrives. */
  distance?: number;
};

/**
 * A section that arrives as you scroll to it: it rises, grows from 94 %
 * and fades in as its top edge crosses the bottom of the screen, driven by
 * the scroll position on the UI thread (scrolling back reverses it).
 * Must be a direct child of the scroll view's content. Content already on
 * screen when the page opens is left untouched.
 */
export function ScrollReveal({ scrollY, children, style, distance = 56 }: Props) {
  const frame = useFrame();
  const reduced = useReducedMotion();
  const top = useSharedValue(-1);
  const H = frame.height;
  const anim = useAnimatedStyle(() => {
    if (reduced || top.value < 0) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const seen = scrollY.value + H - top.value;
    const p = interpolate(seen, [0, 240], [0, 1], Extrapolation.CLAMP);
    return { opacity: p, transform: [{ translateY: (1 - p) * distance }, { scale: 0.94 + p * 0.06 }] };
  });
  return (
    <Animated.View onLayout={(e) => top.set(e.nativeEvent.layout.y)} style={[style, anim]}>
      {children}
    </Animated.View>
  );
}
