import { useEffect, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { PageHeader } from '@/components/navigation/Headers';
import { Text } from '@/components/ui/Text';
import { Ambient } from '@/components/visual/Ambient';
import { duration, spring } from '@/motion/tokens';
import { layout, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { LightDrift } from './motion';
import { AccentFill, layered, useNetworkTone } from './tone';

/**
 * A Network page: the ambient light of Network, its slow drifting light,
 * and a title that arrives in three beats (the overline, the title rising,
 * a short accent stroke drawing itself, then the line under it) before the
 * blocks of the page follow (see blockIn). The title hands over to the
 * compact header on scroll, as every IRLY page.
 */
export function NetworkPage({
  overline,
  title,
  subtitle,
  right,
  children,
  overlay,
  onScrolled,
  scrollY: given,
}: {
  overline?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  /** Told (on the JS thread, every few dozen points) when the page scrolls. */
  onScrolled?: () => void;
  scrollY?: SharedValue<number>;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const own = useSharedValue(0);
  const scrollY = given ?? own;
  const told = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      if (onScrolled && Math.abs(e.contentOffset.y - told.get()) > 24) {
        told.set(e.contentOffset.y);
        scheduleOnRN(onScrolled);
      }
    },
  });
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <LightDrift scrollY={scrollY} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 12, paddingBottom: insets.bottom + 56 }}
        >
          <NetworkTitle overline={overline} title={title} subtitle={subtitle} />
          {children}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <PageHeader title={title} scrollY={scrollY} right={right} />
      {overlay}
    </View>
  );
}

/** The title of a Network page, in three beats (still with « Reduce motion »). */
export function NetworkTitle({ overline, title, subtitle }: { overline?: string; title: string; subtitle?: string }) {
  const tone = useNetworkTone();
  const reduced = useReducedMotion();
  const stroke = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) stroke.set(withDelay(260, withSpring(1, spring.soft)));
  }, [stroke, reduced]);
  const strokeStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, stroke.value * 1.5), transform: [{ scaleX: stroke.value }] }));
  return (
    <View style={styles.head}>
      {overline ? (
        <Animated.View entering={FadeIn.duration(duration.slow).delay(40)} style={styles.overline}>
          <Text variant="overline" color={tone.isGirl ? tone.accent : undefined} tone={tone.isGirl ? undefined : 'secondary'}>
            {overline}
          </Text>
        </Animated.View>
      ) : null}
      <Animated.View entering={FadeInDown.springify(spring.soft.duration).dampingRatio(0.92).delay(90)}>
        <Text variant="displayL" accessibilityRole="header">
          {title}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.stroke, layered, { overflow: 'hidden', boxShadow: tone.glow }, strokeStyle]}>
        <AccentFill colors={tone.gradient} />
      </Animated.View>
      {subtitle ? (
        <Animated.View entering={FadeIn.duration(duration.slow).delay(220)}>
          <Text variant="body" tone="secondary">
            {subtitle}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, gap: 6, marginBottom: space[7] },
  overline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stroke: { width: 44, height: 3, borderRadius: 2, marginTop: 2, marginBottom: 4, transformOrigin: 'left' },
});
