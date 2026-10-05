import { useRouter } from 'expo-router';
import { dateLocale, t as tx } from '@/i18n';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { joinCommunity, useCommunitiesLike, useGirlCircle, useGirlExtras, type CircleMember } from '@/features/bali/data';
import { girl } from '@/features/girl/theme';
import { GIRL_PLANS, QuickPlan } from '@/features/plans/QuickPlan';
import { GButton, GChip, Wrap } from '@/features/girl/ui';
import { hueOf } from '@/lib/format';
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
export default function GirlsMoving() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<Status | null>(null);
  const [looking, setLooking] = useState<string | null>(null);
  const circle = useGirlCircle('bali', { status, looking });
  const extras = useGirlExtras();
  const me = extras.data;
  const communities = useCommunitiesLike('bali', '', true);

  const setMine = (patch: Parameters<typeof extras.save>[0]) =>
    extras
      .save({ destination: 'bali', ...patch })
      .then(() => haptic('success'))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live'));

  return (
    <View style={[styles.root]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40, gap: space[6] }} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PressableScale haptic="tap" scaleTo={0.9} onPress={() => router.back()} accessibilityLabel="Back" style={styles.round}>
            <Icon name="chevronLeft" size={20} color={girl.ink} />
          </PressableScale>
          <Text variant="titleM" color={girl.ink} style={{ letterSpacing: 2 }}>
            IRLY <Text variant="titleM" color={girl.rose} style={{ letterSpacing: 2 }}>GIRL</Text> · BALI
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.pad, { gap: 8 }]}>
          <Text variant="displayM" color={girl.ink}>
            Moving to Bali and don’t know anyone?
          </Text>
          <Text variant="body" color={girl.inkSoft}>
            Here are women you can meet before you arrive.
          </Text>
        </View>

        {me?.hasProfile ? (
          <View style={styles.pad}>
            <View style={[styles.card, { gap: 10 }]}>
              <Text variant="titleS" color={girl.ink}>
                Where are you with Bali?
              </Text>
              <Wrap>
                {STATUSES.map((s) => (
                  <GChip key={s.id} small label={s.label} selected={me.destination === 'bali' && me.destinationStatus === s.id} onPress={() => setMine({ destinationStatus: s.id })} />
                ))}
              </Wrap>
              <Text variant="caption" color={girl.inkSoft}>
                Looking for
              </Text>
              <Wrap>
                {LOOKING.map((l) => {
                  const on = (me.lookingFor ?? []).includes(l);
                  return <GChip key={l} small label={tx(l)} selected={on} onPress={() => setMine({ lookingFor: on ? (me.lookingFor ?? []).filter((x) => x !== l) : [...(me.lookingFor ?? []), l] })} />;
                })}
              </Wrap>
            </View>
          </View>
        ) : (
          <View style={styles.pad}>
            <GButton label="Create my IRLY Girl profile first" icon="user" onPress={() => router.push('/girl')} />
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
          {circle.error ? (
            <Text variant="bodyS" color={girl.inkSoft}>
              {/girl|women|reserved|profile/i.test(circle.error) ? tx(circle.error) : 'Could not load. Check your connection.'}
            </Text>
          ) : !circle.data.length ? (
            <Text variant="bodyS" color={girl.inkSoft}>
              Nobody here yet. Set your status above: the next woman moving to Bali will find you.
            </Text>
          ) : (
            circle.data.map((m) => (
              <View key={m.userId} style={[styles.card, styles.row]}>
                <Avatar name={m.firstName} hue={hueOf(m.userId)} size={48} />
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
              </View>
            ))
          )}
          {circle.data.length ? <GButton label="Connect in IRLY Girl" icon="heartHandshake" onPress={() => router.push('/girl')} /> : null}
        </View>

        <View style={styles.pad}>
          <View style={[styles.card, { gap: 10 }]}>
            <Text variant="titleM" color={girl.ink}>
              Plan something with girls
            </Text>
            <QuickPlan cityId="bali" types={GIRL_PLANS} palette="girl" />
          </View>
        </View>

        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM" color={girl.ink}>
            Bali girl communities
          </Text>
          {communities.data.map((c) => (
            <PressableScale key={c.id} onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, styles.row]} accessibilityLabel={c.name}>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" color={girl.ink}>
                  {c.name}
                </Text>
                {c.tagline ? (
                  <Text variant="caption" color={girl.inkSoft} numberOfLines={1}>
                    {c.tagline}
                  </Text>
                ) : null}
              </View>
              {c.member ? (
                <GChip small label={tx('Joined')} selected />
              ) : (
                <GButton
                  label="Join"
                  onPress={() =>
                    joinCommunity(c.id)
                      .then((conv) => {
                        haptic('success');
                        communities.reload();
                        if (conv) router.push(`/messages/${conv}`);
                      })
                      .catch((e) => toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live'))
                  }
                />
              )}
            </PressableScale>
          ))}
        </View>

        <View style={[styles.pad, { gap: 10 }]}>
          <Text variant="titleM" color={girl.ink}>
            Before you land
          </Text>
          <GButton label="Where should I live?" icon="compass" variant="secondary" onPress={() => router.push('/bali/quiz')} />
          <GButton label="Visa & stay (official sources)" icon="stamp" variant="secondary" onPress={() => router.push('/bali/guide/visa')} />
          <GButton label="Housing guide" icon="home" variant="secondary" onPress={() => router.push('/bali/guide/housing')} />
          <GButton label="My Bali move checklist" icon="package" variant="secondary" onPress={() => router.push('/bali/move')} />
        </View>
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
