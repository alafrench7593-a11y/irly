import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { DEMO } from '@/config/app';
import { PressableScale } from '@/motion/PressableScale';

const APP_URL = 'https://getirly.com/app/';

/**
 * The demo says it is a demo, on every screen: example people and plans,
 * nothing saved. One tap opens the real app (the whole tab, even when the
 * demo runs inside the website).
 */
export function DemoBadge() {
  const insets = useSafeAreaInsets();
  if (!DEMO || Platform.OS !== 'web') return null;
  const openApp = () => {
    const w = globalThis as { top?: { location: { href: string } }; location?: { href: string } };
    try {
      if (w.top) w.top.location.href = APP_URL;
      else if (w.location) w.location.href = APP_URL;
    } catch {
      if (w.location) w.location.href = APP_URL;
    }
  };
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 104 }]}>
      <PressableScale onPress={openApp} scaleTo={0.95} accessibilityLabel="Demo: example content, nothing is saved. Create my account" style={styles.pill}>
        <Text variant="label" color="#FFFFFF">
          Demo · nothing is saved
        </Text>
        <Text variant="label" color="#FFFFFF" style={styles.cta}>
          Create my account →
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: 'rgba(10,10,10,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  cta: { textDecorationLine: 'underline' },
});
