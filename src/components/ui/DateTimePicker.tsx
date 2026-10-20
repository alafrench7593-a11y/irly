import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
// The gesture handler's ScrollView: inside a Sheet (itself a pan gesture) the wheels keep their own vertical scroll.
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { addDays, cityParts, clockLabel, endsNextDay, nextDays, problemOf, type Clock, type DayKey, type When } from '@/features/create/when';
import { a11y, dateLocale, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

const ROW = 44;
const VISIBLE = 5;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');

/** A day key as a date at noon UTC: formatted with timeZone UTC, it is that calendar day everywhere. */
function dayDate(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
const fmt = (day: DayKey, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dateLocale(), { timeZone: 'UTC', ...opts }).format(dayDate(day));

/** "Today", "Tomorrow" or "Sat 25 Oct", in the city's calendar. */
export function dayText(day: DayKey, utcOffset: number, now = Date.now()): string {
  const today = cityParts(now, utcOffset).day;
  if (day === today) return tx('Today');
  if (day === addDays(today, 1)) return tx('Tomorrow');
  return fmt(day, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Sat 25 Oct · 19:30", "Today · 22:00 – 02:00 (next day)". */
export function whenText(w: When, utcOffset: number, now = Date.now()): string {
  const end = w.end ? ` – ${clockLabel(w.end)}${endsNextDay(w) ? ` ${tx('(next day)')}` : ''}` : '';
  return `${dayText(w.day, utcOffset, now)} · ${clockLabel(w.start)}${end}`;
}

/** A first choice to start from (never saved until confirmed): 19:00 today, or tomorrow once it is late. */
function draftFor(utcOffset: number, now: number): When {
  const p = cityParts(now, utcOffset);
  const late = p.h * 60 + p.m > 18 * 60 + 30;
  return { day: late ? addDays(p.day, 1) : p.day, start: { h: 19, m: 0 }, end: null };
}

/** The minute wheel moves in 5-minute steps: an older value (19:32) shows on the nearest step below. */
const minuteIndex = (m: number) => Math.min(MINUTES.length - 1, Math.floor(m / 5));

/* ───────── Field shown in forms ───────── */

type FieldProps = { value: When | null; utcOffset: number; onPress: () => void; placeholder?: string; invalid?: boolean };

/** The form's "When" field: shows the chosen date and time, opens the picker again on tap. */
export const WhenField = memo(function WhenField({ value, utcOffset, onPress, placeholder = 'Pick a date and time', invalid }: FieldProps) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={a11y(value ? whenText(value, utcOffset) : placeholder)} accessibilityHint={a11y('Opens the date and time picker')}>
      <View style={[styles.field, { borderColor: invalid ? t.c.critical : t.c.line }]}>
        <Glass level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
        <Icon name="clock" size={18} color={value ? t.c.text : t.c.textTertiary} />
        {value ? (
          <Text variant="titleS" raw numberOfLines={1} style={{ flex: 1 }}>
            {whenText(value, utcOffset)}
          </Text>
        ) : (
          <Text variant="body" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {placeholder}
          </Text>
        )}
        <Text variant="label" tone="brand">
          {value ? 'Change' : 'Pick'}
        </Text>
      </View>
    </PressableScale>
  );
});

/* ───────── Wheel ───────── */

type WheelProps = { values: number[]; index: number; onIndex: (i: number) => void; label: string };

/**
 * A snapping wheel: the row in the band is the value. Scroll it, or tap a
 * row above or below to bring it in. A selection haptic on each step.
 */
function Wheel({ values, index, onIndex, label }: WheelProps) {
  const t = useTheme();
  const ref = useRef<ScrollView>(null);
  const shown = useRef(index);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clamp = (i: number) => Math.max(0, Math.min(values.length - 1, i));

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = clamp(Math.round(y / ROW));
    if (i !== shown.current) {
      shown.current = i;
      haptic('select');
      onIndex(i);
    }
    // The web has no snapping scroll: once the wheel rests, it settles on the nearest row.
    if (Platform.OS === 'web') {
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        if (Math.abs(y - i * ROW) > 1) ref.current?.scrollTo({ y: i * ROW, animated: true });
      }, 140);
    }
  };
  const go = (i: number) => {
    const j = clamp(i);
    ref.current?.scrollTo({ y: j * ROW, animated: true });
    if (j !== shown.current) {
      shown.current = j;
      haptic('select');
      onIndex(j);
    }
  };

  return (
    <View
      style={styles.wheel}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={a11y(label)}
      accessibilityValue={{ text: pad(values[index]) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => go(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <View pointerEvents="none" style={[styles.band, { backgroundColor: t.c.overlay, borderColor: t.c.line }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        nestedScrollEnabled
        onLayout={() => ref.current?.scrollTo({ y: index * ROW, animated: false })}
        contentContainerStyle={{ paddingVertical: ROW * ((VISIBLE - 1) / 2) }}
      >
        {values.map((v, i) => {
          const d = Math.abs(i - index);
          return (
            <PressableScale key={v} onPress={() => go(i)} haptic={false} scaleTo={0.94} style={styles.row} accessible={false}>
              <Text
                raw
                style={{ fontFamily: d === 0 ? font.bold : font.medium, fontSize: d === 0 ? 26 : 20, fontVariant: ['tabular-nums'], opacity: d === 0 ? 1 : d === 1 ? 0.55 : 0.28 }}
                color={t.c.text}
              >
                {pad(v)}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ───────── Picker ───────── */

type PickerProps = {
  visible: boolean;
  onClose: () => void;
  value: When | null;
  onConfirm: (w: When) => void;
  /** The city's offset from UTC, in hours (Dubai 4, Bali 8): every time shown and saved is the city's. */
  utcOffset: number;
  cityName: string;
  /** Offer an end time (on by default). */
  withEnd?: boolean;
  title?: string;
};

/**
 * Date and time of an activity, in the city's time: a strip of the next 90
 * days, an hour wheel and a minute wheel (5-minute steps), an optional end.
 * Nothing changes until Confirm; a past time is explained, never moved.
 */
export const DateTimePicker = memo(function DateTimePicker({ visible, onClose, value, onConfirm, utcOffset, cityName, withEnd = true, title = 'When' }: PickerProps) {
  const t = useTheme();
  const [draft, setDraft] = useState<When>(() => value ?? draftFor(utcOffset, Date.now()));
  const [editing, setEditing] = useState<'start' | 'end'>('start');
  const [days, setDays] = useState<DayKey[]>(() => nextDays(Date.now(), utcOffset));
  const strip = useRef<ScrollView>(null);

  // Each opening starts from the field's value (Cancel leaves it untouched).
  useEffect(() => {
    if (!visible) return;
    const now = Date.now();
    const list = nextDays(now, utcOffset);
    const base = value ?? draftFor(utcOffset, now);
    setDays(list.includes(base.day) ? list : [base.day, ...list]);
    setDraft(base);
    setEditing('start');
  }, [visible, value, utcOffset]);

  const clock = editing === 'end' && draft.end ? draft.end : draft.start;
  const setClock = useCallback(
    (c: Partial<Clock>) => setDraft((w) => (editing === 'end' && w.end ? { ...w, end: { ...w.end, ...c } } : { ...w, start: { ...w.start, ...c } })),
    [editing],
  );
  const problem = problemOf(draft, utcOffset, Date.now());
  const message =
    problem === 'past'
      ? tx('This time has already passed in {city}. Pick a later time.', { city: cityName })
      : problem === 'end-before-start'
        ? tx('The end must be after the start.')
        : null;

  const confirm = () => {
    // Checked again at the tap: the sheet may have stayed open past the chosen minute.
    if (problemOf(draft, utcOffset, Date.now())) {
      haptic('error');
      return;
    }
    haptic('success');
    onConfirm(draft);
    onClose();
  };
  const addEnd = () => {
    const s = draft.start.h * 60 + draft.start.m + 120;
    setDraft((w) => ({ ...w, end: { h: Math.floor(s / 60) % 24, m: s % 60 } }));
    setEditing('end');
  };
  const removeEnd = () => {
    setDraft((w) => ({ ...w, end: null }));
    setEditing('start');
  };

  const selected = Math.max(0, days.indexOf(draft.day));
  const PILL = 64;

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={tx('{city} time', { city: cityName })} maxHeight={0.94}>
      <View style={{ gap: space[4], paddingBottom: space[2] }}>
        <Animated.View key={whenText(draft, utcOffset)} entering={FadeIn.duration(160)} style={{ paddingHorizontal: space.gutter }}>
          <Text variant="titleM" raw accessibilityLiveRegion="polite">
            {whenText(draft, utcOffset)}
          </Text>
        </Animated.View>

        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}
          onLayout={(e) => strip.current?.scrollTo({ x: Math.max(0, selected * (PILL + 8) - e.nativeEvent.layout.width / 2 + PILL / 2), animated: false })}
        >
          {days.map((d, i) => {
            const on = d === draft.day;
            const [, , dd] = d.split('-').map(Number);
            const head = i === 0 || dd === 1 ? fmt(d, { month: 'long' }) : '';
            const top = i === 0 && d === cityParts(Date.now(), utcOffset).day ? tx('Today') : d === addDays(cityParts(Date.now(), utcOffset).day, 1) ? tx('Tomorrow') : fmt(d, { weekday: 'short' });
            return (
              <View key={d} style={{ width: PILL, gap: 4 }}>
                <Text variant="caption" tone="tertiary" raw numberOfLines={1} style={{ height: 16, textTransform: 'capitalize' }}>
                  {head}
                </Text>
                <PressableScale
                  onPress={() => setDraft((w) => ({ ...w, day: d }))}
                  haptic="select"
                  scaleTo={0.94}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                >
                  <View style={[styles.pill, { width: PILL, backgroundColor: on ? t.c.brand : 'transparent', borderColor: on ? t.c.brand : t.c.line }]}>
                    {on ? null : <Glass level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />}
                    <Text variant="caption" raw numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} color={on ? t.c.onBrand : t.c.textSecondary}>
                      {top}
                    </Text>
                    <Text raw style={{ fontFamily: font.bold, fontSize: 22 }} color={on ? t.c.onBrand : t.c.text}>
                      {dd}
                    </Text>
                  </View>
                </PressableScale>
              </View>
            );
          })}
        </ScrollView>

        {withEnd ? (
          <View style={styles.tabs}>
            <PressableScale onPress={() => setEditing('start')} haptic="select" accessibilityRole="tab" accessibilityState={{ selected: editing === 'start' }} style={{ flex: 1 }}>
              <View style={[styles.tab, { borderColor: editing === 'start' ? t.c.brand : t.c.line }]}>
                <Text variant="caption" tone="secondary">
                  Starts
                </Text>
                <Text variant="titleS" raw>
                  {clockLabel(draft.start)}
                </Text>
              </View>
            </PressableScale>
            {draft.end ? (
              <PressableScale onPress={() => setEditing('end')} haptic="select" accessibilityRole="tab" accessibilityState={{ selected: editing === 'end' }} style={{ flex: 1 }}>
                <View style={[styles.tab, { borderColor: editing === 'end' ? t.c.brand : t.c.line }]}>
                  <Text variant="caption" tone="secondary">
                    {endsNextDay(draft) ? 'Ends (next day)' : 'Ends'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text variant="titleS" raw>
                      {clockLabel(draft.end)}
                    </Text>
                    <PressableScale onPress={removeEnd} haptic="tap" hitSlop={10} accessibilityRole="button" accessibilityLabel={a11y('Remove the end time')}>
                      <Icon name="x" size={16} color={t.c.textTertiary} />
                    </PressableScale>
                  </View>
                </View>
              </PressableScale>
            ) : (
              <PressableScale onPress={addEnd} haptic="select" accessibilityRole="button" style={{ flex: 1 }}>
                <View style={[styles.tab, { borderColor: t.c.line, borderStyle: 'dashed' }]}>
                  <Text variant="caption" tone="secondary">
                    Optional
                  </Text>
                  <Text variant="titleS" tone="brand">
                    Add an end time
                  </Text>
                </View>
              </PressableScale>
            )}
          </View>
        ) : null}

        {/* key: switching Start/End rebuilds the wheels on that value. */}
        <View key={editing} style={styles.wheels}>
          <Wheel label="Hour" values={HOURS} index={clock.h} onIndex={(i) => setClock({ h: HOURS[i] })} />
          <Text raw style={{ fontFamily: font.bold, fontSize: 26 }} color={t.c.text}>
            :
          </Text>
          <Wheel label="Minutes" values={MINUTES} index={minuteIndex(clock.m)} onIndex={(i) => setClock({ m: MINUTES[i] })} />
        </View>

        {message ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(120)} style={[styles.message, { backgroundColor: t.c.liveSoft }]}>
            <Icon name="clock" size={16} color={t.c.critical} />
            <Text variant="bodyS" tone="critical" style={{ flex: 1 }} raw accessibilityLiveRegion="polite">
              {message}
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.actions}>
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ flex: 1 }} haptic="tap" />
          <Button label="Confirm" size="md" onPress={confirm} disabled={Boolean(problem)} style={{ flex: 1 }} haptic={false} />
        </View>
      </View>
    </Sheet>
  );
});

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  pill: { height: 64, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter },
  tab: { borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8, gap: 2, minHeight: 56, justifyContent: 'center' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.gutter },
  wheel: { width: 96, height: ROW * VISIBLE },
  band: { position: 'absolute', left: 0, right: 0, top: ROW * ((VISIBLE - 1) / 2), height: ROW, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth * 2 },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.gutter, padding: 12, borderRadius: radius.sm },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter },
});
