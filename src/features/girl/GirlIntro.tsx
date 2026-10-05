import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/motion/haptics';
import { ease, transition } from '@/motion/tokens';
import { girl } from './theme';

let shownThisSession = false;

/**
 * Crossing from IRLY into IRLY Girl. The light IRLY page blurs, a cream
 * wash rises over it, "IRLY" holds for a beat, "GIRL" slides in beside it
 * and the letters open up, then the whole layer lifts to reveal the warm
 * universe underneath. Once per session; reduced motion skips it.
 */
export function GirlIntro() {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(reduced || shownThisSession);
  const wash = useSharedValue(0);
  const word = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (done) return;
    shownThisSession = true;
    const t = transition.morph;
    wash.set(withTiming(1, { duration: t.wash, easing: ease.enter }));
    word.set(withDelay(t.wash - 160, withTiming(1, { duration: t.hold + 200, easing: ease.standard })));
    lift.set(
      withDelay(
        t.wash + t.hold + 160,
        withSequence(
          withTiming(1, { duration: t.reveal, easing: ease.exit }, (fin) => {
            if (fin) scheduleOnRN(setDone, true);
          }),
        ),
      ),
    );
    const h = setTimeout(() => haptic('select'), t.wash);
    return () => clearTimeout(h);
  }, [done, wash, word, lift]);

  const layer = useAnimatedStyle(() => ({ opacity: 1 - lift.value }));
  const cream = useAnimatedStyle(() => ({ opacity: wash.value, transform: [{ scale: 1.08 - wash.value * 0.08 }] }));
  const girlWord = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateX: (1 - word.value) * 24 }] }));
  const letters = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 20 }, { scale: 1 + word.value * 0.04 }] }));

  if (done) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, layer]} pointerEvents="none">
      <Glass style={StyleSheet.absoluteFill} border={false} intensity={80} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: girl.bg }, cream]} />
      <View style={styles.center}>
        <Animated.View style={[styles.row, letters]}>
          <Text variant="displayL" color={girl.ink}>
            IRLY
          </Text>
          <Animated.View style={girlWord}>
            <Text variant="displayL" color={girl.rose}>
              {' '}GIRL
            </Text>
          </Animated.View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'baseline' },
});
