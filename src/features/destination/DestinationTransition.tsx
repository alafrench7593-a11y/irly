import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { create } from 'zustand';
import { IrlyMark, type MarkState } from '@/brand/IrlyMark';
import { useFrame } from '@/components/layout/AppFrame';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { haptic } from '@/motion/haptics';
import { easing } from '@/motion/tokens';
import { useStore } from '@/state/store';

const useSwitch = create<{ target: CityId | null }>(() => ({ target: null }));
const clearSwitch = () => useSwitch.setState({ target: null });

/**
 * Changing destination is a journey, not a reload: the new city's light
 * opens like a portal from the destination pill, the mark orbits while the
 * app re-renders underneath, then the light lifts to reveal the new city.
 */
export function switchCity(cityId: CityId) {
  if (useStore.getState().cityId === cityId) return;
  haptic('press');
  useSwitch.setState({ target: cityId });
}

export function DestinationTransition() {
  const target = useSwitch((s) => s.target);
  if (!target) return null;
  return <Portal key={target} target={target} />;
}

function Portal({ target }: { target: CityId }) {
  const setCity = useStore((s) => s.setCity);
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const [mark, setMark] = useState<MarkState>('loading');

  const portal = useSharedValue(0);
  const content = useSharedValue(0);
  const fade = useSharedValue(1);

  const W = frame.width;
  const H = frame.height;
  const D = Math.sqrt(W * W + H * H) * 2.1;
  const cx = W / 2;
  const cy = insets.top + 30;

  useEffect(() => {
    portal.set(withTiming(1, { duration: 760, easing: easing.emphasized }));
    content.set(withDelay(260, withTiming(1, { duration: 420, easing: easing.standard })));

    const t1 = setTimeout(() => {
      setCity(target);
    }, 780);
    const t2 = setTimeout(() => {
      setMark('success');
      haptic('success');
    }, 1150);
    const t3 = setTimeout(() => {
      fade.set(withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) }, (fin) => {
        if (fin) scheduleOnRN(clearSwitch);
      }));
    }, 1700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [target, setCity, portal, content, fade]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: 0.001 + portal.value * 0.999 }] }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: content.value,
    transform: [{ translateY: (1 - content.value) * 16 }],
  }));
  const rootStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 1 + (1 - fade.value) * 0.04 }],
  }));

  const city = CITIES[target];
  const dest = DESTINATIONS[city.destinationId];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, rootStyle]} pointerEvents="auto">
      <Animated.View
        style={[
          styles.circle,
          { width: D, height: D, borderRadius: D / 2, left: cx - D / 2, top: cy - D / 2 },
          circle,
        ]}
      >
        <View style={{ position: 'absolute', left: D / 2 - cx, top: D / 2 - cy, width: W, height: H }}>
          <Photo visual={{ photo: city.photo }} light={city.light} width={1400} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.center, contentStyle]} pointerEvents="none">
        <IrlyMark size={64} state={mark} lensColor="#8B6CFF" />
        <Text variant="overline" tone="onDark" style={{ marginTop: 28, opacity: 0.8 }}>
          {dest.flag}  {dest.name}
        </Text>
        <Text variant="displayXL" tone="onDark" italic align="center" style={{ marginTop: 8 }}>
          {city.name}
        </Text>
        <Text variant="body" color="rgba(255,255,255,0.75)" align="center" style={{ marginTop: 6 }}>
          {city.tagline}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute', overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
});
