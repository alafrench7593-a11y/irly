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
 * Frosted glass. Real blur on iOS and web; on Android a dense tint keeps
 * text legible without the cost of a live blur in scrolling lists.
 */
export const Glass = memo(function Glass({ style, intensity = 40, dark, border = true, children }: Props) {
  const t = useTheme();
  const isDark = dark || t.mode === 'night';
  const tint = dark ? 'rgba(10,10,16,0.42)' : t.c.glass;
  return (
    <View
      style={[
        styles.root,
        border ? { borderWidth: StyleSheet.hairlineWidth * 2, borderColor: dark ? 'rgba(255,255,255,0.16)' : t.c.line } : null,
        style,
      ]}
    >
      {Platform.OS === 'android' ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(10,10,16,0.72)' : t.mode === 'night' ? 'rgba(20,20,27,0.94)' : 'rgba(255,255,255,0.94)' }]} />
      ) : (
        <>
          <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />
        </>
      )}
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
