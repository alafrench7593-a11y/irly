import { useT } from '@/i18n';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type LayoutChangeEvent, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { SelectionLayers, useSelection } from '@/motion/Selection';
import { spring } from '@/motion/tokens';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/* ───────── IconButton ───────── */

type IconButtonProps = {
  icon: IconName;
  onPress?: () => void;
  label: string;
  variant?: 'surface' | 'glass' | 'plain' | 'brand';
  size?: number;
  badge?: number;
  color?: string;
  active?: boolean;
};

export const IconButton = memo(function IconButton({
  icon,
  onPress,
  label,
  variant = 'surface',
  size = 40,
  badge,
  color,
  active,
}: IconButtonProps) {
  const t = useTheme();
  const night = t.mode === 'night';
  const fg = color ?? (variant === 'glass' ? '#FFFFFF' : variant === 'brand' ? t.c.onBrand : t.c.text);
  const surfaceBg = night ? 'rgba(255,255,255,0.08)' : t.c.raised;
  const inner = (
    <View style={[styles.center, { width: size, height: size }]}>
      <Icon name={icon} size={size * 0.46} color={fg} fill={active ? fg : undefined} />
    </View>
  );
  return (
    <PressableScale onPress={onPress} scaleTo={0.9} accessibilityLabel={label} haptic="select" hitSlop={6}>
      {variant === 'glass' ? (
        <Glass dark style={{ borderRadius: size / 2 }}>
          {inner}
        </Glass>
      ) : (
        <View
          style={{
            borderRadius: size / 2,
            backgroundColor: variant === 'surface' ? surfaceBg : variant === 'brand' ? t.c.brand : 'transparent',
            borderWidth: variant === 'surface' ? StyleSheet.hairlineWidth * 2 : 0,
            borderColor: night ? 'rgba(255,255,255,0.12)' : t.c.line,
          }}
        >
          {inner}
        </View>
      )}
      {badge ? (
        <View style={[styles.center, styles.badge, { backgroundColor: t.c.live, borderColor: t.c.bg }]}>
          <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </PressableScale>
  );
});

/* ───────── Chip ───────── */

type ChipProps = {
  label: string;
  icon?: IconName;
  /** Category colour shown as a dot (or tints the icon). */
  dot?: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'md' | 'sm';
  /** Kept for older call sites; v3 chips are always black and white. */
  tone?: 'brand' | 'accent';
  onDark?: boolean;
};

/**
 * Chip: grey pill at rest, white with black text when selected. Selecting
 * gives a small spring bump (scale.selected territory, kept subtle) and a
 * selection haptic.
 */
export const Chip = memo(function Chip({ label, icon, dot, selected, onPress, size = 'md', onDark }: ChipProps) {
  const t = useTheme();
  const { p, sweep, outer } = useSelection(Boolean(selected));
  const night = t.mode === 'night';
  const glassy = onDark || night;
  const restBg = glassy ? 'rgba(255,255,255,0.08)' : t.c.overlay;
  const restBorder = glassy ? 'rgba(255,255,255,0.14)' : t.c.line;
  const h = size === 'md' ? 40 : 34;
  const box = [styles.chip, { height: h, paddingHorizontal: size === 'md' ? 15 : 13 }];
  const content = (fg: string, iconColor: string) => (
    <>
      {dot && !icon ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      {icon ? <Icon name={icon} size={size === 'md' ? 16 : 14} color={iconColor} strokeWidth={2} /> : null}
      <Text variant="label" color={fg} style={size === 'sm' ? { fontSize: 12.5 } : undefined}>
        {label}
      </Text>
    </>
  );
  return (
    <Animated.View style={outer}>
      <PressableScale onPress={onPress} haptic="select" scaleTo={0.95} accessibilityRole="button" accessibilityState={{ selected }}>
        <SelectionLayers
          p={p}
          sweep={sweep}
          fill={t.c.brand}
          radius={h / 2}
          base={<View style={[box, { backgroundColor: restBg, borderColor: restBorder }]}>{content(t.c.text, dot ?? t.c.text)}</View>}
          chosen={<View style={[box, { borderColor: t.c.brand }]}>{content(t.c.onBrand, t.c.onBrand)}</View>}
        />
      </PressableScale>
    </Animated.View>
  );
});

/* ───────── Badges ───────── */

type BadgeKind = 'verified' | 'pick' | 'soon' | 'live' | 'neutral' | 'accent' | 'positive';

export const Badge = memo(function Badge({ kind, label, onDark }: { kind: BadgeKind; label?: string; onDark?: boolean }) {
  const t = useTheme();
  const map: Record<BadgeKind, { bg: string; fg: string; icon?: IconName; text: string }> = {
    verified: { bg: t.c.brandSoft, fg: t.c.brand, icon: 'badgeCheck', text: 'Verified' },
    pick: { bg: t.light.accentSoft, fg: t.accent, icon: 'sparkles', text: 'IRLY pick' },
    soon: { bg: t.c.overlay, fg: t.c.textSecondary, text: 'Coming soon' },
    live: { bg: t.c.liveSoft, fg: t.c.live, text: 'Happening now' },
    neutral: { bg: t.c.overlay, fg: t.c.textSecondary, text: '' },
    accent: { bg: t.light.accentSoft, fg: t.accent, text: '' },
    positive: { bg: t.c.positiveSoft, fg: t.c.positive, icon: 'check', text: '' },
  };
  const m = map[kind];
  const bg = onDark ? 'rgba(18,18,18,0.6)' : m.bg;
  const fg = onDark ? '#FFFFFF' : m.fg;
  return (
    <View style={[styles.badgeRow, { backgroundColor: bg }]}>
      {kind === 'live' ? <LiveDot size={6} color={onDark ? t.c.live : fg} /> : null}
      {m.icon ? <Icon name={m.icon} size={12} color={fg} strokeWidth={2.4} /> : null}
      <Text variant="caption" color={fg} style={{ fontSize: 11, lineHeight: 14 }}>
        {label ?? m.text}
      </Text>
    </View>
  );
});

/* ───────── LiveDot ───────── */

/** A breathing dot: the signal that something is happening in real life. */
export const LiveDot = memo(function LiveDot({ size = 8, color }: { size?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.c.live;
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: c }, halo]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: c }]} />
    </View>
  );
});

/* ───────── Section header ───────── */

type SectionHeaderProps = {
  title: string;
  overline?: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  live?: boolean;
};

export const SectionHeader = memo(function SectionHeader({ title, overline, action, onAction, style, live }: SectionHeaderProps) {
  const t = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={{ flex: 1, gap: 4 }}>
        {overline ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {live ? <LiveDot size={6} /> : null}
            <Text variant="overline" tone={live ? 'live' : 'tertiary'}>
              {overline}
            </Text>
          </View>
        ) : null}
        <Text variant="titleM" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {action ? (
        <PressableScale onPress={onAction} haptic="select" scaleTo={0.94} hitSlop={10} style={styles.action}>
          <Text variant="label" tone="secondary">
            {action}
          </Text>
          <Icon name="chevronRight" size={15} color={t.c.textTertiary} />
        </PressableScale>
      ) : null}
    </View>
  );
});

/* ───────── Segmented control ───────── */

type SegmentedProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const t = useTheme();
  const night = t.mode === 'night';
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  // The pill stretches like a drop of liquid as it travels, then settles.
  const stretch = useSharedValue(1);
  const segW = width ? (width - 8) / options.length : 0;
  const placed = useSharedValue(false);
  useEffect(() => {
    if (!segW) return;
    if (!placed.value) {
      // First layout: place the pill without travelling across the control.
      placed.set(true);
      x.set(index * segW);
      return;
    }
    x.set(withSpring(index * segW, spring.snappy));
    stretch.set(withSequence(withTiming(1.22, { duration: 150, easing: Easing.out(Easing.quad) }), withSpring(1, { duration: 520, dampingRatio: 0.5 })));
  }, [index, segW, x, stretch, placed]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { scaleX: stretch.value }, { scaleY: 1 / Math.sqrt(stretch.value) }] }));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.segmented,
        night
          ? { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }
          : { backgroundColor: t.c.surface, borderColor: t.c.line },
      ]}
      accessibilityRole="tablist"
    >
      {segW > 0 ? (
        <Animated.View
          style={[
            styles.segPill,
            // Noir: a white pill slides along a glass track (the RSVP look).
            night
              ? { width: segW, backgroundColor: t.c.brand, borderColor: t.c.brand, boxShadow: t.shadow.glow }
              : { width: segW, backgroundColor: t.c.raised, borderColor: t.c.lineStrong, boxShadow: t.shadow.card },
            pill,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            haptic="select"
            scaleTo={0.96}
            onPress={() => onChange(o.value)}
            style={styles.segItem}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              variant="label"
              tone={selected ? 'primary' : night ? 'secondary' : 'tertiary'}
              color={selected && night ? t.c.onBrand : undefined}
            >
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/* ───────── Text field ───────── */

type FieldProps = TextInputProps & { icon?: IconName; trailing?: ReactNode; containerStyle?: StyleProp<ViewStyle> };

export const Field = memo(function Field({ icon, trailing, containerStyle, style, onFocus, onBlur, placeholder, ...rest }: FieldProps) {
  const t = useTheme();
  const tr = useT();
  const focus = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    borderColor: focus.value ? t.c.brand : t.c.line,
    transform: [{ scale: 1 + focus.value * 0.005 }],
  }));
  return (
    <Animated.View
      style={[styles.field, { backgroundColor: t.mode === 'night' ? 'rgba(255,255,255,0.06)' : t.c.surface }, animated, containerStyle]}
    >
      {icon ? <Icon name={icon} size={18} color={t.c.textTertiary} /> : null}
      <TextInput
        placeholder={placeholder ? tr(placeholder) : undefined}
        placeholderTextColor={t.c.textTertiary}
        selectionColor={t.c.brand}
        onFocus={(e) => {
          focus.set(withTiming(1, { duration: 160 }));
          haptic('select');
          onFocus?.(e);
        }}
        onBlur={(e) => {
          focus.set(withTiming(0, { duration: 160 }));
          onBlur?.(e);
        }}
        // minWidth 0: on the web an input is ~200 px wide by default and overflowed
        // narrow fields (Age), putting the next field's icon over it on iPhone.
        style={[{ flex: 1, minWidth: 0, width: '100%', color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }, style]}
        {...rest}
      />
      {trailing}
    </Animated.View>
  );
});

/* ───────── Divider & spacer ───────── */

export function Divider({ inset = 0 }: { inset?: number }) {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.c.line, marginLeft: inset }} />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.gutter,
    marginBottom: space[5],
    gap: space[4],
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  segmented: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  segPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  segItem: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
