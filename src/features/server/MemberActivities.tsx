import { useRouter } from 'expo-router';
import { t as tx } from '@/i18n';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { ActivityTileCompact, gridTile, GRID_GAP } from '@/components/cards/HomeCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Skeleton } from '@/components/ui/Skeleton';
import { enter } from '@/motion/enter';
import { Button } from '@/components/ui/Button';
import { SectionHeader } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CATEGORY_BY_ID, type CategoryKey } from '@/data/catalog/categories';
import { CITIES } from '@/data/destinations';
import { ScopeToggle } from '@/components/ui/ScopeToggle';
import { useCityFilter } from './scope';
import type { CityId } from '@/data/types';
import { DEMO } from '@/config/app';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { PressableScale } from '@/motion/PressableScale';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';
import { useHomeActivities, type HomeActivity } from '@/features/home/FindSomethingToDo';
import { useRecommendations } from './activities';

/** Category groups rendered at first; « Show more » adds as many again. */
const GROUPS_PAGE = 3;
/** Cards per group on the Home (two rows on phones); the category page has them all. */
const PER_GROUP = 4;

/**
 * First names of the hosts, as the viewer may see them (profiles_public:
 * never a deleted account, never someone either of you blocked). `visible`
 * is null until the server answered, or when it could not be asked.
 */
function useOrganisers(ids: string[]): { names: Record<string, string>; visible: Set<string> | null } {
  const key = [...new Set(ids)].sort().join(',');
  const [state, setState] = useState<{ key: string; names: Record<string, string>; visible: Set<string> | null }>({ key: '', names: {}, visible: null });
  useEffect(() => {
    if (DEMO || !supabase || !key) return;
    let alive = true;
    supabase
      .from('profiles_public')
      .select('id, first_name')
      .in('id', key.split(','))
      .then(
        ({ data, error }) => {
          if (!alive || error) return;
          const rows = (data ?? []) as { id: string; first_name: string | null }[];
          setState({ key, names: Object.fromEntries(rows.map((r) => [r.id, (r.first_name ?? '').trim()])), visible: new Set(rows.map((r) => r.id)) });
        },
        () => undefined,
      );
    return () => {
      alive = false;
    };
  }, [key]);
  return state.key === key ? state : { names: {}, visible: null };
}

/**
 * « Planned by members »: plans members created themselves (every server
 * activity has a member as its host; the demo's venue events are left out),
 * grouped by category, two compact cards per row on phones. Hidden: past
 * plans, cancelled or deleted ones (the server never lists them) and plans
 * whose host is no longer visible to you (deleted account, blocked).
 */
export function MemberActivities({ cityId }: { cityId: CityId }) {
  const t = useTheme();
  const router = useRouter();
  const frame = useFrame();
  const reduced = useReducedMotion();
  // The section's own width (the framed phone on tablets is narrower than its frame by its borders).
  const [surface, setSurface] = useState(frame.width);
  const { width } = gridTile(surface);
  const { items, loading, error, refresh, signedIn } = useHomeActivities(cityId);
  const recs = useRecommendations(cityId);
  const { narrow } = useCityFilter(cityId);
  const me = useAccount()?.userId;
  const members = useMemo(() => items.filter((a) => a.creatorId), [items]);
  const { names, visible } = useOrganisers(members.map((a) => a.creatorId as string));
  const [groupsShown, setGroupsShown] = useState(GROUPS_PAGE);

  const groups = useMemo(() => {
    const rank = new Map(recs.map((r, i) => [r.id, i]));
    const shown = members
      .filter((a) => !visible || visible.has(a.creatorId as string))
      .map<HomeActivity>((a) => ({ ...a, mine: a.creatorId === me, organiser: a.organiser ?? (names[a.creatorId as string] || null) }));
    const by = new Map<string, HomeActivity[]>();
    for (const a of shown) {
      const k = CATEGORY_BY_ID[a.categoryId as CategoryKey] ? a.categoryId : 'other';
      by.set(k, [...(by.get(k) ?? []), a]);
    }
    // Recommended first (interests, friends going), then the soonest; groups follow their best plan.
    const score = (a: HomeActivity) => rank.get(a.id) ?? 99;
    return [...by.entries()]
      .map(([id, list]) => ({ id, list: [...list].sort((a, b) => score(a) - score(b) || a.startsAt - b.startsAt) }))
      .sort((a, b) => score(a.list[0]) - score(b.list[0]) || b.list.length - a.list.length || a.list[0].startsAt - b.list[0].startsAt);
  }, [members, visible, names, me, recs]);

  // Signed out, the server lists nothing: never say "nothing planned" when plans exist.
  if (!signedIn) return null;
  // Narrowed to one emirate and empty: keep the switch so « All Emirates » stays one tap away.
  if (!groups.length && !narrow && !loading && !error) return null;

  return (
    <View style={{ marginTop: space[8] }} onLayout={(e) => setSurface(Math.floor(e.nativeEvent.layout.width) || frame.width)}>
      <SectionHeader overline="Live on IRLY" title="Planned by members" />
      {DEMO ? null : <ScopeToggle cityId={cityId} />}
      {!groups.length && loading ? (
        <View style={styles.grid} accessibilityLabel={tx('Loading plans')}>
          {[0, 1].map((i) => (
            <Skeleton key={i} width={width} height={Math.round(width * 0.56) + 104} radius={radius.lg} />
          ))}
        </View>
      ) : !groups.length && error ? (
        <View style={styles.state}>
          <Text variant="bodyS" tone="secondary" align="center">
            Can’t load plans right now.
          </Text>
          <Button label="Try again" size="sm" variant="secondary" icon="repeat" onPress={refresh} />
        </View>
      ) : !groups.length ? (
        <Text variant="bodyS" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
          {tx('Nothing planned in {city} yet. See all the Emirates, or plan the first one.', { city: CITIES[cityId].name })}
        </Text>
      ) : null}
      <View style={{ gap: space[6] }}>
        {groups.slice(0, groupsShown).map((g, gi) => {
          const category = CATEGORY_BY_ID[g.id as CategoryKey];
          return (
            <View key={g.id} style={{ gap: space[3] }}>
              <View style={styles.groupHead}>
                <Icon name={category?.icon ?? 'sparkles'} size={14} color={category?.color ?? t.c.textSecondary} />
                <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                  {category?.label ?? 'Other'}
                </Text>
                {category && g.list.length > PER_GROUP ? (
                  <PressableScale haptic="select" onPress={() => router.push(`/category/${category.id}` as never)} accessibilityRole="link" accessibilityLabel={`${tx('All')} ${tx(category.label)}`}>
                    <Text variant="caption" tone="secondary">
                      {tx('All ({n})', { n: g.list.length })}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
              <View style={styles.grid}>
                {g.list.slice(0, PER_GROUP).map((a, i) => (
                  <Animated.View key={a.id} entering={reduced ? undefined : enter.rise(Math.min((gi % GROUPS_PAGE) * 2 + i, 6))}>
                    <ActivityTileCompact item={a} width={width} onPress={() => a.open(router)} />
                  </Animated.View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
      {groups.length > groupsShown ? (
        <View style={styles.more}>
          <Button label={tx('Show more ({n})', { n: groups.length - groupsShown })} size="sm" variant="secondary" icon="chevronDown" onPress={() => setGroupsShown((n) => n + GROUPS_PAGE)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP, paddingHorizontal: space.gutter },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.gutter },
  state: { paddingHorizontal: space.gutter, paddingVertical: space[4], alignItems: 'center', gap: space[3] },
  more: { alignItems: 'center', marginTop: space[5] },
});
