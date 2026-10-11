import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useBadges, useToday, type Badge } from './engage';

/** Today on IRLY: real activities of the day, with time, place, organiser and spots. Hidden when there are none. */
export function TodayStrip({ cityId }: { cityId: CityId }) {
  const t = useTheme();
  const router = useRouter();
  const { items } = useToday(cityId);
  if (!items.length) return null;
  const city = CITIES[cityId];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
      {items.map((a) => (
        <PressableScale key={a.id} haptic="select" scaleTo={0.97} onPress={() => router.push(`/a/${a.id}`)} style={[styles.today, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityLabel={a.title}>
          <Text variant="overline" tone="accent">
            {cityWhen(a.startsAt, cityId)}
          </Text>
          <Text variant="titleS" numberOfLines={2} raw>
            {a.title}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} raw>
            {a.place ?? areaName(city, a.areaId)}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {[a.organizer ? tx('by {name}', { name: a.organizer }) : null, tx('{n} going', { n: a.going }), a.spotsLeft != null ? tx('{n} spots left', { n: a.spotsLeft }) : null].filter(Boolean).join(' · ')}
          </Text>
          {a.iGo ? (
            <Text variant="label" tone="accent">
              {tx("You're going")}
            </Text>
          ) : null}
        </PressableScale>
      ))}
    </ScrollView>
  );
}

/** The door to "my recap": what I missed, my next plans, groups for me, challenges. */
export function RecapDoor() {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/recap')} style={[styles.door, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityLabel={tx('My recap')}>
      <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
        <Icon name="sparkles" size={18} color={t.c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS">My recap</Text>
        <Text variant="caption" tone="secondary">
          What you missed, your next plans, groups for you
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
    </PressableScale>
  );
}

const BADGES: Record<Badge['badge'], { icon: IconName; names: [string, string, string]; what: string }> = {
  organizer: { icon: 'calendar', names: ['Organiser', 'Confirmed organiser', 'Super organiser'], what: '{n} activities organised' },
  helper: { icon: 'heart', names: ['Helpful', 'Very helpful', 'Pillar of the community'], what: '{n} useful answers' },
  explorer: { icon: 'compass', names: ['Explorer', 'Regular', 'Always out there'], what: '{n} activities joined' },
};

/** Badges earned by what the member really did (shown on profiles). */
export function BadgesRow({ userId }: { userId: string }) {
  const t = useTheme();
  const { items } = useBadges(userId);
  if (!items.length) return null;
  return (
    <View style={styles.badges}>
      {items.map((b) => {
        const d = BADGES[b.badge];
        return (
          <View key={b.badge} style={[styles.badge, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityLabel={`${tx(d.names[b.level - 1])}, ${tx(d.what, { n: b.count })}`}>
            <Icon name={d.icon} size={14} color={t.c.text} />
            <Text variant="caption">{tx(d.names[b.level - 1])}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  today: { width: 210, padding: 14, gap: 4, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  door: { marginHorizontal: space.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth * 2 },
});
