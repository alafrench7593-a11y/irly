import { memo, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
// The gesture handler's ScrollView: inside a Sheet (itself a pan gesture) the wheels keep their own vertical scroll.
import { ScrollView } from 'react-native-gesture-handler';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import {
  addDays,
  cityParts,
  clockIsPast,
  clockLabel,
  draftWhen,
  durationLabel,
  durationOf,
  DURATIONS,
  endsNextDay,
  hourIsPast,
  minuteStep,
  nextDays,
  problemOf,
  withDuration,
  type DayKey,
  type When,
} from '@/features/create/when';
import { a11y, dateLocale, t as tx } from '@/i18n';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Button } from './Button';
import { Chip } from './Controls';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { Sheet, SheetScrollView } from './Sheet';
import { Text } from './Text';

const ROW = 44;
/** Width of a day of the strip: « Aujourd’hui » fits on one line. */
const PILL = 84;
/** Rows shown by a wheel: 5, or 3 on short screens (iPhone SE, Safari with its bars) so the sheet rarely needs to scroll. */
const useVisibleRows = () => (useWindowDimensions().height < 740 ? 3 : 5);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const pad = (n: number) => String(n).padStart(2, '0');
/** The time at a tap (not during render). */
const clockNow = () => Date.now();

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

/* ───────── Field shown in forms ───────── */

type FieldProps = { value: When | null; utcOffset: number; onPress: () => void; placeholder?: string; invalid?: boolean };

/** The form's "When" field: shows the chosen date and time, opens the picker again on tap. */
export const WhenField = memo(function WhenField({ value, utcOffset, onPress, placeholder = 'Pick a date and time', invalid }: FieldProps) {
  const t = useTheme();
  const girl = t.flavor === 'girl';
  const label = value ? whenText(value, utcOffset) : null;
  // A confirmed change is felt: the field pops once, the new date fades in.
  const pop = useSharedValue(1);
  const seen = useRef(label);
  useEffect(() => {
    if (seen.current === label) return;
    seen.current = label;
    pop.set(withSequence(withSpring(1.025, spring.press), withSpring(1, spring.press)));
  }, [label, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <PressableScale
      onPress={() => {
        // A field of the form may still have the keyboard up: it would cover the wheels and Confirm.
        Keyboard.dismiss();
        onPress();
      }}
      haptic="select"
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={a11y(label ?? placeholder)}
      accessibilityHint={a11y('Opens the date and time picker')}
      testID="when-field"
    >
      <Animated.View style={[styles.field, { borderColor: invalid ? t.c.critical : girl ? t.c.lineStrong : t.c.line }, girl ? { boxShadow: t.shadow.card } : null, popStyle]}>
        <Glass level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />
        {girl ? (
          <View style={[styles.fieldIcon, { backgroundColor: t.c.brandSoft }]}>
            <Icon name="calendar" size={16} color={t.c.brand} />
          </View>
        ) : (
          <Icon name="clock" size={18} color={value ? t.c.text : t.c.textTertiary} />
        )}
        {label ? (
          <Animated.View key={label} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
            <Text variant="titleS" raw numberOfLines={1}>
              {label}
            </Text>
          </Animated.View>
        ) : (
          <Text variant="body" tone="tertiary" numberOfLines={1} style={{ flex: 1 }}>
            {placeholder}
          </Text>
        )}
        <Text variant="label" tone="brand">
          {value ? 'Change' : 'Pick'}
        </Text>
      </Animated.View>
    </PressableScale>
  );
});

/* ───────── Wheel ───────── */

type WheelProps = {
  values: number[];
  index: number;
  onIndex: (i: number) => void;
  label: string;
  /** Rows already behind us (today): shown faded, still reachable; the sheet says why Confirm waits. */
  isPast?: (v: number) => boolean;
  testID?: string;
};

/**
 * A snapping wheel, as on iOS: the row in the band is the value. Scroll it,
 * tap a row above or below to bring it in, or use the arrow keys (web) /
 * swipe up and down (VoiceOver). A selection haptic on each step. Every row
 * is a fixed 44 pt and the chosen one only changes weight and opacity: the
 * wheel never shifts while it turns.
 */
function Wheel({ values, index, onIndex, label, isPast, testID }: WheelProps) {
  const t = useTheme();
  const ref = useRef<ScrollView>(null);
  const shown = useRef(index);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clamp = (i: number) => Math.max(0, Math.min(values.length - 1, i));
  const visible = useVisibleRows();
  const above = ROW * ((visible - 1) / 2);

  // A row brought in by a tap, a key or from outside: the rows the scroll passes on its way are not choices
  // (read as such, a passing row was sent back up and the wheel returned to it).
  const target = useRef<{ i: number; at: number } | null>(null);
  const aim = (i: number) => {
    target.current = { i, at: Date.now() };
    ref.current?.scrollTo({ y: i * ROW, animated: true });
  };

  useEffect(() => () => {
    if (settle.current) clearTimeout(settle.current);
  }, []);

  // Moved from outside (a day change, an edit opening on its value): the wheel follows without a haptic.
  useEffect(() => {
    if (index === shown.current) return;
    shown.current = index;
    aim(index);
  }, [index]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const i = clamp(Math.round(y / ROW));
    const aimed = target.current;
    if (aimed && Date.now() - aimed.at < 800) {
      // On its way to the aimed row: arrived, the wheel listens again.
      if (Math.abs(y - aimed.i * ROW) <= 1) target.current = null;
      return;
    }
    target.current = null;
    if (i !== shown.current) {
      shown.current = i;
      haptic('select');
      onIndex(i);
    }
    // The web has no snapping scroll: once the wheel rests, it settles on the nearest row.
    if (Platform.OS === 'web') {
      if (settle.current) clearTimeout(settle.current);
      settle.current = setTimeout(() => {
        if (Math.abs(y - i * ROW) > 1) aim(i);
      }, 140);
    }
  };
  const go = (i: number) => {
    const j = clamp(i);
    aim(j);
    if (j !== shown.current) {
      shown.current = j;
      haptic('select');
      onIndex(j);
    }
  };
  // Web (fold, desktop): the focused wheel turns with the arrow keys.
  const keys =
    Platform.OS === 'web'
      ? ({
          tabIndex: 0,
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            go(index + (e.key === 'ArrowDown' ? 1 : -1));
          },
        } as object)
      : null;

  return (
    <View
      style={[styles.wheel, { height: ROW * visible }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={a11y(label)}
      accessibilityValue={{ text: pad(values[index]) }}
      // The web reads the value from aria-* (accessibilityValue.text is native only).
      aria-valuetext={pad(values[index])}
      aria-valuenow={values[index]}
      aria-valuemin={values[0]}
      aria-valuemax={values[values.length - 1]}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => go(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      testID={testID}
      {...keys}
    >
      <View pointerEvents="none" style={[styles.band, { top: above }, t.flavor === 'girl' ? { backgroundColor: t.c.brandSoft, borderColor: t.c.lineStrong } : { backgroundColor: t.c.overlay, borderColor: t.c.line }]} />
      <ScrollView
        ref={ref}
        style={web.contain}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => (target.current = null)}
        nestedScrollEnabled
        // Opens on the value: contentOffset for the first frame (iOS), then once the rows are measured
        // (a scrollTo before that is lost and the wheel showed 00 under the band).
        contentOffset={{ x: 0, y: index * ROW }}
        onLayout={() => ref.current?.scrollTo({ y: shown.current * ROW, animated: false })}
        onContentSizeChange={() => ref.current?.scrollTo({ y: shown.current * ROW, animated: false })}
        contentContainerStyle={{ paddingVertical: above }}
      >
        {values.map((v, i) => {
          const d = Math.abs(i - index);
          const past = isPast?.(v) ?? false;
          return (
            <PressableScale key={v} onPress={() => go(i)} haptic={false} scaleTo={0.94} style={styles.row} accessible={false}>
              {/* One size for every row (only weight and opacity change): nothing moves while the wheel turns. */}
              <Text
                raw
                maxFontSizeMultiplier={1}
                style={{
                  fontFamily: d === 0 ? font.bold : font.medium,
                  fontSize: 24,
                  fontVariant: ['tabular-nums'],
                  opacity: (d === 0 ? 1 : d === 1 ? 0.5 : 0.25) * (past ? 0.45 : 1),
                  textDecorationLine: past && d === 0 ? 'line-through' : 'none',
                }}
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
  /** Offer a length (on by default): the end is the start plus a length, so it can never come before the start. */
  withEnd?: boolean;
  title?: string;
};

type Draft = { day: DayKey; start: When['start']; duration: number | null };
const draftOf = (w: When): Draft => ({ day: w.day, start: w.start, duration: durationOf(w) });
const whenOf = (d: Draft): When => withDuration({ day: d.day, start: d.start, end: null }, d.duration);

/**
 * Date and time of an activity, in the city's time: a strip of the next 90
 * days, an hour wheel and a minute wheel (5-minute steps, as iOS does), and
 * an optional length (30 min to 6 h) instead of a second clock, so the end
 * always follows the start. Times already past today are faded on the
 * wheels; choosing one is explained (never silently moved) and Confirm
 * waits. Nothing changes until Confirm: closing the sheet keeps the field
 * as it was.
 *
 * Why wheels drawn by IRLY and not the system picker: the same picker on
 * iPhone, Android and the web (fold, desktop), the city's time whatever the
 * phone's time zone (a system picker shows the phone's), and no native
 * module to add to the app binary.
 */
export const DateTimePicker = memo(function DateTimePicker({ visible, onClose, value, onConfirm, utcOffset, cityName, withEnd = true, title = 'When' }: PickerProps) {
  const t = useTheme();
  const now = useNow(15_000);
  const [draft, setDraft] = useState<Draft>(() => draftOf(value ?? draftWhen(utcOffset, now)));
  const strip = useRef<ScrollView>(null);

  // The picker has no text input: a keyboard left up by the form would hide the wheels and Confirm.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  // Each opening starts from the field's value (Cancel leaves it untouched).
  const [shown, setShown] = useState(visible);
  if (visible !== shown) {
    setShown(visible);
    if (visible) setDraft(draftOf(value ?? draftWhen(utcOffset, now)));
  }
  // The next 90 days in the city; an older date being edited stays offered first.
  const today = cityParts(now, utcOffset).day;
  const upcoming = nextDays(now, utcOffset);
  const days = upcoming.includes(draft.day) || draft.day > today ? upcoming : [draft.day, ...upcoming];

  const when = whenOf(draft);
  const problem = problemOf(when, utcOffset, now);
  const durations: number[] = draft.duration && !(DURATIONS as readonly number[]).includes(draft.duration) ? [...DURATIONS, draft.duration].sort((a, b) => a - b) : [...DURATIONS];

  const confirm = () => {
    // Checked again at the tap: the sheet may have stayed open past the chosen minute.
    if (problemOf(when, utcOffset, clockNow())) {
      haptic('error');
      return;
    }
    haptic('success');
    onConfirm(when);
    onClose();
  };

  const selected = Math.max(0, days.indexOf(draft.day));
  const status = problem === 'past'
    ? tx('This time has already passed in {city}. Pick a later time.', { city: cityName })
    : problem === 'end-before-start'
      ? tx('The end must be after the start.')
      : when.end
        ? tx('Ends at {time}', { time: `${clockLabel(when.end)}${endsNextDay(when) ? ` ${tx('(next day)')}` : ''}` })
        : tx('Starts at {time}, no end time', { time: clockLabel(when.start) });

  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={tx('{city} time', { city: cityName })} maxHeight={0.94}>
      {/* The title stays above and Cancel / Confirm below; only the middle scrolls when the screen is too short
          (iPhone SE, Safari with its bars, larger text), so neither is ever pushed off screen. */}
      <SheetScrollView style={styles.body} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.summary}>
          <Text variant="titleM" raw numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityLiveRegion="polite" testID="when-summary">
            {whenText(when, utcOffset, now)}
          </Text>
        </View>

        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          // Room above and below: the chosen day springs up and glows, inside the strip (nothing overlaps the wheels).
          contentContainerStyle={styles.strip}
          onLayout={(e) => strip.current?.scrollTo({ x: Math.max(0, selected * (PILL + 8) - e.nativeEvent.layout.width / 2 + PILL / 2), animated: false })}
        >
          {days.map((d, i) => {
            const on = d === draft.day;
            const [, , dd] = d.split('-').map(Number);
            const head = i === 0 || dd === 1 ? fmt(d, { month: 'long' }) : '';
            const top = d === today ? tx('Today') : d === addDays(today, 1) ? tx('Tomorrow') : fmt(d, { weekday: 'short' });
            return (
              <View key={d} style={{ width: PILL, gap: 4 }}>
                <Text variant="caption" tone="tertiary" raw numberOfLines={1} style={styles.month}>
                  {head}
                </Text>
                <DayPill on={on} width={PILL} top={top} day={dd} label={fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })} onPress={() => setDraft((w) => ({ ...w, day: d }))} />
              </View>
            );
          })}
        </ScrollView>

        <View>
          <View style={styles.wheelTitles} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Text variant="overline" tone="tertiary" align="center" style={styles.wheelTitle}>
              Hour
            </Text>
            <View style={styles.colon} />
            <Text variant="overline" tone="tertiary" align="center" style={styles.wheelTitle}>
              Minutes
            </Text>
          </View>
          <View style={styles.wheels}>
            <Wheel
              label="Start hour"
              testID="wheel-hour"
              values={HOURS}
              index={draft.start.h}
              isPast={(h) => hourIsPast(draft.day, h, utcOffset, now)}
              onIndex={(i) => setDraft((w) => ({ ...w, start: { ...w.start, h: HOURS[i] } }))}
            />
            <Text raw maxFontSizeMultiplier={1} style={[styles.colon, { fontFamily: font.bold, fontSize: 24, textAlign: 'center' }]} color={t.c.text}>
              :
            </Text>
            <Wheel
              label="Start minutes"
              testID="wheel-minute"
              values={MINUTES}
              index={MINUTES.indexOf(minuteStep(draft.start.m))}
              isPast={(m) => clockIsPast(draft.day, { h: draft.start.h, m }, utcOffset, now)}
              onIndex={(i) => setDraft((w) => ({ ...w, start: { ...w.start, m: MINUTES[i] } }))}
            />
          </View>
        </View>

        {withEnd ? (
          <View style={styles.lengthBlock}>
            <Text variant="overline" tone="tertiary" style={{ paddingHorizontal: space.gutter }}>
              Duration
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lengths} keyboardShouldPersistTaps="handled">
              <Chip size="sm" label={tx('No end time')} selected={draft.duration === null} onPress={() => setDraft((w) => ({ ...w, duration: null }))} raw />
              {durations.map((m) => (
                <Chip key={m} size="sm" label={durationLabel(m)} selected={draft.duration === m} onPress={() => setDraft((w) => ({ ...w, duration: m }))} raw />
              ))}
            </ScrollView>
          </View>
        ) : null}
      </SheetScrollView>

      <View style={styles.footer}>
        {/* One line, always there: the end time, or why Confirm waits. Its height never changes, so nothing jumps. */}
        <View style={[styles.status, problem ? { backgroundColor: t.c.liveSoft } : null]} testID="when-status">
          <Icon name={problem ? 'clock' : 'check'} size={16} color={problem ? t.c.critical : t.c.textSecondary} />
          <Text variant="bodyS" tone={problem ? 'critical' : 'secondary'} style={{ flex: 1 }} numberOfLines={2} raw accessibilityLiveRegion="polite">
            {status}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button label="Cancel" variant="secondary" size="md" onPress={onClose} style={{ flex: 1 }} haptic="tap" />
          <Button label="Confirm" size="md" onPress={confirm} disabled={Boolean(problem)} style={{ flex: 1 }} haptic={false} />
        </View>
      </View>
    </Sheet>
  );
});

/** A day of the strip: the chosen one fills with the brand colour and springs up (a rose glow in IRLY Girl). */
const DayPill = memo(function DayPill({ on, width, top, day, label, onPress }: { on: boolean; width: number; top: string; day: number; label: string; onPress: () => void }) {
  const t = useTheme();
  const lift = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    lift.set(withSpring(on ? 1 : 0, spring.press));
  }, [on, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.value * 0.04 }, { translateY: -lift.value * 2 }] }));
  return (
    <PressableScale onPress={onPress} haptic="select" scaleTo={0.94} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label}>
      <Animated.View
        style={[
          styles.pill,
          { width, backgroundColor: on ? t.c.brand : 'transparent', borderColor: on ? t.c.brand : t.c.line },
          on && t.flavor === 'girl' ? { boxShadow: t.shadow.glow } : null,
          style,
        ]}
      >
        {on ? null : <Glass level="thin" border={false} style={[StyleSheet.absoluteFill, { borderRadius: radius.md }]} />}
        {/* A long word (« Aujourd’hui ») a size smaller: the web has no adjustsFontSizeToFit and cut it. */}
        <Text
          variant="caption"
          raw
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          color={on ? t.c.onBrand : t.c.textSecondary}
          style={top.length > 9 ? styles.longTop : undefined}
        >
          {top}
        </Text>
        <Text raw maxFontSizeMultiplier={1} style={{ fontFamily: font.bold, fontSize: 22 }} color={on ? t.c.onBrand : t.c.text}>
          {day}
        </Text>
      </Animated.View>
    </PressableScale>
  );
});

/** Web: a wheel scrolled to its end does not hand the scroll to the sheet or the page. */
const web = { contain: Platform.OS === 'web' ? ({ overscrollBehavior: 'contain' } as object) : undefined };

const styles = StyleSheet.create({
  body: { flexShrink: 1 },
  content: { gap: space[3], paddingBottom: space[3] },
  summary: { paddingHorizontal: space.gutter, minHeight: 30, justifyContent: 'center' },
  strip: { paddingHorizontal: space.gutter, paddingTop: 4, paddingBottom: 12, gap: 8 },
  month: { height: 16, textTransform: 'capitalize' },
  longTop: { fontSize: 11, letterSpacing: -0.2 },
  wheelTitles: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingHorizontal: space.gutter, marginBottom: 4 },
  wheelTitle: { width: 96 },
  colon: { width: 12 },
  lengthBlock: { gap: 8 },
  lengths: { paddingHorizontal: space.gutter, gap: 8, paddingVertical: 4 },
  footer: { gap: space[3], paddingTop: space[3] },
  fieldIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginLeft: -4 },
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
  pill: { height: 64, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden' },
  wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: space.gutter },
  wheel: { width: 96 },
  band: { position: 'absolute', left: 0, right: 0, height: ROW, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth * 2 },
  row: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  // Two lines of room at all times (the longest message, in French, on a 320 pt phone).
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: space.gutter, paddingHorizontal: 12, minHeight: 52, borderRadius: radius.sm },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: space.gutter },
});
