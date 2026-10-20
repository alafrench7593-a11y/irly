import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/AppFrame';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useT } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useSelection, SelectionLayers } from '@/motion/Selection';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The building blocks of the professional profile editor: the step
 * progress, the large "I am" cards and the compact tiles of industries and
 * goals. Selected is the text colour flooding in (black on IRLY, plum on
 * IRLY Girl), so every theme reads the same way.
 */

/** Steps as segments that fill in; the ones already done take you back. */
export function StepProgress({ steps, step, onStep }: { steps: string[]; step: number; onStep: (i: number) => void }) {
  const t = useTheme();
  const tr = useT();
  const reduced = useReducedMotion();
  const pos = useSharedValue(step + 1);
  useEffect(() => {
    pos.set(reduced ? step + 1 : withTiming(step + 1, { duration: 420 }));
  }, [step, reduced, pos]);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.segments}>
        {steps.map((s, i) => (
          <PressableScale
            key={s}
            haptic={i < step ? 'select' : false}
            scaleTo={i < step ? 0.94 : 1}
            onPress={() => (i < step ? onStep(i) : undefined)}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityLabel={tr('Step {n}: {title}', { n: i + 1, title: tr(s) })}
            accessibilityState={{ disabled: i >= step, selected: i === step }}
            style={styles.segment}
          >
            <Segment index={i} pos={pos} track={t.c.line} fill={t.c.text} />
          </PressableScale>
        ))}
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="overline" tone="tertiary">
          {tr('Step {n} of {total}', { n: step + 1, total: steps.length })}
        </Text>
        <Text variant="titleL" accessibilityRole="header">
          {steps[step]}
        </Text>
      </View>
    </View>
  );
}

function Segment({ index, pos, track, fill }: { index: number; pos: SharedValue<number>; track: string; fill: string }) {
  const bar = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, pos.value - index)) * 100}%` }));
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <Animated.View style={[styles.fill, { backgroundColor: fill }, bar]} />
    </View>
  );
}

/** Columns for a grid of tiles: 2 on phones, more when there is room. */
export function useColumns(min = 150, gap = 8) {
  const frame = useFrame();
  const [width, setWidth] = useState(Math.max(0, frame.width - space.gutter * 2));
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - width) > 0.5) setWidth(w);
  };
  const cols = Math.max(2, Math.min(4, Math.floor((width + gap) / (min + gap))));
  // Rounded down so a row never wraps on a fraction of a pixel.
  return { onLayout, cols, width, tile: Math.max(0, Math.floor((width - gap * (cols - 1)) / cols)), gap };
}

/** One large "I am" card: icon, name and a short line. A radio among four. */
export function RoleCard({ label, hint, icon, selected, width, onPress }: { label: string; hint: string; icon: IconName; selected: boolean; width: number; onPress: () => void }) {
  const t = useTheme();
  const { p, sweep, outer } = useSelection(selected);
  const body = (fg: string, soft: string, ring: string, on: boolean) => (
    <View style={[styles.role, { borderColor: on ? 'transparent' : t.c.line }]}>
      {on ? null : <GlassLayer radius={radius.lg} variant="card" />}
      <View style={styles.roleTop}>
        <View style={[styles.roleIcon, { borderColor: ring }]}>
          <Icon name={icon} size={20} color={fg} />
        </View>
        <View style={[styles.radio, { borderColor: on ? fg : t.c.lineStrong }]}>{on ? <View style={[styles.radioDot, { backgroundColor: fg }]} /> : null}</View>
      </View>
      <View style={{ gap: 2 }}>
        <Text variant="titleS" color={fg} numberOfLines={1}>
          {label}
        </Text>
        <Text variant="caption" color={soft} numberOfLines={2}>
          {hint}
        </Text>
      </View>
    </View>
  );
  return (
    <Animated.View style={[{ width }, outer]}>
      <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected, selected }} aria-checked={selected} accessibilityLabel={`${label}. ${hint}`}>
        <SelectionLayers p={p} sweep={sweep} fill={t.c.text} radius={radius.lg} base={body(t.c.text, t.c.textSecondary, t.c.lineStrong, false)} chosen={body(t.c.bg, t.c.bg, t.c.bg, true)} />
      </PressableScale>
    </Animated.View>
  );
}

/** A compact tile (emoji + label) in a grid of choices: a checkbox. */
export function Tile({ emoji, label, selected, width, onPress }: { emoji: string; label: string; selected: boolean; width: number; onPress: () => void }) {
  const t = useTheme();
  const { p, sweep, outer } = useSelection(selected);
  const body = (fg: string, on: boolean) => (
    <View style={[styles.tile, { borderColor: on ? 'transparent' : t.c.line }]}>
      {on ? null : <GlassLayer radius={radius.md} variant="chip" />}
      <Text variant="titleS" raw>
        {emoji}
      </Text>
      <Text variant="label" color={fg} numberOfLines={2} style={{ flex: 1 }}>
        {label}
      </Text>
      {on ? <Icon name="check" size={14} color={fg} strokeWidth={2.5} /> : null}
    </View>
  );
  return (
    <Animated.View style={[{ width }, outer]}>
      <PressableScale haptic="select" scaleTo={0.95} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={label}>
        <SelectionLayers p={p} sweep={sweep} fill={t.c.text} radius={radius.md} base={body(t.c.text, false)} chosen={body(t.c.bg, true)} />
      </PressableScale>
    </Animated.View>
  );
}

/** A titled block of a step, with its counter and error. */
export function FormSection({ title, count, hint, error, children }: { title: string; count?: string; hint?: string; error?: string | null; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHead}>
        <Text variant="overline" tone="tertiary" style={{ flex: 1 }}>
          {title}
        </Text>
        {count ? (
          <Text variant="caption" tone="secondary" raw>
            {count}
          </Text>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
      {children}
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite">
          <Icon name="x" size={12} color={t.c.live} strokeWidth={2.5} />
          <Text variant="caption" color={t.c.live} style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, paddingVertical: 6 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  role: { minHeight: 124, padding: 14, gap: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden', justifyContent: 'space-between' },
  roleTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  roleIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  tile: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
