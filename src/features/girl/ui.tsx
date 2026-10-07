import { memo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/motion/PressableScale';
import { SelectionLayers, useSelection } from '@/motion/Selection';
import { radius } from '@/theme/tokens';
import { girl } from './theme';

/** Chip in the IRLY Girl palette: rose ink when selected, cream otherwise. */
export const GChip = memo(function GChip({
  label,
  selected,
  onPress,
  icon,
  small,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  small?: boolean;
}) {
  const { p, sweep, outer } = useSelection(Boolean(selected));
  const box = [styles.chip, small ? styles.chipSmall : null];
  const content = (fg: string) => (
    <>
      {icon ? <Icon name={icon} size={small ? 13 : 15} color={fg} /> : null}
      <Text variant="label" color={fg} style={small ? { fontSize: 12 } : null}>
        {label}
      </Text>
    </>
  );
  return (
    <Animated.View style={outer}>
      <PressableScale
        haptic={onPress ? 'select' : false}
        scaleTo={0.95}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityState={{ selected }}
        accessibilityLabel={label}
      >
        <SelectionLayers
          p={p}
          sweep={sweep}
          fill={girl.ink}
          radius={small ? 15 : 19}
          base={<View style={[box, { backgroundColor: girl.surface, borderColor: girl.line }]}>{content(girl.ink)}</View>}
          chosen={<View style={[box, { borderColor: girl.ink }]}>{content('#FFFFFF')}</View>}
        />
      </PressableScale>
    </Animated.View>
  );
});

export function GButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? girl.ink : variant === 'secondary' ? girl.surface : 'transparent';
  const fg = variant === 'primary' ? '#FFFFFF' : girl.ink;
  return (
    <PressableScale
      haptic="press"
      scaleTo={0.96}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? girl.line : 'transparent', opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      {!loading ? (
        <Text variant="label" color={fg} style={styles.buttonLabel}>
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}

export function GSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleS" color={girl.ink}>
          {title}
        </Text>
        {hint ? (
          <Text variant="bodyS" color={girl.inkSoft}>
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function Wrap({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

/** "92% match" pill. */
export function ScorePill({ score, onDark }: { score: number; onDark?: boolean }) {
  return (
    <View style={[styles.score, { backgroundColor: onDark ? 'rgba(255,255,255,0.92)' : girl.blush }]}>
      <Icon name="sparkles" size={13} color={girl.rose} />
      <Text variant="label" color={girl.ink}>
        {score}% match
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipSmall: { height: 30, paddingHorizontal: 11 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, paddingHorizontal: 22, borderRadius: radius.pill, borderWidth: 1 },
  buttonLabel: { fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
