import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { scale, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { toast } from './Toast';

type Answer = 'going' | 'no' | 'maybe';

const OPTIONS: { id: Answer; label: string; icon: IconName }[] = [
  { id: 'going', label: 'Going', icon: 'check' },
  { id: 'no', label: 'Not going', icon: 'x' },
  { id: 'maybe', label: 'Maybe', icon: 'clock' },
];

/**
 * Going / Not going / Maybe on a glass track. A white pill slides to the
 * answer on `spring.medium` and the chosen icon takes its colour; "Going"
 * joins the session (participant list, group chat), with a success haptic.
 */
export function RsvpControl({ id, onDark }: { id: string; onDark?: boolean }) {
  const t = useTheme();
  const joined = useStore((s) => Boolean(s.joined[id]));
  const other = useStore((s) => s.rsvp?.[id]);
  const setRsvp = useStore((s) => s.setRsvp);
  const answer: Answer | null = joined ? 'going' : (other ?? null);
  const [w, setW] = useState(0);
  const index = answer ? OPTIONS.findIndex((o) => o.id === answer) : -1;
  const x = useSharedValue(0);
  const segW = w ? (w - 8) / OPTIONS.length : 0;
  useEffect(() => {
    if (segW && index >= 0) x.set(withSpring(index * segW, spring.medium));
  }, [segW, index, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const choose = (a: Answer) => {
    if (a === answer) return;
    setRsvp(id, a);
    if (a === 'going') {
      haptic('success');
      toast("You're going. Group chat unlocked", 'check');
    } else {
      haptic('select');
    }
  };

  const track = onDark ? 'rgba(255,255,255,0.14)' : t.c.overlay;
  const tint: Record<Answer, string> = { going: t.c.positive, no: t.c.textTertiary, maybe: t.c.caution };
  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      style={[styles.track, { backgroundColor: track }]}
      accessibilityRole="radiogroup"
    >
      {segW && index >= 0 ? <Animated.View style={[styles.pill, { width: segW, boxShadow: t.shadow.card }, pill]} /> : null}
      {OPTIONS.map((o) => {
        const on = o.id === answer;
        const fg = on ? '#0A0A0A' : onDark ? '#FFFFFF' : t.c.text;
        return (
          <PressableScale
            key={o.id}
            haptic={false}
            scaleTo={scale.press}
            onPress={() => choose(o.id)}
            style={styles.item}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
          >
            <View style={[styles.dot, { backgroundColor: on ? tint[o.id] : onDark ? 'rgba(255,255,255,0.3)' : t.c.lineStrong }]}>
              <Icon name={o.icon} size={11} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text variant="label" color={fg}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, height: 64 },
  pill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
