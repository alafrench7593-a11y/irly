import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip, Field, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { isModerator, loadPhotos, type PhotoKind, type PhotoRow } from '@/features/admin/api';
import { editorialGroups, EDITORIAL_LABEL, PhotoGrid, type EditorialGroupId } from '@/features/admin/photos';
import { adminStyles, ago, Loadable, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { usePhotoOverrideRows } from '@/features/photo/overrides';
import { useSignedLinks } from '@/features/server/media';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'app' | 'members';
const GROUPS: EditorialGroupId[] = ['discover', 'intro', 'categories', 'catalogue', 'official', 'home', 'girl', 'all'];
const KINDS: { value: PhotoKind; label: string }[] = [
  { value: 'community', label: 'Communities' },
  { value: 'activity', label: 'Activities' },
  { value: 'community_post', label: 'Posts' },
  { value: 'irl_post', label: 'Lives' },
  { value: 'profile', label: 'Profiles' },
];

/**
 * Every photo the app shows, for the team: IRLY's own photos (categories,
 * catalogue, official communities, Home, IRLY Girl and IRLY Mom Community), which
 * content staff replace for everyone without a new app version, and the
 * photos members put on their communities, activities, posts, Lives and
 * profiles, each opening the sheet where it can be replaced or removed.
 * Verification selfies are never shown here (Profile verifications).
 */
export default function AdminPhotos() {
  const p = useLocalSearchParams<{ tab?: string; group?: string; kind?: string }>();
  const role = useAdminRole();
  const [tab, setTab] = useState<Tab>(p.tab === 'members' ? 'members' : 'app');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  if (role === null) {
    return (
      <Page title="Photos">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }
  return (
    <Page title="Photos" subtitle="Every photo the app shows: IRLY’s own, and the ones members add.">
      <View style={adminStyles.body}>
        <Segmented<Tab>
          options={[
            { value: 'app', label: 'IRLY photos' },
            { value: 'members', label: 'Member photos' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Field icon="search" value={search} onChangeText={setSearch} placeholder={tab === 'app' ? 'Category, activity, place or key' : 'Name, words, author or id'} accessibilityLabel="Search photos" autoCapitalize="none" />
        {tab === 'app' ? (
          <AppPhotos q={q} initial={GROUPS.includes(p.group as EditorialGroupId) ? (p.group as EditorialGroupId) : 'discover'} />
        ) : (
          <MemberPhotos q={q} profiles={isModerator(role)} initial={KINDS.some((k) => k.value === p.kind) ? (p.kind as PhotoKind) : 'community'} />
        )}
      </View>
    </Page>
  );
}

function AppPhotos({ q, initial }: { q: string; initial: EditorialGroupId }) {
  const t = useTheme();
  const [group, setGroup] = useState<EditorialGroupId>(initial);
  const replaced = usePhotoOverrideRows();
  const all = editorialGroups();
  const items = useMemo(() => {
    const needle = q.toLowerCase();
    const list = all.find((g) => g.id === group)?.items ?? [];
    return needle ? list.filter((i) => i.key.toLowerCase().includes(needle) || i.uses.some((u) => u.toLowerCase().includes(needle) || tx(u).toLowerCase().includes(needle))) : list;
  }, [all, group, q]);
  const changed = new Set(replaced.map((r) => r.key));

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {GROUPS.map((g) => (
          <Chip key={g} size="sm" label={EDITORIAL_LABEL[g]} selected={group === g} onPress={() => setGroup(g)} />
        ))}
      </ScrollView>
      <Text variant="caption" tone="tertiary">
        {tx('{n} photos. A photo can show in several places: replacing it changes all of them.', { n: items.length })}
      </Text>
      {group === 'official' ? (
        <PressableScale onPress={() => router.push('/admin/communities?filter=official')} haptic="select" style={[styles.link, { backgroundColor: t.c.overlay }]} accessibilityLabel={tx('Official communities with their own photo')}>
          <Icon name="network" size={16} color={t.c.text} />
          <Text variant="bodyS" style={{ flex: 1 }}>
            An official community with its own photo: open it in Communities.
          </Text>
          <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
        </PressableScale>
      ) : null}
      {items.length ? (
        <PhotoGrid>
          {(w) =>
            items.slice(0, 120).map((i) => (
              <PressableScale key={i.key} onPress={() => router.push({ pathname: '/admin/photo', params: { key: i.key } })} haptic="select" scaleTo={0.97} style={{ width: w, gap: 6 }} accessibilityLabel={tx('Photo: {name}', { name: i.label })}>
                <Photo visual={{ photo: i.key as PhotoKey }} light="dubai" width={w} pinned style={[styles.tile, { width: w }]} recyclingKey={`admin-${i.key}`}>
                  {changed.has(i.key) ? (
                    <View style={styles.flag}>
                      <Text variant="caption" style={{ color: '#FFFFFF' }}>
                        Replaced
                      </Text>
                    </View>
                  ) : null}
                </Photo>
                <Text variant="caption" numberOfLines={1} raw>
                  {tx(i.label)}
                </Text>
                {i.uses.length > 1 ? (
                  <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
                    {tx('and {n} more', { n: i.uses.length - 1 })}
                  </Text>
                ) : null}
              </PressableScale>
            ))
          }
        </PhotoGrid>
      ) : (
        <Text variant="body" tone="secondary">
          No photo here.
        </Text>
      )}
      {items.length > 120 ? (
        <Text variant="caption" tone="tertiary">
          {tx('Showing 120 of {n}: search to find the others.', { n: items.length })}
        </Text>
      ) : null}
    </>
  );
}

const SHEET: Record<PhotoKind, (id: string) => string> = {
  community: (id) => `/admin/community/${id}`,
  activity: (id) => `/admin/item?kind=activity&id=${id}`,
  community_post: (id) => `/admin/item?kind=community_post&id=${id}`,
  irl_post: (id) => `/admin/item?kind=irl_post&id=${id}`,
  profile: (id) => `/admin/user/${id}`,
};

function MemberPhotos({ q, profiles, initial }: { q: string; profiles: boolean; initial: PhotoKind }) {
  const [kind, setKind] = useState<PhotoKind>(initial === 'profile' && !profiles ? 'community' : initial);
  const { data, error, reload } = useLoad<PhotoRow[]>(() => loadPhotos(kind, q), `${kind}|${q}`);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {KINDS.filter((k) => profiles || k.value !== 'profile').map((k) => (
          <Chip key={k.value} size="sm" label={k.label} selected={kind === k.value} onPress={() => setKind(k.value)} />
        ))}
      </ScrollView>
      <Text variant="caption" tone="tertiary">
        {kind === 'community' || kind === 'activity'
          ? 'Latest with their own photo; search to find any, with or without one.'
          : 'Latest with photos or videos. A member’s photo can be removed, never replaced.'}
      </Text>
      <Loadable data={data} error={error} retry={reload} empty={tx('No photo here.')}>
        {(rows) => <MemberGrid rows={rows} />}
      </Loadable>
    </>
  );
}

function MemberGrid({ rows }: { rows: PhotoRow[] }) {
  const t = useTheme();
  const bucket = rows[0]?.bucket ?? 'activity-photos';
  const links = useSignedLinks(bucket, rows.map((r) => r.paths[0]));
  return (
    <PhotoGrid>
      {(w) =>
        rows.map((r) => {
          const uri = r.paths[0] ? links[r.paths[0]] : undefined;
          return (
            <PressableScale key={`${r.kind}|${r.id}`} onPress={() => router.push(SHEET[r.kind](r.id))} haptic="select" scaleTo={0.97} style={{ width: w, gap: 4 }} accessibilityLabel={r.title ?? tx('Photo')}>
              <View style={[styles.tile, { width: w, backgroundColor: t.c.overlay }]}>
                {uri ? (
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={r.id} accessibilityIgnoresInvertColors />
                ) : (
                  <View style={styles.center}>
                    <Icon name={r.paths.length ? 'image' : 'camera'} size={20} color={t.c.textTertiary} />
                    <Text variant="caption" tone="tertiary">
                      {r.paths.length ? 'Not shown to your role' : 'No own photo'}
                    </Text>
                  </View>
                )}
                {r.media === 'video' ? (
                  <View style={styles.badge}>
                    <Icon name="play" size={12} color="#FFFFFF" />
                  </View>
                ) : null}
                {r.paths.length > 1 ? (
                  <View style={styles.flag}>
                    <Text variant="caption" style={{ color: '#FFFFFF' }} raw>
                      {String(r.paths.length)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="caption" numberOfLines={1} raw>
                {r.title ?? r.owner_name ?? '—'}
              </Text>
              <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
                {[r.owner_name, ago(r.created_at), r.girl_only ? 'IRLY Girl' : null, r.hidden ? tx('Hidden by the team') : null].filter(Boolean).join(' · ')}
              </Text>
            </PressableScale>
          );
        })
      }
    </PhotoGrid>
  );
}

const styles = StyleSheet.create({
  tile: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  flag: { position: 'absolute', left: 8, top: 8, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  badge: { position: 'absolute', right: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
});
