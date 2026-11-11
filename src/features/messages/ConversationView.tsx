import { useRouter } from 'expo-router';
import { NotFound } from '@/components/layout/NotFound';
import { DEMO } from '@/config/app';
import { dateLocale, t as tx, a11y } from '@/i18n';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { blockUser, useBlocked, type ReportTarget } from '@/features/moderation/moderation';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { confirm } from '@/lib/confirm';
import { Glass } from '@/components/ui/Glass';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { useKeyboardHeight } from '@/motion/keyboard';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findCommunity, findPerson } from '@/data/repo';
import { toast } from '@/components/ui/Toast';
import { chatDraft, isServerId, removeConversationForMe, setConversationArchived, useChatUniverse, useServerThread } from '@/features/server/chat';
import { UniverseBadge } from '@/features/messages/UniverseBadge';
import { sharedHref } from '@/features/server/engage';
import { useActivityCards } from '@/features/server/activityCards';
import { ActivityChatBanner, ActivityShareCard } from '@/components/cards/ActivityCards';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { pickPhoto, setChatPhoto, setCommunityCover, useChatPhoto, usePhotoLink } from '@/features/server/covers';
import { pickChatPhotos, takeChatPhoto, useSignedLinks } from '@/features/server/media';
import { TapPhoto } from '@/features/photo/TapPhoto';
import { hueOf } from '@/lib/format';
import { Image } from 'expo-image';
import { Photo } from '@/components/visual/Photo';
import { allMessages, cannedReply, localChatUniverse, resolveConversation, senderName } from '@/features/messages/conversations';
import { haptic } from '@/motion/haptics';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import type { Message } from '@/data/types';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useBusy } from '@/lib/useBusy';
import { forgetConversation } from '@/features/messages/paneStore';
import { communityDeleteMessage, useCommunityRights, useCommunityRoles, type CommunityRole } from '@/features/messages/communityChat';
import { useQuotedOutside, useReactions, type ReactionChip, type ReactionsByMessage } from '@/features/messages/reactions';
import { ContextMenuArea, MessageMenu, ModerationSheet, PinSheet, PinnedBanner, QuoteInBubble, ReactionChips, ReplyBar, RoleBadge, quoteText, type PinnedLine } from '@/features/messages/ChatBits';
import { pinMessage, pinUntil, rememberPeople, useChatPins, type Mentionable, type PinLength } from '@/features/messages/communitySpace';
import { RichText } from '@/components/ui/RichText';
import { chatCommunity, openActivityFromMessage } from '@/features/messages/toActivity';

/**
 * Where the chat is drawn. A page of its own (phones, `/messages/[id]`):
 * back and leaving go back. A pane next to the list (wide screens): no back,
 * and leaving the chat (blocked, archived, deleted, group left) empties the pane.
 * `keyboardOffset`: how far below the top of the screen the view starts (the
 * community Chat tab sits under the page header and the tabs). The keyboard
 * avoider measures its frame from its parent, not from the screen: without
 * this it lifted the composer by that much too little and the keyboard
 * covered it.
 */
type Place = { pane: boolean; leave: () => void; keyboardOffset: number };
const PlaceContext = createContext<Place>({ pane: false, leave: () => {}, keyboardOffset: 0 });

/**
 * One conversation: realtime messages, text and photos, replies, reactions,
 * delete, report and block. The same view serves the page and the pane, so
 * both behave alike.
 */
export function ConversationView({ id, draft, pane = false, keyboardOffset = 0 }: { id: string; draft?: string; pane?: boolean; keyboardOffset?: number }) {
  const router = useRouter();
  const status = useAuthStatus();
  const leave = useCallback(() => {
    forgetConversation(id);
    if (pane) return;
    if (router.canGoBack()) router.back();
    else router.replace('/messages');
  }, [id, pane, router]);
  const place = useMemo(() => ({ pane, leave, keyboardOffset }), [pane, leave, keyboardOffset]);
  // Server conversations (signed in) have UUIDs; the rest live on the device.
  let body;
  if (isServerId(id) && status === 'out') body = <SignedOut />;
  // The stored session is not read yet (a chat opened at launch): neither « Say hello » nor a composer before it is.
  else if (isServerId(id) && status === 'unknown') body = <SessionLoading />;
  else if (isServerId(id)) body = <ServerThreadView id={id} draft={draft} />;
  // The on-device example chats (with their canned replies) belong to the demonstration build only.
  else body = DEMO ? <Thread id={id} /> : <NotFound title="This conversation is not available" />;
  return <PlaceContext.Provider value={place}>{body}</PlaceContext.Provider>;
}

/** A chat link opened while signed out: say so instead of loading forever. */
function SignedOut() {
  const t = useTheme();
  const router = useRouter();
  const { pane } = useContext(PlaceContext);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: t.c.bg }}>
      <Text variant="titleM" align="center">
        Sign in to see this conversation
      </Text>
      <Button label="Sign in" onPress={() => router.push('/account')} />
      {pane ? null : <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />}
    </View>
  );
}

/** A chat opened before the session is known: the same wait as the other pages. */
function SessionLoading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.bg }}>
      <ActivityIndicator color={t.c.text} />
    </View>
  );
}

/** Back to the previous page; in a pane the list is beside it, so a spacer keeps the title centred. */
function HeaderBack() {
  const router = useRouter();
  const { pane } = useContext(PlaceContext);
  if (pane) return <View style={{ width: 40 }} />;
  return <IconButton icon="chevronLeft" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />;
}

/** A day line between messages of different days ("Today", "Yesterday", "Mon 5 Oct"). */
function dayLabel(at: number): string {
  const d = new Date(at);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return tx('Today');
  if (diff === 1) return tx('Yesterday');
  return d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
}
const clock = (at: number) => new Date(at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });

/**
 * At most this many messages are drawn at once (the latest ones): a chat left open for hours, or
 * read far back, no longer grows the screen without end. Load earlier shows RENDER_STEP more
 * of what is already on the phone before asking the server for older ones.
 */
const RENDER_CAP = 150;
const RENDER_STEP = 100;
const ALL = '*';

/** A live conversation from the IRLY server: realtime in, optimistic out. */
function ServerThreadView({ id, draft }: { id: string; draft?: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { leave, keyboardOffset } = useContext(PlaceContext);
  const thread = useServerThread(id);
  const now = useNow();
  // `draft`: a first message prepared elsewhere (Introduce myself): editable, never sent by itself.
  const chatPhoto = useChatPhoto(id);
  const universe = useChatUniverse(id);
  // A 36 pt picture in the header: its small copy.
  const chatPhotoUri = usePhotoLink(chatPhoto.path, true);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const changePhoto = async (next: 'pick' | 'reset') => {
    if (photoBusy) return;
    try {
      const picked = next === 'pick' ? await pickPhoto() : null;
      if (next === 'pick' && !picked) return;
      setPhotoBusy(true);
      // A community chat's picture is the community's photo: one source, shown everywhere.
      if (chatPhoto.communityId) await setCommunityCover(chatPhoto.communityId, picked);
      else await setChatPhoto(id, picked);
      haptic('success');
      toast(next === 'pick' ? 'Photo updated' : 'Back to the IRLY photo', 'check', 'brand');
      setPhotoMenu(false);
      chatPhoto.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the photo', 'x', 'live');
    } finally {
      setPhotoBusy(false);
    }
  };
  // What was being written here before leaving the chat comes back (a prepared first message wins).
  const [text, setText] = useState(() => (typeof draft === 'string' ? draft.slice(0, 600) : chatDraft.get(id)));
  useEffect(() => {
    chatDraft.set(id, text);
  }, [id, text]);
  const [earlier, setEarlier] = useState(false);
  // The oldest message drawn: null, the latest RENDER_CAP; ALL, every message (older ones were
  // asked for). Anchored to a message while you read further up, so one arriving meanwhile never
  // pushes the one you read out of the list.
  const [from, setFrom] = useState<null | typeof ALL | { id: string; at: number }>(null);
  const all = thread.messages;
  // Memoised: the message list re-renders on new messages, not on each key typed.
  const visible = useMemo(() => {
    if (from === ALL) return all;
    let i = from ? all.findIndex((m) => m.id === from.id) : -1;
    // The anchor itself was removed (deleted for everyone, hidden): the next message takes its place,
    // so the view does not jump to the bottom while you read further up.
    if (i < 0 && from) i = all.findIndex((m) => m.at >= from.at);
    return i >= 0 ? all.slice(i) : all.length > RENDER_CAP ? all.slice(-RENDER_CAP) : all;
  }, [all, from]);
  const hidden = all.length - visible.length;
  const [menu, setMenu] = useState(false);
  // Block waits for the server: a second tap asked again, then went back twice.
  const blocking = useBusy<'block'>();
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [reportName, setReportName] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  // Keyboard up: the composer sits on it, without the home-indicator gap below.
  const keyboard = useKeyboardHeight();
  // Keep the view at the bottom, except right after loading older messages.
  const stick = useRef(true);
  // Only messages that arrive while the chat is open slide in; the history appears at once
  // (dozens of entry animations on opening a chat cost frames for nothing).
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  if (openedAt === null && !thread.loading) setOpenedAt(thread.messages.length ? thread.messages[thread.messages.length - 1].at : 0);

  // Answering a message (« Reply »): shown above the composer, sent with the next message.
  // Tied to its chat: a pane that shows another chat does not carry it over.
  const [replying, setReplying] = useState<{ conv: string; m: ThreadMessage } | null>(null);
  const replyingTo = replying?.conv === id ? replying.m : null;
  const input = useRef<TextInput>(null);
  // One send at a time: a double tap must not post the same message twice.
  const sending = useRef(false);
  const send = async () => {
    const body = text.trim();
    if (!body || sending.current) return;
    sending.current = true;
    haptic('tap');
    setText('');
    const answer = replyingTo?.id;
    setReplying(null);
    stick.current = true;
    // Shown at once as "sending"; a failure stays in the thread with "Retry".
    try {
      await thread.send(body, answer);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live');
    } finally {
      sending.current = false;
    }
  };
  // Photos to send: picked, previewed, then sent (or cancelled).
  const [attach, setAttach] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);
  const choose = async (from: 'library' | 'camera') => {
    try {
      let picked: string[] | null;
      if (from === 'camera') {
        const one = await takeChatPhoto();
        picked = one ? [one] : null;
      } else picked = await pickChatPhotos();
      setAttach(false);
      if (picked && picked.length) setPreview(picked);
    } catch (e) {
      setAttach(false);
      toast(e instanceof Error ? e.message : 'Could not open your photos', 'x', 'live');
    }
  };
  const sendingPhotos = useRef(false);
  const sendPreview = async () => {
    const uris = preview;
    if (!uris.length || sendingPhotos.current) return;
    sendingPhotos.current = true;
    setPreview([]);
    stick.current = true;
    haptic('tap');
    try {
      await thread.sendPhotos(uris);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Photo not sent', 'x', 'live');
    } finally {
      sendingPhotos.current = false;
    }
  };
  const [info, setInfo] = useState(false);
  const media = useSignedLinks(
    'chat-media',
    visible.map((m) => m.media?.path),
  );
  // Stable: the message list only re-renders when its messages change (not on each key typed).
  const threadRetry = thread.retry;
  const retry = useCallback(
    (id: string) => {
      haptic('tap');
      threadRetry(id).catch((e) => toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live'));
    },
    [threadRetry],
  );

  // Long press on a message: delete it for me, for everyone (mine only), or report it.
  const [msgMenu, setMsgMenu] = useState<(typeof thread.messages)[number] | null>(null);
  const [msgBusy, setMsgBusy] = useState(false);
  const onLong = useCallback((m: ThreadMessage) => {
    if (m.from === 'irly') return;
    haptic('select');
    setMsgMenu(m);
  }, []);
  const runOnMessage = async (action: () => Promise<void>, done: string) => {
    setMsgBusy(true);
    try {
      await action();
      haptic('success');
      toast(done, 'check', 'brand');
      setMsgMenu(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live');
    } finally {
      setMsgBusy(false);
    }
  };

  // A community chat: the senders' roles (badges) and whether I may moderate, each read once for the chat.
  const me = useAccount()?.userId;
  const communityChat = thread.kind === 'community' ? thread.communityId : null;
  const roles = useCommunityRoles(communityChat);
  const rights = useCommunityRights(communityChat);
  // Removed here by a moderator: gone from the screen at once (the server has removed it for everyone).
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const shown = useMemo(() => (removed.size ? visible.filter((m) => !removed.has(m.id)) : visible), [visible, removed]);
  // Reactions of what is on screen (messages the server has), people I blocked left out.
  const blocked = useBlocked();
  const blockedIds = useMemo(() => new Set(blocked.list.map((b) => b.userId)), [blocked.list]);
  const reactable = useMemo(() => shown.filter((m) => m.from !== 'irly' && !m.status).map((m) => m.id), [shown]);
  const reactions = useReactions(id, reactable, me, blockedIds);
  const reactionsToggle = reactions.toggle;
  const react = useCallback(
    (messageId: string, emoji: string) => {
      reactionsToggle(messageId, emoji).catch((e) => toast(e instanceof Error ? e.message : 'Could not react', 'x', 'live'));
    },
    [reactionsToggle],
  );
  // Quotes: the message answered, from the chat on the phone, else read once (older than what is loaded).
  const byId = useMemo(() => new Map(all.map((m) => [m.id, m])), [all]);
  const missingQuotes = useMemo(() => shown.flatMap((m) => (m.replyTo && !byId.has(m.replyTo) ? [m.replyTo] : [])), [shown, byId]);
  const outside = useQuotedOutside(id, missingQuotes);
  const members = thread.members;
  const quoteOf = useCallback(
    (replyTo: string): Quote | null => {
      const m = byId.get(replyTo);
      if (m) return { id: m.id, name: m.from === 'me' ? tx('You') : (m.name ?? tx('Member')), text: quoteText({ text: m.text, photo: Boolean(m.media) }), loaded: true };
      const q = outside[replyTo];
      if (!q) return null;
      const name = q.gone ? tx('Message') : q.senderId === me ? tx('You') : (q.senderId && members[q.senderId]?.name) || tx('Member');
      return { id: q.id, name, text: quoteText(q), loaded: false };
    },
    [byId, outside, me, members],
  );
  // Tap on a quote: back to the original, drawn first if it was above what is shown.
  const places = useRef(new Map<string, number>());
  const [flash, setFlash] = useState<string | null>(null);
  const goTo = useRef<string | null>(null);
  const reveal = useCallback((target: string) => {
    const y = places.current.get(target);
    if (y === undefined) return false;
    stick.current = false;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    setFlash(target);
    setTimeout(() => setFlash((f) => (f === target ? null : f)), 1400);
    return true;
  }, []);
  const onPlace = useCallback(
    (messageId: string, y: number) => {
      places.current.set(messageId, y);
      if (goTo.current === messageId) {
        goTo.current = null;
        requestAnimationFrame(() => reveal(messageId));
      }
    },
    [reveal],
  );
  const onQuote = useCallback(
    (target: string) => {
      haptic('select');
      if (visible.some((m) => m.id === target) && reveal(target)) return;
      const m = all.find((x) => x.id === target);
      if (!m) {
        toast(tx('The original message is further up: load earlier messages'), 'message', 'brand');
        return;
      }
      goTo.current = target;
      setFrom({ id: m.id, at: m.at });
    },
    [visible, all, reveal],
  );
  // Pins of a community chat: read once when it opens; moderators pin and unpin from the menu.
  const { pins, supported: pinsSupported, refresh: refreshPins } = useChatPins(id, Boolean(communityChat));
  const pinnedIds = useMemo(() => new Set(pins.map((p) => p.messageId)), [pins]);
  const [moderating, setModerating] = useState<ThreadMessage | null>(null);
  const [modBusy, setModBusy] = useState(false);
  const moderate = async (m: ThreadMessage, reason: string) => {
    setModBusy(true);
    try {
      await communityDeleteMessage(m.id, reason);
      setRemoved((r) => new Set(r).add(m.id));
      if (pinnedIds.has(m.id)) refreshPins();
      haptic('success');
      toast(tx('Message removed'), 'shield', 'brand');
      setModerating(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live');
    } finally {
      setModBusy(false);
    }
  };
  const pinLines = useMemo<PinnedLine[]>(
    () =>
      pins.map((p) => ({
        id: p.messageId,
        name: p.senderId && p.senderId === me ? tx('You') : (p.senderName ?? (p.senderId ? members[p.senderId]?.name : null) ?? tx('Member')),
        text: p.body.trim() || tx('Message'),
      })),
    [pins, me, members],
  );
  const [pinning, setPinning] = useState<ThreadMessage | null>(null);
  const [pinBusy, setPinBusy] = useState<PinLength | 'off' | null>(null);
  const setPin = async (m: ThreadMessage, length: PinLength | 'off') => {
    if (pinBusy) return;
    setPinBusy(length);
    try {
      await pinMessage(m.id, length !== 'off', length === 'off' ? null : pinUntil(length));
      haptic('success');
      toast(length === 'off' ? tx('Message unpinned') : tx('Message pinned'), 'pinPost', 'brand');
      setPinning(null);
      setMsgMenu(null);
      refreshPins();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not pin', 'x', 'live');
    } finally {
      setPinBusy(null);
    }
  };
  const canPin = Boolean(communityChat && rights?.can_moderate && pinsSupported);
  // The members' names: an @Name in a message opens their profile.
  const people = useMemo<Mentionable[]>(() => Object.entries(members).map(([uid, x]) => ({ id: uid, name: x.name })), [members]);
  useEffect(() => rememberPeople(people), [people]);
  const [toActivity, setToActivity] = useState(false);
  const turnIntoActivity = async (m: ThreadMessage) => {
    if (!communityChat || toActivity) return;
    setToActivity(true);
    try {
      const community = await chatCommunity(communityChat, thread.title);
      setMsgMenu(null);
      openActivityFromMessage(m.text, community);
    } catch {
      toast('Can’t reach IRLY right now', 'x', 'live');
    } finally {
      setToActivity(false);
    }
  };
  const menuMine = msgMenu?.from === 'me';
  const menuText = msgMenu && !msgMenu.media && !msgMenu.share ? msgMenu.text : undefined;
  const menuSettled = Boolean(msgMenu && !msgMenu.status);

  // Activities referenced here (shares, and this chat's own activity): read live, never from the message text.
  const activityCards = useActivityCards([...thread.messages.map((m) => (m.share?.type === 'activity' ? m.share.id : null)), thread.kind === 'activity' ? thread.activityId : null]);
  const ownActivity = thread.kind === 'activity' && thread.activityId ? activityCards.get(thread.activityId) : undefined;
  const BANNER = 52;
  const PIN_BANNER = 56;
  const pinsShown = pinLines.length > 0;
  const group = thread.kind !== null && thread.kind !== 'direct' && thread.kind !== 'match';
  const other = thread.otherId;
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient variant="quiet" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'} keyboardVerticalOffset={keyboardOffset}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24 + (ownActivity ? BANNER : 0) + (pinsShown ? PIN_BANNER : 0), paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
          onContentSizeChange={() => {
            if (stick.current) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          // The keyboard shrinks the list from the bottom: without this the last
          // messages went behind the composer when you tapped the field.
          onLayout={() => {
            if (stick.current) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            stick.current = contentOffset.y + layoutMeasurement.height > contentSize.height - 120;
            // Reading further up: what is drawn stays put. Back at the bottom of a long chat: the latest RENDER_CAP only.
            if (!stick.current && from === null && hidden > 0) setFrom({ id: visible[0].id, at: visible[0].at });
            else if (stick.current && from !== null && visible.length > RENDER_CAP + RENDER_STEP) setFrom(null);
          }}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {thread.loading ? <ActivityIndicator color={t.c.text} /> : null}
          {thread.error ? (
            <View style={{ alignItems: 'center', gap: 12 }}>
              <Text variant="body" tone="secondary" align="center">
                {thread.error}
              </Text>
              <Button label="Try again" size="sm" variant="secondary" onPress={thread.reload} />
            </View>
          ) : null}
          {thread.hasEarlier || hidden > 0 ? (
            <PressableScale
              haptic="select"
              onPress={async () => {
                if (earlier) return;
                stick.current = false;
                // Older messages already on the phone: drawn first, no server call.
                if (hidden > 0) {
                  const first = all[Math.max(0, hidden - RENDER_STEP)];
                  setFrom({ id: first.id, at: first.at });
                  return;
                }
                setEarlier(true);
                // The older messages the server gives are drawn too (they were asked for).
                setFrom(ALL);
                try {
                  await thread.loadEarlier();
                } catch {
                  toast('Can’t reach IRLY right now', 'x', 'live');
                } finally {
                  setEarlier(false);
                }
              }}
              style={styles.earlier}
              accessibilityRole="button"
            >
              <GlassLayer radius={radius.pill} level="thin" />
              {earlier ? <ActivityIndicator color={t.c.text} /> : <Text variant="label">Load earlier messages</Text>}
            </PressableScale>
          ) : null}
          {!thread.loading && !thread.error && !thread.messages.length ? (
            <Text variant="bodyS" tone="secondary" align="center" style={{ marginTop: space[6] }}>
              Say hello 👋 Messages appear here for both of you.
            </Text>
          ) : null}
          <ThreadMessages
            messages={shown}
            media={media}
            group={group}
            now={now}
            openedAt={openedAt}
            onLong={onLong}
            onRetry={retry}
            onHello={setText}
            cardOf={activityCards.get}
            cardsFailed={activityCards.failed}
            roles={communityChat ? roles : NO_ROLES}
            reactions={reactions.byMessage}
            onReact={react}
            quoteOf={quoteOf}
            onQuote={onQuote}
            onPlace={onPlace}
            flash={flash}
            people={people}
            communityId={communityChat}
          />
          {thread.typing.length ? (
            <View style={{ gap: 2 }}>
              <Typing />
              <Text variant="caption" tone="tertiary" style={{ marginLeft: 6 }}>
                {thread.typing.length === 1 ? tx('{name} is typing…', { name: thread.typing[0] }) : tx('Several people are typing…')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        {replyingTo ? <ReplyBar name={replyingTo.from === 'me' ? tx('You') : (replyingTo.name ?? tx('Member'))} text={quoteText({ text: replyingTo.text, photo: Boolean(replyingTo.media) })} onClose={() => setReplying(null)} /> : null}
        <Glass lifted level="thick" style={[styles.composer, { paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 12) }]} intensity={60}>
          <PressableScale haptic="select" onPress={() => setAttach(true)} scaleTo={0.88} style={styles.attach} accessibilityLabel="Send a photo">
            <GlassLayer radius={21} level="thin" />
            <Icon name="image" size={19} color={t.c.text} />
          </PressableScale>
          <View style={styles.inputWrap}>
            <GlassLayer radius={radius.pill} level="thin" />
            <TextInput
              ref={input}
              value={text}
              onChangeText={(v) => {
                setText(v);
                if (v.trim()) thread.setTyping();
              }}
              placeholder={tx('Message')}
              placeholderTextColor={t.c.textTertiary}
              style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
              onSubmitEditing={send}
              returnKeyType="send"
              // Send from the keyboard keeps it open for the next message (blurOnSubmit: the web ignores submitBehavior).
              submitBehavior="submit"
              blurOnSubmit={false}
              maxLength={4000}
              accessibilityLabel={a11y('Message')}
            />
          </View>
          <SendButton ready={Boolean(text.trim())} onPress={send} />
        </Glass>
      </KeyboardAvoidingView>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={styles.headerRow}>
          <HeaderBack />
          <PressableScale
            haptic="select"
            scaleTo={0.97}
            onPress={() => (other ? router.push(`/person/${other}`) : thread.kind ? setInfo(true) : undefined)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            accessibilityLabel={other ? tx('Open {name}’s profile', { name: thread.title }) : tx('About {title}', { title: thread.title })}
          >
            {other ? (
              <Avatar name={thread.title} hue={hueOf(other)} size={36} userId={other} />
            ) : chatPhoto.hasPhoto ? (
              <Photo visual={{ photo: chatPhoto.fallback, uri: chatPhotoUri ?? undefined }} light="dubai" style={styles.chatPhoto} width={120} recyclingKey={chatPhoto.path ? `chat-${id}-${chatPhoto.path}` : (chatPhoto.seed ?? `chat-${id}-app`)} />
            ) : null}
            <View style={{ flexShrink: 1, alignItems: other || chatPhoto.hasPhoto ? 'flex-start' : 'center' }}>
              <View style={styles.titleRow}>
                <Text variant="titleS" numberOfLines={1} raw style={{ flexShrink: 1 }}>
                  {thread.title}
                </Text>
                {/* A community or activity chat says which universe it belongs to (a private chat has none). */}
                {universe && !other ? <UniverseBadge universe={universe} /> : null}
              </View>
              <Text variant="caption" tone="tertiary">
                {thread.kind === null
                  ? ''
                  : other
                    ? tx('Private · see profile')
                    : thread.kind === 'community'
                      ? tx('Community · {n} members', { n: Object.keys(thread.members).length })
                      : thread.kind === 'activity'
                        ? tx('Activity · {n} going', { n: Object.keys(thread.members).length })
                        : tx('{n} members', { n: Object.keys(thread.members).length })}
              </Text>
            </View>
          </PressableScale>
          {other ? <IconButton icon="shield" label={tx('Safety: report or block')} onPress={() => setMenu(true)} /> : <View style={{ width: 40 }} />}
        </View>
        {ownActivity && thread.activityId ? (
          // An activity's chat: the activity itself, live, one tap away.
          <View style={styles.banner}>
            <ActivityChatBanner card={ownActivity} onOpen={() => router.push(`/a/${thread.activityId}`)} />
          </View>
        ) : null}
        {pinsShown ? (
          <View style={styles.banner}>
            <PinnedBanner pins={pinLines} onOpen={onQuote} />
          </View>
        ) : null}
      </View>
      {other ? (
        <Sheet visible={menu} onClose={() => setMenu(false)} title={thread.title} subtitle={tx('Private chat')}>
          <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
            <Button
              label="See professional profile"
              icon="briefcase"
              variant="secondary"
              full
              onPress={() => {
                setMenu(false);
                router.push(`/network/${other}`);
              }}
            />
            <ConversationActions id={id} archived={thread.archived} onDone={() => setMenu(false)} />
            <Button
              label="Report"
              icon="flag"
              variant="secondary"
              full
              onPress={() => {
                setMenu(false);
                setReportName(thread.title);
                setReporting({ kind: 'profile', userId: other });
              }}
            />
            <Button
              label="Block"
              icon="shield"
              variant="danger"
              full
              loading={blocking.busy === 'block'}
              onPress={() =>
                blocking.isRunning() ||
                confirm(
                  tx('Block {name}? You will no longer see each other, and this chat closes.', { name: thread.title }),
                  () =>
                    void blocking.run('block', () =>
                      blockUser(other)
                        .then(() => {
                          setMenu(false);
                          toast(tx('{name} is blocked', { name: thread.title }), 'shield', 'brand');
                          leave();
                        })
                        .catch((e) => toast(e instanceof Error ? e.message : 'Could not block', 'x', 'live')),
                    ),
                  'Block',
                )
              }
            />
          </View>
        </Sheet>
      ) : null}
      <Sheet visible={attach} onClose={() => setAttach(false)} title="Send a photo" subtitle={tx('Everyone in this chat will see it')}>
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Button label="Choose from my photos" icon="image" full onPress={() => choose('library')} />
          {Platform.OS !== 'web' ? <Button label="Take a photo" icon="camera" variant="secondary" full onPress={() => choose('camera')} /> : null}
        </View>
      </Sheet>
      <Sheet visible={preview.length > 0} onClose={() => setPreview([])} title={preview.length > 1 ? tx('{n} photos', { n: preview.length }) : tx('Photo')} subtitle={tx('Check it before sending')}>
        <View style={{ paddingHorizontal: space.gutter, gap: 12 }}>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {preview.map((u) => (
              <Image key={u} source={{ uri: u }} style={styles.previewPhoto} contentFit="cover" accessibilityLabel={tx('Photo')} />
            ))}
          </ScrollView>
          <Button label={preview.length > 1 ? tx('Send {n} photos', { n: preview.length }) : tx('Send the photo')} icon="send" full onPress={sendPreview} />
          <Button label="Cancel" variant="secondary" full onPress={() => setPreview([])} />
        </View>
      </Sheet>
      <ChatInfo
        visible={info}
        onClose={() => setInfo(false)}
        id={id}
        title={thread.title}
        members={thread.members}
        communityId={thread.communityId}
        activityId={thread.activityId}
        canEditPhoto={chatPhoto.canEdit}
        onEditPhoto={() => {
          setInfo(false);
          setPhotoMenu(true);
        }}
        archived={thread.archived}
      />
      <MessageMenu
        visible={msgMenu !== null}
        onClose={() => setMsgMenu(null)}
        subtitle={menuMine ? tx('Your message') : msgMenu?.name}
        preview={msgMenu ? quoteText({ text: msgMenu.text, photo: Boolean(msgMenu.media) }) : undefined}
        reactions={menuSettled}
        picked={msgMenu ? (reactions.byMessage[msgMenu.id] ?? []).filter((c) => c.mine).map((c) => c.emoji) : undefined}
        onReact={(emoji) => {
          const m = msgMenu;
          if (!m) return;
          setMsgMenu(null);
          react(m.id, emoji);
        }}
      >
        {menuSettled ? (
          <Button
            label="Reply"
            icon="message"
            full
            onPress={() => {
              const m = msgMenu;
              if (!m) return;
              setMsgMenu(null);
              setReplying({ conv: id, m });
              stick.current = true;
              setTimeout(() => input.current?.focus(), 250);
            }}
          />
        ) : null}
        {canPin && menuSettled && msgMenu ? (
          pinnedIds.has(msgMenu.id) ? (
            <Button label="Unpin" icon="pinPost" variant="secondary" full loading={pinBusy === 'off'} onPress={() => msgMenu && setPin(msgMenu, 'off')} />
          ) : (
            <Button
              label="Pin"
              icon="pinPost"
              variant="secondary"
              full
              onPress={() => {
                const m = msgMenu;
                setMsgMenu(null);
                setPinning(m);
              }}
            />
          )
        ) : null}
        {menuMine && communityChat && menuText && menuSettled ? (
          <Button label="Turn into an activity" icon="calendar" variant="secondary" full loading={toActivity} onPress={() => msgMenu && turnIntoActivity(msgMenu)} />
        ) : null}
        <Button
          label="Delete for me"
          icon="eye"
          variant="secondary"
          full
          loading={msgBusy}
          onPress={() => msgMenu && runOnMessage(() => thread.hideForMe(msgMenu.id), tx('Deleted for you'))}
        />
        {menuMine ? (
          <Button
            label="Delete for everyone"
            icon="x"
            variant="danger"
            full
            disabled={msgBusy}
            onPress={() => {
              const m = msgMenu;
              if (!m) return;
              confirm('Delete this message for everyone? It cannot be undone.', () => runOnMessage(() => thread.remove(m.id), tx('Deleted for everyone')), 'Delete');
            }}
          />
        ) : msgMenu ? (
          <>
            {communityChat && rights?.can_moderate && menuSettled ? (
              <Button
                label="Delete (moderation)"
                icon="shield"
                variant="danger"
                full
                onPress={() => {
                  const m = msgMenu;
                  setMsgMenu(null);
                  setModerating(m);
                }}
              />
            ) : null}
            <Button
              label="Report"
              icon="flag"
              variant="ghost"
              full
              onPress={() => {
                const m = msgMenu;
                setMsgMenu(null);
                setReportName(m.name);
                setReporting({ kind: 'message', id: m.id, userId: m.senderId });
              }}
            />
          </>
        ) : null}
      </MessageMenu>
      <PinSheet visible={pinning !== null} busy={pinBusy === 'off' ? null : pinBusy} onClose={() => setPinning(null)} onPick={(length) => pinning && setPin(pinning, length)} />
      <ModerationSheet visible={moderating !== null} name={moderating?.name} busy={modBusy} onClose={() => setModerating(null)} onConfirm={(reason) => moderating && moderate(moderating, reason)} />
      <ReportSheet target={reporting} name={reportName} onClose={() => setReporting(null)} onBlocked={leave} />
      <Sheet visible={photoMenu} onClose={() => setPhotoMenu(false)} title="Chat photo" subtitle={tx('Everyone in the chat sees it')}>
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Button label="Change the photo" icon="camera" full loading={photoBusy} onPress={() => changePhoto('pick')} />
          {chatPhoto.path ? <Button label="Use the IRLY photo" icon="x" variant="secondary" full onPress={() => changePhoto('reset')} /> : null}
        </View>
      </Sheet>
    </View>
  );
}

/**
 * Archive (or unarchive) the chat, or delete it from my list. Mine only: the
 * other members keep the conversation and its history.
 */
type ThreadMessage = ReturnType<typeof useServerThread>['messages'][number];
/** The message a bubble answers, as drawn in it; `loaded`: in the chat on the phone, so a tap can go to it. */
type Quote = { id: string; name: string; text: string; loaded: boolean };
const NO_ROLES: Record<string, CommunityRole> = {};
/** A demo message with a link or a mention is drawn as written (the others are translated examples). */
const RICH = /https?:\/\/|www\.|(^|\s)@/;
const NO_CHIPS: ReactionChip[] = [];
/**
 * The messages of an open chat. Its own memoised component: typing in the
 * composer (a state of the screen) re-rendered every bubble of the thread
 * on each key (measured: ~70 ms of script per key with 50 messages, CPU ×4).
 * Now only a change of the messages themselves (or their photos) renders it.
 */
const ThreadMessages = memo(function ThreadMessages({
  messages,
  media,
  group,
  now,
  openedAt,
  onLong,
  onRetry,
  onHello,
  cardOf,
  cardsFailed,
  roles,
  reactions,
  onReact,
  quoteOf,
  onQuote,
  onPlace,
  flash,
  people,
  communityId,
}: {
  messages: ThreadMessage[];
  media: Record<string, string>;
  group: boolean;
  now: number;
  openedAt: number | null;
  onLong: (m: ThreadMessage) => void;
  onRetry: (id: string) => void;
  onHello: (text: string) => void;
  /** Live cards of the activities shared here (useActivityCards). */
  cardOf: ReturnType<typeof useActivityCards>['get'];
  cardsFailed: boolean;
  /** Community chats: the senders' roles (a badge by the name); empty elsewhere. */
  roles: Record<string, CommunityRole>;
  reactions: ReactionsByMessage;
  onReact: (messageId: string, emoji: string) => void;
  quoteOf: (messageId: string) => Quote | null;
  onQuote: (messageId: string) => void;
  /** Where each message sits in the list, so a tap on a quote can scroll to it. */
  onPlace: (messageId: string, y: number) => void;
  /** The message just reached from a quote: outlined a moment. */
  flash: string | null;
  /** The chat's members: an @Name in a message opens their profile. */
  people: readonly Mentionable[];
  /** A community chat: an unknown @Name is looked up among its members on tap. */
  communityId: string | null;
}) {
  const t = useTheme();
  const router = useRouter();
  const slideIn = (at: number) => (openedAt !== null && at > openedAt ? FadeInDown.springify(380).dampingRatio(0.8) : undefined);
  return (
    <>
    {messages.map((m, i) => {
      const prev = messages[i - 1];
      const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
      const next = messages[i + 1];
      // The time shows under the last message of a run (same sender, within 5 minutes).
      const showTime = !next || next.from !== m.from || next.at - m.at > 5 * 60_000;
      const day = newDay ? (
        <Text key={`d-${m.id}`} variant="caption" tone="tertiary" align="center" style={{ marginVertical: 6 }}>
          {dayLabel(m.at)}
        </Text>
      ) : null;
      if (m.from === 'irly') {
        // "Sara just joined 👋 Say hello!" in a community: one tap to welcome them.
        const joined = /^(.+) just joined 👋/.exec(m.text)?.[1];
        // A greeting lasts 5 minutes (the server removes it then too): only the day label may stay.
        if (joined && now - m.at >= 5 * 60_000) return day ? <View key={m.id}>{day}</View> : null;
        return (
          <View key={m.id}>
            {day}
            <Animated.View entering={joined ? FadeInDown.springify(420).dampingRatio(0.8) : undefined} style={styles.note}>
              <GlassLayer radius={16} level="thin" />
              {m.official ? (
                <Text variant="overline" tone="accent" align="center">
                  IRLY
                </Text>
              ) : null}
              <Text variant="bodyS" tone="secondary" align="center">
                {m.text}
              </Text>
              {joined ? (
                <PressableScale
                  haptic="select"
                  onPress={() => onHello(tx('Welcome {name}! 👋', { name: joined }))}
                  style={styles.hello}
                  accessibilityLabel={tx('Say hello to {name}', { name: joined })}
                >
                  <GlassLayer radius={16} level="thin" />
                  <Text variant="label">Say hello</Text>
                </PressableScale>
              ) : null}
            </Animated.View>
          </View>
        );
      }
      const mine = m.from === 'me';
      const showName = !mine && group && prev?.from !== m.from;
      // In a group, the sender's face sits by the last message of their run; tap it for their profile.
      const showFace = !mine && group && (!next || next.from !== m.from);
      const openSender = m.senderId ? () => router.push(`/person/${m.senderId}`) : undefined;
      const photoUri = m.media ? (m.media.path ? media[m.media.path] : null) ?? m.media.local : null;
      const role = m.senderId ? roles[m.senderId] : undefined;
      const quote = m.replyTo ? quoteOf(m.replyTo) : null;
      const chips = reactions[m.id] ?? NO_CHIPS;
      const lit = flash === m.id;
      const menu = () => onLong(m);
      return (
        <View key={m.id} onLayout={(e) => onPlace(m.id, e.nativeEvent.layout.y)}>
          {day}
          <Animated.View entering={slideIn(m.at)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
            {showName ? (
              <View style={[styles.nameRow, { marginLeft: group ? 46 : 12 }]}>
                <PressableScale haptic="select" onPress={openSender} hitSlop={6} accessibilityLabel={tx('Open {name}’s profile', { name: m.name ?? tx('Member') })}>
                  <Text variant="caption" tone="tertiary" raw>
                    {m.name ?? tx('Member')}
                  </Text>
                </PressableScale>
                <RoleBadge role={role} />
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' }}>
              {!mine && group ? (
                showFace ? (
                  <PressableScale haptic="select" scaleTo={0.9} onPress={openSender} accessibilityLabel={tx('Open {name}’s profile', { name: m.name ?? tx('Member') })}>
                    <Avatar name={m.name ?? '?'} hue={hueOf(m.senderId ?? m.id)} size={30} userId={m.senderId} />
                  </PressableScale>
                ) : (
                  <View style={{ width: 30 }} />
                )
              ) : null}
              <ContextMenuArea onMenu={menu}>
              {m.media ? (
                <PressableScale haptic={false} onLongPress={menu} delayLongPress={350} accessibilityHint={tx('Long press for reactions and more')}>
                  {photoUri ? (
                    <TapPhoto photo={{ uri: photoUri }} style={[styles.photoBubble, { opacity: m.status === 'sending' ? 0.6 : 1 }]}>
                      {/* Cached by the stored file, not by its signed link (a new one every few hours and at each launch): seen once, not downloaded again. */}
                      <Image source={{ uri: photoUri, cacheKey: m.media.path && photoUri === media[m.media.path] ? `chat-media/${m.media.path}` : undefined }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} accessibilityLabel={tx('Photo')} />
                    </TapPhoto>
                  ) : (
                    <View style={[styles.photoBubble, { backgroundColor: t.c.overlay, alignItems: 'center', justifyContent: 'center' }]}>
                      <ActivityIndicator color={t.c.textSecondary} />
                    </View>
                  )}
                  {m.status === 'sending' ? (
                    <View style={styles.photoSending}>
                      <ActivityIndicator color="#FFFFFF" />
                    </View>
                  ) : null}
                </PressableScale>
              ) : m.share?.type === 'activity' && m.share.id && !cardsFailed ? (
                // A shared activity: its live card (or « not available » for whoever may not see it).
                <ActivityShareCard
                  card={cardOf(m.share.id)}
                  onOpen={() => router.push(`/a/${m.share?.id}`)}
                  onLongPress={menu}
                />
              ) : (
            <PressableScale
              haptic={false}
              scaleTo={0.98}
              onLongPress={menu}
              delayLongPress={350}
              onPress={
                m.share
                  ? () => {
                      const sh = m.share;
                      if (sh) sharedHref(sh.type, sh.id, m.text).then((href) => router.push(href as never));
                    }
                  : undefined
              }
              accessibilityHint={tx('Long press for reactions and more')}
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: t.c.brand, borderBottomRightRadius: 6 }
                  : { borderBottomLeftRadius: 6, overflow: 'hidden' },
                lit ? { borderWidth: 2, borderColor: t.c.steel } : null,
              ]}
            >
              {mine ? null : <GlassLayer radius={20} />}
              {quote ? <QuoteInBubble name={quote.name} text={quote.text} mine={mine} onPress={quote.loaded ? () => onQuote(quote.id) : undefined} /> : null}
              {m.share ? (
                <View style={styles.shared}>
                  <Icon name={m.share.type === 'activity' ? 'calendar' : m.share.type === 'place' ? 'pin' : 'link'} size={16} color={mine ? t.c.onBrand : t.c.text} />
                  <Text variant="titleS" raw color={mine ? t.c.onBrand : t.c.text} numberOfLines={2} style={{ flexShrink: 1 }}>
                    {m.text}
                  </Text>
                  <Icon name="chevronRight" size={16} color={mine ? t.c.onBrand : t.c.text} />
                </View>
              ) : (
                <RichText text={m.text} color={mine ? t.c.onBrand : t.c.text} onBrand={mine} people={people} communityId={communityId} selectable />
              )}
            </PressableScale>
              )}
              </ContextMenuArea>
            </View>
            <ReactionChips chips={chips} mine={mine} onToggle={m.status ? undefined : (emoji) => onReact(m.id, emoji)} />
            {m.status === 'failed' ? (
              <PressableScale haptic={false} onPress={() => onRetry(m.id)} accessibilityRole="button" accessibilityLabel={tx('Not sent. Retry')} style={{ alignSelf: 'flex-end', marginTop: 2, marginRight: 6 }}>
                <Text variant="caption" color={t.c.live}>
                  Not sent · Retry
                </Text>
              </PressableScale>
            ) : m.status === 'sending' ? (
              <Text variant="caption" tone="tertiary" style={{ marginTop: 2, textAlign: 'right', marginRight: 6 }}>
                Sending…
              </Text>
            ) : showTime ? (
              <Text variant="caption" tone="tertiary" style={[{ marginTop: 2 }, mine ? { textAlign: 'right', marginRight: 6 } : { marginLeft: 6 }]} raw>
                {clock(m.at)}
              </Text>
            ) : null}
          </Animated.View>
        </View>
      );
    })}
    </>
  );
});

function ConversationActions({ id, archived, onDone }: { id: string; archived: boolean; onDone: () => void }) {
  const { leave } = useContext(PlaceContext);
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null);
  // What I just chose wins over the screen's last load until it reloads.
  const [chosen, setIsArchived] = useState<boolean | null>(null);
  const isArchived = chosen ?? archived;
  return (
    <>
      <Button
        label={isArchived ? 'Unarchive' : 'Archive'}
        icon="file"
        variant="secondary"
        full
        loading={busy === 'archive'}
        disabled={busy !== null}
        onPress={async () => {
          setBusy('archive');
          try {
            await setConversationArchived(id, !isArchived);
            haptic('success');
            toast(isArchived ? tx('Back in your messages') : tx('Archived. Find it under Archived'), 'check', 'brand');
            setIsArchived(!isArchived);
            onDone();
            if (!isArchived) leave();
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Could not archive', 'x', 'live');
          } finally {
            setBusy(null);
          }
        }}
      />
      <Button
        label="Delete conversation"
        icon="x"
        variant="danger"
        full
        loading={busy === 'delete'}
        disabled={busy !== null}
        onPress={() =>
          confirm(
            'Delete this conversation from your list? Its messages are removed for you only; the others keep them.',
            async () => {
              setBusy('delete');
              try {
                await removeConversationForMe(id);
                haptic('success');
                toast(tx('Conversation deleted'), 'check', 'brand');
                onDone();
                leave();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live');
              } finally {
                setBusy(null);
              }
            },
            'Delete',
          )
        }
      />
    </>
  );
}

/** About a community or activity chat: its page and its members (tap for a profile). */
function ChatInfo({
  visible,
  onClose,
  id,
  title,
  members,
  communityId,
  activityId,
  canEditPhoto,
  onEditPhoto,
  archived,
}: {
  visible: boolean;
  onClose: () => void;
  id: string;
  title: string;
  members: Record<string, { name: string; photo: string | null; admin: boolean }>;
  communityId: string | null;
  activityId: string | null;
  canEditPhoto: boolean;
  onEditPhoto: () => void;
  archived: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const me = useAccount()?.userId;
  const list = Object.entries(members);
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={tx('{n} members', { n: list.length })}>
      <ScrollView style={{ maxHeight: 460, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }} keyboardShouldPersistTaps="handled">
        {communityId ? <Button label="Open the community" icon="heartHandshake" variant="secondary" full onPress={() => go(`/c/${communityId}`)} /> : null}
        {activityId ? <Button label="Open the activity" icon="calendar" variant="secondary" full onPress={() => go(`/a/${activityId}`)} /> : null}
        {canEditPhoto ? <Button label={communityId ? 'Change the community photo' : 'Change the photo'} icon="camera" variant="secondary" full onPress={onEditPhoto} /> : null}
        <ConversationActions id={id} archived={archived} onDone={onClose} />
        <Text variant="overline" tone="tertiary" style={{ marginTop: space[3] }}>
          Members
        </Text>
        {list.map(([uid, m]) => (
          <PressableScale key={uid} haptic="select" scaleTo={0.98} onPress={() => go(`/person/${uid}`)} style={styles.memberRow} accessibilityLabel={tx('Open {name}’s profile', { name: m.name })}>
            <Avatar name={m.name} hue={hueOf(uid)} size={40} userId={uid} />
            <Text variant="titleS" style={{ flex: 1 }} raw>
              {uid === me ? tx('You') : m.name}
            </Text>
            {m.admin ? (
              <Text variant="caption" tone="tertiary">
                Admin
              </Text>
            ) : null}
            <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
          </PressableScale>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function Thread({ id }: { id: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { keyboardOffset } = useContext(PlaceContext);
  const cityId = useCityId();
  const conversation = resolveConversation(id, cityId);
  const sent = useStore((s) => s.sent);
  const sendMessage = useStore((s) => s.sendMessage);
  const receiveMessage = useStore((s) => s.receiveMessage);
  const markRead = useStore((s) => s.markRead);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const keyboard = useKeyboardHeight();
  // The example reply's timers: none of them fires once the chat is closed.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  // The demonstration keeps replies and reactions on this screen only (nothing is saved).
  const [menu, setMenu] = useState<Message | null>(null);
  const [replying, setReplying] = useState<Message | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<Record<string, string[]>>({});
  const places = useRef(new Map<string, number>());
  const [flash, setFlash] = useState<string | null>(null);
  const input = useRef<TextInput>(null);
  const toggle = (messageId: string, emoji: string) => {
    haptic('select');
    setMine((r) => {
      const list = r[messageId] ?? [];
      return { ...r, [messageId]: list.includes(emoji) ? list.filter((e) => e !== emoji) : [...list, emoji] };
    });
  };
  const goTo = (target: string) => {
    const y = places.current.get(target);
    if (y === undefined) return;
    haptic('select');
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    setFlash(target);
    later(() => setFlash((f) => (f === target ? null : f)), 1400);
  };

  const conversationId = conversation?.id;
  useEffect(() => {
    if (conversationId) markRead(conversationId);
  }, [conversationId, markRead]);

  if (!conversation) return <NotFound title="This conversation is not available" />;
  const messages = allMessages(conversation, sent);
  const localUniverse = localChatUniverse(conversation);
  const person = conversation.kind === 'direct' ? findPerson(conversation.personIds[0]) : undefined;
  // A community chat: its first member stands for its creator (the demonstration has no roles of its own).
  const community = conversation.kind === 'community' && conversation.refId ? findCommunity(conversation.refId) : undefined;
  const demoRole = (from: string): CommunityRole | undefined => (community && community.memberIds[0] === from ? 'owner' : undefined);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const nameOf = (m: Message) => (m.from === 'me' ? tx('You') : senderName(m.from));

  const send = () => {
    const body = text.trim();
    if (!body) return;
    haptic('tap');
    sendMessage(conversation.id, body);
    const answer = replying?.id;
    if (answer) {
      const last = useStore.getState().sent[conversation.id]?.at(-1);
      if (last) setReplies((r) => ({ ...r, [last.id]: answer }));
    }
    setReplying(null);
    setText('');
    later(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    const replier = conversation.personIds[0];
    if (replier && findPerson(replier)) {
      later(() => setTyping(true), 700);
      later(() => {
        setTyping(false);
        receiveMessage(conversation.id, replier, cannedReply(messages.length));
        haptic('select');
        later(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      }, 2300);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient variant="quiet" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'} keyboardVerticalOffset={keyboardOffset}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24, paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.intro}>
            {person ? <Avatar name={person.name} hue={person.hue} size={64} verified={person.verified} photo={person.photo} /> : null}
            <Text variant="titleM" align="center">
              {conversation.title}
            </Text>
            <Text variant="caption" tone="tertiary" align="center">
              {person ? tx('{headline} · met on IRLY', { headline: tx(person.headline) }) : tx('Community chat · messages stay in the community')}
            </Text>
          </View>
          {messages.map((m, i) => {
            // IRLY's own notes (match intro, conversation starters) sit in the middle.
            if (m.from === 'irly') {
              return (
                <Animated.View key={m.id} entering={FadeInDown.springify(380).dampingRatio(0.8)} style={styles.note}>
                    <GlassLayer radius={16} level="thin" />
                  <Text variant="bodyS" tone="secondary" align="center">
                    {m.text}
                  </Text>
                </Animated.View>
              );
            }
            const own = m.from === 'me';
            const showName = !own && conversation.kind !== 'direct' && messages[i - 1]?.from !== m.from;
            const quoted = replies[m.id] ? byId.get(replies[m.id]) : undefined;
            const picked = mine[m.id] ?? [];
            const chips: ReactionChip[] = picked.map((emoji) => ({ emoji, count: 1, mine: true }));
            const open = () => {
              haptic('select');
              setMenu(m);
            };
            return (
              <Animated.View
                key={m.id}
                onLayout={(e) => places.current.set(m.id, e.nativeEvent.layout.y)}
                entering={FadeInDown.springify(380).dampingRatio(0.8)}
                style={[styles.bubbleRow, own ? styles.right : styles.left]}
              >
                {showName ? (
                  <View style={[styles.nameRow, { marginLeft: 12 }]}>
                    <Text variant="caption" tone="tertiary">
                      {senderName(m.from)}
                    </Text>
                    <RoleBadge role={demoRole(m.from)} />
                  </View>
                ) : null}
                <ContextMenuArea onMenu={open}>
                  <PressableScale
                    haptic={false}
                    scaleTo={0.98}
                    onLongPress={open}
                    delayLongPress={350}
                    accessibilityHint={tx('Long press for reactions and more')}
                    style={[
                      styles.bubble,
                      own
                        ? { backgroundColor: t.c.brand, borderBottomRightRadius: 6 }
                        : { borderBottomLeftRadius: 6, overflow: 'hidden' },
                      flash === m.id ? { borderWidth: 2, borderColor: t.c.steel } : null,
                    ]}
                  >
                    {own ? null : <GlassLayer radius={20} />}
                    {quoted ? <QuoteInBubble name={nameOf(quoted)} text={quoted.text} mine={own} onPress={() => goTo(quoted.id)} /> : null}
                    {own || RICH.test(m.text) ? (
                      <RichText text={m.text} color={own ? t.c.onBrand : t.c.text} onBrand={own} />
                    ) : (
                      <Text variant="body" color={t.c.text}>
                        {m.text}
                      </Text>
                    )}
                  </PressableScale>
                </ContextMenuArea>
                <ReactionChips chips={chips} mine={own} onToggle={(emoji) => toggle(m.id, emoji)} />
              </Animated.View>
            );
          })}
          {typing ? <Typing /> : null}
        </ScrollView>

        {replying ? <ReplyBar name={nameOf(replying)} text={replying.text} onClose={() => setReplying(null)} /> : null}
        <Glass lifted level="thick" style={[styles.composer, { paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 12) }]} intensity={60}>
          <View style={styles.inputWrap}>
            <GlassLayer radius={radius.pill} level="thin" />
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              placeholder={tx('Message')}
              placeholderTextColor={t.c.textTertiary}
              style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
              onSubmitEditing={send}
              returnKeyType="send"
              submitBehavior="submit"
              blurOnSubmit={false}
              accessibilityLabel={a11y('Message')}
            />
          </View>
          <SendButton ready={Boolean(text.trim())} onPress={send} />
        </Glass>
      </KeyboardAvoidingView>

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={styles.headerRow}>
          <HeaderBack />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={styles.titleRow}>
              <Text variant="titleS" numberOfLines={1} style={{ flexShrink: 1 }}>
                {conversation.title}
              </Text>
              {localUniverse ? <UniverseBadge universe={localUniverse} /> : null}
            </View>
            <Text variant="caption" tone={person?.online ? 'positive' : 'tertiary'}>
              {person ? (person.online ? 'Active now' : 'Usually replies within a day') : 'Community'}
            </Text>
          </View>
          {person ? (
            <PressableScale onPress={() => router.push(`/person/${person.id}`)} accessibilityLabel={tx('Open {name}’s profile', { name: person.name })}>
              <Avatar name={person.name} hue={person.hue} size={40} photo={person.photo} />
            </PressableScale>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>
      <MessageMenu
        visible={menu !== null}
        onClose={() => setMenu(null)}
        subtitle={menu ? (menu.from === 'me' ? tx('Your message') : senderName(menu.from)) : undefined}
        preview={menu?.text}
        reactions
        picked={menu ? mine[menu.id] : undefined}
        onReact={(emoji) => {
          if (menu) toggle(menu.id, emoji);
          setMenu(null);
        }}
      >
        <Button
          label="Reply"
          icon="message"
          full
          onPress={() => {
            setReplying(menu);
            setMenu(null);
            later(() => input.current?.focus(), 250);
          }}
        />
        {menu?.from === 'me' && community ? (
          <Button
            label="Turn into an activity"
            icon="calendar"
            variant="secondary"
            full
            onPress={() => {
              const m = menu;
              setMenu(null);
              openActivityFromMessage(m.text, { id: community.id, name: community.name, cityId: community.cityId });
            }}
          />
        ) : null}
      </MessageMenu>
    </View>
  );
}

/**
 * Send: the button grows ready as soon as there is something to say, and
 * on send the paper plane flies off and lands back, while the message
 * slides into the thread. Reduced motion keeps only the state change.
 */
function SendButton({ ready, onPress }: { ready: boolean; onPress: () => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const scale = useSharedValue(ready ? 1 : 0.6);
  const fly = useSharedValue(0);
  useEffect(() => {
    scale.set(reduced ? (ready ? 1 : 0.6) : withSpring(ready ? 1 : 0.6, spring.bouncy));
  }, [ready, reduced, scale]);
  const body = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: 0.4 + (scale.value - 0.6) * 1.5 }));
  // Out to the top right (0 → 1), then in again from the bottom left (-1 → 0).
  const plane = useAnimatedStyle(() => ({ opacity: 1 - Math.abs(fly.value), transform: [{ translateX: fly.value * 16 }, { translateY: -fly.value * 16 }] }));
  const press = () => {
    if (ready && !reduced) fly.set(withSequence(withTiming(1, { duration: 170 }), withTiming(-1, { duration: 0 }), withSpring(0, spring.bouncy)));
    onPress();
  };
  return (
    <Animated.View style={body}>
      <PressableScale haptic={false} onPress={press} scaleTo={0.85} style={[styles.send, { backgroundColor: t.c.brand, overflow: 'hidden' }]} accessibilityLabel="Send">
        <Animated.View style={plane}>
          <Icon name="send" size={18} color={t.c.onBrand} strokeWidth={2.3} />
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

function Typing() {
  return (
    <View style={[styles.bubbleRow, styles.left]}>
      <Animated.View entering={enter.pop(0)} style={[styles.bubble, styles.typing]}>
        <GlassLayer radius={20} />
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 140} />
        ))}
      </Animated.View>
    </View>
  );
}

function Dot({ delay }: { delay: number }) {
  const t = useTheme();
  const y = useSharedValue(0);
  useEffect(() => {
    y.set(withDelay(delay, withRepeat(withSequence(withTiming(-4, { duration: 260 }), withTiming(0, { duration: 260 })), -1)));
  }, [delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: t.c.textTertiary }, style]} />;
}

const styles = StyleSheet.create({
  hello: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 14, height: 32, borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  chatPhoto: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  shared: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earlier: { alignSelf: 'center', height: 36, paddingHorizontal: 16, borderRadius: radius.pill, justifyContent: 'center', marginBottom: 8, overflow: 'hidden' },
  root: { flex: 1 },
  intro: { alignItems: 'center', gap: 6, marginBottom: space[6] },
  attach: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewPhoto: { width: 200, height: 240, borderRadius: radius.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rename: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
  photoBubble: { width: 220, height: 260, borderRadius: 18, overflow: 'hidden' },
  photoSending: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { maxWidth: '80%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  note: { alignSelf: 'center', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, overflow: 'hidden' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 14, overflow: 'hidden' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingTop: 10 },
  inputWrap: { flex: 1, height: 46, borderRadius: radius.pill, paddingHorizontal: 18, justifyContent: 'center', overflow: 'hidden' },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, height: layout.headerHeight },
  banner: { paddingHorizontal: space.gutter, paddingTop: 4 },
});
