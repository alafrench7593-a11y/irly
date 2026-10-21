import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { PageHeader } from '@/components/navigation/Headers';
import { Text } from '@/components/ui/Text';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { layout, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Props = {
  title: string;
  overline?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  /** Rendered above the scroll view (floating actions, sheets). */
  overlay?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: number;
  /** Tab roots have no back button. */
  back?: boolean;
  /** Replaces the default back (e.g. to ask before leaving a draft). */
  onBack?: () => void;
  /** Told (on the JS thread, every few dozen points) when the page scrolls: what is on screen changed. */
  onScrolled?: () => void;
};

/** Standard stack page: large editorial title that hands over to a compact header on scroll. */
export function Page({ title, overline, subtitle, right, children, overlay, contentStyle, bottomInset = 40, back = true, onBack, onScrolled }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const told = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollY.set(e.contentOffset.y);
      if (onScrolled && Math.abs(e.contentOffset.y - told.get()) > 24) {
        told.set(e.contentOffset.y);
        scheduleOnRN(onScrolled);
      }
    },
    onMomentumEnd: () => {
      if (onScrolled) scheduleOnRN(onScrolled);
    },
  });
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      {/* Forms on pages (sign-in, profile, create) stay above the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingTop: insets.top + layout.headerHeight + 12, paddingBottom: insets.bottom + bottomInset }, contentStyle]}
        >
          <Animated.View entering={enter.rise(0, 40)} style={styles.head}>
            {overline ? (
              <Text variant="overline" tone="accent">
                {overline}
              </Text>
            ) : null}
            <Text variant="displayL" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" tone="secondary">
                {subtitle}
              </Text>
            ) : null}
          </Animated.View>
          {children}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
      <PageHeader title={title} scrollY={scrollY} right={right} back={back} onBack={onBack} />
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  head: { paddingHorizontal: space.gutter, gap: 4, marginBottom: space[7] },
});
