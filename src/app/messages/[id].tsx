import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotFound } from '@/components/layout/NotFound';
import { dateLocale, t as tx, a11y } from '@/i18n';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { blockUser, type ReportTarget } from '@/features/moderation/moderation';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { confirm } from '@/lib/confirm';
import { Glass } from '@/components/ui/Glass';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { useKeyboardHeight } from '@/motion/keyboard';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findPerson } from '@/data/repo';
import { toast } from '@/components/ui/Toast';
import { chatDraft, isServerId, removeConversationForMe, setConversationArchived, useServerThread } from '@/features/server/chat';
import { leaveGroup, renameGroup } from '@/features/server/groups';
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
import { allMessages, cannedReply, resolveConversation, senderName } from '@/features/messages/conversations';
import { haptic } from '@/motion/haptics';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useCityId, useStore } from '@/state/store';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SpaceFlavor } from '@/theme/space';
import { useBusy } from '@/lib/useBusy';

// Opened from IRLY Girl, the chat wears the Girl look (cosmetic only, see theme/space).
export default function ThreadRoute() {
  return (
    <SpaceFlavor>
      <ThreadScreen />
    </SpaceFlavor>
  );
}

function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const status = useAuthStatus();
  // Server conversations (signed in) have UUIDs; the rest live on the device.
  if (isServerId(id) && status === 'out') return <SignedOut />;
  return isServerId(id) ? <ServerThreadView id={id} /> : <Thread />;
}

/** A chat link opened while signed out: say so instead of loading forever. */
function SignedOut() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: t.c.bg }}>
      <Text variant="titleM" align="center">
        Sign in to see this conversation
      </Text>
      <Button label="Sign in" onPress={() => router.push('/account')} />
      <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </View>
  );
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

/** A live conversation from the IRLY server: realtime in, optimistic out. */
function ServerThreadView({ id }: { id: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const thread = useServerThread(id);
  const now = useNow();
  // A first message prepared elsewhere (Introduce myself): editable, never sent by itself.
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const chatPhoto = useChatPhoto(id);
  const chatPhotoUri = usePhotoLink(chatPhoto.path);
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

  // One send at a time: a double tap must not post the same message twice.
  const sending = useRef(false);
  const send = async () => {
    const body = text.trim();
    if (!body || sending.current) return;
    sending.current = true;
    haptic('tap');
    setText('');
    stick.current = true;
    // Shown at once as "sending"; a failure stays in the thread with "Retry".
    try {
      await thread.send(body);
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
    thread.messages.map((m) => m.media?.path),
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

  // Activities referenced here (shares, and this chat's own activity): read live, never from the message text.
  const activityCards = useActivityCards([...thread.messages.map((m) => (m.share?.type === 'activity' ? m.share.id : null)), thread.kind === 'activity' ? thread.activityId : null]);
  const ownActivity = thread.kind === 'activity' && thread.activityId ? activityCards.get(thread.activityId) : undefined;
  const BANNER = 52;
  const group = thread.kind !== null && thread.kind !== 'direct' && thread.kind !== 'match';
  const other = thread.otherId;
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient variant="quiet" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24 + (ownActivity ? BANNER : 0), paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
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
          }}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {thread.loading ? <ActivityIndicator color={t.c.text} /> : null}
          {thread.error ? (
            <Text variant="body" tone="secondary" align="center">
              {thread.error}
            </Text>
          ) : null}
          {thread.hasEarlier ? (
            <PressableScale
              haptic="select"
              onPress={async () => {
                if (earlier) return;
                setEarlier(true);
                stick.current = false;
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
            messages={thread.messages}
            media={media}
            group={group}
            now={now}
            openedAt={openedAt}
            onLong={onLong}
            onRetry={retry}
            onHello={setText}
            cardOf={activityCards.get}
            cardsFailed={activityCards.failed}
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
        <Glass lifted level="thick" style={[styles.composer, { paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 12) }]} intensity={60}>
          <PressableScale haptic="select" onPress={() => setAttach(true)} scaleTo={0.88} style={styles.attach} accessibilityLabel="Send a photo">
            <GlassLayer radius={21} level="thin" />
            <Icon name="image" size={19} color={t.c.text} />
          </PressableScale>
          <View style={styles.inputWrap}>
            <GlassLayer radius={radius.pill} level="thin" />
            <TextInput
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
          <IconButton icon="chevronLeft" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
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
              <Text variant="titleS" numberOfLines={1} raw>
                {thread.title}
              </Text>
              <Text variant="caption" tone="tertiary">
                {thread.kind === null
                  ? ''
                  : other
                    ? tx('Private · see profile')
                    : thread.kind === 'community'
                      ? tx('Community · {n} members', { n: Object.keys(thread.members).length })
                      : thread.kind === 'activity'
                        ? tx('Activity · {n} going', { n: Object.keys(thread.members).length })
                        : tx('Group · {n} members', { n: Object.keys(thread.members).length })}
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
                          if (router.canGoBack()) router.back();
                          else router.replace('/messages');
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
        kind={thread.kind}
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
      <Sheet visible={msgMenu !== null} onClose={() => setMsgMenu(null)} title="Message" subtitle={msgMenu?.from === 'me' ? tx('Your message') : msgMenu?.name}>
        <View style={{ paddingHorizontal: space.gutter, gap: 10 }}>
          <Button
            label="Delete for me"
            icon="eye"
            variant="secondary"
            full
            loading={msgBusy}
            onPress={() => msgMenu && runOnMessage(() => thread.hideForMe(msgMenu.id), tx('Deleted for you'))}
          />
          {msgMenu?.from === 'me' ? (
            <Button
              label="Delete for everyone"
              icon="x"
              variant="danger"
              full
              disabled={msgBusy}
              onPress={() => {
                const m = msgMenu;
                confirm('Delete this message for everyone? It cannot be undone.', () => runOnMessage(() => thread.remove(m.id), tx('Deleted for everyone')), 'Delete');
              }}
            />
          ) : msgMenu ? (
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
          ) : null}
        </View>
      </Sheet>
      <ReportSheet target={reporting} name={reportName} onClose={() => setReporting(null)} onBlocked={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} />
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
        const recent = now - m.at < 3 * 86_400_000;
        return (
          <View key={m.id}>
            {day}
            <Animated.View entering={joined ? FadeInDown.springify(420).dampingRatio(0.8) : undefined} style={styles.note}>
              <GlassLayer radius={16} level="thin" />
              <Text variant="bodyS" tone="secondary" align="center">
                {m.text}
              </Text>
              {joined && recent ? (
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
      return (
        <View key={m.id}>
          {day}
          <Animated.View entering={slideIn(m.at)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
            {showName ? (
              <PressableScale haptic="select" onPress={openSender} hitSlop={6} accessibilityLabel={tx('Open {name}’s profile', { name: m.name ?? tx('Member') })} style={{ marginLeft: group ? 46 : 12, marginBottom: 2 }}>
                <Text variant="caption" tone="tertiary" raw>
                  {m.name ?? tx('Member')}
                </Text>
              </PressableScale>
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
              {m.media ? (
                <PressableScale haptic={false} onLongPress={() => onLong(m)} delayLongPress={350} accessibilityHint={mine ? tx('Long press to delete') : tx('Long press to report')}>
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
                  onLongPress={() => onLong(m)}
                />
              ) : (
            <PressableScale
              haptic={false}
              scaleTo={0.98}
              onLongPress={() => onLong(m)}
              delayLongPress={350}
              onPress={
                m.share
                  ? () => {
                      const sh = m.share;
                      if (sh) sharedHref(sh.type, sh.id, m.text).then((href) => router.push(href as never));
                    }
                  : undefined
              }
              accessibilityHint={mine ? tx('Long press to delete') : tx('Long press to report')}
              style={[
                styles.bubble,
                mine
                  ? { backgroundColor: t.c.brand, borderBottomRightRadius: 6 }
                  : { borderBottomLeftRadius: 6, overflow: 'hidden' },
              ]}
            >
              {mine ? null : <GlassLayer radius={20} />}
              {m.share ? (
                <View style={styles.shared}>
                  <Icon name={m.share.type === 'activity' ? 'calendar' : m.share.type === 'place' ? 'pin' : 'link'} size={16} color={mine ? t.c.onBrand : t.c.text} />
                  <Text variant="titleS" raw color={mine ? t.c.onBrand : t.c.text} numberOfLines={2} style={{ flexShrink: 1 }}>
                    {m.text}
                  </Text>
                  <Icon name="chevronRight" size={16} color={mine ? t.c.onBrand : t.c.text} />
                </View>
              ) : (
                <Text variant="body" raw color={mine ? t.c.onBrand : t.c.text} selectable>
                  {m.text}
                </Text>
              )}
            </PressableScale>
              )}
            </View>
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
  const router = useRouter();
  const [busy, setBusy] = useState<'archive' | 'delete' | null>(null);
  // What I just chose wins over the screen's last load until it reloads.
  const [chosen, setIsArchived] = useState<boolean | null>(null);
  const isArchived = chosen ?? archived;
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/messages'));
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

/** About a group, community or activity chat: its page, its members (tap for a profile), and for groups rename and leave. */
function ChatInfo({
  visible,
  onClose,
  id,
  title,
  kind,
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
  kind: string | null;
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
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  // Leave waits for the server: a second tap left again (an error toast) and replaced the page twice.
  const leaving = useBusy<'leave'>();
  const list = Object.entries(members);
  const isAdmin = Boolean(me && members[me]?.admin);
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
        {kind === 'group' && isAdmin ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={name} onChangeText={setName} maxLength={60} style={[styles.rename, { color: t.c.text, borderColor: t.c.line, backgroundColor: t.c.surface }]} accessibilityLabel={a11y('Group name')} />
            <Button
              label="Rename"
              size="sm"
              loading={busy}
              onPress={async () => {
                if (!name.trim() || name.trim() === title) return;
                setBusy(true);
                try {
                  await renameGroup(id, name.trim());
                  haptic('success');
                  toast('Group renamed', 'check', 'brand');
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not rename', 'x', 'live');
                } finally {
                  setBusy(false);
                }
              }}
            />
          </View>
        ) : null}
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
        {kind === 'group' ? (
          <Button
            label="Leave the group"
            icon="x"
            variant="danger"
            full
            loading={leaving.busy === 'leave'}
            onPress={() =>
              leaving.isRunning() ||
              confirm(tx('Leave {title}? You will no longer receive its messages.', { title }), () =>
                void leaving.run('leave', () =>
                  leaveGroup(id)
                    .then(() => {
                      onClose();
                      toast('You left the group', 'check', 'brand');
                      router.replace('/messages');
                    })
                    .catch((e) => toast(e instanceof Error ? e.message : 'Could not leave', 'x', 'live')),
                ),
              )
            }
          />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

function Thread() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const conversationId = conversation?.id;
  useEffect(() => {
    if (conversationId) markRead(conversationId);
  }, [conversationId, markRead]);

  if (!conversation) return <NotFound title="This conversation is not available" />;
  const messages = allMessages(conversation, sent);
  const person = conversation.kind === 'direct' ? findPerson(conversation.personIds[0]) : undefined;

  const send = () => {
    const body = text.trim();
    if (!body) return;
    haptic('tap');
    sendMessage(conversation.id, body);
    setText('');
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    const replier = conversation.personIds[0];
    if (replier && findPerson(replier)) {
      setTimeout(() => setTyping(true), 700);
      setTimeout(() => {
        setTyping(false);
        receiveMessage(conversation.id, replier, cannedReply(messages.length));
        haptic('select');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
      }, 2300);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient variant="quiet" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
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
              {person ? tx('{headline} · met on IRLY', { headline: tx(person.headline) }) : tx('{n} members · messages stay in the group', { n: conversation.personIds.length + 1 })}
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
            const mine = m.from === 'me';
            const showName = !mine && conversation.kind !== 'direct' && messages[i - 1]?.from !== m.from;
            return (
              <Animated.View key={m.id} entering={FadeInDown.springify(380).dampingRatio(0.8)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
                {showName ? (
                  <Text variant="caption" tone="tertiary" style={{ marginLeft: 12, marginBottom: 2 }}>
                    {senderName(m.from)}
                  </Text>
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: t.c.brand, borderBottomRightRadius: 6 }
                      : { borderBottomLeftRadius: 6, overflow: 'hidden' },
                  ]}
                >
                  {mine ? null : <GlassLayer radius={20} />}
                  <Text variant="body" raw={mine} color={mine ? t.c.onBrand : t.c.text}>
                    {m.text}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
          {typing ? <Typing /> : null}
        </ScrollView>

        <Glass lifted level="thick" style={[styles.composer, { paddingBottom: keyboard ? 12 : Math.max(insets.bottom, 12) }]} intensity={60}>
          <View style={styles.inputWrap}>
            <GlassLayer radius={radius.pill} level="thin" />
            <TextInput
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
          <IconButton icon="chevronLeft" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleS" numberOfLines={1}>
              {conversation.title}
            </Text>
            <Text variant="caption" tone={person?.online ? 'positive' : 'tertiary'}>
              {person ? (person.online ? 'Active now' : 'Usually replies within a day') : 'Group'}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, height: layout.headerHeight },
  banner: { paddingHorizontal: space.gutter, paddingTop: 4 },
});
