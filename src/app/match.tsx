import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { GRID_GAP, gridColumns, tileWidth } from '@/features/match/grid';
import { usePeopleMatch, type PeopleMatch } from '@/features/match/people';
import { ProfilePhoto } from '@/features/match/ProfilePhoto';
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
import { LinearGradient } from 'expo-linear-gradient';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Skeleton } from '@/components/ui/Skeleton';
import { enter } from '@/motion/enter';

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
 * Each card says why. Cards sit two side by side on a phone of 360 pt or
 * more (one below, more on a tablet): photo in 4:5, first name, handle,
 * what you share. Add friend sends a request the other person accepts;
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
  // The profile photo at full size (the 256 px copy is for avatars): a 4:5 card is never an enlarged thumbnail.
  const faces = useSignedLinks(
    'profile-photos',
    m.list.map((x) => x.photo),
  );
  const frame = useFrame();
  const window = useWindowDimensions();
  const screenW = frame.width || window.width;
  const columns = gridColumns(screenW);
  const inner = Math.min(screenW, 1120) - space.gutter * 2;
  const tileW = tileWidth(inner, columns);

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
          <View style={styles.grid} accessibilityLabel={tx('Loading')}>
            {Array.from({ length: columns * 2 }, (_, i) => (
              <Skeleton key={i} width={tileW} height={Math.round(tileW * 1.25) + 112} radius={radius.xl} />
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
          <View style={{ gap: 16 }}>
            <View style={styles.grid}>
              {m.list.map((p, i) => (
                <Animated.View key={p.id} entering={FadeInDown.delay(Math.min(i, 6) * 50).duration(260)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify(420)} style={{ width: tileW }}>
                  <MatchCard person={p} photo={p.photo ? faces[p.photo] : undefined} cityId={cityId} width={tileW} onSkip={() => m.skip(p.id)} />
                </Animated.View>
              ))}
            </View>
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

function MatchCard({ person, photo, cityId, width, onSkip }: { person: PeopleMatch; photo?: string; cityId: CityId; width: number; onSkip: () => Promise<void> }) {
  const t = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState<FriendStatus>(person.friendStatus);
  const [busy, setBusy] = useState<'friend' | 'skip' | null>(null);
  const shared = sharedLabels(person).slice(0, 3);
  const elsewhere = person.cityId && person.cityId !== cityId ? CITIES[person.cityId as CityId]?.name : null;
  const handle = [person.username ? `@${person.username}` : null, elsewhere].filter(Boolean).join(' · ');
  const photos = photo ? [photo] : undefined;

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
    <View style={[styles.card, { width, backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <PressableScale onPress={() => router.push(`/person/${person.id}`)} haptic="select" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={tx('Open {name}’s profile', { name: person.firstName })}>
        <View style={{ width, height: Math.round(width * 1.25) }}>
          <ProfilePhoto name={person.firstName} hue={hueOf(person.id)} userId={person.id} photos={photos} ground={t.c.overlay} style={StyleSheet.absoluteFill} placeholderSize={width < 200 ? 56 : 72} />
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} start={{ x: 0, y: 0.55 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={styles.verified} pointerEvents="none">
            <Icon name="check" size={12} color="#FFFFFF" strokeWidth={3} />
          </View>
          <View style={styles.name} pointerEvents="none">
            <Text variant="titleM" color="#FFFFFF" numberOfLines={1} raw>
              {person.firstName}
            </Text>
            {handle ? (
              <Text variant="caption" color="rgba(255,255,255,0.84)" numberOfLines={1} raw>
                {handle}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.tags}>
          {shared.length ? (
            <>
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                You both like
              </Text>
              {shared.map((s) => (
                <View key={s} style={[styles.tag, { backgroundColor: t.c.overlay }]}>
                  <Text variant="caption" numberOfLines={1}>
                    {s}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      </PressableScale>
      <View style={styles.actions}>
        {status === 'none' ? <Button label="Add friend" icon="userPlus" size="sm" loading={busy === 'friend'} onPress={add} style={{ flex: 1 }} /> : null}
        {status === 'outgoing' ? <Button label="Request sent" icon="check" size="sm" variant="secondary" disabled style={{ flex: 1 }} /> : null}
        {status === 'incoming' ? <Button label="Accept request" icon="userCheck" size="sm" loading={busy === 'friend'} onPress={add} style={{ flex: 1 }} /> : null}
        {status === 'friends' ? <Button label="Friends" icon="userCheck" size="sm" variant="secondary" disabled style={{ flex: 1 }} /> : null}
        <PressableScale haptic="tap" scaleTo={0.9} onPress={skip} disabled={busy === 'skip'} accessibilityRole="button" accessibilityLabel={tx('Not now')} style={[styles.skip, { backgroundColor: t.c.overlay, opacity: busy === 'skip' ? 0.5 : 1 }]}>
          <Icon name="x" size={16} color={t.c.text} />
        </PressableScale>
      </View>
    </View>
  );
}

function Empty({ icon, title, body, action, onAction }: { icon: IconName; title: string; body: string; action: string; onAction: () => void }) {
  const t = useTheme();
  return (
    <Animated.View entering={enter.rise(0)} style={styles.empty}>
      <GlassLayer radius={radius.xl} />
      <Icon name={icon} size={22} color={t.c.text} />
      <Text variant="titleS" align="center">
        {title}
      </Text>
      <Text variant="bodyS" tone="secondary" align="center">
        {body}
      </Text>
      <Button label={action} size="sm" onPress={onAction} style={{ marginTop: 6 }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2 },
  verified: { position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  name: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingTop: 10, height: 74, overflow: 'hidden' },
  tag: { paddingHorizontal: 9, height: 24, borderRadius: radius.pill, justifyContent: 'center', maxWidth: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginTop: 'auto' },
  skip: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, overflow: 'hidden' },
  how: { margin: space.gutter, marginTop: space[8], padding: 18, gap: 10, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  signals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: radius.pill },
});
