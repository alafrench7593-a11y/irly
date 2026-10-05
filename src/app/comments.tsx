import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStatus } from '@/features/auth/account';
import { confirm } from '@/lib/confirm';
import { t as tx } from '@/i18n';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { reportItem, toggleLike, useComments, type Comment, type TargetType } from '@/features/server/engage';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Comments on anything (IRL post, event, activity, community post, place).
 * Replies are one level deep; your own comments can be deleted, anyone
 * else's reported. Live: new comments appear without refreshing.
 */
export default function CommentsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type: TargetType; id: string; title?: string }>();
  const target = { type: params.type, id: params.id, title: params.title };
  const { comments, loading, add, remove, refresh, signedIn } = useComments(target);
  const auth = useAuthStatus();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const roots = comments.filter((c) => !c.parentId);
  const replies = (id: string) => comments.filter((c) => c.parentId === id);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await add(text, replyTo?.id ?? null);
      haptic('success');
      setText('');
      setReplyTo(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
    } finally {
      setSending(false);
    }
  };

  const onMore = (c: Comment) => {
    if (c.mine) {
      confirm('Delete this comment?', () =>
        remove(c.id)
          .then(() => toast('Comment deleted', 'check', 'brand'))
          .catch(() => toast('Could not delete the comment', 'x', 'live')),
      );
    } else {
      reportItem({ type: 'comment', id: c.id }, 'inappropriate', c.authorId)
        .then(() => toast('Reported. Our team will review it', 'flag', 'brand'))
        .catch(() => toast('Could not report', 'x', 'live'));
    }
  };

  const onLike = (c: Comment) => {
    toggleLike({ type: 'comment', id: c.id })
      .then(refresh)
      .catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'));
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + layout.headerHeight + 20, paddingBottom: 24, paddingHorizontal: space.gutter, gap: 18 }}
          showsVerticalScrollIndicator={false}
        >
          {params.title ? (
            <Text variant="titleL" numberOfLines={2}>
              {params.title}
            </Text>
          ) : null}
          {auth === 'out' ? (
            <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
              <Text variant="body" tone="secondary" align="center">
                Sign in to read and write comments.
              </Text>
              <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
            </View>
          ) : loading ? (
            <ActivityIndicator color={t.c.text} />
          ) : !roots.length ? (
            <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
              <Icon name="message" size={22} color={t.c.textSecondary} />
              <Text variant="body" tone="secondary" align="center">
                No comments yet. Start the conversation.
              </Text>
            </View>
          ) : (
            roots.map((c) => (
              <View key={c.id} style={{ gap: 12 }}>
                <CommentRow c={c} onReply={() => setReplyTo(c)} onMore={() => onMore(c)} onLike={() => onLike(c)} />
                {replies(c.id).map((r) => (
                  <View key={r.id} style={{ paddingLeft: 44 }}>
                    <CommentRow c={r} onReply={() => setReplyTo(c)} onMore={() => onMore(r)} onLike={() => onLike(r)} />
                  </View>
                ))}
              </View>
            ))
          )}
        </ScrollView>
        {signedIn ? (
          <Glass style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
            {replyTo ? (
              <View style={styles.replying}>
                <Text variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
                  {tx('Replying to {name}', { name: replyTo.firstName })}
                </Text>
                <PressableScale onPress={() => setReplyTo(null)} haptic="select" accessibilityLabel="Cancel reply" hitSlop={8}>
                  <Icon name="x" size={16} color={t.c.textSecondary} />
                </PressableScale>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <View style={[styles.inputWrap, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={tx('Add a comment')}
                  placeholderTextColor={t.c.textTertiary}
                  style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  maxLength={500}
                  accessibilityLabel="Comment"
                />
              </View>
              <PressableScale haptic={false} onPress={send} scaleTo={0.85} style={[styles.send, { backgroundColor: t.c.brand, opacity: text.trim() ? 1 : 0.4 }]} accessibilityLabel="Post comment">
                <Icon name="send" size={18} color={t.c.onBrand} strokeWidth={2.3} />
              </PressableScale>
            </View>
          </Glass>
        ) : null}
      </KeyboardAvoidingView>
      <PageHeader title="Comments" />
    </View>
  );
}

function CommentRow({ c, onReply, onMore, onLike }: { c: Comment; onReply: () => void; onMore: () => void; onLike: () => void }) {
  const t = useTheme();
  const now = useNow();
  return (
    <Animated.View entering={FadeInDown.springify(360).dampingRatio(0.85)} style={styles.row}>
      <Avatar name={c.firstName} hue={hueOf(c.authorId)} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">
          {c.firstName}{' '}
          <Text variant="caption" tone="tertiary">
            {c.id.startsWith('tmp-') ? 'Sending…' : timeAgo(Math.max(0, Math.round((now - c.createdAt) / 60000)))}
          </Text>
        </Text>
        <Text variant="body" raw={!c.deleted} tone={c.deleted ? 'tertiary' : undefined}>
          {c.deleted ? 'Comment deleted' : c.body}
        </Text>
        {!c.deleted ? (
          <View style={styles.meta}>
            <PressableScale onPress={onReply} haptic="select" hitSlop={8} accessibilityLabel="Reply">
              <Text variant="caption" tone="secondary">
                Reply
              </Text>
            </PressableScale>
            <PressableScale onPress={onMore} haptic="select" hitSlop={8} accessibilityLabel={c.mine ? 'Delete' : 'Report'}>
              <Text variant="caption" tone="secondary">
                {c.mine ? 'Delete' : 'Report'}
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {!c.deleted ? (
        <PressableScale onPress={onLike} haptic="select" scaleTo={0.85} hitSlop={8} style={styles.like} accessibilityLabel={c.liked ? 'Unlike' : 'Like'}>
          <Icon name="heart" size={16} color={c.liked ? t.c.live : t.c.textTertiary} fill={c.liked ? t.c.live : undefined} />
          {c.likes ? (
            <Text variant="caption" tone="tertiary">
              {c.likes}
            </Text>
          ) : null}
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', gap: 16, marginTop: 4 },
  like: { alignItems: 'center', gap: 2, paddingTop: 4, minWidth: 28 },
  empty: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl },
  composer: { paddingHorizontal: space.gutter, paddingTop: 10, gap: 8 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  inputWrap: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
