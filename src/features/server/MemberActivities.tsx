import { useRouter } from 'expo-router';
import { cityWhen } from '@/lib/time';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { haptic } from '@/motion/haptics';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/motion/PressableScale';
import { joinServerActivity, useRecommendations, useServerActivities, type ServerActivity } from './activities';


/**
 * "Planned by members": real sessions other people created, from the
 * server. Join is capacity-checked and drops you into the activity chat.
 * Hidden when signed out or when nothing is planned yet.
 */
export function MemberActivities({ cityId }: { cityId: CityId }) {
  const { activities, refresh } = useServerActivities(cityId);
  const recs = useRecommendations(cityId);
  if (!activities.length) return null;
  // Recommended first (interests, friends going), then the rest by date.
  const rank = new Map(recs.map((r, i) => [r.id, i]));
  const ordered = [...activities].sort((a, b) => (rank.get(a.id) ?? 99) - (rank.get(b.id) ?? 99) || a.startsAt - b.startsAt);
  return (
    <View style={{ marginTop: space[8] }}>
      <SectionHeader overline="Live on IRLY" title="Planned by members" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 12 }}>
        {ordered.map((a) => (
          <MemberCard key={a.id} a={a} cityId={cityId} onChanged={refresh} friendsGoing={recs.find((r) => r.id === a.id)?.friendsGoing ?? 0} />
        ))}
      </ScrollView>
    </View>
  );
}

function MemberCard({ a, cityId, onChanged, friendsGoing }: { a: ServerActivity; cityId: CityId; onChanged: () => void; friendsGoing: number }) {
  const t = useTheme();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const city = CITIES[cityId];
  const category = CATEGORY_BY_ID[a.categoryId as CategoryKey];
  const full = a.capacity != null && a.going >= a.capacity;

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
    <PressableScale onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]} accessibilityLabel={a.title}>
      <Photo visual={{ photo: ideaPhoto((category?.id ?? 'sport') as CategoryKey, a.title, a.placeName ?? undefined) }} light={city.light} scrim="soft" style={styles.photo} width={500} recyclingKey={`srv-${a.id}`} />
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
        <Text variant="bodyS" tone="secondary" numberOfLines={1}>
          {cityWhen(a.startsAt, city.id)} · {a.placeName ?? areaName(city, a.areaId)}
        </Text>
        <View style={styles.row}>
          <Icon name="users" size={14} color={t.c.textSecondary} />
          <Text variant="caption" tone="secondary">
            {a.going}
            {a.capacity ? ` / ${a.capacity}` : ''} going{friendsGoing ? ` · ${friendsGoing} friend${friendsGoing > 1 ? 's' : ''}` : ''} · {a.priceMinor ? `${a.currency} ${(a.priceMinor / 100).toLocaleString('en-US')}` : 'Free'}
          </Text>
        </View>
        <Button
          label={a.joined ? "You're going" : full ? 'Full' : 'Join'}
          size="sm"
          variant={a.joined ? 'secondary' : 'primary'}
          icon={a.joined ? 'check' : 'plus'}
          disabled={a.joined || full}
          loading={busy}
          onPress={join}
        />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { width: 240, borderRadius: radius.xl, overflow: 'hidden' },
  photo: { height: 120 },
  body: { padding: 14, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
