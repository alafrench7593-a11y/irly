import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { layout, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  discover: { label: 'Discover', icon: 'compass' },
  social: { label: 'Social', icon: 'users' },
  map: { label: 'Map', icon: 'map' },
  profile: { label: 'You', icon: 'user' },
};

const SIDE = 14;

/** Space to leave under scrolling content so it clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 28;
}

/**
 * Floating glass navigation. A pill slides between tabs on a spring, the
 * selected icon pops, and every change ticks the haptic engine.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const barW = frame.width - SIDE * 2;
  const itemW = barW / state.routes.length;
  const x = useSharedValue(state.index * itemW);

  useEffect(() => {
    x.set(withSpring(state.index * itemW, spring.snappy));
  }, [state.index, itemW, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, layout.tabBarBottomGap), left: SIDE, width: barW }]}>
      <Glass style={[styles.bar, { boxShadow: t.shadow.float }]} intensity={70}>
        <Animated.View style={[styles.indicator, { width: itemW - 10, backgroundColor: t.c.brandSoft }, indicator]} />
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const meta = TABS[route.name] ?? { label: route.name, icon: 'home' as IconName };
          return (
            <TabItem
              key={route.key}
              label={meta.label}
              icon={meta.icon}
              isProfile={route.name === 'profile'}
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
  const pop = useSharedValue(1);
  useEffect(() => {
    if (focused) pop.set(withSequence(withTiming(1.16, { duration: 110 }), withSpring(1, spring.bouncy)));
  }, [focused, pop]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = focused ? t.c.brand : t.c.textTertiary;
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
          <View style={{ borderRadius: 14, borderWidth: 2, borderColor: focused ? t.c.brand : 'transparent' }}>
            <Avatar name={name || 'You'} hue={262} size={22} />
          </View>
        ) : (
          <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2.3 : 1.9} />
        )}
      </Animated.View>
      <Text variant="caption" color={color} style={{ fontSize: 10.5, lineHeight: 13 }}>
        {label}
      </Text>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  bar: {
    height: layout.tabBarHeight,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: { position: 'absolute', left: 5, top: 6, bottom: 6, borderRadius: radius.lg },
  item: { height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
});
