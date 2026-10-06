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
  border?: boolean;
  /** thin: controls on photos · regular: panels · thick: bars, sheets, menus. */
  level?: GlassLevel;
  /** Soft light along the top edge, like a real pane. */
  highlight?: boolean;
  children?: ReactNode;
};

/**
 * Frosted glass: blur, a controlled tint, a hairline edge and a soft
 * highlight along the top, so a surface reads as physically placed above
 * the content behind it. On IRLY Noir the tint is smoked glass; on a photo
 * (`dark`) it is a whisper of white, as in the event page over its own
 * photo. On Android a dense tint keeps text legible without the cost of a
 * live blur. The blur never animates: a glass layer fades in as a whole.
 */
export const Glass = memo(function Glass({ style, intensity, dark, border = true, level = 'regular', highlight = true, children }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const isDark = dark || night;
  const spec = glassLevels[level];
  const tint = dark ? 'rgba(255,255,255,0.12)' : night ? spec.night : spec.day;
  const edge = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.9)';
  const shine = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.6)';
  return (
    <View
      style={[
        styles.root,
        border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: edge } : null,
        style,
      ]}
    >
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: isDark ? (dark ? 'rgba(40,42,46,0.84)' : 'rgba(22,24,28,0.94)') : 'rgba(255,255,255,0.95)' }]} />
      ) : (
        <>
          <BlurView intensity={intensity ?? spec.blur} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.under]} />
          <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: tint }]} />
        </>
      )}
      {highlight ? (
        <LinearGradient colors={[shine, 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, styles.under]} pointerEvents="none" />
      ) : null}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  // The glass is its own stacking context and its layers sit under the
  // content, so icons (SVG) are never painted below the tint on web.
  root: { overflow: 'hidden', zIndex: 0 },
  under: { zIndex: -1 },
});
