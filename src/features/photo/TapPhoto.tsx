import { useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from '@/components/ui/Icon';
import { haptic } from '@/motion/haptics';
import { motion, spring } from '@/motion/tokens';
import { openPhoto, type ViewerPhoto } from './photoViewer';

/**
 * A photo in a feed. Tap: it opens full screen out of its frame. Double
 * tap (when `onLike` is given): a big heart blooms in the middle and the
 * post is liked, never unliked, and never twice (the like itself is
 * guarded server-side by the engagement hook). Scrolling is untouched:
 * taps fail as soon as the finger travels.
 */
export function TapPhoto({ photo, style, children, liked, onLike }: { photo: ViewerPhoto; style?: StyleProp<ViewStyle>; children: ReactNode; liked?: boolean; onLike?: () => void }) {
  // The frame's node, kept as state (not a ref) so the gesture callbacks can use it.
  const [node, setNode] = useState<View | null>(null);
  const reduced = useReducedMotion();
  const heart = useSharedValue(0);
  const heartO = useSharedValue(0);

  const open = () => openPhoto(photo, { current: node });
  const like = () => {
    haptic('success');
    if (!liked) onLike?.();
  };

  const single = Gesture.Tap()
    .maxDuration(260)
    .onEnd((_e, ok) => {
      if (ok) scheduleOnRN(open);
    });
  const double = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(260)
    .onEnd((_e, ok) => {
      if (!ok) return;
      if (reduced) {
        heart.set(1);
        heartO.set(withSequence(withTiming(1, { duration: motion.fast }), withDelay(380, withTiming(0, { duration: motion.fast }))));
      } else {
        heart.set(0.4);
        heart.set(withSequence(withSpring(1.15, spring.fast), withSpring(1, spring.strong), withDelay(220, withTiming(1.3, { duration: 220 }))));
        heartO.set(withSequence(withTiming(1, { duration: 90 }), withDelay(520, withTiming(0, { duration: 220 }))));
      }
      scheduleOnRN(like);
    });

  const bloom = useAnimatedStyle(() => ({ opacity: heartO.value, transform: [{ scale: heart.value }] }));

  return (
    <GestureDetector gesture={onLike ? Gesture.Exclusive(double, single) : single}>
      <View
        ref={setNode}
        collapsable={false}
        style={style}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open photo"
        accessibilityActions={onLike ? [{ name: 'activate' }, { name: 'like', label: 'Like' }] : [{ name: 'activate' }]}
        onAccessibilityAction={(e) => (e.nativeEvent.actionName === 'like' ? like() : open())}
      >
        {children}
        <Animated.View pointerEvents="none" style={[styles.heart, bloom]}>
          {/* A soft dark heart behind keeps the white one visible on bright photos. */}
          <View style={styles.shade}>
            <Icon name="heart" size={104} color="rgba(0,0,0,0.22)" fill="rgba(0,0,0,0.22)" />
          </View>
          <Icon name="heart" size={96} color="#FFFFFF" fill="#FFFFFF" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  heart: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', opacity: 0 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
});
