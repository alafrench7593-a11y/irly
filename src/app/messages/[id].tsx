import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotFound } from '@/components/layout/NotFound';
import { dateLocale, t as tx } from '@/i18n';
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
import { allMessages, cannedReply, resolveConversation, senderName } from '@/features/messages/conversations';
import { haptic } from '@/motion/haptics';
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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [earlier, setEarlier] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState<ReportTarget | null>(null);
  const [reportName, setReportName] = useState<string | undefined>();
  const scrollRef = useRef<ScrollView>(null);
  // Keep the view at the bottom, except right after loading older messages.
  const stick = useRef(true);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    haptic('tap');
    setSending(true);
    setText('');
    stick.current = true;
    try {
      await thread.send(body);
    } catch (e) {
      setText(body);
      toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live');
    } finally {
      setSending(false);
    }
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
              return (
                <View key={m.id}>
                  {day}
                  <View style={styles.note}>
                    <Text variant="bodyS" tone="secondary" align="center">
                      {m.text}
                    </Text>
                  </View>
                </View>
              );
            }
            const mine = m.from === 'me';
            const showName = !mine && group && prev?.from !== m.from;
            return (
              <View key={m.id}>
                {day}
                <Animated.View entering={FadeInDown.springify(380).dampingRatio(0.8)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
                  {showName ? (
                    <Text variant="caption" tone="tertiary" style={{ marginLeft: 12, marginBottom: 2 }} raw>
                      {m.name ?? tx('Member')}
                    </Text>
                  ) : null}
                  <PressableScale
                    haptic={false}
                    scaleTo={0.98}
                    onLongPress={() => onLong(m)}
                    delayLongPress={350}
                    onPress={
                      m.share
                        ? () => {
                            const sh = m.share;
                            if (sh?.id && sh.type === 'activity') router.push(`/a/${sh.id}`);
                            else if (sh?.id && sh.type === 'community') router.push(`/c/${sh.id}`);
                            else if (sh?.type === 'irl_post') router.push('/live');
                            else router.push(`/search?q=${encodeURIComponent(m.text)}`);
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
                  {showTime ? (
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
              accessibilityLabel="Message"
            />
          </View>
          <PressableScale haptic={false} onPress={send} scaleTo={0.85} style={[styles.send, { backgroundColor: t.c.brand, opacity: text.trim() ? 1 : 0.4 }]} accessibilityLabel="Send">
            {sending ? <ActivityIndicator color={t.c.onBrand} /> : <Icon name="send" size={18} color={t.c.onBrand} strokeWidth={2.3} />}
          </PressableScale>
        </Glass>
      </KeyboardAvoidingView>
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Glass style={StyleSheet.absoluteFill} border={false} intensity={60} />
        <View style={styles.headerRow}>
          <IconButton icon="chevronLeft" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleS" numberOfLines={1} raw>
              {thread.title}
            </Text>
            <Text variant="caption" tone="tertiary">
              {thread.kind === null ? '' : group ? 'Group' : 'Private'}
            </Text>
          </View>
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
      <ReportSheet target={reporting} name={reportName} onClose={() => setReporting(null)} onBlocked={() => (router.canGoBack() ? router.back() : router.replace('/messages'))} />
    </View>
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
            {person ? <Avatar name={person.name} hue={person.hue} size={64} verified={person.verified} /> : null}
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
              accessibilityLabel="Message"
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
            <PressableScale onPress={() => router.push(`/person/${person.id}`)} accessibilityLabel={`${person.name}'s profile`}>
              <Avatar name={person.name} hue={person.hue} size={40} />
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
  shared: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  earlier: { alignSelf: 'center', height: 36, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth * 2, justifyContent: 'center', marginBottom: 8 },
  root: { flex: 1 },
  intro: { alignItems: 'center', gap: 6, marginBottom: space[6] },
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
