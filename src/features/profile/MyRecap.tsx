import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Rail } from '@/components/cards/Blocks';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import { CITIES } from '@/data/destinations';
import { CommunityThumb } from '@/features/community/CommunityThumb';
import { useSignedLinks } from '@/features/server/media';
import { universeInSpace, universesForSpace, type Universe } from '@/features/universe/universe';
import { t as tx, useT } from '@/i18n';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';
import { radius, space as gap } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useMemberActivities, useMemberPosts, type MemberCommunity, type ProfileActivity, type ProfilePost } from './member';
import { prefetchCommunity } from '@/features/community/prefetch';

type Filter = 'all' | Universe;

const UNIVERSE_LABEL: Record<Universe, string> = { mixte: 'IRLY Mixte', girl: 'IRLY Girl', mom: 'IRLY Mom', network: 'IRLY Network' };

/**
 * « My recap », on your own profile (it left the Home): your communities,
 * the activities you created, those you joined, and your posts, as cards.
 * Each app space shows its own: IRLY Mixte shows Mixte (and its Network
 * side), IRLY Girl shows Girl, Mom and Network (women's side), with a filter
 * by universe. Display only (features/universe): your data stays as it is,
 * and every list comes from the server as before (member_communities,
 * member_activities, your posts). « What you missed » keeps the recap of
 * what happened since your last visit (/recap).
 */
export function MyRecap({ userId, communities }: { userId: string; communities: MemberCommunity[] }) {
  const tr = useT();
  const space = useAppSpace();
  const [filter, setFilter] = useState<Filter>('all');
  const acts = useMemberActivities(userId);
  const posts = useMemberPosts(userId);
  const universes = universesForSpace(space);
  // In this space, then in the chosen universe (a post on your profile itself has none: « All » only).
  const keep = (u: Universe | null, girlOnly: boolean) => (u === null ? filter === 'all' : universeInSpace(u, girlOnly, space) && (filter === 'all' || filter === u));
  const myCommunities = communities.filter((c) => keep(c.universe ?? null, Boolean(c.girlOnly)));
  const myActivities = acts.items.filter((a) => keep(a.universe, a.girlOnly));
  const created = myActivities.filter((a) => a.role === 'created');
  const joined = myActivities.filter((a) => a.role === 'joined');
  const myPosts = posts.items.filter((p) => keep(p.universe, p.girlOnly));

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="titleM">My recap</Text>
        <Text variant="caption" tone="secondary">
          {space === 'girl' ? 'Your communities, plans and posts in IRLY Girl' : 'Your communities, plans and posts in IRLY Mixte'}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip size="sm" label={tr('All')} selected={filter === 'all'} onPress={() => setFilter('all')} raw />
        {universes.map((u) => (
          <Chip key={u} size="sm" label={UNIVERSE_LABEL[u]} selected={filter === u} onPress={() => setFilter(filter === u ? 'all' : u)} raw />
        ))}
      </ScrollView>

      <Block title="My communities" n={myCommunities.length} icon="heartHandshake" empty="No community here yet" cta={{ label: 'Explore communities', path: '/communities' }}>
        <Rail itemWidth={COMMUNITY_W}>
          {myCommunities.map((c) => (
            <CommunityCard key={c.id} c={c} />
          ))}
        </Rail>
      </Block>

      <Block title="Activities I created" n={created.length} icon="calendar" loading={acts.loading} error={acts.error} onRetry={acts.reload} empty="Nothing organised here yet" cta={{ label: 'Plan something', path: '/social' }}>
        <ActivityRail list={created} />
      </Block>

      <Block title="Activities I joined" n={joined.length} icon="users" loading={acts.loading} error={acts.error} onRetry={acts.reload} empty="No activity joined here yet" cta={{ label: 'Find a plan', path: '/discover' }}>
        <ActivityRail list={joined} />
      </Block>

      <Block title="My posts" n={myPosts.length} icon="message" loading={posts.loading} error={posts.error} onRetry={posts.reload} empty="No post here yet" cta={{ label: 'Create a post', path: '/post/new' }} more={!posts.done && myPosts.length > 0}>
        <PostRail list={myPosts} />
      </Block>

      <MissedDoor />
    </View>
  );
}

/** The recap of what happened since your last visit (/recap: discussions, your next plans, groups for you). */
function MissedDoor() {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/recap')} accessibilityRole="link" accessibilityLabel={tx('What you missed')} style={[styles.door, { borderColor: t.c.line }]}>
      <GlassLayer radius={radius.xl} />
      <View style={[styles.doorIcon, { backgroundColor: t.c.overlay }]}>
        <Icon name="sparkles" size={18} color={t.c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="titleS">What you missed</Text>
        <Text variant="caption" tone="secondary">
          Since your last visit: discussions, your next plans, groups for you
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
    </PressableScale>
  );
}

/* ───────── One part of the recap: title, count, cards or a one-line empty state ───────── */

function Block({
  title,
  n,
  icon,
  empty,
  cta,
  loading,
  error,
  onRetry,
  more,
  children,
}: {
  title: string;
  n: number;
  icon: IconName;
  empty: string;
  cta: { label: string; path: string };
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  more?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  return (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Icon name={icon} size={16} color={t.c.text} />
        <Text variant="titleS" style={{ flex: 1 }}>
          {title}
        </Text>
        {n ? (
          <Text variant="caption" tone="tertiary" raw>
            {more ? `${n}+` : String(n)}
          </Text>
        ) : null}
      </View>
      {n ? (
        children
      ) : (
        <View style={[styles.empty, { borderColor: t.c.line }]}>
          <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
            {loading ? tr('Loading…') : error && onRetry ? error : empty}
          </Text>
          {loading ? null : error && onRetry ? <Button label="Try again" size="sm" variant="secondary" onPress={onRetry} /> : <Button label={cta.label} size="sm" variant="secondary" onPress={() => router.push(cta.path as never)} />}
        </View>
      )}
    </View>
  );
}

/** The universe a card belongs to, on its photo. */
function UniverseBadge({ u }: { u: Universe }) {
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text variant="caption" color="#FFFFFF" numberOfLines={1} raw>
        {UNIVERSE_LABEL[u]}
      </Text>
    </View>
  );
}

function CommunityCard({ c }: { c: MemberCommunity }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const city = CITIES[c.cityId as keyof typeof CITIES];
  const members = tr('{n} members', { n: c.members });
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPressIn={() => prefetchCommunity(c.id)} onPress={() => router.push(`/c/${c.id}`)} accessibilityRole="link" accessibilityLabel={[c.name, c.universe ? UNIVERSE_LABEL[c.universe] : null, members].filter(Boolean).join(', ')} style={[styles.card, { width: COMMUNITY_W, borderColor: t.c.line }]}>
      <GlassLayer radius={radius.lg} />
      {/* Its own photo (signed link, cached; a broken one is asked again), else IRLY's photo of its subject. */}
      <View style={styles.cover}>
        <CommunityThumb id={c.id} name={c.name} coverPath={c.cover} topic={c.topic} categoryId={c.categoryId} light={city?.light ?? 'dubai'} size="100%" height={COVER_H} />
        {c.universe ? <UniverseBadge u={c.universe} /> : null}
      </View>
      <View style={styles.text}>
        <Text variant="titleS" numberOfLines={1} raw>
          {c.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1} raw>
          {members}
        </Text>
        {c.role === 'created' || c.retired ? (
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {c.retired ? 'No longer listed' : 'You created it'}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function ActivityRail({ list }: { list: ProfileActivity[] }) {
  const covers = useSignedLinks('activity-photos', list.map((a) => a.cover));
  return (
    <Rail itemWidth={ACTIVITY_W}>
      {list.slice(0, 20).map((a) => (
        <ActivityCard key={a.id} a={a} cover={a.cover ? covers[a.cover] : undefined} />
      ))}
    </Rail>
  );
}

function ActivityCard({ a, cover }: { a: ProfileActivity; cover?: string }) {
  const t = useTheme();
  const router = useRouter();
  const state: Record<ProfileActivity['state'], { label: string; color: string }> = {
    upcoming: { label: 'Upcoming', color: t.c.textSecondary },
    live: { label: 'Happening now', color: t.c.live },
    past: { label: 'Ended', color: t.c.textTertiary },
    cancelled: { label: 'Cancelled', color: t.c.critical },
  };
  const s = state[a.state];
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={() => router.push(`/a/${a.id}`)} accessibilityRole="link" accessibilityLabel={`${a.title}, ${tx(s.label)}`} style={[styles.card, { width: ACTIVITY_W, borderColor: t.c.line }]}>
      <GlassLayer radius={radius.lg} />
      <View style={[styles.cover, { backgroundColor: t.c.overlay }]}>
        {/* No uploaded cover: the activity's own photo (padel, brunch…), never a blank tile. */}
        <Photo
          visual={{ photo: ideaPhoto(a.categoryId in CATEGORY_BY_ID ? (a.categoryId as CategoryKey) : 'sport', a.title, a.placeName ?? undefined), uri: cover }}
          light="dubai"
          width={360}
          recyclingKey={`srv-${a.id}`}
          style={StyleSheet.absoluteFill}
        />
        {a.universe ? <UniverseBadge u={a.universe} /> : null}
      </View>
      <View style={styles.text}>
        <Text variant="titleS" numberOfLines={1} raw>
          {a.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1} raw>
          {cityWhen(a.startsAt, a.cityId)}
        </Text>
        <Text variant="caption" color={s.color} numberOfLines={1}>
          {tx(s.label)} · {tx(a.going === 1 ? '1 going' : '{n} going', { n: a.going })}
        </Text>
      </View>
    </PressableScale>
  );
}

function PostRail({ list }: { list: ProfilePost[] }) {
  // A photo post: its first photo; a video: its poster.
  const pics = useSignedLinks('post-media', list.map((p) => (p.mediaKind === 'video' ? p.thumbPath : p.mediaPaths[0])));
  return (
    <Rail itemWidth={POST_W}>
      {list.slice(0, 20).map((p) => {
        const path = p.mediaKind === 'video' ? p.thumbPath : p.mediaPaths[0];
        return <PostCard key={p.id} p={p} pic={path ? pics[path] : undefined} />;
      })}
    </Rail>
  );
}

function PostCard({ p, pic }: { p: ProfilePost; pic?: string }) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const where = p.communityId ? p.communityName : tx('Profile');
  const when = timeAgo(Math.max(0, Math.round((now - p.at) / 60000)));
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.97}
      onPress={() => router.push(`/comments?type=community_post&id=${p.id}`)}
      accessibilityRole="link"
      accessibilityLabel={p.communityId ? tx('Post in {name}', { name: p.communityName }) : tx('Post on the profile')}
      style={[styles.card, { width: POST_W, borderColor: t.c.line }]}
    >
      <GlassLayer radius={radius.lg} />
      {pic ? (
        <View style={[styles.cover, { backgroundColor: t.c.overlay }]}>
          <Photo visual={{ photo: 'meeting', uri: pic }} light="dubai" width={440} recyclingKey={`post-${p.id}`} style={StyleSheet.absoluteFill} />
          {p.mediaKind === 'video' ? (
            <View style={styles.play} pointerEvents="none">
              <Icon name="play" size={14} color="#FFFFFF" />
            </View>
          ) : null}
          {p.universe ? <UniverseBadge u={p.universe} /> : null}
        </View>
      ) : null}
      <View style={[styles.text, pic ? null : styles.textOnly]}>
        <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
          {where} · {when}
        </Text>
        <Text variant="bodyS" numberOfLines={pic ? 2 : 5} raw>
          {p.body || (p.mediaKind === 'video' ? tx('A video') : tx('{n} photos', { n: p.mediaPaths.length }))}
        </Text>
        <View style={styles.meta}>
          <Icon name="heart" size={13} color={p.liked ? t.c.live : t.c.textTertiary} />
          <Text variant="caption" tone="tertiary">
            {p.likes}
          </Text>
          <Icon name="message" size={13} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary">
            {p.comments}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const COMMUNITY_W = 210;
const ACTIVITY_W = 190;
const POST_W = 210;
const COVER_H = 112;

const styles = StyleSheet.create({
  root: { marginTop: gap[6], gap: gap[4] },
  head: { paddingHorizontal: gap.gutter, gap: 2 },
  chips: { paddingHorizontal: gap.gutter, gap: 8 },
  block: { gap: gap[3] },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: gap.gutter },
  empty: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: gap.gutter, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  cover: { height: COVER_H, overflow: 'hidden' },
  text: { padding: 12, gap: 2 },
  textOnly: { minHeight: COVER_H + 60, gap: 6 },
  badge: { position: 'absolute', top: 8, left: 8, maxWidth: '85%', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)' },
  play: { position: 'absolute', right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  door: { marginHorizontal: gap.gutter, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, overflow: 'hidden' },
  doorIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
});
