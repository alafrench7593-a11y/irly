import { t as tx } from '@/i18n';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findPerson } from '@/data/repo';
import { PressableScale } from '@/motion/PressableScale';
import { space, status } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { enter } from '@/motion/enter';
import { useServerIrl } from '@/features/server/social';
import { useCityId, useStore } from '@/state/store';
import { useLives } from './liveStore';

/** One face of "Live now": a member's Live on the server, or one of this phone (demo, not yet sent). */
type LiveFace = { key: string; name: string; text: string; hue: number; photo?: string; userId?: string; friend: boolean };

/**
 * Everyone live right now, as IRL shows them: the members' Lives from the
 * server (the same feed as the IRL tab, Realtime included, so a Live you
 * post shows here at once), then the ones only this phone has. Newest first.
 */
export function useLiveFaces(): LiveFace[] {
  const cityId = useCityId();
  const lives = useLives();
  const { posts } = useServerIrl(cityId);
  const me = useStore((s) => s.profile.name) || tx('You');
  const connections = useStore((s) => s.connections);
  return useMemo(() => {
    const server: LiveFace[] = [...posts]
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => ({ key: p.id, name: p.mine ? me : p.firstName, text: p.body, hue: (p.authorId.charCodeAt(0) * 37) % 360, userId: p.authorId, friend: p.friend }));
    const local: LiveFace[] = lives.map((l) => {
      const p = l.authorId === 'me' ? undefined : findPerson(l.authorId);
      return { key: l.id, name: p?.name ?? me, text: l.text, hue: p?.hue ?? 0, photo: p?.photo, friend: connections[l.authorId] === 'connected' };
    });
    return [...server, ...local];
  }, [posts, lives, me, connections]);
}

/**
 * "Live now" on the Home: who is out doing something right now. Each face
 * has a red ring that breathes (the only permanent loop in the app, kept
 * for live things). Tapping anything opens IRL.
 */
export function LiveStrip() {
  const t = useTheme();
  const router = useRouter();
  const faces = useLiveFaces();
  const friendsLive = faces.some((f) => f.friend);
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.head}>
        <Text variant="titleM">{friendsLive ? 'Friends live now' : 'Live now'}</Text>
        <PressableScale haptic="select" scaleTo={0.94} hitSlop={12} onPress={() => router.push('/live')} accessibilityRole="link" accessibilityLabel="Open IRL">
          <Text variant="label" tone="secondary">
            IRL
          </Text>
        </PressableScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <PressableScale haptic="select" scaleTo={0.94} onPress={() => router.push('/live')} style={styles.item} accessibilityLabel="Go live">
          <View style={[styles.add, { backgroundColor: 'transparent', borderColor: t.c.lineStrong, overflow: 'hidden' }]}>
            <GlassLayer radius={32} level="thin" />
            <Icon name="plus" size={22} color={t.c.text} />
          </View>
          <Text variant="caption" tone="secondary">
            You
          </Text>
        </PressableScale>
        {faces.map((f, i) => (
          <Animated.View key={f.key} entering={enter.pop(Math.min(i, 8))}>
            <PressableScale haptic="select" scaleTo={0.94} onPress={() => router.push('/live')} style={styles.item} accessibilityLabel={tx('{name} is live: {text}', { name: f.name, text: f.text })}>
              <LiveRing>
                <Avatar name={f.name} hue={f.hue} size={56} photo={f.photo} userId={f.userId} />
              </LiveRing>
              <Text variant="caption" numberOfLines={1} raw style={{ maxWidth: 72 }}>
                {f.name.split(' ')[0]}
              </Text>
            </PressableScale>
          </Animated.View>
        ))}
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
