import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Visual } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { useTheme } from '@/theme/useTheme';
import { Photo } from './Photo';

type Props = {
  visual: Visual;
  light: LightId;
  style?: StyleProp<ViewStyle>;
  /** How far the photo is pushed back: 0 = vivid, 1 = almost black. */
  dim?: number;
};

/**
 * The environmental layer of a page: its own photo, heavily blurred and
 * pushed into the dark, so glass panels and white type float above the
 * colour of the place (photo → blurred layer → glass → content → action).
 * The blur is computed once by the image, never animated.
 */
export const Backdrop = memo(function Backdrop({ visual, light, style, dim = 0.55 }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const base = night ? '5,5,6' : '246,246,244';
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, style]} pointerEvents="none">
      <Photo visual={visual} light={light} blur={48} width={480} style={[StyleSheet.absoluteFill, styles.zoom]} />
      <LinearGradient
        colors={[`rgba(${base},${0.25 + dim * 0.35})`, `rgba(${base},${0.45 + dim * 0.35})`, `rgba(${base},${0.75 + dim * 0.2})`]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  // A blurred photo has soft, transparent edges: overscan hides them.
  zoom: { transform: [{ scale: 1.25 }] },
});
