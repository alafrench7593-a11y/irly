import { BlurView } from 'expo-blur';
import { memo, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/useTheme';

type Props = {
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Force a dark glass (on photos) regardless of theme. */
  dark?: boolean;
  border?: boolean;
  children?: ReactNode;
};

/**
 * Frosted glass: #121212 at 72 % over a real blur, white hairline at 10 %.
 * Used for the tab bar, headers, sheets and map controls, so overlays read
 * as physically placed above the content. On Android a dense tint keeps
 * text legible without the cost of a live blur. The blur never animates:
 * a glass layer fades in as a whole.
 */
export const Glass = memo(function Glass({ style, intensity = 40, dark, border = true, children }: Props) {
  const t = useTheme();
  const isDark = dark || t.mode === 'night';
  const tint = dark ? 'rgba(18,18,18,0.55)' : t.c.glass;
  return (
    <View
      style={[
        styles.root,
        border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.10)' } : null,
        style,
      ]}
    >
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: dark ? 'rgba(18,18,18,0.8)' : 'rgba(18,18,18,0.94)' }]} />
      ) : (
        <>
          <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.under]} />
          <View style={[StyleSheet.absoluteFill, styles.under, { backgroundColor: tint }]} />
        </>
      )}
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
