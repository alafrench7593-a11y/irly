import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Page } from '@/components/layout/Page';
import { FrameContext, useFrame } from '@/components/layout/frame';
import { COLUMN_MAX, LIST_PANE, useSplit } from '@/components/layout/responsive';
import { Ambient } from '@/components/visual/Ambient';
import { useTabBarSpace } from '@/components/navigation/TabBar';
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
import { allMessages, cityConversations, localChatUniverse, minutesAgo, senderName } from '@/features/messages/conversations';
import { UNIVERSE_NAME, UniverseBadge } from '@/features/messages/UniverseBadge';
import { universesForSpace, type Universe } from '@/features/universe/universe';
import { communityPhoto } from '@/features/community/official';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { useAppSpace, type AppSpace } from '@/state/appSpace';
import { ConversationView } from '@/features/messages/ConversationView';
import { useMessagesPane } from '@/features/messages/paneStore';
import { chatInSpace, isServerId, removeConversationForMe, setConversationArchived, useServerInbox } from '@/features/server/chat';
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

type Tab = 'recent' | 'unread' | 'private' | 'communities' | 'activities';
type Kind = 'private' | 'communities' | 'activities';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'recent', label: 'Recent chats', icon: 'message' },
  { id: 'unread', label: 'Unread', icon: 'bell' },
  { id: 'private', label: 'Private messages', icon: 'user' },
  { id: 'communities', label: 'Communities', icon: 'heartHandshake' },
  { id: 'activities', label: 'Activities', icon: 'calendar' },
];

/** Which kind a chat is: one, never two (group chats were removed on 2026-11-06). */
const kindOf = (c: Conversation): Kind => (c.kind === 'community' ? 'communities' : c.kind === 'event' ? 'activities' : 'private');

const EMPTY: Record<Tab, string> = {
  recent: 'No conversations yet. Join a community or a plan, or message someone you met.',
  unread: 'All caught up: no unread message here.',
  private: 'Open someone’s profile and tap Message to start a private conversation.',
  communities: 'Join a community: its chat appears here straight away.',
  activities: 'Join an activity: its chat appears here until the day.',
};

/** The universe shown: the one picked in this app space, else the space's own (Mixte, or Girl). */
const pickUniverse = (picked: { space: AppSpace; universe: Universe } | null, space: AppSpace): Universe => {
  const list = universesForSpace(space);
  return picked && picked.space === space && list.includes(picked.universe) ? picked.universe : list[0];
};

/** A chat with its universe known (on-device examples get theirs from features/messages/conversations). */
const withUniverse = (c: Conversation): Conversation => {
  if (isServerId(c.id) || c.universe !== undefined) return c;
  const universe = localChatUniverse(c);
  return { ...c, universe, womenOnly: universe === 'girl' };
};

/**
 * Messages: every chat you are in, sorted by the latest message.
 *
 * By universe first (features/universe): the Mixte app lists Mixte and
 * Network (Mixte side), the IRLY Girl app Girl, Mom and Network (Girl side),
 * one universe at a time, the app's own first (Mixte, or Girl). A community
 * or activity chat is in its universe only; a private chat has none and is
 * the same single chat in every universe. Then by section: Recent, Unread,
 * Private messages, Communities, Activities.
 * Each row shows the chat's own picture (the person's photo, the community's
 * or the activity's), its name, last message, date, unread count and
 * universe. Search covers names and last messages of every chat of the app
 * space (all its universes and sections).
 * The Messages badge counts the unread messages of the app space: all its
 * universes and private chats (features/server/chat, UnreadSync); a dot on a
 * universe tells which of its community or activity chats wait.
 *
 * Wide screens (useSplit): the list on the left, the chosen conversation on
 * the right, in the same tree as the phone layout so a fold or a resize
 * keeps search, tab and scroll. Phones push the conversation as a page.
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
  // Messages lives in the tabs: the floating tab bar stays over it, so the last chat must scroll clear of it
  // (Page already adds the bottom safe area, the bar's own space is the rest).
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
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
  const appSpace = useAppSpace();
  const universes = universesForSpace(appSpace);
  // One universe at a time, the app space's own first; another space starts again from its own.
  const [picked, setPicked] = useState<{ space: AppSpace; universe: Universe } | null>(null);
  const universe = pickUniverse(picked, appSpace);
  const [tab, setTab] = useState<Tab>('recent');
  const [q, setQ] = useState('');
  // Archived chats live in their own list, never in the tabs.
  const [archivedView, setArchivedView] = useState(false);
  const [menu, setMenu] = useState<Conversation | null>(null);
  const [busy, setBusy] = useState(false);
  const archivedCount = useMemo(() => server.conversations.filter((c) => c.archived && chatInSpace(c, appSpace)).length, [server.conversations, appSpace]);
  const showArchived = archivedView && archivedCount > 0;
  const openMenu = useCallback((c: Conversation) => {
    if (!isServerId(c.id)) return;
    haptic('select');
    setMenu(c);
  }, [setMenu]);
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

  // Every chat of this app space (all its universes): what search and the badge cover.
  const all = useMemo(() => {
    const mine = server.conversations.filter((c) => Boolean(c.archived) === showArchived);
    const list = (showArchived ? mine : [...mine, ...cityConversations(cityId, connections, memberOf, matches)]).map(withUniverse).filter((c) => chatInSpace(c, appSpace));
    // Latest first, by the last message; chats without one go last.
    const age = (c: Conversation) => {
      const last = allMessages(c, sent).at(-1);
      return last ? minutesAgo(last) : Infinity;
    };
    return list.map((c) => ({ c, age: age(c) })).sort((a, b) => a.age - b.age).map((x) => x.c);
  }, [server.conversations, showArchived, cityId, connections, memberOf, matches, sent, appSpace]);

  const unreadOf = useCallback((c: Conversation) => (isServerId(c.id) ? c.unread : read[c.id] ? 0 : c.unread), [read]);
  // The chosen universe: its community and activity chats, and every private chat (archived ones: all of the space).
  const inUniverse = useMemo(() => (showArchived ? all : all.filter((c) => !c.universe || c.universe === universe)), [all, showArchived, universe]);
  // A dot on a universe whose own chats (not the shared private ones) have unread messages.
  const waiting = useMemo(() => {
    const out = new Set<Universe>();
    for (const c of all) if (c.universe && !c.archived && unreadOf(c)) out.add(c.universe);
    return out;
  }, [all, unreadOf]);

  const counts = useMemo(() => {
    const n: Record<Tab, number> = { recent: inUniverse.length, unread: 0, private: 0, communities: 0, activities: 0 };
    for (const c of inUniverse) {
      n[kindOf(c)] += 1;
      if (unreadOf(c)) n.unread += 1;
    }
    return n;
  }, [inUniverse, unreadOf]);

  const needle = q.trim().toLowerCase();
  // Searching looks through every chat of the app space (each row says its universe); otherwise the universe and section chosen.
  const shown = useMemo(
    () =>
      needle
        ? all.filter((c) => {
            const last = allMessages(c, sent).at(-1);
            return c.title.toLowerCase().includes(needle) || (last?.text ?? '').toLowerCase().includes(needle);
          })
        : inUniverse.filter((c) => tab === 'recent' || (tab === 'unread' ? unreadOf(c) > 0 : kindOf(c) === tab)),
    [all, inUniverse, tab, needle, sent, unreadOf],
  );

  // People's faces come from the shared faces (small copies, cached); chats' own pictures are signed here.
  useEffect(() => primeFaces(server.conversations.filter((c) => c.otherId).map((c) => ({ id: c.otherId!, path: c.otherPhoto }))), [server.conversations]);
  const pictures = useSignedLinks('activity-photos', useMemo(() => all.map((c) => c.photoPath), [all]));
  // A community chat without a photo of its own shows its community's picture, as on the community's page.
  // (The server tells the community's topic and category with the inbox: asked again only from a server that does not.)
  const appPhotos = useCommunityPhotoKeys(
    useMemo(() => all.filter((c) => isServerId(c.id) && kindOf(c) === 'communities' && c.refId && c.refCategory === undefined && c.refTopic === undefined).map((c) => c.refId!), [all]),
  );
  const loading = server.loading && !server.conversations.length;
  // Back returns to the page that opened the list (IRLY Girl, a plan...): the tabs' own history
  // would land on the Home tab. Opened from a tab root, the tabs' back is kept.
  const navigation = useNavigation();
  // The chosen chat lives in a store, not here: folding, unfolding or resizing never loses it.
  const split = useSplit();
  const frame = useFrame();
  const focused = useIsFocused();
  const selected = useMessagesPane((s) => s.selected);
  const select = useMessagesPane((s) => s.select);
  // A chosen chat that left the inbox (deleted, blocked, another city) no longer fills the pane.
  const known = useMemo(() => Boolean(selected && (all.some((c) => c.id === selected) || server.conversations.some((c) => c.id === selected))), [selected, all, server.conversations]);
  const current = selected && (known || server.loading) ? selected : null;
  const open = useCallback(
    (c: Conversation) => {
      select(c.id);
      if (!split) router.push(`/messages/${c.id}`);
    },
    [select, split, router],
  );
  // Folded (or narrowed) with a chat open in the pane: it stays open, as its own page.
  const wasSplit = useRef(split);
  useEffect(() => {
    if (wasSplit.current && !split && current && focused) router.push(`/messages/${current}`);
    wasSplit.current = split;
  }, [split, current, focused, router]);
  const listFrame = useMemo(() => ({ ...frame, width: split ? LIST_PANE : Math.min(frame.width, COLUMN_MAX) }), [frame, split]);
  const paneFrame = useMemo(() => ({ ...frame, width: Math.max(0, frame.width - LIST_PANE - StyleSheet.hairlineWidth) }), [frame]);
  const back = () => {
    const stack = navigation.getParent();
    if (stack?.canGoBack()) stack.goBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.split}>
    <View style={split ? styles.listPane : styles.listFull}>
    <FrameContext.Provider value={listFrame}>
    <Page overline={city.name} title="Messages" subtitle="Private chats, communities and activities, in one place." right={t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : undefined} onBack={back} bottomInset={tabBarSpace - insets.bottom}>
      {showArchived ? null : (
        <View style={[styles.pad, styles.universes]}>
          {universes.map((u) => {
            const on = u === universe && !needle;
            return (
              <PressableScale
                key={u}
                haptic="select"
                scaleTo={0.96}
                onPress={() => {
                  setPicked({ space: appSpace, universe: u });
                  setQ('');
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={waiting.has(u) ? tx('Universe: {name}, unread messages', { name: UNIVERSE_NAME[u] }) : tx('Universe: {name}', { name: UNIVERSE_NAME[u] })}
                style={[styles.universe, { borderColor: on ? t.c.brand : t.c.line, backgroundColor: on ? t.c.brandSoft : 'transparent' }]}
              >
                <Text variant="label" color={on ? t.c.text : t.c.textSecondary} raw>
                  {UNIVERSE_NAME[u]}
                </Text>
                {waiting.has(u) ? <View style={[styles.universeDot, { backgroundColor: t.c.brand }]} /> : null}
              </PressableScale>
            );
          })}
        </View>
      )}
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

      {needle ? (
        <View style={{ height: space[4] }} />
      ) : (
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
                // Under the icon (web: an <svg> drawn after a positioned fill disappears under it), in the tab's own layer.
                <Animated.View entering={reduced ? undefined : enter.pop(0)} style={[StyleSheet.absoluteFill, styles.tabFill, styles.under, { backgroundColor: t.c.brand, boxShadow: t.shadow.glow }]} />
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
      )}

      <View style={[styles.pad, styles.actions]}>
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
              <Row c={c} onOpen={open} onLong={openMenu} lit={highlight === c.id} selected={split && current === c.id} unread={unreadOf(c)} picture={c.photoPath ? pictures[c.photoPath] : undefined} appPhoto={c.refId ? appPhotos[c.refId] : undefined} />
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
    </FrameContext.Provider>
    </View>
    {split ? (
      <>
        <View style={[styles.divider, { backgroundColor: t.c.line }]} />
        <View style={[styles.detail, { backgroundColor: t.c.bg }]}>
          <FrameContext.Provider value={paneFrame}>
            {/* Keyed: another chat starts fresh (its own draft, scroll and sheets). */}
            {current ? <ConversationView key={current} id={current} pane /> : <ChooseConversation />}
          </FrameContext.Provider>
        </View>
      </>
    ) : null}
    </View>
  );
}

/** The pane before a chat is chosen. */
function ChooseConversation() {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <View style={styles.choose}>
      <Ambient variant="quiet" />
      <Animated.View entering={reduced ? undefined : enter.rise(0, 40)} style={styles.chooseCard}>
        <GlassCard padding={24} style={[styles.empty, { boxShadow: t.shadow.card }]}>
          <View style={[styles.emptyIcon, { backgroundColor: t.c.brandSoft }]}>
            <Icon name="message" size={22} color={t.c.text} />
          </View>
          <Text variant="titleS" align="center">
            Choose a conversation
          </Text>
          <Text variant="bodyS" tone="secondary" align="center">
            Pick a chat in the list to read it here.
          </Text>
        </GlassCard>
      </Animated.View>
    </View>
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

const KIND_ICON: Record<Kind, IconName> = { private: 'user', communities: 'heartHandshake', activities: 'calendar' };

/** The app's picture for a server chat with no photo of its own: its community's or its activity's subject (as on their pages). */
function subjectPhoto(c: Conversation, kind: Kind): PhotoKey | undefined {
  if (!isServerId(c.id) || (c.refCategory === undefined && c.refTopic === undefined)) return undefined;
  if (kind === 'communities') return communityPhoto(c.refTopic, c.refCategory, c.title);
  if (kind === 'activities') return ideaPhoto((c.refCategory && CATEGORY_BY_ID[c.refCategory as CategoryKey] ? c.refCategory : 'sport') as CategoryKey, c.title, c.refPlace, c.refSub);
  return undefined;
}

const Row = memo(function Row({ c, lit, selected, unread, picture, appPhoto, onOpen, onLong }: { c: Conversation; lit: boolean; selected: boolean; unread: number; picture?: string; appPhoto?: PhotoKey; onOpen: (c: Conversation) => void; onLong: (c: Conversation) => void }) {
  const t = useTheme();
  const sent = useStore((s) => s.sent);
  const last = allMessages(c, sent).at(-1);
  const kind = kindOf(c);
  const server = isServerId(c.id);
  const subject = appPhoto ?? subjectPhoto(c, kind);
  // On-device chats (demo) take their pictures from the example data.
  const person = !server && kind === 'private' ? findPerson(c.personIds[0]) : undefined;
  const community = !server && kind === 'communities' && c.refId ? findCommunity(c.refId) : undefined;
  const who = last ? (last.from === 'me' ? `${tx('You:')} ` : kind === 'private' ? '' : `${server ? (c.lastSenderName ?? tx('Member')) : senderName(last.from)}: `) : '';
  const body = last ? (c.lastIsPhoto ? `📷 ${tx('Photo')}` : server ? last.text : tx(last.text)) : kind === 'private' ? tx('You are connected. Say hi 👋') : tx('Say hello to everyone');
  return (
    <PressableScale
      onPress={() => onOpen(c)}
      onLongPress={server ? () => onLong(c) : undefined}
      delayLongPress={350}
      scaleTo={0.98}
      style={[styles.row, { borderColor: lit || selected ? t.c.brand : 'transparent', boxShadow: unread || selected ? t.shadow.card : undefined }]}
      accessibilityState={{ selected }}
      accessibilityLabel={`${c.title}${unread ? `, ${tx('{n} unread', { n: unread })}` : ''}`}
    >
      <Glass level={unread || selected ? 'regular' : 'thin'} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />
      {/* The chat open in the pane (wide screens), tinted with the brand like a lit tab. */}
      {selected ? <View style={[StyleSheet.absoluteFill, { backgroundColor: t.c.brandSoft }]} /> : null}
      {kind === 'private' ? (
        <Avatar name={c.title} hue={hueOf(c.otherId ?? c.id)} size={56} photo={person?.photo} online={person?.online} userId={server ? c.otherId : undefined} />
      ) : (
        <View style={[styles.picture, { backgroundColor: t.c.overlay }]}>
          {picture || community || subject ? (
            <Photo
              visual={community?.visual ?? { photo: subject ?? 'meeting', uri: picture }}
              light="dubai"
              width={160}
              style={StyleSheet.absoluteFill}
              recyclingKey={picture ? `conv-${c.id}-${c.photoPath}` : subject && c.refId ? (kind === 'activities' ? `a-${c.refId}` : `community-${c.refId}-app`) : `conv-${c.id}-app`}
            />
          ) : (
            <Icon name={KIND_ICON[kind]} size={22} color={t.c.textSecondary} />
          )}
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.top}>
          {/* A member's chat keeps its name as written; a built-in (example) chat's name is translated. */}
          <Text variant="titleS" numberOfLines={1} style={{ flex: 1 }} raw={isServerId(c.id)}>
            {c.title}
          </Text>
          {c.universe ? <UniverseBadge universe={c.universe} /> : null}
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
  split: { flex: 1, flexDirection: 'row', justifyContent: 'center' },
  listPane: { width: LIST_PANE },
  // Expanded but too narrow for two panes: the list keeps a readable column.
  listFull: { flex: 1, maxWidth: COLUMN_MAX },
  divider: { width: StyleSheet.hairlineWidth },
  detail: { flex: 1, overflow: 'hidden' },
  choose: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  chooseCard: { width: '100%', maxWidth: 420 },
  pad: { paddingHorizontal: space.gutter },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: radius.pill, overflow: 'hidden' },
  input: { flex: 1, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 },
  tabs: { paddingHorizontal: space.gutter, gap: 8, paddingVertical: space[4] },
  universes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space[3] },
  universe: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1 },
  universeDot: { width: 7, height: 7, borderRadius: 4 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: 19, zIndex: 0 },
  tabFill: { borderRadius: 19 },
  under: { zIndex: -1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space[4] },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, overflow: 'hidden' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 10, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent', overflow: 'hidden' },
  picture: { width: 56, height: 56, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
