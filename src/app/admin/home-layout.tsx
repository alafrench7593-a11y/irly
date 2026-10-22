import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATEGORIES } from '@/data/catalog/categories';
import { isContentStaff } from '@/features/admin/api';
import { AdminInput, adminStyles, ago, Card, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { loadLayout, publishLayout, restoreLayout, saveLayoutDraft, type AdminLayout } from '@/features/cms/api';
import { Choice, DestinationField, ErrorLine, MoveButtons, PhotoSlot, Toggle } from '@/features/cms/adminUi';
import { useCmsPreview } from '@/features/cms/feed';
import { checkLayout, SECTION_LABEL, SECTION_SPEC, STYLE_LABEL, type LayoutEntry, type SectionStyle } from '@/features/cms/layout';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import type { AppSpace } from '@/state/appSpace';
import { useTheme } from '@/theme/useTheme';

const FLAVOURS: AppSpace[] = ['mixte', 'girl'];
const FLAVOUR_LABEL: Record<AppSpace, string> = { mixte: 'IRLY (Mixte)', girl: 'IRLY Girl' };

/**
 * Back office › Home layout: the order of the Home's sections per flavour,
 * which are shown, and their words, numbers and styles (only what each
 * section really supports). « Save the draft » never changes what members
 * see; « Publish » puts the saved draft live, whole, and keeps a version
 * that can be brought back. The previews draw the real Home with the draft.
 */
export default function AdminHomeLayout() {
  const role = useAdminRole();
  const [flavour, setFlavour] = useState<AppSpace>('mixte');
  if (role !== undefined && !isContentStaff(role)) {
    return (
      <Page title="Home layout">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }
  return (
    <Page title="Home layout" subtitle="Order, show or hide and word the sections of the Home, for IRLY and for IRLY Girl. Members see a change only once it is published.">
      <View style={adminStyles.body}>
        <View style={adminStyles.row}>
          {FLAVOURS.map((f) => (
            <Chip key={f} label={FLAVOUR_LABEL[f]} selected={flavour === f} onPress={() => setFlavour(f)} />
          ))}
        </View>
        <Loader key={flavour} flavour={flavour} />
      </View>
    </Page>
  );
}

function Loader({ flavour }: { flavour: AppSpace }) {
  const t = useTheme();
  const { data, error, reload } = useLoad<AdminLayout>(() => loadLayout(flavour), `layout-${flavour}`);
  if (error) {
    return (
      <View style={{ gap: 8 }}>
        <Text variant="body" tone="secondary">
          {tx(error)}
        </Text>
        <Button label="Try again" variant="secondary" onPress={reload} />
      </View>
    );
  }
  if (!data) return <ActivityIndicator color={t.c.text} />;
  return <Editor key={`${data.version}|${data.draft_updated_at}`} flavour={flavour} data={data} reload={reload} />;
}

function Editor({ flavour, data, reload }: { flavour: AppSpace; data: AdminLayout; reload: () => void }) {
  const t = useTheme();
  const [entries, setEntries] = useState<LayoutEntry[]>(() => checkLayout(data.draft));
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = (next: LayoutEntry[]) => {
    setEntries(next);
    setDirty(true);
  };
  const patch = (key: string, p: Partial<LayoutEntry>) => change(entries.map((e) => (e.key === key ? clean({ ...e, ...p }) : e)));
  const move = (i: number, d: -1 | 1) => {
    const next = [...entries];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    change(next);
  };

  // Every step is checked by the server; on failure the draft on screen stays as it is.
  const run = async (key: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      toast(done, 'check', 'brand');
      setDirty(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(null);
    }
  };
  const save = () => run('save', () => saveLayoutDraft(flavour, entries), 'Draft saved: members still see the published layout');
  // The draft on screen is saved first: if that fails, nothing is published.
  const publish = () =>
    run(
      'publish',
      async () => {
        await saveLayoutDraft(flavour, entries);
        await publishLayout(flavour);
      },
      'Published',
    );
  const preview = (space: AppSpace) => {
    useCmsPreview.setState({ preview: { space, entries } });
    router.push('/admin/home-preview');
  };

  return (
    <View style={{ gap: 12 }}>
      <Text variant="caption" tone="secondary">
        {[
          data.version ? tx('Published: version {n}, {when}', { n: data.version, when: data.published_at ? ago(data.published_at) : '' }) : tx('Never published: members see the app’s own order'),
          data.draft_updated_at ? tx('draft saved {when}', { when: ago(data.draft_updated_at) }) : null,
          dirty ? tx('changes not saved') : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      {entries.map((e, i) => {
        const spec = SECTION_SPEC[e.key];
        const pinned = Boolean(spec.pinned);
        const editable = spec.text || spec.cta || spec.category || spec.cover || spec.styles || spec.count;
        const up = !pinned && i > 1 ? () => move(i, -1) : undefined;
        const down = !pinned && i < entries.length - 2 ? () => move(i, 1) : undefined;
        return (
          <Card key={e.key}>
            <View style={styles.head} testID={`layout-row-${e.key}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="titleS" tone={e.enabled ? 'primary' : 'tertiary'}>
                  {SECTION_LABEL[e.key]}
                </Text>
                {pinned ? (
                  <Text variant="caption" tone="tertiary">
                    {spec.pinned === 'first' ? 'Always first' : 'Always last'}
                  </Text>
                ) : null}
              </View>
              {pinned ? <Icon name="lock" size={16} color={t.c.textTertiary} /> : <MoveButtons label={tx(SECTION_LABEL[e.key])} onUp={up} onDown={down} />}
            </View>
            {!pinned ? <Toggle label="Shown" value={e.enabled} onChange={(v) => patch(e.key, { enabled: v })} /> : null}
            {editable ? (
              <PressableScale haptic="select" onPress={() => setOpen(open === e.key ? null : e.key)} accessibilityRole="button" accessibilityLabel={tx('Edit {name}', { name: tx(SECTION_LABEL[e.key]) })}>
                <Text variant="label" tone="brand">
                  {open === e.key ? 'Close' : 'Words, style and numbers'}
                </Text>
              </PressableScale>
            ) : null}
            {open === e.key ? <SectionForm entry={e} onPatch={(p) => patch(e.key, p)} /> : null}
          </Card>
        );
      })}

      <ErrorLine error={error} />
      <View style={adminStyles.row}>
        <Button size="sm" variant="secondary" icon="file" label="Save the draft" disabled={busy !== null} loading={busy === 'save'} onPress={() => void save()} />
        <Button size="sm" icon="send" label="Publish" disabled={busy !== null} loading={busy === 'publish'} onPress={() => void publish()} />
      </View>
      <View style={adminStyles.row}>
        <Button size="sm" variant="ghost" icon="eye" label="Preview IRLY" onPress={() => preview('mixte')} />
        <Button size="sm" variant="ghost" icon="eye" label="Preview IRLY Girl" onPress={() => preview('girl')} />
      </View>

      <Card>
        <Text variant="label">Versions</Text>
        <Button size="sm" variant="ghost" icon="repeat" label="Bring the live layout back into the draft" disabled={busy !== null} onPress={() => void run('restore', () => restoreLayout(flavour, null), 'The draft is the live layout again')} />
        {data.versions.length ? (
          data.versions.map((v, i) => (
            <View key={v.version} style={{ gap: 4 }}>
              {i ? <Divider /> : null}
              <View style={styles.head}>
                <Text variant="bodyS" style={{ flex: 1 }}>
                  {tx('Version {n}, {when}', { n: v.version, when: ago(v.published_at) })}
                </Text>
                <Button size="sm" variant="secondary" label="Bring back into the draft" disabled={busy !== null} onPress={() => void run('restore', () => restoreLayout(flavour, v.version), 'Version brought back into the draft')} />
              </View>
            </View>
          ))
        ) : (
          <Text variant="bodyS" tone="secondary">
            No version published yet.
          </Text>
        )}
      </Card>
    </View>
  );
}

/** Drops what is empty (an emptied title goes back to the app's own words). */
function clean(e: LayoutEntry): LayoutEntry {
  const out = { ...e } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (v === '' || v === undefined || v === null) delete out[k];
  return out as LayoutEntry;
}

function SectionForm({ entry, onPatch }: { entry: LayoutEntry; onPatch: (p: Partial<LayoutEntry>) => void }) {
  const t = useTheme();
  const spec = SECTION_SPEC[entry.key];
  const count = spec.count;
  const n = entry.count ?? count?.[2];
  return (
    <View style={{ gap: 8 }}>
      {spec.text ? (
        <>
          <AdminInput value={entry.title_fr ?? ''} onChange={(v) => onPatch({ title_fr: v })} placeholder="Title in French (empty: the app's own)" label="Title in French" max={60} />
          <AdminInput value={entry.title_en ?? ''} onChange={(v) => onPatch({ title_en: v })} placeholder="Title in English (empty: the app's own)" label="Title in English" max={60} />
          <AdminInput value={entry.subtitle_fr ?? ''} onChange={(v) => onPatch({ subtitle_fr: v })} placeholder="Line above, in French (optional)" label="Line above, in French" max={60} />
          <AdminInput value={entry.subtitle_en ?? ''} onChange={(v) => onPatch({ subtitle_en: v })} placeholder="Line above, in English (optional)" label="Line above, in English" max={60} />
        </>
      ) : null}
      {spec.styles ? (
        <>
          <Text variant="caption" tone="secondary">
            Style
          </Text>
          <Choice<SectionStyle> options={spec.styles} value={entry.style ?? spec.styles[0]} onChange={(v) => onPatch({ style: v })} labels={STYLE_LABEL} />
        </>
      ) : null}
      {count ? (
        <View style={styles.head}>
          <Text variant="bodyS" style={{ flex: 1 }}>
            {tx('Cards shown: {n} (from {min} to {max})', { n: n ?? '', min: count[0], max: count[1] })}
          </Text>
          <PressableScale haptic="select" onPress={() => onPatch({ count: Math.max(count[0], (n ?? count[2]) - 1) })} accessibilityRole="button" accessibilityLabel={tx('Fewer cards')} style={[styles.step, { backgroundColor: t.c.overlay }]}>
            <Icon name="minus" size={16} color={t.c.text} />
          </PressableScale>
          <PressableScale haptic="select" onPress={() => onPatch({ count: Math.min(count[1], (n ?? count[2]) + 1) })} accessibilityRole="button" accessibilityLabel={tx('More cards')} style={[styles.step, { backgroundColor: t.c.overlay }]}>
            <Icon name="plus" size={16} color={t.c.text} />
          </PressableScale>
        </View>
      ) : null}
      {spec.category ? (
        <>
          <Text variant="caption" tone="secondary">
            Category first
          </Text>
          <View style={adminStyles.row}>
            <Chip size="sm" label="The app’s choice" selected={!entry.category} onPress={() => onPatch({ category: undefined })} />
            {CATEGORIES.map((c) => (
              <Chip key={c.id} size="sm" label={c.label} selected={entry.category === c.id} onPress={() => onPatch({ category: c.id })} />
            ))}
          </View>
        </>
      ) : null}
      {spec.cover ? (
        <>
          <Text variant="caption" tone="secondary">
            Photo
          </Text>
          <PhotoSlot path={entry.cover_path ?? null} photoKey={entry.cover_key ?? null} fallback="bali" onChange={(x) => onPatch({ cover_path: x.path ?? undefined, cover_key: x.key ?? undefined })} />
        </>
      ) : null}
      {spec.cta ? (
        <>
          <AdminInput value={entry.cta_label_fr ?? ''} onChange={(v) => onPatch({ cta_label_fr: v })} placeholder="Button label in French (empty: the app's own)" label="Button label in French" max={40} />
          <AdminInput value={entry.cta_label_en ?? ''} onChange={(v) => onPatch({ cta_label_en: v })} placeholder="Button label in English (empty: the app's own)" label="Button label in English" max={40} />
          <DestinationField value={entry.cta_url ?? ''} onChange={(v) => onPatch({ cta_url: v })} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
