import { useRouter } from 'expo-router';
import { FEATURES } from '@/lib/features';
import { destinationOpen } from '@/data/destinations';
import { dateLocale, t as tx } from '@/i18n';
import { useState, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { joinCommunity, useCommunitiesLike, useGirlCircle, useGirlExtras, type CircleMember } from '@/features/bali/data';
import { GirlGate, safeBack } from '@/features/girl/access';
import { girl, girlType } from '@/features/girl/theme';
import { GIRL_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { GButton, GChip, Wrap } from '@/features/girl/ui';
import { hueOf } from '@/lib/format';
import { friendlyError } from '@/lib/supabase';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';

type Status = NonNullable<CircleMember['status']>;
const STATUSES: { id: Status; label: string }[] = [
  { id: 'moving_soon', label: 'Moving soon' },
  { id: 'just_arrived', label: 'Just arrived' },
  { id: 'living', label: 'Living in Bali' },
  { id: 'visiting', label: 'Visiting' },
];
const LOOKING = ['friends', 'activities', 'travel companions', 'coworking', 'wellness', 'sports'];

/**
 * GIRLS MOVING TO BALI. "I am moving to Bali and don't know anyone."
 * → women you can meet before you arrive: moving soon, just arrived, living
 * there. Same IRLY Girl rules (women only, privacy, blocking), plus the
 * Bali girl communities and the move guides.
 */
export default function GirlsMovingScreen() {
  return (
    <GirlGate>
      <GirlsMoving />
    </GirlGate>
  );
}

function GirlsMoving() {
  const router = useRouter();
  const [joining, setJoining] = useState<string | null>(null);
  const joinRef = useRef(false);
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const circle = useGirlCircle('bali', { status, looking });
  const extras = useGirlExtras();
  const me = extras.data;
  const communities = useCommunitiesLike('bali', '', true);

  // Her latest choices, ahead of the server: two quick taps on « Looking for » both count.
  const [mine, setMineLocal] = useState<{ lookingFor?: string[]; destinationStatus?: string | null }>({});
  const lookingFor = mine.lookingFor ?? me?.lookingFor ?? [];
  const destStatus = mine.destinationStatus !== undefined ? mine.destinationStatus : me?.destination === 'bali' ? me.destinationStatus : null;
  const setMine = (patch: Parameters<typeof extras.save>[0]) => {
    setMineLocal((m) => ({ ...m, ...('lookingFor' in patch ? { lookingFor: patch.lookingFor } : {}), ...('destinationStatus' in patch ? { destinationStatus: patch.destinationStatus } : {}) }));
    return extras
      .save({ destination: 'bali', ...patch })
      .then(() => haptic('success'))
      .catch((e) => {
        // Refused: back to what the server has.
        setMineLocal({});
        toast(friendlyError(e instanceof Error ? e.message : 'Could not save'), 'x', 'live');
      });
  };

  const join = (id: string) => {
    // One join at a time: a fast second tap never opens the chat twice.
    if (joinRef.current) return;
    joinRef.current = true;
    setJoining(id);
    joinCommunity(id)
      .then((conv) => {
        haptic('success');
        communities.reload();
        if (conv) router.push(`/messages/${conv}`);
      })
      .catch((e) => toast(friendlyError(e instanceof Error ? e.message : 'Could not join'), 'x', 'live'))
      .finally(() => {
        joinRef.current = false;
        setJoining(null);
      });
  };

  return (
    <View style={[styles.root]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, gap: space[6] }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale haptic="tap" scaleTo={0.9} onPress={() => safeBack(router, '/girl')} accessibilityLabel="Back" style={styles.round}>
            <Icon name="chevronLeft" size={20} color={girl.ink} />
          </PressableScale>
          <Text variant="titleM" color={girl.ink} style={{ letterSpacing: 2 }}>
            IRLY <Text variant="titleM" color={girl.rose} style={{ letterSpacing: 2 }}>GIRL</Text> · BALI
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.pad, { gap: 8 }]}>
          <Text variant="displayM" color={girl.ink} style={girlType.display}>
            Moving to Bali and don’t know anyone?
          </Text>
          <Text variant="body" color={girl.inkSoft}>
            Here are women you can meet before you arrive.
          </Text>
        </View>

        {/* While IRLY Match is coming soon, a first choice creates her private IRLY Girl profile. */}
        {me?.hasProfile || (!FEATURES.girlMatch && !extras.loading && !extras.error) ? (
          <View style={styles.pad}>
            <View style={[styles.card, { gap: 10 }]}>
              <Text variant="titleS" color={girl.ink}>
                {"What's your Bali status?"}
              </Text>
              <Wrap>
                {STATUSES.map((s) => (
                  <GChip key={s.id} small label={s.label} selected={destStatus === s.id} onPress={() => setMine({ destinationStatus: s.id })} />
                ))}
              </Wrap>
              <Text variant="caption" color={girl.inkSoft}>
                Looking for
              </Text>
              <Wrap>
                {LOOKING.map((l) => {
                  const on = lookingFor.includes(l);
                  return <GChip key={l} small label={tx(l)} selected={on} onPress={() => setMine({ lookingFor: on ? lookingFor.filter((x) => x !== l) : [...lookingFor, l] })} />;
                })}
              </Wrap>
            </View>
          </View>
        ) : extras.error ? (
          // Could not read the profile: never tell a member to create one she may have.
          <View style={styles.pad}>
            <View style={[styles.card, { gap: 10 }]}>
              <Text variant="bodyS" color={girl.inkSoft}>
                Your Bali status could not load.
              </Text>
              <GButton label="Try again" variant="secondary" onPress={extras.reload} />
            </View>
          </View>
        ) : extras.loading ? (
          <View style={styles.pad}>
            <Skeleton height={150} radius={radius.xl} />
          </View>
        ) : (
          <View style={styles.pad}>
            <GButton label="Create my IRLY Girl profile first" icon="user" onPress={() => router.push('/girl/profile')} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          <GChip small label="Everyone" selected={!status} onPress={() => setStatus(null)} />
          {STATUSES.map((s) => (
            <GChip key={s.id} small label={s.label} selected={status === s.id} onPress={() => setStatus(s.id)} />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
          <GChip small label={tx('Looking for anything')} selected={!looking} onPress={() => setLooking(null)} />
          {LOOKING.map((l) => (
            <GChip key={l} small label={tx(l)} selected={looking === l} onPress={() => setLooking(looking === l ? null : l)} />
          ))}
        </ScrollView>

        <View style={[styles.pad, { gap: 10 }]}>
          {circle.loading && !circle.data.length ? (
            [0, 1, 2].map((i) => <Skeleton key={i} height={80} radius={radius.xl} />)
          ) : circle.error ? (
            <View style={[styles.card, { gap: 10, alignItems: 'center' }]}>
              <Text variant="bodyS" color={girl.inkSoft} align="center">
                {/profile/i.test(circle.error) ? tx(circle.error) : 'Could not load. Check your connection.'}
              </Text>
              <GButton label="Try again" variant="secondary" onPress={circle.reload} />
            </View>
          ) : !circle.data.length ? (
            <Text variant="bodyS" color={girl.inkSoft}>
              {me?.hasProfile ? 'Nobody here yet. Set your status above: the next woman moving to Bali will find you.' : 'Nobody here yet. Create your IRLY Girl profile: the next woman moving to Bali will find you.'}
            </Text>
          ) : (
            circle.data.map((m) => (
              <PressableScale
                key={m.userId}
                haptic="select"
                scaleTo={0.98}
                onPress={() => router.push(`/person/${m.userId}`)}
                accessibilityLabel={tx("View {name}'s profile", { name: m.firstName })}
                style={[styles.card, styles.row]}
              >
                <Avatar name={m.firstName} hue={hueOf(m.userId)} size={48} userId={m.userId} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="titleS" color={girl.ink} raw>
                    {m.firstName}
                  </Text>
                  <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                    {[STATUSES.find((s) => s.id === m.status)?.label, m.moveMonth ? new Date(m.moveMonth).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }) : null, m.areas[0]]
                      .filter(Boolean)
                      .map((x) => tx(x as string))
                      .join(' · ')}
                  </Text>
                  {m.lookingFor.length ? (
                    <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                      {tx('Looking for {what}', { what: m.lookingFor.map((x) => tx(x)).join(', ') })}
                    </Text>
                  ) : null}
                </View>
                {m.score != null ? (
                  <Text variant="label" color={girl.rose}>
                    {m.score}%
                  </Text>
                ) : null}
              </PressableScale>
            ))
          )}
          {circle.data.length ? <GButton label="Connect in IRLY Girl" icon="heartHandshake" onPress={() => router.push('/girl')} /> : null}
        </View>

        <View style={styles.pad}>
          <View style={[styles.card, { gap: 10 }]}>
            <Text variant="titleM" color={girl.ink} style={girlType.section}>
              Plan something with girls
            </Text>
            <QuickPlan cityId="bali" types={GIRL_PLANS} palette="girl" />
          </View>
        </View>

        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM" color={girl.ink} style={girlType.section}>
            Bali girl communities
          </Text>
          {communities.loading && !communities.data.length ? <Skeleton height={64} radius={radius.xl} /> : null}
          {communities.error && !communities.data.length && !communities.loading ? (
            <View style={[styles.card, { gap: 10, alignItems: 'center' }]}>
              <Text variant="bodyS" color={girl.inkSoft} align="center">
                Communities could not load.
              </Text>
              <GButton label="Try again" variant="secondary" onPress={communities.reload} />
            </View>
          ) : null}
          {!communities.data.length && !communities.loading && !communities.error ? (
            <View style={[styles.card, { gap: 10 }]}>
              <Text variant="bodyS" color={girl.inkSoft}>
                No Bali girl community yet. Start one: the next woman moving here will find it.
              </Text>
              <GButton label="Create a community" icon="plus" variant="secondary" onPress={() => router.push('/community/new')} />
            </View>
          ) : null}
          {communities.data.map((c) => (
            // The row opens the community; Join sits beside it (never a button inside a button).
            <View key={c.id} style={[styles.card, styles.row]}>
              <PressableScale onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={{ flex: 1 }} accessibilityLabel={tx('Open {title}', { title: c.name })}>
                <Text variant="titleS" color={girl.ink} raw>
                  {c.name}
                </Text>
                {c.tagline ? (
                  <Text variant="caption" color={girl.inkSoft} numberOfLines={1} raw>
                    {c.tagline}
                  </Text>
                ) : null}
              </PressableScale>
              {c.member ? <GChip small label={tx('Joined')} selected /> : <GButton label="Join" loading={joining === c.id} disabled={Boolean(joining)} onPress={() => join(c.id)} />}
            </View>
          ))}
        </View>

        {/* Bali's guides, while Bali is open (it is coming soon for now). */}
        {destinationOpen('bali') ? (
        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM" color={girl.ink} style={girlType.section}>
            Before you land
          </Text>
          <GButton label="Where should I live?" icon="compass" variant="secondary" onPress={() => router.push('/bali/quiz')} />
          <GButton label="Visa & stay (official sources)" icon="stamp" variant="secondary" onPress={() => router.push('/bali/guide/visa')} />
          <GButton label="Housing guide" icon="home" variant="secondary" onPress={() => router.push('/bali/guide/housing')} />
          <GButton label="My Bali move checklist" icon="package" variant="secondary" onPress={() => router.push('/bali/move')} />
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: girl.bg },
  pad: { paddingHorizontal: space.gutter },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: girl.surface },
  card: { backgroundColor: girl.surface, borderRadius: radius.xl, padding: 16, boxShadow: girl.shadowSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
