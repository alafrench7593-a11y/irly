import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** An old or wrong link: say so, with a way out (never a blank screen). */
export function NotFound({ title = 'This page no longer exists' }: { title?: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg, paddingTop: insets.top + 60 }]}>
      <Text variant="titleM" align="center">
        {title}
      </Text>
      <Button label="Back" icon="chevronLeft" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', gap: space[5], paddingHorizontal: space.gutter },
});
