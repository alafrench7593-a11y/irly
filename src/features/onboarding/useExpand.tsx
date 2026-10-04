import { useCallback, useRef, useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Photo } from '@/components/visual/Photo';
import type { Visual } from '@/data/types';
import { spring } from '@/motion/tokens';
import type { LightId } from '@/theme/lights';
import { radius } from '@/theme/tokens';

type Target = { x: number; y: number; w: number; h: number; visual: Visual; light: LightId };

/**
 * Local "card becomes the next screen" transition for onboarding. The
 * selected card grows to full screen; the next screen starts on the same
 * image, so the hand-off is invisible.
 */
export function useExpand() {
  const hostRef = useRef<View>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const p = useSharedValue(0);
  const box = useSharedValue({ x: 0, y: 0, w: 0, h: 0, W: 1, H: 1 });
  const onDoneRef = useRef<() => void>(() => undefined);

  const finish = useCallback(() => onDoneRef.current(), []);

  const expand = useCallback(
    (ref: RefObject<View | null>, visual: Visual, light: LightId, onDone: () => void) => {
      onDoneRef.current = onDone;
      const host = hostRef.current;
      const node = ref.current;
      if (!host || !node) {
        onDone();
        return;
      }
      host.measureInWindow((hx, hy, W, H) => {
        node.measureInWindow((x, y, w, h) => {
          box.set({ x: x - hx, y: y - hy, w, h, W, H });
          setTarget({ x: x - hx, y: y - hy, w, h, visual, light });
          p.set(0);
          p.set(withSpring(1, spring.smooth, (fin) => {
            if (fin) scheduleOnRN(finish);
          }));
        });
      });
    },
    [box, finish, p],
  );

  const reset = useCallback(() => {
    setTarget(null);
    p.set(0);
  }, [p]);

  const style = useAnimatedStyle(() => {
    const b = box.value;
    return {
      left: interpolate(p.value, [0, 1], [b.x, 0]),
      top: interpolate(p.value, [0, 1], [b.y, 0]),
      width: interpolate(p.value, [0, 1], [b.w, b.W]),
      height: interpolate(p.value, [0, 1], [b.h, b.H]),
      borderRadius: interpolate(p.value, [0, 1], [radius.xl, 0]),
    };
  });

  const overlay = (
    <View ref={hostRef} style={StyleSheet.absoluteFill} pointerEvents={target ? 'auto' : 'none'}>
      {target ? (
        <Animated.View style={[styles.box, style]}>
          <Photo visual={target.visual} light={target.light} scrim="full" width={1200} style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );

  return { overlay, expand, reset, expanding: Boolean(target) };
}

const styles = StyleSheet.create({
  box: { position: 'absolute', overflow: 'hidden' },
});
