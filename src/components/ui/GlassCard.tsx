import { memo, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { PressableScale } from '@/motion/PressableScale';
import { radius as radii, type GlassLevel } from '@/theme/tokens';
import { Glass } from './Glass';

type Props = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Makes the whole card a button that sinks a little under the finger. */
  onPress?: () => void;
  accessibilityLabel?: string;
  level?: GlassLevel;
  /** Glass on a photo (always light on dark). */
  dark?: boolean;
  padding?: number;
  radius?: number;
};

/**
 * A panel of glass with large rounded corners: the IRLY surface for
 * content laid over a photo or the blurred backdrop of a page. Pressable
 * cards get the press depth (scale 0.98, light haptic).
 */
export const GlassCard = memo(function GlassCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  level = 'regular',
  dark,
  padding = 16,
  radius = radii.xl,
}: Props) {
  const glass = (
    <Glass level={level} dark={dark} style={[styles.base, { padding, borderRadius: radius }, onPress ? null : style]}>
      {children}
    </Glass>
  );
  if (!onPress) return glass;
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} style={style} accessibilityLabel={accessibilityLabel}>
      {glass}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
});
