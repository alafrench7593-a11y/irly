import { useRouter } from 'expo-router';
import { useAuthStatus } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { addFriend, useFriends, useServerNotifications, type ServerNotification } from '@/features/server/social';
import { timeAgo } from '@/lib/time';
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
  // Examples of what IRLY sends, only before sign-in (never mixed with real ones).
  const auth = useAuthStatus();
  const items: Item[] = auth !== 'out' ? [] : [
    a && s ? { id: 'n1', icon: 'users', title: tx('{name} joined {what}', { name: a.name, what: tx(s.title) }), body: tx('You are now 7 going'), ago: '4 min', personId: a.id, unread: true, onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    b ? { id: 'n2', icon: 'zap', title: tx('{name} is live nearby', { name: b.name }), body: tx('Coffee and laptop, anyone around?'), ago: '12 min', personId: b.id, unread: true, onPress: () => router.push('/live') } : null,
    s ? { id: 'n3', icon: 'pin', title: tx('New session near you'), body: tx(s.title), ago: '1 h', onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    c ? { id: 'n4', icon: 'handshake', title: tx('{name} accepted your connection', { name: c.name }), body: tx('Say hi in Messages'), ago: '3 h', personId: c.id, onPress: () => router.push('/messages') } : null,
    e ? { id: 'n5', icon: 'calendar', title: tx('Tomorrow'), body: tx(e.title), ago: '5 h', onPress: () => openHero({ kind: 'event', id: e.id }) } : null,
  ].filter(Boolean) as Item[];

  return (
    <Page title="Notifications" subtitle="Only what helps you meet people.">
      <ServerNotifications />
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

const ago = (ms: number) => timeAgo(Math.max(1, (Date.now() - ms) / 60000));

/** Signed in: real notifications from the server, live, marked read on open. */
function ServerNotifications() {
  const t = useTheme();
  const router = useRouter();
  const { items, markAllRead } = useServerNotifications();
  const { friends, refresh } = useFriends();
  const unread = items.some((n) => !n.readAt);
  useEffect(() => {
    if (unread) {
      const h = setTimeout(markAllRead, 1500);
      return () => clearTimeout(h);
    }
  }, [unread, markAllRead]);
  if (!items.length) return null;
  const name = (id?: string) => friends.find((f) => f.userId === id)?.firstName ?? 'Someone';
  const describe = (n: ServerNotification): { icon: IconName; title: string; body: string; go?: () => void; accept?: string } => {
    const p = n.payload;
    switch (n.kind) {
      case 'MATCH_CREATED':
        return { icon: 'sparkles', title: "It's an IRLY match", body: 'Say hello and find something to do', go: () => router.push(`/messages/${p.conversation_id}`) };
      case 'MATCH_REMOVED':
        return { icon: 'x', title: 'A match ended', body: 'The private chat is closed' };
      case 'MESSAGE_CREATED':
        return { icon: 'message', title: 'New message', body: 'Tap to open the conversation', go: () => router.push(`/messages/${p.conversation_id}`) };
      case 'ACTIVITY_JOINED':
        return { icon: 'users', title: 'Someone joined your activity', body: 'Their name is in the activity chat', go: () => router.push(p.activity_id ? `/a/${p.activity_id}` : '/messages') };
      case 'ACTIVITY_UPDATED':
        return {
          icon: p.cancelled ? 'x' : 'clock',
          title: p.cancelled ? tx('{title} was cancelled', { title: p.title ?? '' }) : tx('{title} changed', { title: p.title ?? '' }),
          body: p.cancelled ? 'It is off your calendar' : 'New time or place: check the details',
          go: () => router.push(`/a/${p.activity_id}`),
        };
      case 'LIKE':
      case 'COMMENT':
      case 'COMMENT_REPLY':
      case 'MENTION': {
        const open = () =>
          p.target_type === 'activity'
            ? router.push(`/a/${p.target_id}`)
            : router.push(`/comments?type=${p.target_type}&id=${encodeURIComponent(p.target_id ?? '')}`);
        const who = name(p.from);
        const title =
          n.kind === 'LIKE'
            ? tx('{name} liked your post', { name: who })
            : n.kind === 'COMMENT'
              ? tx('{name} commented', { name: who })
              : n.kind === 'COMMENT_REPLY'
                ? tx('{name} replied to you', { name: who })
                : tx('{name} mentioned you', { name: who });
        return { icon: n.kind === 'LIKE' ? 'heart' : 'message', title, body: p.body ?? '', go: open };
      }
      case 'FRIEND_REQUEST': {
        const pending = friends.find((f) => f.userId === p.from && f.incoming);
        return { icon: 'user', title: tx('{name} wants to be friends', { name: name(p.from) }), body: 'Friends see each other’s IRL posts', accept: pending ? p.from : undefined };
      }
      case 'FRIEND_ACCEPTED':
        return { icon: 'check', title: tx('{name} accepted', { name: name(p.from) }), body: 'You are now friends' };
      case 'COMMUNITY_JOINED':
        return { icon: 'heartHandshake', title: 'You joined a community', body: 'Its chat is in Messages', go: () => router.push(p.conversation_id ? `/messages/${p.conversation_id}` : '/messages') };
      case 'IRLY_POST_CREATED':
        return { icon: 'zap', title: tx('{name} is live', { name: name(p.from) }), body: p.body ?? 'See what they are doing', go: () => router.push('/live') };
      case 'PROFILE_UPDATED':
        if (p.type === 'friend_request') {
          const pending = friends.find((f) => f.userId === p.from && f.incoming);
          return { icon: 'user', title: tx('{name} wants to be friends', { name: name(p.from) }), body: 'Friends see each other’s IRL posts', accept: pending ? p.from : undefined };
        }
        if (p.type === 'friend_accepted') return { icon: 'check', title: tx('{name} accepted', { name: name(p.from) }), body: 'You are now friends' };
        return { icon: 'user', title: 'Profile update', body: '' };
      default:
        return { icon: 'bell', title: 'IRLY', body: '' };
    }
  };
  return (
    <View style={[styles.list, { marginBottom: space[6] }]}>
      {items.map((n, i) => {
        const d = describe(n);
        return (
          <Animated.View key={n.id} entering={enter.rise(i)}>
            <PressableScale onPress={d.go} scaleTo={0.98} style={[styles.row, { backgroundColor: n.readAt ? 'transparent' : t.c.surface, boxShadow: n.readAt ? undefined : t.shadow.card }]}>
              <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
                <Icon name={d.icon} size={18} color={t.c.text} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label" numberOfLines={2}>
                  {d.title}
                </Text>
                {d.body ? (
                  <Text variant="bodyS" tone="secondary" numberOfLines={1} raw>
                    {d.body}
                  </Text>
                ) : null}
              </View>
              {d.accept ? (
                <Button
                  label="Accept"
                  size="sm"
                  onPress={() =>
                    addFriend(d.accept!)
                      .then(() => {
                        toast('You are now friends', 'check', 'positive');
                        refresh();
                      })
                      .catch((e) => toast(e instanceof Error ? e.message : 'Could not accept', 'x', 'live'))
                  }
                />
              ) : (
                <Text variant="caption" tone="tertiary">
                  {ago(n.createdAt)}
                </Text>
              )}
            </PressableScale>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
