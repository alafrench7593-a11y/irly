import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ambient } from '@/components/visual/Ambient';
import { useTheme } from '@/theme/useTheme';

/**
 * The ground of a full-screen view that does not use <Page> (tab roots,
 * onboarding steps, chat, IRLY Girl): the theme's ground and its ambient
 * light, so the glass laid on top has something to refract.
 */
export function Screen({ children, ambient = 'page', style }: { children: ReactNode; ambient?: 'page' | 'hero' | 'quiet' | false; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }, style]}>
      {ambient ? <Ambient variant={ambient} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
