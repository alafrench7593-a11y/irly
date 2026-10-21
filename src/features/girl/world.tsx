import { useRouter } from 'expo-router';
import { FEATURES } from '@/lib/features';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ActionBar } from '@/components/social/ActionBar';
import { useFrame } from '@/components/layout/AppFrame';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { PhotoKey } from '@/data/photos';
import { useAccount } from '@/features/auth/account';
import { openReport } from '@/features/moderation/reportStore';
import { useEngagement } from '@/features/server/engage';
import { PostMedia } from '@/features/posts/PostMedia';
import { DEMO } from '@/config/app';
import { demoPhoto, useDemoEngagement, useDemoGirlFeed } from './demo';
import type { ServerActivity } from '@/features/server/activities';
import { useRefreshOn } from '@/features/server/sync';
import { t as tx, formatNumber } from '@/i18n';
import { hueOf } from '@/lib/format';
import { liveChannel, supabase, whenListening } from '@/lib/supabase';
import { cityWhen, offsetOf, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { girlPhotoFor } from './photos';
import { girl, GIRL_TINT } from './theme';
import { GButton, GChip, GIconWell, GlassFill, GNotice, useGirlMotion } from './ui';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { displayCommunityName } from '@/features/community/name';

/* ───────── Kinds of plans ───────── */

export type Kind = { id: string; label: string; icon: IconName; photo: PhotoKey; match: RegExp; cats?: string[] };

/**
 * What women plan together in IRLY Girl. Each kind has its own photo (no
 * two alike on the screen) and recognises activities by their words or
 * their category, so a kind filters the real upcoming plans.
 */
export const GIRL_KINDS: Kind[] = [
  { id: 'brunch', label: 'Brunch', icon: 'coffee', photo: 'brunchGirl', match: /brunch/i },
  { id: 'coffee', label: 'Girls’ coffee', icon: 'coffee', photo: 'drinksGirl', match: /coffee|café|cafe|matcha|drinks?|juice/i },
  { id: 'shopping', label: 'Shopping', icon: 'shoppingBag', photo: 'girlShopping', match: /shopping|fashion|mall|market/i },
  { id: 'run', label: 'Running', icon: 'footprints', photo: 'runGirl', match: /\brun|jog|marathon|\b5k\b|\b10k\b/i },
  { id: 'bike', label: 'Bike rides', icon: 'bike', photo: 'bikeGirl', match: /bike|cycl|vélo/i },
  { id: 'padel', label: 'Padel', icon: 'activity', photo: 'padelGirl', match: /padel/i },
  { id: 'tennis', label: 'Tennis', icon: 'activity', photo: 'tennisGirl', match: /tennis/i },
  { id: 'golf', label: 'Golf', icon: 'flag', photo: 'golfGirl', match: /golf|driving range/i },
  { id: 'fitness', label: 'Fitness', icon: 'dumbbell', photo: 'gymGirl', match: /fitness|gym|padel|tennis|workout|surf|boxing/i, cats: ['sport'] },
  { id: 'pilates', label: 'Pilates', icon: 'activity', photo: 'pilatesGirl', match: /pilates|barre/i },
  { id: 'yoga', label: 'Yoga', icon: 'leaf', photo: 'yoga', match: /yoga|breath|meditat/i },
  // IRLY's own Dubai photos: listed before the broader kinds (a safari park is not a park, quads are not a hike).
  { id: 'globalvillage', label: 'Global Village', icon: 'globe', photo: 'globalVillage', match: /global village/i },
  { id: 'quad', label: 'Quad biking', icon: 'mountain', photo: 'quadGirl', match: /quad|atv|buggy|buggies|dune bashing/i },
  { id: 'desert', label: 'Desert', icon: 'sun', photo: 'desertGirl', match: /desert|camel|dunes?|safari(?! park)/i },
  { id: 'nightout', label: 'Girls’ night out', icon: 'sparkles', photo: 'nightDinner', match: /night out|girls.? night|rooftop|soirée|sortie|party|dinner with a view/i },
  { id: 'zoo', label: 'Zoo & safari', icon: 'pawPrint', photo: 'safariPark', match: /\bzoo\b|safari park|wildlife/i },
  { id: 'yacht', label: 'Yacht & boat', icon: 'sailboat', photo: 'yachtGirl', match: /yacht|boat|cruise|sailing|catamaran/i },
  { id: 'beach', label: 'Beach', icon: 'sun', photo: 'beachClubGirl', match: /beach|plage|sunset|swim/i, cats: ['beach'] },
  { id: 'dinner', label: 'Restaurants', icon: 'utensils', photo: 'restaurantGirl', match: /dinner|dîner|restaurant|lunch|food/i, cats: ['food'] },
  { id: 'travel', label: 'Girl trip', icon: 'plane', photo: 'girlTrip', match: /girl trip|travel|trip|voyage|getaway|weekend away/i, cats: ['travel'] },
  { id: 'wellness', label: 'Wellness', icon: 'sparkles', photo: 'spaGirl', match: /wellness|spa|self.?care|massage|beauty/i, cats: ['wellness'] },
  { id: 'mosque', label: 'Mosques', icon: 'landmark', photo: 'mosqueGirl', match: /mosque/i },
  { id: 'culture', label: 'Culture', icon: 'landmark', photo: 'gallery', match: /museum|gallery|exhibit|theat|concert|culture|cinema/i, cats: ['culture'] },
  { id: 'network', label: 'Networking', icon: 'briefcase', photo: 'networkingGirl', match: /network|entrepreneur|founder|business|cowork|career/i, cats: ['networking'] },
  { id: 'create', label: 'Book club & workshops', icon: 'palette', photo: 'readingGirl', match: /book|workshop|atelier|art|paint|pottery|craft/i },
];

/** IRLY Moms: plans with (or around) the children, on family photos only (never IRLY Girl's). */
export const MOM_KINDS: Kind[] = [
  { id: 'zoo', label: 'Zoo & safari', icon: 'pawPrint', photo: 'safariPark', match: /\bzoo\b|safari park|wildlife/i },
  { id: 'globalvillage', label: 'Global Village', icon: 'globe', photo: 'globalVillage', match: /global village/i },
  { id: 'park', label: 'Park & playdates', icon: 'baby', photo: 'momPlaydate', match: /park|playdate|playground|picnic/i },
  { id: 'stroller', label: 'Stroller walks', icon: 'footprints', photo: 'strollerMom', match: /stroller|poussette|baby walk|walk/i },
  { id: 'brunch', label: 'Moms’ brunch', icon: 'utensils', photo: 'brunch', match: /brunch/i },
  { id: 'coffee', label: 'Coffee', icon: 'coffee', photo: 'strollerMom', match: /coffee|café|cafe/i },
  { id: 'beach', label: 'Beach', icon: 'sun', photo: 'momBeach', match: /beach|plage/i },
  { id: 'pool', label: 'Pool & swimming', icon: 'waves', photo: 'swimming', match: /swim|pool|piscine/i },
  { id: 'sport', label: 'Moms’ sport', icon: 'activity', photo: 'momYoga', match: /yoga|pilates|fitness|football|padel|tennis|sport/i },
  { id: 'create', label: 'Creative workshops', icon: 'palette', photo: 'gallery', match: /workshop|art|craft|atelier|paint/i },
  { id: 'museum', label: 'Museums & culture', icon: 'landmark', photo: 'kids', match: /museum|gallery|culture|aquarium/i },
  { id: 'restaurant', label: 'Family restaurants', icon: 'utensils', photo: 'dinnerGroup', match: /restaurant|lunch|dinner|family meal/i },
  { id: 'weekend', label: 'Weekend outings', icon: 'calendar', photo: 'familyBeach', match: /weekend|outing|sortie|family day/i },
  { id: 'trip', label: 'Trips', icon: 'plane', photo: 'family', match: /trip|travel|excursion|getaway/i },
];

const matchesKind = (a: ServerActivity, k: Kind) => k.match.test(a.title) || Boolean(k.cats?.includes(a.categoryId));

/** A photo for a plan without its own: the first kind it belongs to. */
export function kindPhoto(a: ServerActivity, kinds: Kind[]): PhotoKey {
  return kinds.find((k) => matchesKind(a, k))?.photo ?? girlPhotoFor(a.title);
}

/** Horizontal rail of kinds: tap one to filter the plans below, tap again to clear. */
export const KindRail = memo(function KindRail({ kinds, value, onChange, counts }: { kinds: Kind[]; value: string | null; onChange: (id: string | null) => void; counts: Record<string, number> }) {
  const m = useGirlMotion();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
      {kinds.map((k, i) => {
        const on = value === k.id;
        const n = counts[k.id] ?? 0;
        return (
          <Animated.View key={k.id} entering={m.reduced ? undefined : enter.slide(Math.min(i, 6), 60)}>
            <PressableScale
              haptic="select"
              scaleTo={0.96}
              onPress={() => onChange(on ? null : k.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={n ? tx('{kind}: {n} upcoming', { kind: tx(k.label), n }) : tx(k.label)}
              style={[styles.kind, on ? styles.kindOn : null]}
            >
              <Photo tint={GIRL_TINT} visual={{ photo: k.photo }} light="dubai" scrim="strong" width={360} style={StyleSheet.absoluteFill} />
              <View style={styles.kindTop}>
                <View style={[styles.kindIcon, on ? { backgroundColor: girl.plum, borderColor: 'rgba(201,182,255,0.35)' } : null]}>
                  <Icon name={on ? 'check' : k.icon} size={14} color={on ? '#C9B6FF' : girl.ink} strokeWidth={on ? 2.6 : 2} />
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
  loading = false,
  error = null,
  onRetry,
  grid = false,
}: {
  activities: ServerActivity[];
  /** The IRLY Girl home shows plans as a two-column grid of photo cards; elsewhere, rows. */
  grid?: boolean;
  /** First load still running: a skeleton, never « nothing planned ». */
  loading?: boolean;
  /** The plans could not be loaded: say so and offer to try again. */
  error?: string | null;
  onRetry?: () => void;
  kinds: Kind[];
  kind: string | null;
  onKind: (id: string | null) => void;
  onPlan: () => void;
  emptyTitle: string;
}) {
  const router = useRouter();
  const now = useNow();
  const m = useGirlMotion();
  const [when, setWhen] = useState<When>('all');
  const [free, setFree] = useState(false);
  const [more, setMore] = useState(false);
  const k = kinds.find((x) => x.id === kind) ?? null;
  const frame = useFrame();
  const tileW = (frame.width - space.gutter * 2 - 12) / 2;
  const first = grid ? 6 : 5;

  const list = useMemo(
    () => activities.filter((a) => inWindow(a.startsAt, when, a.cityId, now) && (!free || a.priceMinor === 0) && (!k || matchesKind(a, k))),
    [activities, when, free, k, now],
  );
  const shown = more ? list : list.slice(0, first);
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

      <Animated.View layout={m.layout} style={{ gap: 10, paddingHorizontal: space.gutter }}>
        {grid ? (
          shown.length ? (
            <View style={styles.grid}>
              {shown.map((a, i) => (
                <Animated.View key={a.id} entering={m.rise(i)} layout={m.layout}>
                  <PlanTile a={a} width={tileW} photo={kindPhoto(a, kinds)} label={kinds.find((x) => matchesKind(a, x))?.label} onPress={() => router.push(`/a/${a.id}`)} />
                </Animated.View>
              ))}
            </View>
          ) : null
        ) : (
          shown.map((a, i) => (
            <Animated.View key={a.id} entering={m.rise(i)} layout={m.layout}>
              <PlanRow a={a} photo={kindPhoto(a, kinds)} onPress={() => router.push(`/a/${a.id}`)} />
            </Animated.View>
          ))
        )}
        {list.length > first && !more ? <GButton label={tx('Show all {n}', { n: list.length })} variant="ghost" onPress={() => setMore(true)} /> : null}
        {!list.length && loading ? (
          grid ? (
            <View style={styles.grid} accessibilityLabel={tx('Loading plans')}>
              <Skeleton width={tileW} height={Math.round(tileW * 0.78) + 110} radius={radius.xl} />
              <Skeleton width={tileW} height={Math.round(tileW * 0.78) + 110} radius={radius.xl} />
            </View>
          ) : (
            <View style={{ gap: 10 }} accessibilityLabel={tx('Loading plans')}>
              <Skeleton height={84} radius={radius.lg} />
              <Skeleton height={84} radius={radius.lg} />
            </View>
          )
        ) : !list.length && error ? (
          <GNotice icon="globe" tone="error" body={"Plans couldn't load. Check your connection."}>
            {onRetry ? <GButton label="Try again" variant="secondary" onPress={onRetry} /> : null}
          </GNotice>
        ) : !list.length ? (
          <GNotice icon="sparkles" title={filtered ? 'Nothing planned here yet' : emptyTitle} body={filtered ? 'Change the filters, or plan it yourself: it takes a minute.' : 'Pick a moment and a place, and others join you.'}>
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
          </GNotice>
        ) : null}
      </Animated.View>
    </View>
  );
}

const PlanRow = memo(function PlanRow({ a, photo, onPress }: { a: ServerActivity; photo: PhotoKey; onPress: () => void }) {
  const full = a.capacity != null && a.going >= a.capacity;
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} accessibilityLabel={`${a.title}, ${cityWhen(a.startsAt, a.cityId)}`} style={styles.plan}>
      <GlassLayer radius={radius.lg} />
      <View style={styles.planPhoto}>
        <Photo tint={GIRL_TINT} visual={{ photo, uri: a.coverUrl }} light="dubai" width={300} style={StyleSheet.absoluteFill} />
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
            {a.priceMinor === 0 ? tx('Free') : `${formatNumber(a.priceMinor / 100, 0)} ${a.currency}`}
          </Text>
        </View>
      </View>
      {a.joined ? (
        <View style={[styles.badge, styles.going]}>
          <Icon name="check" size={12} color="#C9B6FF" strokeWidth={2.6} />
          <Text variant="caption" color={girl.pearl}>
            Going
          </Text>
        </View>
      ) : full ? (
        <View style={[styles.badge, { backgroundColor: girl.nude }]}>
          <Text variant="caption" color={girl.plum}>
            Full
          </Text>
        </View>
      ) : (
        <Icon name="chevronRight" size={18} color={girl.inkFaint} />
      )}
    </PressableScale>
  );
});

/** One plan in the IRLY Girl home grid: its photo on top inside a glass card, then kind, title, place and when. */
const PlanTile = memo(function PlanTile({ a, width, photo, label, onPress }: { a: ServerActivity; width: number; photo: PhotoKey; label?: string; onPress: () => void }) {
  const full = a.capacity != null && a.going >= a.capacity;
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={onPress} accessibilityLabel={`${a.title}, ${cityWhen(a.startsAt, a.cityId)}`} style={[styles.tile, { width }]}>
      <GlassLayer radius={radius.xl} />
      <View style={[styles.tilePhoto, { height: Math.round(width * 0.78) }]}>
        <Photo tint={GIRL_TINT} visual={{ photo, uri: a.coverUrl }} light="dubai" width={500} style={StyleSheet.absoluteFill} recyclingKey={`gplan-${a.id}`} />
        {a.joined ? (
          <View style={[styles.badge, styles.tileBadge, styles.going]}>
            <Icon name="check" size={12} color="#C9B6FF" strokeWidth={2.6} />
            <Text variant="caption" color={girl.pearl}>
              Going
            </Text>
          </View>
        ) : full ? (
          <View style={[styles.badge, styles.tileBadge, { backgroundColor: girl.nude }]}>
            <Text variant="caption" color={girl.plum}>
              Full
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tileBody}>
        {label ? (
          <Text variant="overline" color={girl.rose} numberOfLines={1}>
            {label}
          </Text>
        ) : null}
        <Text variant="titleS" color={girl.ink} numberOfLines={2} raw>
          {a.title}
        </Text>
        {a.placeName ? (
          <Text variant="caption" color={girl.inkSoft} numberOfLines={1} raw>
            {a.placeName}
          </Text>
        ) : null}
        <View style={styles.tileWhen}>
          <Icon name="clock" size={12} color={girl.rose} />
          <Text variant="caption" color={girl.rose} numberOfLines={1} style={{ flexShrink: 1 }}>
            {cityWhen(a.startsAt, a.cityId)}
          </Text>
        </View>
        <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
          {a.capacity ? tx('{n}/{max} going', { n: a.going, max: a.capacity }) : tx('{n} going', { n: a.going })} · {a.priceMinor === 0 ? tx('Free') : `${formatNumber(a.priceMinor / 100, 0)} ${a.currency}`}
        </Text>
      </View>
    </PressableScale>
  );
});

/** A filter chip of IRLY Girl: the shared Chip (glass at rest, rose when selected, spring + haptic). */
function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  return <GChip small label={label} icon={icon} selected={on} onPress={onPress} />;
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
  /** Its photos (up to 10) or video, as on the community page. */
  mediaPaths?: string[];
  mediaKind?: 'photo' | 'video' | null;
  thumbPath?: string | null;
  mediaSeconds?: number | null;
  /** Demo build only: an example photo. */
  photo?: PhotoKey;
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
      communityName: displayCommunityName({ name: r.community_name as string | null }),
      authorId: r.author_id as string,
      firstName: (r.first_name as string) ?? '',
      body: r.body as string,
      activityId: (r.activity_id as string) ?? null,
      activityTitle: (r.activity_title as string) ?? null,
      activityStartsAt: r.activity_starts_at ? Date.parse(r.activity_starts_at as string) : null,
      createdAt: Date.parse(r.created_at as string),
      mine: Boolean(r.mine),
      isMember: Boolean(r.is_member),
      mediaPaths: (r.media_paths as string[] | null) ?? [],
      mediaKind: (r.media_kind as 'photo' | 'video' | null) ?? null,
      thumbPath: (r.thumb_path as string | null) ?? null,
      mediaSeconds: (r.media_seconds as number | null) ?? null,
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
    // That is every community the member can read (no filter fits "the
    // women-only ones"): a burst of events is one reload, not one each.
    let soon: ReturnType<typeof setTimeout> | null = null;
    const later = () => {
      if (soon) clearTimeout(soon);
      soon = setTimeout(() => {
        soon = null;
        load();
      }, 700);
    };
    const channel = liveChannel(`girl-feed-${cityId}-${moms ? 'moms' : 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_posts' }, later)
      // Listening: a post made before then is in no event.
      .subscribe(whenListening(later));
    return () => {
      if (soon) clearTimeout(soon);
      supabase?.removeChannel(channel);
    };
  }, [load, cityId, moms, uid]);

  return { posts, state, reload: load };
}

// The demonstration build reads the example posts (never the server); real builds, the server.
const useFeed = DEMO ? useDemoGirlFeed : useGirlFeed;
const useEng = DEMO ? useDemoEngagement : useEngagement;

export function GirlFeed({ cityId, moms, onCommunities }: { cityId: string; moms: boolean; onCommunities: () => void }) {
  const { posts, state, reload } = useFeed(cityId, moms);
  const m = useGirlMotion();
  const eng = useEng(
    'community_post',
    posts.map((p) => p.id),
  );
  if (state === 'loading')
    // The shape of a post, shimmering in powder rose: never a bare spinner.
    return (
      <View style={[styles.post, { marginHorizontal: space.gutter }]} accessibilityLabel={tx('Loading posts')}>
        <GlassLayer radius={radius.xl} />
        <View style={styles.postHead}>
          <Skeleton width={38} height={38} radius={19} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="40%" height={12} radius={6} />
            <Skeleton width="60%" height={10} radius={5} />
          </View>
        </View>
        <Skeleton width="92%" height={12} radius={6} />
        <Skeleton width="70%" height={12} radius={6} />
      </View>
    );
  if (state === 'error')
    return (
      <GNotice icon="globe" tone="error" body="Posts could not load. Check your connection." style={{ marginHorizontal: space.gutter }}>
        <GButton label="Try again" variant="secondary" onPress={reload} />
      </GNotice>
    );
  if (!posts.length)
    return (
      <GNotice icon="message" title={moms ? 'No posts from moms yet' : 'No posts yet'} body="Join a community and say hello: your post shows here for every woman nearby." style={{ marginHorizontal: space.gutter }}>
        <GButton label="See communities" variant="secondary" onPress={onCommunities} />
      </GNotice>
    );
  return (
    <View style={{ gap: 12, paddingHorizontal: space.gutter }}>
      {posts.map((p, i) => (
        <Animated.View key={p.id} entering={m.rise(Math.min(i, 4))} layout={m.layout}>
          <GirlPostCard p={p} eng={eng} cityId={cityId} />
        </Animated.View>
      ))}
    </View>
  );
}

export const GirlPostCard = memo(function PostCard({ p, eng, cityId }: { p: GirlPost; eng: ReturnType<typeof useEng>; cityId: string }) {
  const router = useRouter();
  const now = useNow();
  return (
    <View style={styles.post}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.postHead}>
        <PressableScale haptic="select" scaleTo={0.94} onPress={() => (p.mine ? router.push(FEATURES.girlMatch ? '/girl/profile' : '/edit-profile') : router.push(`/person/${p.authorId}`))} accessibilityLabel={p.mine ? 'My profile' : tx("View {name}'s profile", { name: p.firstName })}>
          <Avatar name={p.firstName} hue={hueOf(p.authorId)} size={38} userId={p.authorId} photo={demoPhoto(p.authorId)} />
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
      {p.mediaPaths?.length ? <PostMedia paths={p.mediaPaths} kind={p.mediaKind ?? null} thumb={p.thumbPath} seconds={p.mediaSeconds} /> : null}
      {p.photo ? (
        <View style={styles.postPhoto}>
          <Photo tint={GIRL_TINT} visual={{ photo: p.photo }} light="dubai" width={700} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
      {p.activityId ? (
        <PressableScale onPress={() => router.push(`/a/${p.activityId}`)} haptic="select" scaleTo={0.98} style={styles.linked} accessibilityLabel={p.activityTitle ? tx('Open {title}', { title: p.activityTitle }) : tx('Open the activity')}>
          <GlassLayer radius={radius.md} level="thin" />
          <GIconWell icon="calendar" size={34} />
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
  const m = useGirlMotion();
  return (
    <View style={styles.shortcuts}>
      {items.map((s, i) => (
        <Animated.View key={s.label} entering={m.pop(i, 180)} style={{ flex: 1 }}>
          <PressableScale haptic="select" scaleTo={0.94} onPress={s.onPress} accessibilityRole="button" accessibilityLabel={tx(s.label)} style={styles.shortcut}>
            <GlassFill radius={radius.lg} />
            <GIconWell icon={s.icon} size={36} />
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
  postPhoto: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  rail: { paddingHorizontal: space.gutter, gap: 10 },
  kind: { width: 132, height: 168, borderRadius: radius.lg, overflow: 'hidden', padding: 10, justifyContent: 'space-between', boxShadow: girl.shadowSoft },
  kindOn: { borderWidth: 2, borderColor: girl.plum },
  kindTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kindIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(250,248,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  kindCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, backgroundColor: 'rgba(250,248,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  kindLabel: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  chips: { paddingHorizontal: space.gutter, gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { borderRadius: radius.xl, overflow: 'hidden', boxShadow: girl.shadowSoft },
  tilePhoto: { margin: 6, marginBottom: 0, borderRadius: radius.xl - 6, overflow: 'hidden', backgroundColor: girl.blush },
  tileBadge: { position: 'absolute', top: 8, right: 8 },
  tileBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 4 },
  tileWhen: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, boxShadow: girl.shadowSoft },
  planPhoto: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', backgroundColor: girl.cream },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: 13 },
  going: { backgroundColor: girl.plum, borderWidth: 1, borderColor: 'rgba(201,182,255,0.28)', boxShadow: girl.shadowPlum },
  post: { gap: 10, padding: 14, borderRadius: radius.xl, boxShadow: girl.shadowSoft },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, overflow: 'hidden' },
  shortcuts: { flexDirection: 'row', gap: 8, paddingHorizontal: space.gutter, marginTop: space[4] },
  shortcut: { alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 2, borderRadius: radius.lg, zIndex: 0, boxShadow: girl.shadowSoft },
});
