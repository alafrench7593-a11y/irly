import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useLiveCount } from '@/features/live/liveStore';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { blur, scale, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { layout, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  discover: { label: 'Discover', icon: 'compass' },
  map: { label: 'Map', icon: 'map' },
  profile: { label: 'Profile', icon: 'user' },
};

/** Slot order in the bar. `live` is IRL, the heart of the app, in the middle. */
const SLOTS = ['index', 'discover', 'live', 'map', 'profile'] as const;

const SIDE = 20;

/** Space to leave under scrolling content so it clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 28;
}

/**
 * Floating glass navigation. Icons only, IRL in the middle: larger, raised
 * above the bar, with a live dot that breathes and the number of people
 * live around you. The active pill travels between tabs on `spring.medium`,
 * the selected icon pops to `scale.selected` and settles on
 * `spring.strong`, and every change ticks a selection haptic.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const barW = frame.width - SIDE * 2;
  const itemW = barW / SLOTS.length;
  const activeName = state.routes[state.index]?.name;
  const activeSlot = Math.max(0, SLOTS.indexOf(activeName as (typeof SLOTS)[number]));
  const x = useSharedValue(activeSlot * itemW);

  useEffect(() => {
    x.set(withSpring(activeSlot * itemW, spring.medium));
  }, [activeSlot, itemW, x]);

  // IRL has its own ring; stack screens like Messages light no tab.
  const onIrl = activeName === 'live' || !SLOTS.includes(activeName as (typeof SLOTS)[number]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const bottom = Math.max(insets.bottom, layout.tabBarBottomGap);

  return (
    <View style={[styles.wrap, { bottom, left: SIDE, width: barW }]}>
      <Glass style={[styles.bar, { boxShadow: t.shadow.float }]} intensity={blur.strong}>
        <Animated.View style={[styles.indicator, { left: (itemW - 56) / 2, opacity: onIrl ? 0 : 1 }, indicator]} />
        {SLOTS.map((slot) => {
          const route = state.routes.find((r) => r.name === slot);
          if (!route) return <View key={slot} style={{ width: itemW }} />;
          const focused = activeName === slot;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic(slot === 'live' ? 'press' : 'select');
              navigation.navigate(route.name, route.params);
            }
          };
          // IRL is drawn above the bar (below), so it can rise out of it.
          if (slot === 'live') return <View key={route.key} style={{ width: itemW }} />;
          const meta = TABS[slot];
          return (
            <TabItem
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              isProfile={slot === 'profile'}
              badge={0}
              focused={focused}
              width={itemW}
              onPress={onPress}
            />
          );
        })}
      </Glass>
      {(() => {
        const i = SLOTS.indexOf('live');
        const route = state.routes.find((r) => r.name === 'live');
        if (!route) return null;
        const focused = activeName === 'live';
        return (
          <View style={[styles.irlSlot, { left: i * itemW, width: itemW }]} pointerEvents="box-none">
            <IrlButton
              width={itemW}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic('press');
                  navigation.navigate(route.name, route.params);
                }
              }}
            />
          </View>
        );
      })()}
    </View>
  );
}

const TabItem = memo(function TabItem({
  label,
  icon,
  focused,
  width,
  onPress,
  isProfile,
  badge,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  width: number;
  onPress: () => void;
  isProfile: boolean;
  badge: number;
}) {
  const t = useTheme();
  const name = useStore((s) => s.profile.name);
  const photo = useStore((s) => s.profile.photoUri);
  const pop = useSharedValue(focused ? scale.selected : 1);
  useEffect(() => {
    pop.set(focused ? withSequence(withTiming(scale.selected + 0.06, { duration: 110 }), withSpring(scale.selected, spring.strong)) : withSpring(1, spring.medium));
  }, [focused, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = focused ? t.c.text : t.c.textTertiary;
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={0.9}
      style={[styles.item, { width }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        {isProfile ? (
          <View style={{ borderRadius: 14, borderWidth: 1.5, borderColor: focused ? t.c.text : 'transparent', padding: 1 }}>
            <Avatar name={name || 'You'} hue={0} size={22} photo={photo} />
          </View>
        ) : (
          <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2.1 : 1.75} />
        )}
        {badge ? (
          <View style={[styles.badge, { backgroundColor: t.c.live, borderColor: t.c.surface }]}>
            <Text variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
              {badge > 9 ? '9+' : badge}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </PressableScale>
  );
});

/**
 * IRL: what is happening right now. A raised dark glass disc above the bar
 * with a breathing live dot and the live count. Selected, it grows on
 * `spring.strong` and its ring turns red.
 */
function IrlButton({ width, focused, onPress }: { width: number; focused: boolean; onPress: () => void }) {
  const t = useTheme();
  const lives = useLiveCount();
  const grow = useSharedValue(focused ? 1 : 0);
  const breathe = useSharedValue(0);
  useEffect(() => {
    grow.set(withSpring(focused ? 1 : 0, spring.strong));
  }, [focused, grow]);
  useEffect(() => {
    breathe.set(withRepeat(withTiming(1, { duration: 1800 }), -1, true));
  }, [breathe]);
  const disc = useAnimatedStyle(() => ({ transform: [{ translateY: -16 }, { scale: 1 + grow.value * 0.08 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.35 + grow.value * 0.65 }));
  const dot = useAnimatedStyle(() => ({ opacity: 0.45 + breathe.value * 0.55, transform: [{ scale: 0.85 + breathe.value * 0.3 }] }));
  return (
    <View style={[styles.item, { width }]}>
      <Animated.View style={disc}>
        <PressableScale
          onPress={onPress}
          haptic={false}
          scaleTo={0.9}
          accessibilityRole="tab"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={`IRL: ${lives} live around you`}
          style={[styles.irl, { boxShadow: t.shadow.float }]}
        >
          <Glass dark style={[StyleSheet.absoluteFill, styles.irlFill]} intensity={blur.strong} border={false} />
          <View style={[StyleSheet.absoluteFill, styles.irlFill]} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.irlRing, { borderColor: t.c.live }, ring]} />
          <Animated.View style={[styles.irlDot, { backgroundColor: t.c.live }, dot]} />
          <Text variant="label" color="#FFFFFF" style={styles.irlLabel}>
            IRL
          </Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', zIndex: 60 },
  bar: {
    height: layout.tabBarHeight,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: { position: 'absolute', top: 10, width: 56, height: 48, borderRadius: radius.pill, backgroundColor: 'rgba(10,10,10,0.07)' },
  item: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  irlSlot: { position: 'absolute', top: 0, height: layout.tabBarHeight },
  irl: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  irlFill: { borderRadius: 33, overflow: 'hidden', backgroundColor: 'rgba(10,10,10,0.72)' },
  irlRing: { borderRadius: 33, borderWidth: 2 },
  irlDot: { width: 7, height: 7, borderRadius: 4, marginBottom: 2 },
  irlLabel: { letterSpacing: 1.2, fontSize: 15 },
});
