import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { isContentStaff } from '@/features/admin/api';
import { AdminInput, adminStyles, Card, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { deleteBanner, loadBanners, reorderBanners, saveBanner, type AdminBanner, type BannerDraft } from '@/features/cms/api';
import { AUDIENCE_LABEL, Choice, DestinationField, ErrorLine, formatLocal, MoveButtons, parseLocal, PhotoSlot, Toggle } from '@/features/cms/adminUi';
import { isDestination } from '@/features/cms/destinations';
import { BANNER_PHOTO, type CmsAudience } from '@/features/cms/feed';
import { BannerSection } from '@/features/cms/ui';
import { confirm } from '@/lib/confirm';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const AUDIENCES: CmsAudience[] = ['both', 'mixte', 'girl'];

/**
 * Back office › Banners & visuals: the banners of the Home (the one place
 * that has them), per flavour, in order, on or off, with optional dates.
 * Each banner owns its photo (a new file for every replacement): changing a
 * banner never changes another one, nor any of IRLY's own photos, and no
 * stored photo is ever deleted from here.
 */
export default function AdminBanners() {
  const t = useTheme();
  const role = useAdminRole();
  const { data, error, reload } = useLoad<AdminBanner[]>(loadBanners, 'admin-banners');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  if (role !== undefined && !isContentStaff(role)) {
    return (
      <Page title="Banners & visuals">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }
  const move = async (list: AdminBanner[], i: number, d: -1 | 1) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setBusy(true);
    setMoveError(null);
    try {
      await reorderBanners(next.map((b) => b.id));
      toast('Order saved', 'check', 'brand');
      reload();
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Banners & visuals" subtitle="Banners at the top of the Home, for IRLY, IRLY Girl or both. A banner shows while it is on and within its dates.">
      <View style={adminStyles.body}>
        {creating ? (
          <BannerForm b={null} onDone={() => (setCreating(false), reload())} onCancel={() => setCreating(false)} />
        ) : (
          <Button label="New banner" icon="plus" onPress={() => setCreating(true)} />
        )}
        <ErrorLine error={moveError} />
        {error ? (
          <>
            <Text variant="body" tone="secondary">
              {tx(error)}
            </Text>
            <Button label="Try again" variant="secondary" onPress={reload} />
          </>
        ) : !data ? (
          <ActivityIndicator color={t.c.text} />
        ) : !data.length ? (
          <Text variant="body" tone="secondary">
            No banner yet.
          </Text>
        ) : (
          data.map((b, i) => (
            <View key={`${b.id}|${b.position}`} style={{ gap: 6 }}>
              <View style={adminStyles.row}>
                <Text variant="caption" tone={b.active ? 'positive' : 'tertiary'} style={{ flex: 1 }}>
                  {`${tx(b.active ? 'On' : 'Off')} · ${tx(AUDIENCE_LABEL[b.audience])}`}
                </Text>
                <MoveButtons label={b.title} disabled={busy} onUp={i > 0 ? () => void move(data, i, -1) : undefined} onDown={i < data.length - 1 ? () => void move(data, i, 1) : undefined} />
              </View>
              <BannerForm b={b} onDone={reload} />
            </View>
          ))
        )}
      </View>
    </Page>
  );
}

type Form = { title: string; body: string; image_path: string | null; image_key: string | null; cta_label: string; cta_url: string; audience: CmsAudience; active: boolean; starts: string; ends: string };

function BannerForm({ b, onDone, onCancel }: { b: AdminBanner | null; onDone: () => void; onCancel?: () => void }) {
  const frame = useFrame();
  const [f, setF] = useState<Form>(() => ({
    title: b?.title ?? '',
    body: b?.body ?? '',
    image_path: b?.image_path ?? null,
    image_key: b?.image_key ?? null,
    cta_label: b?.cta_label ?? '',
    cta_url: b?.cta_url ?? '',
    audience: b?.audience ?? 'both',
    active: b?.active ?? false,
    starts: formatLocal(b?.starts_at),
    ends: formatLocal(b?.ends_at),
  }));
  const [open, setOpen] = useState(!b);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const starts = f.starts.trim() ? parseLocal(f.starts) : null;
  const ends = f.ends.trim() ? parseLocal(f.ends) : null;
  const datesOk = (!f.starts.trim() || starts) && (!f.ends.trim() || ends);
  const valid = f.title.trim().length > 0 && isDestination(f.cta_url.trim()) && Boolean(datesOk);

  const draft = (): BannerDraft => ({
    title: f.title.trim(),
    body: f.body.trim() || null,
    image_path: f.image_path,
    image_key: f.image_key,
    cta_label: f.cta_label.trim() || null,
    cta_url: f.cta_url.trim() || null,
    audience: f.audience,
    active: f.active,
    starts_at: starts ? starts.toISOString() : null,
    ends_at: ends ? ends.toISOString() : null,
  });
  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(done, 'check', 'brand');
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };
  const preview = { id: b?.id ?? 'new', title: f.title.trim() || tx('Title'), body: f.body.trim() || null, image_path: f.image_path, image_key: f.image_key, cta_label: f.cta_label.trim() || null, cta_url: f.cta_url.trim() || null, audience: f.audience };

  return (
    <Card>
      <View testID="banner-preview">
        <BannerSection banners={[preview]} width={frame.width - space.gutter * 2 - 28} pad={0} />
      </View>
      {!open ? (
        <Button size="sm" variant="ghost" icon="edit" label="Edit" onPress={() => setOpen(true)} />
      ) : (
        <>
          <AdminInput value={f.title} onChange={(v) => set('title', v)} placeholder="Title" label="Title" max={80} />
          <AdminInput value={f.body} onChange={(v) => set('body', v)} placeholder="Text (optional)" label="Text" max={200} />
          <PhotoSlot path={f.image_path} photoKey={f.image_key} fallback={BANNER_PHOTO} height={120} onChange={(x) => setF((p) => ({ ...p, image_path: x.path, image_key: x.key }))} />
          <AdminInput value={f.cta_label} onChange={(v) => set('cta_label', v)} placeholder="Button label (optional)" label="Button label" max={40} />
          <DestinationField value={f.cta_url} onChange={(v) => set('cta_url', v)} />
          <Choice options={AUDIENCES} value={f.audience} onChange={(v) => set('audience', v)} labels={AUDIENCE_LABEL} />
          <Toggle label="On" value={f.active} onChange={(v) => set('active', v)} />
          <AdminInput value={f.starts} onChange={(v) => set('starts', v)} placeholder="From (optional): 2026-11-02 18:30" label="Shown from" max={16} autoCapitalize="none" />
          <AdminInput value={f.ends} onChange={(v) => set('ends', v)} placeholder="Until (optional): 2026-11-09 23:00" label="Shown until" max={16} autoCapitalize="none" />
          {!datesOk ? (
            <Text variant="caption" tone="live">
              Write the time as 2026-11-02 18:30
            </Text>
          ) : null}
          <ErrorLine error={error} />
          <View style={adminStyles.row}>
            <Button size="sm" icon="check" label={b ? 'Save' : 'Add the banner'} disabled={!valid || busy !== null} loading={busy === 'save'} onPress={() => void run('save', () => saveBanner(b?.id ?? null, draft()), 'Saved')} />
            {onCancel ? <Button size="sm" variant="ghost" label="Cancel" onPress={onCancel} /> : null}
            {b ? (
              <Button
                size="sm"
                variant="danger"
                icon="x"
                label="Delete"
                disabled={busy !== null}
                loading={busy === 'delete'}
                onPress={() => confirm('Delete this banner? Its photo stays stored.', () => void run('delete', () => deleteBanner(b.id), 'Deleted'))}
              />
            ) : null}
          </View>
        </>
      )}
    </Card>
  );
}
