import { useLocalSearchParams, useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
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

/** A live conversation from the IRLY server: realtime in, optimistic out. */
function ServerThreadView({ id }: { id: string }) {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const thread = useServerThread(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    haptic('tap');
    setSending(true);
    setText('');
    try {
      await thread.send(body);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (e) {
      setText(body);
      toast(e instanceof Error ? e.message : 'Message not sent', 'x', 'live');
    } finally {
      setSending(false);
    }
  };

  const group = thread.kind !== 'direct' && thread.kind !== 'match';
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 24, paddingBottom: 24, paddingHorizontal: space.gutter, gap: 8 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          showsVerticalScrollIndicator={false}
        >
          {thread.loading ? <ActivityIndicator color={t.c.text} /> : null}
          {thread.error ? (
            <Text variant="body" tone="secondary" align="center">
              {thread.error}
            </Text>
          ) : null}
          {thread.messages.map((m, i) => {
            if (m.from === 'irly') {
              return (
                <View key={m.id} style={styles.note}>
                  <Text variant="bodyS" tone="secondary" align="center">
                    {m.text}
                  </Text>
                </View>
              );
            }
            const mine = m.from === 'me';
            const showName = !mine && group && thread.messages[i - 1]?.from !== m.from;
            return (
              <Animated.View key={m.id} entering={FadeInDown.springify(380).dampingRatio(0.8)} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
                {showName ? (
                  <Text variant="caption" tone="tertiary" style={{ marginLeft: 12, marginBottom: 2 }}>
                    {m.name ?? 'Member'}
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
                  {m.share ? (
                    <PressableScale
                      haptic="select"
                      onPress={() => {
                        const sh = m.share;
                        if (sh?.id && sh.type === 'activity') router.push(`/a/${sh.id}`);
                        else if (sh?.id && sh.type === 'community') router.push(`/c/${sh.id}`);
                        else if (sh?.type === 'irl_post') router.push('/live');
                        else router.push(`/search?q=${encodeURIComponent(m.text)}`);
                      }}
                      style={styles.shared}
                      accessibilityLabel={`Open ${m.text}`}
                    >
                      <Icon name={m.share.type === 'activity' ? 'calendar' : m.share.type === 'place' ? 'pin' : 'link'} size={16} color={mine ? t.c.onBrand : t.c.text} />
                      <Text variant="titleS" raw color={mine ? t.c.onBrand : t.c.text} numberOfLines={2} style={{ flexShrink: 1 }}>
                        {m.text}
                      </Text>
                      <Icon name="chevronRight" size={16} color={mine ? t.c.onBrand : t.c.text} />
                    </PressableScale>
                  ) : (
                    <Text variant="body" raw color={mine ? t.c.onBrand : t.c.text}>
                      {m.text}
                    </Text>
                  )}
                </View>
              </Animated.View>
            );
          })}
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
              maxLength={4000}
              accessibilityLabel="Message"
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
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleS" numberOfLines={1}>
              {thread.title}
            </Text>
            <Text variant="caption" tone="tertiary">
              {group ? 'Group' : 'Private'}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>
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

  if (!conversation) return null;
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
              {person ? `${person.headline} · met on IRLY` : `${conversation.personIds.length + 1} members · messages stay in the group`}
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
                  <Text variant="body" raw color={mine ? t.c.onBrand : t.c.text}>
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
          <IconButton icon="chevronLeft" label="Back" onPress={() => router.back()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="titleS" numberOfLines={1}>
              {conversation.title}
            </Text>
            <Text variant="caption" tone={person?.online ? 'positive' : 'tertiary'}>
              {person ? (person.online ? 'Active now' : 'Replies within the day') : 'Group'}
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
