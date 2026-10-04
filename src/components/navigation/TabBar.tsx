import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { openCreate, useCreateStore } from '@/features/create/createStore';
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

/** Slot order in the bar. `create` is not a screen: it opens the composer. */
const SLOTS = ['index', 'discover', 'create', 'map', 'profile'] as const;

const SIDE = 20;

/** Space to leave under scrolling content so it clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 28;
}

/**
 * Floating glass navigation. Icons only, Create in the middle. The active
 * pill travels between tabs on `spring.medium`, the selected icon pops to
 * `scale.selected` and settles on `spring.strong`, and every change ticks a
 * selection haptic. Create rotates into a close button while the composer
 * is open, so the same control closes what it opened.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
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

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const bottom = Math.max(insets.bottom, layout.tabBarBottomGap);

  return (
    <View style={[styles.wrap, { bottom, left: SIDE, width: barW }]}>
      <Glass style={styles.bar} intensity={blur.strong}>
        <Animated.View style={[styles.indicator, { left: (itemW - 56) / 2 }, indicator]} />
        {SLOTS.map((slot, i) => {
          if (slot === 'create') {
            return <CreateButton key="create" width={itemW} barLeft={SIDE} index={i} bottom={bottom} frameH={frame.height} />;
          }
          const route = state.routes.find((r) => r.name === slot);
          if (!route) return <View key={slot} style={{ width: itemW }} />;
          const focused = activeName === slot;
          const meta = TABS[slot];
          return (
            <TabItem
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              isProfile={slot === 'profile'}
              focused={focused}
              width={itemW}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  haptic('select');
                  navigation.navigate(route.name, route.params);
                }
              }}
            />
          );
        })}
      </Glass>
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
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  width: number;
  onPress: () => void;
  isProfile: boolean;
}) {
  const t = useTheme();
  const name = useStore((s) => s.profile.name);
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
            <Avatar name={name || 'You'} hue={0} size={22} />
          </View>
        ) : (
          <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2.1 : 1.75} />
        )}
      </Animated.View>
    </PressableScale>
  );
});

function CreateButton({ width, barLeft, index, bottom, frameH }: { width: number; barLeft: number; index: number; bottom: number; frameH: number }) {
  const t = useTheme();
  const open = useCreateStore((s) => s.open);
  const rot = useSharedValue(0);
  const ref = useRef<View>(null);
  useEffect(() => {
    rot.set(withSpring(open ? 45 : 0, spring.strong));
  }, [open, rot]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  return (
    <View style={[styles.item, { width }]}>
      <PressableScale
        ref={ref}
        haptic="press"
        scaleTo={0.9}
        accessibilityLabel={open ? 'Close' : 'Create an activity'}
        onPress={() => {
          if (useCreateStore.getState().open) {
            useCreateStore.getState().hide();
            return;
          }
          // Centre of the button in frame coordinates: the composer grows from here.
          openCreate({ x: barLeft + width * index + width / 2, y: frameH - bottom - layout.tabBarHeight / 2 });
        }}
        style={[styles.create, { backgroundColor: t.c.brand }]}
      >
        <Animated.View style={style}>
          <Icon name="plus" size={24} color={t.c.onBrand} strokeWidth={2.4} />
        </Animated.View>
      </PressableScale>
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
  indicator: { position: 'absolute', top: 10, width: 56, height: 48, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
  item: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  create: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
