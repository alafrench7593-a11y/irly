import { AreaPicker } from '@/components/ui/AreaPicker';
import { t as tx, a11y } from '@/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { useFrame } from '@/components/layout/AppFrame';
import { Column, columnsFor, contentWidth, Masonry, WIDE_MIN } from '@/components/layout/wide';
import { InboxButtons } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { LiveRing } from '@/features/live/LiveStrip';
import { pickLiveMedia, prepareLiveMedia, type LiveMedia, type PreparedLive } from '@/features/live/liveMedia';
import { uuid } from '@/lib/uuid';
import { LiveVideo } from '@/features/live/LiveVideo';
import { LivePhoto } from '@/features/live/LivePhoto';
import { useAccount } from '@/features/auth/account';
import { bumpIrl, deleteServerIrl, editServerIrl, postServerIrl, settleLive, useFriends, useServerIrl, type ServerIrlPost } from '@/features/server/social';
import { outcomeOf, type LivePhase } from '@/features/live/livePublish';
import { createPost, MAX_PHOTOS, pickPhotos, removePost, useDrafts, type DraftMedia } from '@/features/posts/posts';
import { PostCard, PostCardSkeleton, type PostOption } from '@/features/posts/PostCard';
import { PostMedia } from '@/features/posts/PostMedia';
import { createActivityFromPost, useActivityFromPost } from '@/features/posts/activityFromPost';
import { useMyCommunities } from '@/features/community/data';
import { setFollow } from '@/features/profile/member';
import { belongsToSpace } from '@/features/universe/universe';
import { Image } from 'expo-image';
import { openReport } from '@/features/moderation/reportStore';
import { hideItem, useEngagement } from '@/features/server/engage';
import { track } from '@/lib/analytics';
import type { CityId } from '@/data/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, LiveDot } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet, SheetScrollView } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { TapPhoto } from '@/features/photo/TapPhoto';
import { startArea } from '@/data/areas';
import { areaName, CITIES, placeLabel } from '@/data/destinations';
import { ScopeToggle } from '@/components/ui/ScopeToggle';
import { useCityFilter } from '@/features/server/scope';
import { findPerson } from '@/data/repo';
import { LIVE_TTL_MIN, useLives, useLiveStore, type Live } from '@/features/live/liveStore';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { spring } from '@/motion/tokens';
import { useAppSpace } from '@/state/appSpace';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';

/**
 * IRL: what people around you are doing right now. Photo or text, tied to
 * a venue, a neighbourhood or only the city (never an address), gone after 24 hours. Every
 * post is an invitation: message the person or go there.
 */
/** Narrowest a post card gets in the wide feed's columns (its actions still fit on one row). */
const POST_MIN = 300;

/** The time now, read in handlers (taps, answers), never while rendering. */
const clock = () => Date.now();

// Who sees a moment, as stored (a private one is not "Everyone").
const VISIBILITY_LABEL: Record<string, string> = { everyone: 'Everyone', friends: 'Mutual follows', close_friends: 'Close friends', community: 'Communities', private: 'Only me' };

export default function LiveScreen() {
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const router = useRouter();
  const [manual, setManual] = useState<false | 'now' | 'post'>(false);
  // Opened from Create (Post, Live): the composer is already up.
  const composer = Boolean(manual) || Boolean(compose);
  const mode = compose === 'photo' || manual === 'post' ? 'post' : 'now';
  const setComposer = (on: false | 'now' | 'post') => {
    setManual(on);
    if (!on && compose) router.setParams({ compose: undefined });
  };
  const bottom = useTabBarSpace();
  const connections = useStore((s) => s.connections);
  // Friends first: people you are connected with, then everyone around you.
  const sorted = [...lives].sort((a, b) => Number(connections[b.authorId] === 'connected') - Number(connections[a.authorId] === 'connected'));
  // Wide (components/layout/wide): the feed in columns, going live and who is out in a panel beside it.
  const frame = useFrame();
  const wide = frame.width >= WIDE_MIN;
  const contentW = contentWidth(frame.width);
  const sideW = wide ? Math.min(380, Math.max(320, Math.round(contentW * 0.32))) : 0;
  const feedW = contentW - sideW;
  const columns = wide ? columnsFor(feedW, POST_MIN, 14, 2) : 1;
  const goLive = <GoLiveCard onText={() => setComposer('now')} onPhoto={() => setComposer('post')} />;
  return (
    <Page
      back={false}
      overline={tx('{city} · right now', { city: city.name })}
      title="IRL"
      subtitle={tx('What people around you are doing. Posts disappear after {h} hours.', { h: LIVE_TTL_MIN / 60 })}
      right={<InboxButtons />}
      bottomInset={bottom + 24}
      overlay={<Composer visible={composer} mode={mode} onClose={() => setComposer(false)} />}
      contentStyle={{ width: contentW, alignSelf: 'center' }}
    >
      <View style={wide ? styles.split : null}>
        <View style={wide ? styles.feed : null}>
          {wide ? null : (
            <>
              <View style={{ marginBottom: space[6] }}>{goLive}</View>
              <View style={{ marginBottom: space[6] }}>
                <FriendsLiveNow />
              </View>
            </>
          )}
          <ServerFeed cityId={cityId} columns={columns} />
          <View style={styles.list}>
            <Masonry columns={columns}>
              {sorted.map((l, i) => (
                <Animated.View key={l.id} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
                  <LiveCard live={l} />
                </Animated.View>
              ))}
            </Masonry>
          </View>
        </View>
        {wide ? (
          <Column width={sideW} style={styles.panel}>
            {goLive}
            <FriendsLiveNow stacked />
          </Column>
        ) : null}
      </View>
    </Page>
  );
}

function LiveCard({ live }: { live: Live }) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[live.cityId];
  const me = useStore((s) => s.profile.name) || tx('You');
  const person = live.authorId === 'me' ? undefined : findPerson(live.authorId);
  const name = person?.name ?? me;
  const now = useNow();
  const minutes = Math.max(1, Math.round((now - live.postedAt) / 60_000));
  const hasPhoto = Boolean(live.photo || live.photoUri);
  // A Live posted here names only its neighbourhood: said once, not « Dubai Marina · Dubai Marina ».
  const area = areaName(city, live.areaId);
  // One string, so the place goes through the dictionary itself (« the beach » → « la plage »).
  const where = live.place && live.place !== area ? `${tx(live.place)} · ${area}` : area;
  return (
    <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden', boxShadow: t.shadow.card }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.head}>
        <Avatar name={name} hue={person?.hue ?? 0} size={40} online={person?.online} photo={person?.photo} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS">{name}</Text>
          <View style={styles.meta}>
            <LiveDot size={6} color={t.c.live} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {where} · {timeAgo(minutes)}
            </Text>
          </View>
        </View>
      </View>
      {hasPhoto ? (
        live.photoUri ? (
          <LivePhoto url={live.photoUri} style={styles.media} />
        ) : (
          <TapPhoto photo={{ visual: { photo: live.photo! }, light: city.light }} style={styles.photo}>
            <Photo visual={{ photo: live.photo! }} light={city.light} style={StyleSheet.absoluteFill} width={800} recyclingKey={live.id} />
          </TapPhoto>
        )
      ) : null}
      <Text variant={hasPhoto ? 'body' : 'titleM'} raw={live.authorId === 'me'}>{live.text}</Text>
      {person ? (
        <View style={styles.actions}>
          <ReactButton id={live.id} />
          <Button label="Message" variant="secondary" icon="message" size="sm" onPress={() => router.push('/messages')} />
          <Button label="Join" icon="pin" size="sm" onPress={() => toast(tx("{name} will know you're on your way", { name: person.name.split(' ')[0] }), 'pin')} />
          <PressableScale haptic="select" scaleTo={0.9} onPress={() => router.push(`/person/${person.id}`)} accessibilityLabel={tx('Open {name}’s profile', { name: person.name })} style={[styles.round, { backgroundColor: t.c.overlay }]}>
            <Icon name="user" size={16} color={t.c.text} />
          </PressableScale>
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          Your post · visible to people nearby
        </Text>
      )}
    </View>
  );
}

/**
 * « Write something… » and « Publish »: the door to publishing, at the top
 * of the feed, so it never floats over the Match IRLY button. The whole card
 * opens the composer; the camera opens it photo first.
 */
function GoLiveCard({ onText, onPhoto }: { onText: () => void; onPhoto: () => void }) {
  const t = useTheme();
  const name = useStore((s) => s.profile.name) || tx('You');
  const photo = useStore((s) => s.profile.photoUri);
  return (
    <View style={[styles.goLive, { marginHorizontal: space.gutter, backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent', boxShadow: t.shadow.card }]}>
      <GlassLayer radius={radius.xl} />
      <PressableScale haptic="select" scaleTo={0.98} onPress={onText} style={styles.goLiveMain} accessibilityRole="button" accessibilityLabel={tx('Publish: write something')}>
        <Avatar name={name} hue={262} size={44} photo={photo} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.meta}>
            <LiveDot size={6} />
            <Text variant="overline" tone="live">
              Go live
            </Text>
          </View>
          <Text variant="body" tone="secondary" numberOfLines={1}>
            Write something…
          </Text>
        </View>
      </PressableScale>
      <PressableScale haptic="select" scaleTo={0.9} onPress={onPhoto} accessibilityLabel="Post a photo" style={[styles.goLiveBtn, { backgroundColor: t.c.overlay }]}>
        <Icon name="camera" size={18} color={t.c.text} />
      </PressableScale>
      <PressableScale haptic="select" scaleTo={0.94} onPress={onText} accessibilityRole="button" accessibilityLabel={tx('Publish')} style={[styles.publish, { backgroundColor: t.c.brand }]} testID="live-publish">
        <Icon name="send" size={15} color={t.c.onBrand} />
        <Text variant="label" color={t.c.onBrand}>
          Publish
        </Text>
      </PressableScale>
    </View>
  );
}

/** One tap to react: the heart pops on `spring.strong`. */
function ReactButton({ id }: { id: string }) {
  const t = useTheme();
  const [on, setOn] = useState(false);
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <PressableScale
      haptic={false}
      scaleTo={0.9}
      onPress={() => {
        setOn(!on);
        haptic(on ? 'tap' : 'success');
        pop.set(withSequence(withTiming(1.35, { duration: 110 }), withSpring(1, spring.strong)));
      }}
      accessibilityLabel={on ? 'Remove reaction' : 'React'}
      accessibilityState={{ selected: on }}
      style={[styles.round, { backgroundColor: on ? `${t.c.live}1A` : t.c.overlay }]}
      testID={`react-${id}`}
    >
      <Animated.View style={style}>
        <Icon name="heart" size={16} color={on ? t.c.live : t.c.text} fill={on ? t.c.live : 'none'} />
      </Animated.View>
    </PressableScale>
  );
}

/**
 * Friends live now: who you know is out, what they're doing and where
 * (a neighbourhood, never an address). Falls back to people around you
 * until you have connections.
 */
function FriendsLiveNow({ stacked = false }: { stacked?: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const connections = useStore((s) => s.connections);
  const others = lives.filter((l) => l.authorId !== 'me');
  const friends = others.filter((l) => connections[l.authorId] === 'connected');
  const list = (friends.length ? friends : others).slice(0, 8);
  const items = list.map((l, i) => {
    const p = findPerson(l.authorId);
    if (!p) return null;
    return (
      <Animated.View key={l.id} entering={enter.pop(i, 60)}>
        <PressableScale
          haptic="select"
          scaleTo={0.96}
          onPress={() => router.push(`/person/${p.id}`)}
          style={[styles.friend, { backgroundColor: 'transparent', overflow: 'hidden', boxShadow: t.shadow.card }]}
          accessibilityLabel={tx('{name}, live: {text}, {area}', { name: p.name, text: l.text, area: areaName(city, l.areaId) })}
        >
          <GlassLayer radius={radius.xl} />
          <LiveRing size={48}>
            <Avatar name={p.name} hue={p.hue} size={38} photo={p.photo} />
          </LiveRing>
          <View style={stacked ? styles.friendTextWide : styles.friendText}>
            <Text variant="label" numberOfLines={1}>
              {p.name.split(' ')[0]}
            </Text>
            <View style={styles.meta}>
              <LiveDot size={6} color={t.c.positive} />
              <Text variant="caption" numberOfLines={1}>
                {tx(l.text).split(/[,.?!]/)[0]}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              {areaName(city, l.areaId)}
            </Text>
          </View>
        </PressableScale>
      </Animated.View>
    );
  });
  if (!list.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
        {friends.length ? 'Friends live now' : 'Live around you'}
      </Text>
      {/* Wide, in the side panel: one under the other instead of a rail. */}
      {stacked ? (
        <View style={styles.stack}>{items}</View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
          {items}
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Signed in: what members are posting right now, live. Friends' posts
 * first; add someone as a friend from their post. The feed mixes the space's
 * Lives and the community posts published to the Live: one record each (a
 * community post here IS the community's: same likes, comments, removal).
 */
function ServerFeed({ cityId, columns = 1 }: { cityId: CityId; columns?: number }) {
  const { narrow } = useCityFilter(cityId);
  const { posts, refresh: reloadFeed, loaded } = useServerIrl(cityId);
  const { friends, refresh } = useFriends();
  const girlSpace = useAppSpace() === 'girl';
  const myCommunities = useMyCommunities(cityId);
  const memberOf = useMemo(() => new Set(myCommunities.map((c) => c.id)), [myCommunities]);
  const irlIds = useMemo(() => posts.filter((p) => p.source !== 'community').map((p) => p.id), [posts]);
  const communityIds = useMemo(() => posts.filter((p) => p.source === 'community').map((p) => p.id), [posts]);
  const engIrl = useEngagement('irl_post', irlIds);
  const engCommunity = useEngagement('community_post', communityIds);
  const signedIn = Boolean(useAccount());
  // Hidden or being removed: gone from the list at once.
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const drop = useCallback(
    (id: string, on: boolean) =>
      setGone((g) => {
        const next = new Set(g);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    [],
  );
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const visible = posts.filter((p) => !gone.has(p.id));
  if (signedIn && !loaded) {
    return (
      <View style={[styles.list, { marginBottom: space[6] }]} accessibilityLabel={tx('Loading')}>
        <PostCardSkeleton />
        <PostCardSkeleton media={false} />
      </View>
    );
  }
  if (!visible.length && !narrow) return null;
  const sorted = [...visible].sort((a, b) => Number(b.friend) - Number(a.friend) || b.createdAt - a.createdAt);
  return (
    <View style={[styles.list, { marginBottom: space[6] }]}>
      <Text variant="overline" tone="secondary">
        On IRLY right now
      </Text>
      <ScopeToggle cityId={cityId} inset={false} />
      {!sorted.length ? (
        <Text variant="bodyS" tone="secondary">
          {tx('Nobody is live in {city} right now.', { city: CITIES[cityId].name })}
        </Text>
      ) : null}
      <Masonry columns={columns}>
        {sorted.map((p, i) => {
          const f = friends.find((x) => x.userId === p.authorId);
          const status = p.mine ? 'mine' : p.friend ? 'friend' : p.asIrly ? 'irly' : f?.status === 'pending' ? (f.incoming ? 'incoming' : 'sent') : 'none';
          return (
            <LiveFeedCard
              key={p.id}
              p={p}
              index={i}
              cityId={cityId}
              status={status}
              eng={p.source === 'community' ? engCommunity : engIrl}
              member={Boolean(p.community && memberOf.has(p.community.id))}
              girlSpace={girlSpace}
              onHide={drop}
              onEdit={setEditing}
              onRetry={reloadFeed}
              onFriend={refresh}
            />
          );
        })}
      </Masonry>
      <EditLive value={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

type FeedEng = ReturnType<typeof useEngagement>;

/** One post of the Live: a Live (irl_posts) or a community post published to the Live. */
const LiveFeedCard = memo(function LiveFeedCard({
  p,
  index,
  cityId,
  status,
  eng,
  member,
  girlSpace,
  onHide,
  onEdit,
  onRetry,
  onFriend,
}: {
  p: ServerIrlPost;
  index: number;
  cityId: CityId;
  status: 'mine' | 'friend' | 'irly' | 'incoming' | 'sent' | 'none';
  eng: FeedEng;
  /** A community post: the member belongs to its community (she can create an activity there). */
  member: boolean;
  girlSpace: boolean;
  onHide: (id: string, on: boolean) => void;
  onEdit: (v: { id: string; body: string }) => void;
  onRetry: () => void;
  onFriend: () => void;
}) {
  const router = useRouter();
  const fromCommunity = p.source === 'community';
  const type = fromCommunity ? ('community_post' as const) : ('irl_post' as const);
  const fromPost = useActivityFromPost(p.id);
  const like = useCallback(() => {
    if (!eng.signedIn) {
      toast('Sign in to interact', 'user', 'brand');
      return;
    }
    // A double tap only ever likes, even before the like state has loaded.
    eng.like(p.id, true).catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'));
  }, [eng, p.id]);
  const remove = useCallback(() => {
    onHide(p.id, true);
    (fromCommunity ? removePost(p.id).then(bumpIrl) : deleteServerIrl(p.id)).catch((e) => {
      onHide(p.id, false);
      toast(e instanceof Error ? e.message : 'Could not remove', 'x', 'live');
    });
  }, [fromCommunity, onHide, p.id]);
  const hide = useCallback(() => {
    onHide(p.id, true);
    hideItem({ type, id: p.id })
      .then(() => toast('Hidden from your feed', 'eye', 'brand'))
      .catch(() => {
        onHide(p.id, false);
        toast('Could not hide this post', 'x', 'live');
      });
  }, [onHide, p.id, type]);
  const options = useMemo<PostOption[]>(() => {
    const o: PostOption[] = [];
    // An activity from the post: in its community (members), or, for a Live, on its own in this space.
    if (!p.activityId && !fromPost && (fromCommunity ? member : true))
      o.push({
        key: 'activity',
        label: 'Create an activity',
        icon: 'calendar',
        onPress: () => createActivityFromPost({ id: p.id, body: p.body, community: p.community ? { id: p.community.id, name: p.community.name, cityId: p.cityId, girlOnly: girlSpace } : null, girlSpace }),
      });
    if (status === 'mine') {
      o.push(
        fromCommunity
          ? { key: 'edit', label: 'Edit post', icon: 'edit', onPress: () => router.push({ pathname: '/post/new', params: { edit: p.id } }) }
          : { key: 'edit', label: 'Edit', icon: 'edit', onPress: () => onEdit({ id: p.id, body: p.body }) },
      );
      o.push({ key: 'remove', label: 'Remove', icon: 'x', destructive: true, onPress: remove });
    } else {
      o.push({ key: 'hide', label: 'Hide this post', icon: 'eye', onPress: hide });
      o.push({ key: 'report', label: 'Report this post', icon: 'flag', onPress: () => openReport({ kind: type, id: p.id, userId: p.authorId }) });
    }
    return o;
  }, [p, fromPost, fromCommunity, member, girlSpace, status, router, onEdit, remove, hide, type]);
  const meta = fromCommunity
    ? status === 'friend' ? tx('Friend') : null
    : [placeLabel(cityId, p.cityId, p.areaId, p.placeName), tx(VISIBILITY_LABEL[p.visibility as string] ?? 'Everyone'), status === 'friend' ? tx('Friend') : null].filter(Boolean).join(' · ');
  // The frame follows the media's own shape; one broken media shows its own retry, never breaks the feed.
  const media = fromCommunity ? (
    p.mediaPaths?.length ? <PostMedia paths={p.mediaPaths} kind={p.mediaKind ?? null} liked={eng.get(p.id).liked} onLike={like} /> : null
  ) : p.mediaKind === 'video' && p.mediaUrl ? (
    <LiveVideo fit url={p.mediaUrl} poster={p.posterUrl} seconds={p.seconds} ratio={p.mediaRatio} onRetry={onRetry} style={styles.media} />
  ) : p.mediaKind ? (
    <LivePhoto url={p.mediaUrl} kind={p.mediaKind} ratio={p.mediaRatio} onRetry={onRetry} style={styles.media} liked={eng.get(p.id).liked} onLike={like} />
  ) : null;
  const link = p.activityId
    ? { id: p.activityId, title: p.activityTitle ?? tx('Activity'), cta: tx('Join') }
    : fromPost
      ? { id: fromPost.id, title: fromPost.title, cta: tx('Open') }
      : null;
  return (
    <PostCard
      index={index}
      author={{ id: p.authorId, name: p.firstName, mine: p.mine, asIrly: p.asIrly }}
      createdAt={p.createdAt}
      community={p.community ?? null}
      meta={meta}
      live
      body={p.body}
      richId={fromCommunity ? p.id : null}
      bigText={!fromCommunity}
      media={media}
      link={link}
      target={{ type, id: p.id, title: p.body.slice(0, 60) }}
      eng={eng}
      options={options}
      footer={status === 'none' || status === 'incoming' || status === 'sent' ? <FollowButton name={p.firstName} authorId={p.authorId} onDone={onFriend} /> : null}
    />
  );
});

/** Corrects the text of my Live (photo, video and place stay). */
function EditLive({ value, onClose }: { value: { id: string; body: string } | null; onClose: () => void }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [for_, setFor] = useState<string | null>(null);
  if (value && for_ !== value.id) {
    setFor(value.id);
    setText(value.body);
  }
  const save = async () => {
    if (!value || busy) return;
    setBusy(true);
    try {
      await editServerIrl(value.id, text);
      haptic('success');
      toast('Live updated', 'check', 'brand');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible={Boolean(value)}
      onClose={() => {
        setFor(null);
        onClose();
      }}
      title="Edit your Live"
    >
      <View style={{ paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[2] }}>
        <TextInput value={text} onChangeText={setText} multiline maxLength={160} autoFocus style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]} accessibilityLabel={a11y('Your Live')} />
        <Button label="Save" icon="check" full loading={busy} disabled={!text.trim()} onPress={save} />
      </View>
    </Sheet>
  );
}

/**
 * Follow → (sending) → You follow. Friends are members who follow each other
 * (no friend request any more): following back makes two members friends.
 * The button only changes once the server has answered: a failure leaves it
 * as it was, and a double tap never sends twice.
 */
function FollowButton({ name, authorId, onDone }: { name: string; authorId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Button
      label={done ? 'You follow' : 'Follow'}
      size="sm"
      variant={done ? 'secondary' : 'primary'}
      icon={done ? 'check' : 'plus'}
      disabled={done}
      loading={busy}
      onPress={() => {
        if (busy || done) return;
        setBusy(true);
        setFollow(authorId, true)
          .then(() => {
            haptic('success');
            setDone(true);
            toast(tx('You follow {name}', { name }), 'user', 'brand');
            onDone();
          })
          .catch((e) => toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live'))
          .finally(() => setBusy(false));
      }}
    />
  );
}

/**
 * « Write something… »: the Live's composer. Words, photos or a video, and
 * optionally one of her communities of this universe: then it is published
 * as that community's post AND shown in this Live for 24 hours (one record,
 * community_posts.in_live). Without a community it is a Live (its area, who
 * sees it, « anyone can join »).
 */
function Composer({ visible, mode = 'now', onClose }: { visible: boolean; mode?: 'post' | 'now'; onClose: () => void }) {
  const t = useTheme();
  const cityId = useCityId();
  // The space this Live is posted in: it shows only in that space's Live.
  const space_ = useAppSpace();
  const scope = space_ === 'girl' ? 'irly_girl' : 'irly';
  const city = CITIES[cityId];
  const post = useLiveStore((s) => s.post);
  const liveDraft = useDrafts((s) => s.byKey.live);
  const saveDraft = useDrafts((s) => s.save);
  const [text, setText] = useState(() => liveDraft?.body ?? '');
  // No neighbourhood is chosen for the member: they say where they are.
  const [picked, setArea] = useState<string | null>(null);
  // Switching destination keeps the composer mounted: never post a Dubai area in Bali.
  // The neighbourhood is optional: without one the Live shows the city (area_id = the city, as the server's precision rule does).
  const area = startArea(city, picked);
  const where = area ?? city.id;
  const [media, setMedia] = useState<LiveMedia | undefined>();
  // More photos after the first (a post in a community takes up to 10).
  const [extra, setExtra] = useState<string[]>([]);
  const uri = media?.uri;
  // Her communities of this universe only (Mixte app: Mixte and mixed Network; IRLY Girl: Girl, Mom, women-only Network).
  const mine = useMyCommunities(cityId);
  const communities = useMemo(() => mine.filter((c) => belongsToSpace({ girlOnly: c.girlOnly, topic: c.topic, categoryId: c.categoryId }, space_)), [mine, space_]);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const community = communities.find((c) => c.id === communityId) ?? null;
  const photos = media?.kind === 'photo' ? [media.uri, ...extra] : [];
  // The picked photo (or the video's poster) is prepared while the member writes: Post then only uploads.
  const [prep, setPrep] = useState<{ uri: string; data: PreparedLive } | null>(null);
  const ready = prep && prep.uri === uri ? prep.data : null;
  const [progress, setProgress] = useState<number | null>(null);
  // Untouched, the post follows the member's IRL visibility setting; the chips show it.
  const [chosen, setChosen] = useState<'friends' | 'everyone' | null>(null);
  const [setting, setSetting] = useState<'friends' | 'everyone' | 'private'>('friends');
  const visibility = chosen ?? (setting === 'private' ? null : setting);
  const [openUp, setOpenUp] = useState(false);
  // draft → publishing → published | failed (livePublish.ts). Closing the
  // composer while publishing hides it: the publish goes on and says how it ended.
  const [phase, setPhase] = useState<LivePhase>('draft');
  const busy = phase === 'publishing';
  const account = useAccount();
  // Answers can arrive after the screen is gone (sign-out, navigation): no state is set then.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const shown = useRef(visible);
  useEffect(() => {
    shown.current = visible;
  }, [visible]);
  useEffect(() => {
    if (!supabase || !account) return;
    let alive = true;
    supabase
      .from('safety_settings')
      .select('irl_visibility')
      .eq('user_id', account.userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setSetting(data.irl_visibility === 'everyone' ? 'everyone' : data.irl_visibility === 'nobody' ? 'private' : 'friends');
      });
    return () => {
      alive = false;
    };
  }, [account]);

  // The words written last time come back (the draft may load just after the screen).
  const restored = useRef(Boolean(liveDraft));
  useEffect(() => {
    if (restored.current || !liveDraft?.body) return;
    restored.current = true;
    setText((v) => v || liveDraft.body);
  }, [liveDraft]);

  // A double tap must never post twice: the ref flips before React re-renders.
  const sending = useRef(false);
  // The same post tried again keeps its id (and its activity's start): if the first
  // try was saved but its answer got lost, the retry gets it back instead of
  // publishing it twice. `unknown`: that try got no answer (it may have landed).
  const attempt = useRef<{ key: string; id: string; at: Date; unknown: boolean } | null>(null);

  /** Back to an empty composer after a Live is published. */
  const published = () => {
    saveDraft('live', null);
    attempt.current = null;
    if (!mounted.current) return;
    setText('');
    setMedia(undefined);
    setExtra([]);
    setCommunityId(null);
    setChosen(null);
    setOpenUp(false);
    setProgress(null);
    setPhase('draft');
  };

  /**
   * The member gives up on a try that got no answer (closed the composer,
   * discarded it): the server either has it (it stays: said so) or makes
   * sure it never lands (its files and activity go). Unreachable: settled at
   * the next start of the app, never guessed. A community post tried again
   * with its id is the same post (createPost): nothing to settle.
   */
  const giveUp = () => {
    const a = attempt.current;
    if (!a?.unknown || a.key.startsWith('community:')) return;
    attempt.current = null;
    if (mounted.current) setPhase('draft');
    settleLive(a.id)
      .then((r) => {
        if (r !== 'published') return;
        toast("You're live for 24 hours", 'zap', 'live');
        published();
      })
      .catch(() => undefined);
  };

  // Closing by a swipe or a tap outside keeps what was written as a draft;
  // the back arrow asks: keep the draft or discard it. While publishing, the
  // composer only hides: the Live goes on and says how it ended.
  const close = () => {
    if (!busy) {
      saveDraft('live', text.trim() ? { body: text, media: null, at: clock() } : null);
      giveUp();
    }
    onClose();
  };
  const askClose = () => {
    if (busy || (!text.trim() && !media)) return close();
    const discard = () => {
      saveDraft('live', null);
      giveUp();
      setText('');
      setMedia(undefined);
      setExtra([]);
      onClose();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(tx('Keep this post as a draft?'))) close();
      else discard();
      return;
    }
    Alert.alert(tx('Leave without posting?'), tx('You can keep it as a draft and finish it later.'), [
      { text: tx('Keep editing'), style: 'cancel' },
      { text: tx('Save draft'), onPress: close },
      { text: tx('Discard'), style: 'destructive', onPress: discard },
    ]);
  };

  const pick = async (kind: 'photo' | 'video' = 'photo') => {
    if (sending.current) return;
    try {
      // In a community: several photos at once (up to 10), added to those already picked.
      if (kind === 'photo' && community) {
        const room = MAX_PHOTOS - photos.length;
        if (room <= 0) return toast(tx('{n} photos at most', { n: MAX_PHOTOS }), 'image', 'brand');
        const files = (await pickPhotos(room)).map((f) => f.uri).filter((x): x is string => Boolean(x));
        if (!files.length || !mounted.current) return;
        if (media?.kind === 'photo') setExtra((x) => [...x, ...files].slice(0, MAX_PHOTOS - 1));
        else {
          setMedia({ kind: 'photo', uri: files[0] });
          setExtra(files.slice(1));
        }
        return;
      }
      const m = await pickLiveMedia(kind);
      if (!m || !mounted.current) return;
      setMedia(m);
      setExtra([]);
      prepareLiveMedia(m)
        .then((data) => mounted.current && setPrep({ uri: m.uri, data }))
        // A failure shows when posting (which tries again), not now.
        .catch(() => undefined);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open this file', 'x', 'live');
    }
  };

  const chooseCommunity = (id: string | null) => {
    if (busy) return;
    // A Live without a community keeps one photo: the others are let go, and she is told.
    if (!id && extra.length) {
      setExtra([]);
      toast('A Live without a community keeps one photo', 'image', 'brand');
    }
    setCommunityId(id);
  };

  const removePhoto = (u: string) => {
    if (busy) return;
    if (media?.uri === u) {
      const [next, ...rest] = extra;
      setMedia(next ? { kind: 'photo', uri: next } : undefined);
      setExtra(rest);
    } else setExtra((x) => x.filter((y) => y !== u));
  };

  /** Published in a community AND shown in this Live: one community post (in_live). */
  const submitToCommunity = async (c: { id: string; name: string }) => {
    sending.current = true;
    setPhase('publishing');
    const key = `community:${JSON.stringify([text.trim(), media?.uri ?? null, extra, c.id])}`;
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: uuid(), at: new Date(), unknown: false };
    const a = attempt.current;
    if (media) setProgress(0);
    const draft: DraftMedia | null = !media
      ? null
      : media.kind === 'video'
        ? { kind: 'video', files: [{ uri: media.uri, type: media.type }], poster: media.poster, seconds: media.seconds }
        : { kind: 'photo', files: photos.map((u) => ({ uri: u })) };
    try {
      await createPost({ id: a.id, communityId: c.id, body: text.trim(), media: draft, inLive: true, onProgress: media ? (p) => mounted.current && setProgress(p) : undefined });
      track('IRL_CREATE', { photo: media?.kind === 'photo', video: media?.kind === 'video', activity: false });
    } catch (e) {
      sending.current = false;
      // Tried again with the same id, it is the same post (never a second one).
      a.unknown = true;
      if (mounted.current) {
        setPhase('failed');
        setProgress(null);
      }
      toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
      return;
    }
    sending.current = false;
    bumpIrl();
    haptic('success');
    toast(tx('Posted in {name} and in the Live', { name: tx(c.name) }), 'zap', 'live');
    published();
    onClose();
  };

  const submit = async () => {
    if ((!text.trim() && !media) || sending.current) return;
    if (account && community) return submitToCommunity(community);
    if (!account) {
      post({ cityId, kind: media?.kind === 'photo' ? 'photo' : 'text', text: text.trim(), photoUri: media?.kind === 'photo' ? uri : undefined, place: areaName(city, where), areaId: where });
      haptic('success');
      toast("You're live for 24 hours", 'zap', 'live');
      published();
      onClose();
      return;
    }
    // Signed in: the post goes to the server, friends see it live.
    sending.current = true;
    setPhase('publishing');
    const key = JSON.stringify([text.trim(), media?.uri ?? null, area, chosen, openUp, cityId]);
    const prev = attempt.current;
    if (prev && prev.key !== key && prev.unknown && !prev.key.startsWith('community:')) {
      // Changed after a try without answer: that try is settled first, or it could land next to this one.
      const r = await settleLive(prev.id).catch(() => 'later' as const);
      if (r === 'later') {
        sending.current = false;
        if (mounted.current) setPhase('failed');
        toast('No connection: try again', 'x', 'live');
        return;
      }
      if (r === 'published') {
        sending.current = false;
        toast('Your earlier version is already live', 'zap', 'live');
        published();
        onClose();
        return;
      }
    }
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: uuid(), at: new Date(clock() + 30 * 60 * 1000), unknown: false };
    const a = attempt.current;
    if (media) setProgress(0);
    try {
      const time = `${String(a.at.getHours()).padStart(2, '0')}:${String(a.at.getMinutes()).padStart(2, '0')}`;
      // "Anyone can join" becomes a real activity the post points at, saved with the post
      // (one transaction): it never exists without its Live.
      const activity = openUp
        ? {
            plan: {
              cityId,
              title: text.trim().slice(0, 80).padEnd(3, '.'),
              place: areaName(city, where),
              areaId: where,
              day: 'Today',
              time,
              spots: 0,
              privacy: visibility === 'everyone' ? ('public' as const) : ('connections' as const),
              format: 'meetup' as const,
              currency: city.currency,
            },
            at: a.at,
          }
        : null;
      const res = await postServerIrl({
        id: a.id,
        prior: a.unknown,
        cityId,
        areaId: where,
        placeName: areaName(city, where),
        body: text.trim(),
        media,
        onProgress: media ? (p) => mounted.current && setProgress(p) : undefined,
        visibility: chosen ?? undefined,
        activity,
        scope,
      });
      track('IRL_CREATE', { photo: media?.kind === 'photo', video: media?.kind === 'video', activity: Boolean(res.activityId) });
      if (res.activityCreated) track('ACTIVITY_CREATE', { via: 'irl' });
    } catch (e) {
      sending.current = false;
      const unknown = outcomeOf(e) === 'unknown';
      // Refused: nothing of it exists, the next try is a new post. No answer: the same post is tried again.
      if (attempt.current === a) {
        if (unknown) a.unknown = true;
        else attempt.current = null;
      }
      const message = e instanceof Error ? e.message : 'Could not post';
      if (mounted.current) {
        setPhase('failed');
        setProgress(null);
      }
      if (!shown.current) {
        // Closed while it was sending: the member is not here to try again. The words stay as a draft.
        if (text.trim()) saveDraft('live', { body: text, media: null, at: clock() });
        giveUp();
        toast('Your Live was not posted. It is kept as a draft.', 'x', 'live');
        return;
      }
      // The text and the photo or video stay: the member taps Post live again.
      toast(message, 'x', 'live');
      return;
    }
    sending.current = false;
    haptic('success');
    toast("You're live for 24 hours", 'zap', 'live');
    published();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title="Publish" subtitle={community ? tx('In {name} and in the Live for 24 hours.', { name: tx(community.name) }) : 'Right now, around you. Only your area is shown, never your address.'}>
      {/* Scrolls when the keyboard is up, so the field and Publish stay reachable; it shares
          the drag with the sheet, which follows the finger only from the top of the content. */}
      <SheetScrollView
        style={{ flexShrink: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.gutter, gap: space[5], paddingBottom: space[2] }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <PressableScale haptic="select" onPress={askClose} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={a11y('Back')}>
          <Icon name="chevronLeft" size={18} color={t.c.text} />
          <Text variant="label">Back</Text>
        </PressableScale>
        {mode === 'post' && !uri ? (
          <PressableScale haptic="select" onPress={() => pick('photo')} style={[styles.photoFrame, { borderColor: t.c.lineStrong }]} accessibilityLabel="Add a photo">
            <Icon name="camera" size={26} color={t.c.text} />
            <Text variant="label">Add a photo</Text>
          </PressableScale>
        ) : null}
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={tx('Write something…')}
          placeholderTextColor={t.c.textTertiary}
          multiline
          maxLength={community ? 2000 : 160}
          editable={!busy}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('Write something…')}
        />
        {photos.length > 1 ? (
          <Animated.View entering={FadeIn}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              {photos.map((u) => (
                <View key={u} style={styles.thumb}>
                  <Image source={{ uri: u }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <PressableScale haptic="select" onPress={() => removePhoto(u)} disabled={busy} hitSlop={8} style={styles.thumbX} accessibilityLabel="Remove the photo">
                    <Icon name="x" size={12} color="#fff" />
                  </PressableScale>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        ) : media ? (
          <Animated.View entering={FadeIn}>
            {/* The same frame as in the feed: what you see here is what gets published. */}
            {media.kind === 'video' ? (
              <LiveVideo fit url={media.uri} poster={media.poster} seconds={media.seconds} ratio={ready?.ratio ?? media.ratio} style={styles.media} />
            ) : (
              <LivePhoto url={media.uri} ratio={ready?.ratio ?? media.ratio} tappable={false} style={styles.media} />
            )}
            <PressableScale haptic="select" onPress={() => (setMedia(undefined), setExtra([]))} disabled={busy} hitSlop={8} style={styles.removeMedia} accessibilityLabel={media.kind === 'video' ? 'Remove the video' : 'Remove the photo'}>
              <Icon name="x" size={16} color="#fff" />
            </PressableScale>
          </Animated.View>
        ) : null}
        {progress !== null ? (
          <View style={{ gap: 6 }}>
            <View style={[styles.bar, { backgroundColor: t.c.overlay }]}>
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: t.c.text }]} />
            </View>
            <Text variant="caption" tone="secondary">
              {tx(media?.kind === 'video' ? 'Sending the video… {n}%' : 'Sending the photo… {n}%', { n: Math.round(progress * 100) })}
            </Text>
          </View>
        ) : null}
        {mode === 'post' && !uri ? null : (
          <View style={styles.wrap}>
            <PressableScale haptic="select" onPress={() => pick('photo')} disabled={busy} style={[styles.addPhoto, { borderColor: t.c.lineStrong, flex: 1 }]} accessibilityLabel={community ? 'Add photos' : 'Add a photo'}>
              <Icon name="image" size={18} color={t.c.text} />
              <Text variant="label">{community ? (photos.length ? 'Add photos' : 'Photos') : media?.kind === 'photo' ? 'Change photo' : 'Photo'}</Text>
            </PressableScale>
            <PressableScale haptic="select" onPress={() => pick('video')} disabled={busy} style={[styles.addPhoto, { borderColor: t.c.lineStrong, flex: 1 }]} accessibilityLabel="Add a video">
              <Icon name="video" size={18} color={t.c.text} />
              <Text variant="label">{media?.kind === 'video' ? 'Change video' : 'Video'}</Text>
            </PressableScale>
          </View>
        )}
        {account && communities.length ? (
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="tertiary">
              Community (optional)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
              <Chip size="sm" label="Live only" icon="zap" selected={!community} onPress={() => chooseCommunity(null)} />
              {communities.map((c) => (
                <Chip key={c.id} size="sm" label={tx(c.name)} raw icon="users" selected={communityId === c.id} onPress={() => chooseCommunity(c.id)} />
              ))}
            </ScrollView>
            {community ? (
              <Text variant="caption" tone="secondary">
                {tx('Everyone who can see {name} sees it, there and in the Live.', { name: tx(community.name) })}
              </Text>
            ) : null}
          </View>
        ) : null}
        {community ? null : (
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="tertiary">
              Where (optional)
            </Text>
            <AreaPicker cityId={city.id} value={area} onChange={(id) => setArea(area === id ? null : id)} />
          </View>
        )}
        {account && !community ? (
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="tertiary">
              Who sees it
            </Text>
            <View style={styles.wrap}>
              <Chip size="sm" label="Mutual follows" icon="users" selected={visibility === 'friends'} onPress={() => setChosen('friends')} />
              <Chip size="sm" label="Everyone nearby" icon="globe" selected={visibility === 'everyone'} onPress={() => setChosen('everyone')} />
            </View>
            <Chip size="sm" label="Anyone can join: make it an activity" icon="plus" selected={openUp} onPress={() => !busy && setOpenUp(!openUp)} />
          </View>
        ) : null}
        <Button label="Publish" icon="send" full haptic={false} loading={busy} disabled={!text.trim() && !media} onPress={submit} />
      </SheetScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 14 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginBottom: -space[2] },
  card: { borderRadius: radius.xl, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photo: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  // Live photos and videos: the height follows the media's shape (LivePhoto / LiveVideo fit).
  media: { borderRadius: radius.lg, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  goLive: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 12, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  goLiveMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  goLiveBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  publish: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20 },
  thumb: { width: 96, height: 120, borderRadius: radius.md, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  thumbX: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  split: { flexDirection: 'row', alignItems: 'flex-start' },
  feed: { flex: 1, minWidth: 0 },
  panel: { gap: space[6] },
  stack: { paddingHorizontal: space.gutter, gap: 10 },
  friendText: { gap: 1, maxWidth: 120 },
  friendTextWide: { gap: 1, flex: 1 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: radius.xl },
  input: { minHeight: 96, borderRadius: radius.lg, padding: 16, fontFamily: font.medium, fontSize: 17, textAlignVertical: 'top' },
  photoFrame: { height: 168, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  removeMedia: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
