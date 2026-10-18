import { useRouter } from 'expo-router';
import { FEATURES } from '@/lib/features';
import { t as tx } from '@/i18n';
import { Image } from 'expo-image';
import { useMemo, useState, useRef } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { Film } from '@/components/visual/Film';
import { Photo } from '@/components/visual/Photo';
import { filmFor } from '@/data/photos';
import { enter } from '@/motion/enter';
import { girlCommunityPhoto } from './photos';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { joinCommunity, useCommunitiesLike, useGirlCircle, useGirlExtras, usePlaces } from '@/features/bali/data';
import { MOM_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { useServerActivities } from '@/features/server/activities';
import { DEMO } from '@/config/app';
import { useDemoActivities, useDemoCommunitiesLike } from './demo';
import { hueOf } from '@/lib/format';
import { friendlyError } from '@/lib/supabase';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { girl, GIRL_TINT, girlType } from './theme';
import { GButton, GChip, GSection, Wrap } from './ui';
import { GirlFeed, KindRail, MOM_KINDS, Upcoming } from './world';

// The demonstration build reads the example communities and plans, never the server.
const useMomCommunities = DEMO ? useDemoCommunitiesLike : useCommunitiesLike;
const useMomPlans = DEMO ? useDemoActivities : useServerActivities;

const AGES = [
  { id: 'baby', label: 'Baby' },
  { id: 'toddler', label: 'Toddler' },
  { id: 'kid', label: 'Kid' },
  { id: 'teen', label: 'Teen' },
];
/** An age group as its label (never a raw id); unknown ids are left out. */
const ageLabel = (id: string) => AGES.find((a) => a.id === id)?.label ?? null;

/**
 * IRLY Moms, inside IRLY Girl (same account, same women-only rule). Mom
 * mode is optional: turn it on to appear to other moms and see them. Then:
 * moms near you, mom communities, plans with children (playdates, beach,
 * park, kids sports…) and family-friendly places. Dubai and Bali alike,
 * with each destination's own communities and places.
 */
export function MomsView({ cityId, onSection }: { cityId: CityId; onSection?: (name: string, y: number) => void }) {
  const reduced = useReducedMotion();
  const router = useRouter();
  const city = CITIES[cityId];
  const extras = useGirlExtras();
  const me = extras.data;
  // Ages picked here, ahead of the server's answer: two quick taps both count.
  const [kids, setKids] = useState<string[] | null>(null);
  const [momBusy, setMomBusy] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const joinRef = useRef(false);
  const toggleAge = (id: string) => {
    const current = kids ?? me?.kidsAgeGroups ?? [];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setKids(next);
    extras.save({ kidsAgeGroups: next }).catch((e) => {
      setKids(null);
      toast(friendlyError(e instanceof Error ? e.message : 'Could not save'), 'x', 'live');
    });
  };
  const moms = useGirlCircle(cityId, { moms: true });
  const communities = useMomCommunities(cityId, 'Moms', true);
  const { activities, loading: plansLoading, error: plansError, refresh: refreshPlans } = useMomPlans(cityId);
  const family = usePlaces(cityId, { kids: true });
  const plans = useMemo(
    () => activities.filter((a) => a.audience === 'moms' || a.audience === 'families' || a.categoryId === 'family' || /kid|mom|family|playdate|picnic/i.test(a.title)),
    [activities],
  );
  const [kind, setKind] = useState<string | null>(null);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const k of MOM_KINDS) out[k.id] = plans.filter((a) => k.match.test(a.title) || Boolean(k.cats?.includes(a.categoryId))).length;
    return out;
  }, [plans]);
  const mark = (name: string) => (e: LayoutChangeEvent) => onSection?.(name, e.nativeEvent.layout.y);

  const toggleMom = (on: boolean) => {
    if (momBusy) return;
    setMomBusy(true);
    extras
      .save({ momMode: on })
      .then(() => {
        haptic('success');
        toast(on ? 'Mom mode on: other moms can find you' : 'Mom mode off', 'heart', 'brand');
        moms.reload();
      })
      .catch((e) => toast(friendlyError(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setMomBusy(false));
  };

  const join = (id: string, name: string) => {
    // One join at a time: a fast second tap never opens the chat twice.
    if (joinRef.current) return;
    joinRef.current = true;
    setJoining(id);
    joinCommunity(id)
      .then((conv) => {
        haptic('success');
        toast(tx('You joined {name}', { name }), 'users', 'brand');
        if (conv) router.push(`/messages/${conv}`);
        communities.reload();
      })
      .catch((e) => toast(friendlyError(e instanceof Error ? e.message : 'Could not join'), 'x', 'live'))
      .finally(() => {
        joinRef.current = false;
        setJoining(null);
      });
  };

  return (
    <View style={{ gap: space[7], paddingTop: space[5] }}>
      <Animated.View entering={enter.rise(0)} style={[styles.pad, { gap: 12 }]}>
        <Text variant="body" color={girl.inkSoft}>
          {tx('Moms in {city}, plans with children and family-friendly places.', { city: city.name })}
        </Text>
      </Animated.View>

      <View style={{ gap: 10, marginTop: -space[4] }}>
        <KindRail kinds={MOM_KINDS} value={kind} onChange={setKind} counts={counts} />
      </View>

      {/* While IRLY Match is coming soon, turning Mom mode on creates her IRLY Girl profile. */}
      {(me && me.hasProfile) || (!FEATURES.girlMatch && extras.signedIn && !extras.loading && !extras.error) ? (
        <View style={[styles.pad]}>
          <View style={[styles.card, { gap: 12 }]}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink}>
                  Mom mode
                </Text>
                <Text variant="bodyS" color={girl.inkSoft}>
                  Optional. Other moms see you as a mom, nothing more.
                </Text>
              </View>
              <GChip label={me?.momMode ? 'On' : 'Off'} selected={Boolean(me?.momMode)} onPress={momBusy ? undefined : () => toggleMom(!me?.momMode)} />
            </View>
            {me?.momMode ? (
              <View style={{ gap: 6 }}>
                <Text variant="caption" color={girl.inkSoft}>
                  Children’s ages (no names, ever)
                </Text>
                <Wrap>
                  {AGES.map((a) => {
                    const on = (kids ?? me?.kidsAgeGroups ?? []).includes(a.id);
                    return (
                      <GChip
                        key={a.id}
                        small
                        label={a.label}
                        selected={on}
                        onPress={() => toggleAge(a.id)}
                      />
                    );
                  })}
                </Wrap>
              </View>
            ) : null}
          </View>
        </View>
      ) : extras.loading ? (
        <View style={styles.pad}>
          <Skeleton height={84} radius={radius.xl} />
        </View>
      ) : extras.error ? (
        // A failed read is not « no profile »: say so, with a way to try again.
        <View style={styles.pad}>
          <View style={[styles.card, { gap: 10, alignItems: 'center' }]}>
            <Text variant="bodyS" color={girl.inkSoft} align="center">
              Your mom settings could not load.
            </Text>
            <GButton label="Try again" variant="secondary" onPress={extras.reload} />
          </View>
        </View>
      ) : null}

      <View onLayout={mark('moms')} />
      {moms.data.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="titleM" color={girl.ink} style={[girlType.section, styles.pad]}>
            {tx('Moms in {city}', { city: city.name })}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 12 }}>
            {moms.data.map((m) => (
              <PressableScale key={m.userId} haptic="select" scaleTo={0.96} onPress={() => router.push(`/person/${m.userId}`)} accessibilityLabel={tx("View {name}'s profile", { name: m.firstName })} style={[styles.person]}>
                <Avatar name={m.firstName} hue={hueOf(m.userId)} size={56} userId={m.userId} />
                <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
                  {m.firstName}
                </Text>
                <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                  {[
                    m.kidsAgeGroups
                      .map(ageLabel)
                      .filter((k): k is string => Boolean(k))
                      .map((k) => tx(k))
                      .join(', '),
                    m.areas[0],
                  ]
                    .filter(Boolean)
                    .join(' · ') || tx('Mom')}
                </Text>
                {m.score != null ? (
                  <Text variant="caption" color={girl.rose}>
                    {m.score}% match
                  </Text>
                ) : null}
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : moms.loading ? (
        <View style={[styles.pad, { flexDirection: 'row', gap: 12 }]}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={120} height={140} radius={radius.xl} />
          ))}
        </View>
      ) : moms.error ? (
        <View style={[styles.pad]}>
          <View style={[styles.card, { gap: 10, alignItems: 'center' }]}>
            <Text variant="bodyS" color={girl.inkSoft} align="center">
              Moms near you could not load.
            </Text>
            <GButton label="Try again" variant="secondary" onPress={moms.reload} />
          </View>
        </View>
      ) : me?.momMode ? (
        <Text variant="bodyS" color={girl.inkSoft} style={styles.pad}>
          No other moms visible yet in this destination. Start a playdate: they will find you.
        </Text>
      ) : me?.hasProfile ? (
        <Text variant="bodyS" color={girl.inkSoft} style={styles.pad}>
          Turn on mom mode to see the moms near you. Photos of your children are never needed.
        </Text>
      ) : !me && !extras.loading && !extras.error ? (
        // No IRLY account on this device (demo, development): nothing to show, said plainly.
        <Text variant="bodyS" color={girl.inkSoft} style={styles.pad}>
          Moms near you appear here with an IRLY account.
        </Text>
      ) : null}

      <View style={[styles.pad]} onLayout={mark('momsPlan')}>
        <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
          <View style={{ height: 110 }}>
            <Photo tint={GIRL_TINT} visual={{ photo: 'jbr' }} light="dubai" scrim="strong" width={900} style={StyleSheet.absoluteFill} />
            {!reduced ? <Film uri={filmFor('jbr')!} dim={0.25} /> : null}
          </View>
          <View style={{ padding: 16 }}>
          <GSection title="Plan something with the kids" hint="Playdates, beach, park, kids' sports, workshops.">
            <QuickPlan cityId={cityId} types={MOM_PLANS} palette="girl" />
          </GSection>
          </View>
        </View>
      </View>

      <View style={{ gap: 12 }} onLayout={mark('momsPlans')}>
        <Text variant="titleM" color={girl.ink} style={[girlType.section, styles.pad]}>
          Coming up with kids
        </Text>
        <Upcoming activities={plans} kinds={MOM_KINDS} kind={kind} onKind={setKind} onPlan={() => onSection?.('goPlan', 0)} emptyTitle="What if you organised the first playdate?" loading={plansLoading} error={plansError} onRetry={refreshPlans} />
      </View>

      <View style={[styles.pad, { gap: 10 }]} onLayout={mark('momsCommunities')}>
        <Text variant="titleM" color={girl.ink} style={girlType.section}>
          Mom communities
        </Text>
        {communities.data.length ? (
          communities.data.map((c) => (
            // The row opens the community; Join sits beside it (never a button inside a button).
            <View key={c.id} style={[styles.card, styles.row, { padding: 10 }]}>
              <PressableScale onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={[styles.row, { flex: 1 }]} accessibilityLabel={tx('Open {title}', { title: c.name })}>
              <View style={styles.thumb}>
                <Photo pinned tint={GIRL_TINT} visual={{ photo: girlCommunityPhoto(c.name, 'kids') }} light="dubai" width={200} style={StyleSheet.absoluteFill} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink} raw>
                  {c.name}
                </Text>
                <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                  {[c.cityId !== cityId ? CITIES[c.cityId as CityId]?.name : null, c.tagline ? tx(c.tagline) : null, c.members ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              </PressableScale>
              {c.member ? <GChip small label={tx('Joined')} selected /> : <GButton label="Join" loading={joining === c.id} disabled={Boolean(joining)} onPress={() => join(c.id, c.name)} />}
            </View>
          ))
        ) : communities.loading ? (
          <Skeleton height={76} radius={radius.xl} />
        ) : communities.error ? (
          <View style={[styles.card, { gap: 10, alignItems: 'center' }]}>
            <Text variant="bodyS" color={girl.inkSoft} align="center">
              Could not load. Check your connection.
            </Text>
            <GButton label="Try again" variant="secondary" onPress={communities.reload} />
          </View>
        ) : (
          <View style={[styles.card, { gap: 10 }]}>
            <Text variant="bodyS" color={girl.inkSoft}>
              No mom communities here yet. Start one: other moms will find it.
            </Text>
            <GButton label="Create a community" icon="plus" variant="secondary" onPress={() => router.push('/girl/new-community?moms=1')} />
          </View>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <View style={styles.pad}>
          <Text variant="titleM" color={girl.ink} style={girlType.section}>
            From the moms
          </Text>
          <Text variant="bodyS" color={girl.inkSoft}>
            Tips, questions and plans shared in the mom communities.
          </Text>
        </View>
        <GirlFeed cityId={cityId} moms onCommunities={() => onSection?.('goCommunities', 0)} />
      </View>

      {family.data.length ? (
        <View style={{ gap: 10 }}>
          <Text variant="titleM" color={girl.ink} style={[girlType.section, styles.pad]}>
            Family-friendly places
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
            {family.data.slice(0, 12).map((p) => (
              <PressableScale key={p.id} onPress={() => router.push(`/place/${p.slug}`)} haptic="select" scaleTo={0.97} style={[styles.place]} accessibilityLabel={p.name}>
                {p.photo ? (
                  <Image source={{ uri: p.photo }} style={styles.placePhoto} contentFit="cover" />
                ) : (
                  <View style={styles.placePhoto}>
                    <Photo tint={GIRL_TINT} visual={{ photo: p.kind === 'beach' ? 'momBeach' : p.kind === 'park' ? 'momPlaydate' : 'familyBeach' }} light="dubai" width={400} style={StyleSheet.absoluteFill} />
                  </View>
                )}
                <View style={{ padding: 10 }}>
                  <Text variant="titleS" color={girl.ink} numberOfLines={1} raw>
                    {p.name}
                  </Text>
                  <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                    {p.kind.replace('_', ' ')}
                    {p.rating != null ? ` · ★ ${p.rating.toFixed(1)}` : ''}
                  </Text>
                </View>
              </PressableScale>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  card: { backgroundColor: girl.surface, borderRadius: radius.xl, padding: 16, boxShadow: girl.shadowSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  person: { width: 120, alignItems: 'center', gap: 4, padding: 12, borderRadius: radius.xl, backgroundColor: girl.surface },
  place: { width: 170, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: girl.surface },
  placePhoto: { width: 170, height: 100, overflow: 'hidden' },
  thumb: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden' },
});
