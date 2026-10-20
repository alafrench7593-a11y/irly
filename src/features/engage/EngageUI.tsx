import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { enter } from '@/motion/enter';
import Animated from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { areaName, CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { t as tx } from '@/i18n';
import { cityWhen } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useBadges, useToday, type Badge, type TodayActivity } from './engage';
import { useServerActivities } from '@/features/server/activities';
import { useAppSpace } from '@/state/appSpace';
import { GlassLayer } from '@/components/ui/GlassLayer';

/** Today on IRLY: real activities of the day, with time, place, organiser and spots. Hidden when there are none. */
export function TodayStrip({ cityId }: { cityId: CityId }) {
  const inGirl = useAppSpace() === 'girl';
  return inGirl ? <GirlTodayStrip cityId={cityId} /> : <TodayList cityId={cityId} />;
}

/** IRLY Girl space: today's plans that are women only (the IRLY Girl list of plans, girl_only on the server). */
function GirlTodayStrip({ cityId }: { cityId: CityId }) {
  const { activities } = useServerActivities(cityId, { girlOnly: true });
  const keep = useMemo(() => {
    const ids = new Set(activities.filter((a) => a.girlOnly).map((a) => a.id));
    return (a: TodayActivity) => ids.has(a.id);
  }, [activities]);
  return <TodayList cityId={cityId} keep={keep} />;
}

function TodayList({ cityId, keep }: { cityId: CityId; keep?: (a: TodayActivity) => boolean }) {
  const router = useRouter();
  const { items: all } = useToday(cityId);
  const items = keep ? all.filter(keep) : all;
  if (!items.length) return null;
  const city = CITIES[cityId];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
      {items.map((a, idx) => (
        <Animated.View key={a.id} entering={enter.rise(Math.min(idx, 8))}>
          <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push(`/a/${a.id}`)} style={[styles.today, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]} accessibilityLabel={a.title}>
            <GlassLayer radius={radius.xl} />
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
        </Animated.View>
      ))}
    </ScrollView>
  );
}

/** The door to "my recap": what I missed, my next plans, groups for me, challenges. */
export function RecapDoor() {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/recap')} style={[styles.door, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]} accessibilityLabel={tx('My recap')}>
      <GlassLayer radius={radius.xl} />
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
          <View key={b.badge} style={[styles.badge, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]} accessibilityLabel={`${tx(d.names[b.level - 1])}, ${tx(d.what, { n: b.count })}`}>
            <GlassLayer radius={999} />
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
