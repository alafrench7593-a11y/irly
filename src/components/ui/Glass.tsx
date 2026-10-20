import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { glassLevels, type GlassLevel } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** Blur strength. Defaults to the level's. */
  intensity?: number;
  /** Glass laid on a photo: a whisper of white over a dark blur, whatever the theme. */
  dark?: boolean;
  /** Always the light glass, even when the app is in its night theme (a universe that stays light, like IRLY Girl). */
  light?: boolean;
  border?: boolean;
  /** thin: controls on photos · regular: panels · thick: bars, sheets, menus. */
  level?: GlassLevel;
  /** Soft light along the top edge, like a real pane. */
  highlight?: boolean;
  /** A soft drop shadow under the pane (cards, bars, sheets). */
  lifted?: boolean;
  children?: ReactNode;
};

/**
 * Frosted glass, the base surface of the IRLY design system:
 * 1. a live blur of what is behind (iOS, web: backdrop-filter),
 * 2. a controlled tint (smoked on IRLY Noir, milky on IRLY Clair, rose
 *    veil in IRLY Girl, a whisper of white on a photo),
 * 3. a light edge: brighter along the top, fading down the sides,
 * 4. a sheen across the top half, like light on a real pane,
 * 5. optionally a soft shadow that lifts it off the ground.
 * On Android a denser tint stands in for the blur (no live blur cost) and
 * keeps text legible. The blur never animates: a pane fades in as a whole.
 */
export const Glass = memo(function Glass({ style, intensity, dark, light, border = true, level = 'regular', highlight = true, lifted, children }: Props) {
  const t = useTheme();
  const girl = t.flavor === 'girl' && !dark;
  const night = t.mode === 'night' && !light && !girl;
  const isDark = dark || night;
  const spec = glassLevels[level];
  const tint = dark ? 'rgba(255,255,255,0.12)' : girl ? spec.girl : night ? spec.night : spec.day;
  const edgeTop = isDark ? 'rgba(255,255,255,0.28)' : girl ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.95)';
  const edgeLow = isDark ? 'rgba(255,255,255,0.07)' : girl ? 'rgba(201,47,114,0.14)' : 'rgba(10,10,10,0.06)';
  const shine = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.65)';
  const solid = isDark ? (dark ? 'rgba(40,42,46,0.86)' : 'rgba(24,26,31,0.95)') : girl ? 'rgba(255,246,250,0.96)' : 'rgba(255,255,255,0.95)';
  return (
    <View style={[styles.root, lifted ? { boxShadow: t.shadow.card } : null, style]}>
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: solid }]} />
      ) : (
        <>
          <BlurView intensity={intensity ?? spec.blur} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.under]} />
          <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: tint }]} />
        </>
      )}
      {highlight ? (
        <LinearGradient colors={[shine, 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, styles.under]} pointerEvents="none" />
      ) : null}
      {border ? (
        // The edge catches the light from above: bright on top, faint below.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge, { borderColor: edgeLow, borderTopColor: edgeTop, borderLeftColor: edgeTop, borderRadius: flatRadius(style) }]} />
      ) : null}
      {children}
    </View>
  );
});

/** The pane's own corner radius, so its edge follows the same curve. */
function flatRadius(style: StyleProp<ViewStyle>): number | undefined {
  const flat = StyleSheet.flatten(style);
  return typeof flat?.borderRadius === 'number' ? flat.borderRadius : undefined;
}

const styles = StyleSheet.create({
  // The glass is its own stacking context and its layers sit under the
  // content, so icons (SVG) are never painted below the tint on web.
  root: { overflow: 'hidden', zIndex: 0 },
  under: { zIndex: -1 },
  edge: { borderWidth: StyleSheet.hairlineWidth * 2, zIndex: 1 },
});
