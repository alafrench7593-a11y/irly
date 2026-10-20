import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { DEMO } from '@/config/app';
import { GIRL_PEOPLE } from '@/data/content/girls';
import { CITIES } from '@/data/destinations';
import type { PhotoKey } from '@/data/photos';
import type { CityId, Person } from '@/data/types';
import { useCommunitiesLike } from '@/features/bali/data';
import { useServerActivities, type ServerActivity } from '@/features/server/activities';
import { usePhotoLink } from '@/features/server/covers';
import { cityWhen } from '@/lib/time';
import { PressableScale } from '@/motion/PressableScale';
import { setAppSpace, useAppSpace } from '@/state/appSpace';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useDemoActivities, useDemoCommunitiesLike } from './demo';
import { girlCommunityPhoto } from './photos';
import { girl, GIRL_TINT, girlType } from './theme';
import { GButton, GIconWell } from './ui';
import { GIRL_KINDS, kindPhoto } from './world';

/**
 * The IRLY Girl content laid into IRLY's own sections (Home, Discover,
 * Social, Profile): same places, same order, in the Girl look. Women only:
 * the server returns IRLY Girl rows to eligible women and nobody else.
 */

// The demonstration build reads the example communities and plans, never the server.
export const useGirlCommunities = DEMO ? useDemoCommunitiesLike : useCommunitiesLike;
export const useGirlPlans = DEMO ? useDemoActivities : useServerActivities;

/** Women to meet in this city: the example members in the demo build; the server's (Match) otherwise. */
export function useGirlPeople(cityId: CityId): Person[] {
  return useMemo(() => (DEMO ? [...GIRL_PEOPLE.values()].filter((p) => p.cityId === cityId) : []), [cityId]);
}

/**
 * Switch between IRLY and IRLY Girl, at the place the « IRLY Girl » entry
 * sits in IRLY. Into IRLY Girl goes through its door (/girl: the server
 * check); back to IRLY is immediate.
 */
export function SpaceSwitchCard({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const t = useTheme();
  const space = useAppSpace();
  const inGirl = space === 'girl';
  const onPress = () => {
    if (!inGirl) {
      router.push('/girl');
      return;
    }
    setAppSpace('mixte');
    toast('Back to IRLY', 'globe', 'brand');
  };
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.98}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={inGirl ? tx('Switch to IRLY Mixte') : tx('Open IRLY Girl')}
      style={[styles.switch, compact && { marginHorizontal: 0 }]}
    >
      <GlassLayer radius={radius.xl} />
      <View style={[styles.switchIcon, { backgroundColor: t.c.brandSoft }]}>
        <Icon name={inGirl ? 'globe' : 'sparkles'} size={18} color={t.c.brand} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS">{inGirl ? 'Switch to IRLY Mixte' : 'Open IRLY Girl'}</Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {inGirl ? 'The same app, for everyone. Come back to IRLY Girl anytime.' : 'Women only · checked by IRLY'}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={t.c.textSecondary} />
    </PressableScale>
  );
}

/**
 * The girls' plans as rows, where IRLY lists its sessions or plans
 * (Discover › Activities « Happening soon », Social « Real-life plans »).
 * Each row opens the real activity (join, leave, chat live there).
 */
export function GirlPlanRows({ plans, limit }: { plans: { activities: ServerActivity[]; loading: boolean; error: string | null; refresh: () => void }; limit?: number }) {
  const router = useRouter();
  const list = limit ? plans.activities.slice(0, limit) : plans.activities;
  if (!list.length && plans.loading) {
    return (
      <View style={{ gap: 10 }} accessibilityLabel="Loading plans">
        <Skeleton height={84} radius={radius.lg} />
        <Skeleton height={84} radius={radius.lg} />
      </View>
    );
  }
  if (!list.length && plans.error) {
    return <GButton label="Try again" variant="secondary" onPress={plans.refresh} />;
  }
  return (
    <>
      {list.map((a) => (
        <PlanRow key={a.id} a={a} onPress={() => router.push(`/a/${a.id}`)} />
      ))}
    </>
  );
}

function PlanRow({ a, onPress }: { a: ServerActivity; onPress: () => void }) {
  const t = useTheme();
  const when = cityWhen(a.startsAt, a.cityId);
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} accessibilityLabel={`${a.title}, ${when}`} style={styles.plan}>
      <GlassLayer radius={radius.lg} />
      <View style={styles.planPhoto}>
        <Photo tint={GIRL_TINT} visual={{ photo: kindPhoto(a, GIRL_KINDS), uri: a.coverUrl }} light="dubai" width={300} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="caption" color={girl.rose}>
          {when}
        </Text>
        <Text variant="titleS" numberOfLines={2} raw>
          {a.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[a.placeName, a.capacity ? tx('{n}/{max} going', { n: a.going, max: a.capacity }) : tx('{n} going', { n: a.going })].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Icon name={a.joined ? 'check' : 'chevronRight'} size={18} color={a.joined ? girl.rose : t.c.textSecondary} />
    </PressableScale>
  );
}

/** The IRLY Girl communities near you, and a tile to start one (women only, with its own chat). */
export function GirlCommunities({ cityId }: { cityId: CityId }) {
  const router = useRouter();
  const list = useGirlCommunities(cityId, '', true);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
      {!list.data.length && list.loading ? [0, 1].map((i) => <Skeleton key={i} width={168} height={200} radius={radius.xl} />) : null}
      {!list.data.length && list.error && !list.loading ? (
        <View style={[styles.community, styles.newCommunity, { borderStyle: 'solid' }]}>
          <GlassLayer radius={radius.xl} />
          <GIconWell icon="globe" tone="error" size={36} />
          <Text variant="bodyS" color={girl.inkSoft}>
            Communities could not load.
          </Text>
          <GButton label="Try again" variant="secondary" onPress={list.reload} />
        </View>
      ) : null}
      {list.data.map((c) => (
        <CommunityTile key={c.id} c={c} away={c.cityId !== cityId} onPress={() => router.push(`/c/${c.id}`)} />
      ))}
      <PressableScale haptic="select" scaleTo={0.96} onPress={() => router.push('/girl/new-community')} style={[styles.community, styles.newCommunity]} accessibilityLabel="Create a community">
        <GlassLayer radius={radius.xl} />
        <GIconWell icon="plus" size={36} />
        <Text variant="titleS" color={girl.ink} style={{ marginTop: 'auto' }}>
          {list.data.length || list.loading || list.error ? 'Create a community' : 'Start the first community'}
        </Text>
        <Text variant="caption" color={girl.inkSoft}>
          Women only, with its own chat.
        </Text>
      </PressableScale>
    </ScrollView>
  );
}

/** A community in IRLY Girl: its own photo when it has one, its name, its members, and whether you are in. */
function CommunityTile({ c, away, onPress }: { c: { id: string; name: string; member: boolean; members: number; cityId: string; coverPath: string | null; photo?: PhotoKey }; away: boolean; onPress: () => void }) {
  const uri = usePhotoLink(c.coverPath);
  return (
    <PressableScale haptic="select" scaleTo={0.96} onPress={onPress} style={styles.community} accessibilityLabel={tx('{name}, {n} members', { name: c.name, n: c.members })}>
      <Photo pinned tint={GIRL_TINT} visual={{ photo: c.photo ?? girlCommunityPhoto(c.name), uri: uri ?? undefined }} light="dubai" scrim="strong" style={StyleSheet.absoluteFill} width={400} recyclingKey={`gc-${c.id}-${c.coverPath ?? 'app'}`} />
      <View style={{ flex: 1, padding: 12, justifyContent: 'space-between' }}>
        <View style={styles.communityBadge}>
          <Icon name={c.member ? 'check' : 'users'} size={14} color={girl.rose} />
        </View>
        <View style={{ gap: 2 }}>
          {away ? (
            <Text variant="caption" color="rgba(255,255,255,0.85)" numberOfLines={1}>
              {CITIES[c.cityId as keyof typeof CITIES]?.name}
            </Text>
          ) : null}
          <Text variant="titleS" color="#FFFFFF" numberOfLines={2} raw style={girlType.card}>
            {c.name}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.88)">
            {c.member ? tx('Joined · {n} members', { n: c.members }) : tx('{n} members', { n: c.members })}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  switch: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: space.gutter, padding: 14, borderRadius: radius.xl, overflow: 'hidden' },
  switchIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: radius.lg, overflow: 'hidden' },
  planPhoto: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden' },
  community: { width: 168, height: 200, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end', boxShadow: girl.shadowSoft },
  newCommunity: { padding: 14, gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(185,43,105,0.30)', justifyContent: 'flex-start' },
  communityBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,250,246,0.92)', alignItems: 'center', justifyContent: 'center' },
});
