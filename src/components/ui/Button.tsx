import { memo, useEffect, type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { HapticKind } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { girlElevation, networkGirl, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'inverse' | 'done' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: Size;
  icon?: IconName;
  /** A custom mark before the label (brand logos), drawn in the label colour. */
  leading?: (color: string) => ReactNode;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  haptic?: HapticKind | false;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  /** A label written by the IRLY team (back office): shown as written, never translated. */
  raw?: boolean;
};

const HEIGHT: Record<Size, number> = { lg: 54, md: 44, sm: 34 };
const PAD: Record<Size, number> = { lg: 22, md: 18, sm: 14 };

/**
 * Buttons morph rather than swap: when a variant changes (e.g. "Join" →
 * "You're in") the button pulses once so the change is felt, not just seen.
 */
export const Button = memo(function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  leading,
  iconRight,
  loading,
  disabled,
  full,
  haptic = 'tap',
  style,
  accessibilityHint,
  raw,
}: Props) {
  const t = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (variant === 'done') {
      pulse.set(withSequence(withTiming(1.06, { duration: 120 }), withSpring(1, spring.bouncy)));
    }
  }, [variant, pulse]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const night = t.mode === 'night';
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; shadow?: string }> = {
    primary: { bg: t.c.brand, fg: t.c.onBrand, shadow: t.shadow.glow },
    // On IRLY Noir the secondary action is a pane of smoked glass, never a
    // second solid block competing with the white primary.
    secondary: night
      ? { bg: 'rgba(255,255,255,0.08)', fg: t.c.text, border: 'rgba(255,255,255,0.16)' }
      : { bg: t.c.raised, fg: t.c.text, border: t.c.lineStrong },
    ghost: { bg: 'transparent', fg: t.c.text },
    glass: { bg: 'rgba(255,255,255,0.16)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.22)' },
    inverse: { bg: t.c.text, fg: t.c.bg },
    done: { bg: t.c.positiveSoft, fg: t.c.positive, border: t.c.positive },
    danger: { bg: t.c.critical, fg: '#FFFFFF' },
  };
  const girlFlavor = t.flavor === 'girl';
  if (girlFlavor) {
    // IRLY Girl: a luminous rose primary with its own glow, a dark plum
    // glass secondary with pearl text, bordeaux for destructive actions.
    palette.primary = { bg: t.c.brand, fg: '#FFFFFF', shadow: t.network ? networkGirl.glow : girlElevation.glow };
    palette.secondary = { bg: 'transparent', fg: '#FFF6FA', shadow: girlElevation.plum };
    palette.danger = { bg: t.c.critical, fg: '#FFFFFF', shadow: girlElevation.card };
  }
  const p = palette[variant];
  // Secondary and glass actions are panes of the shared glass; the primary
  // of IRLY Girl is its rose gradient, the primary of Mixte stays solid.
  const glassy = variant === 'secondary' || variant === 'glass';
  const girlPrimary = variant === 'primary' && girlFlavor;
  const h = HEIGHT[size];

  return (
    <Animated.View style={[full ? styles.full : null, animated, style]}>
      {/* A double tap fires once: PressableScale drops the second press (it lands before
          `loading`/`disabled` re-render, or on a plain navigation that never sets them). */}
      <PressableScale
        onPress={onPress}
        disabled={disabled || loading}
        haptic={haptic}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: disabled || loading, busy: loading }}
        style={[
          styles.base,
          {
            height: h,
            paddingHorizontal: PAD[size],
            borderRadius: radius.pill,
            backgroundColor: glassy || girlPrimary ? 'transparent' : p.bg,
            overflow: glassy || girlPrimary ? 'hidden' : undefined,
            borderWidth: p.border && !glassy ? StyleSheet.hairlineWidth * 2 : 0,
            borderColor: p.border,
            boxShadow: p.shadow,
          },
        ]}
      >
        {glassy ? <Glass level="thin" dark={variant === 'glass'} variant={girlFlavor && variant === 'secondary' ? 'plum' : undefined} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} /> : null}
        {girlPrimary ? (
          <>
            <LinearGradient colors={t.network ? networkGirl.gradient : GIRL_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
            {/* Depth: light pooled in the top half and a thin pearl rim, like lacquer. */}
            <LinearGradient colors={['rgba(255,255,255,0.26)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} pointerEvents="none" />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.girlRim, { borderRadius: radius.pill }]} />
          </>
        ) : null}
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <View style={styles.row}>
            {leading ? leading(p.fg) : null}
            {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} color={p.fg} strokeWidth={2.2} /> : null}
            <Text variant={size === 'sm' ? 'label' : 'titleS'} color={p.fg} numberOfLines={1} raw={raw}>
              {label}
            </Text>
            {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 15 : 18} color={p.fg} strokeWidth={2.2} /> : null}
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
});

/** Luminous rose, deepening to raspberry: white text stays above 4.5:1 under the label. */
const GIRL_GRADIENT = ['#D63A7E', '#B92B69', '#9E2358'] as const;

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { alignSelf: 'stretch' },
  girlRim: { borderWidth: 1, borderColor: 'rgba(255,214,232,0.45)', borderBottomColor: 'rgba(122,31,61,0.35)' },
});
