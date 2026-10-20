import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field, Segmented } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ScopeToggle } from '@/components/ui/ScopeToggle';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { DEMO } from '@/config/app';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { CommunityMap } from '@/features/community/CommunityMap';
import { CommunityThumb } from '@/features/community/CommunityThumb';
import type { MapCommunity } from '@/features/community/mapSpots';
import { displayCommunityName } from '@/features/community/name';
import { joinCommunity, leaveCommunity, useCommunityList, type CommunitySummary } from '@/features/community/data';
import { profileTags, TOPIC_GROUPS, useRecommendedCommunities, type OfficialCommunity } from '@/features/community/official';
import { isDemoId, useDemoCommunitiesLike, useDemoGirl } from '@/features/girl/demo';
import { GirlOfficialCommunities } from '@/features/girl/GirlOfficial';
import { useMemberProfile, type MemberCommunity } from '@/features/profile/member';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId, useStore } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Skeleton } from '@/components/ui/Skeleton';
import { enter } from '@/motion/enter';
import { SpaceFlavor } from '@/theme/space';
import { useAppSpace } from '@/state/appSpace';

type Tab = 'foryou' | 'all' | 'mine';

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'sports', label: 'Sports' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'networking', label: 'Networking' },
  { id: 'business', label: 'Business' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'culture', label: 'Culture' },
  { id: 'lifestyle', label: 'Lifestyle' },
] as const;
type Group = (typeof GROUPS)[number]['id'];

// Members' own communities follow their category.
const CATEGORY_GROUP: Record<string, Group> = { sport: 'sports', networking: 'networking', travel: 'travel', food: 'food', wellness: 'fitness', outdoor: 'travel', nightlife: 'lifestyle', culture: 'culture', family: 'lifestyle' };
const inGroup = (c: CommunitySummary, group: Group) =>
  group === 'all' ||
  (c.topic ? (TOPIC_GROUPS[group] ?? []).includes(c.topic) : CATEGORY_GROUP[c.categoryId ?? ''] === group || (group === 'business' && c.categoryId === 'networking'));

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Communities: every community this member may see, not only theirs.
 * For you: IRLY's own communities recommended from their onboarding answers
 * (never joined for them). All: the whole catalogue of the city (IRLY's and
 * members'), searchable and filtered by theme. Mine: the ones they really
 * belong to, created or joined, with Leave. Everything comes from the server
 * and reloads on any join or leave, here or on another phone.
 */
export default function CommunitiesRoute() {
  // In IRLY Girl the page wears the Girl look (cosmetic only, see theme/space) and lists IRLY Girl communities.
  return (
    <SpaceFlavor>
      <Communities />
    </SpaceFlavor>
  );
}

function Communities() {
  const cityId = useCityId();
  const city = CITIES[cityId];
  const router = useRouter();
  const uid = useAccount()?.userId;
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const inGirl = useAppSpace() === 'girl';
  // The demo build has no server: in IRLY Girl it shows the demo's example communities (as its Girl home does).
  const demoGirl = DEMO && inGirl;
  const signedIn = Boolean(uid) || demoGirl;
  const [tab, setTab] = useState<Tab>(params.tab === 'all' || params.tab === 'mine' ? params.tab : 'foryou');
  const serverAll = useCommunityList(cityId);
  const demo = useDemoCommunitiesLike(cityId, '');
  const demoAll = useMemo<CommunitySummary[]>(
    () =>
      demoGirl
        ? demo.data.map((c) => ({ id: c.id, name: c.name, tagline: c.tagline, categoryId: null, girlOnly: true, members: c.members, isMember: c.member, postsWeek: 0, cityId: c.cityId, official: false, topic: null, emoji: null, createdAt: null }))
        : [],
    [demo.data, demoGirl],
  );
  const all = demoGirl ? demoAll : serverAll;
  const profile = useStore((s) => s.profile);
  const tags = useMemo(() => profileTags(profile), [profile]);
  const recAll = useRecommendedCommunities(cityId, tags, 12);
  // In IRLY Girl, the recommendations are IRLY Girl communities too (the « All » list already is).
  const rec = useMemo(() => (inGirl && recAll.list ? { ...recAll, list: recAll.list.filter((c) => c.girlOnly) } : recAll), [recAll, inGirl]);
  const memberProfile = useMemberProfile(uid ?? '');
  const mine = useMemo(
    () =>
      demoGirl
        ? {
            communities: demoAll.filter((c) => c.isMember).map((c): MemberCommunity => ({ id: c.id, name: c.name, cityId: c.cityId ?? cityId, cover: null, members: c.members, tagline: c.tagline, role: 'joined' })),
            loading: false,
            error: null as string | null,
            reload: (): void => undefined,
          }
        : memberProfile,
    [demoGirl, demoAll, memberProfile, cityId],
  );
  const mineCount = signedIn ? mine.communities.length : 0;

  // Search and theme live here so the map shows exactly what the list below shows.
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  const shown = useMemo(() => {
    const q = norm(query.trim());
    return all.filter((c) => inGroup(c, group) && (!q || norm(`${c.name} ${c.tagline ?? ''} ${c.topic ?? ''} ${c.categoryId ?? ''}`).includes(q)));
  }, [all, group, query]);

  const mapList = useMemo<MapCommunity[]>(() => {
    if (tab === 'all') return shown;
    if (tab === 'mine') return mine.communities.map((c) => ({ id: c.id, name: c.name, topic: null, categoryId: null, cityId: c.cityId, emoji: null, members: c.members, isMember: true }));
    return (rec.list ?? []).map((c) => ({ id: c.id, name: c.name, topic: c.topic, categoryId: null, cityId: c.cityId, emoji: c.emoji, members: c.members, isMember: c.isMember }));
  }, [tab, shown, mine.communities, rec.list]);
  const mapStatus = !signedIn
    ? 'signedOut'
    : tab === 'foryou'
      ? rec.loading
        ? 'loading'
        : rec.error && !rec.list?.length
          ? 'error'
          : 'ready'
      : tab === 'mine'
        ? mine.loading
          ? 'loading'
          : mine.error && !mine.communities.length
            ? 'error'
            : 'ready'
        : 'ready';
  const mapEmpty =
    tab === 'all'
      ? all.length
        ? tx('No community matches these filters')
        : tx('No community here yet')
      : tab === 'mine'
        ? tx('You have not joined a community yet')
        : tx('No recommendation yet');

  return (
    <Page overline={city.name} title="Communities" subtitle="IRLY's communities and the ones members start. Meet the same faces again: that's how trust grows.">
      <View style={[styles.pad, { marginBottom: space[5] }]}>
        <CommunityMap cityId={cityId} communities={mapList} status={mapStatus} onRetry={tab === 'mine' ? mine.reload : rec.refresh} emptyText={mapEmpty} />
      </View>
      {!signedIn ? (
        <View style={styles.pad}>
          <Empty icon="users" title="Sign in to see the communities" body="Communities, their chats and their members are on the IRLY server." action="Sign in" onAction={() => router.push('/account')} />
        </View>
      ) : (
        <>
          <View style={[styles.pad, { marginBottom: space[5] }]}>
            <Segmented<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'foryou', label: tx('For you') },
                { value: 'all', label: all.length ? `${tx('All')} · ${all.length}` : tx('All') },
                { value: 'mine', label: mineCount ? `${tx('Mine')} · ${mineCount}` : tx('Mine') },
              ]}
            />
          </View>
          {/* IRLY Girl: « For you » is IRLY Girl's five official communities. */}
          {tab === 'foryou' ? inGirl ? <GirlOfficialCommunities /> : <ForYou rec={rec} cityId={cityId} onSeeAll={() => setTab('all')} /> : null}
          {tab === 'all' ? <All list={all} shown={shown} cityId={cityId} query={query} onQuery={setQuery} group={group} onGroup={setGroup} /> : null}
          {tab === 'mine' ? <Mine list={mine.communities} loading={mine.loading} error={mine.error} onReload={mine.reload} onBrowse={() => setTab('all')} /> : null}
        </>
      )}
      <View style={[styles.pad, { marginTop: space[6] }]}>
        <Button label="Create a community" icon="plus" variant="secondary" full onPress={() => router.push('/community/new')} />
      </View>
    </Page>
  );
}

function ForYou({ rec, cityId, onSeeAll }: { rec: ReturnType<typeof useRecommendedCommunities>; cityId: CityId; onSeeAll: () => void }) {
  const router = useRouter();
  const city = CITIES[cityId];
  if (rec.loading) return <Loading />;
  if (rec.error && !rec.list?.length)
    return (
      <View style={styles.pad}>
        <Empty icon="repeat" title="Can’t reach IRLY right now" body="Your recommendations will be back as soon as the connection is." action="Try again" onAction={rec.refresh} />
      </View>
    );
  const list = rec.list ?? [];
  if (!list.length)
    return (
      <View style={styles.pad}>
        <Empty
          icon="sparkles"
          title="Tell IRLY what you like"
          body="Recommendations come only from the interests you choose. Pick a few, or browse every community."
          action="Choose my interests"
          onAction={() => router.push('/edit-profile')}
          secondary="See all communities"
          onSecondary={onSeeAll}
        />
      </View>
    );
  const newcomers = list.filter((c) => c.introFirst);
  const rest = list.filter((c) => !c.introFirst);
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      {newcomers.length ? <Text variant="overline" tone="tertiary">{tx('New in {city}', { city: city.name })}</Text> : null}
      {newcomers.map((c, i) => (
        <Row index={i} key={c.id} id={c.id} name={c.name} topic={c.topic} categoryId={null} emoji={c.emoji} isMember={c.isMember} meta={meta(c, cityId)} action="join" />
      ))}
      {rest.length ? (
        <Text variant="overline" tone="tertiary" style={{ marginTop: newcomers.length ? space[3] : 0 }}>
          From your interests
        </Text>
      ) : null}
      {rest.map((c, i) => (
        <Row index={i} key={c.id} id={c.id} name={c.name} topic={c.topic} categoryId={null} emoji={c.emoji} isMember={c.isMember} meta={meta(c, cityId)} action="join" />
      ))}
    </View>
  );
}

const meta = (c: OfficialCommunity, cityId: string) =>
  [c.tagline || null, c.cityId && c.cityId !== cityId ? CITIES[c.cityId as CityId]?.name : null, c.members > 0 ? tx('{n} members', { n: c.members }) : null, c.girlOnly ? 'IRLY Girl' : null]
    .filter(Boolean)
    .join(' · ');

function All({
  list,
  shown,
  cityId,
  query,
  onQuery,
  group,
  onGroup,
}: {
  list: CommunitySummary[];
  shown: CommunitySummary[];
  cityId: CityId;
  query: string;
  onQuery: (q: string) => void;
  group: Group;
  onGroup: (g: Group) => void;
}) {
  const t = useTheme();
  return (
    <View>
      <View style={[styles.pad, { marginBottom: space[3] }]}>
        <Field icon="search" value={query} onChangeText={onQuery} placeholder="Search by name or theme" accessibilityLabel={tx('Search communities')} autoCorrect={false} returnKeyType="search" />
      </View>
      <View style={{ marginBottom: space[3] }}>
        <Rail gap={8}>
          {GROUPS.map((g) => (
            <Chip key={g.id} size="sm" label={g.label} selected={group === g.id} onPress={() => onGroup(g.id)} />
          ))}
        </Rail>
      </View>
      <ScopeToggle cityId={cityId} />
      <View style={[styles.pad, { gap: 10 }]}>
        {shown.map((c, i) => (
          <Row
            index={i}
            key={c.id}
            id={c.id}
            name={c.name}
            topic={c.topic}
            categoryId={c.categoryId}
            emoji={c.emoji}
            isMember={c.isMember}
            meta={[
              c.official ? 'IRLY' : tx('By a member'),
              c.cityId && c.cityId !== cityId ? CITIES[c.cityId as CityId]?.name : null,
              c.members > 0 ? tx('{n} members', { n: c.members }) : null,
              c.postsWeek ? tx('{n} posts this week', { n: c.postsWeek }) : null,
              c.girlOnly ? 'IRLY Girl' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            action="join"
          />
        ))}
        {!shown.length ? (
          <Text variant="body" tone="secondary" style={{ color: t.c.textSecondary, paddingVertical: space[4] }}>
            {list.length ? 'No community matches. Try another word or theme.' : 'No community here yet. Start the first one.'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Mine({ list, loading, error, onReload, onBrowse }: { list: MemberCommunity[]; loading: boolean; error: string | null; onReload: () => void; onBrowse: () => void }) {
  if (loading) return <Loading />;
  if (error && !list.length)
    return (
      <View style={styles.pad}>
        <Empty icon="repeat" title={error} body="Your communities are safe; they will show as soon as IRLY answers." action="Try again" onAction={onReload} />
      </View>
    );
  if (!list.length)
    return (
      <View style={styles.pad}>
        <Empty icon="users" title="No community yet" body="Join the ones that fit you: their chat and their plans open to you." action="Browse communities" onAction={onBrowse} />
      </View>
    );
  const created = list.filter((c) => c.role === 'created');
  const joined = list.filter((c) => c.role !== 'created');
  const cityName = (id: string) => CITIES[id as CityId]?.name ?? null;
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      {created.length ? <Text variant="overline" tone="tertiary">Created</Text> : null}
      {created.map((c, i) => (
        <Row index={i} key={c.id} id={c.id} name={c.name} topic={null} categoryId={null} emoji={null} isMember meta={[c.tagline, cityName(c.cityId), c.members > 0 ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ')} action="none" />
      ))}
      {joined.length ? (
        <Text variant="overline" tone="tertiary" style={{ marginTop: created.length ? space[3] : 0 }}>
          Joined
        </Text>
      ) : null}
      {joined.map((c, i) => (
        <Row index={i} key={c.id} id={c.id} name={c.name} topic={null} categoryId={null} emoji={null} isMember meta={[c.tagline, cityName(c.cityId), c.members > 0 ? tx('{n} members', { n: c.members }) : null].filter(Boolean).join(' · ')} action="leave" />
      ))}
    </View>
  );
}

/**
 * One community: tap to open it. Join answers only once the server has
 * recorded it; Leave asks once more, then the row goes when the server
 * confirms (the lists reload from the sync bus).
 */
function Row({
  id,
  name: stored,
  topic,
  categoryId,
  emoji,
  isMember,
  meta: line,
  action,
  index = 0,
}: {
  index?: number;
  id: string;
  name: string;
  topic: string | null;
  categoryId: string | null;
  emoji: string | null;
  isMember: boolean;
  meta: string;
  action: 'join' | 'leave' | 'none';
}) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[useCityId()];
  // Never an id or a test code as the title, whichever list the row comes from.
  const name = displayCommunityName({ name: stored, topic, categoryId, cityId: city.id });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const join = () => {
    if (isDemoId(id)) {
      useDemoGirl.getState().toggle('joined', id);
      toast(tx('You joined {name}', { name }));
      return;
    }
    setBusy(true);
    joinCommunity(id)
      .then(() => toast(tx('You joined {name}', { name })))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live'))
      .finally(() => setBusy(false));
  };
  const leave = () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    if (isDemoId(id)) {
      useDemoGirl.getState().toggle('joined', id);
      setConfirm(false);
      toast(tx('You left {name}', { name }));
      return;
    }
    setBusy(true);
    leaveCommunity(id)
      .then(() => toast(tx('You left {name}', { name })))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not leave', 'x', 'live'))
      .finally(() => {
        setBusy(false);
        setConfirm(false);
      });
  };
  return (
    <Animated.View entering={enter.rise(Math.min(index, 8))} layout={LinearTransition.springify().dampingRatio(0.9)}>
      <PressableScale onPress={() => router.push(`/c/${id}`)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={name}>
        <GlassLayer radius={radius.lg} />
        <CommunityThumb id={id} name={name} topic={topic} categoryId={categoryId} emoji={emoji} light={city.light} size={44} member={isMember} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS" numberOfLines={1} raw>
            {name}
          </Text>
          {line ? (
            <Text variant="caption" tone="tertiary" numberOfLines={2}>
              {line}
            </Text>
          ) : null}
        </View>
        {action === 'join' && !isMember ? <Button label="Join" size="sm" loading={busy} onPress={join} /> : null}
        {action === 'join' && isMember ? (
          <Text variant="caption" tone="secondary">
            Joined
          </Text>
        ) : null}
        {action === 'leave' ? <Button label={confirm ? 'Leave?' : 'Leave'} size="sm" variant={confirm ? 'danger' : 'ghost'} loading={busy} onPress={leave} /> : null}
        {action === 'none' ? <Icon name="chevronRight" size={16} color={t.c.textTertiary} /> : null}
      </PressableScale>
    </Animated.View>
  );
}

function Loading() {
  return (
    <View style={[styles.pad, { gap: 10 }]} accessibilityLabel={tx('Loading')}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={72} radius={radius.lg} />
      ))}
    </View>
  );
}

function Empty({
  icon,
  title,
  body,
  action,
  onAction,
  secondary,
  onSecondary,
}: {
  icon: IconName;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
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
      {secondary && onSecondary ? <Button label={secondary} size="sm" variant="ghost" onPress={onSecondary} /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  empty: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, overflow: 'hidden' },
});
