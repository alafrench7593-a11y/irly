import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip, Field } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { isOpenNow } from '@/features/bali/fit';
import { useDestAreas, usePlaces, type PlaceHit } from '@/features/bali/data';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const CUISINES = ['indonesian', 'balinese', 'french', 'italian', 'japanese', 'korean', 'thai', 'vietnamese', 'chinese', 'indian', 'middle_eastern', 'mexican', 'american', 'mediterranean', 'healthy', 'vegan', 'vegetarian', 'seafood', 'steakhouse', 'pizza', 'burger', 'bakery', 'dessert', 'sushi', 'fine_dining', 'brunch', 'coffee', 'cafe'];
const MEALS = ['breakfast', 'brunch', 'lunch', 'dinner'];
// Curated by IRLY (tags), not provided by Google.
const STYLES = ['warung', 'beach', 'beach_club', 'rooftop', 'work_friendly', 'romantic', 'live_music', 'late_night'];
const RATINGS = [4, 4.5, 4.7, 4.8];
const label = (s: string) => tx(s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()));

/**
 * Restaurants and cafés, ranked by IRLY (rating weighed by review volume,
 * IRLY popularity, data freshness) with real data from the provider.
 * Works for every destination; Bali gets its areas from the database.
 */
export default function Eat() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string; kids?: string; city?: string }>();
  // "Restaurants in Canggu" asked from Dubai opens Bali's list, not Dubai's.
  const current = useCityId();
  const cityId = params.city && Object.prototype.hasOwnProperty.call(CITIES, params.city) ? (params.city as CityId) : current;
  const city = CITIES[cityId];
  const areas = useDestAreas(cityId);
  const now = useNow();
  const [q, setQ] = useState('');
  const [area, setArea] = useState<string | null>(params.area ?? null);
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [kids, setKids] = useState(params.kids === '1');
  const [openNow, setOpenNow] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  // Search waits for a pause in typing.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQuery(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const { data, loading, error } = usePlaces(cityId, { area, kind: 'restaurant', cuisine, minRating, maxPrice, kids, tags, q: query });
  const list = useMemo(() => (openNow ? data.filter((p) => isOpenNow(p.openingHours, city.utcOffset, new Date(now)) === true) : data), [data, openNow, city, now]);
  const mainAreas = areas.data.filter((a) => a.kind !== 'neighborhood');
  const toggle = (tag: string) => setTags((ts) => (ts.includes(tag) ? ts.filter((x) => x !== tag) : [...ts, tag]));

  return (
    <Page overline={city.name} title="Where to eat" subtitle="Ranked by rating and how many people rated it, not rating alone. Then: find someone to eat with.">
      <View style={styles.body}>
        <Field icon="search" placeholder={tx('Search a restaurant or cuisine')} value={q} onChangeText={setQ} autoCorrect={false} accessibilityLabel="Search restaurants" />
        <Filters>
          <Chip size="sm" label={tx('All areas')} selected={!area} onPress={() => setArea(null)} />
          {(mainAreas.length ? mainAreas : city.areas.map((a) => ({ id: a.id, name: a.name }))).map((a) => (
            <Chip key={a.id} size="sm" label={a.name} selected={area === a.id} onPress={() => setArea(area === a.id ? null : a.id)} />
          ))}
        </Filters>
        <Filters>
          <Chip size="sm" icon="clock" label={tx('Open now')} selected={openNow} onPress={() => setOpenNow(!openNow)} />
          <Chip size="sm" icon="baby" label={tx('With kids')} selected={kids} onPress={() => setKids(!kids)} />
          {RATINGS.map((r) => (
            <Chip key={r} size="sm" icon="star" label={`${r.toFixed(1)}+`} selected={minRating === r} onPress={() => setMinRating(minRating === r ? null : r)} />
          ))}
          {[1, 2, 3, 4].map((n) => (
            <Chip key={n} size="sm" label={`≤ ${'$'.repeat(n)}`} selected={maxPrice === n} onPress={() => setMaxPrice(maxPrice === n ? null : n)} />
          ))}
        </Filters>
        <Filters>
          {MEALS.map((m) => (
            <Chip key={m} size="sm" label={label(m)} selected={tags.includes(m)} onPress={() => toggle(m)} />
          ))}
          {STYLES.map((m) => (
            <Chip key={m} size="sm" label={label(m)} selected={tags.includes(m)} onPress={() => toggle(m)} />
          ))}
        </Filters>
        <Filters>
          {CUISINES.map((c) => (
            <Chip key={c} size="sm" label={label(c)} selected={cuisine === c} onPress={() => setCuisine(cuisine === c ? null : c)} />
          ))}
        </Filters>

        {loading ? (
          <ActivityIndicator color={t.c.text} />
        ) : error ? (
          <Text variant="body" tone="secondary">
            Could not load restaurants. Check your connection.
          </Text>
        ) : !list.length ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="utensils" size={22} color={t.c.textSecondary} />
            <Text variant="body" tone="secondary" align="center">
              {data.length ? 'Nothing matches these filters. Loosen one.' : 'Restaurants for this destination are being added. Try another filter or come back soon.'}
            </Text>
          </View>
        ) : (
          list.map((p, i) => <Card key={p.id} p={p} rank={i + 1} open={isOpenNow(p.openingHours, city.utcOffset, new Date(now))} onPress={() => router.push(`/place/${p.slug}`)} cityId={cityId} />)
        )}
      </View>
    </Page>
  );
}

function Filters({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: space.gutter }} style={{ marginHorizontal: -space.gutter }}>
      {children}
    </ScrollView>
  );
}

function Card({ p, rank, open, onPress, cityId }: { p: PlaceHit; rank: number; open: boolean | null; onPress: () => void; cityId: CityId }) {
  const t = useTheme();
  const city = CITIES[cityId];
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.98} style={[styles.card, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]} accessibilityLabel={p.name}>
      <View style={styles.photo}>
        {p.photo ? (
          <Image source={{ uri: p.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={p.id} />
        ) : (
          <Photo visual={{ photo: 'dinner' }} light={city.light} scrim="soft" style={StyleSheet.absoluteFill} width={500} />
        )}
        <View style={[styles.rank, { backgroundColor: t.c.bg }]}>
          <Text variant="label">{rank}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text variant="titleS" numberOfLines={1}>
          {p.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[p.rating != null ? `★ ${p.rating.toFixed(1)} (${(p.reviewCount ?? 0).toLocaleString('en-US')})` : null, p.priceLevel ? '$'.repeat(p.priceLevel) : null, p.cuisines[0] ? label(p.cuisines[0]) : null, p.areaId]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.meta}>
          {open != null ? (
            <Text variant="caption" color={open ? t.c.positive : t.c.textTertiary}>
              {open ? tx('Open now') : tx('Closed now')}
            </Text>
          ) : null}
          {p.going ? (
            <Text variant="caption" tone="secondary">
              · {tx('{n} plans here', { n: p.going })}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 12 },
  card: { flexDirection: 'row', borderRadius: radius.xl, overflow: 'hidden', minHeight: 104 },
  photo: { width: 112 },
  rank: { position: 'absolute', top: 8, left: 8, minWidth: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  info: { flex: 1, padding: 12, gap: 4, justifyContent: 'center' },
  meta: { flexDirection: 'row', gap: 4 },
  empty: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
});
