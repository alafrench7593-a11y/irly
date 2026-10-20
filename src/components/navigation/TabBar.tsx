import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFrame } from '@/components/layout/AppFrame';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { IRL_DISC, IRL_LIFT } from '@/features/irl/IrlDisc';
import { useLiveCount } from '@/features/live/liveStore';
import { FEATURES } from '@/lib/features';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { scale, spring } from '@/motion/tokens';
import { font, layout, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  discover: { label: 'Discover', icon: 'compass' },
  map: { label: 'Map', icon: 'map' },
};

/**
 * Slot order in the bar, every slot the same width. `match` is the Match
 * IRLY disc (people to meet); `live` just left of it is the live feed, spelled
 * out so nobody has to guess where it is; `network` (IRLY Network, the
 * professional side) sits right next to the Map. Your profile is at the top
 * left of every tab root, Settings at its top right.
 * Creating (activity, event, post, live, community) starts from Create on Home.
 */
const SLOTS = ['index', 'discover', 'live', 'match', 'map', 'network'] as const;
const MATCH_AT = SLOTS.indexOf('match');

/** Where each slot sits: the same width for every slot, so the icons are evenly spaced. */
function slotFrames(barW: number): { x: number; w: number }[] {
  const w = barW / SLOTS.length;
  return SLOTS.map((_, i) => ({ x: i * w, w }));
}

const SIDE = 12;

/** Space to leave under scrolling content so it clears the floating bar. */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 28;
}

/**
 * Floating navigation in thick smoked glass. Icons only, and Match IRLY in
 * the middle: a disc that rises out of the bar and opens the people to meet.
 * The active pill travels between tabs on
 * `spring.medium`, the selected icon pops to `scale.selected` and settles
 * on `spring.strong`, every change ticks a selection haptic.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const barW = frame.width - SIDE * 2;
  const frames = slotFrames(barW);
  const pillW = Math.min(56, Math.min(...frames.map((f) => f.w)) - 4);
  const activeName = state.routes[state.index]?.name;
  const activeSlot = Math.max(0, SLOTS.indexOf(activeName as (typeof SLOTS)[number]));
  const pillX = frames[activeSlot].x + (frames[activeSlot].w - pillW) / 2;
  const x = useSharedValue(pillX);
  const reduced = useReducedMotion();

  useEffect(() => {
    x.set(reduced ? pillX : withSpring(pillX, spring.medium));
  }, [pillX, x, reduced]);

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

  return (
    <>
      <View style={[styles.wrap, { bottom, left: SIDE, width: barW }]}>
        <Glass level="thick" style={[styles.bar, { boxShadow: t.shadow.float }]}>
          <Animated.View
            style={[
              styles.indicator,
              {
                left: 0,
                width: pillW,
                opacity: offBar ? 0 : 1,
                backgroundColor: t.mode === 'night' ? 'rgba(255,255,255,0.09)' : 'rgba(10,10,10,0.07)',
                // Mixte: a hairline edge on the lit pill, like the glass around it (IRLY Girl keeps her soft veil).
                borderWidth: t.flavor === 'girl' ? 0 : StyleSheet.hairlineWidth * 2,
                borderColor: t.mode === 'night' ? 'rgba(255,255,255,0.16)' : 'rgba(10,10,10,0.08)',
              },
              indicator,
            ]}
          />
          {SLOTS.map((slot, i) => {
            const itemW = frames[i].w;
            // Match IRLY is drawn above the bar (below), so it can rise out of it.
            if (slot === 'match') return <View key={slot} style={{ width: itemW }} />;
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
            if (slot === 'network')
              return (
                <TabItem
                  key={slot}
                  label={tx('Network')}
                  icon="network"
                  badge={0}
                  focused={false}
                  width={itemW}
                  onPress={() => {
                    haptic('select');
                    router.push('/network');
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
                badge={0}
                focused={focused}
                width={itemW}
                onPress={onPress}
              />
            );
          })}
        </Glass>
        <View style={[styles.irlSlot, { left: frames[MATCH_AT].x, width: frames[MATCH_AT].w }]} pointerEvents="box-none">
          <MatchButton
            width={frames[MATCH_AT].w}
            onPress={() => {
              haptic('press');
              router.push('/match' as never);
            }}
          />
        </View>
      </View>
    </>
  );
}

const TabItem = memo(function TabItem({
  label,
  icon,
  focused,
  width,
  onPress,
  badge,
}: {
  label: string;
  icon: IconName;
  focused: boolean;
  width: number;
  onPress: () => void;
  badge: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(focused ? scale.selected : 1);
  useEffect(() => {
    if (reduced) pop.set(focused ? scale.selected : 1);
    else pop.set(focused ? withSequence(withTiming(scale.selected + 0.06, { duration: 110 }), withSpring(scale.selected, spring.strong)) : withSpring(1, spring.medium));
  }, [focused, pop, reduced]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const color = focused ? t.c.text : t.c.textTertiary;
  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      scaleTo={reduced ? 1 : 0.9}
      style={[styles.item, { width }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={22} color={color} strokeWidth={focused ? 2.1 : 1.75} />
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
 * The disc above the bar, the one dominant control. While Match IRLY is
 * switched off (src/lib/features.ts) it reads « Soon » under its icon and
 * opens /match, the coming-soon page of IRLY Match; switched on, it reads
 * « Match » over « IRLY » and opens the people to meet. Same disc in IRLY
 * and IRLY Girl (each in its own ink), sinks under the finger.
 */
function MatchButton({ width, onPress }: { width: number; onPress: () => void }) {
  const t = useTheme();
  const night = t.mode === 'night';
  const open = FEATURES.matchIrly;
  const reduced = useReducedMotion();
  return (
    <View style={[styles.item, { width }]}>
      <View style={{ transform: [{ translateY: -IRL_LIFT }] }}>
        <PressableScale
          onPress={onPress}
          haptic={false}
          scaleTo={reduced ? 1 : 0.9}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Match IRLY' : tx('Soon: IRLY Match, coming soon')}
          accessibilityHint={open ? tx('Opens people to meet, matched on what you share') : tx('Shows what Match IRLY will be')}
          style={[styles.irl, styles.match, { backgroundColor: t.c.brand, boxShadow: night ? '0px 10px 30px rgba(255,255,255,0.22), 0px 4px 12px rgba(0,0,0,0.5)' : t.shadow.float }]}
        >
          <Icon name="heartHandshake" size={18} color={t.c.onBrand} strokeWidth={2.2} />
          {open ? (
            <>
              <Text variant="caption" color={t.c.onBrand} style={styles.matchWord} numberOfLines={1} raw>
                MATCH
              </Text>
              <Text variant="caption" color={t.c.onBrand} style={styles.matchIrly} numberOfLines={1} raw>
                IRLY
              </Text>
            </>
          ) : (
            <Text variant="caption" color={t.c.onBrand} style={styles.soonWord} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Soon
            </Text>
          )}
        </PressableScale>
      </View>
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
  match: { alignItems: 'center', justifyContent: 'center' },
  matchWord: { fontSize: 10, lineHeight: 12, letterSpacing: 0.6, fontFamily: font.heavy, marginTop: 1 },
  matchIrly: { fontSize: 8, lineHeight: 10, letterSpacing: 1.2, fontFamily: font.heavy, opacity: 0.75 },
  soonWord: { fontSize: 11, lineHeight: 13, letterSpacing: 0.8, fontFamily: font.heavy, textTransform: 'uppercase', marginTop: 2, maxWidth: IRL_DISC - 12 },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 3 },
  liveText: { fontSize: 10, lineHeight: 12, letterSpacing: 0.8, fontFamily: font.heavy },
});
