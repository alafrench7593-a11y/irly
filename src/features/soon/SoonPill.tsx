import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';

/** COMING SOON, with a dot that breathes slowly (still with reduced motion). */
export function SoonPill({ onLight }: { onLight?: boolean }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.set(withRepeat(withSequence(withTiming(0.3, { duration: 900 }), withTiming(1, { duration: 900 })), -1));
  }, [o, reduced]);
  const dot = useAnimatedStyle(() => ({ opacity: o.value }));
  const fg = onLight ? '#0A0A0A' : '#FFFFFF';
  return (
    <View style={[styles.pill, { borderColor: onLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.35)', backgroundColor: onLight ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)' }]}>
      <Animated.View style={[styles.dot, { backgroundColor: fg }, dot]} />
      <Text variant="overline" color={fg}>
        Coming soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 28, borderRadius: 14, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
