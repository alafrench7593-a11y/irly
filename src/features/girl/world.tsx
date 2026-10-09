import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { ActionBar } from '@/components/social/ActionBar';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { useAccount } from '@/features/auth/account';
import { openReport } from '@/features/moderation/reportStore';
import { useEngagement } from '@/features/server/engage';
import type { ServerActivity } from '@/features/server/activities';
import { useRefreshOn } from '@/features/server/sync';
import { t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { supabase, topic } from '@/lib/supabase';
import { cityWhen, offsetOf, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { girlPhotoFor } from './photos';
import { girl } from './theme';
import { GButton } from './ui';

/* ───────── Kinds of plans ───────── */

export type Kind = { id: string; label: string; icon: IconName; photo: PhotoKey; match: RegExp; cats?: string[] };

/**
 * What women plan together in IRLY Girl. Each kind has its own photo (no
 * two alike on the screen) and recognises activities by their words or
 * their category, so a kind filters the real upcoming plans.
 */
export const GIRL_KINDS: Kind[] = [
  { id: 'brunch', label: 'Brunch', icon: 'coffee', photo: 'brunch', match: /brunch/i },
  { id: 'coffee', label: 'Girls’ coffee', icon: 'coffee', photo: 'girlCoffee', match: /coffee|café|cafe|matcha/i },
  { id: 'shopping', label: 'Shopping', icon: 'shoppingBag', photo: 'girlShopping', match: /shopping|fashion|mall|market/i },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', photo: 'girlFitness', match: /fitness|gym|run|padel|tennis|workout|surf|boxing/i, cats: ['sport'] },
  { id: 'pilates', label: 'Pilates', icon: 'activity', photo: 'girlClass', match: /pilates|barre/i },
  { id: 'yoga', label: 'Yoga', icon: 'leaf', photo: 'yoga', match: /yoga|breath|meditat/i },
  { id: 'beach', label: 'Beach', icon: 'sun', photo: 'girlSunset', match: /beach|plage|sunset|swim/i, cats: ['beach'] },
  { id: 'dinner', label: 'Restaurants', icon: 'utensils', photo: 'girlDinner', match: /dinner|dîner|restaurant|lunch|food/i, cats: ['food'] },
  { id: 'travel', label: 'Travel', icon: 'plane', photo: 'girlTravel', match: /travel|trip|voyage|getaway|weekend away/i, cats: ['travel'] },
  { id: 'hike', label: 'Hiking', icon: 'mountain', photo: 'girlHike', match: /hik|trek|randonn|waterfall|nature/i, cats: ['outdoor'] },
  { id: 'wellness', label: 'Wellness', icon: 'sparkles', photo: 'girlSpa', match: /wellness|spa|self.?care|massage|beauty/i, cats: ['wellness'] },
  { id: 'culture', label: 'Culture', icon: 'landmark', photo: 'gallery', match: /museum|gallery|exhibit|theat|concert|culture|cinema/i, cats: ['culture'] },
  { id: 'network', label: 'Networking', icon: 'briefcase', photo: 'girlWork', match: /network|entrepreneur|founder|business|cowork|career/i, cats: ['networking'] },
  { id: 'create', label: 'Book club & workshops', icon: 'palette', photo: 'girlBookClub', match: /book|workshop|atelier|art|paint|pottery|craft/i },
];

/** IRLY Moms: plans with (or around) the children. */
export const MOM_KINDS: Kind[] = [
  { id: 'park', label: 'Park & playdates', icon: 'baby', photo: 'momPlaydate', match: /park|playdate|playground|picnic/i },
  { id: 'stroller', label: 'Stroller walks', icon: 'footprints', photo: 'momBaby', match: /stroller|poussette|baby walk|walk/i },
  { id: 'brunch', label: 'Moms’ brunch', icon: 'utensils', photo: 'brunch', match: /brunch/i },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', photo: 'girlCoffee', match: /coffee|café|cafe/i },
  { id: 'beach', label: 'Beach', icon: 'sun', photo: 'momBeach', match: /beach|plage/i },
  { id: 'pool', label: 'Pool & swimming', icon: 'waves', photo: 'swimming', match: /swim|pool|piscine/i },
  { id: 'sport', label: 'Moms’ sport', icon: 'activity', photo: 'momYoga', match: /yoga|pilates|fitness|football|padel|tennis|sport/i },
  { id: 'create', label: 'Creative workshops', icon: 'palette', photo: 'girlBookClub', match: /workshop|art|craft|atelier|paint/i },
  { id: 'museum', label: 'Museums & culture', icon: 'landmark', photo: 'gallery', match: /museum|gallery|culture|aquarium|zoo/i },
  { id: 'restaurant', label: 'Family restaurants', icon: 'utensils', photo: 'dinnerGroup', match: /restaurant|lunch|dinner|family meal/i },
  { id: 'weekend', label: 'Weekend outings', icon: 'calendar', photo: 'familyBeach', match: /weekend|outing|sortie|family day/i },
  { id: 'trip', label: 'Trips', icon: 'plane', photo: 'girlTravel', match: /trip|travel|excursion|getaway/i },
];

const matchesKind = (a: ServerActivity, k: Kind) => k.match.test(a.title) || Boolean(k.cats?.includes(a.categoryId));

/** A photo for a plan without its own: the first kind it belongs to. */
export function kindPhoto(a: ServerActivity, kinds: Kind[]): PhotoKey {
  return kinds.find((k) => matchesKind(a, k))?.photo ?? girlPhotoFor(a.title);
}

/** Horizontal rail of kinds: tap one to filter the plans below, tap again to clear. */
export const KindRail = memo(function KindRail({ kinds, value, onChange, counts }: { kinds: Kind[]; value: string | null; onChange: (id: string | null) => void; counts: Record<string, number> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {kinds.map((k, i) => {
        const on = value === k.id;
        const n = counts[k.id] ?? 0;
        return (
          <Animated.View key={k.id} entering={enter.slide(Math.min(i, 6), 60)}>
            <PressableScale
              haptic="select"
              scaleTo={0.96}
              onPress={() => onChange(on ? null : k.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={n ? tx('{kind}: {n} upcoming', { kind: tx(k.label), n }) : tx(k.label)}
              style={[styles.kind, on ? styles.kindOn : null]}
            >
              <Photo visual={{ photo: k.photo }} light="dubai" scrim="strong" width={360} style={StyleSheet.absoluteFill} />
              <View style={styles.kindTop}>
                <View style={[styles.kindIcon, on ? { backgroundColor: girl.rose } : null]}>
                  <Icon name={on ? 'check' : k.icon} size={14} color={on ? '#FFFFFF' : girl.ink} />
                </View>
                {n ? (
                  <View style={styles.kindCount}>
                    <Text variant="caption" color={girl.ink} raw>
                      {n}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text variant="titleS" color="#FFFFFF" numberOfLines={2} style={styles.kindLabel}>
                {k.label}
              </Text>
            </PressableScale>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
});

/* ───────── Upcoming plans ───────── */

type When = 'all' | 'today' | 'week' | 'weekend';

const WHEN: { id: When; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'weekend', label: 'This weekend' },
];

const DAY = 86_400_000;

/** Is this plan today / this week / this weekend, in the city's own clock (UAE +4, Bali +8)? */
function inWindow(startsAt: number, when: When, cityId: string, now: number): boolean {
  if (when === 'all') return true;
  const off = offsetOf(cityId) * 3_600_000;
  const local = now + off;
  const today = Math.floor(local / DAY);
  const day = Math.floor((startsAt + off) / DAY);
  if (when === 'today') return day === today;
  if (when === 'week') return day >= today && day < today + 7;
  // Saturday and Sunday (UAE and Bali alike); on a weekend day, this one.
  const dow = new Date(today * DAY).getUTCDay();
  const toSat = dow === 0 ? -1 : (6 - dow + 7) % 7;
  const sat = today + toSat;
  return day >= Math.max(today, sat) && day <= sat + 1;
}

/**
 * The next plans of IRLY Girl (or Moms): filter by moment, free, and kind.
 * Cards open the real activity (join, leave, chat live there). Nothing is
 * shown that does not exist: when nothing matches, an invitation to plan
 * the first one.
 */
export function Upcoming({
  activities,
  kinds,
  kind,
  onKind,
  onPlan,
  emptyTitle,
}: {
  activities: ServerActivity[];
  kinds: Kind[];
  kind: string | null;
  onKind: (id: string | null) => void;
  onPlan: () => void;
  emptyTitle: string;
}) {
  const router = useRouter();
  const now = useNow();
  const reduced = useReducedMotion();
  const [when, setWhen] = useState<When>('all');
  const [free, setFree] = useState(false);
  const [more, setMore] = useState(false);
  const k = kinds.find((x) => x.id === kind) ?? null;

  const list = useMemo(
    () => activities.filter((a) => inWindow(a.startsAt, when, a.cityId, now) && (!free || a.priceMinor === 0) && (!k || matchesKind(a, k))),
    [activities, when, free, k, now],
  );
  const shown = more ? list : list.slice(0, 5);
  const filtered = when !== 'all' || free || Boolean(k);

  return (
    <View style={{ gap: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {WHEN.map((w) => (
          <Chip key={w.id} label={w.label} on={when === w.id} onPress={() => setWhen(w.id)} />
        ))}
        <Chip label="Free" icon="ticket" on={free} onPress={() => setFree((f) => !f)} />
        {k ? <Chip label={k.label} icon="x" on onPress={() => onKind(null)} /> : null}
      </ScrollView>

      <Animated.View layout={reduced ? undefined : LinearTransition.springify(420).dampingRatio(0.9)} style={{ gap: 10, paddingHorizontal: space.gutter }}>
        {shown.map((a, i) => (
          <Animated.View key={a.id} entering={reduced ? undefined : enter.rise(Math.min(i, 5))}>
            <PlanRow a={a} photo={kindPhoto(a, kinds)} onPress={() => router.push(`/a/${a.id}`)} />
          </Animated.View>
        ))}
        {list.length > 5 && !more ? <GButton label={tx('Show all {n}', { n: list.length })} variant="ghost" onPress={() => setMore(true)} /> : null}
        {!list.length ? (
          <Animated.View entering={FadeIn} style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Icon name="sparkles" size={20} color={girl.rose} />
            </View>
            <Text variant="titleM" color={girl.ink} align="center">
              {filtered ? 'Nothing planned here yet' : emptyTitle}
            </Text>
            <Text variant="bodyS" color={girl.inkSoft} align="center">
              {filtered ? 'Change the filters, or plan it yourself: it takes a minute.' : 'Pick a moment and a place, and others join you.'}
            </Text>
            <GButton label="Plan it" onPress={onPlan} />
            {filtered ? (
              <GButton
                label="Clear filters"
                variant="ghost"
                onPress={() => {
                  setWhen('all');
                  setFree(false);
                  onKind(null);
                }}
              />
            ) : null}
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const PlanRow = memo(function PlanRow({ a, photo, onPress }: { a: ServerActivity; photo: PhotoKey; onPress: () => void }) {
  const full = a.capacity != null && a.going >= a.capacity;
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} accessibilityLabel={`${a.title}, ${cityWhen(a.startsAt, a.cityId)}`} style={styles.plan}>
      <View style={styles.planPhoto}>
        <Photo visual={{ photo, uri: a.coverUrl }} light="dubai" width={300} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ flex: 1, gap: 3, paddingVertical: 2 }}>
        <Text variant="caption" color={girl.rose}>
          {cityWhen(a.startsAt, a.cityId)}
        </Text>
        <Text variant="titleS" color={girl.ink} numberOfLines={2} raw>
          {a.title}
        </Text>
        <View style={styles.meta}>
          {a.placeName ? (
            <Text variant="caption" color={girl.inkSoft} numberOfLines={1} raw style={{ flexShrink: 1 }}>
              {a.placeName}
            </Text>
          ) : null}
          <Text variant="caption" color={girl.inkSoft}>
            {a.capacity ? tx('{n}/{max} going', { n: a.going, max: a.capacity }) : tx('{n} going', { n: a.going })}
          </Text>
          <Text variant="caption" color={girl.inkSoft}>
            {a.priceMinor === 0 ? tx('Free') : `${(a.priceMinor / 100).toFixed(0)} ${a.currency}`}
          </Text>
        </View>
      </View>
      {a.joined ? (
        <View style={[styles.badge, { backgroundColor: girl.ink }]}>
          <Icon name="check" size={12} color="#FFFFFF" />
          <Text variant="caption" color="#FFFFFF">
            Going
          </Text>
        </View>
      ) : full ? (
        <View style={[styles.badge, { backgroundColor: girl.cream }]}>
          <Text variant="caption" color={girl.inkSoft}>
            Full
          </Text>
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={girl.inkFaint} />
      )}
    </PressableScale>
  );
});

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <PressableScale haptic="select" scaleTo={0.95} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={tx(label)} style={[styles.chip, on ? { backgroundColor: girl.ink, borderColor: girl.ink } : null]}>
      {icon ? <Icon name={icon} size={13} color={on ? '#FFFFFF' : girl.ink} /> : null}
      <Text variant="label" color={on ? '#FFFFFF' : girl.ink}>
        {label}
      </Text>
    </PressableScale>
  );
}

/* ───────── Feed ───────── */

export type GirlPost = {
  id: string;
  communityId: string;
  communityName: string;
  authorId: string;
  firstName: string;
  body: string;
  activityId: string | null;
  activityTitle: string | null;
  activityStartsAt: number | null;
  createdAt: number;
  mine: boolean;
  isMember: boolean;
};

/**
 * Recent posts of the women-only communities of this destination (Moms:
 * the family ones), from the server, live. Same posts as the community
 * pages: liking or commenting here is liking or commenting there.
 */
export function useGirlFeed(cityId: string, moms: boolean) {
  const account = useAccount();
  const uid = account?.userId;
  const [posts, setPosts] = useState<GirlPost[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const seq = useRef(0);

  const fetchPosts = useCallback(async (): Promise<GirlPost[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase.rpc('girl_feed', { p_city: cityId, p_moms: moms, p_limit: 20 });
    if (error) throw new Error(error.message);
    return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
      id: r.id as string,
      communityId: r.community_id as string,
      communityName: r.community_name as string,
      authorId: r.author_id as string,
      firstName: (r.first_name as string) ?? '',
      body: r.body as string,
      activityId: (r.activity_id as string) ?? null,
      activityTitle: (r.activity_title as string) ?? null,
      activityStartsAt: r.activity_starts_at ? Date.parse(r.activity_starts_at as string) : null,
      createdAt: Date.parse(r.created_at as string),
      mine: Boolean(r.mine),
      isMember: Boolean(r.is_member),
    }));
  }, [cityId, moms, uid]);

  // Loads can finish out of order (a burst of changes): only the newest lands.
  const load = useCallback(() => {
    const n = ++seq.current;
    fetchPosts()
      .then((p) => {
        if (n !== seq.current) return;
        setPosts(p);
        setState('ready');
      })
      .catch(() => n === seq.current && setState('error'));
  }, [fetchPosts]);

  useRefreshOn(['communities'], load);

  useEffect(() => {
    load();
    if (!supabase || !uid) return;
    // New, edited or removed posts: the read rules decide what reaches us.
    const channel = supabase
      .channel(topic(`girl-feed-${cityId}-${moms ? 'moms' : 'all'}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, load)
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [load, cityId, moms, uid]);

  return { posts, state, reload: load };
}

export function GirlFeed({ cityId, moms, onCommunities }: { cityId: string; moms: boolean; onCommunities: () => void }) {
  const { posts, state, reload } = useGirlFeed(cityId, moms);
  const eng = useEngagement(
    'community_post',
    posts.map((p) => p.id),
  );
  if (state === 'loading')
    return (
      <View style={[styles.empty, { marginHorizontal: space.gutter }]}>
        <ActivityIndicator color={girl.rose} />
      </View>
    );
  if (state === 'error')
    return (
      <View style={[styles.empty, { marginHorizontal: space.gutter }]}>
        <Text variant="bodyS" color={girl.inkSoft} align="center">
          Posts could not load. Check your connection.
        </Text>
        <GButton label="Try again" variant="secondary" onPress={reload} />
      </View>
    );
  if (!posts.length)
    return (
      <Animated.View entering={FadeIn} style={[styles.empty, { marginHorizontal: space.gutter }]}>
        <View style={styles.emptyIcon}>
          <Icon name="message" size={20} color={girl.rose} />
        </View>
        <Text variant="titleM" color={girl.ink} align="center">
          {moms ? 'No posts from moms yet' : 'No posts yet'}
        </Text>
        <Text variant="bodyS" color={girl.inkSoft} align="center">
          Join a community and say hello: your post shows here for every woman nearby.
        </Text>
        <GButton label="See communities" variant="secondary" onPress={onCommunities} />
      </Animated.View>
    );
  return (
    <View style={{ gap: 12, paddingHorizontal: space.gutter }}>
      {posts.map((p, i) => (
        <Animated.View key={p.id} entering={enter.rise(Math.min(i, 4))}>
          <PostCard p={p} eng={eng} cityId={cityId} />
        </Animated.View>
      ))}
    </View>
  );
}

const PostCard = memo(function PostCard({ p, eng, cityId }: { p: GirlPost; eng: ReturnType<typeof useEngagement>; cityId: string }) {
  const router = useRouter();
  const now = useNow();
  return (
    <View style={styles.post}>
      <View style={styles.postHead}>
        <PressableScale haptic="select" scaleTo={0.94} onPress={() => (p.mine ? router.push('/girl/profile') : router.push(`/person/${p.authorId}`))} accessibilityLabel={p.mine ? 'My profile' : tx("View {name}'s profile", { name: p.firstName })}>
          <Avatar name={p.firstName} hue={hueOf(p.authorId)} size={38} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text variant="titleS" color={girl.ink} raw>
            {p.mine ? tx('You') : p.firstName}
          </Text>
          <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push(`/c/${p.communityId}`)} accessibilityLabel={tx('Open {title}', { title: p.communityName })}>
            <Text variant="caption" color={girl.rose} numberOfLines={1} raw>
              {p.communityName} · {timeAgo(Math.max(0, Math.round((now - p.createdAt) / 60000)))}
            </Text>
          </PressableScale>
        </View>
        {!p.mine ? (
          <PressableScale onPress={() => openReport({ kind: 'community_post', id: p.id, userId: p.authorId }, p.firstName)} haptic="select" hitSlop={8} accessibilityLabel="Report post">
            <Icon name="flag" size={16} color={girl.inkFaint} />
          </PressableScale>
        ) : null}
      </View>
      <Text variant="body" color={girl.ink} raw>
        {p.body}
      </Text>
      {p.activityId ? (
        <PressableScale onPress={() => router.push(`/a/${p.activityId}`)} haptic="select" scaleTo={0.98} style={styles.linked} accessibilityLabel={p.activityTitle ? tx('Open {title}', { title: p.activityTitle }) : tx('Open the activity')}>
          <Icon name="calendar" size={18} color={girl.ink} />
          <View style={{ flex: 1 }}>
            <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
              {p.activityTitle ?? tx('Activity')}
            </Text>
            {p.activityStartsAt ? (
              <Text variant="caption" color={girl.inkSoft}>
                {cityWhen(p.activityStartsAt, cityId)}
              </Text>
            ) : null}
          </View>
          <Icon name="chevronRight" size={16} color={girl.inkSoft} />
        </PressableScale>
      ) : null}
      <ActionBar target={{ type: 'community_post', id: p.id, title: p.body.slice(0, 60) }} eng={eng} />
    </View>
  );
});

/* ───────── Shortcuts under the hero ───────── */

export function Shortcuts({ items }: { items: { icon: IconName; label: string; onPress: () => void }[] }) {
  return (
    <View style={styles.shortcuts}>
      {items.map((s, i) => (
        <Animated.View key={s.label} entering={enter.pop(i, 180)} style={{ flex: 1 }}>
          <PressableScale haptic="select" scaleTo={0.94} onPress={s.onPress} accessibilityRole="button" accessibilityLabel={tx(s.label)} style={styles.shortcut}>
            <View style={styles.shortcutIcon}>
              <Icon name={s.icon} size={18} color={girl.rose} />
            </View>
            <Text variant="caption" color={girl.ink} align="center" numberOfLines={1} style={{ fontSize: 11 }}>
              {s.label}
            </Text>
          </PressableScale>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: space.gutter, gap: 10 },
  kind: { width: 132, height: 168, borderRadius: radius.lg, overflow: 'hidden', padding: 10, justifyContent: 'space-between', boxShadow: girl.shadowSoft },
  kindOn: { borderWidth: 2, borderColor: girl.rose },
  kindTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: girl.glass, alignItems: 'center', justifyContent: 'center' },
  kindCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  kindLabel: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  chips: { paddingHorizontal: space.gutter, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: girl.line, backgroundColor: girl.surface },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  planPhoto: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: girl.cream },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  empty: { alignItems: 'center', gap: 10, padding: 22, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  emptyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: girl.blush, alignItems: 'center', justifyContent: 'center' },
  post: { gap: 10, padding: 14, borderRadius: radius.xl, backgroundColor: girl.surface, boxShadow: girl.shadowSoft },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: girl.bg },
  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: space.gutter, marginTop: space[4] },
  shortcut: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 2, borderRadius: radius.lg, backgroundColor: girl.surface, boxShadow: girl.shadow },
  shortcutIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: girl.blush, alignItems: 'center', justifyContent: 'center' },
});
