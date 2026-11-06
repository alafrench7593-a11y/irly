import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { Avatar } from '@/components/ui/Avatar';
import { Chip, Field } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Ambient } from '@/components/visual/Ambient';
import { Photo } from '@/components/visual/Photo';
import { DEMO_PLANS } from '@/data/content/girlDemo';
import type { PhotoKey } from '@/data/photos';
import { findPerson } from '@/data/repo';
import { demoPostsOf, findDemoCommunity, isDemoId, planStartsAt } from '@/features/girl/demo';
import { useSignedLinks } from '@/features/server/media';
import { a11y, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { MediaViewer, type GalleryItem } from './MediaGallery';
import { SEARCH_FILTERS, SEARCH_MIN, searchCommunity, type SearchFilter, type SearchHit } from './space';

/**
 * Search inside one community: posts, announcements, activities, members
 * and media, with filters (All, Recent, Popular, Media, Activities,
 * Members, Pinned). A result opens the post, the activity, the profile or
 * the photo. The demo build searches its example content.
 */

type Hit = SearchHit & { photo?: PhotoKey };

const ICON: Record<SearchHit['kind'], IconName> = { post: 'message', announcement: 'megaphone', activity: 'calendar', member: 'user', media: 'image' };
const KIND_LABEL: Record<SearchHit['kind'], string> = { post: 'A post', announcement: 'Announcement', activity: 'Activity', member: 'Member', media: 'Photo' };

/** The demo's example content, searched on the phone (nothing is sent). */
function searchDemo(communityId: string, query: string, filter: SearchFilter): Hit[] {
  const q = query.trim().toLocaleLowerCase();
  if (q.length < SEARCH_MIN) return [];
  const c = findDemoCommunity(communityId);
  const has = (s: string | null | undefined) => Boolean(s && s.toLocaleLowerCase().includes(q));
  const out: Hit[] = [];
  const base = { authorId: null, authorName: null, createdAt: null, mediaKind: null, thumbPath: null, pinned: false, score: 0, title: null, snippet: null } as const;
  if (filter === 'all' || filter === 'members') {
    for (const id of c?.faces ?? []) {
      const name = findPerson(id)?.name ?? '';
      if (has(name)) out.push({ ...base, kind: 'member', id, title: name, authorId: id, authorName: name });
    }
  }
  if (filter === 'all' || filter === 'activities') {
    for (const p of DEMO_PLANS.filter((x) => x.community === communityId)) if (has(p.title) || has(p.place)) out.push({ ...base, kind: 'activity', id: p.id, title: p.title, snippet: p.place, createdAt: planStartsAt(p) });
  }
  if (filter !== 'members' && filter !== 'activities' && filter !== 'pinned') {
    for (const p of demoPostsOf(communityId)) {
      if (!has(p.body) && !has(p.firstName)) continue;
      if (filter === 'media' && !p.photo) continue;
      out.push({ ...base, kind: filter === 'media' ? 'media' : 'post', id: p.id, snippet: p.body, authorId: p.authorId, authorName: p.firstName, createdAt: p.createdAt, mediaKind: p.photo ? 'photo' : null, photo: p.photo });
    }
  }
  return out;
}

export function CommunitySearchScreen({ id, name }: { id: string; name?: string }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const demo = isDemoId(id);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ key: string; hits: Hit[]; error: string | null; end: boolean }>({ key: '', hits: [], error: null, end: true });
  const [more, setMore] = useState(false);
  const [viewing, setViewing] = useState<GalleryItem | null>(null);
  const seq = useRef(0);
  // Typing searches after a short pause, not on every letter.
  useEffect(() => {
    const h = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(h);
  }, [query]);
  const key = `${filter}|${q}`;
  const ready = q.length >= SEARCH_MIN;
  const demoHits = useMemo(() => (demo ? searchDemo(id, q, filter) : null), [demo, id, q, filter]);
  useEffect(() => {
    if (!ready || demo) return;
    const n = ++seq.current;
    searchCommunity(id, q, filter)
      .then((hits) => n === seq.current && setState({ key, hits, error: null, end: hits.length < 30 || filter === 'popular' }))
      .catch((e: unknown) => n === seq.current && setState({ key, hits: [], error: e instanceof Error ? e.message : 'Can’t reach IRLY right now', end: true }));
  }, [id, q, filter, key, ready, demo]);

  const loading = ready && !demo && state.key !== key;
  const hits = useMemo(() => (!ready ? [] : demoHits ?? (state.key === key ? state.hits : [])), [ready, demoHits, state, key]);
  const loadMore = useCallback(() => {
    if (demo || loading || more || state.end || !hits.length) return;
    const last = hits.reduce((m, h) => (h.createdAt != null ? Math.min(m, h.createdAt) : m), Infinity);
    if (!Number.isFinite(last)) return;
    const n = seq.current;
    setMore(true);
    searchCommunity(id, q, filter, { before: last })
      .then((next) => {
        if (n !== seq.current) return;
        setState((s) => {
          const seen = new Set(s.hits.map((h) => `${h.kind}:${h.id}`));
          return { ...s, hits: [...s.hits, ...next.filter((h) => !seen.has(`${h.kind}:${h.id}`))], end: next.length < 30 };
        });
      })
      .catch(() => undefined)
      .finally(() => setMore(false));
  }, [demo, loading, more, state.end, hits, id, q, filter]);

  const thumbs = useSignedLinks('post-media', useMemo(() => hits.map((h) => h.thumbPath), [hits]));

  const open = (h: Hit) => {
    if (h.kind === 'member') router.push(`/person/${h.id}`);
    else if (h.kind === 'activity') router.push(`/a/${h.id}`);
    else if (h.kind === 'media' && (h.photo || (h.thumbPath && h.mediaKind === 'photo'))) setViewing({ key: `${h.id}:${h.thumbPath ?? h.photo}`, kind: 'photo', path: h.thumbPath ?? undefined, photo: h.photo, postId: demo ? null : h.id });
    else if (!demo) router.push({ pathname: '/comments', params: { type: 'community_post', id: h.id, title: (h.snippet ?? '').slice(0, 60) } });
  };

  const top = insets.top + layout.headerHeight + 8;
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <View style={{ paddingTop: top + 8, gap: 10 }}>
        <View style={styles.pad}>
          <Field icon="search" value={query} onChangeText={setQuery} placeholder={tx('Search in the community')} autoFocus accessibilityLabel={a11y('Search in the community')} testID="community-search-field" />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.pad, { gap: 8 }]}>
          {SEARCH_FILTERS.map((f) => (
            <Chip key={f.key} size="sm" label={tx(f.label)} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={hits}
        keyExtractor={(h) => `${h.kind}:${h.id}`}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.pad, { gap: 8, paddingTop: 12, paddingBottom: insets.bottom + 40 }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => <HitRow h={item} i={index} thumb={item.thumbPath ? thumbs[item.thumbPath] : undefined} onPress={() => open(item)} />}
        ListEmptyComponent={
          !ready ? (
            <Hint icon="search" text={tx('Type at least 2 letters to search posts, activities, members and photos.')} />
          ) : loading ? (
            <View style={{ gap: 8 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={68} radius={radius.lg} />
              ))}
            </View>
          ) : state.error ? (
            <Hint icon="x" text={tx(state.error)} />
          ) : (
            <Hint icon="search" text={tx('Nothing found for “{q}”', { q })} />
          )
        }
        ListFooterComponent={more ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
      />
      <MediaViewer items={viewing ? [viewing] : []} index={viewing ? 0 : null} links={thumbs} onClose={() => setViewing(null)} onOpenPost={(postId) => router.push({ pathname: '/comments', params: { type: 'community_post', id: postId } })} />
      <PageHeader title={name ? tx('Search in {name}', { name }) : tx('Search')} />
    </View>
  );
}

const HitRow = memo(function HitRow({ h, i, thumb, onPress }: { h: Hit; i: number; thumb?: string; onPress: () => void }) {
  const t = useTheme();
  const now = useNow();
  const reduced = useReducedMotion();
  const line = h.kind === 'member' ? h.title : (h.title ?? h.snippet);
  const meta = [tx(KIND_LABEL[h.kind]), h.kind !== 'member' ? h.authorName : null, h.createdAt && h.kind !== 'activity' ? timeAgo(Math.max(0, Math.round((now - h.createdAt) / 60000))) : null, h.pinned ? tx('Pinned') : null].filter(Boolean).join(' · ');
  return (
    <Animated.View entering={reduced ? undefined : enter.rise(Math.min(i, 6))}>
      <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={styles.row} accessibilityLabel={line ?? tx(KIND_LABEL[h.kind])}>
        <GlassLayer radius={radius.lg} />
        {h.kind === 'member' ? (
          <Avatar name={h.title ?? ''} hue={hueOf(h.id)} size={40} userId={h.id} />
        ) : h.photo ? (
          <View style={styles.thumb}>
            <Photo visual={{ photo: h.photo }} light="dubai" width={160} style={StyleSheet.absoluteFill} recyclingKey={`hit-${h.id}`} />
          </View>
        ) : thumb ? (
          <View style={styles.thumb}>
            <Image source={{ uri: thumb, cacheKey: h.thumbPath ?? undefined }} style={StyleSheet.absoluteFill} contentFit="cover" />
          </View>
        ) : (
          <View style={[styles.thumb, styles.icon, { backgroundColor: t.c.overlay }]}>
            <Icon name={ICON[h.kind]} size={18} color={t.c.text} />
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text variant={h.kind === 'member' || h.kind === 'activity' ? 'titleS' : 'bodyS'} raw numberOfLines={2}>
            {line ?? ''}
          </Text>
          <Text variant="caption" tone="tertiary" raw numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
      </PressableScale>
    </Animated.View>
  );
});

function Hint({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.hint}>
      <GlassLayer radius={radius.xl} />
      <Icon name={icon} size={20} color={t.c.textSecondary} />
      <Text variant="bodyS" tone="secondary" align="center" raw>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  thumb: { width: 44, height: 44, borderRadius: radius.md, overflow: 'hidden' },
  icon: { alignItems: 'center', justifyContent: 'center' },
  hint: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl, overflow: 'hidden' },
});
