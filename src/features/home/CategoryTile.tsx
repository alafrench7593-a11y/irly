import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { CatalogCategory, CategoryKey } from '@/data/catalog/categories';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import type { LightId } from '@/theme/lights';

/** Activities planned per category, counted from the real list (never guessed). */
export type CategoryCounts = Partial<Record<CategoryKey, number>>;

/**
 * A category on its cover photo: its name, what it is for, and how many
 * activities are planned in it right now (only when there are some). Opens
 * the category's page, which lists what is planned, or says nothing is yet.
 */
export const CategoryTile = memo(function CategoryTile({ category, width, height, count, light }: { category: CatalogCategory; width: number; height: number; count?: number; light: LightId }) {
  const router = useRouter();
  const label = tx(category.label);
  const planned = count ? tx(count === 1 ? '{n} activity' : '{n} activities', { n: count }) : null;
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.97}
      onPress={() => router.push(`/category/${category.id}` as never)}
      style={{ width }}
      accessibilityRole="link"
      accessibilityLabel={planned ? `${label}. ${planned}` : `${label}. ${tx(category.tagline)}`}
    >
      <Photo visual={{ photo: category.photo }} light={light} scrim="strong" style={[styles.tile, { height }]} width={500} recyclingKey={`category-${category.id}`}>
        <View style={styles.inner}>
          <View style={styles.top}>
            <Glass dark level="thin" style={styles.icon}>
              <Icon name={category.icon} size={16} color="#FFFFFF" />
            </Glass>
            {planned ? (
              <Glass dark level="thin" style={styles.count}>
                <Text variant="caption" tone="onDark" raw>
                  {String(count)}
                </Text>
              </Glass>
            ) : null}
          </View>
          <View>
            <Text variant="titleS" tone="onDark" numberOfLines={1}>
              {category.label}
            </Text>
            <Text variant="caption" color="rgba(255,255,255,0.78)" numberOfLines={1}>
              {planned ?? category.tagline}
            </Text>
          </View>
        </View>
      </Photo>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  tile: { borderRadius: radius.xl, overflow: 'hidden' },
  inner: { flex: 1, padding: 12, justifyContent: 'space-between' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  count: { minWidth: 28, height: 24, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
