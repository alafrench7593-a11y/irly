import { useEffect, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { useFrame } from '@/components/layout/AppFrame';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import type { ActivityKind } from '@/data/types';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { ease, motion, scale as scaleTokens, spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { activityColor } from '@/theme/categories';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useCreateStore } from './createStore';

const DAYS = ['Today', 'Tomorrow', 'This weekend'];
const TIMES = ['07:00', '12:30', '18:00', '19:30', '21:00'];
const BUTTON = 52;

/**
 * "Create an activity" in three steps. The white Create button expands
 * into the whole screen (a circle growing from the button on
 * `spring.soft`), the button itself turns into the close control, and each
 * step's choices arrive in a cascade on `spring.strong`. Closing runs the
 * same circle back into the button.
 */
export function CreateHost() {
  const open = useCreateStore((s) => s.open);
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  if (!mounted) return null;
  return <Composer open={open} onClosed={() => setMounted(false)} />;
}

function Composer({ open, onClosed }: { open: boolean; onClosed: () => void }) {
  const t = useTheme();
  const frame = useFrame();
  const insets = useSafeAreaInsets();
  const hide = useCreateStore((s) => s.hide);
  const origin = useCreateStore((s) => s.origin) ?? { x: frame.width / 2, y: frame.height - layout.tabBarHeight };
  const cityId = useCityId();
  const city = CITIES[cityId];
  const postPlan = useStore((s) => s.postPlan);

  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const [day, setDay] = useState(DAYS[0]);
  const [time, setTime] = useState(TIMES[3]);
  const [area, setArea] = useState(city.areas[0].id);
  const [spots, setSpots] = useState(6);

  // Circle big enough to cover the frame from the button's centre.
  const D = 2 * Math.hypot(Math.max(origin.x, frame.width - origin.x), Math.max(origin.y, frame.height - origin.y));
  const p = useSharedValue(0);

  useEffect(() => {
    if (open) {
      p.set(withSpring(1, spring.soft));
    } else {
      p.set(
        withTiming(0, { duration: motion.slow, easing: ease.exit }, (fin) => {
          if (fin) scheduleOnRN(onClosed);
        }),
      );
    }
  }, [open, p, onClosed]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) setStep(step - 1);
      else hide();
      return true;
    });
    return () => sub.remove();
  }, [step, hide]);

  const circle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(p.value, [0, 1], [BUTTON / D, 1], Extrapolation.CLAMP) }],
  }));
  const content = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.45, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [24, 0], Extrapolation.CLAMP) }],
  }));
  const closeBtn = useAnimatedStyle(() => ({ transform: [{ rotate: `${p.value * 45}deg` }] }));

  const post = () => {
    if (!kind) return;
    postPlan({ cityId, kind, day, time, spots, areaId: area });
    haptic('success');
    toast(`${ACTIVITIES[kind].label} is live. We will tell you who joins`, 'send', 'brand');
    hide();
  };

  const kinds = city.activityKinds.slice(0, 8);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View
        style={[
          styles.circle,
          { width: D, height: D, borderRadius: D / 2, left: origin.x - D / 2, top: origin.y - D / 2, backgroundColor: t.c.surface },
          circle,
        ]}
      />
      <Animated.View style={[StyleSheet.absoluteFill, { paddingTop: insets.top + space[6] }, content]}>
        <View style={styles.head}>
          {step > 0 ? (
            <PressableScale haptic="select" scaleTo={0.9} onPress={() => setStep(step - 1)} accessibilityLabel="Previous step" style={styles.back} hitSlop={8}>
              <Icon name="chevronLeft" size={22} color={t.c.text} />
            </PressableScale>
          ) : null}
          <Text variant="overline" tone="secondary">
            Step {step + 1} / 3
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <View key="s0">
              <Animated.View entering={enter.rise(0, 120)}>
                <Text variant="displayL" style={styles.title}>
                  What do you want to do?
                </Text>
              </Animated.View>
              <View style={styles.grid}>
                {kinds.map((k, i) => (
                  <Animated.View key={k} entering={enter.pop(i, 180)} style={styles.cell}>
                    <CategoryTile kind={k} selected={kind === k} onPress={() => setKind(k)} />
                  </Animated.View>
                ))}
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View key="s1" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  When and where?
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={styles.block}>
                <Text variant="overline" tone="tertiary">
                  When
                </Text>
                <View style={styles.wrap}>
                  {DAYS.map((d) => (
                    <Chip key={d} size="sm" label={d} selected={day === d} onPress={() => setDay(d)} />
                  ))}
                </View>
                <View style={styles.wrap}>
                  {TIMES.map((x) => (
                    <Chip key={x} size="sm" label={x} selected={time === x} onPress={() => setTime(x)} />
                  ))}
                </View>
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={styles.block}>
                <Text variant="overline" tone="tertiary">
                  Where
                </Text>
                <View style={styles.wrap}>
                  {city.areas.slice(0, 8).map((a) => (
                    <Chip key={a.id} size="sm" label={a.name} icon="pin" selected={area === a.id} onPress={() => setArea(a.id)} />
                  ))}
                </View>
              </Animated.View>
            </View>
          ) : null}

          {step === 2 && kind ? (
            <View key="s2" style={{ gap: space[6] }}>
              <Animated.View entering={enter.rise(0)}>
                <Text variant="displayL" style={styles.title}>
                  How many people?
                </Text>
              </Animated.View>
              <Animated.View entering={enter.rise(1)} style={[styles.block, styles.stepperRow]}>
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.max(2, n - 1))} style={[styles.stepBtn, { backgroundColor: t.c.overlay }]} accessibilityLabel="Fewer spots">
                  <Icon name="minus" size={22} color={t.c.text} />
                </PressableScale>
                <Text variant="displayXL" style={{ minWidth: 90 }} align="center">
                  {spots}
                </Text>
                <PressableScale haptic="select" scaleTo={0.85} onPress={() => setSpots((n) => Math.min(30, n + 1))} style={[styles.stepBtn, { backgroundColor: t.c.overlay }]} accessibilityLabel="More spots">
                  <Icon name="plus" size={22} color={t.c.text} />
                </PressableScale>
              </Animated.View>
              <Animated.View entering={enter.rise(2)} style={[styles.summary, { backgroundColor: t.c.raised, borderColor: t.c.line }]}>
                <View style={[styles.dot, { backgroundColor: activityColor(kind) }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="cardTitle">{ACTIVITIES[kind].label}</Text>
                  <Text variant="bodyS" tone="secondary">
                    {day} · {time} · {areaName(city, area)} · {spots} spots
                  </Text>
                </View>
              </Animated.View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { bottom: layout.tabBarHeight + Math.max(insets.bottom, layout.tabBarBottomGap) + 24 }]}>
          {step < 2 ? (
            <Button label="Next" iconRight="arrowRight" full disabled={step === 0 && !kind} haptic="select" onPress={() => setStep(step + 1)} />
          ) : (
            <Button label="Post activity" icon="send" full haptic={false} onPress={post} />
          )}
        </View>
      </Animated.View>

      <View style={[styles.closeWrap, { left: origin.x - BUTTON / 2, top: origin.y - BUTTON / 2 }]}>
        <PressableScale haptic="tap" scaleTo={0.9} onPress={hide} accessibilityLabel="Close" style={[styles.close, { backgroundColor: t.c.overlay }]}>
          <Animated.View style={closeBtn}>
            <Icon name="plus" size={24} color={t.c.text} strokeWidth={2.4} />
          </Animated.View>
        </PressableScale>
      </View>
    </View>
  );
}

function CategoryTile({ kind, selected, onPress }: { kind: ActivityKind; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const a = ACTIVITIES[kind];
  const color = activityColor(kind);
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.set(withSpring(selected ? 1.03 : 1, spring.strong));
  }, [selected, bump]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  return (
    <Animated.View style={style}>
      <PressableScale
        haptic="select"
        scaleTo={scaleTokens.press}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={a.label}
        style={[
          styles.tile,
          { backgroundColor: selected ? t.c.brand : t.c.raised, borderColor: selected ? t.c.brand : t.c.line },
        ]}
      >
        <View style={[styles.tileIcon, { backgroundColor: selected ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)' }]}>
          <Icon name={a.icon} size={20} color={selected ? t.c.onBrand : color} />
        </View>
        <Text variant="titleS" color={selected ? t.c.onBrand : t.c.text}>
          {a.label}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: { position: 'absolute' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter, height: 44 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { paddingHorizontal: space.gutter, marginTop: space[3], marginBottom: space[6] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 5 },
  cell: { width: '50%', padding: 5 },
  tile: { height: 92, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, padding: 16, justifyContent: 'space-between' },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  block: { paddingHorizontal: space.gutter, gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepBtn: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  summary: { marginHorizontal: space.gutter, padding: 18, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, flexDirection: 'row', alignItems: 'center', gap: 14 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  footer: { position: 'absolute', left: space.gutter, right: space.gutter },
  closeWrap: { position: 'absolute', width: BUTTON, height: BUTTON },
  close: { width: BUTTON, height: BUTTON, borderRadius: BUTTON / 2, alignItems: 'center', justifyContent: 'center' },
});
