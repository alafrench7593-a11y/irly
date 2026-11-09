import { router, type ErrorBoundaryProps } from 'expo-router';
import { useContext, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { IrlyWordmark } from '@/brand/IrlyLogo';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { reportScreenError } from '@/lib/crashReport';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * What a screen shows when it crashes (a route's `ErrorBoundary` export,
 * see expo-router): never a blank or red screen, always Try again and a
 * way home. Also the root layout's, where no safe area provider is
 * mounted: the insets are read when there are some, otherwise a fixed margin.
 */
export function ErrorScreen({ error, retry, where }: ErrorBoundaryProps & { where: string }) {
  const t = useTheme();
  const insets = useContext(SafeAreaInsetsContext);

  useEffect(() => {
    // The kind of error and a scrubbed first line: no text that was on screen (lib/crashReport).
    reportScreenError(error, where);
    if (__DEV__) console.warn(`[IRLY] ${where} crashed:`, error);
  }, [error, where]);

  const home = () => {
    try {
      router.replace('/');
    } catch {
      // No navigator to go through (the root itself failed): Try again below rebuilds it.
    }
    void retry();
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg, paddingTop: (insets?.top ?? 0) + 80, paddingBottom: (insets?.bottom ?? 0) + space[7] }]}>
      <IrlyWordmark size={28} />
      <View style={styles.copy}>
        <Text variant="titleM" align="center">
          Something went wrong
        </Text>
        <Text tone="secondary" align="center">
          This page hit a problem. Try again, or go back to Home.
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="Try again" icon="repeat" onPress={() => void retry()} full />
        <Button label="Back to Home" icon="home" variant="secondary" onPress={home} full />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: space.gutter, gap: space[7] },
  copy: { alignSelf: 'stretch', gap: space[3] },
  actions: { alignSelf: 'stretch', gap: space[3] },
});
