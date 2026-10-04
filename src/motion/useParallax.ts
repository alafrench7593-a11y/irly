import { DeviceMotion } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Very light parallax driven by how the phone is held (gyroscope), with a
 * slow drift fallback on web. Returns normalised -1..1 shared values.
 * Respects "reduce motion".
 */
export function useParallax(enabled = true): { x: SharedValue<number>; y: SharedValue<number> } {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!enabled || reduced) return;
    let sub: { remove: () => void } | null = null;
    let cancelled = false;

    const drift = () => {
      x.set(withRepeat(
        withSequence(
          withTiming(0.7, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
          withTiming(-0.7, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ));
      y.set(withRepeat(
        withSequence(
          withTiming(-0.5, { duration: 6400, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 6400, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ));
    };

    if (Platform.OS === 'web') {
      drift();
      return;
    }

    DeviceMotion.isAvailableAsync()
      .then((ok) => {
        if (cancelled) return;
        if (!ok) {
          drift();
          return;
        }
        DeviceMotion.setUpdateInterval(32);
        sub = DeviceMotion.addListener((m) => {
          const r = m.rotation;
          if (!r) return;
          const nx = Math.max(-1, Math.min(1, r.gamma / 0.45));
          const ny = Math.max(-1, Math.min(1, (r.beta - 0.75) / 0.45));
          x.set(withSpring(nx, { duration: 600, dampingRatio: 1 }));
          y.set(withSpring(ny, { duration: 600, dampingRatio: 1 }));
        });
      })
      .catch(() => drift());

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled, reduced, x, y]);

  return { x, y };
}
