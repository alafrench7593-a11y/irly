import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { getCityContent } from '@/data/repo';
import { openHero } from '@/features/hero/heroStore';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Item = { id: string; icon: IconName; title: string; body: string; ago: string; personId?: string; onPress?: () => void; unread?: boolean };

/**
 * Notifications: few and useful. Someone joined your session, a session
 * starts near you, someone is live nearby, a reminder. No likes spam.
 */
export default function Notifications() {
  const t = useTheme();
  const router = useRouter();
  const content = getCityContent(useCityId());
  const [a, b, c] = content.people;
  const s = content.sessions[0];
  const e = content.events[0];
  const items: Item[] = [
    a && s ? { id: 'n1', icon: 'users', title: `${a.name} joined ${s.title}`, body: 'You are now 7 going', ago: '4 min', personId: a.id, unread: true, onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    b ? { id: 'n2', icon: 'zap', title: `${b.name} is live nearby`, body: 'Coffee and laptop, anyone around?', ago: '12 min', personId: b.id, unread: true, onPress: () => router.push('/live') } : null,
    s ? { id: 'n3', icon: 'pin', title: 'New session near you', body: s.title, ago: '1 h', onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    c ? { id: 'n4', icon: 'handshake', title: `${c.name} accepted your connection`, body: 'Say hi in Messages', ago: '3 h', personId: c.id, onPress: () => router.push('/messages') } : null,
    e ? { id: 'n5', icon: 'calendar', title: 'Tomorrow', body: e.title, ago: '5 h', onPress: () => openHero({ kind: 'event', id: e.id }) } : null,
  ].filter(Boolean) as Item[];

  return (
    <Page title="Notifications" subtitle="Only what helps you meet people.">
      <View style={styles.list}>
        {items.map((n, i) => {
          const p = n.personId ? content.people.find((x) => x.id === n.personId) : undefined;
          return (
            <Animated.View key={n.id} entering={enter.rise(i)}>
              <PressableScale onPress={n.onPress} scaleTo={0.98} style={[styles.row, { backgroundColor: n.unread ? t.c.surface : 'transparent', boxShadow: n.unread ? t.shadow.card : undefined }]}>
                {p ? (
                  <Avatar name={p.name} hue={p.hue} size={44} />
                ) : (
                  <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
                    <Icon name={n.icon} size={18} color={t.c.text} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                    {n.body}
                  </Text>
                </View>
                <Text variant="caption" tone="tertiary">
                  {n.ago}
                </Text>
              </PressableScale>
            </Animated.View>
          );
        })}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
