import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Glass } from '@/components/ui/Glass';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { blur, motion, spring, staggerStep } from '@/motion/tokens';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { openCreate, type CreatePreset } from './createStore';

type Option = { id: string; label: string; hint: string; icon: IconName; color: string; preset?: CreatePreset; route?: string; soon?: string };

const OPTIONS: Option[] = [
  { id: 'sport', label: 'Sport', hint: 'Padel, football, run…', icon: 'trophy', color: '#34C759', preset: { categoryId: 'sport', format: 'sport' } },
  { id: 'activity', label: 'Activity', hint: 'Anything, with anyone', icon: 'sparkles', color: '#FF2D55', preset: { format: 'activity' } },
  { id: 'event', label: 'Event', hint: 'RSVP, capacity, price', icon: 'ticket', color: '#FF3B30', preset: { format: 'event' } },
  { id: 'session', label: 'Session', hint: 'A time, a place, spots', icon: 'calendar', color: '#5856D6', preset: { format: 'session' } },
  { id: 'trip', label: 'Trip', hint: 'Abu Dhabi, Hatta, Oman…', icon: 'plane', color: '#007AFF', preset: { categoryId: 'travel', format: 'trip' } },
  { id: 'meetup', label: 'Meetup', hint: 'Coffee, networking', icon: 'handshake', color: '#A2845E', preset: { format: 'meetup' } },
  { id: 'live', label: 'Live', hint: 'What you do right now', icon: 'zap', color: '#FF3B30', route: '/live?compose=1' },
  { id: 'post', label: 'Post', hint: 'Photo or text, IRL', icon: 'camera', color: '#0A0A0A', route: '/live?compose=1' },
  { id: 'community', label: 'Community', hint: 'A permanent group', icon: 'users', color: '#30B0C7', soon: 'Creating communities arrives with accounts' },
];

/**
 * CREATE on the Home. The pill sinks under the press, a glass layer blurs
 * the page, and the formats spring out of the button one after another
 * (`staggerStep`), each on `spring.medium`. Choosing one grows the composer
 * from that tile; tapping outside folds everything back into the pill.
 */
export function CreateMenu() {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const anchor = useRef<View>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const p = useSharedValue(0);

  const show = () => {
    anchor.current?.measureInWindow((x, y, w, h) => setOrigin({ x: x + w / 2, y: y + h / 2 }));
    haptic('press');
    setOpen(true);
  };

  return (
    <>
      <View ref={anchor} collapsable={false} style={styles.anchorWrap}>
        <PressableScale haptic={false} scaleTo={0.97} onPress={show} accessibilityLabel="Create something" style={[styles.pill, { backgroundColor: t.c.brand, boxShadow: t.shadow.float }]}>
          <View style={[styles.plus, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            <Icon name="plus" size={22} color={t.c.onBrand} strokeWidth={2.4} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="titleM" color={t.c.onBrand}>
              Create
            </Text>
            <Text variant="bodyS" color={t.c.onBrand} style={{ opacity: 0.7 }} numberOfLines={1}>
              Sport, event, trip, live… people join, a chat opens.
            </Text>
          </View>
          <Icon name="arrowUpRight" size={20} color={t.c.onBrand} />
        </PressableScale>
      </View>
      {open ? <Menu origin={origin} p={p} onClosed={() => setOpen(false)} /> : null}
    </>
  );
}

function Menu({ origin, p, onClosed }: { origin: { x: number; y: number }; p: SharedValue<number>; onClosed: () => void }) {
  const t = useTheme();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    p.set(reduced ? withTiming(1, { duration: motion.fast }) : withSpring(1, spring.medium));
  }, [p, reduced]);

  const close = (after?: () => void) => {
    if (closing) return;
    setClosing(true);
    p.set(
      withTiming(0, { duration: motion.normal }, (fin) => {
        if (!fin) return;
        scheduleOnRN(onClosed);
        if (after) scheduleOnRN(after);
      }),
    );
  };

  const choose = (o: Option) => {
    haptic('select');
    if (o.soon) {
      close(() => toast(o.soon!, 'users', 'brand'));
    } else if (o.route) {
      const route = o.route;
      close(() => router.push(route as never));
    } else {
      // The composer grows from the bottom centre, where its close button lives.
      close(() => openCreate(null, o.preset));
    }
  };

  const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
  const title = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0.3, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(p.value, [0, 1], [12, 0], Extrapolation.CLAMP) }],
  }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={() => close()}>
      <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={blur.strong} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'web' ? 'rgba(246,246,244,0.55)' : 'rgba(246,246,244,0.3)' }]} />
      </Animated.View>
      <PressableScale haptic={false} scaleTo={1} onPress={() => close()} style={StyleSheet.absoluteFill} accessibilityLabel="Close" />
      <View style={styles.sheet} pointerEvents="box-none">
        <Animated.View style={[styles.head, title]}>
          <Text variant="overline" tone="secondary">
            Create
          </Text>
          <Text variant="displayM">What are you starting?</Text>
        </Animated.View>
        <View style={styles.grid} pointerEvents="box-none">
          {OPTIONS.map((o, i) => (
            <Tile key={o.id} option={o} index={i} p={p} origin={origin} onPress={() => choose(o)} />
          ))}
        </View>
        <Animated.View style={[styles.closeRow, title]}>
          <PressableScale haptic="tap" scaleTo={0.9} onPress={() => close()} accessibilityLabel="Close" style={[styles.close, { backgroundColor: t.c.brand }]}>
            <Icon name="x" size={22} color={t.c.onBrand} strokeWidth={2.4} />
          </PressableScale>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Tile({ option, index, p, onPress }: { option: Option; index: number; p: SharedValue<number>; origin: { x: number; y: number }; onPress: () => void }) {
  const t = useTheme();
  // Each tile has its own progress, started `staggerStep` after the previous one.
  const own = useSharedValue(0);
  useEffect(() => {
    own.set(withDelay(index * (staggerStep * 0.6), withSpring(1, spring.medium)));
  }, [own, index]);
  const style = useAnimatedStyle(() => {
    const v = Math.min(own.value, p.value);
    return {
      opacity: interpolate(v, [0, 0.6], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(v, [0, 1], [40, 0]) }, { scale: interpolate(v, [0, 1], [0.6, 1]) }],
    };
  });
  return (
    <Animated.View style={[styles.cell, style]}>
      <PressableScale haptic={false} scaleTo={0.94} onPress={onPress} accessibilityLabel={`${option.label}. ${option.hint}`} style={[styles.tile, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
        <View style={[styles.tileIcon, { backgroundColor: `${option.color}1F` }]}>
          <Icon name={option.icon} size={20} color={option.color} />
        </View>
        <Text variant="titleS" numberOfLines={1} adjustsFontSizeToFit>
          {option.label}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {option.hint}
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchorWrap: { paddingHorizontal: space.gutter },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.xxl },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheet: { flex: 1, justifyContent: 'flex-end', paddingBottom: 48, gap: space[5] },
  head: { paddingHorizontal: space.gutter, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.gutter - 5 },
  cell: { width: '33.333%', padding: 5 },
  tile: { minHeight: 112, borderRadius: radius.xl, padding: 12, gap: 6 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  closeRow: { alignItems: 'center' },
  close: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
