import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { gridTile, GRID_GAP } from '@/components/cards/HomeCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { CATEGORY_BY_ID, DISCOVERY_ORDER, type CatalogCategory } from '@/data/catalog/categories';
import { CITIES } from '@/data/destinations';
import { openCreate } from '@/features/create/createStore';
import { useHomeActivities } from '@/features/home/HomeActivities';
import { CategoryTile, type CategoryCounts } from '@/features/home/CategoryTile';
import { t as tx, useT } from '@/i18n';
import { enter } from '@/motion/enter';
import { useCityId } from '@/state/store';
import { space } from '@/theme/tokens';

/** Lowercase, no accents: "Cafés" is found by "cafe". */
const fold = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** What a category is found by: its name, its line and its sub-categories, in English and in the member's language. */
function searchText(c: CatalogCategory): string {
  const words = [c.label, c.tagline, ...c.subs.map((s) => s.label)];
  return fold([...words, ...words.map((w) => tx(w))].join(' '));
}

/**
 * Every category of the catalog, in the order members discover them, each
 * on its photo with the number of activities planned in it (when there are
 * some). The search reads names, lines and sub-categories ("padel", "brunch",
 * "dog"). The same screen in IRLY and IRLY Girl.
 */
export default function CategoriesScreen() {
  const router = useRouter();
  const tr = useT();
  const frame = useFrame();
  const reduced = useReducedMotion();
  const cityId = useCityId();
  const { items } = useHomeActivities(cityId);
  const [q, setQ] = useState('');
  const { width } = gridTile(frame.width);
  const light = CITIES[cityId].light;

  const counts = useMemo(() => {
    const m: CategoryCounts = {};
    for (const a of items) if (a.categoryId in CATEGORY_BY_ID) m[a.categoryId as keyof CategoryCounts] = (m[a.categoryId as keyof CategoryCounts] ?? 0) + 1;
    return m;
  }, [items]);
  const all = useMemo(() => DISCOVERY_ORDER.map((k) => ({ category: CATEGORY_BY_ID[k], text: searchText(CATEGORY_BY_ID[k]) })), []);
  const needle = fold(q.trim());
  const shown = needle ? all.filter((c) => c.text.includes(needle)) : all;

  return (
    <Page overline="Everything to do" title="All categories" subtitle="Pick what you feel like: every category, with what members plan in it.">
      <View style={styles.search}>
        <Field icon="search" placeholder="Search a category, a sport, a place…" value={q} onChangeText={setQ} autoCorrect={false} returnKeyType="search" accessibilityLabel={tr('Search categories')} />
      </View>
      {shown.length ? (
        <View style={styles.grid}>
          {shown.map(({ category }, i) => (
            <Animated.View key={category.id} entering={reduced ? undefined : enter.rise(Math.min(i, 8))}>
              <CategoryTile category={category} width={width} height={Math.round(width * 0.78)} count={counts[category.id]} light={light} />
            </Animated.View>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Text variant="body" tone="secondary" align="center">
            {tx('No category matches “{q}”.', { q: q.trim() })}
          </Text>
          <View style={styles.actions}>
            <Button label="Clear the search" size="sm" variant="secondary" onPress={() => setQ('')} />
            <Button label="Plan something" size="sm" icon="plus" onPress={() => openCreate(null)} />
          </View>
        </View>
      )}
      <View style={styles.back}>
        <Button label="Back to Home" size="sm" variant="ghost" icon="chevronLeft" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: space.gutter, marginBottom: space[4] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: space.gutter },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space[6], alignItems: 'center', gap: space[4] },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  back: { alignItems: 'center', marginTop: space[5] },
});
