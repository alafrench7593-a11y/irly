import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { LiveVideo } from '@/features/live/LiveVideo';
import { createPost, draftKey, loadPost, MAX_PHOTOS, pickPhotos, pickVideo, updatePost, useDrafts, type DraftMedia } from '@/features/posts/posts';
import { useSignedLinks } from '@/features/server/media';
import { a11y, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Write a publication: words only, photos with words, or a video with words
 * (media is optional). On the member's profile, or in a community when
 * opened from one. Leaving with something written asks first: keep it as a
 * draft (found again next time) or discard it. Also edits one's own post.
 */
export default function NewPost() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const params = useLocalSearchParams<{ community?: string; name?: string; edit?: string; body?: string; kind?: string }>();
  const editing = params.edit ?? null;
  const [communityId, setCommunityId] = useState<string | null>(params.community ?? null);
  const key = draftKey(communityId);
  const saved = useDrafts((s) => (editing ? undefined : s.byKey[key]));
  const saveDraft = useDrafts((s) => s.save);
  const [body, setBody] = useState(() => params.body ?? saved?.body ?? '');
  const [media, setMedia] = useState<DraftMedia | null>(() => (params.body ? null : (saved?.media ?? null)));
  const [before, setBefore] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(editing));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  // In Help & Questions: a question or a recommendation.
  const [kind, setKind] = useState<'question' | 'recommendation' | null>(params.kind === 'question' || params.kind === 'recommendation' ? params.kind : null);
  const [original, setOriginal] = useState<{ body: string; media: string }>({ body: '', media: 'null' });

  // A draft kept on the phone comes back (it may load just after the screen opens).
  const adopted = useRef(Boolean(saved));
  useEffect(() => {
    if (editing || params.body || adopted.current || !saved) return;
    adopted.current = true;
    setBody((b) => b || saved.body);
    setMedia((m) => m ?? saved.media);
  }, [editing, params.body, saved]);

  // Editing: the post as stored.
  useEffect(() => {
    if (!editing) return;
    loadPost(editing)
      .then((p) => {
        if (!p) {
          toast('This post is not available', 'x', 'live');
          router.back();
          return;
        }
        setBody(p.body);
        setMedia(p.media);
        setBefore(p.files);
        setCommunityId(p.communityId);
        setOriginal({ body: p.body, media: JSON.stringify(p.media) });
      })
      .finally(() => setLoading(false));
  }, [editing, router]);

  const files = media?.files ?? [];
  const dirty = editing ? body !== original.body || JSON.stringify(media) !== original.media : Boolean(body.trim() || files.length);
  const canSend = Boolean(body.trim() || files.length) && !busy && !loading;

  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/profile')), [router]);
  const askLeave = useCallback(() => {
    if (!dirty || busy) {
      if (!busy) leave();
      return;
    }
    if (editing) {
      const q = tx('Leave without saving your changes?');
      if (Platform.OS === 'web') {
        if (globalThis.confirm?.(q)) leave();
        return;
      }
      Alert.alert(q, undefined, [
        { text: tx('Keep editing'), style: 'cancel' },
        { text: tx('Discard changes'), style: 'destructive', onPress: leave },
      ]);
      return;
    }
    const q = tx('Leave without posting?');
    if (Platform.OS === 'web') {
      // The browser asks yes / no: yes keeps the draft for next time.
      if (globalThis.confirm?.(tx('Keep this post as a draft?'))) saveDraft(key, { body, media, at: Date.now() });
      else saveDraft(key, null);
      leave();
      return;
    }
    Alert.alert(q, tx('You can keep it as a draft and finish it later.'), [
      { text: tx('Keep editing'), style: 'cancel' },
      {
        text: tx('Save draft'),
        onPress: () => {
          saveDraft(key, { body, media, at: Date.now() });
          leave();
        },
      },
      {
        text: tx('Discard'),
        style: 'destructive',
        onPress: () => {
          saveDraft(key, null);
          leave();
        },
      },
    ]);
  }, [dirty, busy, editing, key, body, media, leave, saveDraft]);

  // Android's back button asks too.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!dirty) return false;
      askLeave();
      return true;
    });
    return () => sub.remove();
  }, [dirty, askLeave]);

  const addPhotos = async () => {
    try {
      const have = media?.kind === 'photo' ? media.files : [];
      const room = MAX_PHOTOS - have.length;
      if (room <= 0) {
        toast(tx('{n} photos at most', { n: MAX_PHOTOS }), 'camera', 'brand');
        return;
      }
      const more = await pickPhotos(room);
      if (more.length) setMedia({ kind: 'photo', files: [...have, ...more] });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open your photos', 'x', 'live');
    }
  };
  const addVideo = async () => {
    try {
      const v = await pickVideo();
      if (v) setMedia(v);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open this video', 'x', 'live');
    }
  };
  const removeFile = (i: number) => {
    if (!media) return;
    if (media.kind === 'video') return setMedia(null);
    const rest = media.files.filter((_, j) => j !== i);
    setMedia(rest.length ? { kind: 'photo', files: rest } : null);
  };

  const sending = useRef(false);
  const send = async () => {
    if (!canSend || sending.current) return;
    if (!account) {
      toast('Sign in to post', 'user', 'brand');
      router.push('/account');
      return;
    }
    sending.current = true;
    setBusy(true);
    try {
      const onProgress = media?.kind === 'video' || files.length > 1 ? setProgress : undefined;
      if (editing) await updatePost(editing, { body, media, before, onProgress });
      else await createPost({ communityId, body, media, onProgress, kind: kind ?? 'post' });
      if (!editing) saveDraft(key, null);
      haptic('success');
      toast(editing ? 'Post updated' : communityId ? 'Posted in the community' : 'Posted on your profile', 'check', 'brand');
      leave();
    } catch (e) {
      // Nothing is lost: the words and files stay, the member taps again.
      toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
    } finally {
      sending.current = false;
      setBusy(false);
      setProgress(null);
    }
  };

  const title = editing ? 'Edit post' : kind === 'question' ? 'Ask a question' : kind === 'recommendation' ? 'Recommend' : 'New post';
  const where = communityId ? (params.name ? tx('In {name}', { name: params.name }) : tx('In the community')) : tx('On your profile');
  return (
    <Page title={title} subtitle={where} onBack={askLeave}>
      <View style={styles.body}>
        {kind ? (
          <View style={styles.row}>
            <Chip size="sm" icon="question" label={tx('Question')} selected={kind === 'question'} onPress={() => setKind('question')} />
            <Chip size="sm" icon="star" label={tx('Recommendation')} selected={kind === 'recommendation'} onPress={() => setKind('recommendation')} />
          </View>
        ) : null}
        <TextInput
          value={body}
          onChangeText={(v) => setBody(v.slice(0, 2000))}
          placeholder={kind === 'question' ? tx('Your question, with the details that help people answer') : kind === 'recommendation' ? tx('The place or professional, where, and why you recommend them') : tx('What do you want to share?')}
          placeholderTextColor={t.c.textTertiary}
          multiline
          autoFocus={!editing}
          editable={!loading}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
          accessibilityLabel={a11y('Write your post')}
        />
        {files.length ? <Picked media={media!} onRemove={removeFile} disabled={busy} /> : null}
        {progress !== null ? (
          <View style={{ gap: 6 }}>
            <View style={[styles.bar, { backgroundColor: t.c.overlay }]}>
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.c.text }]} />
            </View>
            <Text variant="caption" tone="secondary">
              {tx('Sending… {n}%', { n: Math.round(progress * 100) })}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <PressableScale haptic="select" onPress={addPhotos} disabled={busy || media?.kind === 'video'} style={[styles.add, { borderColor: t.c.lineStrong, opacity: media?.kind === 'video' ? 0.4 : 1 }]} accessibilityLabel={a11y('Add photos')}>
            <Icon name="camera" size={18} color={t.c.text} />
            <Text variant="label">{media?.kind === 'photo' ? tx('More photos') : tx('Photos')}</Text>
          </PressableScale>
          <PressableScale haptic="select" onPress={addVideo} disabled={busy || media?.kind === 'photo'} style={[styles.add, { borderColor: t.c.lineStrong, opacity: media?.kind === 'photo' ? 0.4 : 1 }]} accessibilityLabel={a11y('Add a video')}>
            <Icon name="video" size={18} color={t.c.text} />
            <Text variant="label">{media?.kind === 'video' ? tx('Change video') : tx('Video')}</Text>
          </PressableScale>
        </View>
        <Text variant="caption" tone="tertiary">
          {tx('Photos and video are optional: up to {n} photos, or one video of 60 seconds.', { n: MAX_PHOTOS })}
        </Text>
        <Button label={editing ? 'Save' : 'Post'} icon={editing ? 'check' : 'send'} full loading={busy} disabled={!canSend} onPress={send} />
      </View>
    </Page>
  );
}

/** The picked or stored files, each removable. */
function Picked({ media, onRemove, disabled }: { media: DraftMedia; onRemove: (i: number) => void; disabled: boolean }) {
  const links = useSignedLinks('post-media', [...media.files.map((f) => f.path), media.kind === 'video' ? media.posterPath : undefined]);
  const src = (f: { path?: string; uri?: string }) => f.uri ?? (f.path ? links[f.path] : undefined);
  if (media.kind === 'video') {
    const f = media.files[0];
    const url = src(f);
    return (
      <View>
        {url ? <LiveVideo url={url} poster={media.poster ?? (media.posterPath ? links[media.posterPath] : null)} seconds={media.seconds} style={styles.video} /> : <View style={styles.video} />}
        <Remove onPress={() => onRemove(0)} disabled={disabled} label="Remove the video" />
      </View>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {media.files.map((f, i) => {
        const uri = src(f);
        return (
          <View key={(f.path ?? f.uri ?? '') + i} style={styles.thumb}>
            {uri ? <Image source={{ uri, cacheKey: f.path }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <Remove onPress={() => onRemove(i)} disabled={disabled} label={tx('Remove photo {n}', { n: i + 1 })} />
          </View>
        );
      })}
    </ScrollView>
  );
}

function Remove({ onPress, disabled, label }: { onPress: () => void; disabled: boolean; label: string }) {
  return (
    <PressableScale haptic="select" onPress={onPress} disabled={disabled} hitSlop={8} style={styles.remove} accessibilityLabel={a11y(label)}>
      <Icon name="x" size={14} color="#fff" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[4] },
  input: { minHeight: 140, borderRadius: radius.lg, borderWidth: 1, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  add: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  thumb: { width: 104, height: 104, borderRadius: radius.md, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  video: { height: 220, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  remove: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
