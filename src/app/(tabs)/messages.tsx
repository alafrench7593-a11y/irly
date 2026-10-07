import { useLocalSearchParams, useRouter } from 'expo-router';
import { isServerId, useServerInbox } from '@/features/server/chat';
import { t as tx } from '@/i18n';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { findCommunity, findPerson } from '@/data/repo';
import { Photo } from '@/components/visual/Photo';
import type { Conversation } from '@/data/types';
import { useGirlStore } from '@/features/girl/girlStore';
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

/**
 * Messages, in three places that never mix: Communities (a dedicated area
 * at the top, every community you joined, its chat already open to you),
 * Direct (private conversations) and Groups (session and event chats,
 * created with every plan).
 */
export default function Messages() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const connections = useStore((s) => s.connections);
  const memberOf = useStore((s) => s.memberOf);
  const read = useStore((s) => s.read);
  const matches = useGirlStore((s) => s.matches);
  const server = useServerInbox();
  const all = [...server.conversations, ...cityConversations(cityId, connections, memberOf, matches)];
  const communities = all.filter((c) => c.kind === 'community');
  const direct = all.filter((c) => c.kind === 'direct' || c.kind === 'service');
  const groups = all.filter((c) => c.kind === 'group' || c.kind === 'event');
  return (
    <Page overline={city.name} title="Messages" subtitle="Joining a community or a plan adds you to its chat.">
      <Animated.View entering={enter.rise(0, 40)} style={{ marginBottom: space[7], gap: 10 }}>
        <Text variant="overline" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
          Communities · {communities.length}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
          {communities.map((c, i) => {
            const community = c.refId ? findCommunity(c.refId) : undefined;
            const unread = read[c.id] ? 0 : c.unread;
            const lit = highlight === c.id;
            return (
              <Animated.View key={c.id} entering={enter.pop(i, 60)}>
                <PressableScale
                  haptic="select"
                  scaleTo={0.96}
                  onPress={() => router.push(`/messages/${c.id}`)}
                  style={[styles.community, { backgroundColor: t.c.surface, borderColor: lit ? t.c.text : 'transparent', boxShadow: t.shadow.card }]}
                  accessibilityLabel={`${c.title}${unread ? `, ${tx('{n} unread', { n: unread })}` : ''}`}
                >
                  {community ? (
                    <Photo visual={community.visual} light={city.light} style={styles.communityPhoto} width={200} recyclingKey={`cv-${c.id}`} />
                  ) : (
                    <View style={[styles.communityPhoto, { backgroundColor: t.c.overlay }]} />
                  )}
                  <Text variant="label" numberOfLines={2}>
                    {c.title}
                  </Text>
                  <Text variant="caption" tone={unread ? 'primary' : 'tertiary'}>
                    {unread ? tx('{n} unread', { n: unread }) : lit ? 'Just joined' : 'Up to date'}
                  </Text>
                  {unread ? <View style={[styles.dot, { backgroundColor: t.c.live }]} /> : null}
                </PressableScale>
              </Animated.View>
            );
          })}
          <PressableScale
            haptic="select"
            scaleTo={0.96}
            onPress={() => router.push('/community/new')}
            style={[styles.community, styles.find, { borderColor: t.c.lineStrong }]}
            accessibilityLabel="Create a community"
          >
            <Icon name="users" size={22} color={t.c.text} />
            <Text variant="label" align="center">
              Create a community
            </Text>
          </PressableScale>
          <PressableScale
            haptic="select"
            scaleTo={0.96}
            onPress={() => router.push('/communities')}
            style={[styles.community, styles.find, { borderColor: t.c.lineStrong }]}
            accessibilityLabel="Find communities"
          >
            <Icon name="plus" size={22} color={t.c.text} />
            <Text variant="label" align="center">
              Find communities
            </Text>
          </PressableScale>
        </ScrollView>
      </Animated.View>

      <Section title="Direct" list={direct} empty="Connect with someone to start a private conversation." />
      <Section title="Groups" list={groups} empty="Join a session or an event: its group chat appears here." />
    </Page>
  );
}

function Section({ title, list, empty }: { title: string; list: Conversation[]; empty: string }) {
  return (
    <View style={{ paddingHorizontal: space.gutter, gap: 8, marginBottom: space[7] }}>
      <Text variant="overline" tone="secondary">
        {title} · {list.length}
      </Text>
      {list.length ? (
        list.map((c, i) => (
          <Animated.View key={c.id} entering={enter.rise(i, 40)}>
            <ConversationRow conversation={c} />
          </Animated.View>
        ))
      ) : (
        <Text variant="bodyS" tone="tertiary">
          {empty}
        </Text>
      )}
    </View>
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
            {last ? timeAgo(minutesAgo(last)) : tx('new')}
          </Text>
        </View>
        <View style={styles.top}>
          <Text variant="bodyS" tone={unread ? 'primary' : 'secondary'} numberOfLines={1} style={{ flex: 1 }}>
            {last ? `${last.from === 'me' ? tx('You:') + ' ' : c.kind === 'direct' ? '' : `${senderName(last.from)}: `}${isServerId(c.id) ? last.text : tx(last.text)}` : tx('You are connected. Say hi 👋')}
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
  community: { width: 132, padding: 10, gap: 6, borderRadius: radius.xl, borderWidth: 1.5 },
  communityPhoto: { width: '100%', height: 72, borderRadius: radius.lg, overflow: 'hidden' },
  find: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', minHeight: 150 },
  dot: { position: 'absolute', top: 16, right: 16, width: 10, height: 10, borderRadius: 5 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
});
