import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { usePeopleMatch, type PeopleMatch } from '@/features/match/people';
import { SoonPage } from '@/features/soon/SoonPage';
import { setFriend, type FriendStatus } from '@/features/profile/member';
import { useSignedLinks } from '@/features/server/media';
import { useMyVerification } from '@/features/verify/verify';
import { t as tx } from '@/i18n';
import { FEATURES } from '@/lib/features';
import { hueOf } from '@/lib/format';
import { PressableScale } from '@/motion/PressableScale';
import { LOOKING_LABEL } from '@/data/lookingFor';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

const GOALS = LOOKING_LABEL;

const SIGNALS: { icon: IconName; label: string }[] = [
  { icon: 'heart', label: 'Interests' },
  { icon: 'activity', label: 'Activities' },
  { icon: 'target', label: 'Goals' },
  { icon: 'languages', label: 'Languages' },
  { icon: 'pin', label: 'City' },
];

/** What two people share, in words: only from what both declared. */
function sharedLabels(m: PeopleMatch): string[] {
  const out = [
    ...m.activities.map((a) => (ACTIVITIES as Record<string, { label: string }>)[a]?.label),
    ...m.interests.map((i) => (INTERESTS as Record<string, { label: string }>)[i]?.label),
    ...m.goals.map((g) => GOALS[g]),
  ].filter((x): x is string => Boolean(x));
  return [...new Set(out)].slice(0, 5);
}

/**
 * /match. While Match IRLY is switched off (src/lib/features.ts) this is
 * its coming-soon page, rendered here so every link, deep link and the
 * tab-bar disc land on it without a redirect. The real screen below is
 * not mounted then: no Match hook runs and nothing is fetched.
 */
export default function MatchRoute() {
  return FEATURES.matchIrly ? <Match /> : <SoonPage id="match" />;
}

/**
 * Match IRLY: real members to meet, ranked on the server by what you share.
 * Each card says why. Add friend sends a request the other person accepts;
 * Not now hides them for 30 days. Nothing here follows anyone or opens a
 * chat on its own.
 */
function Match() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const m = usePeopleMatch(cityId);
  const ver = useMyVerification();
  const locked = m.signedIn && ver.v !== null && !ver.v.ready;
  const faces = useSignedLinks(
    'profile-photos',
    m.list.map((x) => x.photo),
  );

  return (
    <Page overline={`Match IRLY · ${city.name}`} title="People to meet" subtitle="Real members who share your interests and plans. Always with the reason why.">
      <View style={styles.pad}>
        {!m.signedIn ? (
          <Empty icon="users" title="Sign in to see your matches" body="Matching uses your own answers and real IRLY members." action="Sign in" onAction={() => router.push('/account')} />
        ) : locked ? (
          <Empty
            icon="shield"
            title={ver.v?.status === 'pending' ? 'Your selfie is being reviewed' : 'Verify your profile to use Match'}
            body={ver.v?.status === 'pending' ? 'Match opens as soon as a person at IRLY has checked it. You will get a notification.' : 'Only verified members are in Match: 3 photos of you and a selfie reviewed by IRLY. Everyone you meet here did the same.'}
            action={ver.v?.status === 'pending' ? 'See my verification' : 'Verify my profile'}
            onAction={() => router.push('/verify')}
          />
        ) : m.loading ? (
          <View style={{ gap: 12 }} accessibilityLabel={tx('Loading')}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.card, { backgroundColor: t.c.surface, height: 132, opacity: 0.6 }]} />
            ))}
          </View>
        ) : m.error && !m.list.length ? (
          <Empty icon="repeat" title={m.error} body="Your matches will be back as soon as IRLY answers." action="Try again" onAction={m.reload} />
        ) : !m.list.length ? (
          <Empty
            icon="sparkles"
            title="No match yet"
            body="Nobody shares your answers here yet. Add more interests and activities, or come back as more people join."
            action="Edit my interests"
            onAction={() => router.push('/onboarding/interests')}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {m.list.map((p, i) => (
              <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(260)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify(420)}>
                <MatchCard person={p} photo={p.photo ? faces[p.photo] : undefined} cityId={cityId} onSkip={() => m.skip(p.id)} />
              </Animated.View>
            ))}
            {m.more ? <Button label="Show more" variant="secondary" loading={m.loadingMore} onPress={m.loadMore} full /> : null}
          </View>
        )}
      </View>

      <View style={[styles.how, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: t.c.line }]}>
        <GlassLayer radius={radius.xl} />
        <Text variant="overline" tone="tertiary">
          How Match IRLY works
        </Text>
        <Text variant="bodyS" tone="secondary">
          No swiping, no score on people. We compare what you both chose and show what you share. Hidden profiles, blocked members and your friends are never suggested.
        </Text>
        <View style={styles.signals}>
          {SIGNALS.map((s) => (
            <View key={s.label} style={[styles.signal, { backgroundColor: t.c.overlay }]}>
              <Icon name={s.icon} size={14} color={t.c.text} />
              <Text variant="caption">{s.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function MatchCard({ person, photo, cityId, onSkip }: { person: PeopleMatch; photo?: string; cityId: CityId; onSkip: () => Promise<void> }) {
  const t = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<FriendStatus>(person.friendStatus);
  const [busy, setBusy] = useState<'friend' | 'skip' | null>(null);
  const shared = sharedLabels(person);
  const elsewhere = person.cityId && person.cityId !== cityId ? CITIES[person.cityId as CityId]?.name : null;

  const add = () => {
    setBusy('friend');
    setFriend(person.id, 'add')
      .then((s) => {
        setStatus(s);
        toast(s === 'friends' ? tx('You and {name} are friends', { name: person.firstName }) : tx('Request sent to {name}', { name: person.firstName }));
      })
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live'))
      .finally(() => setBusy(null));
  };
  const skip = () => {
    setBusy('skip');
    onSkip()
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not hide', 'x', 'live'))
      .finally(() => setBusy(null));
  };

  return (
    <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <PressableScale onPress={() => router.push(`/person/${person.id}`)} haptic="select" scaleTo={0.98} style={styles.head} accessibilityLabel={tx('Open {name}’s profile', { name: person.firstName })}>
        <Avatar name={person.firstName} hue={hueOf(person.id)} size={56} photo={photo} userId={person.id} verified />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="titleS" numberOfLines={1} raw>
            {person.firstName}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
            {[person.username ? `@${person.username}` : null, elsewhere].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
      </PressableScale>
      {shared.length ? (
        <View style={styles.tags}>
          <Text variant="caption" tone="secondary">
            You both like
          </Text>
          {shared.map((s) => (
            <View key={s} style={[styles.tag, { backgroundColor: t.c.overlay }]}>
              <Text variant="caption">{s}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        {status === 'none' ? <Button label="Add friend" icon="userPlus" size="sm" loading={busy === 'friend'} onPress={add} style={{ flex: 1 }} /> : null}
        {status === 'outgoing' ? <Button label="Request sent" icon="check" size="sm" variant="secondary" disabled style={{ flex: 1 }} /> : null}
        {status === 'incoming' ? <Button label="Accept request" icon="userCheck" size="sm" loading={busy === 'friend'} onPress={add} style={{ flex: 1 }} /> : null}
        {status === 'friends' ? <Button label="Friends" icon="userCheck" size="sm" variant="secondary" disabled style={{ flex: 1 }} /> : null}
        <Button label="Not now" size="sm" variant="ghost" loading={busy === 'skip'} onPress={skip} />
      </View>
    </View>
  );
}

function Empty({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action: string; onAction: () => void }) {
  const t = useTheme();
  return (
    <View style={[styles.empty, { borderColor: t.c.lineStrong }]}>
      <Icon name={icon} size={22} color={t.c.text} />
      <Text variant="titleS" align="center">
        {title}
      </Text>
      <Text variant="bodyS" tone="secondary" align="center">
        {body}
      </Text>
      <Button label={action} size="sm" onPress={onAction} style={{ marginTop: 6 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  card: { padding: 14, gap: 12, borderRadius: radius.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 10, height: 26, borderRadius: radius.pill, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed' },
  how: { margin: space.gutter, marginTop: space[8], padding: 18, gap: 10, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill },
});
