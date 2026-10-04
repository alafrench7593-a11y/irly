import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { scale, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon } from './Icon';
import { Text } from './Text';
import { toast } from './Toast';

type Props = {
  id: string;
  /** "JOIN ACTIVITY", "JOIN", "JOIN GROUP"... */
  label?: string;
  size?: 'lg' | 'md';
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Membership instead of attendance (groups). */
  membership?: boolean;
};

/**
 * Join, as one continuous gesture: pressed (scale.press) → spring → the
 * white button settles into a grey "You're going" with a green check that
 * pops in on `spring.strong`, a success haptic and a toast. Tapping again
 * leaves, and the button springs back to white. The state change reads
 * instantly: colour, label and icon all change together.
 */
export const JoinButton = memo(function JoinButton({ id, label = 'JOIN ACTIVITY', size = 'lg', full, style, membership }: Props) {
  const t = useTheme();
  const joined = useStore((s) => Boolean(membership ? s.memberOf[id] : s.joined[id]));
  const toggle = useStore((s) => (membership ? s.toggleMembership : s.toggleJoin));
  const pulse = useSharedValue(1);
  const check = useSharedValue(joined ? 1 : 0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pulse.set(withSequence(withTiming(1.04, { duration: 110 }), withSpring(1, spring.strong)));
    check.set(joined ? withSpring(1, spring.strong) : withTiming(0, { duration: 120 }));
  }, [joined, pulse, check]);

  const body = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: check.value, transform: [{ scale: 0.4 + check.value * 0.6 }] }));

  const onPress = () => {
    const on = toggle(id);
    if (on) {
      haptic('success');
      toast(membership ? 'Welcome to the group' : "You're going. Group chat unlocked", 'check');
    } else {
      haptic('tap');
      toast(membership ? 'You left the group' : 'You left this activity', 'x', 'live');
    }
  };

  const h = size === 'lg' ? 56 : 46;
  const doneLabel = membership ? 'MEMBER' : "YOU'RE GOING";
  return (
    <Animated.View style={[full ? styles.full : null, body, style]}>
      <PressableScale
        onPress={onPress}
        haptic={false}
        scaleTo={scale.press}
        accessibilityLabel={joined ? `${doneLabel}. Tap to leave` : label}
        accessibilityState={{ selected: joined }}
        style={[
          styles.base,
          {
            height: h,
            backgroundColor: joined ? t.c.overlay : t.c.brand,
            borderColor: joined ? t.c.lineStrong : t.c.brand,
          },
        ]}
      >
        <View style={styles.row}>
          {joined ? (
            <Animated.View style={checkStyle}>
              <Icon name="check" size={18} color={t.c.positive} strokeWidth={2.8} />
            </Animated.View>
          ) : null}
          <Text variant="label" color={joined ? t.c.text : t.c.onBrand} style={styles.label}>
            {joined ? doneLabel : label}
          </Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  base: { borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, letterSpacing: 0.6 },
});
