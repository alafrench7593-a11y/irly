import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATALOG_ENTRIES, CATEGORIES, GIRL_CATEGORY, ideaPhoto } from '@/data/catalog/categories';
import { CITIES, DESTINATIONS } from '@/data/destinations';
import { DUBAI_KEYS } from '@/data/dubaiKeys';
import { LIBRARY, OWN, PHOTO_IDS, type PhotoKey } from '@/data/photos';
import { GIRL_OFFICIAL_PHOTO, TOPIC_PHOTO } from '@/features/community/official';
import { GIRL_KINDS, MOM_KINDS } from '@/features/girl/world';
import { pickPhoto } from '@/features/server/covers';
import { useSignedLinks } from '@/features/server/media';
import { t as tx } from '@/i18n';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { isContentStaff, isModerator, loadItemPhotos, removeMemberPhoto, replaceItemPhoto, type PhotoKind, type PhotoSlot, type PhotoStep, type StaffRole } from './api';
import { AdminInput, adminStyles, Card, useLoad } from './ui';

/* ───────── IRLY's own photos, by where the app shows them ───────── */

export type EditorialGroupId = 'categories' | 'catalogue' | 'official' | 'home' | 'girl' | 'all';
export type EditorialItem = { key: string; label: string; uses: string[] };
export type EditorialGroup = { id: EditorialGroupId; label: string; items: EditorialItem[] };

export const EDITORIAL_LABEL: Record<EditorialGroupId, string> = {
  categories: 'Categories',
  catalogue: 'Activities catalogue',
  official: 'Official communities',
  home: 'Home and destinations',
  girl: 'IRLY Girl and IRLY Maman',
  all: 'All IRLY photos',
};

/** Adds a use of a key to a group (one tile per key, every place it shows listed). */
function collect(out: Map<string, EditorialItem>, key: string, use: string) {
  const item = out.get(key);
  if (item) {
    if (!item.uses.includes(use)) item.uses.push(use);
  } else out.set(key, { key, label: use, uses: [use] });
}

let groups: EditorialGroup[] | null = null;
/**
 * Every photo key the app shows, grouped by where it shows: the categories,
 * the photo of each activity of the catalogue, the default photos of IRLY's
 * official communities, Home (destinations, cities, by day and by night),
 * IRLY Girl and IRLY Maman, and every key of the library. Built once.
 */
export function editorialGroups(): EditorialGroup[] {
  if (groups) return groups;
  const categories = new Map<string, EditorialItem>();
  for (const c of [...CATEGORIES, GIRL_CATEGORY]) collect(categories, c.photo, c.label);
  const catalogue = new Map<string, EditorialItem>();
  for (const e of CATALOG_ENTRIES) collect(catalogue, ideaPhoto(e.categoryId, e.label, e.activity?.place, e.sub.id), e.label);
  const official = new Map<string, EditorialItem>();
  for (const [topic, key] of Object.entries(TOPIC_PHOTO)) collect(official, key, `IRLY ${topic[0].toUpperCase()}${topic.slice(1)}`);
  for (const [topic, key] of Object.entries(GIRL_OFFICIAL_PHOTO)) collect(official, key, `IRLY Girl · ${topic.replace(/^girl_/, '')}`);
  const home = new Map<string, EditorialItem>();
  for (const d of Object.values(DESTINATIONS)) collect(home, d.photo, d.name);
  for (const c of Object.values(CITIES)) collect(home, c.photo, c.name);
  collect(home, 'dubaiNight', 'Dubai by night');
  collect(home, 'abudhabiSkyline', 'Abu Dhabi by night');
  collect(home, 'baliDawn', 'Bali at dawn');
  const girl = new Map<string, EditorialItem>();
  for (const k of GIRL_KINDS) collect(girl, k.photo, `IRLY Girl · ${k.label}`);
  for (const k of MOM_KINDS) collect(girl, k.photo, `IRLY Maman · ${k.label}`);
  const all = new Map<string, EditorialItem>();
  for (const key of [...Object.keys(PHOTO_IDS), ...LIBRARY, ...OWN, ...DUBAI_KEYS]) collect(all, key, key);
  groups = [
    { id: 'categories', label: EDITORIAL_LABEL.categories, items: [...categories.values()] },
    { id: 'catalogue', label: EDITORIAL_LABEL.catalogue, items: [...catalogue.values()] },
    { id: 'official', label: EDITORIAL_LABEL.official, items: [...official.values()] },
    { id: 'home', label: EDITORIAL_LABEL.home, items: [...home.values()] },
    { id: 'girl', label: EDITORIAL_LABEL.girl, items: [...girl.values()] },
    { id: 'all', label: EDITORIAL_LABEL.all, items: [...all.values()].sort((a, b) => a.key.localeCompare(b.key)) },
  ];
  return groups;
}

/** Everywhere a key shows (all groups but the plain list of keys). */
export function usesOf(key: string): string[] {
  return editorialGroups()
    .filter((g) => g.id !== 'all')
    .flatMap((g) => (g.items.find((i) => i.key === key)?.uses ?? []).map((u) => `${tx(g.label)} · ${u.split(' · ').map((x) => tx(x)).join(' · ')}`));
}

export const isPhotoKey = (key: string): key is PhotoKey => editorialGroups().some((g) => g.id === 'all' && g.items.some((i) => i.key === key));

/* ───────── A grid of photo tiles ───────── */

/** Tiles in as many columns as fit (2 on a phone, up to 5 on a wide screen). */
export function PhotoGrid({ children, min = 150, columns }: { children: (width: number) => ReactNode; min?: number; columns?: number }) {
  const [w, setW] = useState(0);
  const cols = columns ?? Math.max(2, Math.min(5, Math.floor(w / min)));
  const tile = w ? Math.floor((w - (cols - 1) * GAP) / cols) : 0;
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={styles.grid}>
      {tile ? children(tile) : null}
    </View>
  );
}
const GAP = 10;

/* ───────── The photos of one thing, on its sheet ───────── */

const STEP_LABEL: Record<PhotoStep, string> = { checking: 'Checking the photo…', uploading: 'Uploading…', saving: 'Saving…' };

const SLOT_LABEL: Record<PhotoSlot['slot'], string> = { cover: 'Photo', media: 'Photo or video', profile: 'Profile photo', match: 'IRLY Match photo' };

const BUCKET_OF: Record<PhotoKind, PhotoSlot['bucket']> = {
  community: 'activity-photos',
  activity: 'activity-photos',
  community_post: 'post-media',
  irl_post: 'irl-media',
  profile: 'profile-photos',
};

const EMPTY: Record<PhotoKind, string> = {
  community: 'No own photo: the app shows its photo for the category.',
  activity: 'No own photo: the app shows its photo for the category.',
  community_post: 'No photo in this post.',
  irl_post: 'No photo in this Live.',
  profile: 'No photo: the member shows with an avatar or initials.',
};

/**
 * The photos of a community, an activity, a post, a Live or a member, with
 * what the caller's role allows: replace or remove a community or activity
 * photo (content staff), take a member's photo off (moderators). Each change
 * asks for a reason (kept in the moderation log) and a confirmation, shows
 * its progress, and reloads the sheet once saved.
 */
export function PhotoPanel({ kind, id, role, onChanged }: { kind: PhotoKind; id: string; role: StaffRole | null | undefined; onChanged?: () => void }) {
  const t = useTheme();
  const { data, error, reload } = useLoad<PhotoSlot[]>(() => loadItemPhotos(kind, id), `${kind}|${id}`);
  const [reason, setReason] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PhotoSlot | 'cover' | null>(null);
  const [step, setStep] = useState<PhotoStep | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const slots = data ?? [];
  const links = useSignedLinks(BUCKET_OF[kind], slots.filter((s) => s.slot !== 'match').map((s) => (s.media === 'video' ? s.thumb : s.path)));
  const matchLinks = useSignedLinks('match-photos', slots.filter((s) => s.slot === 'match').map((s) => s.path));

  const cover = kind === 'community' || kind === 'activity';
  const canReplace = cover && isContentStaff(role);
  const canRemove = cover ? isContentStaff(role) : isModerator(role);
  const why = reason.trim();
  const busy = step !== null;

  const run = async (fn: () => Promise<unknown>, done: string) => {
    setFailed(null);
    setStep('saving');
    try {
      await fn();
      toast(done, 'check', 'brand');
      setReason('');
      setPicked(null);
      setConfirm(null);
      reload();
      onChanged?.();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could not save';
      setFailed(m);
      toast(m, 'x', 'live');
    } finally {
      setStep(null);
    }
  };

  const remove = (s: PhotoSlot | 'cover') =>
    s === 'cover' || s.slot === 'cover'
      ? run(() => replaceItemPhoto(kind as 'community' | 'activity', id, null, why, setStep), tx('Photo removed'))
      : run(() => removeMemberPhoto(s.slot === 'match' ? 'match' : (kind as 'profile' | 'community_post' | 'irl_post'), id, s.path, why), tx('Photo removed'));

  return (
    <Card>
      <View style={adminStyles.row}>
        <Icon name="image" size={16} color={t.c.textSecondary} />
        <Text variant="label" style={{ flex: 1 }}>
          Photos
        </Text>
        {data ? (
          <Text variant="caption" tone="tertiary" raw>
            {String(slots.length)}
          </Text>
        ) : null}
      </View>
      {error ? (
        <View style={{ gap: 6 }}>
          <Text variant="bodyS" tone="secondary">
            {tx(error)}
          </Text>
          <Button size="sm" label="Try again" variant="secondary" onPress={reload} />
        </View>
      ) : !data ? (
        <ActivityIndicator color={t.c.text} />
      ) : slots.length ? (
        <PhotoGrid min={140} columns={cover ? 1 : undefined}>
          {(w) =>
            slots.map((s, i) => {
              const uri = s.slot === 'match' ? matchLinks[s.path] : links[s.media === 'video' ? (s.thumb ?? '') : s.path];
              return (
                <View key={`${s.slot}|${s.path}`} style={{ width: w, gap: 6 }}>
                  <View style={[styles.tile, cover ? styles.wide : null, { backgroundColor: t.c.overlay }, confirm === s ? { borderWidth: 2, borderColor: t.c.live } : null]}>
                    {uri ? (
                      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={tx(SLOT_LABEL[s.slot])} />
                    ) : (
                      <View style={styles.center}>
                        <Icon name={s.media === 'video' ? 'video' : 'image'} size={20} color={t.c.textTertiary} />
                        <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                          {s.slot === 'match' ? 'Shown to IRLY Girl members only' : 'Not shown to your role'}
                        </Text>
                      </View>
                    )}
                    {s.media === 'video' ? (
                      <View style={styles.badge}>
                        <Icon name="play" size={12} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </View>
                  <Text variant="caption" tone="secondary" numberOfLines={1} raw>
                    {tx(SLOT_LABEL[s.slot])}
                    {slots.filter((x) => x.slot === s.slot).length > 1 ? ` ${slots.filter((x) => x.slot === s.slot).indexOf(s) + 1}` : ''}
                    {i === 0 && s.slot === 'profile' ? ` · ${tx('shown next to the name')}` : ''}
                  </Text>
                  {canRemove && !(cover && canReplace) ? (
                    <Button size="sm" label="Remove…" variant="ghost" disabled={busy} onPress={() => setConfirm(s)} />
                  ) : null}
                </View>
              );
            })
          }
        </PhotoGrid>
      ) : (
        <Text variant="bodyS" tone="secondary">
          {EMPTY[kind]}
        </Text>
      )}

      {picked ? (
        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="secondary">
            New photo, not saved yet:
          </Text>
          <Image source={{ uri: picked }} style={[styles.preview, { backgroundColor: t.c.overlay }]} contentFit="cover" accessibilityLabel={tx('New photo')} />
        </View>
      ) : null}

      {canReplace || canRemove ? (
        <>
          <Text variant="caption" tone="secondary">
            {cover
              ? 'The new photo replaces the old one everywhere in the app at once; the old file is deleted once nothing uses it.'
              : 'A member’s photo can only be removed (never replaced by another picture). The file is deleted once nothing uses it.'}
          </Text>
          <AdminInput value={reason} onChange={setReason} placeholder="Reason (kept in the moderation log)" label="Reason" />
          {step ? (
            <View style={adminStyles.row}>
              <ActivityIndicator color={t.c.text} />
              <Text variant="bodyS" tone="secondary">
                {STEP_LABEL[step]}
              </Text>
            </View>
          ) : null}
          {failed ? (
            <Text variant="bodyS" tone="live">
              {tx(failed)}
            </Text>
          ) : null}
          {confirm ? (
            <View style={{ gap: 8 }}>
              <Text variant="bodyS">
                {cover ? 'Remove this photo? The app shows its own photo for the category instead.' : kind === 'profile' ? 'Remove this photo from the member’s profile? The next photo, or the member’s avatar or initials, shows instead.' : 'Remove this photo? The words stay; the photo goes for everyone.'}
              </Text>
              <View style={adminStyles.row}>
                <Button size="sm" label="Remove the photo" variant="danger" disabled={why.length < 3 || busy} loading={busy} onPress={() => remove(confirm)} />
                <Button size="sm" label="Cancel" variant="ghost" disabled={busy} onPress={() => setConfirm(null)} />
              </View>
            </View>
          ) : picked ? (
            <View style={adminStyles.row}>
              <Button size="sm" label="Use this photo" icon="check" disabled={why.length < 3 || busy} loading={busy} onPress={() => run(() => replaceItemPhoto(kind as 'community' | 'activity', id, picked, why, setStep), tx('Photo replaced'))} />
              <Button size="sm" label="Cancel" variant="ghost" disabled={busy} onPress={() => setPicked(null)} />
            </View>
          ) : (
            <View style={adminStyles.row}>
              {canReplace ? (
                <Button
                  size="sm"
                  label={slots.length ? 'Replace the photo' : 'Add a photo'}
                  icon="image"
                  variant="secondary"
                  disabled={busy}
                  onPress={async () => {
                    setFailed(null);
                    const uri = await pickPhoto().catch(() => null);
                    if (uri) setPicked(uri);
                  }}
                />
              ) : null}
              {cover && canReplace && slots.length ? <Button size="sm" label="Remove the photo…" variant="ghost" disabled={busy} onPress={() => setConfirm('cover')} /> : null}
            </View>
          )}
          {why.length < 3 && (picked || confirm) ? (
            <Text variant="caption" tone="tertiary">
              Give a reason first.
            </Text>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden' },
  wide: { aspectRatio: 16 / 10, maxWidth: 520 },
  preview: { width: '100%', maxWidth: 520, aspectRatio: 16 / 10, borderRadius: radius.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: space[2] },
  badge: { position: 'absolute', right: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
