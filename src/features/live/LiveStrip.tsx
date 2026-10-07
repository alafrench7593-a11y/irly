import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findPerson } from '@/data/repo';
import { PressableScale } from '@/motion/PressableScale';
import { space, status } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useStore } from '@/state/store';
import { useLives } from './liveStore';

/**
 * "Live now" on the Home: who is out doing something right now. Each face
 * has a red ring that breathes (the only permanent loop in the app, kept
 * for live things). Tapping anything opens IRL.
 */
export function LiveStrip() {
  const t = useTheme();
  const router = useRouter();
  const lives = useLives();
  const me = useStore((s) => s.profile.name) || 'You';
  const connections = useStore((s) => s.connections);
  const friendsLive = lives.some((l) => connections[l.authorId] === 'connected');
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text variant="titleM">{friendsLive ? 'Friends live now' : 'Live now'}</Text>
        <Text variant="label" tone="secondary" onPress={() => router.push('/live')}>
          IRL
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <PressableScale haptic="select" scaleTo={0.94} onPress={() => router.push('/live')} style={styles.item} accessibilityLabel="Go live">
          <View style={[styles.add, { backgroundColor: t.c.surface, borderColor: t.c.lineStrong }]}>
            <Icon name="plus" size={22} color={t.c.text} />
          </View>
          <Text variant="caption" tone="secondary">
            You
          </Text>
        </PressableScale>
        {lives.map((l) => {
          const p = l.authorId === 'me' ? undefined : findPerson(l.authorId);
          const name = p?.name ?? me;
          return (
            <PressableScale key={l.id} haptic="select" scaleTo={0.94} onPress={() => router.push('/live')} style={styles.item} accessibilityLabel={`${name} is live: ${l.text}`}>
              <LiveRing>
                <Avatar name={name} hue={p?.hue ?? 0} size={56} photo={p?.photo} />
              </LiveRing>
              <Text variant="caption" numberOfLines={1} style={{ maxWidth: 72 }}>
                {name.split(' ')[0]}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function LiveRing({ children, size = 64 }: { children: React.ReactNode; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) }), -1, false));
  }, [p]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.18 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, borderWidth: 2, borderColor: status.live }, halo]} />
      <View style={{ borderRadius: size / 2, borderWidth: 2, borderColor: status.live, padding: 2 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: space.gutter },
  row: { paddingHorizontal: space.gutter, gap: 14 },
  item: { alignItems: 'center', gap: 6 },
  add: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
