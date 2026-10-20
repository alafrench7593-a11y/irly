import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/AppFrame';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Skeleton } from '@/components/ui/Skeleton';
import { enter } from '@/motion/enter';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { CITIES, placeLabel } from '@/data/destinations';
import { ScopeToggle } from '@/components/ui/ScopeToggle';
import { useCityFilter } from './scope';
import type { CityId } from '@/data/types';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/motion/PressableScale';
import { useAccount } from '@/features/auth/account';
import { joinServerActivity, useRecommendations, useServerActivities, type ServerActivity } from './activities';


/**
 * "Planned by members": real sessions other people created, from the
 * server, as a two-column grid of glass cards on the Home. Join is
 * capacity-checked and drops you into the activity chat. Hidden when
 * signed out or when nothing is planned yet.
 */
export function MemberActivities({ cityId }: { cityId: CityId }) {
  const { activities, refresh, loading } = useServerActivities(cityId);
  const frame = useFrame();
  const reduced = useReducedMotion();
  const w = (frame.width - space.gutter * 2 - 12) / 2;
  const recs = useRecommendations(cityId);
  const { narrow } = useCityFilter(cityId);
  const signedIn = Boolean(useAccount());
  // Signed out, the server lists nothing: never say "nothing planned" when plans exist.
  if (!signedIn) return null;
  // Narrowed to one emirate and empty: keep the switch so « All Emirates » stays one tap away.
  if (!activities.length && !narrow && !loading) return null;
  // Recommended first (interests, friends going), then the rest by date.
  const rank = new Map(recs.map((r, i) => [r.id, i]));
  const ordered = [...activities].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.startsAt - b.startsAt);
  return (
    <View style={{ marginTop: space[8] }}>
      <SectionHeader overline="Live on IRLY" title="Planned by members" />
      <ScopeToggle cityId={cityId} />
      {!activities.length && loading ? (
        <View style={styles.grid} accessibilityLabel="Loading plans">
          {[0, 1].map((i) => (
            <Skeleton key={i} width={w} height={Math.round(w * 0.72) + 150} radius={radius.xl} />
          ))}
        </View>
      ) : null}
      {!activities.length && !loading ? (
        <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
          {tx('Nothing planned in {city} yet. See all the Emirates, or plan the first one.', { city: CITIES[cityId].name })}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {ordered.map((a, i) => (
          <Animated.View key={a.id} entering={reduced ? undefined : enter.rise(Math.min(i, 6))}>
            <MemberCard a={a} cityId={cityId} width={w} onChanged={refresh} friendsGoing={recs.find((r) => r.id === a.id)?.friendsGoing ?? 0} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function MemberCard({ a, cityId, width, onChanged, friendsGoing }: { a: ServerActivity; cityId: CityId; width: number; onChanged: () => void; friendsGoing: number }) {
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const city = CITIES[cityId];
  const category = CATEGORY_BY_ID[a.categoryId as CategoryKey];
  const full = a.capacity != null && a.going >= a.capacity;
  const me = useAccount()?.userId;
  const mine = a.creatorId === me;

  const join = async () => {
    setBusy(true);
    try {
      const res = await joinServerActivity(a.id);
      if (res === 'full') {
        toast('Just filled up. Try another one', 'x', 'live');
      } else {
        haptic('success');
        toast("You're in. Activity chat unlocked", 'check', 'positive');
        if (res) router.push(`/messages/${res}`);
      }
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PressableScale onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, { width, boxShadow: t.shadow.card }]} accessibilityLabel={a.title}>
      <GlassLayer radius={radius.xl} />
      <Photo visual={{ photo: ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined, a.subId), uri: a.coverUrl }} light={city.light} style={[styles.photo, { height: Math.round(width * 0.72) }]} width={500} recyclingKey={`srv-${a.id}`} />
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={[styles.dot, { backgroundColor: category?.color ?? t.c.text }]} />
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {category?.label ?? 'Activity'}
          </Text>
        </View>
        <Text variant="titleS" numberOfLines={2}>
          {a.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {placeLabel(city.id, a.cityId, a.areaId, a.placeName)}
        </Text>
        <View style={styles.row}>
          <Icon name="clock" size={12} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {cityWhen(a.startsAt, city.id)}
          </Text>
        </View>
        <View style={styles.row}>
          <Icon name="users" size={12} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary" numberOfLines={1} style={{ flexShrink: 1 }}>
            {[
              tx(a.capacity ? '{n}/{cap} going' : '{n} going', { n: a.going, cap: a.capacity ?? 0 }),
              friendsGoing ? tx(friendsGoing > 1 ? '{n} friends' : '{n} friend', { n: friendsGoing }) : null,
              a.priceMinor ? `${a.currency} ${(a.priceMinor / 100).toLocaleString('en-US')}` : tx('Free'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {mine ? (
          // Your own plan: you organise it, you don't join it.
          <Button label="Your plan · Manage" size="sm" variant="secondary" icon="settings" onPress={() => router.push(`/a/${a.id}`)} />
        ) : (
          <Button
            label={a.joined ? "You're going" : full ? 'Full' : 'Join'}
            size="sm"
            variant={a.joined ? 'secondary' : 'primary'}
            icon={a.joined ? 'check' : 'plus'}
            disabled={a.joined || full}
            loading={busy}
            onPress={join}
          />
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: space.gutter },
  card: { borderRadius: radius.xl, overflow: 'hidden' },
  photo: { margin: 6, marginBottom: 0, borderRadius: radius.xl - 6, overflow: 'hidden' },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
