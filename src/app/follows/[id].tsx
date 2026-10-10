import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { setFollow, useFollowList } from '@/features/profile/member';
import { useSignedLinks } from '@/features/server/media';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** A member's followers or the people they follow: real relations from the server, each a link to their profile. */
export default function FollowsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, which: w } = useLocalSearchParams<{ id: string; which?: string }>();
  const [which, setWhich] = useState<'followers' | 'following' | 'friends'>(w === 'following' || w === 'friends' ? w : 'followers');
  const list = useFollowList(id, which);
  const faces = useSignedLinks('profile-photos', list.people.map((p) => p.photo));
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (personId: string, on: boolean) => {
    if (busy) return;
    setBusy(personId);
    try {
      await setFollow(personId, on);
      list.reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title={which === 'followers' ? 'Followers' : which === 'friends' ? 'Friends' : 'Following'}>
      <View style={[styles.switch, { backgroundColor: t.c.surface }]}>
        {(['followers', 'following', 'friends'] as const).map((x) => (
          <PressableScale key={x} haptic="select" onPress={() => setWhich(x)} accessibilityRole="tab" accessibilityState={{ selected: which === x }} style={[styles.seg, which === x ? { backgroundColor: t.c.text } : null]}>
            <Text variant="label" color={which === x ? t.c.bg : t.c.text}>
              {x === 'followers' ? 'Followers' : x === 'friends' ? 'Friends' : 'Following'}
            </Text>
          </PressableScale>
        ))}
      </View>
      <View style={{ paddingHorizontal: space.gutter, gap: 4 }}>
        {list.loading ? (
          <ActivityIndicator color={t.c.text} style={{ marginTop: space[6] }} />
        ) : list.error ? (
          <Text variant="body" tone="secondary" align="center">
            {list.error}
          </Text>
        ) : !list.people.length ? (
          <Animated.View entering={FadeIn} style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="users" size={20} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" align="center">
              {which === 'followers' ? 'No followers yet.' : which === 'friends' ? 'No friends yet.' : 'Not following anyone yet.'}
            </Text>
          </Animated.View>
        ) : (
          list.people.map((p, i) => (
            <Animated.View key={p.id} entering={enter.rise(Math.min(i, 8), 20)} style={styles.row}>
              <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/person/${p.id}`)} style={styles.who} accessibilityLabel={tx('Open {name}’s profile', { name: p.firstName })}>
                <Avatar name={p.firstName} hue={hueOf(p.id)} size={48} photo={p.photo ? faces[p.photo] : undefined} />
                <Text variant="titleS" style={{ flex: 1 }} raw>
                  {p.id === list.me ? tx('You') : p.firstName}
                </Text>
              </PressableScale>
              {p.id !== list.me ? (
                <Button label={p.iFollow ? 'Following' : 'Follow'} size="sm" variant={p.iFollow ? 'secondary' : 'primary'} loading={busy === p.id} onPress={() => toggle(p.id, !p.iFollow)} />
              ) : null}
            </Animated.View>
          ))
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', marginHorizontal: space.gutter, marginBottom: space[5], padding: 4, borderRadius: 22 },
  seg: { flex: 1, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: radius.xl },
});
