import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionBar } from '@/components/social/ActionBar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { isOpenNow } from '@/features/bali/fit';
import { usePlace, usePlaceActivities } from '@/features/bali/data';
import { FOOD_PLANS, MOM_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useEngagement } from '@/features/server/engage';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const when = (ms: number) => new Date(ms).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const price = (n: number | null) => (n == null ? null : n === 0 ? 'Free' : '$'.repeat(n));
const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/**
 * A place (restaurant, café, beach, park): real data from the provider,
 * then the IRLY part: who's going, and plan something here. Plans are
 * ordinary activities linked to the place, so they have a chat, a
 * calendar entry and a pin on the map.
 */
export default function PlaceScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: p, loading, error } = usePlace(slug);
  const going = usePlaceActivities(slug);
  const eng = useEngagement('place', p ? [p.slug] : []);
  const now = useNow();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: t.c.bg }]}>
        <ActivityIndicator color={t.c.text} />
      </View>
    );
  }
  if (!p) {
    return (
      <View style={[styles.center, { backgroundColor: t.c.bg, gap: 12 }]}>
        <Text variant="titleM">{error ? 'Could not load this place' : 'Place not found'}</Text>
        <Button label="Back" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const city = CITIES[p.cityId as CityId];
  const open = isOpenNow(p.openingHours, city?.utcOffset ?? 4, new Date(now));
  const food = p.kind === 'restaurant' || p.kind === 'cafe';
  const kids = Boolean(p.amenities.good_for_children) || p.tags.includes('kids');
  const types = food ? FOOD_PLANS : MOM_PLANS.filter((m) => kids || !m.id.includes('KIDS'));
  const hoursText = (p.openingHours as { weekdayDescriptions?: string[] } | null)?.weekdayDescriptions;

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {p.photo ? (
            <Image source={{ uri: p.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <Photo visual={{ photo: food ? 'dinner' : 'beachSunset' }} light={city?.light ?? 'dubai'} scrim="strong" style={StyleSheet.absoluteFill} width={1000} />
          )}
          <View style={styles.scrim} />
          <View style={styles.heroText}>
            <Text variant="overline" color="#FFFFFF">
              {[label(p.kind), ...p.cuisines.slice(0, 2).map(label)].join(' · ')}
            </Text>
            <Text variant="displayM" color="#FFFFFF">
              {p.name}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <ActionBar target={{ type: 'place', id: p.slug, title: p.name }} eng={eng} />
          <View style={styles.facts}>
            {p.rating != null ? <Fact icon="star" text={`${p.rating.toFixed(1)} · ${(p.reviewCount ?? 0).toLocaleString('en-US')} ${tx('reviews')}`} /> : null}
            {price(p.priceLevel) ? <Fact icon="banknote" text={price(p.priceLevel) as string} /> : null}
            {open != null ? <Fact icon="clock" text={open ? tx('Open now') : tx('Closed now')} tone={open ? t.c.positive : t.c.live} /> : null}
            {kids ? <Fact icon="baby" text={tx('Kid-friendly')} /> : null}
            {p.address ? <Fact icon="pin" text={p.address} /> : null}
          </View>

          <View style={styles.links}>
            {p.bookingUrl ? <Button label="Book" icon="calendar" size="sm" onPress={() => Linking.openURL(p.bookingUrl as string)} /> : null}
            {p.website ? <Button label="Website" icon="globe" size="sm" variant="secondary" onPress={() => Linking.openURL(p.website as string)} /> : null}
            {p.menuUrl ? <Button label="Menu" icon="file" size="sm" variant="secondary" onPress={() => Linking.openURL(p.menuUrl as string)} /> : null}
            {p.phone ? <Button label="Call" icon="message" size="sm" variant="secondary" onPress={() => Linking.openURL(`tel:${p.phone}`)} /> : null}
            {p.lat != null && p.lng != null ? (
              <Button label="Directions" icon="navigation" size="sm" variant="secondary" onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`)} />
            ) : null}
          </View>

          <View style={{ gap: 10 }}>
            <Text variant="titleM">{tx("Who's going?")}</Text>
            {going.data.length ? (
              going.data.map((a) => (
                <PressableScale key={a.id} onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={a.title}>
                  <Icon name={a.audience === 'moms' ? 'baby' : a.audience === 'girls' ? 'heart' : 'users'} size={18} color={t.c.text} />
                  <View style={{ flex: 1 }}>
                    <Text variant="titleS" numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text variant="caption" tone="tertiary">
                      {when(a.startsAt)} · {a.going} {tx('going')}
                    </Text>
                  </View>
                  <Text variant="label">{tx('Join')}</Text>
                </PressableScale>
              ))
            ) : (
              <Text variant="bodyS" tone="secondary">
                {food ? 'Nobody has planned anything here yet. Find someone to eat with:' : 'Nothing planned here yet. Start something:'}
              </Text>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: t.c.surface }]}>
            <Text variant="titleM">{food ? tx('Find someone to eat with') : tx('Plan something here')}</Text>
            <QuickPlan cityId={p.cityId as CityId} types={types} place={{ id: p.id, name: p.name, areaId: p.areaId }} />
          </View>

          {hoursText?.length ? (
            <View style={{ gap: 4 }}>
              <Text variant="label" tone="secondary">
                Opening hours
              </Text>
              {hoursText.map((h) => (
                <Text key={h} variant="bodyS" tone="secondary">
                  {h}
                </Text>
              ))}
            </View>
          ) : null}

          {p.photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {p.photos.slice(1).map((u) => (
                <Image key={u} source={{ uri: u }} style={styles.thumb} contentFit="cover" />
              ))}
            </ScrollView>
          ) : null}

          {p.provider === 'google' ? (
            <Text variant="caption" tone="tertiary">
              {tx('Rating, hours and photos from Google. Updated {date}.', { date: p.fetchedAt ? new Date(p.fetchedAt).toLocaleDateString('en-GB') : '—' })}
            </Text>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <IconButton icon="chevronLeft" label="Back" variant="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </View>
  );
}

function Fact({ icon, text, tone }: { icon: IconName; text: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={16} color={tone ?? t.c.textSecondary} />
      <Text variant="bodyS" color={tone} style={{ flexShrink: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { height: 340, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)' },
  heroText: { padding: space.gutter, gap: 6 },
  body: { padding: space.gutter, gap: space[5] },
  facts: { gap: 8 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  card: { padding: 16, borderRadius: radius.xl, gap: 12 },
  thumb: { width: 180, height: 120, borderRadius: radius.lg },
  top: { position: 'absolute', left: space.gutter, top: 0 },
});
