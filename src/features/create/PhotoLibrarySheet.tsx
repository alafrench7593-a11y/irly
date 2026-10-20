import { Image } from 'expo-image';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { t as tx } from '@/i18n';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { libraryThumb } from './photoLibrary';

/**
 * IRLY LIBRARY: every photo of the activity's type in one grid, three per
 * row. Tapping one chooses it and closes the sheet; the chosen one carries
 * a check. The photos come from libraryFor(), never an empty grid.
 */
export const PhotoLibrarySheet = memo(function PhotoLibrarySheet({
  visible,
  onClose,
  urls,
  selected,
  onPick,
  title,
}: {
  visible: boolean;
  onClose: () => void;
  urls: readonly string[];
  selected: string | null;
  onPick: (url: string) => void;
  /** The type shown ("Padel", "Brunch"…). */
  title?: string;
}) {
  const t = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={tx('IRLY library')} subtitle={title ? tx('{n} photos for {what}', { n: urls.length, what: title }) : tx('{n} photos', { n: urls.length })} maxHeight={0.86}>
      <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {urls.map((url, i) => {
          const on = url === selected;
          return (
            <View key={url} style={styles.cell}>
              <PressableScale
                haptic="select"
                scaleTo={0.95}
                onPress={() => onPick(url)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={tx('Photo {n} of {total}', { n: i + 1, total: urls.length })}
                style={[styles.tile, { backgroundColor: t.c.overlay, borderColor: on ? t.c.brand : 'transparent' }]}
              >
                <Image source={{ uri: libraryThumb(url) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} cachePolicy="memory-disk" recyclingKey={url} />
                {on ? (
                  <View style={[styles.check, { backgroundColor: t.c.brand }]}>
                    <Icon name="check" size={14} color={t.c.onBrand} strokeWidth={3} />
                  </View>
                ) : null}
              </PressableScale>
            </View>
          );
        })}
        {!urls.length ? (
          <Text variant="body" tone="secondary" style={{ padding: space.gutter }}>
            No photos for this type yet.
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 4, paddingBottom: space[4] },
  cell: { width: '33.333%', padding: 4 },
  tile: { aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', borderWidth: 3 },
  check: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
