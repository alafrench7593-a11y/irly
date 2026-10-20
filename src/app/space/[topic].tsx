import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { enter } from '@/motion/enter';
import Animated from 'react-native-reanimated';
import { NotFound } from '@/components/layout/NotFound';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { joinCommunity } from '@/features/community/data';
import { useCommunityExtras } from '@/features/community/groups';
import { SubgroupList } from '@/features/community/GroupsUI';
import { useRefreshOn } from '@/features/server/sync';
import { t as tx } from '@/i18n';
import { readGirlAccess, type GirlAccess } from '@/features/girl/access';
import { friendlyError, supabase } from '@/lib/supabase';
import { haptic } from '@/motion/haptics';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

type SpaceId = 'moms' | 'families' | 'girls';
type Space = { title: string; line: string; womenOnly: boolean; rules: { icon: IconName; text: string }[]; help?: string };

const SPACES: Record<SpaceId, Space> = {
  moms: {
    title: 'IRLY Moms',
    line: 'Moms meeting moms in the city: coffees, playdates, advice and recommendations.',
    womenOnly: true,
    help: 'schools',
    rules: [
      { icon: 'shield', text: 'Women only: checked by the server on every screen, post and group.' },
      { icon: 'eye', text: 'Think before posting children: no faces of other people’s kids without their parents’ consent.' },
      { icon: 'pin', text: 'Meet in public places first; never share your home address in a post.' },
      { icon: 'flag', text: 'Report anything inappropriate: hosts and IRLY review every report.' },
    ],
  },
  families: {
    title: 'IRLY Family',
    line: 'Families meeting families: weekend outings, kids activities, schools and good deals.',
    womenOnly: false,
    help: 'schools',
    rules: [
      { icon: 'eye', text: 'Children’s photos: only your own, and only what you would show anyone.' },
      { icon: 'pin', text: 'Meet in public places; share the area, never your address.' },
      { icon: 'briefcase', text: 'Professionals: offers are welcome in Family deals & events, clearly presented as offers.' },
      { icon: 'flag', text: 'Report anything inappropriate or misleading.' },
    ],
  },
  girls: {
    title: 'IRLY Girl',
    line: 'Women meeting women: brunches, padel, wellness, nights out, trips and a network that helps.',
    womenOnly: true,
    rules: [
      { icon: 'shield', text: 'Women only: checked by the server on every screen, post and group.' },
      { icon: 'pin', text: 'First meetups in public places; tell a friend where you go.' },
      { icon: 'lock', text: 'What is shared here stays here: no screenshots or reposts elsewhere.' },
      { icon: 'flag', text: 'Report or block anyone who makes you uncomfortable; hosts and IRLY act on every report.' },
    ],
  },
};

type Row = { id: string; name: string; tagline: string | null; members: number; isMember: boolean };

const isSpace = (x: string | undefined): x is SpaceId => x === 'moms' || x === 'families' || x === 'girls';

/** Past this, the screen offers Try again instead of a spinner. */
const LOAD_LIMIT = 25_000;

/**
 * A space (IRLY Mom, IRLY Family, IRLY Only Girls): its rules, its groups
 * and its official community, where members post text, photos and videos.
 * Same communities, groups, pins, announcements and reports as everywhere.
 */
export default function SpaceRoute() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  // An old or wrong link says so (it used to open IRLY Family silently).
  if (!isSpace(topic)) return <NotFound title="This space does not exist" />;
  return <SpaceScreen id={topic} />;
}

function SpaceScreen({ id }: { id: SpaceId }) {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const auth = useAuthStatus();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const s = SPACES[id];
  const [state, setState] = useState<{ for: string; row: Row | null; failed?: boolean }>({ for: '', row: null });
  const [busy, setBusy] = useState(false);
  const key = `${account?.userId}|${id}|${cityId}`;
  // Why a women-only space shows nothing (asked only then): not open here yet, paused, or not a woman's account.
  const [access, setAccess] = useState<GirlAccess | null>(null);
  const load = useCallback(() => {
    if (!supabase || !account) return;
    let settled = false;
    // Offline is not "reserved" or "not open": a failed refresh keeps what
    // is shown, a failed first load says so with a way to retry.
    const fail = () => setState((prev) => (prev.for === key && prev.row ? prev : { for: key, row: null, failed: true }));
    const timer = setTimeout(() => !settled && fail(), LOAD_LIMIT);
    Promise.resolve(supabase.rpc('space_community', { p_topic: id, p_city: cityId }))
      .then(async ({ data, error }) => {
        if (error) return fail();
        const r = ((data as Record<string, unknown>[] | null) ?? [])[0];
        if (!r && s.womenOnly) {
          // Unknown is not « reserved »: without the answer, the first load failed (Try again).
          const why = await readGirlAccess().catch(() => null);
          if (!why) return fail();
          setAccess(why);
        }
        setState({ for: key, row: r ? { id: r.id as string, name: r.name as string, tagline: (r.tagline as string | null) ?? null, members: Number(r.members ?? 0), isMember: Boolean(r.is_member) } : null });
      })
      .catch(fail)
      .finally(() => {
        settled = true;
        clearTimeout(timer);
      });
  }, [account, id, cityId, key, s.womenOnly]);
  useEffect(load, [load]);
  useRefreshOn(['communities'], load);
  const row = state.for === key ? state.row : null;
  const extras = useCommunityExtras(row?.id ?? '');

  const join = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await joinCommunity(row.id);
      haptic('success');
      toast(tx('Welcome to {name} 👋', { name: row.name }), 'users', 'brand');
      load();
      extras.reload();
    } catch (e) {
      toast(friendlyError(e instanceof Error ? e.message : 'Could not join'), 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page overline={s.womenOnly ? `${city.name} · ${tx('Women only')}` : city.name} title={s.title} subtitle={s.line}>
      <View style={{ gap: space[5] }}>
        {!supabase ? (
          // Demo build or no server configured: nothing to load, said plainly (it used to spin forever).
          <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
            <GlassLayer radius={radius.xl} />
            <Icon name="globe" size={20} color={t.c.text} />
            <Text variant="body" tone="secondary">
              Spaces open with an IRLY account, on the IRLY server. They are not available in this version.
            </Text>
          </View>
        ) : auth === 'unknown' ? (
          <SpaceSkeleton />
        ) : !account ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              Sign in to enter this space.
            </Text>
            <Button label="Sign in" onPress={() => router.push('/account')} />
          </View>
        ) : state.for !== key ? (
          <SpaceSkeleton />
        ) : state.failed ? (
          <View style={[styles.pad, { alignItems: 'center', gap: 10 }]}>
            <Text variant="body" tone="secondary" align="center">
              Can’t reach IRLY right now
            </Text>
            <Button label="Try again" size="sm" variant="secondary" onPress={() => (setState({ for: '', row: null }), load())} />
          </View>
        ) : !row ? (
          <ClosedSpace id={id} access={access} cityName={city.name} />
        ) : (
          <>
            <View style={[styles.pad, { gap: 10 }]}>
              <Text variant="caption" tone="tertiary">
                {tx('{n} members', { n: row.members })}
              </Text>
              {row.isMember ? (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Button label="Open the space" icon="users" full onPress={() => router.push(`/c/${row.id}`)} />
                  </View>
                  <Button label="Post" icon="edit" variant="secondary" onPress={() => router.push({ pathname: '/post/new', params: { community: row.id, name: row.name } })} />
                </View>
              ) : (
                <Button label="Join the space" icon="users" full loading={busy} onPress={join} />
              )}
              {s.help ? <Button label="Ask a question about schools, health…" icon="question" variant="ghost" onPress={() => router.push('/help')} /> : null}
            </View>
            <SubgroupList groups={extras.groups} onChanged={() => (extras.reload(), load())} />
          </>
        )}
        <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
          <GlassLayer radius={radius.xl} />
          <Text variant="titleS">Safety and respect</Text>
          {s.rules.map((r, idx) => (
            <Animated.View key={r.text} entering={enter.rise(Math.min(idx, 8))}>
              <View style={styles.rule}>
                <Icon name={r.icon} size={16} color={t.c.text} />
                <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
                  {tx(r.text)}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function SpaceSkeleton() {
  return (
    <View style={[styles.pad, { gap: 10 }]} accessibilityLabel={tx('Loading')}>
      <Skeleton width="30%" height={12} radius={6} />
      <Skeleton height={54} radius={27} />
      <Skeleton height={120} radius={radius.xl} />
    </View>
  );
}

/**
 * The space has no community to show. Women-only spaces (IRLY Mom, IRLY
 * Only Girls) say why: not open in this destination yet, IRLY Girl paused
 * for this account, or reserved for women, with IRLY Family as the open
 * alternative for parents. IRLY Family is open to everyone: only « not
 * open here yet » applies.
 */
function ClosedSpace({ id, access, cityName }: { id: SpaceId; access: GirlAccess | null; cityName: string }) {
  const t = useTheme();
  const router = useRouter();
  const s = SPACES[id];
  const notOpen = !s.womenOnly || access === 'open';
  const paused = s.womenOnly && access === 'suspended';
  return (
    <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <Icon name={notOpen ? 'compass' : paused ? 'shield' : 'lock'} size={20} color={t.c.text} />
      <Text variant="body" tone="secondary">
        {notOpen
          ? tx('{name} is not open in {city} yet.', { name: s.title, city: cityName })
          : paused
            ? tx('{name} is part of IRLY Girl, which is paused for your account. The rest of IRLY works as usual.', { name: s.title })
            : tx('{name} is reserved for women with an IRLY Girl account.', { name: s.title })}
      </Text>
      {notOpen && s.womenOnly ? <Button label="Open IRLY Girl" variant="secondary" onPress={() => router.push(id === 'moms' ? '/girl?mode=moms' : '/girl')} /> : null}
      {paused ? <Button label="Contact support" variant="secondary" onPress={() => router.push('/support')} /> : null}
      {!notOpen && !paused && id === 'moms' ? <Button label="Explore IRLY Family" icon="home" variant="secondary" onPress={() => router.replace('/space/families')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { marginHorizontal: space.gutter, padding: 16, gap: 10, borderRadius: radius.xl },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
