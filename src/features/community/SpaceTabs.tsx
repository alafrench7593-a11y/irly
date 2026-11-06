import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Glass } from '@/components/ui/Glass';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { duration, ease, spring } from '@/motion/tokens';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A community's five spaces (Posts | Chat | Activities | Media | Members),
 * the same on the real and the demonstration pages. A glass bar under the
 * page header; the selected tab's underline glides to it, and the bar
 * scrolls sideways when the five do not fit (small phones, long words).
 */

export type SpaceTab = 'posts' | 'chat' | 'activities' | 'media' | 'members';
export const SPACE_TABS: { key: SpaceTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'chat', label: 'Chat' },
  { key: 'activities', label: 'Activities' },
  { key: 'media', label: 'Media' },
  { key: 'members', label: 'Members' },
];
export const TABS_HEIGHT = 46;

export function SpaceTabs({ value, onChange }: { value: SpaceTab; onChange: (t: SpaceTab) => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [boxes, setBoxes] = useState<Partial<Record<SpaceTab, { x: number; w: number }>>>({});
  const [barW, setBarW] = useState(0);
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const placed = useRef(false);
  const scroller = useRef<ScrollView>(null);
  const box = boxes[value];
  useEffect(() => {
    if (!box) return;
    if (!placed.current || reduced) {
      placed.current = true;
      x.set(box.x);
      w.set(box.w);
    } else {
      x.set(withSpring(box.x, spring.snappy));
      w.set(withTiming(box.w, { duration: duration.base, easing: ease.standard }));
    }
    // The selected tab stays in sight when the bar scrolls.
    if (barW) scroller.current?.scrollTo({ x: Math.max(0, box.x - barW / 2 + box.w / 2), animated: !reduced });
  }, [box, barW, reduced, x, w]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: w.value }));
  const girl = t.flavor === 'girl';
  return (
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setBarW(e.nativeEvent.layout.width)}>
      <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
      <View style={[styles.hairline, { backgroundColor: t.c.line }]} />
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { minWidth: barW }]} accessibilityRole="tablist">
        {SPACE_TABS.map((s) => {
          const on = s.key === value;
          return (
            <PressableScale
              key={s.key}
              haptic="select"
              scaleTo={0.96}
              onPress={() => onChange(s.key)}
              onLayout={(e: LayoutChangeEvent) => {
                const { x: bx, width } = e.nativeEvent.layout;
                setBoxes((b) => (b[s.key]?.x === bx && b[s.key]?.w === width ? b : { ...b, [s.key]: { x: bx, w: width } }));
              }}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tx(s.label)}
              testID={`space-tab-${s.key}`}
            >
              <Text variant="label" tone={on ? 'primary' : 'tertiary'} color={on && girl ? t.c.brand : undefined} numberOfLines={1}>
                {s.label}
              </Text>
            </PressableScale>
          );
        })}
        <Animated.View pointerEvents="none" style={[styles.line, { backgroundColor: girl ? t.c.brand : t.c.text }, line]} />
      </ScrollView>
    </View>
  );
}

/**
 * One tab's content, kept mounted once opened (its scroll, search and
 * drafts survive a switch) and hidden while another tab shows. It fades in
 * when it comes back, so a switch never flashes.
 */
export function TabPanel({ active, children }: { active: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(active);
  if (active && !opened) setOpened(true);
  const o = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) o.set(0);
    else o.set(reduced ? 1 : withTiming(1, { duration: duration.fast, easing: ease.enter }));
  }, [active, reduced, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  if (!opened) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, fade, active ? null : styles.hidden]} pointerEvents={active ? 'auto' : 'none'} accessibilityElementsHidden={!active} importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { height: TABS_HEIGHT, overflow: 'hidden' },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: space.gutter - 8, justifyContent: 'space-between' },
  tab: { paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  line: { position: 'absolute', left: 0, bottom: 0, height: 2.5, borderRadius: 2 },
  hidden: { display: 'none' },
});
