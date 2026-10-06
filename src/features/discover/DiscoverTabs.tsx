import { t as tx } from '@/i18n';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type DiscoverTab = { id: string; label: string };

type Props = {
  tabs: readonly DiscoverTab[];
  /** Horizontal offset of the pager: the pill follows the finger. */
  x: SharedValue<number>;
  pageWidth: number;
  active: number;
  onPress: (index: number) => void;
};

/**
 * PEOPLE | ACTIVITIES | PLACES | EVENTS. A white pill slides along a glass
 * track, glued to the pager (it moves with the finger while you swipe
 * between pages, not after); the label under the pill turns black as the
 * pill arrives. Transforms and opacity only.
 */
export const DiscoverTabs = memo(function DiscoverTabs({ tabs, x, pageWidth, active, onPress }: Props) {
  const t = useTheme();
  const night = t.mode === 'night';
  const [w, setW] = useState(0);
  const seg = w ? (w - 8) / tabs.length : 0;
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: pageWidth ? (x.value / pageWidth) * seg : 0 }] }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        styles.track,
        night
          ? { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }
          : { backgroundColor: 'rgba(10,10,10,0.04)', borderColor: t.c.line },
      ]}
      accessibilityRole="tablist"
    >
      {seg ? <Animated.View style={[styles.pill, { width: seg, backgroundColor: t.c.brand, boxShadow: t.shadow.glow }, pill]} /> : null}
      {tabs.map((tab, i) => (
        <TabLabel key={tab.id} label={tab.label} index={i} x={x} pageWidth={pageWidth} selected={active === i} onPress={() => onPress(i)} />
      ))}
    </View>
  );
});

function TabLabel({
  label,
  index,
  x,
  pageWidth,
  selected,
  onPress,
}: {
  label: string;
  index: number;
  x: SharedValue<number>;
  pageWidth: number;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const on = useAnimatedStyle(() => {
    const d = pageWidth ? Math.min(1, Math.abs(x.value / pageWidth - index)) : index === 0 ? 0 : 1;
    return { opacity: 1 - d };
  });
  const off = useAnimatedStyle(() => {
    const d = pageWidth ? Math.min(1, Math.abs(x.value / pageWidth - index)) : index === 0 ? 0 : 1;
    return { opacity: d };
  });
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.94}
      onPress={onPress}
      style={styles.item}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={tx(label)}
    >
      <Animated.View style={off}>
        <Text variant="label" tone="secondary" style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, on]} pointerEvents="none">
        <Text variant="label" color={t.c.onBrand} style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  pill: { position: 'absolute', top: 4, left: 4, bottom: 4, borderRadius: radius.pill },
  item: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11.5, letterSpacing: 0.9, textTransform: 'uppercase' },
});
