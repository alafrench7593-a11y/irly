import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { photo as photoUrl } from '@/data/photos';
import type { Visual } from '@/data/types';
import type { LightId } from '@/theme/lights';

type Props = {
  visual: Visual;
  /** Destination light: tints the loading state behind the photo. */
  light: LightId;
  style?: StyleProp<ViewStyle>;
  /** Bottom gradient so text stays legible on any photo. */
  scrim?: 'none' | 'soft' | 'strong' | 'full';
  width?: number;
  /** Background use: heavy blur (desktop frame backdrop). */
  blur?: number;
  children?: ReactNode;
  recyclingKey?: string;
};

const SCRIMS = {
  soft: { colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.45)'] as const, start: 0.45 },
  strong: { colors: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.78)'] as const, start: 0.25 },
  full: { colors: ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.84)'] as const, start: 0 },
};

/**
 * A real photograph. While it loads, the frame is a skeleton with the
 * exact geometry of the photo: grey with a soft breathing pulse. The photo
 * then cross-fades in and is cached on disk for next time.
 */
export const Photo = memo(function Photo({ visual, light, style, scrim = 'none', width = 900, blur, children, recyclingKey }: Props) {
  // loading: breathing placeholder · done: photo shown, or the plain
  // destination colours if the network refused it (no endless pulse).
  const [status, setStatus] = useState<'loading' | 'done'>('loading');
  void light;
  const pulse = useSharedValue(0);
  const loading = status === 'loading';

  useEffect(() => {
    if (!loading) {
      cancelAnimation(pulse);
      return;
    }
    pulse.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [loading, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: loading ? 0.18 + pulse.get() * 0.22 : 0 }));
  const sc = scrim !== 'none' ? SCRIMS[scrim] : null;

  return (
    <View style={[styles.root, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1A1A1A' }]} />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#3A3A3A' }, pulseStyle]} pointerEvents="none" />
      <Image
        source={{ uri: photoUrl(visual.photo, width) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={{ duration: 450, effect: 'cross-dissolve' }}
        cachePolicy="memory-disk"
        recyclingKey={recyclingKey}
        blurRadius={blur}
        onLoad={() => setStatus('done')}
        onError={() => setStatus('done')}
        accessibilityIgnoresInvertColors
      />
      {sc ? (
        <LinearGradient
          colors={sc.colors}
          start={{ x: 0, y: sc.start }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
