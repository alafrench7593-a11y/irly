import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { t } from '@/i18n';
import { spring } from '@/motion/tokens';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ToastData = { id: number; title: string; icon?: IconName; tone?: 'positive' | 'brand' | 'live' };

const useToastStore = create<{ current: ToastData | null }>(() => ({ current: null }));

let counter = 0;

/** Fire-and-forget confirmation: "You're in", "Saved", "Request sent". */
/** Browser and runtime errors people should never read as-is. */
function readable(title: string): string {
  if (/failed to fetch|network request failed|load failed|networkerror/i.test(title)) return 'No connection. Check your network and try again';
  if (/cannot read propert|undefined is not|is not a function|typeerror/i.test(title)) return 'Something went wrong. Try again';
  if (/jwt|row-level security|violates|permission denied|duplicate key|pgrst|syntax error|relation .* does not exist|status code 5\d\d|internal server error/i.test(title)) return 'Something went wrong on our side. Try again in a moment';
  return title;
}

export function toast(title: string, icon: IconName = 'check', tone: ToastData['tone'] = 'positive') {
  counter += 1;
  useToastStore.setState({ current: { id: counter, title: t(readable(title)), icon, tone } });
}

export const ToastHost = memo(function ToastHost() {
  const current = useToastStore((s) => s.current);
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const y = useSharedValue(-120);

  useEffect(() => {
    if (!current) return;
    y.set(-120);
    y.set(withSequence(withSpring(0, spring.medium), withDelay(1900, withTiming(-120, { duration: 260 }))));
  }, [current, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (!current) return null;
  const color = current.tone === 'brand' ? t.c.brand : current.tone === 'live' ? t.c.live : t.c.positive;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { top: insets.top + 8 }, style]}>
      <Glass style={styles.pill} intensity={60}>
        <View style={[styles.icon, { backgroundColor: color }]}>
          <Icon name={current.icon ?? 'check'} size={14} color={current.tone === 'brand' ? t.c.onBrand : '#FFFFFF'} strokeWidth={2.8} />
        </View>
        <Text variant="label">{current.title}</Text>
      </Glass>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 8,
    paddingRight: 18,
    height: 44,
    borderRadius: radius.pill,
  },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
