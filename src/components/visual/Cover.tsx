import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { Visual } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { Photo } from './Photo';

type Props = {
  visual: Visual;
  light: LightId;
  height: number;
  /** Scroll offset of the page: drives parallax and the pull-down stretch. */
  scrollY?: SharedValue<number>;
  radius?: number;
  /**
   * text: dark at the top (status bar) and the bottom (white type on it).
   * top: only the status bar area, for covers with nothing written on them.
   */
  scrim?: 'text' | 'top' | 'none';
  shadow?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const SCRIMS = {
  text: {
    colors: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.78)'] as const,
    locations: [0, 0.28, 0.5, 1] as const,
  },
  top: {
    colors: ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.12)'] as const,
    locations: [0, 0.4, 1] as const,
  },
};

/**
 * Page cover: a real photograph with rounded bottom corners.
 * Scrolling up moves the photo slower than the page (parallax); pulling
 * down stretches the cover from its top edge instead of showing a gap.
 * Only transforms are animated, so it stays on the UI thread at 60 fps.
 * Children sit on top, unclipped and unscaled.
 */
export function Cover({ visual, light, height, scrollY, radius = 34, scrim = 'text', shadow, style, children }: Props) {
  const stretch = useAnimatedStyle(() => {
    const y = scrollY ? scrollY.value : 0;
    if (y >= 0) return { transform: [{ translateY: 0 }, { scale: 1 }] };
    return { transform: [{ translateY: y / 2 }, { scale: 1 + -y / height }] };
  });
  const parallax = useAnimatedStyle(() => {
    const y = scrollY ? scrollY.value : 0;
    return { transform: [{ translateY: y > 0 ? y * 0.4 : 0 }, { scale: 1.04 }] };
  });
  const corners = { borderBottomLeftRadius: radius, borderBottomRightRadius: radius };
  const s = scrim === 'none' ? null : SCRIMS[scrim];
  return (
    <View style={[{ height }, corners, shadow ? { boxShadow: shadow } : null, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, corners, styles.clip, stretch]}>
        <Animated.View style={[StyleSheet.absoluteFill, parallax]}>
          <Photo drift visual={visual} light={light} width={1400} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {s ? <LinearGradient colors={s.colors} locations={s.locations} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      </Animated.View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
