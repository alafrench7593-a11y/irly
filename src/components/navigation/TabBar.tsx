import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { memo, useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { IRL_DISC, IRL_LIFT, IrlDiscFace } from '@/features/irl/IrlDisc';
import { IrlMenu } from '@/features/irl/IrlMenu';
import { useIrlMenu } from '@/features/irl/irlMenuStore';
import { useLiveCount } from '@/features/live/liveStore';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { scale, spring } from '@/motion/tokens';
import { useStore } from '@/state/store';
import { font, layout, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  discover: { label: 'Discover', icon: 'compass' },
  map: { label: 'Map', icon: 'map' },
  profile: { label: 'Profile', icon: 'user' },
};

/**
 * Slot order in the bar. `irl` is the IRL disc (actions menu), the heart of
 * the app; `live` right next to it is the live feed, spelled out so nobody
 * has to guess where it is; `settings` opens the settings screen.
 */
const SLOTS = ['index', 'discover', 'irl', 'live', 'map', 'profile', 'settings'] as const;

const SIDE = 12;

/** Space to leave under scrolling content so it clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 28;
}

/**
 * Floating navigation in thick smoked glass. Icons only, and IRL in the
 * middle: a white disc that rises out of the bar, the one dominant control
 * of the app. Pressing it opens the IRL menu (create, post, find someone,
 * event, share what you're doing, and the live feed); a long press goes
 * straight to the live feed. The active pill travels between tabs on
 * `spring.medium`, the selected icon pops to `scale.selected` and settles
 * on `spring.strong`, every change ticks a selection haptic.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const menuOpen = useIrlMenu((s) => s.open);
  const showMenu = useIrlMenu((s) => s.show);
  const hideMenu = useIrlMenu((s) => s.hide);
  const barW = frame.width - SIDE * 2;
  const itemW = barW / SLOTS.length;
  const activeName = state.routes[state.index]?.name;
  const activeSlot = Math.max(0, SLOTS.indexOf(activeName as (typeof SLOTS)[number]));
  const x = useSharedValue(activeSlot * itemW);

  useEffect(() => {
    x.set(withSpring(activeSlot * itemW, spring.medium));
  }, [activeSlot, itemW, x]);

  // Stack screens like Messages light no tab.
  const offBar = !SLOTS.includes(activeName as (typeof SLOTS)[number]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const bottom = Math.max(insets.bottom, layout.tabBarBottomGap);
  const liveRoute = state.routes.find((r) => r.name === 'live');

  const goLive = () => {
    if (!liveRoute) return;
    const event = navigation.emit({ type: 'tabPress', target: liveRoute.key, canPreventDefault: true });
    if (activeName !== 'live' && !event.defaultPrevented) navigation.navigate(liveRoute.name, liveRoute.params);
  };

  // Centre of the disc in window coordinates (the app column is centred).
  const center = { x: window.width / 2, y: frame.height - bottom - layout.tabBarHeight / 2 - IRL_LIFT };

  return (
    <>
      <View style={[styles.wrap, { bottom, left: SIDE, width: barW }]}>
        <Glass level="thick" style={[styles.bar, { boxShadow: t.shadow.float }]}>
          <Animated.View
            style={[
              styles.indicator,
              { left: (itemW - Math.min(56, itemW - 4)) / 2, width: Math.min(56, itemW - 4), opacity: offBar ? 0 : 1, backgroundColor: t.mode === 'night' ? 'rgba(255,255,255,0.09)' : 'rgba(10,10,10,0.07)' },
              indicator,
            ]}
          />
          {SLOTS.map((slot) => {
            // IRL is drawn above the bar (below), so it can rise out of it.
            if (slot === 'irl') return <View key={slot} style={{ width: itemW }} />;
            if (slot === 'live')
              return (
                <LiveTab
                  key={slot}
                  width={itemW}
                  focused={activeName === 'live'}
                  onPress={() => {
                    haptic('select');
                    goLive();
                  }}
                />
              );
            if (slot === 'settings')
              return (
                <TabItem
                  key={slot}
                  label={tx('Settings')}
                  icon="settings"
                  isProfile={false}
                  badge={0}
                  focused={false}
                  width={itemW}
                  onPress={() => {
                    haptic('select');
                    router.push('/preferences' as never);
                  }}
                />
              );
            const route = state.routes.find((r) => r.name === slot);
            if (!route) return <View key={slot} style={{ width: itemW }} />;
            const focused = activeName === slot;
            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic('select');
                navigation.navigate(route.name, route.params);
              }
            };
            const meta = TABS[slot];
            return (
              <TabItem
                key={route.key}
                label={tx(meta.label)}
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
        {liveRoute ? (
          <View style={[styles.irlSlot, { left: SLOTS.indexOf('irl') * itemW, width: itemW }]} pointerEvents="box-none">
            <IrlButton
              width={itemW}
              focused={false}
              hidden={menuOpen}
              onPress={showMenu}
              onLongPress={() => {
                haptic('heavy');
                goLive();
              }}
            />
          </View>
        ) : null}
      </View>
      {menuOpen ? <IrlMenu center={center} frameWidth={frame.width} onLive={goLive} onClosed={hideMenu} /> : null}
    </>
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
 * IRL: the disc above the bar, the one dominant control. Around it, a
 * sonar of light goes out every few seconds (people are live around you)
 * and a red count says how many; on the live feed a red ring says « you
 * are here ». While the menu is open the menu draws the disc (turning into
 * a cross), so this one steps aside. Reduce Motion: no sonar.
 */
function IrlButton({
  width,
  focused,
  hidden,
  onPress,
  onLongPress,
}: {
  width: number;
  focused: boolean;
  hidden: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const lives = useLiveCount();
  const grow = useSharedValue(focused ? 1 : 0);
  const sonar = useSharedValue(0);
  useEffect(() => {
    grow.set(withSpring(focused ? 1 : 0, spring.strong));
  }, [focused, grow]);
  useEffect(() => {
    if (reduced || !lives) return;
    sonar.set(withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 1100 })), -1, false));
  }, [reduced, lives, sonar]);
  const disc = useAnimatedStyle(() => ({ transform: [{ translateY: -IRL_LIFT }, { scale: 1 + grow.value * 0.04 }] }));
  const ring = useAnimatedStyle(() => ({ opacity: grow.value, transform: [{ scale: 1 + (1 - grow.value) * 0.12 }] }));
  const wave = useAnimatedStyle(() => ({
    opacity: sonar.value <= 0 || sonar.value >= 1 ? 0 : 0.5 * (1 - sonar.value),
    transform: [{ scale: 1 + sonar.value * 0.62 }],
  }));
  const night = t.mode === 'night';
  return (
    <View style={[styles.item, { width }]}>
      <Animated.View style={[disc, { opacity: hidden ? 0 : 1 }]}>
        <Animated.View style={[styles.sonar, { borderColor: night ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,10,0.35)' }, wave]} pointerEvents="none" />
        <Animated.View style={[styles.irlRing, { borderColor: t.c.live }, ring]} pointerEvents="none" />
        <PressableScale
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={380}
          haptic="press"
          scaleTo={0.88}
          accessibilityRole="button"
          accessibilityState={{ selected: focused, expanded: hidden }}
          accessibilityLabel={tx('IRL: {n} live around you', { n: lives })}
          accessibilityHint={tx('Opens IRL actions. Long press for the live feed.')}
          style={[styles.irl, { boxShadow: night ? '0px 10px 30px rgba(255,255,255,0.22), 0px 4px 12px rgba(0,0,0,0.5)' : t.shadow.float }]}
        >
          <IrlDiscFace />
        </PressableScale>
        {lives ? (
          <View style={[styles.count, { backgroundColor: t.c.live, borderColor: t.c.bg }]} pointerEvents="none">
            <Text variant="caption" color="#FFFFFF" style={styles.countText}>
              {lives > 99 ? '99+' : lives}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** The live feed, named in the bar: a red dot and « LIVE », lit when you are on it. */
function LiveTab({ width, focused, onPress }: { width: number; focused: boolean; onPress: () => void }) {
  const t = useTheme();
  const lives = useLiveCount();
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={0.9}
      style={[styles.item, { width }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tx('Live feed: {n} live around you', { n: lives })}
    >
      <View style={[styles.liveDot, { backgroundColor: t.c.live }]} />
      <Text variant="caption" color={focused ? t.c.text : t.c.textSecondary} style={styles.liveText}>
        LIVE
      </Text>
    </PressableScale>
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
  indicator: { position: 'absolute', top: 10, width: 56, height: 48, borderRadius: radius.pill },
  item: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  irlSlot: { position: 'absolute', top: 0, height: layout.tabBarHeight },
  irl: { width: IRL_DISC, height: IRL_DISC, borderRadius: IRL_DISC / 2 },
  irlRing: { position: 'absolute', left: -5, top: -5, width: IRL_DISC + 10, height: IRL_DISC + 10, borderRadius: (IRL_DISC + 10) / 2, borderWidth: 2 },
  sonar: { position: 'absolute', left: 0, top: 0, width: IRL_DISC, height: IRL_DISC, borderRadius: IRL_DISC / 2, borderWidth: 1.5 },
  count: { position: 'absolute', right: -4, top: -2, minWidth: 22, height: 22, borderRadius: 11, borderWidth: 2.5, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 3 },
  liveText: { fontSize: 10, lineHeight: 12, letterSpacing: 0.8, fontFamily: font.heavy },
  countText: { fontSize: 11, lineHeight: 13, fontFamily: font.heavy },
});
