import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Segmented } from '@/components/ui/Controls';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { dateLocale, t as tx } from '@/i18n';
import { cityWhen, offsetOf } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { duration } from '@/motion/tokens';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A community's agenda: its activities by day, a week or a month at a time
 * (the city's calendar, Monday first). The week shows its seven days with a
 * dot under the busy ones; the month, a calendar where a day can be picked.
 * Below, the activities grouped by day; a tap opens the activity.
 */

export type AgendaItem = { id: string; title: string; startsAt: number; going: number; pinned?: boolean; status?: string; subtitle?: string | null };
type Mode = 'week' | 'month';
const DAY = 86_400_000;

/** Midnight of the city's day containing `ms`, as a UTC timestamp of the shifted clock. */
const cityDay = (ms: number, cityId: string) => {
  const d = new Date(ms + offsetOf(cityId) * 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const fmt = (day: number, opts: Intl.DateTimeFormatOptions) => new Date(day).toLocaleDateString(dateLocale(), { ...opts, timeZone: 'UTC' });

export function Agenda({ items, cityId, loading, onOpen }: { items: AgendaItem[]; cityId: string; loading: boolean; onOpen: (id: string) => void }) {
  const t = useTheme();
  const now = useNow();
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<Mode>('week');
  const [shift, setShift] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const today = cityDay(now, cityId);

  // The range shown: Monday to Sunday of the week, or the month's days.
  const range = useMemo(() => {
    if (mode === 'week') {
      const d = new Date(today);
      const monday = today - ((d.getUTCDay() + 6) % 7) * DAY + shift * 7 * DAY;
      return { from: monday, to: monday + 7 * DAY };
    }
    const d = new Date(today);
    const from = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + shift, 1);
    const end = new Date(from);
    return { from, to: Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 1) };
  }, [mode, shift, today]);

  const byDay = useMemo(() => {
    const m = new Map<number, AgendaItem[]>();
    for (const a of items) {
      const day = cityDay(a.startsAt, cityId);
      if (day < range.from || day >= range.to) continue;
      m.set(day, [...(m.get(day) ?? []), a]);
    }
    for (const list of m.values()) list.sort((a, b) => a.startsAt - b.startsAt);
    return m;
  }, [items, cityId, range]);

  const days = [...byDay.keys()].sort((a, b) => a - b).filter((d) => picked === null || d === picked);
  const title = mode === 'week' ? `${fmt(range.from, { day: 'numeric', month: 'short' })} – ${fmt(range.to - DAY, { day: 'numeric', month: 'short' })}` : fmt(range.from, { month: 'long', year: 'numeric' });
  const move = (d: number) => {
    setShift((s) => s + d);
    setPicked(null);
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.pad}>
        <Segmented
          options={[
            { value: 'week', label: tx('Week') },
            { value: 'month', label: tx('Month') },
          ]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setShift(0);
            setPicked(null);
          }}
        />
      </View>
      <View style={[styles.pad, styles.nav]}>
        <PressableScale haptic="select" onPress={() => move(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={mode === 'week' ? 'Previous week' : 'Previous month'} style={styles.navBtn}>
          <Icon name="chevronLeft" size={18} color={t.c.text} />
        </PressableScale>
        <Text variant="titleS" align="center" style={{ flex: 1, textTransform: 'capitalize' }} raw>
          {title}
        </Text>
        <PressableScale haptic="select" onPress={() => move(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel={mode === 'week' ? 'Next week' : 'Next month'} style={styles.navBtn}>
          <Icon name="chevronRight" size={18} color={t.c.text} />
        </PressableScale>
      </View>

      <Animated.View key={`${mode}-${shift}`} entering={reduced ? undefined : FadeIn.duration(duration.fast)} style={[styles.pad, { gap: 12 }]}>
        {mode === 'week' ? (
          <View style={styles.week}>
            {Array.from({ length: 7 }, (_, i) => range.from + i * DAY).map((d) => (
              <DayCell key={d} day={d} label={fmt(d, { weekday: 'narrow' })} busy={byDay.has(d)} today={d === today} on={picked === d} onPress={() => setPicked((p) => (p === d ? null : d))} />
            ))}
          </View>
        ) : (
          <MonthGrid from={range.from} to={range.to} today={today} busy={byDay} picked={picked} onPick={(d) => setPicked((p) => (p === d ? null : d))} />
        )}

        {loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={18} width="40%" />
            <Skeleton height={64} radius={radius.lg} />
            <Skeleton height={64} radius={radius.lg} />
          </View>
        ) : days.length ? (
          days.map((d, i) => (
            <Animated.View key={d} entering={reduced ? undefined : enter.rise(Math.min(i, 5))} style={{ gap: 8 }}>
              <Text variant="overline" tone={d === today ? 'accent' : 'secondary'} raw>
                {d === today ? tx('Today') : fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              {(byDay.get(d) ?? []).map((a) => (
                <PressableScale key={a.id} haptic="select" scaleTo={0.98} onPress={() => onOpen(a.id)} style={styles.item} accessibilityLabel={a.title}>
                  <GlassLayer radius={radius.lg} />
                  <View style={[styles.time, { backgroundColor: t.c.overlay }]}>
                    <Text variant="label" raw>
                      {cityWhen(a.startsAt, cityId, { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {a.pinned ? <Icon name="pinPost" size={13} color={t.c.text} /> : null}
                      <Text variant="titleS" raw numberOfLines={1} style={{ flexShrink: 1 }}>
                        {a.title}
                      </Text>
                    </View>
                    <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
                      {[a.subtitle, `${a.going} ${tx('going')}`].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
                </PressableScale>
              ))}
            </Animated.View>
          ))
        ) : (
          <View style={styles.empty}>
            <GlassLayer radius={radius.xl} />
            <Icon name="calendar" size={20} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" align="center">
              {picked !== null ? tx('Nothing planned that day.') : mode === 'week' ? tx('Nothing planned this week.') : tx('Nothing planned this month.')}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

function DayCell({ day, label, busy, today, on, onPress, dim = false }: { day: number; label?: string; busy: boolean; today: boolean; on: boolean; onPress: () => void; dim?: boolean }) {
  const t = useTheme();
  const n = new Date(day).getUTCDate();
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.92}
      onPress={onPress}
      style={[styles.day, on ? { backgroundColor: t.c.brand } : today ? { backgroundColor: t.c.overlay } : null]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={fmt(day, { weekday: 'long', day: 'numeric', month: 'long' })}
    >
      {label ? (
        <Text variant="caption" tone={on ? undefined : 'tertiary'} color={on ? t.c.onBrand : undefined} raw>
          {label}
        </Text>
      ) : null}
      <Text variant="label" tone={dim ? 'tertiary' : undefined} color={on ? t.c.onBrand : undefined} raw>
        {String(n)}
      </Text>
      <View style={[styles.dot, { backgroundColor: busy ? (on ? t.c.onBrand : t.c.brand) : 'transparent' }]} />
    </PressableScale>
  );
}

function MonthGrid({ from, to, today, busy, picked, onPick }: { from: number; to: number; today: number; busy: Map<number, AgendaItem[]>; picked: number | null; onPick: (d: number) => void }) {
  const lead = (new Date(from).getUTCDay() + 6) % 7;
  const count = Math.round((to - from) / DAY);
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => from + i * DAY)];
  while (cells.length % 7) cells.push(null);
  const heads = Array.from({ length: 7 }, (_, i) => fmt(Date.UTC(2024, 0, 1 + i), { weekday: 'narrow' }));
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.week}>
        {heads.map((h, i) => (
          <Text key={i} variant="caption" tone="tertiary" align="center" style={{ flex: 1 }} raw>
            {h}
          </Text>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.week}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => (d === null ? <View key={`x${i}`} style={styles.day} /> : <DayCell key={d} day={d} busy={busy.has(d)} today={d === today} on={picked === d} dim={d < today} onPress={() => onPick(d)} />))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', gap: 4 },
  day: { flex: 1, minHeight: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 1, paddingVertical: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  time: { minWidth: 56, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  empty: { alignItems: 'center', gap: 8, padding: 20, borderRadius: radius.xl, overflow: 'hidden' },
});
