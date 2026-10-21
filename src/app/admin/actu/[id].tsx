import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { isContentStaff } from '@/features/admin/api';
import { AdminInput, adminStyles, Card, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import {
  deleteNews,
  loadAdminNewsItem,
  pickCmsPhoto,
  pickCmsVideo,
  publishNews,
  saveNews,
  unpublishNews,
  uploadCmsFile,
  type AdminNews,
  type NewsDraft,
  type UploadStep,
} from '@/features/cms/api';
import { AUDIENCE_LABEL, Choice, DestinationField, ErrorLine, formatLocal, NewsStatePill, parseLocal, PhotoSlot, Toggle } from '@/features/cms/adminUi';
import { isDestination } from '@/features/cms/destinations';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABEL, NEWS_PHOTO, type CmsAudience } from '@/features/cms/feed';
import { NewsArticleView, useCmsVisuals } from '@/features/cms/ui';
import { confirm } from '@/lib/confirm';
import { t as tx } from '@/i18n';
import { Photo } from '@/components/visual/Photo';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const AUDIENCES: CmsAudience[] = ['both', 'mixte', 'girl'];

/**
 * Back office › one news item: write, preview, save as a draft, publish now
 * or at a time, unpublish, publish again, delete (after asking). Saving a
 * published item changes it for members at once; its notification (if
 * asked) is sent once, when it first goes live, never again.
 */
export default function AdminNewsEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const role = useAdminRole();
  const fresh = !id || id === 'new';
  const { data, error, reload } = useLoad<AdminNews | null>(() => (fresh ? Promise.resolve(null) : loadAdminNewsItem(id)), id ?? 'new');

  if (role !== undefined && !isContentStaff(role)) {
    return (
      <Page title="News item">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }
  if (!fresh && !data) {
    return (
      <Page title="News item">
        <View style={adminStyles.body}>
          {error ? (
            <>
              <Text variant="body" tone="secondary">
                {tx(error)}
              </Text>
              <Button label="Try again" variant="secondary" onPress={reload} />
            </>
          ) : (
            <ActivityIndicator color={t.c.text} />
          )}
        </View>
      </Page>
    );
  }
  // Keyed by the saved version: after a save the form starts again from what the server holds.
  return <Editor key={data ? `${data.id}|${data.updated_at}|${data.state}` : 'new'} n={data} reload={reload} />;
}

type Form = {
  title: string;
  subtitle: string;
  body: string;
  category: AdminNews['category'];
  audience: CmsAudience;
  cover_path: string | null;
  cover_key: string | null;
  gallery_paths: string[];
  video_path: string | null;
  cta_label: string;
  cta_url: string;
  notify: boolean;
};

const formOf = (n: AdminNews | null): Form => ({
  title: n?.title ?? '',
  subtitle: n?.subtitle ?? '',
  body: n?.body ?? '',
  category: n?.category ?? 'news',
  audience: n?.audience ?? 'both',
  cover_path: n?.cover_path ?? null,
  cover_key: n?.cover_key ?? null,
  gallery_paths: n?.gallery_paths ?? [],
  video_path: n?.video_path ?? null,
  cta_label: n?.cta_label ?? '',
  cta_url: n?.cta_url ?? '',
  notify: n?.notify ?? false,
});

const draftOf = (f: Form): NewsDraft => ({
  title: f.title.trim(),
  subtitle: f.subtitle.trim() || null,
  body: f.body.trim(),
  category: f.category,
  audience: f.audience,
  cover_path: f.cover_path,
  cover_key: f.cover_key,
  gallery_paths: f.gallery_paths,
  video_path: f.video_path,
  cta_label: f.cta_label.trim() || null,
  cta_url: f.cta_url.trim() || null,
  notify: f.notify,
});

function Editor({ n, reload }: { n: AdminNews | null; reload: () => void }) {
  const [f, setF] = useState<Form>(() => formOf(n));
  const [id, setId] = useState<string | null>(n?.id ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [when, setWhen] = useState(n?.state === 'scheduled' ? formatLocal(n.publish_at) : '');
  const [videoStep, setVideoStep] = useState<UploadStep | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const state = n?.state ?? 'draft';
  const live = Boolean(n?.went_live_at || n?.notified_at);
  const valid = f.title.trim().length >= 3 && isDestination(f.cta_url.trim()) && (!f.cta_url.trim() || f.cta_label.trim().length > 0);
  const at = parseLocal(when);

  // Saves first (a new item becomes a draft), then the action: nothing is published from a form that did not save.
  const run = async (key: string, action: ((id: string) => Promise<unknown>) | null, done: string) => {
    setBusy(key);
    setError(null);
    try {
      const saved = await saveNews(id, draftOf(f));
      setId(saved);
      if (action) await action(saved);
      toast(done, 'check', 'brand');
      if (!id) router.replace(`/admin/actu/${saved}`);
      else reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const addVideo = async () => {
    setError(null);
    const uri = await pickCmsVideo().catch(() => null);
    if (!uri) return;
    try {
      set('video_path', await uploadCmsFile(uri, 'video', setVideoStep));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the file');
    } finally {
      setVideoStep(null);
    }
  };
  const addGallery = async () => {
    setError(null);
    const uri = await pickCmsPhoto().catch(() => null);
    if (!uri) return;
    try {
      const path = await uploadCmsFile(uri, 'photo');
      setF((x) => ({ ...x, gallery_paths: [...x.gallery_paths, path].slice(0, 12) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the file');
    }
  };

  const remove = () =>
    confirm('Delete this news item? Members will no longer see it.', () => {
      if (!id) return router.back();
      setBusy('delete');
      deleteNews(id)
        .then(() => {
          toast('Deleted', 'check', 'brand');
          router.replace('/admin/actu');
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not save'))
        .finally(() => setBusy(null));
    });

  const article = {
    id: id ?? '00000000-0000-0000-0000-000000000000',
    title: f.title.trim() || tx('Title'),
    subtitle: f.subtitle.trim() || undefined,
    body: f.body,
    cover_path: f.cover_path ?? undefined,
    cover_key: f.cover_key ?? undefined,
    category: f.category,
    publish_at: n?.publish_at ?? new Date().toISOString(),
    audience: f.audience,
    cta_label: f.cta_label.trim() || undefined,
    cta_url: f.cta_url.trim() || undefined,
    video: Boolean(f.video_path),
    gallery_paths: f.gallery_paths,
    video_path: f.video_path ?? undefined,
  };

  return (
    <Page title={n ? 'Edit the news item' : 'New news item'} overline="IRLY news">
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          <NewsStatePill state={state} at={n?.publish_at} />
          <Button size="sm" variant="ghost" icon="eye" label={preview ? 'Back to editing' : 'Preview'} onPress={() => setPreview((p) => !p)} />
        </View>

        {preview ? (
          <View style={styles.preview} testID="news-preview">
            <NewsArticleView item={article} />
          </View>
        ) : (
          <>
            <Card>
              <Text variant="label">Words</Text>
              <AdminInput value={f.title} onChange={(v) => set('title', v)} placeholder="Title (3 to 120 characters)" label="Title" max={120} />
              <AdminInput value={f.subtitle} onChange={(v) => set('subtitle', v)} placeholder="Subtitle (optional)" label="Subtitle" max={200} />
              <AdminInput value={f.body} onChange={(v) => set('body', v)} placeholder="Text (an empty line starts a new paragraph)" label="Text" multiline max={10000} />
              <Text variant="caption" tone="tertiary">
                Shown as written, in the language you write it: it is never translated.
              </Text>
            </Card>

            <Card>
              <Text variant="label">Who sees it</Text>
              <Choice options={AUDIENCES} value={f.audience} onChange={(v) => set('audience', v)} labels={AUDIENCE_LABEL} />
              <Text variant="caption" tone="tertiary">
                IRLY Girl items are shown, and notified, to IRLY Girl members only.
              </Text>
              <Text variant="label">Category</Text>
              <Choice options={NEWS_CATEGORIES} value={f.category} onChange={(v) => set('category', v)} labels={NEWS_CATEGORY_LABEL} />
            </Card>

            <Card>
              <Text variant="label">Photo</Text>
              <PhotoSlot path={f.cover_path} photoKey={f.cover_key} fallback={NEWS_PHOTO[f.category]} onChange={(x) => setF((p) => ({ ...p, cover_path: x.path, cover_key: x.key }))} />
              <Text variant="label">Gallery</Text>
              <Gallery paths={f.gallery_paths} onRemove={(p) => set('gallery_paths', f.gallery_paths.filter((x) => x !== p))} />
              {f.gallery_paths.length < 12 ? <Button size="sm" variant="secondary" icon="plus" label="Add a photo to the gallery" onPress={() => void addGallery()} /> : null}
              <Text variant="label">Video</Text>
              <View style={adminStyles.row}>
                {f.video_path ? (
                  <>
                    <Text variant="bodyS" tone="secondary">
                      A video is attached.
                    </Text>
                    <Button size="sm" variant="ghost" icon="x" label="Remove the video" onPress={() => set('video_path', null)} />
                  </>
                ) : (
                  <Button size="sm" variant="secondary" icon="video" label="Add a video (25 MB at most)" loading={videoStep !== null} onPress={() => void addVideo()} />
                )}
              </View>
            </Card>

            <Card>
              <Text variant="label">Button (optional)</Text>
              <AdminInput value={f.cta_label} onChange={(v) => set('cta_label', v)} placeholder="Button label" label="Button label" max={40} />
              <DestinationField value={f.cta_url} onChange={(v) => set('cta_url', v)} />
            </Card>

            <Card>
              <Text variant="label">Notification</Text>
              <Toggle label="Notify the members who can see it when it goes live (once)" value={f.notify} disabled={live} onChange={(v) => set('notify', v)} />
              {live ? (
                <Text variant="caption" tone="tertiary">
                  {n?.notified_at ? 'Already sent: editing never sends it again.' : 'This item went live without a notification: none will be sent.'}
                </Text>
              ) : null}
            </Card>

            <Card>
              <Text variant="label">Publish at a time (optional)</Text>
              <AdminInput value={when} onChange={setWhen} placeholder="2026-11-02 18:30 (your time)" label="Publication time" max={16} autoCapitalize="none" />
              {when.trim() && !at ? (
                <Text variant="caption" tone="live">
                  Write the time as 2026-11-02 18:30
                </Text>
              ) : null}
            </Card>
          </>
        )}

        <ErrorLine error={error} />
        <View style={adminStyles.row}>
          <Button size="sm" variant="secondary" icon="file" label="Save the draft" disabled={!valid || busy !== null} loading={busy === 'save'} onPress={() => void run('save', null, n && state !== 'draft' ? 'Saved: members see the change' : 'Draft saved')} />
          {state !== 'published' ? (
            <Button size="sm" icon="send" label={state === 'unpublished' ? 'Publish again' : 'Publish now'} disabled={!valid || busy !== null} loading={busy === 'publish'} onPress={() => void run('publish', (x) => publishNews(x), 'Published')} />
          ) : null}
          <Button size="sm" variant="secondary" icon="calendar" label="Schedule" disabled={!valid || !at || busy !== null} loading={busy === 'schedule'} onPress={() => void run('schedule', (x) => publishNews(x, at), 'Scheduled')} />
          {state === 'published' || state === 'scheduled' ? (
            <Button size="sm" variant="secondary" icon="eye" label="Unpublish" disabled={busy !== null} loading={busy === 'unpublish'} onPress={() => void run('unpublish', (x) => unpublishNews(x), 'Unpublished')} />
          ) : null}
          <Button size="sm" variant="danger" icon="x" label="Delete" disabled={busy !== null} loading={busy === 'delete'} onPress={remove} />
        </View>
      </View>
    </Page>
  );
}

function Gallery({ paths, onRemove }: { paths: string[]; onRemove: (p: string) => void }) {
  const visuals = useCmsVisuals(paths.map((p) => ({ path: p, key: null, fallback: 'palmAerial' })));
  if (!paths.length) {
    return (
      <Text variant="caption" tone="tertiary">
        No photos in the gallery.
      </Text>
    );
  }
  return (
    <View style={styles.gallery}>
      {paths.map((p, i) => (
        <View key={p} style={{ gap: 4 }}>
          <Photo visual={visuals[i]} light="dubai" width={300} pinned style={styles.cell} />
          <Button size="sm" variant="ghost" label="Remove" onPress={() => onRemove(p)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { marginHorizontal: -space.gutter, gap: space[3] },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 96, height: 96, borderRadius: radius.lg, overflow: 'hidden' },
});
