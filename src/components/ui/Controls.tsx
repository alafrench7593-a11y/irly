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
  const fg = color ?? (variant === 'glass' ? '#FFFFFF' : variant === 'brand' ? t.c.onBrand : t.c.text);
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
            backgroundColor: variant === 'surface' ? t.c.raised : variant === 'brand' ? t.c.brand : 'transparent',
            borderWidth: variant === 'surface' ? StyleSheet.hairlineWidth * 2 : 0,
            borderColor: t.c.line,
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
  selected?: boolean;
  onPress?: () => void;
  size?: 'md' | 'sm';
  tone?: 'brand' | 'accent';
  onDark?: boolean;
};

export const Chip = memo(function Chip({ label, icon, selected, onPress, size = 'md', tone = 'brand', onDark }: ChipProps) {
  const t = useTheme();
  const bump = useSharedValue(1);
  useEffect(() => {
    if (selected) bump.set(withSequence(withTiming(1.06, { duration: 90 }), withSpring(1, spring.bouncy)));
  }, [selected, bump]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const active = tone === 'accent' ? t.accent : t.c.brand;
  const bg = selected ? (tone === 'accent' ? t.light.accentSoft : t.c.brandSoft) : onDark ? 'rgba(255,255,255,0.1)' : t.c.surface;
  const border = selected ? active : onDark ? 'rgba(255,255,255,0.18)' : t.c.line;
  const fg = selected ? (tone === 'accent' ? t.accent : t.c.brand) : onDark ? '#FFFFFF' : t.c.text;
  const h = size === 'md' ? 40 : 32;
  return (
    <Animated.View style={animated}>
      <PressableScale
        onPress={onPress}
        haptic="select"
        scaleTo={0.94}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[
          styles.chip,
          {
            height: h,
            paddingHorizontal: size === 'md' ? 15 : 12,
            backgroundColor: bg,
            borderColor: border,
          },
        ]}
      >
        {icon ? <Icon name={icon} size={size === 'md' ? 16 : 14} color={fg} strokeWidth={2} /> : null}
        <Text variant="label" color={fg} style={size === 'sm' ? { fontSize: 12 } : undefined}>
          {label}
        </Text>
        {selected && size === 'md' ? <Icon name="check" size={14} color={fg} strokeWidth={2.6} /> : null}
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
  const bg = onDark ? 'rgba(10,10,16,0.5)' : m.bg;
  const fg = onDark ? '#FFFFFF' : m.fg;
  return (
    <View style={[styles.badgeRow, { backgroundColor: bg }]}>
      {kind === 'live' ? <LiveDot size={6} color={onDark ? t.c.live : fg} /> : null}
      {m.icon ? <Icon name={m.icon} size={12} color={onDark && kind === 'verified' ? '#C9BBFF' : fg} strokeWidth={2.4} /> : null}
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
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const segW = width ? (width - 8) / options.length : 0;
  useEffect(() => {
    x.set(withSpring(index * segW, spring.snappy));
  }, [index, segW, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segmented, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
      accessibilityRole="tablist"
    >
      {segW > 0 ? (
        <Animated.View
          style={[
            styles.segPill,
            { width: segW, backgroundColor: t.c.raised, borderColor: t.c.lineStrong, boxShadow: t.shadow.card },
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
            <Text variant="label" tone={selected ? 'primary' : 'tertiary'}>
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

export const Field = memo(function Field({ icon, trailing, containerStyle, style, onFocus, onBlur, ...rest }: FieldProps) {
  const t = useTheme();
  const focus = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    borderColor: focus.value ? t.c.brand : t.c.line,
    transform: [{ scale: 1 + focus.value * 0.005 }],
  }));
  return (
    <Animated.View style={[styles.field, { backgroundColor: t.c.surface }, animated, containerStyle]}>
      {icon ? <Icon name={icon} size={18} color={t.c.textTertiary} /> : null}
      <TextInput
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
        style={[{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }, style]}
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
