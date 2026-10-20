import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStatus } from '@/features/auth/account';
import { confirm } from '@/lib/confirm';
import { t as tx, a11y } from '@/i18n';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Glass } from '@/components/ui/Glass';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { enter } from '@/motion/enter';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { openReport } from '@/features/moderation/reportStore';
import { toggleLike, useComments, type Comment, type TargetType } from '@/features/server/engage';
import { DEMO } from '@/config/app';
import { demoPhoto, demoToggleLike, useDemoComments } from '@/features/girl/demo';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SpaceFlavor } from '@/theme/space';

// The demonstration build: example threads and your comments in this tab only, never the server.
const useThread = DEMO ? useDemoComments : useComments;
const likeComment = DEMO ? demoToggleLike : toggleLike;
const useAuth = DEMO ? () => 'in' as const : useAuthStatus;

/**
 * Comments on anything (IRL post, event, activity, community post, place).
 * Replies are one level deep; your own comments can be deleted, anyone
 * else's reported. Live: new comments appear without refreshing.
 */
export default function CommentsScreenRoute() {
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <CommentsScreen />
    </SpaceFlavor>
  );
}

function CommentsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ type: TargetType; id: string; title?: string }>();
  const target = { type: params.type, id: params.id, title: params.title };
  const { comments, loading, failed, add, remove, refresh, signedIn } = useThread(target);
  const auth = useAuth();
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
      openReport({ kind: 'comment', id: c.id, userId: c.authorId }, c.firstName);
    }
  };

  // The server toggles: a second tap before the first answer would undo the like.
  const liking = useRef(new Set<string>());
  const onLike = (c: Comment) => {
    if (liking.current.has(c.id)) return;
    liking.current.add(c.id);
    likeComment({ type: 'comment', id: c.id })
      .then(refresh)
      .catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'))
      .finally(() => liking.current.delete(c.id));
  };

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient variant="quiet" />
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
          {auth === 'unknown' || (auth === 'in' && loading) ? (
            // The frame and a line of text right away: on a slow start (the
            // stored session read, then the first thread query) the screen
            // never sits on a bare spinner.
            <View style={styles.loading} accessibilityLabel={tx('Loading')}>
              <ActivityIndicator color={t.c.text} />
              <Text variant="body" tone="secondary">
                Loading comments…
              </Text>
            </View>
          ) : auth === 'out' ? (
            <Animated.View entering={enter.rise(0, 60)} style={[styles.empty, { boxShadow: t.shadow.card }]}>
              <GlassLayer radius={radius.xl} />
              <Text variant="body" tone="secondary" align="center">
                Sign in to read and write comments.
              </Text>
              <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
            </Animated.View>
          ) : failed && !roots.length ? (
            <Animated.View entering={enter.rise(0, 60)} style={[styles.empty, { boxShadow: t.shadow.card }]}>
              <GlassLayer radius={radius.xl} />
              <Text variant="body" tone="secondary" align="center">
                Comments could not be loaded.
              </Text>
              <Button label="Try again" size="sm" onPress={refresh} />
            </Animated.View>
          ) : !roots.length ? (
            <Animated.View entering={enter.rise(0, 60)} style={[styles.empty, { boxShadow: t.shadow.card }]}>
              <GlassLayer radius={radius.xl} />
              <Icon name="message" size={22} color={t.c.textSecondary} />
              <Text variant="body" tone="secondary" align="center">
                No comments yet. Start the conversation.
              </Text>
            </Animated.View>
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
          <Glass lifted level="thick" style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]} intensity={60}>
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
              <View style={styles.inputWrap}>
                <GlassLayer radius={23} level="thin" />
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder={tx('Add a comment')}
                  placeholderTextColor={t.c.textTertiary}
                  style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 16, paddingVertical: 0 }}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  maxLength={500}
                  accessibilityLabel={a11y('Comment')}
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
      <Avatar name={c.firstName} hue={hueOf(c.authorId)} size={32} userId={c.authorId} photo={demoPhoto(c.authorId)} />
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
        {!c.deleted && !c.id.startsWith('tmp-') ? (
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
      {!c.deleted && !c.id.startsWith('tmp-') ? (
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
  empty: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl, overflow: 'hidden' },
  loading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 24 },
  composer: { paddingHorizontal: space.gutter, paddingTop: 10, gap: 8 },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  replying: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  inputWrap: { flex: 1, height: 46, borderRadius: 23, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  send: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
});
