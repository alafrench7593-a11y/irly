import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { findCommunity, findPerson } from '@/data/repo';
import type { Conversation } from '@/data/types';
import { useGirlStore } from '@/features/girl/girlStore';
import { allMessages, cityConversations, minutesAgo, senderName } from '@/features/messages/conversations';
import { isServerId, useServerInbox } from '@/features/server/chat';
import { useSignedLinks } from '@/features/server/media';
import { coverVariant } from '@/features/server/enhance';
import { a11y, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'all' | 'private' | 'groups' | 'communities' | 'activities';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'all', label: 'All', icon: 'message' },
  { id: 'private', label: 'Private', icon: 'user' },
  { id: 'groups', label: 'Groups', icon: 'users' },
  { id: 'communities', label: 'Communities', icon: 'heartHandshake' },
  { id: 'activities', label: 'Activities', icon: 'calendar' },
];

/** Which tab a chat belongs to: one, never two. */
const tabOf = (c: Conversation): Exclude<Tab, 'all'> =>
  c.kind === 'community' ? 'communities' : c.kind === 'event' ? 'activities' : c.kind === 'group' ? 'groups' : 'private';

const EMPTY: Record<Tab, string> = {
  all: 'No conversations yet. Join a community or a plan, or message someone you met.',
  private: 'Open someone’s profile and tap Message to start a private conversation.',
  groups: 'Create a group with people you know: it gets its own chat and photo.',
  communities: 'Join a community: its chat appears here straight away.',
  activities: 'Join an activity: its group chat appears here until the day.',
};

/**
 * Messages: every chat you are in, sorted by the latest message, in tabs
 * that never mix (private, groups, communities, activities). Each row shows
 * the chat's own picture: the person's photo, the group's, the community's
 * or the activity's. Search covers names and last messages.
 */
export default function Messages() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const reduced = useReducedMotion();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const connections = useStore((s) => s.connections);
  const memberOf = useStore((s) => s.memberOf);
  const read = useStore((s) => s.read);
  const sent = useStore((s) => s.sent);
  const matches = useGirlStore((s) => s.matches);
  const server = useServerInbox();
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');

  const all = useMemo(() => {
    const list = [...server.conversations, ...cityConversations(cityId, connections, memberOf, matches)];
    // Latest first, by the last message; chats without one go last.
    const age = (c: Conversation) => {
      const last = allMessages(c, sent).at(-1);
      return last ? minutesAgo(last) : Infinity;
    };
    return list.map((c) => ({ c, age: age(c) })).sort((a, b) => a.age - b.age).map((x) => x.c);
  }, [server.conversations, cityId, connections, memberOf, matches, sent]);

  const counts = useMemo(() => {
    const n: Record<Tab, number> = { all: all.length, private: 0, groups: 0, communities: 0, activities: 0 };
    for (const c of all) n[tabOf(c)] += 1;
    return n;
  }, [all]);

  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      all.filter((c) => {
        if (tab !== 'all' && tabOf(c) !== tab) return false;
        if (!needle) return true;
        const last = allMessages(c, sent).at(-1);
        return c.title.toLowerCase().includes(needle) || (last?.text ?? '').toLowerCase().includes(needle);
      }),
    [all, tab, needle, sent],
  );

  // One signed link per stored photo: people's photos and chats' own pictures.
  const faces = useSignedLinks('profile-photos', useMemo(() => all.map((c) => c.otherPhoto), [all]));
  const pictures = useSignedLinks('activity-photos', useMemo(() => all.map((c) => coverVariant(c.photoPath, 'square')), [all]));
  const loading = server.loading && !server.conversations.length;

  return (
    <Page overline={city.name} title="Messages" subtitle="Private chats, groups, communities and activities, in one place.">
      <View style={styles.pad}>
        <View style={[styles.search, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
          <Icon name="search" size={18} color={t.c.textTertiary} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={tx('Search conversations')}
            placeholderTextColor={t.c.textTertiary}
            style={[styles.input, { color: t.c.text }]}
            accessibilityLabel={a11y('Search conversations')}
            returnKeyType="search"
            autoCorrect={false}
          />
          {q ? (
            <PressableScale onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search">
              <Icon name="x" size={16} color={t.c.textTertiary} />
            </PressableScale>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map((x) => {
          const on = tab === x.id;
          return (
            <PressableScale
              key={x.id}
              haptic="select"
              scaleTo={0.95}
              onPress={() => setTab(x.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${tx(x.label)}, ${counts[x.id]}`}
              style={[styles.tab, { backgroundColor: on ? t.c.text : t.c.surface, borderColor: on ? t.c.text : t.c.line }]}
            >
              <Icon name={x.icon} size={14} color={on ? t.c.bg : t.c.text} />
              <Text variant="label" color={on ? t.c.bg : t.c.text}>
                {x.label}
              </Text>
              {counts[x.id] ? (
                <Text variant="caption" color={on ? t.c.bg : t.c.textTertiary}>
                  {counts[x.id]}
                </Text>
              ) : null}
            </PressableScale>
          );
        })}
      </ScrollView>

      <View style={[styles.pad, styles.actions]}>
        <Action icon="users" label="New group" onPress={() => router.push('/group/new')} />
        <Action icon="heartHandshake" label="Find communities" onPress={() => router.push('/communities')} />
      </View>

      {server.error ? (
        <View style={[styles.pad, { marginBottom: space[3] }]}>
          <PressableScale onPress={server.refresh} style={[styles.banner, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityRole="button" accessibilityLabel={tx('{error}. Try again', { error: tx(server.error) })}>
            <Icon name="globe" size={16} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              {server.error}
            </Text>
            <Text variant="label">Try again</Text>
          </PressableScale>
        </View>
      ) : null}

      <Animated.View key={tab} entering={reduced ? undefined : FadeIn.duration(180)} style={[styles.pad, { gap: 6 }]}>
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <View key={i} style={styles.row}>
              <Skeleton width={56} height={56} radius={28} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="80%" height={12} />
              </View>
            </View>
          ))
        ) : shown.length ? (
          shown.map((c, i) => (
            <Animated.View key={c.id} entering={reduced ? undefined : enter.rise(Math.min(i, 8), 30)} exiting={reduced ? undefined : FadeOut.duration(120)} layout={reduced ? undefined : LinearTransition.springify(420).dampingRatio(0.9)}>
              <Row c={c} lit={highlight === c.id} unread={isServerId(c.id) ? c.unread : read[c.id] ? 0 : c.unread} face={c.otherPhoto ? faces[c.otherPhoto] : undefined} picture={c.photoPath ? pictures[coverVariant(c.photoPath, 'square')!] : undefined} />
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={FadeIn} style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name={needle ? 'search' : TABS.find((x) => x.id === tab)!.icon} size={22} color={t.c.textSecondary} />
            <Text variant="titleS" align="center">
              {needle ? 'No conversation matches' : 'Nothing here yet'}
            </Text>
            <Text variant="bodyS" tone="secondary" align="center">
              {needle ? tx('Nothing called “{q}” in your conversations.', { q: q.trim() }) : EMPTY[tab]}
            </Text>
          </Animated.View>
        )}
      </Animated.View>
    </Page>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} accessibilityRole="button" accessibilityLabel={tx(label)} style={[styles.action, { borderColor: t.c.lineStrong }]}>
      <Icon name={icon} size={16} color={t.c.text} />
      <Text variant="label">{label}</Text>
    </PressableScale>
  );
}

const KIND_ICON: Record<Exclude<Tab, 'all'>, IconName> = { private: 'user', groups: 'users', communities: 'heartHandshake', activities: 'calendar' };

const Row = memo(function Row({ c, lit, unread, face, picture }: { c: Conversation; lit: boolean; unread: number; face?: string; picture?: string }) {
  const t = useTheme();
  const router = useRouter();
  const sent = useStore((s) => s.sent);
  const last = allMessages(c, sent).at(-1);
  const kind = tabOf(c);
  const server = isServerId(c.id);
  // On-device chats (demo) take their pictures from the example data.
  const person = !server && kind === 'private' ? findPerson(c.personIds[0]) : undefined;
  const community = !server && kind === 'communities' && c.refId ? findCommunity(c.refId) : undefined;
  const who = last ? (last.from === 'me' ? `${tx('You:')} ` : kind === 'private' ? '' : `${server ? (c.lastSenderName ?? tx('Member')) : senderName(last.from)}: `) : '';
  const body = last ? (c.lastIsPhoto ? `📷 ${tx('Photo')}` : server ? last.text : tx(last.text)) : kind === 'private' ? tx('You are connected. Say hi 👋') : tx('Say hello to the group');
  return (
    <PressableScale
      onPress={() => router.push(`/messages/${c.id}`)}
      scaleTo={0.98}
      style={[styles.row, { backgroundColor: unread ? t.c.surface : 'transparent', borderColor: lit ? t.c.text : unread ? t.c.line : 'transparent' }]}
      accessibilityLabel={`${c.title}${unread ? `, ${tx('{n} unread', { n: unread })}` : ''}`}
    >
      {kind === 'private' ? (
        <Avatar name={c.title} hue={hueOf(c.otherId ?? c.id)} size={56} photo={person?.photo ?? face} online={person?.online} />
      ) : (
        <View style={[styles.picture, { backgroundColor: t.c.overlay }]}>
          {picture || community ? (
            <Photo visual={community?.visual ?? { photo: 'meeting', uri: picture }} light="dubai" width={160} style={StyleSheet.absoluteFill} recyclingKey={`conv-${c.id}-${c.photoPath ?? 'app'}`} />
          ) : (
            <Icon name={KIND_ICON[kind]} size={22} color={t.c.textSecondary} />
          )}
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.top}>
          <Text variant="titleS" numberOfLines={1} style={{ flex: 1 }} raw>
            {c.title}
          </Text>
          <Text variant="caption" tone={unread ? 'primary' : 'tertiary'}>
            {last ? timeAgo(minutesAgo(last)) : tx('new')}
          </Text>
        </View>
        <View style={styles.top}>
          <Text variant="bodyS" tone={unread ? 'primary' : 'secondary'} numberOfLines={1} style={{ flex: 1, fontFamily: unread ? font.semibold : undefined }} raw>
            {who}
            {body}
          </Text>
          {unread ? (
            <Animated.View entering={FadeIn} style={[styles.badge, { backgroundColor: t.c.brand }]}>
              <Text variant="caption" color={t.c.onBrand} style={{ fontSize: 11 }}>
                {unread > 99 ? '99+' : unread}
              </Text>
            </Animated.View>
          ) : kind !== 'private' && c.members ? (
            <Text variant="caption" tone="tertiary">
              {tx('{n} members', { n: c.members })}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  input: { flex: 1, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 },
  tabs: { paddingHorizontal: space.gutter, gap: 8, paddingVertical: space[4] },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth * 2 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: space[4] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent' },
  picture: { width: 56, height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: radius.xl },
});
