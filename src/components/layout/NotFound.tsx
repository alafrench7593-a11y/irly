import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Text } from '@/components/ui/Text';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** An old or wrong link: say so, with a way out (never a blank screen). */
export function NotFound({ title = 'This page no longer exists' }: { title?: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg, paddingTop: insets.top + 60 }]}>
      <Ambient variant="quiet" />
      <Animated.View entering={enter.rise(0, 60)} style={styles.card}>
        <GlassLayer radius={radius.xl} />
        <Text variant="titleM" align="center">
          {title}
        </Text>
        <Button label="Back" icon="chevronLeft" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: space.gutter },
  card: { alignSelf: 'stretch', alignItems: 'center', gap: space[5], padding: space[7], borderRadius: radius.xl, overflow: 'hidden' },
});
