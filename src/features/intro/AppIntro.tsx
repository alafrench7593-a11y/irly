import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { haptic } from '@/motion/haptics';
import { ease, motion, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { useIntro } from './introStore';

let played = false;

/**
 * Entering IRLY. On every launch of a member's app: black, the dot
 * wordmark lights up dot by dot, then the curtain lifts (the logo grows
 * and dissolves, the black fades) while the Home zooms in from behind.
 * About 1.6 s, never blocks a touch, skipped with Reduce Motion and for
 * first-time visitors (the Welcome has its own intro).
 */
export function AppIntro() {
  const onboarded = useStore((s) => s.onboarded);
  const cityId = useStore((s) => s.cityId);
  const finish = useIntro((s) => s.finish);
  const reduced = useReducedMotion();
  const [show, setShow] = useState(() => !played && onboarded && Boolean(cityId) && !reduced);
  const curtain = useSharedValue(1);
  const logo = useSharedValue(0);
  const lift = useSharedValue(0);

  useEffect(() => {
    if (!show) {
      played = true;
      finish();
      return;
    }
    logo.set(withSpring(1, spring.cinematic));
    const t = setTimeout(() => {
      played = true;
      haptic('tap');
      // The Home starts its own entrance under the lifting curtain.
      finish();
      lift.set(withTiming(1, { duration: motion.emphasized + 120, easing: ease.enter }));
      curtain.set(
        withTiming(0, { duration: motion.emphasized + 120, easing: ease.standard }, (fin) => {
          if (fin) scheduleOnRN(setShow, false);
        }),
      );
    }, 1050);
    return () => clearTimeout(t);
  }, [show, finish, curtain, logo, lift]);

  const curtainStyle = useAnimatedStyle(() => ({ opacity: curtain.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.value * (1 - lift.value),
    transform: [{ scale: (0.86 + logo.value * 0.14) * (1 + lift.value * 0.7) }],
  }));

  if (!show) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.curtain, curtainStyle]} pointerEvents="none">
      <Svg width={420} height={420} style={styles.glow}>
        <Defs>
          <RadialGradient id="irly-intro-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#8EA5BF" stopOpacity={0.22} />
            <Stop offset="0.55" stopColor="#8EA5BF" stopOpacity={0.06} />
            <Stop offset="1" stopColor="#8EA5BF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={420} height={420} fill="url(#irly-intro-glow)" />
      </Svg>
      <Animated.View style={logoStyle}>
        <IrlyWordmark size={58} color="#FFFFFF" animated />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  curtain: { backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  // A breath of the logo's steel light behind the dots.
  glow: { position: 'absolute' },
});
