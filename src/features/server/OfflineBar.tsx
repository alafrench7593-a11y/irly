import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/useTheme';
import { useOnline } from './sync';

/** Offline: said plainly, once, at the top. Back online, everything resyncs on its own. */
export function OfflineBar() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  if (online) return null;
  return (
    <Animated.View entering={FadeInUp} exiting={FadeOutUp} pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]} accessibilityLiveRegion="polite">
      <View style={[styles.pill, { backgroundColor: t.c.text }]}>
        <Text variant="caption" color={t.c.bg}>
          Offline · changes will sync when you are back
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
