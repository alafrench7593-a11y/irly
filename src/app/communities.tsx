import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { CommunityCard } from '@/components/cards/ThingCards';
import { useFrame } from '@/components/layout/AppFrame';
import { Page } from '@/components/layout/Page';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { CITIES } from '@/data/destinations';
import { CommunityThumb } from '@/features/community/CommunityThumb';
import { ScopeToggle } from '@/components/ui/ScopeToggle';
import { getCityContent } from '@/data/repo';
import type { CityId, Community } from '@/data/types';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCommunityList, type CommunitySummary } from '@/features/community/data';
import { profileTags, TOPIC_GROUPS, useRecommendedCommunities } from '@/features/community/official';
import { useStore , useCityId } from '@/state/store';
import { Button } from '@/components/ui/Button';
import { t as tx } from '@/i18n';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const KINDS: { id: Community['kind'] | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'interest', label: 'Interests' },
  { id: 'sport', label: 'Sport' },
  { id: 'professional', label: 'Professional' },
  { id: 'neighbourhood', label: 'Neighbourhood' },
];

const LIVE_FILTERS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'popular', label: 'Popular' },
  { id: 'new', label: 'New' },
  { id: 'sports', label: 'Sports' },
  { id: 'networking', label: 'Networking' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'business', label: 'Business' },
  { id: 'lifestyle', label: 'Lifestyle' },
] as const;
type LiveFilter = (typeof LIVE_FILTERS)[number]['id'];
// Members' own communities follow their category.
const CATEGORY_GROUP: Record<string, string> = { sport: 'sports', networking: 'networking', travel: 'travel', food: 'food', wellness: 'fitness', outdoor: 'travel', nightlife: 'lifestyle', culture: 'lifestyle', family: 'lifestyle' };
const inGroup = (c: CommunitySummary, group: string) =>
  c.topic ? (TOPIC_GROUPS[group] ?? []).includes(c.topic) : CATEGORY_GROUP[c.categoryId ?? ''] === group || (group === 'business' && c.categoryId === 'networking');

export default function Communities() {
  const t = useTheme();
  const frame = useFrame();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const content = getCityContent(cityId);
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('all');
  const list = content.communities.filter((c) => kind === 'all' || c.kind === kind);
  const router = useRouter();
  const all = useCommunityList(cityId);
  const profile = useStore((s) => s.profile);
  const tags = useMemo(() => profileTags(profile), [profile]);
  const rec = useRecommendedCommunities(cityId, tags, 12);
  const [filter, setFilter] = useState<LiveFilter>('recommended');
  const live = useMemo(() => {
    if (filter === 'recommended') {
      const order = new Map((rec.list ?? []).map((r, i) => [r.id, i]));
      const top = all.filter((c) => order.has(c.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      // Nothing matches the answers yet: the official ones first, then the rest.
      return top.length ? top : [...all].sort((a, b) => Number(b.official) - Number(a.official));
    }
    if (filter === 'popular') return [...all].sort((a, b) => b.members - a.members || b.postsWeek - a.postsWeek);
    if (filter === 'new') return [...all].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return all.filter((c) => inGroup(c, filter));
  }, [all, filter, rec.list]);

  return (
    <Page overline={city.name} title="Communities" subtitle="Optional, by interest or neighbourhood. Meet the same faces again: that's how trust grows.">
      <View style={{ marginBottom: space[6] }}>
        <Rail gap={8}>
          {KINDS.map((k) => (
            <Chip key={k.id} size="sm" label={k.label} selected={kind === k.id} onPress={() => setKind(k.id)} />
          ))}
        </Rail>
      </View>
      <ScopeToggle cityId={cityId} />
      {all.length ? (
        <View style={{ marginBottom: space[4] }}>
          <Rail gap={8}>
            {LIVE_FILTERS.map((f) => (
              <Chip key={f.id} size="sm" label={f.label} selected={filter === f.id} onPress={() => setFilter(f.id)} />
            ))}
          </Rail>
        </View>
      ) : null}
      {all.length && !live.length ? (
        <Text variant="body" tone="secondary" style={{ paddingHorizontal: space.gutter, marginBottom: space[6] }}>
          No community here yet. Try another filter, or create one.
        </Text>
      ) : null}
      {live.length ? (
        <View style={{ paddingHorizontal: space.gutter, gap: 10, marginBottom: space[7] }}>
          <Text variant="overline" tone="tertiary">
            On IRLY now
          </Text>
          {live.map((c) => (
            <PressableScale key={c.id} onPress={() => router.push(`/c/${c.id}`)} haptic="select" scaleTo={0.98} style={[styles.live, { backgroundColor: t.c.surface }]} accessibilityLabel={c.name}>
              <CommunityThumb topic={c.topic} categoryId={c.categoryId} emoji={c.emoji} light={city.light} size={44} member={c.isMember} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" numberOfLines={1}>
                  {c.name}
                </Text>
                <Text variant="caption" tone="tertiary" numberOfLines={1}>
                  {[c.official ? 'IRLY' : null, c.isMember ? tx('Joined') : null, c.cityId && c.cityId !== cityId ? CITIES[c.cityId as CityId]?.name : null, c.members > 0 ? tx('{n} members', { n: c.members }) : null, c.postsWeek ? tx('{n} posts this week', { n: c.postsWeek }) : null, c.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
            </PressableScale>
          ))}
        </View>
      ) : null}
      {/* Always reachable, even in a city with no server communities yet. */}
      <View style={{ paddingHorizontal: space.gutter, marginBottom: space[6] }}>
        <Button label="Create a community" icon="plus" variant="secondary" full onPress={() => router.push('/community/new')} />
      </View>
      <View style={{ paddingHorizontal: space.gutter, gap: 14 }}>
        {list.map((c, i) => (
          <Animated.View key={c.id} entering={enter.rise(i, 60)} exiting={FadeOut.duration(140)} layout={LinearTransition.springify(420)}>
            <CommunityCard community={c} width={frame.width - space.gutter * 2} />
          </Animated.View>
        ))}
        <View style={[styles.create, { borderColor: t.c.lineStrong }]}>
          <Icon name="sprout" size={22} color={t.accent} />
          <Text variant="titleS" align="center">
            Missing your people?
          </Text>
          <Text variant="bodyS" tone="secondary" align="center">
            Start a community with five members and IRLY helps you host the first meetup.
          </Text>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  create: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed' },
});
