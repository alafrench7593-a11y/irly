import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Share, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { Badge, IconButton } from '@/components/ui/Controls';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { haptic } from '@/motion/haptics';
import { spring } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { DetailBody, DetailCTA, getHeader } from './details';
import { useHeroStore, type HeroItem, type HeroKind } from './heroStore';

const CLOSE_SPRING = { duration: 460, dampingRatio: 1 } as const;

const heroKey = (h: HeroItem) => `${h.kind}:${h.id}`;

/**
 * Card → full screen. The tapped card's frame grows into the page: its
 * photo becomes the header, its title becomes the page title, the rest of
 * the page rises in underneath. Drag down (or tap ×) to send it back into
 * the card it came from.
 */
export function HeroHost() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const item = useHeroStore((s) => s.item);
  // What is on screen, kept by the store through the closing animation.
  const rendered = useHeroStore((s) => s.active);
  const origin = useHeroStore((s) => s.origin);
  const finish = useHeroStore((s) => s.finish);
  const setHostOffset = useHeroStore((s) => s.setHostOffset);

  const hostRef = useRef<View>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The detail body renders once the card has finished growing.
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  const opened = rendered !== null && openedKey === heroKey(rendered);
  const scrollRef = useRef<Animated.ScrollView>(null);

  const p = useSharedValue(0);
  const drag = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const ox = useSharedValue(0);
  const oy = useSharedValue(0);
  const ow = useSharedValue(0);
  const oh = useSharedValue(0);
  const W = useSharedValue(1);
  const H = useSharedValue(1);

  const heroH = Math.min(size.h * 0.52, 460);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
    W.set(width);
    H.set(height);
    hostRef.current?.measureInWindow?.((x, y) => setHostOffset({ x, y }));
  };

  const done = useCallback(() => {
    setOpenedKey(null);
    finish();
  }, [finish]);

  useEffect(() => {
    if (item) {
      const o = origin ?? {
        x: size.w * 0.08,
        y: size.h * 0.3,
        width: size.w * 0.84,
        height: size.h * 0.34,
      };
      ox.set(o.x);
      oy.set(o.y);
      ow.set(o.width);
      oh.set(o.height);
      drag.set(0);
      scrollY.set(0);
      const key = heroKey(item);
      p.set(0);
      p.set(
        withSpring(1, spring.smooth, (fin) => {
          if (fin) scheduleOnRN(setOpenedKey, key);
        }),
      );
      haptic('tap');
    } else if (useHeroStore.getState().active) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      drag.set(withSpring(0, CLOSE_SPRING));
      p.set(withSpring(0, CLOSE_SPRING, (fin) => {
        if (fin) scheduleOnRN(done);
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  const requestClose = useCallback(() => {
    haptic('tap');
    useHeroStore.getState().close();
  }, []);

  useEffect(() => {
    if (!item) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      requestClose();
      return true;
    });
    return () => sub.remove();
  }, [item, requestClose]);

  /** Navigation from inside a detail: closes the card, then routes. */
  const go = useCallback(
    (href: string) => {
      const m = href.match(/^\/hero\/(\w+)\/(.+)$/);
      if (m) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
        useHeroStore.getState().open({ kind: m[1] as HeroKind, id: m[2] }, null);
        return;
      }
      p.set(withTiming(0, { duration: 180 }, (fin) => {
        if (fin) scheduleOnRN(done);
      }));
      useHeroStore.setState({ item: null });
      router.push(href as never);
    },
    [done, p, router],
  );

  const nativeScroll = Gesture.Native();
  const pan = Gesture.Pan()
    .simultaneousWithExternalGesture(nativeScroll)
    .activeOffsetY(8)
    .onChange((e) => {
      if (scrollY.value <= 0 && (drag.value > 0 || e.changeY > 0)) {
        drag.set(Math.max(0, drag.value + e.changeY));
      }
    })
    .onEnd((e) => {
      if (drag.value > 130 || (drag.value > 24 && e.velocityY > 900)) {
        scheduleOnRN(requestClose);
      } else {
        drag.set(withSpring(0, spring.snappy));
      }
    });

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });

  const frameStyle = useAnimatedStyle(() => {
    const d = drag.value;
    return {
      left: interpolate(p.value, [0, 1], [ox.value, 0]),
      top: interpolate(p.value, [0, 1], [oy.value, 0]),
      width: interpolate(p.value, [0, 1], [ow.value, W.value]),
      height: interpolate(p.value, [0, 1], [oh.value, H.value]),
      borderRadius: interpolate(p.value, [0, 1], [radius.lg, 0]) + Math.min(d / 4, radius.xl),
      transform: [{ translateY: d * 0.55 }, { scale: 1 - Math.min(d, 400) / 1600 }],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 1], [0, 1]) * (1 - Math.min(drag.value, 300) / 450),
  }));

  const imageBox = useAnimatedStyle(() => ({
    height: interpolate(p.value, [0, 1], [oh.value, heroH]),
  }));

  const imageParallax = useAnimatedStyle(() => {
    const y = scrollY.value;
    return {
      transform:
        y < 0
          ? [{ translateY: y / 2 }, { scale: 1 + -y / Math.max(heroH, 1) }]
          : [{ translateY: y * 0.45 }],
    };
  });

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [0.84, 1], Extrapolation.CLAMP) }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.55, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0.4, 1], [36, 0], Extrapolation.CLAMP) }],
  }));

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.6, 1], [0, 1], Extrapolation.CLAMP) * (1 - Math.min(drag.value, 120) / 120),
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(p.value, [0.55, 1], [140, 0], Extrapolation.CLAMP) + drag.value * 0.8 }],
  }));

  const header = rendered ? getHeader(rendered) : null;

  return (
    <View ref={hostRef} style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {rendered && header ? (
        <>
          <StatusBar style="light" />
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.scrim }, backdropStyle]} />
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.frame, { backgroundColor: t.c.bg }, frameStyle]}>
              <GestureDetector gesture={nativeScroll}>
                <Animated.ScrollView
                  ref={scrollRef}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  scrollEnabled={opened}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}
                >
                  <Animated.View style={[styles.imageBox, imageBox]}>
                    <Animated.View style={[StyleSheet.absoluteFill, imageParallax]}>
                      <Photo visual={header.visual} light={header.light} scrim="strong" width={1200} style={StyleSheet.absoluteFill} />
                    </Animated.View>
                    <Animated.View style={[styles.headerText, titleStyle]}>
                      <View style={styles.overlineRow}>
                        <Icon name={header.overlineIcon} size={14} color="#FFFFFF" />
                        <Text variant="overline" tone="onDark">
                          {header.overline}
                        </Text>
                        {header.verified ? <Badge kind="verified" onDark /> : null}
                        {header.pick ? <Badge kind="pick" onDark /> : null}
                      </View>
                      <Text variant="displayL" tone="onDark" numberOfLines={3}>
                        {header.title}
                      </Text>
                      <Text variant="body" color="rgba(255,255,255,0.82)" numberOfLines={2}>
                        {header.meta}
                      </Text>
                    </Animated.View>
                  </Animated.View>
                  <Animated.View style={bodyStyle}>
                    {opened ? <DetailBody item={rendered} go={go} /> : <View style={{ height: 400 }} />}
                  </Animated.View>
                </Animated.ScrollView>
              </GestureDetector>

              <Animated.View style={[styles.chrome, { top: insets.top + 8 }, chromeStyle]} pointerEvents="box-none">
                <IconButton
                  icon="share"
                  label="Share"
                  variant="glass"
                  onPress={() => {
                    Share.share({ message: `${header.title} · ${header.meta} on IRLY` }).catch(() => undefined);
                  }}
                />
                <IconButton icon="x" label="Close" variant="glass" onPress={requestClose} />
              </Animated.View>

              <Animated.View style={[styles.cta, ctaStyle]}>
                <Glass style={[styles.ctaGlass, { paddingBottom: Math.max(insets.bottom, space[4]) }]} intensity={50}>
                  <DetailCTA item={rendered} go={go} />
                </Glass>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', overflow: 'hidden' },
  imageBox: { overflow: 'hidden', justifyContent: 'flex-end' },
  headerText: {
    padding: space.gutter,
    paddingBottom: space[7],
    gap: 8,
    transformOrigin: 'left bottom',
  },
  overlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chrome: {
    position: 'absolute',
    left: space.gutter,
    right: space.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cta: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  ctaGlass: {
    paddingTop: space[4],
    paddingHorizontal: space.gutter,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
