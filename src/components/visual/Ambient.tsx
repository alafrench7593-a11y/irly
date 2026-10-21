import { memo, useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { enter } from '@/motion/enter';
import { ambient } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  /** Where the light falls: 'page' (top glows), 'hero' (stronger, centred), 'quiet' (forms, lists). */
  variant?: 'page' | 'hero' | 'quiet';
  style?: StyleProp<ViewStyle>;
};

const LAYOUTS = {
  page: [
    { cx: 0.12, cy: 0.04, rx: 0.75, ry: 0.42, o: 1 },
    { cx: 0.95, cy: 0.18, rx: 0.65, ry: 0.36, o: 0.9 },
    { cx: 0.45, cy: 0.92, rx: 0.9, ry: 0.32, o: 0.7 },
  ],
  hero: [
    { cx: 0.2, cy: 0.1, rx: 0.9, ry: 0.5, o: 1 },
    { cx: 0.9, cy: 0.35, rx: 0.75, ry: 0.45, o: 1 },
    { cx: 0.35, cy: 0.85, rx: 0.95, ry: 0.4, o: 0.85 },
  ],
  quiet: [
    { cx: 0.1, cy: 0.02, rx: 0.6, ry: 0.3, o: 0.8 },
    { cx: 1, cy: 0.12, rx: 0.5, ry: 0.28, o: 0.6 },
    { cx: 0.5, cy: 1, rx: 0.8, ry: 0.26, o: 0.5 },
  ],
} as const;

/**
 * The light of the IRLY world, painted once behind a screen: the ground
 * colour and three soft glows (cool steel greys on IRLY Noir, violet and
 * ice blue in IRLY Girl). It is what glass panels refract, so surfaces read
 * as layered panes instead of grey boxes. Vector radial gradients: sharp at
 * any size, identical on iOS, Android and web, nothing animated in a loop
 * (the light fades in once with the screen).
 */
export const Ambient = memo(function Ambient({ variant = 'page', style }: Props) {
  const t = useTheme();
  const spec = ambient[t.flavor][t.mode];
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const glows = LAYOUTS[variant];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: spec.base }, style]}>
      <Animated.View entering={enter.fade(0)} style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            {glows.map((_, i) => (
              <RadialGradient key={i} id={`${id}g${i}`} cx="50%" cy="50%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={spec.glows[i]} stopOpacity={1} />
                <Stop offset="0.55" stopColor={spec.glows[i]} stopOpacity={0.35} />
                <Stop offset="1" stopColor={spec.glows[i]} stopOpacity={0} />
              </RadialGradient>
            ))}
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={spec.base} />
          {glows.map((g, i) => (
            <Ellipse key={i} cx={g.cx * 100} cy={g.cy * 100} rx={g.rx * 100} ry={g.ry * 100} fill={`url(#${id}g${i})`} opacity={g.o} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
});
