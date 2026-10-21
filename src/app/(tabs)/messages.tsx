import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CITIES } from '@/data/destinations';
import { findCommunity, findPerson } from '@/data/repo';
import type { Conversation } from '@/data/types';
import { useGirlStore } from '@/features/girl/girlStore';
import { allMessages, cityConversations, minutesAgo, senderName } from '@/features/messages/conversations';
import { isServerId, removeConversationForMe, setConversationArchived, useServerInbox } from '@/features/server/chat';
import { useSignedLinks } from '@/features/server/media';
import { primeFaces } from '@/features/server/faces';
import { a11y, t as tx } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { hueOf } from '@/lib/format';
import { haptic } from '@/motion/haptics';
import { toast } from '@/components/ui/Toast';
import { timeAgo } from '@/lib/time';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import type { PhotoKey } from '@/data/photos';
import { useCommunityPhotoKeys } from '@/features/server/covers';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SpaceFlavor } from '@/theme/space';
import { GirlHeaderMark } from '@/features/girl/GirlMark';

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
export default function MessagesRoute() {
  // In IRLY Girl the list wears the Girl look like every page (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <Messages />
    </SpaceFlavor>
  );
}

function Messages() {
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
  // Archived chats live in their own list, never in the tabs.
  const [archivedView, setArchivedView] = useState(false);
  const [menu, setMenu] = useState<Conversation | null>(null);
  const [busy, setBusy] = useState(false);
  const archivedCount = useMemo(() => server.conversations.filter((c) => c.archived).length, [server.conversations]);
  const showArchived = archivedView && archivedCount > 0;
  const openMenu = useCallback((c: Conversation) => {
    if (!isServerId(c.id)) return;
    haptic('select');
    setMenu(c);
  }, []);
  const act = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      haptic('success');
      toast(done, 'check', 'brand');
      setMenu(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const all = useMemo(() => {
    const mine = server.conversations.filter((c) => Boolean(c.archived) === showArchived);
    const list = showArchived ? mine : [...mine, ...cityConversations(cityId, connections, memberOf, matches)];
    // Latest first, by the last message; chats without one go last.
    const age = (c: Conversation) => {
      const last = allMessages(c, sent).at(-1);
      return last ? minutesAgo(last) : Infinity;
    };
    return list.map((c) => ({ c, age: age(c) })).sort((a, b) => a.age - b.age).map((x) => x.c);
  }, [server.conversations, showArchived, cityId, connections, memberOf, matches, sent]);

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

  // People's faces come from the shared faces (small copies, cached); chats' own pictures are signed here.
  useEffect(() => primeFaces(server.conversations.filter((c) => c.otherId).map((c) => ({ id: c.otherId!, path: c.otherPhoto }))), [server.conversations]);
  const pictures = useSignedLinks('activity-photos', useMemo(() => all.map((c) => c.photoPath), [all]));
  // A community chat without a photo of its own shows its community's picture, as on the community's page.
  const appPhotos = useCommunityPhotoKeys(useMemo(() => all.filter((c) => isServerId(c.id) && tabOf(c) === 'communities' && c.refId).map((c) => c.refId!), [all]));
  const loading = server.loading && !server.conversations.length;
  // Back returns to the page that opened the list (IRLY Girl, a plan...): the tabs' own history
  // would land on the Home tab. Opened from a tab root, the tabs' back is kept.
  const navigation = useNavigation();
  const back = () => {
    const stack = navigation.getParent();
    if (stack?.canGoBack()) stack.goBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Page overline={city.name} title="Messages" subtitle="Private chats, groups, communities and activities, in one place." right={t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : undefined} onBack={back}>
      <View style={styles.pad}>
        <View style={styles.search}>
          <Glass level="thin" style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />
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

      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
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
              style={styles.tab}
            >
              {on ? (
                <Animated.View entering={reduced ? undefined : enter.pop(0)} style={[StyleSheet.absoluteFill, styles.tabFill, { backgroundColor: t.c.brand, boxShadow: t.shadow.glow }]} />
              ) : (
                <Glass level="thin" style={[StyleSheet.absoluteFill, styles.tabFill]} />
              )}
              <Icon name={x.icon} size={14} color={on ? t.c.onBrand : t.c.text} />
              <Text variant="label" color={on ? t.c.onBrand : t.c.text}>
                {x.label}
              </Text>
              {counts[x.id] ? (
                <Text variant="caption" color={on ? t.c.onBrand : t.c.textTertiary}>
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
      {archivedCount > 0 ? (
        <View style={[styles.pad, { marginBottom: space[3] }]}>
          <PressableScale
            haptic="select"
            onPress={() => setArchivedView((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: showArchived }}
            accessibilityLabel={showArchived ? tx('Back to messages') : tx('Archived, {n}', { n: archivedCount })}
            style={[styles.banner, { backgroundColor: showArchived ? t.c.brand : 'transparent' }]}
          >
            {showArchived ? null : <Glass level="regular" style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />}
            <Icon name={showArchived ? 'chevronLeft' : 'file'} size={16} color={showArchived ? t.c.onBrand : t.c.textSecondary} />
            <Text variant="label" color={showArchived ? t.c.onBrand : t.c.text} style={{ flex: 1 }}>
              {showArchived ? 'Back to messages' : 'Archived'}
            </Text>
            {!showArchived ? (
              <Text variant="caption" tone="tertiary">
                {archivedCount}
              </Text>
            ) : null}
          </PressableScale>
        </View>
      ) : null}

      {server.error ? (
        <View style={[styles.pad, { marginBottom: space[3] }]}>
          <PressableScale onPress={server.refresh} style={styles.banner} accessibilityRole="button" accessibilityLabel={tx('{error}. Try again', { error: tx(server.error) })}>
            <Glass level="regular" style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
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
              <Glass level="regular" style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
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
              <Row c={c} onLong={openMenu} lit={highlight === c.id} unread={isServerId(c.id) ? c.unread : read[c.id] ? 0 : c.unread} picture={c.photoPath ? pictures[c.photoPath] : undefined} appPhoto={c.refId ? appPhotos[c.refId] : undefined} />
            </Animated.View>
          ))
        ) : (
          <Animated.View entering={reduced ? undefined : enter.rise(0, 40)}>
            <GlassCard padding={24} style={[styles.empty, { boxShadow: t.shadow.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: t.c.brandSoft }]}>
              <Icon name={needle ? 'search' : TABS.find((x) => x.id === tab)!.icon} size={22} color={t.c.text} />
            </View>
            <Text variant="titleS" align="center">
              {needle ? 'No conversation matches' : 'Nothing here yet'}
            </Text>
            <Text variant="bodyS" tone="secondary" align="center">
              {needle ? tx('Nothing called “{q}” in your conversations.', { q: q.trim() }) : EMPTY[tab]}
            </Text>
            </GlassCard>
          </Animated.View>
        )}
      </Animated.View>
      <Sheet visible={menu !== null} onClose={() => setMenu(null)} title={menu?.title} subtitle="Only for you: the others keep the conversation.">
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Button
            label={menu?.archived ? 'Unarchive' : 'Archive'}
            icon="file"
            variant="secondary"
            full
            loading={busy}
            onPress={() => menu && act(() => setConversationArchived(menu.id, !menu.archived), menu.archived ? tx('Back in your messages') : tx('Archived. Find it under Archived'))}
          />
          <Button
            label="Delete conversation"
            icon="x"
            variant="danger"
            full
            disabled={busy}
            onPress={() => {
              const c = menu;
              if (!c) return;
              confirm('Delete this conversation from your list? Its messages are removed for you only; the others keep them.', () => act(() => removeConversationForMe(c.id), tx('Conversation deleted')), 'Delete');
            }}
          />
        </View>
      </Sheet>
    </Page>
  );
}

function Action({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} accessibilityRole="button" accessibilityLabel={tx(label)} style={styles.action}>
      <Glass level="thin" style={[StyleSheet.absoluteFill, { borderRadius: 18 }]} />
      <Icon name={icon} size={16} color={t.c.text} />
      <Text variant="label">{label}</Text>
    </PressableScale>
  );
}

const KIND_ICON: Record<Exclude<Tab, 'all'>, IconName> = { private: 'user', groups: 'users', communities: 'heartHandshake', activities: 'calendar' };

const Row = memo(function Row({ c, lit, unread, picture, appPhoto, onLong }: { c: Conversation; lit: boolean; unread: number; picture?: string; appPhoto?: PhotoKey; onLong: (c: Conversation) => void }) {
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
      onLongPress={server ? () => onLong(c) : undefined}
      delayLongPress={350}
      scaleTo={0.98}
      style={[styles.row, { borderColor: lit ? t.c.brand : 'transparent', boxShadow: unread ? t.shadow.card : undefined }]}
      accessibilityLabel={`${c.title}${unread ? `, ${tx('{n} unread', { n: unread })}` : ''}`}
    >
      <Glass level={unread ? 'regular' : 'thin'} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
      {kind === 'private' ? (
        <Avatar name={c.title} hue={hueOf(c.otherId ?? c.id)} size={56} photo={person?.photo} online={person?.online} userId={server ? c.otherId : undefined} />
      ) : (
        <View style={[styles.picture, { backgroundColor: t.c.overlay }]}>
          {picture || community || appPhoto ? (
            <Photo
              visual={community?.visual ?? { photo: appPhoto ?? 'meeting', uri: picture }}
              light="dubai"
              width={160}
              style={StyleSheet.absoluteFill}
              recyclingKey={picture ? `conv-${c.id}-${c.photoPath}` : appPhoto && c.refId ? `community-${c.refId}-app` : `conv-${c.id}-app`}
            />
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
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: radius.pill, overflow: 'hidden' },
  input: { flex: 1, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 },
  tabs: { paddingHorizontal: space.gutter, gap: 8, paddingVertical: space[4] },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19 },
  tabFill: { borderRadius: 19 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: space[4] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, overflow: 'hidden' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent', overflow: 'hidden' },
  picture: { width: 56, height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
