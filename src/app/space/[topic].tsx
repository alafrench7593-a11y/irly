import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/destinations';
import { useAccount } from '@/features/auth/account';
import { joinCommunity } from '@/features/community/data';
import { useCommunityExtras } from '@/features/community/groups';
import { SubgroupList } from '@/features/community/GroupsUI';
import { useRefreshOn } from '@/features/server/sync';
import { t as tx } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/motion/haptics';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type SpaceId = 'moms' | 'families' | 'girls';
type Space = { title: string; line: string; womenOnly: boolean; rules: { icon: IconName; text: string }[]; help?: string };

const SPACES: Record<SpaceId, Space> = {
  moms: {
    title: 'IRLY Mom',
    line: 'Mums meeting mums in the city: coffees, playdates, advice and recommendations.',
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
    title: 'IRLY Only Girls',
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

/**
 * A space (IRLY Mom, IRLY Family, IRLY Only Girls): its rules, its groups
 * and its official community, where members post text, photos and videos.
 * Same communities, groups, pins, announcements and reports as everywhere.
 */
export default function SpaceScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const id = (['moms', 'families', 'girls'].includes(topic ?? '') ? topic : 'families') as SpaceId;
  const s = SPACES[id];
  const [state, setState] = useState<{ for: string; row: Row | null; failed?: boolean }>({ for: '', row: null });
  const [busy, setBusy] = useState(false);
  const key = `${account?.userId}|${id}|${cityId}`;
  const load = useCallback(() => {
    if (!supabase || !account) return;
    supabase.rpc('space_community', { p_topic: id, p_city: cityId }).then(({ data, error }) => {
      // Offline is not "reserved" or "not open": a failed refresh keeps what
      // is shown, a failed first load says so with a way to retry.
      if (error) {
        setState((prev) => (prev.for === key && prev.row ? prev : { for: key, row: null, failed: true }));
        return;
      }
      const r = ((data as Record<string, unknown>[] | null) ?? [])[0];
      setState({ for: key, row: r ? { id: r.id as string, name: r.name as string, tagline: (r.tagline as string | null) ?? null, members: Number(r.members ?? 0), isMember: Boolean(r.is_member) } : null });
    });
  }, [account, id, cityId, key]);
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
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page overline={s.womenOnly ? `${city.name} · ${tx('Women only')}` : city.name} title={s.title} subtitle={s.line}>
      <View style={{ gap: space[5] }}>
        {!account ? (
          <View style={[styles.pad, { gap: 10 }]}>
            <Text variant="body" tone="secondary">
              Sign in to enter this space.
            </Text>
            <Button label="Sign in" onPress={() => router.push('/account')} />
          </View>
        ) : state.for !== key ? (
          <ActivityIndicator color={t.c.text} />
        ) : state.failed ? (
          <View style={[styles.pad, { alignItems: 'center', gap: 10 }]}>
            <Text variant="body" tone="secondary" align="center">
              Can’t reach IRLY right now
            </Text>
            <Button label="Try again" size="sm" variant="secondary" onPress={() => (setState({ for: '', row: null }), load())} />
          </View>
        ) : !row ? (
          <View style={[styles.card, { backgroundColor: t.c.surface }]}>
            <Icon name={s.womenOnly ? 'lock' : 'compass'} size={20} color={t.c.text} />
            <Text variant="body" tone="secondary">
              {s.womenOnly ? tx('{name} is reserved for women with an IRLY Girl account.', { name: s.title }) : tx('{name} is not open in {city} yet.', { name: s.title, city: city.name })}
            </Text>
            {s.womenOnly ? <Button label="Open IRLY Girl" variant="secondary" onPress={() => router.push('/girl')} /> : null}
          </View>
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
        <View style={[styles.card, { backgroundColor: t.c.surface }]}>
          <Text variant="titleS">Safety and respect</Text>
          {s.rules.map((r) => (
            <View key={r.text} style={styles.rule}>
              <Icon name={r.icon} size={16} color={t.c.text} />
              <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
                {tx(r.text)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: { marginHorizontal: space.gutter, padding: 16, gap: 10, borderRadius: radius.xl },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
});
