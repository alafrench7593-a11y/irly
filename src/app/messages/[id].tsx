import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotFound } from '@/components/layout/NotFound';
import { dateLocale, t as tx, a11y } from '@/i18n';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
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
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { findPerson } from '@/data/repo';
import { toast } from '@/components/ui/Toast';
import { isServerId, useServerThread } from '@/features/server/chat';
import { leaveGroup, renameGroup } from '@/features/server/groups';
import { sharedHref } from '@/features/server/engage';
import { useAccount } from '@/features/auth/account';
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

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Server conversations (signed in) have UUIDs; the rest live on the device.
  return isServerId(id) ? <ServerThreadView id={id} /> : <Thread />;
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
  const [text, setText] = useState(typeof draft === 'string' ? draft.slice(0, 600) : '');
  const [earlier, setEarlier] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [reportName, setReportName] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  // Keep the view at the bottom, except right after loading older messages.
  const stick = useRef(true);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    haptic('tap');
    setText('');
    stick.current = true;
    // Shown at once as "sending"; a failure stays in the thread with "Retry".
    try {
      await thread.send(body);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live');
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
  const sendPreview = async () => {
    const uris = preview;
    setPreview([]);
    stick.current = true;
    haptic('tap');
    try {
      await thread.sendPhotos(uris);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Photo not sent', 'x', 'live');
    }
  };
  const [info, setInfo] = useState(false);
  const faces = useSignedLinks('profile-photos', Object.values(thread.members).map((m) => m.photo));
  const media = useSignedLinks(
    'chat-media',
    thread.messages.map((m) => m.media?.path),
  );
  const retry = (id: string) => {
    haptic('tap');
    thread.retry(id).catch((e) => toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live'));
  };

  const onLong = (m: (typeof thread.messages)[number]) => {
    if (m.from === 'irly') return;
    haptic('select');
    if (m.from === 'me') {
      confirm('Delete this message for everyone?', () => thread.remove(m.id).catch((e) => toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live')));
    } else {
      setReportName(m.name);
      setReporting({ kind: 'message', id: m.id, userId: m.senderId });
    }
  };

  const group = thread.kind !== null && thread.kind !== 'direct' && thread.kind !== 'match';
  const other = thread.otherId;
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24, paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
          onContentSizeChange={() => {
            if (stick.current) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
            stick.current = contentOffset.y + layoutMeasurement.height > contentSize.height - 120;
          }}
          scrollEventThrottle={64}
          showsVerticalScrollIndicator={false}
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
              style={[styles.earlier, { borderColor: t.c.line }]}
              accessibilityRole="button"
            >
              {earlier ? <ActivityIndicator color={t.c.text} /> : <Text variant="label">Load earlier messages</Text>}
            </PressableScale>
          ) : null}
          {!thread.loading && !thread.error && !thread.messages.length ? (
            <Text variant="bodyS" tone="secondary" align="center" style={{ marginTop: space[6] }}>
              Say hello 👋 Messages appear here for both of you.
            </Text>
          ) : null}
          {thread.messages.map((m, i) => {
            const prev = thread.messages[i - 1];
            const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
            const next = thread.messages[i + 1];
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
                    <Text variant="bodyS" tone="secondary" align="center">
                      {m.text}
                    </Text>
                    {joined && recent ? (
                      <PressableScale
                        haptic="select"
                        onPress={() => setText(tx('Welcome {name}! 👋', { name: joined }))}
                        style={[styles.hello, { borderColor: t.c.line }]}
                        accessibilityLabel={tx('Say hello to {name}', { name: joined })}
                      >
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
            const sender = m.senderId ? thread.members[m.senderId] : undefined;
            const openSender = m.senderId ? () => router.push(`/person/${m.senderId}`) : undefined;
            const photoUri = m.media ? (m.media.path ? media[m.media.path] : null) ?? m.media.local : null;
            return (
              <View key={m.id}>
                {day}
                <Animated.View entering={FadeInDown.springify(380).dampingRatio(0.8)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
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
                          <Avatar name={m.name ?? '?'} hue={hueOf(m.senderId ?? m.id)} size={30} photo={sender?.photo ? faces[sender.photo] : undefined} />
                        </PressableScale>
                      ) : (
                        <View style={{ width: 30 }} />
                      )
                    ) : null}
                    {m.media ? (
                      <PressableScale haptic={false} onLongPress={() => onLong(m)} delayLongPress={350} accessibilityHint={mine ? tx('Long press to delete') : tx('Long press to report')}>
                        {photoUri ? (
                          <TapPhoto photo={{ uri: photoUri }} style={[styles.photoBubble, { opacity: m.status === 'sending' ? 0.6 : 1 }]}>
                            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={180} accessibilityLabel={tx('Photo')} />
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
                        : { backgroundColor: t.c.surface, borderColor: t.c.line, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomLeftRadius: 6 },
                    ]}
                  >
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
                    <PressableScale haptic={false} onPress={() => retry(m.id)} accessibilityRole="button" accessibilityLabel={tx('Not sent. Retry')} style={{ alignSelf: 'flex-end', marginTop: 2, marginRight: 6 }}>
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
          {thread.typing.length ? (
            <View style={{ gap: 2 }}>
              <Typing />
              <Text variant="caption" tone="tertiary" style={{ marginLeft: 6 }}>
                {thread.typing.length === 1 ? tx('{name} is typing…', { name: thread.typing[0] }) : tx('Several people are typing…')}
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <Glass style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
          <PressableScale haptic="select" onPress={() => setAttach(true)} scaleTo={0.88} style={[styles.attach, { backgroundColor: t.c.surface, borderColor: t.c.line }]} accessibilityLabel="Send a photo">
            <Icon name="image" size={19} color={t.c.text} />
          </PressableScale>
          <View style={[styles.inputWrap, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
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
              maxLength={4000}
              accessibilityLabel={a11y('Message')}
            />
          </View>
          <PressableScale haptic={false} onPress={send} scaleTo={0.85} style={[styles.send, { backgroundColor: t.c.brand, opacity: text.trim() ? 1 : 0.4 }]} accessibilityLabel="Send">
            <Icon name="send" size={18} color={t.c.onBrand} strokeWidth={2.3} />
          </PressableScale>
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
              <Avatar name={thread.title} hue={hueOf(other)} size={36} photo={thread.members[other]?.photo ? faces[thread.members[other].photo!] : undefined} />
            ) : chatPhoto.hasPhoto ? (
              <Photo visual={{ photo: chatPhoto.fallback, uri: chatPhotoUri ?? undefined }} light="dubai" style={styles.chatPhoto} width={120} recyclingKey={`chat-${id}-${chatPhoto.path ?? 'app'}`} />
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
              onPress={() =>
                confirm(
                  tx('Block {name}? You will no longer see each other, and this chat closes.', { name: thread.title }),
                  () =>
                    blockUser(other)
                      .then(() => {
                        setMenu(false);
                        toast(tx('{name} is blocked', { name: thread.title }), 'shield', 'brand');
                        if (router.canGoBack()) router.back();
                        else router.replace('/messages');
                      })
                      .catch((e) => toast(e instanceof Error ? e.message : 'Could not block', 'x', 'live')),
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
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
        faces={faces}
        communityId={thread.communityId}
        activityId={thread.activityId}
        canEditPhoto={chatPhoto.canEdit}
        onEditPhoto={() => {
          setInfo(false);
          setPhotoMenu(true);
        }}
      />
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

/** About a group, community or activity chat: its page, its members (tap for a profile), and for groups rename and leave. */
function ChatInfo({
  visible,
  onClose,
  id,
  title,
  kind,
  members,
  faces,
  communityId,
  activityId,
  canEditPhoto,
  onEditPhoto,
}: {
  visible: boolean;
  onClose: () => void;
  id: string;
  title: string;
  kind: string | null;
  members: Record<string, { name: string; photo: string | null; admin: boolean }>;
  faces: Record<string, string>;
  communityId: string | null;
  activityId: string | null;
  canEditPhoto: boolean;
  onEditPhoto: () => void;
}) {
  const t = useTheme();
  const router = useRouter();
  const me = useAccount()?.userId;
  const [name, setName] = useState(title);
  const [busy, setBusy] = useState(false);
  const list = Object.entries(members);
  const isAdmin = Boolean(me && members[me]?.admin);
  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title} subtitle={tx('{n} members', { n: list.length })}>
      <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
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
        <Text variant="overline" tone="tertiary" style={{ marginTop: space[3] }}>
          Members
        </Text>
        {list.map(([uid, m]) => (
          <PressableScale key={uid} haptic="select" scaleTo={0.98} onPress={() => go(`/person/${uid}`)} style={styles.memberRow} accessibilityLabel={tx('Open {name}’s profile', { name: m.name })}>
            <Avatar name={m.name} hue={hueOf(uid)} size={40} photo={m.photo ? faces[m.photo] : undefined} />
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
            onPress={() =>
              confirm(tx('Leave {title}? You will no longer receive its messages.', { title }), () =>
                leaveGroup(id)
                  .then(() => {
                    onClose();
                    toast('You left the group', 'check', 'brand');
                    router.replace('/messages');
                  })
                  .catch((e) => toast(e instanceof Error ? e.message : 'Could not leave', 'x', 'live')),
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
  const sendScale = useSharedValue(0.6);

  const conversationId = conversation?.id;
  useEffect(() => {
    if (conversationId) markRead(conversationId);
  }, [conversationId, markRead]);

  useEffect(() => {
    sendScale.set(withSpring(text.trim() ? 1 : 0.6, spring.bouncy));
  }, [text, sendScale]);

  const sendStyle = useAnimatedStyle(() => ({ transform: [{ scale: sendScale.value }], opacity: 0.4 + sendScale.value * 0.6 }));

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24, paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
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
                      : { backgroundColor: t.c.surface, borderColor: t.c.line, borderWidth: StyleSheet.hairlineWidth * 2, borderBottomLeftRadius: 6 },
                  ]}
                >
                  <Text variant="body" raw={mine} color={mine ? t.c.onBrand : t.c.text}>
                    {m.text}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
          {typing ? <Typing /> : null}
        </ScrollView>

        <Glass style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
          <View style={[styles.inputWrap, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={tx('Message')}
              placeholderTextColor={t.c.textTertiary}
              style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
              onSubmitEditing={send}
              returnKeyType="send"
              accessibilityLabel={a11y('Message')}
            />
          </View>
          <Animated.View style={sendStyle}>
            <PressableScale haptic={false} onPress={send} scaleTo={0.85} style={[styles.send, { backgroundColor: t.c.brand }]} accessibilityLabel="Send">
              <Icon name="send" size={18} color={t.c.onBrand} strokeWidth={2.3} />
            </PressableScale>
          </Animated.View>
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

function Typing() {
  const t = useTheme();
  return (
    <View style={[styles.bubbleRow, styles.left]}>
      <View style={[styles.bubble, styles.typing, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 140} />
        ))}
      </View>
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
  hello: { alignSelf: 'center', marginTop: 6, paddingHorizontal: 14, height: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center' },
  chatPhoto: { width: 36, height: 36, borderRadius: 18, overflow: 'hidden' },
  shared: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earlier: { alignSelf: 'center', height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center', marginBottom: 8 },
  root: { flex: 1 },
  intro: { alignItems: 'center', gap: 6, marginBottom: space[6] },
  attach: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  previewPhoto: { width: 200, height: 240, borderRadius: radius.lg },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rename: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 12, fontFamily: font.medium, fontSize: 15 },
  photoBubble: { width: 220, height: 260, borderRadius: 18, overflow: 'hidden' },
  photoSending: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  bubbleRow: { maxWidth: '80%' },
  note: { alignSelf: 'center', maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(200,100,122,0.08)' },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  typing: { flexDirection: 'row', gap: 5, paddingVertical: 14, borderWidth: StyleSheet.hairlineWidth * 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, paddingTop: 10 },
  inputWrap: { flex: 1, height: 46, borderRadius: radius.pill, paddingHorizontal: 18, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.gutter, height: layout.headerHeight },
});
