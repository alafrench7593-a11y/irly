import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';
import { useCmsPreview } from '@/features/cms/feed';
import { Flavor } from '@/theme/flavor';
import { space } from '@/theme/tokens';
import Home from '../(tabs)/index';

/**
 * Back office › Home layout › preview: the real Home, with the draft layout
 * (features/cms/feed useCmsPreview), in IRLY or in the IRLY Girl look. Only
 * on this screen: nothing is saved, no member sees it. Data still comes from
 * each section's own calls with this account's rights (a layout never opens
 * IRLY Girl content to someone without IRLY Girl access).
 */
export default function HomePreview() {
  const preview = useCmsPreview((s) => s.preview);
  const insets = useSafeAreaInsets();
  // Leaving the preview gives the Home back its published layout.
  useEffect(() => () => useCmsPreview.setState({ preview: null }), []);
  if (!preview) {
    return (
      <Page title="Preview">
        <View style={{ paddingHorizontal: space.gutter }}>
          <Text variant="body" tone="secondary">
            Open a preview from the Home layout screen.
          </Text>
        </View>
      </Page>
    );
  }
  return (
    <Flavor value={preview.space}>
      <View style={styles.root} testID={`home-preview-${preview.space}`}>
        <Home />
        <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Glass level="thick" lifted style={styles.pill}>
            <Text variant="label" style={{ flex: 1 }}>
              {preview.space === 'girl' ? 'Preview · IRLY Girl · not published' : 'Preview · IRLY · not published'}
            </Text>
            <Button size="sm" variant="secondary" label="Close" onPress={() => router.back()} />
          </Glass>
        </View>
      </View>
    </Flavor>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { position: 'absolute', left: space.gutter, right: space.gutter },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24 },
});
