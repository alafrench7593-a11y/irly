import { BlurView } from 'expo-blur';
import { a11y } from '@/i18n';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
import { useFrame } from '@/components/layout/AppFrame';
import { Gesture, GestureDetector, GestureHandlerRootView, type NativeGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '@/motion/haptics';
import { useKeyboardHeight } from '@/motion/keyboard';
import { duration, easing, spring } from '@/motion/tokens';
import { girlSerif, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Glass } from './Glass';
import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Max height as a fraction of the screen. */
  maxHeight?: number;
  /** Wraps the children in a scroll view, for forms: the field and its button stay reachable when the keyboard shrinks the sheet. */
  scroll?: boolean;
};

/**
 * The scroll view of a sheet and the sheet's drag-to-close share the finger
 * (SheetScrollView): the content scrolls, and the sheet only follows a
 * downward drag that starts with the content at its top. Without this, the
 * sheet's pan and the scroll view raced for every vertical drag on iOS, and
 * the drag often moved the sheet instead of scrolling it (Go live: the area,
 * the visibility and « Post live » could not be reached).
 */
type SheetScroll = { native: NativeGesture; scrollY: SharedValue<number>; attach: () => () => void };
const SheetScrollContext = createContext<SheetScroll | null>(null);

/**
 * A ScrollView for the body of a Sheet (one per sheet): it scrolls, and the
 * sheet is dragged down only from the top of the content. Outside a Sheet it
 * is a plain ScrollView.
 */
export function SheetScrollView({ children, ...props }: ScrollViewProps & { children?: ReactNode }) {
  const ctx = useContext(SheetScrollContext);
  const scrollY = ctx?.scrollY;
  const attach = ctx?.attach;
  useEffect(() => attach?.(), [attach]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY?.set(e.contentOffset.y);
  });
  if (!ctx) return <ScrollView {...props}>{children}</ScrollView>;
  return (
    <GestureDetector gesture={ctx.native}>
      {/* No bounce at the top: a downward drag there is the sheet's, not the content's. */}
      <Animated.ScrollView {...props} onScroll={onScroll} scrollEventThrottle={16} bounces={false} alwaysBounceVertical={false}>
        {children}
      </Animated.ScrollView>
    </GestureDetector>
  );
}

/**
 * Bottom sheet: springs up from below, follows the finger, dismisses on a
 * flick or a drag past a third of its height. The backdrop dims with the
 * sheet's position so the gesture always feels connected.
 *
 * Closing always ends with the Modal gone, even when its slide-out animation
 * is cut short: an invisible Modal left on screen takes every touch of the
 * app (the screen looked frozen).
 */
export const Sheet = memo(function Sheet({ visible, onClose, title, subtitle, children, maxHeight = 0.88, scroll = false }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const frame = useFrame();
  const [mounted, setMounted] = useState(visible);
  // While the sheet slides away it takes no more taps: a second tap on the
  // backdrop or on a button of the leaving sheet would act twice, and on web
  // the tap goes straight to the page underneath instead of being lost.
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const y = useSharedValue(screenH);
  const sheetH = useSharedValue(screenH * 0.6);
  const scrollY = useSharedValue(0);
  // A SheetScrollView in the body: the drag is shared with it (see above).
  const [scrolls, setScrolls] = useState(0);
  const native = useMemo(() => Gesture.Native(), []);
  const attach = useCallback(() => {
    setScrolls((n) => n + 1);
    return () => setScrolls((n) => n - 1);
  }, []);
  const scrollCtx = useMemo(() => ({ native, scrollY, attach }), [native, scrollY, attach]);

  // Each open or close is one "run": the end of an older run (an animation
  // callback, the safety timer) never acts on a newer one.
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  /** The sheet is gone: unmounted (the Modal with it), and the owner told when the sheet closed itself. */
  const endRun = useCallback((n: number, tell: boolean) => {
    if (n !== run.current) return;
    run.current += 1;
    clearTimer();
    setMounted(false);
    if (tell) onCloseRef.current();
  }, [clearTimer]);

  /** Slides the sheet out, then ends the run, whether or not the animation completes. */
  const slideOut = useCallback(
    (tell: boolean) => {
      const n = ++run.current;
      closingRef.current = true;
      y.set(
        withTiming(sheetH.value + 40, { duration: duration.base, easing: easing.exit }, () => {
          scheduleOnRN(endRun, n, tell);
        }),
      );
      // Safety net: an interrupted animation (or one never run, app in the background) still closes.
      clearTimer();
      timer.current = setTimeout(() => endRun(n, tell), duration.base + 450);
    },
    [clearTimer, endRun, sheetH, y],
  );

  // Opened: mounted at once (during render, so the open never waits an extra frame).
  const [shownFor, setShownFor] = useState(visible);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (visible) {
      run.current += 1;
      clearTimer();
      closingRef.current = false;
      scrollY.set(0);
      y.set(screenH);
      y.set(withSpring(0, spring.sheet));
    } else if (mounted) {
      slideOut(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = useCallback(() => {
    if (closingRef.current) return;
    setClosing(true);
    slideOut(true);
  }, [slideOut]);

  const fling = useCallback(() => {
    if (closingRef.current) return;
    haptic('tap');
    setClosing(true);
    slideOut(true);
  }, [slideOut]);

  // A flick or a long drag ends on the UI thread; the JS side then closes (see fling).
  const flung = useSharedValue(0);
  useAnimatedReaction(
    () => flung.value,
    (v, prev) => {
      if (prev !== null && v > prev) scheduleOnRN(fling);
    },
    [fling],
  );

  // Built once per body (not on every keystroke of a form in the sheet).
  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .activeOffsetY([-6, 6])
      .onChange((e) => {
        if (scrolls > 0 && y.value <= 0) {
          // The content is scrolled: the finger scrolls it back first. A drag up scrolls it, never lifts the sheet.
          if (scrollY.value > 0 || e.changeY < 0) return;
        }
        y.set(Math.max(-24, y.value + e.changeY * (y.value < 0 ? 0.25 : 1)));
      })
      .onEnd((e) => {
        if (y.value > sheetH.value * 0.33 || (e.velocityY > 900 && y.value > 0)) {
          flung.set(flung.value + 1);
        } else {
          y.set(withSpring(0, spring.sheet));
        }
      });
    return scrolls > 0 ? g.simultaneousWithExternalGesture(native) : g;
  }, [scrolls, native, y, scrollY, sheetH, flung]);

  // Inputs in a sheet (Go live, report) stay above the keyboard: the sheet
  // sits on the keyboard and shrinks so its top stays on screen.
  const keyboard = useKeyboardHeight(mounted);
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: Math.max(-24, y.value) }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, sheetH.value], [1, 0], Extrapolation.CLAMP),
  }));

  if (!mounted) return null;

  const width = Math.min(frame.width, layout.maxContentWidth + 40);
  // IRLY Girl: the page behind dims to plum and softly blurs; the panel is the densest pearl glass.
  const girl = t.flavor === 'girl';

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={dismiss}>
      <GestureHandlerRootView style={styles.flex} pointerEvents={closing ? 'none' : 'auto'}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }, backdropStyle]}>
          {girl && Platform.OS !== 'android' ? <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
          <Pressable style={styles.flex} onPress={dismiss} accessibilityLabel={a11y('Close')} />
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
                backgroundColor: 'transparent',
                borderColor: 'transparent',
                boxShadow: t.shadow.float,
              },
              sheetStyle,
            ]}
            accessibilityViewIsModal
          >
            <Glass level="thick" variant={girl ? 'sheet' : undefined} style={[StyleSheet.absoluteFill, styles.pane]} />
            <View style={styles.grabberWrap}>
              <View style={[styles.grabber, { backgroundColor: t.c.lineStrong }]} />
            </View>
            {title ? (
              <View style={styles.header}>
                <Text variant="titleL" accessibilityRole="header" style={girl ? styles.girlTitle : undefined}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text variant="body" tone="secondary">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <SheetScrollContext.Provider value={scrollCtx}>
              {scroll ? (
                <SheetScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  {children}
                </SheetScrollView>
              ) : (
                children
              )}
            </SheetScrollContext.Provider>
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
  body: { flexShrink: 1 },
  pane: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, borderRadius: radius.xxl },
  grabberWrap: { alignItems: 'center', paddingVertical: 6 },
  grabber: { width: 38, height: 5, borderRadius: 3 },
  header: { paddingHorizontal: space.gutter + 4, paddingTop: space[3], paddingBottom: space[4], gap: 4 },
  girlTitle: { fontFamily: girlSerif.regular, fontSize: 30, lineHeight: 34, letterSpacing: -0.2, fontWeight: 'normal' },
});
