import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { findPerson } from '@/data/repo';
import type { Conversation } from '@/data/types';
import { allMessages, cityConversations, minutesAgo, senderName } from '@/features/messages/conversations';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KIND_ICON: Record<Conversation['kind'], IconName> = {
  direct: 'user',
  group: 'users',
  event: 'ticket',
  community: 'heartHandshake',
  service: 'shield',
};

export default function Messages() {
  const cityId = useCityId();
  const city = CITIES[cityId];
  const connections = useStore((s) => s.connections);
  const conversations = cityConversations(cityId, connections);
  return (
    <Page overline={city.name} title="Messages" subtitle="Every plan you join opens a group chat. Every connection, a conversation.">
      <View style={{ paddingHorizontal: space.gutter, gap: 8 }}>
        {conversations.map((c, i) => (
          <Animated.View key={c.id} entering={enter.rise(i, 40)}>
            <ConversationRow conversation={c} />
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

function ConversationRow({ conversation: c }: { conversation: Conversation }) {
  const t = useTheme();
  const router = useRouter();
  const sent = useStore((s) => s.sent);
  const read = useStore((s) => Boolean(s.read[c.id]));
  const messages = allMessages(c, sent);
  const last = messages[messages.length - 1];
  const unread = read ? 0 : c.unread;
  const person = c.kind === 'direct' ? findPerson(c.personIds[0]) : undefined;
  return (
    <PressableScale onPress={() => router.push(`/messages/${c.id}`)} style={[styles.row, { backgroundColor: unread ? t.c.surface : 'transparent', borderColor: unread ? t.c.line : 'transparent' }]}>
      {person ? (
        <Avatar name={person.name} hue={person.hue} size={52} online={person.online} />
      ) : (
        <View style={[styles.groupIcon, { backgroundColor: c.kind === 'service' ? t.c.brandSoft : t.light.accentSoft }]}>
          <Icon name={KIND_ICON[c.kind]} size={22} color={c.kind === 'service' ? t.c.brand : t.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.top}>
          <Text variant="titleS" numberOfLines={1} style={{ flex: 1 }}>
            {c.title}
          </Text>
          <Text variant="caption" tone="tertiary">
            {last ? timeAgo(minutesAgo(last)) : 'new'}
          </Text>
        </View>
        <View style={styles.top}>
          <Text variant="bodyS" tone={unread ? 'primary' : 'secondary'} numberOfLines={1} style={{ flex: 1 }}>
            {last ? `${last.from === 'me' ? 'You: ' : c.kind === 'direct' ? '' : `${senderName(last.from)}: `}${last.text}` : 'You are connected. Say hi 👋'}
          </Text>
          {unread ? (
            <View style={[styles.badge, { backgroundColor: t.c.brand }]}>
              <Text variant="caption" color={t.c.onBrand} style={{ fontSize: 11 }}>
                {unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  groupIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
