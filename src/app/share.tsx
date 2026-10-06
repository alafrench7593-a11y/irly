import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useServerInbox } from '@/features/server/chat';
import { openDirect, copyLink, shareNative, shareToChat, type TargetType } from '@/features/server/engage';
import { useFriends } from '@/features/server/social';
import { hueOf } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Share anything: to a friend (opens or reuses your private chat), to any
 * chat you're in (groups, communities, activities), or out of IRLY with a
 * link. The message points at the one canonical item, never a copy.
 */
export default function ShareScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ type: TargetType; id: string; title?: string }>();
  const target = { type: params.type, id: params.id, title: params.title };
  const { conversations } = useServerInbox();
  const { friends } = useFriends();
  const [sent, setSent] = useState<Record<string, boolean>>({});

  const mark = (key: string) => {
    haptic('success');
    setSent((s) => ({ ...s, [key]: true }));
  };

  // A fast double tap must not post the share twice.
  const sending = useRef(new Set<string>());
  const once = async (key: string, send: () => Promise<void>) => {
    if (sending.current.has(key) || sent[key]) return;
    sending.current.add(key);
    try {
      await send();
      mark(key);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live');
    } finally {
      sending.current.delete(key);
    }
  };

  const toChat = (id: string) => once(id, () => shareToChat(id, target));

  const toFriend = (userId: string) =>
    once(userId, async () => {
      const conv = await openDirect(userId);
      await shareToChat(conv, target);
    });

  const accepted = friends.filter((f) => f.status === 'accepted');

  return (
    <Page overline="Share" title={params.title || 'Share'} subtitle="Send it to someone, or anywhere outside IRLY.">
      <View style={styles.body}>
        <View style={styles.quick}>
          <Quick icon="share" label="Share…" onPress={() => shareNative(target).catch(() => undefined)} />
          <Quick
            icon="link"
            label="Copy link"
            onPress={() =>
              copyLink(target)
                .then(() => toast('Link copied', 'link', 'brand'))
                .catch(() => toast('Could not copy the link', 'x', 'live'))
            }
          />
        </View>

        {accepted.length ? (
          <View style={{ gap: 10 }}>
            <Text variant="label" tone="secondary">
              Friends
            </Text>
            {accepted.map((f) => (
              <Row key={f.userId} title={f.firstName} subtitle="Private message" done={sent[f.userId]} onPress={() => toFriend(f.userId)} avatar={f.firstName} />
            ))}
          </View>
        ) : null}

        {conversations.length ? (
          <View style={{ gap: 10 }}>
            <Text variant="label" tone="secondary">
              Chats, groups and communities
            </Text>
            {conversations.map((c) => (
              <Row
                key={c.id}
                title={c.title}
                subtitle={c.kind === 'community' ? 'Community' : c.kind === 'event' ? 'Activity chat' : c.kind === 'group' ? 'Group' : 'Private'}
                done={sent[c.id]}
                onPress={() => toChat(c.id)}
                avatar={c.title}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Text variant="bodyS" tone="secondary">
              Your chats appear here once you sign in, join an activity or add friends.
            </Text>
            <PressableScale onPress={() => router.push('/account')} haptic="select" accessibilityLabel="Sign in">
              <Text variant="label">Sign in</Text>
            </PressableScale>
          </View>
        )}
      </View>
    </Page>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} haptic="select" style={[styles.quickItem, { backgroundColor: t.c.surface }]} accessibilityLabel={label}>
      <Icon name={icon} size={20} color={t.c.text} />
      <Text variant="label">{label}</Text>
    </PressableScale>
  );
}

function Row({ title, subtitle, done, onPress, avatar }: { title: string; subtitle: string; done?: boolean; onPress: () => void; avatar: string }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Avatar name={avatar} hue={hueOf(avatar)} size={40} />
      <View style={{ flex: 1 }}>
        <Text variant="titleS" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="tertiary">
          {subtitle}
        </Text>
      </View>
      <PressableScale
        onPress={onPress}
        disabled={done}
        haptic="select"
        style={[styles.send, { backgroundColor: done ? t.c.surface : t.c.brand }]}
        accessibilityLabel={done ? 'Sent' : `Send to ${title}`}
      >
        <Text variant="label" color={done ? t.c.text : t.c.onBrand}>
          {done ? 'Sent' : 'Send'}
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[6] },
  quick: { flexDirection: 'row', gap: 10 },
  quickItem: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 16, borderRadius: radius.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  send: { paddingHorizontal: 16, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  note: { padding: 16, borderRadius: radius.lg, gap: 10 },
});
