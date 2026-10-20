import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useAuthStatus } from '@/features/auth/account';
import { cityDayKey, cityWhen } from '@/lib/time';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { enter } from '@/motion/enter';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { useCalendar, type CalendarItem } from '@/features/server/activities';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { SpaceFlavor } from '@/theme/space';

// Days and hours in each activity's own city (a Bali plan seen from Dubai stays at Bali time).
const dayKey = (ms: number, city: string) => cityDayKey(ms, city);
const dayLabel = (ms: number, city: string) => {
  const key = cityDayKey(ms, city);
  if (key === cityDayKey(Date.now(), city)) return 'Today';
  if (key === cityDayKey(Date.now() + 86400000, city)) return 'Tomorrow';
  return cityWhen(ms, city, { weekday: 'long', day: 'numeric', month: 'long' });
};
const hour = (ms: number, city: string) => cityWhen(ms, city, { hour: '2-digit', minute: '2-digit' });

/**
 * Your calendar: every activity and event you're going to or hosting,
 * by day. Joining anywhere in the app adds it here at once.
 */
export default function CalendarRoute() {
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <CalendarScreen />
    </SpaceFlavor>
  );
}

function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { items, loading, error } = useCalendar();
  const auth = useAuthStatus();

  // One header per calendar day, even when plans in different cities interleave by time.
  const days: { key: string; label: string; items: CalendarItem[] }[] = [];
  const byKey = new Map<string, (typeof days)[number]>();
  for (const it of items) {
    const k = dayKey(it.startsAt, it.cityId);
    const day = byKey.get(k);
    if (day) day.items.push(it);
    else {
      const fresh = { key: k, label: dayLabel(it.startsAt, it.cityId), items: [it] };
      byKey.set(k, fresh);
      days.push(fresh);
    }
  }

  return (
    <Page overline="Your plans" title="Calendar" subtitle="Everything you're going to, in one place.">
      <View style={styles.body}>
        {auth === 'unknown' ? (
          <ActivityIndicator color={t.c.textSecondary} style={{ marginTop: 24 }} />
        ) : auth === 'out' ? (
          <Empty text="Sign in to keep your plans in sync across devices." action="Sign in" onPress={() => router.push('/account')} />
        ) : error && !items.length ? (
          <Empty text="Can’t reach IRLY right now. Check your connection and try again." action="Find something to do" onPress={() => router.push('/discover')} />
        ) : !loading && !items.length ? (
          <Empty text="Nothing planned yet. Join a session or create one." action="Find something to do" onPress={() => router.push('/discover')} />
        ) : (
          days.map((d, idx) => (
            <Animated.View key={d.key} entering={enter.rise(Math.min(idx, 8), 60)}>
              <View style={{ gap: 10 }}>
                <Text variant="overline" tone="tertiary">
                  {d.label}
                </Text>
                {d.items.map((it) => {
                  const cat = CATEGORY_BY_ID[it.categoryId as CategoryKey];
                  return (
                    <PressableScale key={it.id} onPress={() => router.push(`/a/${it.id}`)} haptic="select" scaleTo={0.98} style={[styles.item, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={it.title}>
                      <GlassLayer radius={radius.lg} />
                      <View style={[styles.bar, { backgroundColor: cat?.color ?? t.c.text }]} />
                      <View style={{ width: 52 }}>
                        <Text variant="titleS">{hour(it.startsAt, it.cityId)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text variant="titleS" numberOfLines={1}>
                          {it.title}
                        </Text>
                        <Text variant="caption" tone="tertiary" numberOfLines={1}>
                          {it.hosting ? `${tx('Hosting')} · ` : ''}
                          {it.format === 'event' ? `${tx('Event')} · ` : ''}
                          {it.placeName ?? it.areaId}
                        </Text>
                      </View>
                      {it.conversationId ? (
                        <PressableScale onPress={() => router.push(`/messages/${it.conversationId}`)} haptic="select" hitSlop={8} accessibilityLabel="Open chat">
                          <Icon name="message" size={20} color={t.c.text} />
                        </PressableScale>
                      ) : null}
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>
          ))
        )}
      </View>
    </Page>
  );
}

function Empty({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.rise(0, 60)} style={[styles.empty, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <Icon name="calendar" size={24} color={t.c.textSecondary} />
      <Text variant="body" tone="secondary" align="center">
        {text}
      </Text>
      <Button label={action} size="sm" onPress={onPress} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[6] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingLeft: 0, borderRadius: radius.lg, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  empty: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl },
});
