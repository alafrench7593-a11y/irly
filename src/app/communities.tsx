import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Rail } from '@/components/cards/Blocks';
import { useFrame } from '@/components/layout/frame';
import { gridCell, gridStyles } from '@/components/layout/grid';
import { ScreenColumn } from '@/components/layout/responsive';
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
import { CommunityThumb } from '@/features/community/CommunityThumb';
import { displayCommunityName } from '@/features/community/name';
import { joinCommunity, leaveCommunity, useCommunityList, type CommunitySummary } from '@/features/community/data';
import { CommunityStats } from '@/features/community/discovery/CommunityStats';
import { fromDemo, fromSummary, inSpace, sortLocally, useDirectory, useDirectorySort, useFavorites, type DirectoryCommunity } from '@/features/community/discovery/directory';
import { FavoriteStar } from '@/features/community/discovery/FavoriteStar';
import { SortBar } from '@/features/community/discovery/SortBar';
import { useCityFilter } from '@/features/server/scope';
import { profileTags, TOPIC_GROUPS, useRecommendedCommunities, type OfficialCommunity } from '@/features/community/official';
import { prefetchCommunity } from '@/features/community/prefetch';
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
const inGroup = (c: { topic: string | null; categoryId: string | null }, group: Group) =>
  group === 'all' ||
  (c.topic ? (TOPIC_GROUPS[group] ?? []).includes(c.topic) : CATEGORY_GROUP[c.categoryId ?? ''] === group || (group === 'business' && c.categoryId === 'networking'));

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** What the instant search reads while typing: the server search also reads the category's name. */
const searchable = (c: DirectoryCommunity) => norm(`${c.name} ${c.tagline ?? ''} ${c.description ?? ''} ${c.topic ?? ''} ${c.categoryId ?? ''}`);

/** The value, once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** Real counts of a community, when the server gave them: members and upcoming activities. */
type Stats = { members: number | null; upcoming: number | null };


/**
 * Communities: every community this member may see, not only theirs, in
 * three sections. My communities: the ones they really belong to, created
 * or joined, their favourites pinned first, with Leave. Recommended for me:
 * IRLY's own communities recommended from their onboarding answers (never
 * joined for them). Discover: the whole directory of the city (IRLY's and
 * members'), sorted and searched on the server, filtered by theme. Every
 * count is the server's; everything reloads on any join or leave, here or
 * on another phone.
 */
export default function CommunitiesRoute() {
  // In IRLY Girl the page wears the Girl look (cosmetic only, see theme/space) and lists IRLY Girl communities.
  // From WIDE (760 pt) the page uses the whole width; between the phone layout and that, a readable column.
  const wide = useFrame().width >= WIDE;
  return (
    <SpaceFlavor>
      <ScreenColumn wide={wide}>
        <Communities />
      </ScreenColumn>
    </SpaceFlavor>
  );
}

/** From this width the page lays the tabs, the search and the themes out in rows, and the communities as a grid of cards. */
const WIDE = 760;

/**
 * Wide: the width of one community card (as many as fit, 260 pt at least),
 * else undefined (one row per community).
 */
function useCardWidth(): number | undefined {
  const width = useFrame().width;
  if (width < WIDE) return undefined;
  return gridCell(width - space.gutter * 2, 260, 4, 12);
}

/** The server search starts from this many characters; the instant filter answers from the first. */
const SEARCH_MIN = 2;

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
  // In IRLY Girl, the recommendations are IRLY Girl communities too (the « Discover » list already is).
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

  // The directory: sorted on the server (the sort holds for the session), searched there too once typing settles.
  const sort = useDirectorySort((s) => s.sort);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('all');
  const typed = query.trim();
  const settled = useSettled(typed, 300);
  const serverOn = signedIn && !demoGirl;
  const dir = useDirectory(cityId, sort, null, serverOn);
  const searching = settled.length >= SEARCH_MIN;
  const found = useDirectory(cityId, sort, searching ? settled : null, serverOn && searching);

  // Same communities as community_list shows (its space, the emirate toggle): the directory has no city, community_list does.
  const { keep } = useCityFilter(cityId);
  const cityOf = useMemo(() => new Map(all.map((c) => [c.id, c.cityId])), [all]);
  const place = useMemo(() => {
    const visible = (c: DirectoryCommunity) => inSpace(c, inGirl) && keep(c.cityId);
    return (list: DirectoryCommunity[]) => list.map((c) => ({ ...c, cityId: c.cityId ?? cityOf.get(c.id) ?? null })).filter(visible);
  }, [inGirl, keep, cityOf]);
  // Until the directory answers (or if it cannot), community_list sorted here: its upcoming counts stay unknown.
  const base = useMemo<DirectoryCommunity[]>(
    () => (demoGirl ? sortLocally(demoAll.map(fromDemo), sort) : dir.list ? place(dir.list) : sortLocally(all.map(fromSummary), sort)),
    [demoGirl, demoAll, sort, dir.list, place, all],
  );
  // What the server knows of each community (counts, favourite), for the cards of every section.
  const known = useMemo(() => new Map((demoGirl ? base : (dir.list ?? [])).map((c) => [c.id, c])), [demoGirl, base, dir.list]);

  // Search and theme: what « Discover » lists.
  const shown = useMemo(() => {
    const q = norm(typed);
    const local = base.filter((c) => inGroup(c, group) && (!q || searchable(c).includes(q)));
    // The server's answer for what is typed now leads; what the instant filter found besides stays.
    if (!q || settled !== typed || !found.list) return local;
    const server = place(found.list).filter((c) => inGroup(c, group));
    const ids = new Set(server.map((c) => c.id));
    return [...server, ...local.filter((c) => !ids.has(c.id))];
  }, [base, group, typed, settled, found.list, place]);

  // Wide: the tabs and « Create » on one row, the search, the themes and the sort under them, the communities in a grid below.
  const card = useCardWidth();
  const wide = card !== undefined;
  const create = <Button label="Create a community" icon="plus" variant="secondary" full onPress={() => router.push('/community/new')} />;
  const tabs = signedIn ? (
    <Segmented<Tab>
      value={tab}
      onChange={setTab}
      options={[
        { value: 'mine', label: mineCount ? `${tx('Mine')} · ${mineCount}` : tx('Mine') },
        { value: 'foryou', label: tx('For you') },
        { value: 'all', label: base.length ? `${tx('Discover')} · ${base.length}` : tx('Discover') },
      ]}
    />
  ) : null;
  const filters =
    signedIn && tab === 'all' ? (
      <>
        <Filters cityId={cityId} query={query} onQuery={setQuery} group={group} onGroup={setGroup} wide={wide} />
        <SortBar wide={wide} />
      </>
    ) : null;

  return (
    <Page overline={city.name} title="Communities" subtitle="IRLY's communities and the ones members start. Meet the same faces again: that's how trust grows.">
      {wide ? (
        <View style={[styles.pad, styles.controls]}>
          <View style={styles.top}>
            <View style={styles.tabsWide}>{tabs}</View>
            <View style={styles.createWide}>{create}</View>
          </View>
          {filters}
        </View>
      ) : null}
      {!signedIn ? (
        <View style={styles.pad}>
          <Empty icon="users" title="Sign in to see the communities" body="Communities, their chats and their members are on the IRLY server." action="Sign in" onAction={() => router.push('/account')} />
        </View>
      ) : (
        <>
          {wide ? null : <View style={[styles.pad, { marginBottom: space[5] }]}>{tabs}</View>}
          {tab === 'mine' ? (
            <Section title={<Text variant="overline" tone="secondary">My communities</Text>}>
              <Mine list={mine.communities} known={known} loading={mine.loading} error={mine.error} onReload={mine.reload} onBrowse={() => setTab('all')} card={card} />
            </Section>
          ) : null}
          {tab === 'foryou' ? (
            <Section title={<Text variant="overline" tone="secondary">Recommended for me</Text>}>
              {/* IRLY Girl: « For you » is IRLY Girl's official list (Girl Expat … Les Françaises à Dubaï). */}
              {inGirl ? <GirlOfficialCommunities cell={card} /> : <ForYou rec={rec} known={known} cityId={cityId} onSeeAll={() => setTab('all')} card={card} />}
            </Section>
          ) : null}
          {tab === 'all' ? (
            <Section title={<Text variant="overline" tone="secondary">Discover</Text>}>
              {wide ? null : filters}
              <All list={base} shown={shown} cityId={cityId} card={card} />
            </Section>
          ) : null}
        </>
      )}
      {wide ? null : <View style={[styles.pad, { marginTop: space[6] }]}>{create}</View>}
    </Page>
  );
}

/** One of the three sections: its name in capitals over its communities. */
function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <View>
      <View style={[styles.pad, styles.sectionTitle]} accessibilityRole="header">
        {title}
      </View>
      {children}
    </View>
  );
}

/** Search and themes of « Discover »: a rail of themes on a phone, every theme at once on a wide screen. */
function Filters({ cityId, query, onQuery, group, onGroup, wide }: { cityId: CityId; query: string; onQuery: (q: string) => void; group: Group; onGroup: (g: Group) => void; wide: boolean }) {
  const chips = GROUPS.map((g) => <Chip key={g.id} size="sm" label={g.label} selected={group === g.id} onPress={() => onGroup(g.id)} />);
  return (
    <View style={wide ? { gap: space[3] } : null}>
      <View style={wide ? null : [styles.pad, { marginBottom: space[3] }]}>
        <Field icon="search" value={query} onChangeText={onQuery} placeholder="Search by name, theme or description" accessibilityLabel={tx('Search communities')} autoCorrect={false} returnKeyType="search" />
      </View>
      {wide ? (
        <View style={[gridStyles.row, { gap: 8 }]}>{chips}</View>
      ) : (
        <View style={{ marginBottom: space[3] }}>
          <Rail gap={8}>{chips}</Rail>
        </View>
      )}
      <View style={wide ? null : { marginBottom: space[3] }}>
        <ScopeToggle cityId={cityId} inset={!wide} />
      </View>
    </View>
  );
}

function ForYou({ rec, known, cityId, onSeeAll, card }: { rec: ReturnType<typeof useRecommendedCommunities>; known: Map<string, DirectoryCommunity>; cityId: CityId; onSeeAll: () => void; card?: number }) {
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
  const row = (c: OfficialCommunity, i: number) => (
    <Row
      index={i}
      key={c.id}
      id={c.id}
      name={c.name}
      topic={c.topic}
      categoryId={null}
      emoji={c.emoji}
      isMember={c.isMember}
      meta={meta(c, cityId, !card)}
      blurb={c.tagline}
      card={card}
      action="join"
      stats={{ members: c.members, upcoming: known.get(c.id)?.upcoming ?? null }}
      favorite={known.get(c.id)?.isFavorite}
    />
  );
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      {newcomers.length ? <Text variant="overline" tone="tertiary">{tx('New in {city}', { city: city.name })}</Text> : null}
      <Cards card={card}>{newcomers.map(row)}</Cards>
      {rest.length ? (
        <Text variant="overline" tone="tertiary" style={{ marginTop: newcomers.length ? space[3] : 0 }}>
          From your interests
        </Text>
      ) : null}
      <Cards card={card}>{rest.map(row)}</Cards>
    </View>
  );
}

/** The communities of a list: one under the other on a phone, a grid of cards (`card` wide) on a wide screen. */
function Cards({ card, children }: { card?: number; children: ReactNode }) {
  return card ? <View style={[gridStyles.row, { gap: 12 }]}>{children}</View> : <>{children}</>;
}

// The tagline leads the line of a row; a card shows it on its own (`withTagline` false). Counts are on the stats line.
const meta = (c: OfficialCommunity, cityId: string, withTagline = true) =>
  [withTagline ? c.tagline || null : null, c.cityId && c.cityId !== cityId ? CITIES[c.cityId as CityId]?.name : null, c.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ');

function All({ list, shown, cityId, card }: { list: DirectoryCommunity[]; shown: DirectoryCommunity[]; cityId: CityId; card?: number }) {
  const t = useTheme();
  return (
    <View>
      <View style={[styles.pad, card ? [gridStyles.row, { gap: 12 }] : { gap: 10 }]}>
        {shown.map((c, i) => (
          <Row
            card={card}
            blurb={c.tagline}
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
              c.postsWeek ? tx('{n} posts this week', { n: c.postsWeek }) : null,
              c.girlOnly ? 'IRLY Girl' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            action="join"
            stats={{ members: c.members, upcoming: c.upcoming }}
            favorite={c.isFavorite}
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

function Mine({
  list,
  known,
  loading,
  error,
  onReload,
  onBrowse,
  card,
}: {
  list: MemberCommunity[];
  known: Map<string, DirectoryCommunity>;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onBrowse: () => void;
  card?: number;
}) {
  const t = useTheme();
  const chosen = useFavorites((s) => s.chosen);
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
  // Favourites first, whichever way the member belongs; then the ones they created, then the ones they joined.
  const isFavorite = (id: string) => chosen[id] ?? known.get(id)?.isFavorite ?? false;
  const favorites = list.filter((c) => isFavorite(c.id));
  const created = list.filter((c) => !isFavorite(c.id) && c.role === 'created');
  const joined = list.filter((c) => !isFavorite(c.id) && c.role !== 'created');
  const cityName = (id: string) => CITIES[id as CityId]?.name ?? null;
  // The tagline leads the line of a row; a card shows it on its own.
  const facts = (c: MemberCommunity) => [card ? null : c.tagline, cityName(c.cityId)].filter(Boolean).join(' · ');
  const row = (c: MemberCommunity, i: number) => (
    <Row
      index={i}
      key={c.id}
      id={c.id}
      name={c.name}
      topic={known.get(c.id)?.topic ?? null}
      categoryId={known.get(c.id)?.categoryId ?? null}
      emoji={known.get(c.id)?.emoji ?? null}
      isMember
      meta={facts(c)}
      blurb={c.tagline}
      card={card}
      action={c.role === 'created' ? 'none' : 'leave'}
      stats={{ members: c.members, upcoming: known.get(c.id)?.upcoming ?? null }}
      favorite={known.get(c.id)?.isFavorite}
    />
  );
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      {favorites.length ? (
        <View style={styles.groupTitle}>
          <Icon name="star" size={12} color={t.accent} fill={t.accent} />
          <Text variant="overline" tone="tertiary">
            Favourites
          </Text>
        </View>
      ) : null}
      <Cards card={card}>{favorites.map(row)}</Cards>
      {created.length ? (
        <Text variant="overline" tone="tertiary" style={{ marginTop: favorites.length ? space[3] : 0 }}>
          Created
        </Text>
      ) : null}
      <Cards card={card}>{created.map(row)}</Cards>
      {joined.length ? (
        <Text variant="overline" tone="tertiary" style={{ marginTop: created.length || favorites.length ? space[3] : 0 }}>
          Joined
        </Text>
      ) : null}
      <Cards card={card}>{joined.map(row)}</Cards>
    </View>
  );
}

/**
 * One community: tap to open it. Join answers only once the server has
 * recorded it; Leave asks once more, then the row goes when the server
 * confirms (the lists reload from the sync bus). The star pins it among
 * the favourites; the stats line shows its real counts, « — » when unknown.
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
  blurb,
  card,
  stats,
  favorite,
}: {
  index?: number;
  /** Wide: shown as a card this wide (cover, name, what it is about, facts, action). */
  card?: number;
  /** What it is about, on a card (a row has it in its line already when it shows it). */
  blurb?: string | null;
  id: string;
  name: string;
  topic: string | null;
  categoryId: string | null;
  emoji: string | null;
  isMember: boolean;
  meta: string;
  action: 'join' | 'leave' | 'none';
  stats: Stats;
  /** What the server said (null or undefined: it has not). */
  favorite: boolean | null | undefined;
}) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[useCityId()];
  // Never an id or a test code as the title, whichever list the row comes from.
  const name = displayCommunityName({ name: stored, topic, categoryId, cityId: city.id });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const join = () => {
    if (busy) return;
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
    if (busy) return;
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
  const star = <FavoriteStar id={id} name={name} known={favorite} />;
  const actions = (
    <>
      {action === 'join' && !isMember ? <Button label="Join" size="sm" loading={busy} onPress={join} /> : null}
      {action === 'join' && isMember ? (
        <Text variant="caption" tone="secondary">
          Joined
        </Text>
      ) : null}
      {action === 'leave' ? <Button label={confirm ? 'Leave?' : 'Leave'} size="sm" variant={confirm ? 'danger' : 'ghost'} loading={busy} onPress={leave} /> : null}
      {action === 'none' ? <Icon name="chevronRight" size={16} color={t.c.textTertiary} /> : null}
    </>
  );
  if (card) {
    return (
      <Animated.View entering={enter.rise(Math.min(index, 8))} layout={LinearTransition.springify().dampingRatio(0.9)} style={{ width: card }}>
        <PressableScale onPressIn={() => prefetchCommunity(id)} onPress={() => router.push(`/c/${id}`)} haptic="select" scaleTo={0.98} style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={name} testID={`community-${id}`}>
          <GlassLayer radius={radius.xl} />
          <CommunityThumb id={id} name={name} topic={topic} categoryId={categoryId} emoji={emoji} light={city.light} size="100%" height={128} member={isMember} />
          <View style={styles.cardBody}>
            <Text variant="titleS" numberOfLines={1} raw>
              {name}
            </Text>
            {blurb ? (
              <Text variant="bodyS" tone="secondary" numberOfLines={2}>
                {blurb}
              </Text>
            ) : null}
            {line ? (
              <Text variant="caption" tone="tertiary" numberOfLines={1}>
                {line}
              </Text>
            ) : null}
            <View style={styles.cardFoot}>
              <View style={styles.cardStats}>
                <CommunityStats members={stats.members} upcoming={stats.upcoming} />
              </View>
              {star}
              {actions}
            </View>
          </View>
        </PressableScale>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={enter.rise(Math.min(index, 8))} layout={LinearTransition.springify().dampingRatio(0.9)}>
      {/* testID: the row of this community, whatever its shown title (end-to-end tests). */}
      <PressableScale onPressIn={() => prefetchCommunity(id)} onPress={() => router.push(`/c/${id}`)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={name} testID={`community-${id}`}>
        <GlassLayer radius={radius.lg} />
        <CommunityThumb id={id} name={name} topic={topic} categoryId={categoryId} emoji={emoji} light={city.light} size={44} member={isMember} />
        <View style={styles.rowBody}>
          <Text variant="titleS" numberOfLines={1} raw>
            {name}
          </Text>
          {line ? (
            <Text variant="caption" tone="tertiary" numberOfLines={2}>
              {line}
            </Text>
          ) : null}
          <CommunityStats members={stats.members} upcoming={stats.upcoming} />
        </View>
        {star}
        {actions}
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
  sectionTitle: { marginBottom: space[3] },
  groupTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  card: { flex: 1, borderRadius: radius.xl },
  cardBody: { flex: 1, padding: 14, gap: 4 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 'auto', paddingTop: 8, minHeight: 40 },
  cardStats: { flex: 1, minWidth: 0 },
  controls: { gap: space[4], marginBottom: space[5] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  tabsWide: { flex: 1, minWidth: 0, maxWidth: 520 },
  createWide: { width: 240, marginLeft: 'auto' },
  empty: { alignItems: 'center', gap: 6, padding: 22, borderRadius: radius.xl, overflow: 'hidden' },
});
