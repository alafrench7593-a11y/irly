import { useRouter } from 'expo-router';
import { cityWhen } from '@/lib/time';
import { t as tx } from '@/i18n';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Photo } from '@/components/visual/Photo';
import { enter } from '@/motion/enter';
import { girlPhotoFor } from './photos';
import { Avatar } from '@/components/ui/Avatar';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { joinCommunity, useCommunitiesLike, useGirlCircle, useGirlExtras, usePlaces } from '@/features/bali/data';
import { MOM_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useServerActivities } from '@/features/server/activities';
import { hueOf } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { girl } from './theme';
import { GButton, GChip, GSection, Wrap } from './ui';

const AGES = [
  { id: 'baby', label: 'Baby' },
  { id: 'toddler', label: 'Toddler' },
  { id: 'kid', label: 'Kid' },
  { id: 'teen', label: 'Teen' },
];

/**
 * IRLY Moms, inside IRLY Girl (same account, same women-only rule). Mom
 * mode is optional: turn it on to appear to other moms and see them. Then:
 * moms near you, mom communities, plans with children (playdates, beach,
 * park, kids sports…) and family-friendly places. Dubai and Bali alike,
 * with each destination's own communities and places.
 */
export function MomsView({ cityId }: { cityId: CityId }) {
  const router = useRouter();
  const city = CITIES[cityId];
  const extras = useGirlExtras();
  const me = extras.data;
  const moms = useGirlCircle(cityId, { moms: true });
  const communities = useCommunitiesLike(cityId, 'Moms', true);
  const { activities } = useServerActivities(cityId);
  const family = usePlaces(cityId, { kids: true });
  const plans = activities.filter((a) => ['family'].includes(a.categoryId) || /kid|mom|family|playdate|picnic/i.test(a.title));

  const toggleMom = (on: boolean) =>
    extras
      .save({ momMode: on })
      .then(() => {
        haptic('success');
        toast(on ? 'Mom mode on: other moms can find you' : 'Mom mode off', 'heart', 'brand');
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));

  const join = (id: string, name: string) =>
    joinCommunity(id)
      .then((conv) => {
        haptic('success');
        toast(tx('You joined {name}', { name }), 'users', 'brand');
        if (conv) router.push(`/messages/${conv}`);
        communities.reload();
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live'));

  return (
    <View style={{ gap: space[7], paddingTop: space[5] }}>
      <Animated.View entering={enter.rise(0)} style={[styles.pad, { gap: 12 }]}>
        <Text variant="body" color={girl.inkSoft}>
          {tx('Moms in {city}, plans with children and family-friendly places.', { city: city.name })}
        </Text>
        <View style={styles.mosaic}>
          {(['momYoga', 'momBeach', 'momBaby'] as const).map((k, i) => (
            <Animated.View key={k} entering={enter.pop(i, 120)} style={[styles.tile, i === 0 ? { flex: 1.3 } : null]}>
              <Photo visual={{ photo: k }} light="dubai" scrim="soft" width={500} style={StyleSheet.absoluteFill} />
              <Text variant="label" color="#FFFFFF" style={styles.tileLabel}>
                {['Baby yoga', 'Beach days', 'New moms'][i]}
              </Text>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {me && me.hasProfile ? (
        <View style={[styles.pad]}>
          <View style={[styles.card, { gap: 12 }]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink}>
                  Mom mode
                </Text>
                <Text variant="bodyS" color={girl.inkSoft}>
                  Optional. Other moms see you as a mom, nothing more.
                </Text>
              </View>
              <GChip label={me.momMode ? 'On' : 'Off'} selected={me.momMode} onPress={() => toggleMom(!me.momMode)} />
            </View>
            {me.momMode ? (
              <View style={{ gap: 6 }}>
                <Text variant="caption" color={girl.inkSoft}>
                  Children’s ages (no names, ever)
                </Text>
                <Wrap>
                  {AGES.map((a) => {
                    const on = (me.kidsAgeGroups ?? []).includes(a.id);
                    return (
                      <GChip
                        key={a.id}
                        small
                        label={a.label}
                        selected={on}
                        onPress={() => extras.save({ kidsAgeGroups: on ? (me.kidsAgeGroups ?? []).filter((x) => x !== a.id) : [...(me.kidsAgeGroups ?? []), a.id] }).catch(() => undefined)}
                      />
                    );
                  })}
                </Wrap>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {moms.data.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="titleM" color={girl.ink} style={styles.pad}>
            {tx('Moms in {city}', { city: city.name })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 12 }}>
            {moms.data.map((m) => (
              <View key={m.userId} style={[styles.person]}>
                <Avatar name={m.firstName} hue={hueOf(m.userId)} size={56} />
                <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
                  {m.firstName}
                </Text>
                <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                  {[m.kidsAgeGroups.map((k) => tx(k)).join(', '), m.areas[0]].filter(Boolean).join(' · ') || tx('Mom')}
                </Text>
                {m.score != null ? (
                  <Text variant="caption" color={girl.rose}>
                    {m.score}% match
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : me?.momMode ? (
        <Text variant="bodyS" color={girl.inkSoft} style={styles.pad}>
          No other moms visible yet in this destination. Start a playdate: they will find you.
        </Text>
      ) : null}

      <View style={[styles.pad]}>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ height: 110 }}>
            <Photo visual={{ photo: 'familyBeach' }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
          </View>
          <View style={{ padding: 16 }}>
          <GSection title="Plan something with the kids" hint="Playdates, beach, park, kids sports, workshops.">
            <QuickPlan cityId={cityId} types={MOM_PLANS} palette="girl" />
          </GSection>
          </View>
        </View>
      </View>

      {plans.length ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM" color={girl.ink}>
            Coming up with kids
          </Text>
          {plans.slice(0, 6).map((a) => (
            <PressableScale key={a.id} onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, styles.row, { padding: 10 }]} accessibilityLabel={a.title}>
              <View style={styles.thumb}>
                <Photo visual={{ photo: girlPhotoFor(a.title, 'momPlaydate') }} light="dubai" width={200} style={StyleSheet.absoluteFill} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink} numberOfLines={1}>
                  {a.title}
                </Text>
                <Text variant="caption" color={girl.inkSoft}>
                  {cityWhen(a.startsAt, cityId, { weekday: 'short', hour: '2-digit', minute: '2-digit' })} · {a.going} {tx('going')}
                </Text>
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}

      <View style={[styles.pad, { gap: 10 }]}>
        <Text variant="titleM" color={girl.ink}>
          Mom communities
        </Text>
        {communities.data.length ? (
          communities.data.map((c) => (
            <PressableScale key={c.id} onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, styles.row, { padding: 10 }]} accessibilityLabel={c.name}>
              <View style={styles.thumb}>
                <Photo visual={{ photo: girlPhotoFor(c.name, 'momPlaydate') }} light="dubai" width={200} style={StyleSheet.absoluteFill} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink}>
                  {c.name}
                </Text>
                <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                  {[c.tagline ? tx(c.tagline) : null, c.members ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {c.member ? <GChip small label={tx('Joined')} selected /> : <GButton label="Join" onPress={() => join(c.id, c.name)} />}
            </PressableScale>
          ))
        ) : (
          <Text variant="bodyS" color={girl.inkSoft}>
            {communities.loading ? '' : communities.error ? tx('Could not load. Check your connection.') : me ? tx('No mom communities here yet.') : tx('Sign in to see and join mom communities.')}
          </Text>
        )}
      </View>

      {family.data.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="titleM" color={girl.ink} style={styles.pad}>
            Family-friendly places
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
            {family.data.slice(0, 12).map((p) => (
              <PressableScale key={p.id} onPress={() => router.push(`/place/${p.slug}`)} haptic="select" scaleTo={0.97} style={[styles.place]} accessibilityLabel={p.name}>
                {p.photo ? (
                  <Image source={{ uri: p.photo }} style={styles.placePhoto} contentFit="cover" />
                ) : (
                  <View style={styles.placePhoto}>
                    <Photo visual={{ photo: p.kind === 'beach' ? 'momBeach' : p.kind === 'park' ? 'momPlaydate' : 'familyBeach' }} light="dubai" width={400} style={StyleSheet.absoluteFill} />
                  </View>
                )}
                <View style={{ padding: 10 }}>
                  <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
                    {p.name}
                  </Text>
                  <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                    {p.kind.replace('_', ' ')}
                    {p.rating != null ? ` · ★ ${p.rating.toFixed(1)}` : ''}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  card: { backgroundColor: girl.surface, borderRadius: radius.xl, padding: 16, boxShadow: girl.shadowSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  person: { width: 120, alignItems: 'center', gap: 4, padding: 12, borderRadius: radius.xl, backgroundColor: girl.surface },
  place: { width: 170, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: girl.surface },
  placePhoto: { width: 170, height: 100, overflow: 'hidden' },
  mosaic: { flexDirection: 'row', gap: 8, height: 150 },
  tile: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  tileLabel: { padding: 10 },
  thumb: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' },
});
