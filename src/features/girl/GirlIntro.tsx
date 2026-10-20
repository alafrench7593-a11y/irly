import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '@/components/ui/Glass';
import { haptic } from '@/motion/haptics';
import { ease, transition } from '@/motion/tokens';
import { GirlMark } from './GirlMark';
import { girl } from './theme';

let shownThisSession = false;

/**
 * Crossing from IRLY into IRLY Girl. The light IRLY page blurs, a cream
 * wash rises over it, the IRLY Girl mark opens over a soft halo and one
 * pearl shimmer crosses it (GirlMark `launch`); when it has arrived the
 * whole layer lifts, the mark rising a little, to reveal the warm universe
 * underneath. Once per session; reduced motion skips it.
 */
export function GirlIntro() {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(reduced || shownThisSession);
  const wash = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (done) return;
    shownThisSession = true;
    wash.set(withTiming(1, { duration: transition.morph.wash, easing: ease.enter }));
    const h = setTimeout(() => haptic('select'), transition.morph.wash);
    return () => clearTimeout(h);
  }, [done, wash]);

  // The mark has arrived and shimmered: lift the layer away.
  const reveal = useCallback(() => {
    lift.set(
      withTiming(1, { duration: transition.morph.reveal, easing: ease.exit }, (fin) => {
        if (fin) scheduleOnRN(setDone, true);
      }),
    );
  }, [lift]);

  const layer = useAnimatedStyle(() => ({ opacity: 1 - lift.value }));
  const cream = useAnimatedStyle(() => ({ opacity: wash.value, transform: [{ scale: 1.08 - wash.value * 0.08 }] }));
  const rise = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 20 }] }));

  if (done) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, layer]} pointerEvents="none">
      <Glass light style={StyleSheet.absoluteFill} border={false} intensity={80} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: girl.bg }, cream]} />
      <View style={styles.center}>
        <Animated.View style={rise}>
          <GirlMark variant="launch" size={40} delay={transition.morph.wash - 200} onDone={reveal} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
