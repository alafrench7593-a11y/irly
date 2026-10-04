import { memo, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { HapticKind } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
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
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  full?: boolean;
  haptic?: HapticKind | false;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
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
  iconRight,
  loading,
  disabled,
  full,
  haptic = 'tap',
  style,
  accessibilityHint,
}: Props) {
  const t = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (variant === 'done') {
      pulse.set(withSequence(withTiming(1.06, { duration: 120 }), withSpring(1, spring.bouncy)));
    }
  }, [variant, pulse]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string; shadow?: string }> = {
    primary: { bg: t.c.brand, fg: t.c.onBrand, shadow: t.shadow.glow },
    secondary: { bg: t.c.raised, fg: t.c.text, border: t.c.lineStrong },
    ghost: { bg: 'transparent', fg: t.c.text },
    glass: { bg: 'rgba(255,255,255,0.16)', fg: '#FFFFFF', border: 'rgba(255,255,255,0.22)' },
    inverse: { bg: t.c.text, fg: t.c.bg },
    done: { bg: t.c.positiveSoft, fg: t.c.positive, border: t.c.positive },
    danger: { bg: t.c.critical, fg: '#FFFFFF' },
  };
  const p = palette[variant];
  const h = HEIGHT[size];

  return (
    <Animated.View style={[full ? styles.full : null, animated, style]}>
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
            backgroundColor: p.bg,
            borderWidth: p.border ? StyleSheet.hairlineWidth * 2 : 0,
            borderColor: p.border,
            boxShadow: p.shadow,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <View style={styles.row}>
            {icon ? <Icon name={icon} size={size === 'sm' ? 15 : 18} color={p.fg} strokeWidth={2.2} /> : null}
            <Text variant={size === 'sm' ? 'label' : 'titleS'} color={p.fg} numberOfLines={1}>
              {label}
            </Text>
            {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 15 : 18} color={p.fg} strokeWidth={2.2} /> : null}
          </View>
        )}
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  full: { alignSelf: 'stretch' },
});
