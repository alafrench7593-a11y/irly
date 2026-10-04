import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { radius as radii } from '@/theme/tokens';

type Props = { width?: DimensionValue; height: number; radius?: number; style?: StyleProp<ViewStyle> };

/**
 * Loading placeholder with the exact geometry of what it stands for. A
 * very soft band of light sweeps across it (transform only). With "Reduce
 * motion" on, Reanimated skips the sweep and the grey block stays still.
 */
export const Skeleton = memo(function Skeleton({ width = '100%', height, radius = radii.md, style }: Props) {
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(x);
  }, [x]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: `${-100 + x.value * 200}%` }] }));
  return (
    <View style={[styles.root, { width, height, borderRadius: radius }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, band]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
});

/** Skeleton of a "Activities near you" row: same paddings, same thumb. */
export function HappeningRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={60} height={60} radius={18} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="40%" height={10} radius={5} />
        <Skeleton width="80%" height={14} radius={7} />
        <Skeleton width="55%" height={10} radius={5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#1A1A1A', overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0D0D0D',
  },
});
