import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Avatar } from '@/components/ui/Avatar';
import { spring } from '@/motion/tokens';
import { useTheme } from '@/theme/useTheme';
import { useAvatarFlight } from './avatarFlight';

/**
 * Draws the face in flight above everything, from the bubble it left to
 * its place on the profile: a soft arc, growing on `spring.soft`. Only
 * transforms move. If the page never reports where the face lands, the
 * flight is dropped after a moment (nothing stays hidden).
 */
export function FlightHost() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const flight = useAvatarFlight((s) => s.flight);
  const clear = useAvatarFlight((s) => s.clear);
  const setHostOffset = useAvatarFlight((s) => s.setHostOffset);
  const host = useRef<View>(null);
  const p = useSharedValue(0);

  useEffect(() => {
    if (!flight) return;
    if (!flight.to) {
      const id = setTimeout(() => clear(), 900);
      return () => clearTimeout(id);
    }
    p.set(0);
    p.set(
      reduced
        ? withTiming(1, { duration: 1 }, (fin) => {
            if (fin) scheduleOnRN(clear);
          })
        : withSpring(1, spring.soft, (fin) => {
            if (fin) scheduleOnRN(clear);
          }),
    );
  }, [flight, clear, p, reduced]);

  const from = flight?.from;
  const to = flight?.to;
  const style = useAnimatedStyle(() => {
    if (!from || !to) return { opacity: 0 };
    const v = p.value;
    const fx = from.x + from.width / 2;
    const fy = from.y + from.height / 2;
    const tx = to.x + to.width / 2;
    const ty = to.y + to.height / 2;
    const arc = Math.sin(Math.PI * Math.min(1, Math.max(0, v))) * -36;
    const s = from.width / to.width + (1 - from.width / to.width) * v;
    return {
      opacity: 1,
      transform: [
        { translateX: fx + (tx - fx) * v - to.width / 2 },
        { translateY: fy + (ty - fy) * v + arc - to.height / 2 },
        { scale: s },
      ],
    };
  });

  return (
    <View
      ref={host}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={() => host.current?.measureInWindow?.((x, y) => setHostOffset({ x, y }))}
    >
      {flight && to ? (
        <Animated.View style={[styles.face, { width: to.width, height: to.height, borderRadius: to.width / 2, boxShadow: t.shadow.float }, style]}>
          <Avatar name={flight.name} hue={flight.hue} size={to.width} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { position: 'absolute', left: 0, top: 0 },
});
