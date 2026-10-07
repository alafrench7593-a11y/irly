import { useRouter } from 'expo-router';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import type { Engagement, Target } from '@/features/server/engage';
import { PressableScale } from '@/motion/PressableScale';
import { haptic } from '@/motion/haptics';
import { spring } from '@/motion/tokens';
import { useTheme } from '@/theme/useTheme';

type Eng = { get: (id: string) => Engagement; like: (id: string) => Promise<void>; save: (id: string) => Promise<void>; signedIn: boolean };

/**
 * Like · Comment · Share · Save, the same everywhere (IRL posts, events,
 * activities, community posts). Counts are live; like and save are
 * optimistic and roll back if the server refuses.
 */
export const ActionBar = memo(function ActionBar({ target, eng, onDark, comments = true }: { target: Target; eng: Eng; onDark?: boolean; comments?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const e = eng.get(target.id);
  const fg = onDark ? '#FFFFFF' : t.c.text;

  const guard = (fn: () => Promise<void> | void) => () => {
    if (!eng.signedIn) {
      toast('Sign in to interact', 'user', 'brand');
      router.push('/account');
      return;
    }
    Promise.resolve(fn()).catch((err) => toast(err instanceof Error ? err.message : 'Try again', 'x', 'live'));
  };

  const q = `type=${target.type}&id=${encodeURIComponent(target.id)}&title=${encodeURIComponent(target.title ?? '')}`;

  return (
    <View style={styles.row}>
      <Action icon="heart" label={e.liked ? 'Unlike' : 'Like'} count={e.likes} active={e.liked} activeColor={t.c.live} color={fg} pop onPress={guard(() => eng.like(target.id))} />
      {comments ? <Action icon="message" label="Comments" count={e.comments} color={fg} onPress={guard(() => router.push(`/comments?${q}`))} /> : null}
      <Action icon="send" label="Share" color={fg} onPress={guard(() => router.push(`/share?${q}`))} />
      <View style={{ flex: 1 }} />
      <Action icon="bookmark" label={e.saved ? 'Saved' : 'Save'} active={e.saved} activeColor={fg} color={fg} pop onPress={guard(() => eng.save(target.id))} />
    </View>
  );
});

function Action({
  icon,
  label,
  count,
  active,
  activeColor,
  color,
  pop,
  onPress,
}: {
  icon: IconName;
  label: string;
  count?: number;
  active?: boolean;
  activeColor?: string;
  color: string;
  pop?: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const was = useRef(active);
  useEffect(() => {
    const turnedOn = active && !was.current;
    was.current = active;
    if (!pop || reduced || !turnedOn) return;
    // State change, felt: the heart and bookmark pop when they turn on.
    scale.set(withSequence(withSpring(1.28, spring.fast), withSpring(1, spring.strong)));
    haptic('select');
  }, [active, pop, reduced, scale]);
  const c = active ? (activeColor ?? color) : color;
  return (
    <PressableScale onPress={onPress} scaleTo={0.88} haptic={false} hitSlop={8} accessibilityLabel={label} style={styles.action}>
      <Animated.View style={style}>
        <Icon name={icon} size={22} color={c} fill={active ? c : undefined} />
      </Animated.View>
      {count ? (
        <Text variant="label" color={color}>
          {count}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
});
