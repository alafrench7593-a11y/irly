import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useAuthStatus } from '@/features/auth/account';
import { cityDayKey, cityWhen } from '@/lib/time';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { useCalendar, type CalendarItem } from '@/features/server/activities';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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
export default function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { items, loading, error } = useCalendar();
  const auth = useAuthStatus();

  const days: { key: string; label: string; items: CalendarItem[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.startsAt, it.cityId);
    const last = days[days.length - 1];
    if (last?.key === k) last.items.push(it);
    else days.push({ key: k, label: dayLabel(it.startsAt, it.cityId), items: [it] });
  }

  return (
    <Page overline="Your plans" title="Calendar" subtitle="Everything you're going to, in one place.">
      <View style={styles.body}>
        {auth === 'unknown' ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : auth === 'out' ? (
          <Empty text="Sign in to keep your plans in sync across devices." action="Sign in" onPress={() => router.push('/account')} />
        ) : error && !items.length ? (
          <Empty text="Can’t reach IRLY right now. Check your connection and try again." action="Find something to do" onPress={() => router.push('/discover')} />
        ) : !loading && !items.length ? (
          <Empty text="Nothing planned yet. Join a session or create one." action="Find something to do" onPress={() => router.push('/discover')} />
        ) : (
          days.map((d) => (
            <View key={d.key} style={{ gap: 10 }}>
              <Text variant="overline" tone="tertiary">
                {d.label}
              </Text>
              {d.items.map((it) => {
                const cat = CATEGORY_BY_ID[it.categoryId as CategoryKey];
                return (
                  <PressableScale key={it.id} onPress={() => router.push(`/a/${it.id}`)} haptic="select" scaleTo={0.98} style={[styles.item, { backgroundColor: t.c.surface }]} accessibilityLabel={it.title}>
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
          ))
        )}
      </View>
    </Page>
  );
}

function Empty({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
      <Icon name="calendar" size={24} color={t.c.textSecondary} />
      <Text variant="body" tone="secondary" align="center">
        {text}
      </Text>
      <Button label={action} size="sm" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[6] },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingLeft: 0, borderRadius: radius.lg, overflow: 'hidden' },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  empty: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl },
});
