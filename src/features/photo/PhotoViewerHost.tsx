import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Icon } from '@/components/ui/Icon';
import { Photo } from '@/components/visual/Photo';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { haptic } from '@/motion/haptics';
import { motion, spring } from '@/motion/tokens';
import { usePhotoViewer } from './photoViewer';

const CLOSE_SPRING = { duration: 420, dampingRatio: 1 } as const;
/** Drag further than this (or flick) to close. */
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 900;

/**
 * Photo → full screen. The photo grows out of its frame in the feed to the
 * width of the screen (same crop, so nothing jumps), the room darkens
 * behind it. Drag it down, tap the dark, tap × or press back to send it
 * home to its frame. Reduced motion: a short fade, no travel.
 */
export function PhotoViewerHost() {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const photo = usePhotoViewer((s) => s.photo);
  const shown = usePhotoViewer((s) => s.shown);
  const key = usePhotoViewer((s) => s.key);
  const finish = usePhotoViewer((s) => s.finish);
  const setHostOffset = usePhotoViewer((s) => s.setHostOffset);
  const hostRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const p = useSharedValue(0);
  const dragY = useSharedValue(0);
  const from = { x: useSharedValue(0), y: useSharedValue(0), w: useSharedValue(0), h: useSharedValue(0) };
  const to = { x: useSharedValue(0), y: useSharedValue(0), w: useSharedValue(0), h: useSharedValue(0) };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    hostRef.current?.measureInWindow?.((x, y) => setHostOffset({ x, y }));
  };

  useEffect(() => {
    if (photo) {
      const { origin } = usePhotoViewer.getState();
      const W = size.w || 390;
      const H = size.h || 844;
      // Full width, the frame's own proportions, never taller than the screen.
      const ratio = origin ? origin.height / origin.width : 0.75;
      const h = Math.min(W * ratio, H - insets.top - insets.bottom - 96);
      const w = h / ratio;
      const target = { x: (W - w) / 2, y: (H - h) / 2, width: w, height: h };
      const start = origin && !reduced ? origin : target;
      from.x.set(start.x);
      from.y.set(start.y);
      from.w.set(start.width);
      from.h.set(start.height);
      to.x.set(target.x);
      to.y.set(target.y);
      to.w.set(target.width);
      to.h.set(target.height);
      dragY.set(0);
      p.set(0);
      p.set(reduced ? withTiming(1, { duration: motion.fast }) : withSpring(1, spring.soft));
      haptic('tap');
    } else if (usePhotoViewer.getState().shown) {
      const done = () => finish();
      const end = (fin?: boolean) => {
        'worklet';
        if (fin) scheduleOnRN(done);
      };
      dragY.set(reduced ? 0 : withSpring(0, CLOSE_SPRING));
      p.set(reduced ? withTiming(0, { duration: motion.fast }, end) : withSpring(0, CLOSE_SPRING, end));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, key]);

  const close = useCallback(() => {
    if (!usePhotoViewer.getState().photo) return;
    haptic('tap');
    usePhotoViewer.getState().close();
  }, []);

  // Back button (Android) and Escape (web) close the photo.
  useEffect(() => {
    if (!photo) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    const g = globalThis as { addEventListener?: (t: string, f: (e: { key: string }) => void) => void; removeEventListener?: (t: string, f: (e: { key: string }) => void) => void };
    const onKey = (e: { key: string }) => e.key === 'Escape' && close();
    if (Platform.OS === 'web') g.addEventListener?.('keydown', onKey);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') g.removeEventListener?.('keydown', onKey);
    };
  }, [photo, close]);

  const pan = Gesture.Pan()
    .enabled(Boolean(photo))
    .activeOffsetY([-12, 12])
    .onUpdate((e) => {
      dragY.set(e.translationY);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationY) > DISMISS_DISTANCE || Math.abs(e.velocityY) > DISMISS_VELOCITY) scheduleOnRN(close);
      else dragY.set(withSpring(0, spring.medium));
    });

  const frame = useAnimatedStyle(() => {
    const v = p.value;
    // Dragging shrinks the photo a little, as if held at arm's length.
    const pull = Math.min(Math.abs(dragY.value) / 600, 0.25);
    return {
      position: 'absolute',
      left: interpolate(v, [0, 1], [from.x.value, to.x.value]),
      top: interpolate(v, [0, 1], [from.y.value, to.y.value]),
      width: interpolate(v, [0, 1], [from.w.value, to.w.value]),
      height: interpolate(v, [0, 1], [from.h.value, to.h.value]),
      borderRadius: interpolate(v, [0, 1], [16, 0]),
      opacity: reduced ? v : 1,
      transform: [{ translateY: dragY.value }, { scale: 1 - pull }],
    };
  });
  const dim = useAnimatedStyle(() => ({ opacity: p.value * (1 - Math.min(Math.abs(dragY.value) / 400, 0.7)) }));
  const chrome = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0.6, 1], [0, 1], 'clamp') * (dragY.value === 0 ? 1 : 0.4) }));

  return (
    <View ref={hostRef} onLayout={onLayout} pointerEvents={shown ? 'auto' : 'none'} style={StyleSheet.absoluteFill}>
      {shown ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dim]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={tx('Close photo')} />
          </Animated.View>
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.frame, frame]} accessibilityRole="image" accessibilityViewIsModal>
              {/* The image takes no pointer: in a browser, dragging an <img> starts the
                  native drag-and-drop and would steal the drag-to-close gesture. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                {'uri' in shown ? (
                  <Image source={{ uri: shown.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Photo visual={shown.visual} light={shown.light} style={StyleSheet.absoluteFill} width={1400} />
                )}
              </View>
            </Animated.View>
          </GestureDetector>
          <Animated.View style={[styles.close, { top: insets.top + 12 }, chrome]}>
            <PressableScale onPress={close} haptic={false} scaleTo={0.9} hitSlop={10} accessibilityLabel="Close photo" style={styles.closeBtn}>
              <Icon name="x" size={20} color="#FFFFFF" />
            </PressableScale>
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: '#000000' },
  frame: { overflow: 'hidden', backgroundColor: '#111111' },
  close: { position: 'absolute', right: 16 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
});
