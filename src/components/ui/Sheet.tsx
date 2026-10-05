import { memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useFrame } from '@/components/layout/AppFrame';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '@/motion/haptics';
import { useKeyboardHeight } from '@/motion/keyboard';
import { duration, easing, spring } from '@/motion/tokens';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Max height as a fraction of the screen. */
  maxHeight?: number;
};

/**
 * Bottom sheet: springs up from below, follows the finger, dismisses on a
 * flick or a drag past a third of its height. The backdrop dims with the
 * sheet's position so the gesture always feels connected.
 */
export const Sheet = memo(function Sheet({ visible, onClose, title, subtitle, children, maxHeight = 0.88 }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const frame = useFrame();
  const [mounted, setMounted] = useState(visible);
  const y = useSharedValue(screenH);
  const sheetH = useSharedValue(screenH * 0.6);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      y.set(screenH);
      y.set(withSpring(0, spring.sheet));
    } else if (mounted) {
      y.set(withTiming(sheetH.value + 40, { duration: duration.base, easing: easing.exit }, (fin) => {
        if (fin) scheduleOnRN(setMounted, false);
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = useCallback(() => {
    y.set(withTiming(sheetH.value + 40, { duration: duration.base, easing: easing.exit }, (fin) => {
      if (fin) scheduleOnRN(finishClose);
    }));
  }, [finishClose, sheetH, y]);

  const pan = Gesture.Pan()
    .activeOffsetY([-6, 6])
    .onChange((e) => {
      y.set(Math.max(-24, y.value + e.changeY * (y.value < 0 ? 0.25 : 1)));
    })
    .onEnd((e) => {
      if (y.value > sheetH.value * 0.33 || e.velocityY > 900) {
        y.set(withTiming(sheetH.value + 40, { duration: duration.base, easing: easing.exit }, (fin) => {
          if (fin) scheduleOnRN(finishClose);
        }));
        scheduleOnRN(haptic, 'tap');
      } else {
        y.set(withSpring(0, spring.sheet));
      }
    });

  // Inputs in a sheet (Go live, report) stay above the keyboard: the sheet
  // sits on the keyboard and shrinks so its top stays on screen.
  const keyboard = useKeyboardHeight(mounted);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-24, y.value) }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, sheetH.value], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  const width = Math.min(frame.width, layout.maxContentWidth + 40);

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }, backdropStyle]}>
          <Pressable style={styles.flex} onPress={dismiss} accessibilityLabel="Close" />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={(e) => {
              sheetH.set(e.nativeEvent.layout.height);
            }}
            style={[
              styles.sheet,
              {
                width,
                bottom: keyboard,
                maxHeight: Math.min(screenH * maxHeight, screenH - keyboard - insets.top - 8),
                paddingBottom: keyboard ? space[3] : Math.max(insets.bottom, space[5]) + space[3],
                backgroundColor: t.c.raised,
                borderColor: t.c.line,
                boxShadow: t.shadow.float,
              },
              sheetStyle,
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: t.c.lineStrong }]} />
            </View>
            {title ? (
              <View style={styles.header}>
                <Text variant="titleL" accessibilityRole="header">
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="body" tone="secondary">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: 0,
    paddingTop: 8,
    ...Platform.select({ web: { cursor: 'auto' } as object, default: {} }),
  },
  grabberWrap: { alignItems: 'center', paddingVertical: 6 },
  grabber: { width: 38, height: 5, borderRadius: 3 },
  header: { paddingHorizontal: space.gutter + 4, paddingTop: space[3], paddingBottom: space[4], gap: 4 },
});
