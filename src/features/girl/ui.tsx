import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { enter } from '@/motion/enter';
import { radius, type GlassLevel } from '@/theme/tokens';
import { girl, girlType } from './theme';

/**
 * IRLY Girl's frosted glass, laid under a control's content: the shared
 * Glass of the design system (blur, lit edge, sheen; a dense tint on
 * Android). Inside <Flavor value="girl"> it already carries the rose veil;
 * `dark` is for controls placed on a photo, where white text needs a smoked
 * pane. The parent sets the shape (borderRadius) and keeps its own shadow,
 * so the glass never clips it; the parent also sets `zIndex: 0`, so the
 * glass (at -1) stays under its content, icons included, on web too.
 */
export const GlassFill = memo(function GlassFill({ dark, level = 'regular', radius: r }: { dark?: boolean; level?: GlassLevel; radius: number }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: -1, borderRadius: r, overflow: 'hidden' }]}>
      <Glass light={!dark} dark={dark} level={level} style={[StyleSheet.absoluteFill, { borderRadius: r }]} />
    </View>
  );
});

/**
 * A pane of IRLY Girl glass that rises into place: the same GlassCard as
 * IRLY Mixte (lit edge, sheen, lift), in the Girl flavor. `index` staggers
 * a list; `onPress` makes the whole card sink a little under the finger.
 */
export function GCard({ children, index = 0, onPress, style, padding = 16, accessibilityLabel }: { children: ReactNode; index?: number; onPress?: () => void; style?: StyleProp<ViewStyle>; padding?: number; accessibilityLabel?: string }) {
  return (
    <Animated.View entering={enter.rise(Math.min(index, 8))}>
      <GlassCard padding={padding} onPress={onPress} accessibilityLabel={accessibilityLabel} style={[{ boxShadow: girl.shadowSoft }, style]}>
        {children}
      </GlassCard>
    </Animated.View>
  );
}

/** Chip of IRLY Girl: the shared Chip (glass at rest, rose when selected, spring + haptic). */
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
  return <Chip label={label} icon={icon} selected={selected} onPress={onPress} size={small ? 'sm' : 'md'} />;
});

/**
 * Button of IRLY Girl: the shared Button, so it has the same press depth,
 * haptics, loading and morph as IRLY Mixte; inside the Girl flavor the
 * primary is the rose gradient and the secondary a rose glass pane.
 */
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
  return <Button label={label} onPress={onPress} icon={icon} variant={variant} disabled={disabled} loading={loading} haptic="press" style={style} />;
}

export function GSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text variant="titleS" color={girl.ink} style={girlType.card}>
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
      <Text variant="label" color={girl.rose}>
        {score}% match
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
