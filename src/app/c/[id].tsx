import { useLocalSearchParams, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { AdminBadge } from '@/features/admin/StaffBadge';
import { useAccount, useAuthStatus } from '@/features/auth/account';
import { isDemoId } from '@/features/girl/demo';
import { DemoCommunityScreen } from '@/features/girl/DemoScreens';
import { t as tx, a11y } from '@/i18n';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageHeader } from '@/components/navigation/Headers';
import { ActionBar } from '@/components/social/ActionBar';
import { ProfileAvatar } from '@/components/ui/ProfileAvatar';
import { RichText } from '@/components/ui/RichText';
import { Button } from '@/components/ui/Button';
import { Chip, IconButton, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ACTIVITIES } from '@/data/catalog';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import type { LightId } from '@/theme/lights';
import { dateFor, planDay, type Day, type GeoIndex } from '@/features/ai/intent';
import { communityAssist, digestLines, postLooksLikeAPlan, type Assist, type PlanDraft } from '@/features/community/assist';
import { confirm } from '@/lib/confirm';
import { deleteCommunity, fetchDigest, joinCommunity, leaveCommunity, setCommunityMuted, useCommunity, type CommunityDetail, useCommunityActivities, useCommunityFeed, type CommunityPost, pinActivity, type ActivityStatus } from '@/features/community/data';
import { createServerActivity } from '@/features/server/activities';
import { setCommunityCover, useActivityThumbs, usePhotoLink } from '@/features/server/covers';
import { CoverEditor, coverEditorSlot } from '@/components/visual/CoverEditor';
import { isContentStaff, useStaffRole } from '@/features/admin/api';
import { communityPhoto, GUIDELINES } from '@/features/community/official';
import { CommunityEmpty, IntroCard, WelcomeCharter } from '@/features/community/Welcome';
import { Photo } from '@/components/visual/Photo';
import { openReport } from '@/features/moderation/reportStore';
import { shareNative, useEngagement } from '@/features/server/engage';
import { isManager, useCommunityHeader, useMyRights } from '@/features/community/governance';
import { CommunityFacts, MemberList } from '@/features/community/CommunityPageParts';
import { AboutSheet } from '@/features/community/AboutSheet';
import { Agenda, type AgendaItem } from '@/features/community/Agenda';
import { ChatInvite, ChatPane } from '@/features/community/ChatPane';
import { NewPostsPill, PublishButton } from '@/features/community/FeedOverlays';
import { MediaEmpty, MediaGrid, type GalleryItem } from '@/features/community/MediaGallery';
import { PinnedStrip } from '@/features/community/PinnedStrip';
import { SpaceTabs, TabPanel, TABS_HEIGHT, type SpaceTab } from '@/features/community/SpaceTabs';
import { PIN_FOR, pinPostFor, prefetchMedia, useCommunityMedia, useCommunityRules, type FeedSort, type PinFor } from '@/features/community/space';
import { prefetchMembers, warmPostImages } from '@/features/community/prefetch';
import { Sheet } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { track } from '@/lib/analytics';
import { hueOf } from '@/lib/format';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PostMedia } from '@/features/posts/PostMedia';
import { useChannels, useCommunityExtras } from '@/features/community/groups';
import { CommunityActivityFeed, ProposeActivity } from '@/features/community/CommunityActivitiesSlot';
import { HostTools, NotifyPrefs, ParentLink, SpaceChips, SubgroupList } from '@/features/community/GroupsUI';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, layout, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Ambient } from '@/components/visual/Ambient';
import { SpaceFlavor } from '@/theme/space';
import { enter } from '@/motion/enter';
import { useBusy } from '@/lib/useBusy';
import { ErrorScreen } from '@/components/layout/ErrorScreen';
import { ScreenColumn } from '@/components/layout/responsive';
import { communitySplit, useCommunitySplit } from '@/features/community/layout';

const when = (ms: number, cityId: string) => cityWhen(ms, cityId);
// Upcoming needs no label; the others say what they are.
const STATUS_LABEL: Partial<Record<ActivityStatus, string>> = { ongoing: 'Happening now', finished: 'Finished', cancelled: 'Cancelled' };

/** A crash here shows Try again and a way home, not a blank screen (components/layout/ErrorScreen). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} retry={retry} where="community" />;
}

/**
 * A community in five spaces: Posts (text, photos, polls, plans, pinned
 * first, Recent or Popular, paged), its Chat (in the page, for members),
 * Activities (an agenda by week or month), Media (every photo and video)
 * and Members. About (with the rules) and Search sit in the header. A free
 * assistant plans an activity for the group, drafts a poll, summarises the
 * week or suggests what to post. Join = you are in the chat too.
 */
// The demonstration build's IRLY Girl communities (example content, nothing saved).
export default function CommunityRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  // The page has the whole width from the two-column layout up; a readable column between a phone and that.
  const split = useCommunitySplit();
  return (
    <SpaceFlavor>
      <ScreenColumn wide={split}>{isDemoId(id) ? <DemoCommunityScreen id={id} /> : <CommunityScreen />}</ScreenColumn>
    </SpaceFlavor>
  );
}

function CommunityScreen() {
  const t = useTheme();
  const split = useCommunitySplit();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail: loaded, loading, error, refresh, signedIn } = useCommunity(id);
  // A join the server just accepted, with its chat: the page is a member's at once, while
  // its detail reloads (it showed « Join the community » again until then, as if refused).
  // Only over the detail read before the join: the next one from the server has the last word.
  const [joined, setJoined] = useState<{ over: CommunityDetail; chat: string | null } | null>(null);
  const c =
    loaded && joined?.over === loaded && !loaded.isMember
      ? { ...loaded, isMember: true, members: loaded.members + 1, myRole: loaded.myRole ?? 'member', conversationId: loaded.conversationId ?? joined.chat }
      : loaded;
  const contentStaff = isContentStaff(useStaffRole());
  const auth = useAuthStatus();
  // Posts by space: General, or one of the community's categories (when it has some).
  const { channels } = useChannels(id);
  const [postSpace, setPostSpace] = useState<string | null>(null);
  // Recent (pinned first, then newest) or Popular; pages load as the list nears its end.
  const [sort, setSort] = useState<FeedSort>('recent');
  const feed = useCommunityFeed(id, channels.length ? postSpace : undefined, { sort });
  const [past, setPast] = useState(false);
  const acts = useCommunityActivities(id, past);
  // Each activity's photo: its own, else the app's photo of its subject (the same as on its page).
  const actThumbs = useActivityThumbs(acts.activities.map((a) => a.id));
  const extras = useCommunityExtras(id);
  const eng = useEngagement('community_post', feed.posts.filter((p) => !p.pending).map((p) => p.id));
  // The five spaces; each keeps its state (scroll, search, agenda) while another shows.
  const [tab, setTab] = useState<SpaceTab>('posts');
  const [actView, setActView] = useState<'agenda' | 'list'>('agenda');
  // The gallery loads the first time Media opens, then stays.
  const [mediaOn, setMediaOn] = useState(false);
  if (tab === 'media' && !mediaOn) setMediaOn(true);
  const media = useCommunityMedia(id, mediaOn);
  const [about, setAbout] = useState(false);
  const { rules, loading: rulesLoading } = useCommunityRules(id);
  // A post a moderator pins: for how long (24 h, 7 days, no end).
  const [pinning, setPinning] = useState<CommunityPost | null>(null);
  // What I may do here (community_my_rights) and the header's real numbers (community_header).
  const { rights: my } = useMyRights(id);
  const { header } = useCommunityHeader(id);
  const [busy, setBusy] = useState(false);
  // Leave / Delete wait for the server: one at a time, a spinner meanwhile (a second tap asked again, then failed).
  const owner = useBusy<'leave' | 'delete'>();
  const reduced = useReducedMotion();
  // An assistant idea tapped goes into the post composer (n remounts it).
  const [idea, setIdea] = useState({ text: '', n: 0 });
  const list = useRef<FlatList<CommunityPost>>(null);
  // The cards' actions, the same functions on every render (the cards are memoized): each
  // call runs the handler of the latest render, kept below once the community is known.
  const handlers = useRef<PostActions | null>(null);
  const postActions = useMemo<PostActions>(
    () => ({
      pin: (p, on) => handlers.current?.pin(p, on),
      vote: (p, o) => handlers.current?.vote(p, o),
      remove: (p) => handlers.current?.remove(p),
      plan: (d) => handlers.current?.plan(d),
    }),
    [],
  );
  // Reading further down: posts new from others wait behind « New posts » instead of moving the list.
  const down = useRef(false);
  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const deep = e.nativeEvent.contentOffset.y > 700;
      if (deep === down.current) return;
      down.current = deep;
      feed.setHold(deep);
      if (!deep && feed.incoming.length) feed.showIncoming();
    },
    [feed],
  );

  const city = c ? (CITIES[c.cityId as CityId] ?? CITIES.dubai) : CITIES.dubai;
  const geo: GeoIndex = useMemo(() => ({ cities: [{ id: city.id, name: city.name }], areas: city.areas.map((a) => ({ id: a.id, name: a.name, cityId: city.id })) }), [city]);
  const agenda = useMemo<AgendaItem[]>(
    () => acts.activities.filter((a) => a.status !== 'cancelled').map((a) => ({ id: a.id, title: a.title, startsAt: a.startsAt, going: a.going, pinned: Boolean(a.pinnedAt), subtitle: a.groupName ? tx('in {name}', { name: tx(a.groupName) }) : a.status === 'ongoing' ? tx('Happening now') : null })),
    [acts.activities],
  );
  // The feed's files are signed in one request and its first photos fetched ahead; once
  // the page has settled, the gallery's first page and thumbnails too (Media opens filled).
  const uid = useAccount()?.userId;
  useEffect(() => warmPostImages(feed.posts), [feed.posts]);
  const settled = !feed.loading && Boolean(loaded);
  useEffect(() => {
    if (!settled || !uid || mediaOn) return;
    const timer = setTimeout(() => (prefetchMedia(uid, id), prefetchMembers(id)), 1200);
    return () => clearTimeout(timer);
  }, [settled, uid, id, mediaOn]);
  const gallery = useMemo<GalleryItem[]>(() => media.items.map((m) => ({ key: m.key, kind: m.kind, path: m.path, thumbPath: m.thumbPath, seconds: m.seconds, postId: m.postId })), [media.items]);

  /** A plan from the assistant or a post: a real activity of this community, in its Activities space. */
  const createPlan = async (d: PlanDraft): Promise<boolean> => {
    if (!c) return false;
    if (!c.isMember) {
      toast('Join the community first', 'users', 'brand');
      return false;
    }
    // A plan says where it happens: no neighbourhood is picked for the member.
    const area = d.areaId && city.areas.some((a) => a.id === d.areaId) ? d.areaId : null;
    if (!area) {
      toast('Choose a neighbourhood', 'pin', 'brand');
      return false;
    }
    const areaLabel = city.areas.find((a) => a.id === area)?.name ?? city.name;
    try {
      const actId = await createServerActivity(
        { cityId: city.id, categoryId: (d.category ?? c.categoryId ?? undefined) as never, activityId: d.activity, title: d.title, place: areaLabel, privacy: 'community', day: planDay(d.day), time: d.time, spots: 0, areaId: area, format: 'meetup', price: 0, currency: city.currency },
        dateFor(d.day, d.time, new Date(), city.utcOffset),
        { communityId: c.id, girlOnly: c.girlOnly },
      );
      // No id: nothing was created (the session ended). Never a success then: the draft stays.
      if (!actId) {
        toast(tx('Your session has ended. Sign in again'), 'x', 'live');
        return false;
      }
      haptic('success');
      track('ACTIVITY_CREATE', { via: 'community' });
      acts.refresh();
      // The activity is its own record, shown in Activities (no copy in the posts).
      toast(tx('{title} is live. Chat created', { title: d.title }), 'send', 'brand');
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create', 'x', 'live');
      return false;
    }
  };

  const pin = (p: CommunityPost, on: boolean, f: PinFor = 'none') =>
    pinPostFor(p.id, on, f)
      .then(() => (feed.refresh(), toast(on ? 'Pinned at the top' : 'Unpinned', 'pinPost', 'brand')))
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not pin', 'x', 'live'));
  // This render's handlers behind the cards' stable actions (`postActions`).
  useEffect(() => {
    handlers.current = {
      pin: (p, on) => (on ? setPinning(p) : void pin(p, false)),
      vote: (p, o) => void feed.vote(p, o).catch((e) => toast(e instanceof Error ? e.message : 'Could not vote', 'x', 'live')),
      remove: (p) =>
        void feed
          .remove(p)
          .then(() => toast('Post removed', 'check', 'brand'))
          .catch(() => toast('Could not remove', 'x', 'live')),
      plan: (d) => void createPlan({ ...d, title: `${d.title} · ${c?.name ?? ''}`.slice(0, 80) }),
    };
  });

  // The page frame (title, back) and a line of text right away: the stored
  // session read and then the community query can take seconds on a slow
  // start, and a bare spinner reads as a blank page.
  if (auth === 'unknown') return <Loading />;
  if (!signedIn) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          Sign in to see this community
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Centered>
    );
  }
  if (loading) return <Loading />;
  if (!c) {
    return (
      <Centered>
        <Text variant="titleM" align="center">
          {error ? 'Can’t reach IRLY right now' : 'This community is not available'}
        </Text>
        {error ? <Button label="Try again" onPress={refresh} /> : null}
        <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Centered>
    );
  }

  const join = async () => {
    // One join at a time (a second tap while the first is on its way does nothing).
    if (busy) return;
    setBusy(true);
    try {
      const chat = await joinCommunity(c.id);
      if (loaded) setJoined({ over: loaded, chat: chat || null });
      haptic('success');
      toast(c.official ? tx('Welcome to {name} 👋', { name: c.name }) : tx('You joined {name}', { name: c.name }), 'users', 'brand');
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  /** « + Propose an activity » by a visitor: joins first (true when she is in). */
  const joinFirst = async (): Promise<boolean> => {
    try {
      await joinCommunity(c.id);
      refresh();
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not join', 'x', 'live');
      return false;
    }
  };

  const canModerate = c.myRole === 'owner' || c.myRole === 'moderator' || extras.rights.canModerate || my.canModerate;
  const openComposer = (body = '') => router.push({ pathname: '/post/new', params: { community: c.id, name: c.name, body, ...(channels.length && postSpace !== null ? { category: postSpace } : {}) } });

  // Under the page header and the tabs: where each space's content starts.
  const headerH = insets.top + layout.headerHeight + 8;
  const top = headerH + TABS_HEIGHT;

  /* Who the community is: cover, name, facts, Join or the member's actions, the team's tools. */
  const hero = (
    <View style={{ gap: space[5] }}>
      <CommunityCover id={c.id} name={c.name} topic={c.topic ?? null} categoryId={c.categoryId} coverPath={c.coverPath} light={city.light} canEdit={c.myRole === 'owner' || c.myRole === 'moderator' || my.canSettings} staff={contentStaff} onChanged={refresh} />
      <View style={[styles.pad, { gap: 6 }]}>
        <ParentLink parent={extras.parent} />
        <Text variant="overline" tone="accent">
          {[c.official ? tx('IRLY Community') : null, city.name, c.girlOnly ? 'IRLY Girl' : null].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="displayM" raw={!c.official}>{c.name}</Text>
        {c.tagline ? (
          <Text variant="body" tone="secondary" raw={!c.official}>
            {c.tagline}
          </Text>
        ) : null}
        <CommunityFacts header={header} fallbackMembers={c.members} official={c.official} />
      </View>

      {/* Joining swaps Join for the chat: the new actions rise in. */}
      <Animated.View key={c.isMember ? 'member' : 'visitor'} entering={reduced ? undefined : enter.rise(0)} style={[styles.pad, styles.row]}>
        {c.isMember ? (
          <>
            <View style={{ flex: 1 }}>
              <Button label="Open chat" icon="message" full onPress={() => (c.conversationId ? setTab('chat') : join())} />
            </View>
            {c.myRole === 'owner' ? (
              c.official ? null : (
                <Button
                  label="Delete"
                  variant="danger"
                  loading={owner.busy === 'delete'}
                  disabled={owner.busy !== null}
                  onPress={() =>
                    owner.isRunning() ||
                    confirm('Delete this community? It disappears for everyone, and its chat leaves every inbox.', () =>
                      void owner.run('delete', () =>
                        deleteCommunity(c.id)
                          .then(() => {
                            toast('Community deleted', 'check', 'brand');
                            if (router.canGoBack()) router.back();
                            else router.replace('/communities');
                          })
                          .catch((e) => toast(e instanceof Error ? e.message : 'Could not delete', 'x', 'live')),
                      ),
                    )
                  }
                />
              )
            ) : (
              <Button
                label="Leave"
                variant="secondary"
                loading={owner.busy === 'leave'}
                disabled={owner.busy !== null}
                onPress={() =>
                  owner.isRunning() ||
                  confirm('Leave this community?', () =>
                    void owner.run('leave', () =>
                      leaveCommunity(c.id)
                        .then(() => {
                          setJoined(null);
                          toast('You left the community', 'check', 'brand');
                          refresh();
                        })
                        .catch((e) => toast(e instanceof Error ? e.message : 'Could not leave', 'x', 'live')),
                    ),
                  )
                }
              />
            )}
          </>
        ) : (
          <View style={{ flex: 1 }}>
            <Button label="Join the community" icon="users" full loading={busy} onPress={join} />
          </View>
        )}
        <IconButton icon="share" label={tx('Share')} onPress={() => void shareNative({ type: 'community', id: c.id, title: c.name }).catch(() => undefined)} />
      </Animated.View>

      {/* The team's tools: only for those whose rights allow something there. */}
      {isManager(my) ? (
        <View style={styles.pad}>
          <Button label="Manage the community" icon="settings" variant="secondary" full onPress={() => router.push(`/community/manage/${c.id}`)} />
        </View>
      ) : null}

      {c.isMember ? (
        <View style={[styles.pad, styles.row]}>
          <NotifyPrefs communityId={c.id} prefs={extras.prefs} onChanged={extras.reload} />
        </View>
      ) : null}
      <HostTools communityId={c.id} name={c.name} rights={extras.rights} isTop={!extras.parent} official={c.official} parentId={extras.parent?.id ?? null} onChanged={() => (extras.reload(), feed.refresh())} />
      {!extras.parent ? <SubgroupList groups={extras.groups} onChanged={() => (extras.reload(), refresh())} /> : null}

      {/* IRLY's own: the welcome, the introduction and the rules; a member's community: the introduction. */}
      {c.official ? (
        <OfficialBlock c={c} cityName={city.name} onMuted={refresh} />
      ) : c.isMember ? (
        <View style={styles.pad}>
          <IntroCard c={c} cityName={city.name} />
        </View>
      ) : null}
    </View>
  );

  /* Posts: the pinned strip, the activities coming up, the assistant, the composer, the sort. */
  const postsHeader = (
    <View style={{ gap: space[5], paddingBottom: space[5] }}>
      {split ? null : hero}
      <PinnedStrip posts={feed.posts} />
      <CommunityActivityFeed communityId={c.id} onSeeAll={() => setTab('activities')} />
      <Assistant communityId={c.id} name={c.name} categoryId={c.categoryId} geo={geo} isMember={c.isMember} onPlan={createPlan} onPoll={(question, options) => feed.post({ body: question, poll: options, category: channels.length ? postSpace : null })} onIdea={(text) => setIdea((x) => ({ text, n: x.n + 1 }))} />
      <SpaceChips channels={channels} value={postSpace} onChange={setPostSpace} canManage={canModerate} communityId={c.id} />
      {c.isMember ? <Composer key={idea.n} initial={idea.text} onPost={(body, poll) => feed.post({ body, poll, category: channels.length ? postSpace : null })} onMedia={(body) => openComposer(body)} /> : null}
      <View style={styles.pad}>
        <Segmented
          options={[
            { value: 'recent', label: tx('Recent') },
            { value: 'popular', label: tx('Most popular') },
          ]}
          value={sort}
          onChange={(s) => {
            setSort(s);
            list.current?.scrollToOffset({ offset: 0, animated: false });
          }}
        />
      </View>
    </View>
  );

  const posts = (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'web' ? undefined : 'padding'}>
      <FlatList
        ref={list}
        data={feed.posts}
        keyExtractor={postKeyOf}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: top + 12, paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={postsHeader}
        initialNumToRender={5}
        maxToRenderPerBatch={6}
        windowSize={9}
        onEndReached={() => void feed.loadMore()}
        onEndReachedThreshold={0.6}
        onScroll={onFeedScroll}
        scrollEventThrottle={100}
        renderItem={({ item: p }) => <PostCard cityId={city.id} p={p} eng={eng} canModerate={canModerate} isMember={c.isMember} geo={geo} actions={postActions} />}
        ListEmptyComponent={
          feed.loading ? (
            <PostSkeletons />
          ) : feed.error ? (
            <Text variant="body" tone="secondary" style={styles.pad}>
              Can’t reach IRLY right now. Check your connection.
            </Text>
          ) : (
            <View style={[styles.empty, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
              <GlassLayer radius={radius.xl} />
              <CommunityEmpty c={c} cityName={city.name} />
            </View>
          )
        }
        ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={t.c.textSecondary} style={{ marginBottom: 20 }} /> : null}
      />
    </KeyboardAvoidingView>
  );

  const activities = (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: top + 16, paddingBottom: insets.bottom + 60, gap: space[5] }}>
      {/* « + Propose an activity »: for every member (a visitor joins first, in one tap). */}
      <ProposeActivity c={c} join={joinFirst} />
      <View style={[styles.pad, styles.row, { flexWrap: 'wrap' }]}>
        <Chip size="sm" icon="calendar" label={tx('Agenda')} selected={actView === 'agenda'} onPress={() => (setActView('agenda'), setPast(false))} />
        <Chip size="sm" label={tx('Coming up')} selected={actView === 'list' && !past} onPress={() => (setActView('list'), setPast(false))} />
        <Chip size="sm" label={tx('Past')} selected={actView === 'list' && past} onPress={() => (setActView('list'), setPast(true))} />
      </View>
      {actView === 'agenda' ? (
        <Agenda items={agenda} cityId={city.id} loading={acts.loading} onOpen={(a) => router.push(`/a/${a}`)} />
      ) : (
        <View style={[styles.pad, { gap: 10 }]}>
          {acts.activities.length ? (
            acts.activities.map((a, i) => (
              <Animated.View key={`${past ? 'past' : 'next'}-${a.id}`} entering={reduced ? undefined : enter.rise(Math.min(i, 8))}>
                <PressableScale onPress={() => router.push(`/a/${a.id}`)} haptic="select" scaleTo={0.98} style={[styles.card, styles.row, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityLabel={a.title}>
                  <GlassLayer radius={radius.xl} />
                  {actThumbs[a.id] ? (
                    <Photo visual={{ photo: actThumbs[a.id].photo, uri: actThumbs[a.id].uri ?? undefined }} light={city.light} width={120} style={styles.actThumb} recyclingKey={`srv-${a.id}`} />
                  ) : (
                    <Icon name={a.pinnedAt ? 'pinPost' : 'calendar'} size={18} color={t.c.text} />
                  )}
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      {actThumbs[a.id] && a.pinnedAt ? <Icon name="pinPost" size={14} color={t.c.text} /> : null}
                      <Text variant="titleS" numberOfLines={1} raw style={{ flexShrink: 1 }}>
                        {a.title}
                      </Text>
                    </View>
                    <Text variant="caption" tone="tertiary" raw>
                      {[STATUS_LABEL[a.status] ? tx(STATUS_LABEL[a.status] as string) : null, when(a.startsAt, city.id), `${a.going} ${tx('going')}`, a.groupName ? tx('in {name}', { name: tx(a.groupName) }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {canModerate && a.status !== 'finished' && a.status !== 'cancelled' ? (
                    <Chip
                      size="sm"
                      icon="pinPost"
                      label={a.pinnedAt ? tx('Unpin') : tx('Pin')}
                      onPress={() =>
                        pinActivity(c.id, a.id, !a.pinnedAt)
                          .then(() => toast(a.pinnedAt ? 'Unpinned' : 'Pinned at the top', 'pinPost', 'brand'))
                          .catch((e) => toast(e instanceof Error ? e.message : 'Could not pin', 'x', 'live'))
                      }
                    />
                  ) : null}
                </PressableScale>
              </Animated.View>
            ))
          ) : acts.loading ? (
            <View style={{ gap: 10 }}>
              <Skeleton height={84} radius={radius.xl} />
              <Skeleton height={84} radius={radius.xl} />
            </View>
          ) : (
            <Text variant="body" tone="secondary">
              {acts.error ? 'Can’t reach IRLY right now' : past ? 'No past activities yet.' : 'Nothing planned yet. Ask the assistant: “organise padel Saturday 9am”.'}
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );

  const chat =
    c.isMember && c.conversationId ? (
      <ChatPane conversationId={c.conversationId} top={top} />
    ) : (
      <ChatInvite
        top={top}
        title={c.isMember ? 'The community chat' : 'Join to chat'}
        body={c.isMember ? 'Talk with the members in the community chat' : 'Members talk here every day. Join the community to read the chat and say hello.'}
        action={c.isMember ? 'Open chat' : 'Join the community'}
        busy={busy}
        onPress={join}
      />
    );

  const panels = (
    <View style={{ flex: 1 }}>
      <TabPanel active={tab === 'posts'}>{posts}</TabPanel>
      <TabPanel active={tab === 'chat'}>{chat}</TabPanel>
      <TabPanel active={tab === 'activities'}>{activities}</TabPanel>
      <TabPanel active={tab === 'media'}>
        <MediaGrid
          items={gallery}
          loading={media.loading}
          loadingMore={media.loadingMore}
          error={media.error}
          onEnd={media.more}
          topInset={top + 16}
          bottomInset={insets.bottom}
          onOpenPost={(postId) => router.push({ pathname: '/comments', params: { type: 'community_post', id: postId } })}
          empty={<MediaEmpty title="No photos yet" body="Photos and videos posted in the community show up here." />}
        />
      </TabPanel>
      <TabPanel active={tab === 'members'}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: top + 16, paddingBottom: insets.bottom + 60 }}>
          <MemberList communityId={c.id} />
        </ScrollView>
      </TabPanel>
      <View style={[styles.tabs, { top: headerH }]}>
        <SpaceTabs value={tab} onChange={setTab} />
      </View>
      {tab === 'posts' ? <NewPostsPill count={feed.incoming.length} top={top + 10} onPress={() => (list.current?.scrollToOffset({ offset: 0, animated: !reduced }), feed.showIncoming())} /> : null}
      {tab === 'posts' && c.isMember ? <PublishButton bottom={insets.bottom + 20} onPress={() => openComposer()} /> : null}
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      {/* Wide: who the community is and Join on the left, its five spaces on the right (same tree in every size). */}
      {split ? (
        <View style={[communitySplit.split, { flex: 1 }]}>
          <ScrollView style={[communitySplit.left, { alignSelf: 'stretch' }]} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: headerH + 12, paddingBottom: insets.bottom + 40 }}>
            {hero}
          </ScrollView>
          <View style={[communitySplit.right, { alignSelf: 'stretch' }]}>{panels}</View>
        </View>
      ) : (
        panels
      )}
      <PageHeader
        title={c.name}
        right={
          <View style={styles.row}>
            <IconButton icon="search" label={tx('Search in the community')} onPress={() => router.push({ pathname: '/community/search/[id]', params: { id: c.id, name: c.name } })} />
            <IconButton icon="book" label={tx('About')} onPress={() => setAbout(true)} />
          </View>
        }
      />
      <AboutSheet
        visible={about}
        onClose={() => setAbout(false)}
        name={c.name}
        about={c.description ?? c.tagline}
        aboutRaw={!c.official}
        rules={rules}
        rulesLoading={rulesLoading}
        guidelines={c.official ? GUIDELINES : undefined}
        facts={[
          { icon: 'users', text: c.members === 1 ? tx('1 member') : tx('{n} members', { n: header?.members ?? c.members }) },
          { icon: 'pin', text: city.name },
          ...(c.girlOnly ? [{ icon: 'shield' as const, text: tx('Women only: every member is checked by IRLY Girl.') }] : []),
          { icon: 'message', text: tx('Members post, plan activities and talk in the community chat.') },
        ]}
        onReport={() => (setAbout(false), openReport({ kind: 'community', id: c.id }))}
      />
      <Sheet visible={pinning !== null} onClose={() => setPinning(null)} title={tx('Pin this post')} subtitle={tx('It stays at the top of Posts until then.')}>
        <View style={{ gap: 10, paddingHorizontal: space.gutter + 4 }}>
          {PIN_FOR.map((f) => (
            <Button
              key={f.key}
              label={f.label}
              variant={f.key === 'none' ? 'primary' : 'secondary'}
              full
              onPress={() => {
                const p = pinning;
                setPinning(null);
                if (p) void pin(p, true, f.key);
              }}
            />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

/** Two post-shaped placeholders while the first page loads (same paddings as a post). */
function PostSkeletons() {
  return (
    <View style={{ gap: space[5] }}>
      {[0, 1].map((i) => (
        <View key={i} style={[styles.card, { marginHorizontal: space.gutter, overflow: 'hidden' }]}>
          <GlassLayer radius={radius.xl} />
          <View style={styles.row}>
            <Skeleton width={36} height={36} radius={18} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="40%" height={12} />
              <Skeleton width="25%" height={10} />
            </View>
          </View>
          <Skeleton height={14} />
          <Skeleton height={14} width="80%" />
          <Skeleton height={160} radius={radius.lg} />
        </View>
      ))}
    </View>
  );
}

/* ───────── Assistant ───────── */

function Assistant({
  communityId,
  name,
  categoryId,
  geo,
  isMember,
  onPlan,
  onPoll,
  onIdea,
}: {
  communityId: string;
  name: string;
  categoryId: string | null;
  geo: GeoIndex;
  isMember: boolean;
  onPlan: (d: PlanDraft) => Promise<boolean>;
  onPoll: (question: string, options: string[]) => Promise<void>;
  onIdea: (text: string) => void;
}) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState<Assist | null>(null);
  const [posting, setPosting] = useState(false);
  const [digest, setDigest] = useState<string[] | null>(null);
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = (input: string) => {
    const r = communityAssist(input, { communityName: name, categoryId, geo, activityLabel: (id) => { const l = ACTIVITIES[id as keyof typeof ACTIVITIES]?.label; return l ? tx(l) : undefined; }, tx });
    setResult(r);
    setDigest(null);
    setDraft(r.kind === 'plan' ? r.draft : null);
    track('AI_COMMAND', { scope: 'community', kind: r.kind });
    if (r.kind === 'digest') {
      fetchDigest(communityId)
        .then((d) => setDigest(digestLines(d, (ms) => when(ms, geo.cities[0]?.id ?? 'dubai'), tx)))
        .catch(() => setDigest(['Can’t reach IRLY right now.']));
    }
  };

  const chips = ['Organise padel Saturday 9am', 'Poll: Saturday or Sunday?', "What's new this week?", 'Post ideas'];

  return (
    <View style={[styles.assist, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.row}>
        <Icon name="sparkles" size={18} color={t.c.text} />
        <Text variant="titleS" style={{ flex: 1 }}>
          Community assistant
        </Text>
        <Text variant="caption" tone="tertiary">
          Free
        </Text>
      </View>
      <View style={[styles.inputWrap, { borderColor: t.c.line, backgroundColor: t.c.bg }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={tx('Ask: organise brunch Sunday 11am…')}
          placeholderTextColor={t.c.textTertiary}
          style={{ flex: 1, color: t.c.text, fontFamily: font.medium, fontSize: 15, paddingVertical: 0 }}
          onSubmitEditing={() => text.trim() && ask(text)}
          returnKeyType="go"
          accessibilityLabel={a11y('Ask the community assistant')}
        />
        <PressableScale onPress={() => text.trim() && ask(text)} haptic="select" hitSlop={8} accessibilityLabel="Ask">
          <Icon name="send" size={18} color={t.c.text} />
        </PressableScale>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {chips.map((q) => (
          <Chip key={q} size="sm" label={tx(q)} onPress={() => ask(tx(q))} />
        ))}
      </ScrollView>

      {result?.kind === 'plan' && draft ? (
        <Animated.View entering={FadeInDown.springify(380)} style={{ gap: 10 }}>
          <Text variant="titleS">{draft.title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {(['today', 'tomorrow', 'sat', 'sun', 'next_week'] as Day[]).map((d) => (
              <Chip key={d} size="sm" label={d === 'sat' ? tx('Saturday') : d === 'sun' ? tx('Sunday') : tx(planDay(d))} selected={(draft.day ?? 'today') === d} onPress={() => setDraft({ ...draft, day: d })} />
            ))}
          </ScrollView>
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {['08:00', '09:00', '11:00', '16:00', '18:00', '19:30'].map((h) => (
              <Chip key={h} size="sm" label={h} selected={draft.time === h} onPress={() => setDraft({ ...draft, time: h })} />
            ))}
          </ScrollView>
          {/* Where: a plan needs a neighbourhood and none is picked for the member (unless she named one). */}
          <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {geo.areas.map((a) => (
              <Chip key={a.id} size="sm" icon="pin" label={a.name} raw selected={draft.areaId === a.id} onPress={() => setDraft({ ...draft, areaId: draft.areaId === a.id ? undefined : a.id })} />
            ))}
          </ScrollView>
          <Button
            label={isMember ? 'Create it for the community' : 'Join to create it'}
            icon="plus"
            full
            loading={busy}
            disabled={!isMember || busy}
            onPress={async () => {
              if (busy) return;
              setBusy(true);
              const asked = result;
              const typed = text;
              let ok = false;
              try {
                ok = await onPlan(draft);
              } finally {
                setBusy(false);
              }
              if (!ok) return;
              // Clear only this plan: a question asked meanwhile keeps its answer.
              setResult((r) => (r === asked ? null : r));
              setText((x) => (x === typed ? '' : x));
            }}
          />
        </Animated.View>
      ) : null}

      {result?.kind === 'poll' ? (
        <View style={{ gap: 8 }}>
          <Text variant="titleS" raw>{result.question}</Text>
          <Text variant="bodyS" tone="secondary">
            {result.options.join(' · ')}
          </Text>
          <Button
            label={isMember ? 'Post this poll' : 'Join to post'}
            icon="send"
            full
            loading={posting}
            disabled={!isMember || posting}
            onPress={() => {
              if (posting) return;
              setPosting(true);
              const asked = result;
              const typed = text;
              onPoll(result.question, result.options)
                .then(() => {
                  setResult((r) => (r === asked ? null : r));
                  setText((x) => (x === typed ? '' : x));
                })
                .catch((e) => toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live'))
                .finally(() => setPosting(false));
            }}
          />
        </View>
      ) : null}

      {result?.kind === 'digest' ? (
        <View style={{ gap: 4 }}>
          {(digest ?? ['…']).map((l) => (
            <Text key={l} variant="bodyS">
              {l}
            </Text>
          ))}
        </View>
      ) : null}

      {result?.kind === 'ideas' ? (
        <View style={{ gap: 8 }}>
          {result.ideas.map((i) => (
            <PressableScale key={i} onPress={() => onIdea(tx(i))} haptic="select" style={[styles.idea, { borderColor: t.c.line }]} accessibilityLabel={i}>
              <Text variant="bodyS">{tx(i)}</Text>
            </PressableScale>
          ))}
          <Text variant="caption" tone="tertiary">
            Tap one, then post it below.
          </Text>
        </View>
      ) : null}

      {result?.kind === 'help' ? (
        <Text variant="bodyS" tone="secondary">
          Try: “organise padel Saturday 9am”, “poll: Saturday or Sunday?”, “what’s new this week?” or “post ideas”.
        </Text>
      ) : null}
    </View>
  );
}

/* ───────── Composer ───────── */

function Composer({ initial = '', onPost, onMedia }: { initial?: string; onPost: (body: string, poll: string[] | null) => Promise<void>; onMedia: (body: string) => void }) {
  const t = useTheme();
  const [body, setBody] = useState(initial);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await onPost(body, poll);
      haptic('success');
      setBody('');
      setPoll(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={[styles.pad, { gap: 8 }]}>
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={tx('Write to the community…')}
        placeholderTextColor={t.c.textTertiary}
        multiline
        maxLength={2000}
        style={[styles.composer, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
        accessibilityLabel={a11y('Write a post')}
      />
      {poll ? (
        <View style={{ gap: 6 }}>
          {poll.map((o, i) => (
            <TextInput
              key={i}
              value={o}
              onChangeText={(v) => setPoll(poll.map((x, j) => (j === i ? v.slice(0, 60) : x)))}
              placeholder={tx('Option {n}', { n: i + 1 })}
              placeholderTextColor={t.c.textTertiary}
              style={[styles.option, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }]}
              accessibilityLabel={tx('Poll option {n}', { n: i + 1 })}
            />
          ))}
          {poll.length < 6 ? <Chip size="sm" icon="plus" label={tx('Add option')} onPress={() => setPoll([...poll, ''])} /> : null}
        </View>
      ) : null}
      <View style={styles.row}>
        <Chip size="sm" icon="layers" label={poll ? tx('Remove poll') : tx('Add a poll')} selected={Boolean(poll)} onPress={() => setPoll(poll ? null : ['', ''])} />
        {!poll ? (
          <Chip
            size="sm"
            icon="camera"
            label={tx('Photos / video')}
            onPress={() => {
              onMedia(body);
              setBody('');
            }}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <Button label="Post" icon="send" size="sm" loading={busy} disabled={!body.trim()} onPress={send} />
      </View>
    </View>
  );
}

/* ───────── Post ───────── */

/** What a post card can do: the same functions on every render (see `handlers`). */
type PostActions = {
  pin: (p: CommunityPost, on: boolean) => void;
  vote: (p: CommunityPost, option: number) => void;
  remove: (p: CommunityPost) => void;
  plan: (d: PlanDraft) => void;
};
const postKeyOf = (p: CommunityPost) => p.id;

/**
 * One post of the feed. Memoized: a card renders again only when its post,
 * its engagement, the member's rights or the city change, not on every
 * render of the page (a scroll past « New posts », a tab, a sheet).
 */
const PostCard = memo(function PostCard({
  p,
  eng,
  canModerate,
  isMember,
  geo,
  actions,
  cityId,
}: {
  p: CommunityPost;
  eng: ReturnType<typeof useEngagement>;
  canModerate: boolean;
  isMember: boolean;
  /** The community city and its neighbourhoods: a plan needs one, and a post rarely names it. */
  geo: GeoIndex;
  actions: PostActions;
  cityId: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const total = p.pollCounts.reduce((n, x) => n + x, 0);
  const areas = geo.areas;
  // A post that reads like a plan offers « Make it an activity » (members only).
  const plan = useMemo(() => (!p.activityId && isMember ? postLooksLikeAPlan(p.body, geo, tx) : null), [p.activityId, p.body, isMember, geo]);
  const onVote = (o: number) => actions.vote(p, o);
  const onRemove = () => actions.remove(p);
  const onPlan = (d: PlanDraft) => actions.plan(d);
  const onPin = (on: boolean) => actions.pin(p, on);
  // "Make it an activity" from a post that names no neighbourhood: the member picks one (none preselected).
  const [where, setWhere] = useState<{ open: boolean; areaId?: string }>({ open: false });
  return (
    <Animated.View entering={FadeInDown.springify(360).dampingRatio(0.85)} style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden', marginHorizontal: space.gutter, marginBottom: space[5] }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.row}>
        <ProfileAvatar name={p.firstName} hue={hueOf(p.authorId)} size={36} userId={p.authorId} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="titleS" raw style={{ flexShrink: 1 }} numberOfLines={1}>{p.mine ? tx('You') : p.firstName}</Text>
            <AdminBadge userId={p.authorId} />
          </View>
          <Text variant="caption" tone="tertiary">
            {p.pending ? tx('Sending…') : timeAgo(Math.max(0, Math.round((now - p.createdAt) / 60000)))}
          </Text>
        </View>
        {canModerate && !p.pending ? (
          <PressableScale onPress={() => onPin(!p.pinnedAt)} haptic="select" hitSlop={8} accessibilityLabel={p.pinnedAt ? 'Unpin' : 'Pin at the top'}>
            <Icon name="pinPost" size={16} color={p.pinnedAt ? t.c.text : t.c.textTertiary} />
          </PressableScale>
        ) : null}
        {p.mine && !p.pending ? (
          <PressableScale onPress={() => router.push({ pathname: '/post/new', params: { edit: p.id } })} haptic="select" hitSlop={8} accessibilityLabel="Edit post">
            <Icon name="edit" size={16} color={t.c.textTertiary} />
          </PressableScale>
        ) : null}
        {p.mine || canModerate ? (
          <PressableScale onPress={onRemove} haptic="select" hitSlop={8} accessibilityLabel="Remove post">
            <Icon name="x" size={18} color={t.c.textTertiary} />
          </PressableScale>
        ) : (
          <PressableScale
            onPress={() => openReport({ kind: 'community_post', id: p.id, userId: p.authorId }, p.firstName)}
            haptic="select"
            hitSlop={8}
            accessibilityLabel="Report post"
          >
            <Icon name="flag" size={16} color={t.c.textTertiary} />
          </PressableScale>
        )}
      </View>
      {p.pinnedAt || (p.kind && p.kind !== 'post') ? (
        <View style={[styles.row, { gap: 6 }]}>
          {p.pinnedAt ? <Icon name="pinPost" size={13} color={t.c.textSecondary} /> : null}
          <Text variant="overline" tone="secondary">
            {[p.pinnedAt ? tx('Pinned') : null, p.kind === 'announcement' ? tx('Announcement') : p.kind === 'question' ? tx('Question') : p.kind === 'recommendation' ? tx('Recommendation') : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
      {p.body ? <RichText text={p.body} postId={p.pending ? null : p.id} /> : null}
      {p.mediaPaths?.length ? <PostMedia paths={p.mediaPaths} kind={p.mediaKind ?? null} thumb={p.thumbPath} seconds={p.mediaSeconds} /> : null}
      {p.edited ? (
        <Text variant="caption" tone="tertiary">
          {tx('Edited')}
        </Text>
      ) : null}

      {p.poll ? (
        <View style={{ gap: 6 }}>
          {p.poll.options.map((o, i) => {
            const n = p.pollCounts[i] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            const mine = p.myVote === i;
            return (
              <PressableScale key={o + i} onPress={() => isMember && onVote(i)} haptic="select" scaleTo={0.98} style={[styles.pollRow, { borderColor: mine ? t.c.text : t.c.line }]} accessibilityLabel={tx('Vote: {option}', { option: o })}>
                <View style={[StyleSheet.absoluteFill, { width: `${pct}%`, backgroundColor: t.c.overlay, borderRadius: radius.md }]} />
                <Text variant="label" style={{ flex: 1 }}>
                  {o}
                </Text>
                <Text variant="caption" tone="secondary">
                  {pct}%
                </Text>
              </PressableScale>
            );
          })}
          <Text variant="caption" tone="tertiary">
            {tx('{n} votes', { n: total })}
          </Text>
        </View>
      ) : null}

      {p.activityId ? (
        <PressableScale onPress={() => router.push(`/a/${p.activityId}`)} haptic="select" scaleTo={0.98} style={[styles.linked, { backgroundColor: t.c.bg }]} accessibilityLabel={p.activityTitle ? tx('Open {title}', { title: p.activityTitle }) : tx('Open the activity')}>
          <Icon name="calendar" size={18} color={t.c.text} />
          <View style={{ flex: 1 }}>
            <Text variant="titleS" numberOfLines={1}>
              {p.activityTitle ?? tx('Activity')}
            </Text>
            {p.activityStartsAt ? (
              <Text variant="caption" tone="tertiary">
                {when(p.activityStartsAt, cityId)}
              </Text>
            ) : null}
          </View>
          <Text variant="label">{tx('Join')}</Text>
        </PressableScale>
      ) : plan ? (
        <View style={{ gap: 8 }}>
          <Button
            label={tx('Make it an activity: {title}', { title: plan.title })}
            icon="calendar"
            size="sm"
            variant="secondary"
            onPress={() => (plan.areaId ? onPlan(plan) : setWhere((w) => ({ ...w, open: !w.open })))}
          />
          {!plan.areaId && where.open ? (
            <>
              <Text variant="caption" tone="secondary">
                Where? Choose a neighbourhood
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {areas.map((a) => (
                  <Chip key={a.id} size="sm" icon="pin" label={a.name} raw selected={where.areaId === a.id} onPress={() => setWhere({ open: true, areaId: where.areaId === a.id ? undefined : a.id })} />
                ))}
              </ScrollView>
              <Button label="Create the activity" icon="plus" size="sm" disabled={!where.areaId} onPress={() => onPlan({ ...plan, areaId: where.areaId })} />
            </>
          ) : null}
        </View>
      ) : null}

      {!p.pending ? <ActionBar target={{ type: 'community_post', id: p.id, title: p.body.slice(0, 60) }} eng={eng} /> : null}
    </Animated.View>
  );
});

function Centered({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.centered, { backgroundColor: t.c.bg }]}>
      <Ambient />
      {children}
    </View>
  );
}

function Loading() {
  const t = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Ambient />
      <View style={styles.centered} accessibilityLabel={tx('Loading')}>
        <ActivityIndicator color={t.c.text} />
        <Text variant="body" tone="secondary" align="center">
          Loading the community…
        </Text>
      </View>
      <PageHeader title="Community" />
    </View>
  );
}

/**
 * IRLY's own communities: who it is for and how it works (the welcome),
 * say hello first (strongly suggested for newcomers, asked once), the
 * house rules, and the member's controls (mute, report).
 */
function OfficialBlock({ c, cityName, onMuted }: { c: CommunityDetail; cityName: string; onMuted: () => void }) {
  const t = useTheme();
  const [rules, setRules] = useState(!c.isMember);
  // Mute flips what the page last read: a second tap before the answer sent the same flip again.
  const muting = useBusy<'mute'>();
  return (
    <View style={[styles.pad, { gap: 10 }]}>
      <WelcomeCharter c={c} />
      {c.isMember ? <IntroCard c={c} cityName={cityName} /> : null}
      <PressableScale haptic="select" onPress={() => setRules((x) => !x)} style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden' }]} accessibilityRole="button" accessibilityState={{ expanded: rules }} accessibilityLabel="Community guidelines">
        <GlassLayer radius={radius.xl} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="shield" size={16} color={t.c.text} />
          <Text variant="label" style={{ flex: 1 }}>
            Keep IRLY welcoming
          </Text>
          <Icon name={rules ? 'chevronUp' : 'chevronDown'} size={16} color={t.c.textTertiary} />
        </View>
        {rules
          ? GUIDELINES.map((g) => (
              <Text key={g} variant="bodyS" tone="secondary">
                {`· ${tx(g)}`}
              </Text>
            ))
          : null}
      </PressableScale>
      {c.isMember && c.conversationId ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={c.muted ? 'Unmute chat' : 'Mute chat'}
            icon={c.muted ? 'bell' : 'bellOff'}
            variant="ghost"
            loading={muting.busy === 'mute'}
            onPress={() =>
              void muting.run('mute', () =>
                setCommunityMuted(c.conversationId!, !c.muted)
                  .then(() => {
                    toast(c.muted ? 'Chat notifications on' : 'Chat muted', 'check', 'brand');
                    onMuted();
                  })
                  .catch(() => toast('Could not change it', 'x', 'live')),
              )
            }
          />
          <Button label="Report" icon="flag" variant="ghost" onPress={() => openReport({ kind: 'community', id: c.id })} />
        </View>
      ) : null}
    </View>
  );
}

/** The community's photo: its own, or the app's photo for its category. The owner and moderators can change it. */
function CommunityCover({ id, name, topic, categoryId, coverPath, light, canEdit, staff, onChanged }: { id: string; name: string; topic: string | null; categoryId: string | null; coverPath: string | null; light: LightId; canEdit: boolean; staff: boolean; onChanged: () => void }) {
  const uri = usePhotoLink(coverPath);
  const fallback = communityPhoto(topic, categoryId, name);
  return (
    <View style={styles.pad}>
      <Photo pinned visual={{ photo: fallback, uri: uri ?? undefined }} light={light} scrim="soft" style={styles.coverPhoto} width={1000} recyclingKey={`community-${id}-${coverPath ?? 'app'}`}>
        {canEdit || staff ? <CoverEditor style={coverEditorSlot} hasOwn={Boolean(coverPath)} staff={staff && !canEdit} save={(picked) => setCommunityCover(id, picked)} onChanged={onChanged} /> : null}
      </Photo>
    </View>
  );
}

const styles = StyleSheet.create({
  coverPhoto: { height: 190, borderRadius: radius.xl, overflow: 'hidden' },
  actThumb: { width: 52, height: 52, borderRadius: radius.md, overflow: 'hidden' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  root: { flex: 1 },
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: space.gutter },
  assist: { marginHorizontal: space.gutter, padding: 16, borderRadius: radius.xl, gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16 },
  idea: { padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  composer: { minHeight: 90, borderRadius: radius.lg, borderWidth: 1, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  option: { height: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 15 },
  card: { padding: 16, borderRadius: radius.xl, gap: 12 },
  pollRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  empty: { marginHorizontal: space.gutter, alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.xl },
  tabs: { position: 'absolute', left: 0, right: 0 },
});
