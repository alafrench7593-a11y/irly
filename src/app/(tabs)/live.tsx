import { AreaPicker } from '@/components/ui/AreaPicker';
import { t as tx, a11y } from '@/i18n';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { InboxButtons } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { LiveRing } from '@/features/live/LiveStrip';
import { pickLiveMedia, prepareLiveMedia, type LiveMedia, type PreparedLive } from '@/features/live/liveMedia';
import { uuid } from '@/lib/uuid';
import { LiveVideo } from '@/features/live/LiveVideo';
import { LivePhoto } from '@/features/live/LivePhoto';
import { useAccount } from '@/features/auth/account';
import { addFriend, deleteServerIrl, editServerIrl, postServerIrl, settleLive, useFriends, useServerIrl } from '@/features/server/social';
import { outcomeOf, type LivePhase } from '@/features/live/livePublish';
import { useDrafts } from '@/features/posts/posts';
import { ActionBar } from '@/components/social/ActionBar';
import { openReport } from '@/features/moderation/reportStore';
import { hideItem, useEngagement } from '@/features/server/engage';
import { track } from '@/lib/analytics';
import type { CityId } from '@/data/types';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, LiveDot } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
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
 * a venue or a neighbourhood (never an address), gone after 4 hours. Every
 * post is an invitation: message the person or go there.
 */
// Who sees a moment, as stored (a private one is not "Everyone").
const VISIBILITY_LABEL: Record<string, string> = { everyone: 'Everyone', friends: 'Friends', close_friends: 'Close friends', community: 'Communities', private: 'Only me' };

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
  return (
    <Page
      back={false}
      overline={tx('{city} · right now', { city: city.name })}
      title="IRL"
      subtitle={tx('What people around you are doing. Posts disappear after {h} hours.', { h: LIVE_TTL_MIN / 60 })}
      right={<InboxButtons />}
      bottomInset={bottom + 24}
      overlay={<Composer visible={composer} mode={mode} onClose={() => setComposer(false)} />}
    >
      <View style={{ marginBottom: space[6] }}>
        <GoLiveCard onText={() => setComposer('now')} onPhoto={() => setComposer('post')} />
      </View>
      <View style={{ marginBottom: space[6] }}>
        <FriendsLiveNow />
      </View>
      <ServerFeed cityId={cityId} />
      <View style={styles.list}>
        {sorted.map((l, i) => (
          <Animated.View key={l.id} entering={enter.rise(i)} layout={LinearTransition.springify(spring.medium.duration)}>
            <LiveCard live={l} />
          </Animated.View>
        ))}
      </View>
    </Page>
  );
}

function LiveCard({ live }: { live: Live }) {
  const t = useTheme();
  const router = useRouter();
  const city = CITIES[live.cityId];
  const me = useStore((s) => s.profile.name) || 'You';
  const person = live.authorId === 'me' ? undefined : findPerson(live.authorId);
  const name = person?.name ?? me;
  const now = useNow();
  const minutes = Math.max(1, Math.round((now - live.postedAt) / 60_000));
  const hasPhoto = Boolean(live.photo || live.photoUri);
  return (
    <View style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden', boxShadow: t.shadow.card }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.head}>
        <Avatar name={name} hue={person?.hue ?? 0} size={40} online={person?.online} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS">{name}</Text>
          <View style={styles.meta}>
            <LiveDot size={6} color={t.c.live} />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {live.place} · {areaName(city, live.areaId)} · {timeAgo(minutes)}
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
      <Text variant={hasPhoto ? 'body' : 'titleM'}>{live.text}</Text>
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
 * « What are you doing right now? »: the door to going live, at the top of
 * the feed, so it never floats over the Match IRLY button. The whole card opens
 * the words; the camera opens the photo-first composer.
 */
function GoLiveCard({ onText, onPhoto }: { onText: () => void; onPhoto: () => void }) {
  const t = useTheme();
  const name = useStore((s) => s.profile.name) || 'You';
  const photo = useStore((s) => s.profile.photoUri);
  return (
    <View style={[styles.goLive, { marginHorizontal: space.gutter, backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}>
      <GlassLayer radius={radius.xl} />
      <PressableScale haptic="select" scaleTo={0.98} onPress={onText} style={styles.goLiveMain} accessibilityLabel={tx('Go live: what are you doing right now?')}>
        <Avatar name={name} hue={262} size={44} photo={photo} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.meta}>
            <LiveDot size={6} />
            <Text variant="overline" tone="live">
              Go live
            </Text>
          </View>
          <Text variant="body" tone="secondary" numberOfLines={2}>
            What are you doing right now?
          </Text>
        </View>
      </PressableScale>
      <PressableScale haptic="select" scaleTo={0.9} onPress={onPhoto} accessibilityLabel="Post a photo" style={[styles.goLiveBtn, { backgroundColor: t.c.brand }]}>
        <Icon name="camera" size={18} color={t.c.onBrand} />
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
function FriendsLiveNow() {
  const t = useTheme();
  const router = useRouter();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const connections = useStore((s) => s.connections);
  const others = lives.filter((l) => l.authorId !== 'me');
  const friends = others.filter((l) => connections[l.authorId] === 'connected');
  const list = (friends.length ? friends : others).slice(0, 8);
  if (!list.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text variant="overline" tone="secondary" style={{ paddingHorizontal: space.gutter }}>
        {friends.length ? 'Friends live now' : 'Live around you'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 10 }}>
        {list.map((l, i) => {
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
                  <Avatar name={p.name} hue={p.hue} size={38} />
                </LiveRing>
                <View style={{ gap: 1, maxWidth: 120 }}>
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
        })}
      </ScrollView>
    </View>
  );
}

/**
 * Signed in: what members are posting right now, live. Friends' posts
 * first; add someone as a friend from their post.
 */
function ServerFeed({ cityId }: { cityId: CityId }) {
  const t = useTheme();
  const { narrow } = useCityFilter(cityId);
  const { posts, refresh: reloadFeed } = useServerIrl(cityId);
  const { friends, refresh } = useFriends();
  const router = useRouter();
  const eng = useEngagement('irl_post', posts.map((p) => p.id));
  const now = useNow();
  // Hidden or being removed: gone from the list at once.
  const [gone, setGone] = useState<Set<string>>(() => new Set());
  const drop = (id: string, on: boolean) =>
    setGone((g) => {
      const next = new Set(g);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const visible = posts.filter((p) => !gone.has(p.id));
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
      {sorted.map((p, i) => {
        const f = friends.find((x) => x.userId === p.authorId);
        const status = p.mine ? 'mine' : p.friend ? 'friend' : f?.status === 'pending' ? (f.incoming ? 'incoming' : 'sent') : 'none';
        return (
          <Animated.View key={p.id} entering={enter.rise(i)} style={[styles.card, { backgroundColor: 'transparent', overflow: 'hidden', boxShadow: t.shadow.card }]}>
            <GlassLayer radius={radius.xl} />
            <View style={styles.head}>
              {/* The author's face and name open their profile. */}
              <PressableScale haptic="select" scaleTo={0.94} onPress={() => router.push(`/person/${p.authorId}`)} accessibilityLabel={p.mine ? 'My profile' : tx('Open {name}’s profile', { name: p.firstName })}>
                <Avatar name={p.firstName} hue={(p.authorId.charCodeAt(0) * 37) % 360} size={40} userId={p.authorId} />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" onPress={() => router.push(`/person/${p.authorId}`)}>{p.mine ? 'You' : p.firstName}</Text>
                <View style={styles.meta}>
                  <LiveDot size={6} color={t.c.live} />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {placeLabel(cityId, p.cityId, p.areaId, p.placeName)} · {timeAgo(Math.max(1, Math.round((now - p.createdAt) / 60000)))} · {tx(VISIBILITY_LABEL[p.visibility as string] ?? 'Everyone')}
                  </Text>
                </View>
              </View>
            </View>
            {/* The frame follows the media's own shape; one broken media shows its own retry, never breaks the feed. */}
            {p.mediaKind === 'video' && p.mediaUrl ? (
              <LiveVideo fit url={p.mediaUrl} poster={p.posterUrl} seconds={p.seconds} ratio={p.mediaRatio} onRetry={reloadFeed} style={styles.media} />
            ) : p.mediaKind ? (
              <LivePhoto
                url={p.mediaUrl}
                kind={p.mediaKind}
                ratio={p.mediaRatio}
                onRetry={reloadFeed}
                style={styles.media}
                liked={eng.get(p.id).liked}
                onLike={() => {
                  if (!eng.signedIn) {
                    toast('Sign in to interact', 'user', 'brand');
                    return;
                  }
                  // A double tap only ever likes, even before the like state has loaded.
                  eng.like(p.id, true).catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'));
                }}
              />
            ) : null}
            {p.body ? (
              <Text variant={p.mediaKind ? 'body' : 'titleM'} raw>
                {p.body}
              </Text>
            ) : null}
            {p.activityId ? (
              <PressableScale onPress={() => router.push(`/a/${p.activityId}`)} haptic="select" scaleTo={0.98} style={[styles.linked, { backgroundColor: t.c.bg }]} accessibilityLabel={p.activityTitle ? tx('Join {title}', { title: p.activityTitle }) : tx('Join the activity')}>
                <Icon name="calendar" size={18} color={t.c.text} />
                <Text variant="titleS" numberOfLines={1} style={{ flex: 1 }}>
                  {p.activityTitle ?? 'Activity'}
                </Text>
                <Text variant="label">Join</Text>
              </PressableScale>
            ) : null}
            <ActionBar target={{ type: 'irl_post', id: p.id, title: p.body.slice(0, 60) }} eng={eng} />
            {status === 'mine' ? (
              <View style={styles.actions}>
                <Button label="Edit" variant="secondary" size="sm" icon="edit" onPress={() => setEditing({ id: p.id, body: p.body })} />
                <Button
                  label="Remove"
                  variant="secondary"
                  size="sm"
                  icon="x"
                  onPress={() => {
                    drop(p.id, true);
                    deleteServerIrl(p.id).catch((e) => {
                      drop(p.id, false);
                      toast(e instanceof Error ? e.message : 'Could not remove', 'x', 'live');
                    });
                  }}
                />
              </View>
            ) : status === 'friend' ? (
              <View style={styles.actions}>
                <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
                  Friend
                </Text>
                <PostMenu id={p.id} authorId={p.authorId} onHide={(on) => drop(p.id, on)} />
              </View>
            ) : (
              // Anyone's post can be hidden or reported, not only friends'.
              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <FriendButton status={status} name={p.firstName} authorId={p.authorId} onDone={refresh} />
                </View>
                <PostMenu id={p.id} authorId={p.authorId} onHide={(on) => drop(p.id, on)} />
              </View>
            )}
          </Animated.View>
        );
      })}
      <EditLive value={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

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
 * Add friend → (sending) → Request sent; Accept friend → (sending) → Friends.
 * The button only changes once the server has answered: a failure leaves it
 * as it was, and a double tap never sends twice.
 */
function FriendButton({ status, name, authorId, onDone }: { status: 'incoming' | 'sent' | 'none'; name: string; authorId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      label={status === 'incoming' ? 'Accept friend' : status === 'sent' ? 'Request sent' : 'Add friend'}
      size="sm"
      variant={status === 'sent' ? 'secondary' : 'primary'}
      icon={status === 'sent' ? 'check' : 'plus'}
      disabled={status === 'sent'}
      loading={busy}
      onPress={() => {
        if (busy) return;
        setBusy(true);
        addFriend(authorId)
          .then((r) => {
            haptic('success');
            toast(r === 'accepted' ? tx('You and {name} are friends', { name }) : tx('Request sent to {name}', { name }), 'user', 'brand');
            onDone();
          })
          .catch((e) => toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live'))
          .finally(() => setBusy(false));
      }}
    />
  );
}

/** Not for me / report, on someone else's post. */
function PostMenu({ id, authorId, onHide }: { id: string; authorId: string; onHide: (on: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <PressableScale
        onPress={() => {
          onHide(true);
          hideItem({ type: 'irl_post', id })
            .then(() => toast('Hidden from your feed', 'eye', 'brand'))
            .catch(() => {
              onHide(false);
              toast('Could not hide this post', 'x', 'live');
            });
        }}
        haptic="select"
        hitSlop={8}
        accessibilityLabel="Hide this post"
      >
        <Icon name="eye" size={18} color={t.c.textTertiary} />
      </PressableScale>
      <PressableScale
        onPress={() => openReport({ kind: 'irl_post', id, userId: authorId })}
        haptic="select"
        hitSlop={8}
        accessibilityLabel="Report this post"
      >
        <Icon name="flag" size={18} color={t.c.textTertiary} />
      </PressableScale>
    </View>
  );
}

/**
 * Two doors into the same composer: « Post IRL » leads with the photo,
 * « Share what I'm doing » with the words.
 */
function Composer({ visible, mode = 'now', onClose }: { visible: boolean; mode?: 'post' | 'now'; onClose: () => void }) {
  const t = useTheme();
  const cityId = useCityId();
  // The space this Live is posted in: it shows only in that space's Live.
  const scope = useAppSpace() === 'girl' ? 'irly_girl' : 'irly';
  const city = CITIES[cityId];
  const post = useLiveStore((s) => s.post);
  const liveDraft = useDrafts((s) => s.byKey.live);
  const saveDraft = useDrafts((s) => s.save);
  const [text, setText] = useState(() => liveDraft?.body ?? '');
  // No neighbourhood is chosen for the member: they say where they are.
  const [picked, setArea] = useState<string | null>(null);
  // Switching destination keeps the composer mounted: never post a Dubai area in Bali.
  const area = startArea(city, picked);
  const [media, setMedia] = useState<LiveMedia | undefined>();
  const uri = media?.uri;
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
    setChosen(null);
    setOpenUp(false);
    setProgress(null);
    setPhase('draft');
  };

  /**
   * The member gives up on a try that got no answer (closed the composer,
   * discarded it): the server either has it (it stays: said so) or makes
   * sure it never lands (its files and activity go). Unreachable: settled at
   * the next start of the app, never guessed.
   */
  const giveUp = () => {
    const a = attempt.current;
    if (!a?.unknown) return;
    attempt.current = null;
    if (mounted.current) setPhase('draft');
    settleLive(a.id)
      .then((r) => {
        if (r !== 'published') return;
        toast("You're live for 4 hours", 'zap', 'live');
        published();
      })
      .catch(() => undefined);
  };

  // Closing by a swipe or a tap outside keeps what was written as a draft;
  // the back arrow asks: keep the draft or discard it. While publishing, the
  // composer only hides: the Live goes on and says how it ended.
  const close = () => {
    if (!busy) {
      saveDraft('live', text.trim() ? { body: text, media: null, at: Date.now() } : null);
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
      const m = await pickLiveMedia(kind);
      if (!m || !mounted.current) return;
      setMedia(m);
      prepareLiveMedia(m)
        .then((data) => mounted.current && setPrep({ uri: m.uri, data }))
        // A failure shows when posting (which tries again), not now.
        .catch(() => undefined);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not open this file', 'x', 'live');
    }
  };

  const submit = async () => {
    if ((!text.trim() && !media) || sending.current) return;
    if (!area) {
      toast('Choose a neighbourhood', 'pin', 'brand');
      return;
    }
    if (!account) {
      post({ cityId, kind: media?.kind === 'photo' ? 'photo' : 'text', text: text.trim(), photoUri: media?.kind === 'photo' ? uri : undefined, place: areaName(city, area), areaId: area });
      haptic('success');
      toast("You're live for 4 hours", 'zap', 'live');
      published();
      onClose();
      return;
    }
    // Signed in: the post goes to the server, friends see it live.
    sending.current = true;
    setPhase('publishing');
    const key = JSON.stringify([text.trim(), media?.uri ?? null, area, chosen, openUp, cityId]);
    const prev = attempt.current;
    if (prev && prev.key !== key && prev.unknown) {
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
    if (!attempt.current || attempt.current.key !== key) attempt.current = { key, id: uuid(), at: new Date(Date.now() + 30 * 60 * 1000), unknown: false };
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
              place: areaName(city, area),
              areaId: area,
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
        areaId: area,
        placeName: areaName(city, area),
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
        if (text.trim()) saveDraft('live', { body: text, media: null, at: Date.now() });
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
    toast("You're live for 4 hours", 'zap', 'live');
    published();
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={mode === 'post' ? 'Post IRL' : 'Go live'}
      subtitle={
        mode === 'post'
          ? 'A photo of where you are, right now. Only your area is shown, never your address.'
          : 'What are you doing right now? Only your area is shown, never your address.'
      }
    >
      {/* Scrolls when the keyboard is up, so the field and Post live stay reachable. */}
      <ScrollView
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
          placeholder={tx('Coffee in the Marina, anyone?')}
          placeholderTextColor={t.c.textTertiary}
          multiline
          maxLength={160}
          editable={!busy}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('What are you doing right now?')}
        />
        {media ? (
          <Animated.View entering={FadeIn}>
            {/* The same frame as in the feed: what you see here is what gets published. */}
            {media.kind === 'video' ? (
              <LiveVideo fit url={media.uri} poster={media.poster} seconds={media.seconds} ratio={ready?.ratio ?? media.ratio} style={styles.media} />
            ) : (
              <LivePhoto url={media.uri} ratio={ready?.ratio ?? media.ratio} tappable={false} style={styles.media} />
            )}
            <PressableScale haptic="select" onPress={() => setMedia(undefined)} disabled={busy} hitSlop={8} style={styles.removeMedia} accessibilityLabel={media.kind === 'video' ? 'Remove the video' : 'Remove the photo'}>
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
              {tx(media?.kind === 'photo' ? 'Sending the photo… {n}%' : 'Sending the video… {n}%', { n: Math.round(progress * 100) })}
            </Text>
          </View>
        ) : null}
        {mode === 'post' && !uri ? null : (
          <View style={styles.wrap}>
            <PressableScale haptic="select" onPress={() => pick('photo')} disabled={busy} style={[styles.addPhoto, { borderColor: t.c.lineStrong, flex: 1 }]} accessibilityLabel="Add a photo">
              <Icon name="camera" size={18} color={t.c.text} />
              <Text variant="label">{media?.kind === 'photo' ? 'Change photo' : 'Photo'}</Text>
            </PressableScale>
            <PressableScale haptic="select" onPress={() => pick('video')} disabled={busy} style={[styles.addPhoto, { borderColor: t.c.lineStrong, flex: 1 }]} accessibilityLabel="Add a video">
              <Icon name="video" size={18} color={t.c.text} />
              <Text variant="label">{media?.kind === 'video' ? 'Change video' : 'Video'}</Text>
            </PressableScale>
          </View>
        )}
        <View style={{ gap: 8 }}>
          <Text variant="overline" tone="tertiary">
            Where
          </Text>
          <AreaPicker cityId={city.id} value={area} onChange={setArea} />
        </View>
        {account ? (
          <View style={{ gap: 8 }}>
            <Text variant="overline" tone="tertiary">
              Who sees it
            </Text>
            <View style={styles.wrap}>
              <Chip size="sm" label="Friends" icon="users" selected={visibility === 'friends'} onPress={() => setChosen('friends')} />
              <Chip size="sm" label="Everyone nearby" icon="globe" selected={visibility === 'everyone'} onPress={() => setChosen('everyone')} />
            </View>
            <Chip size="sm" label="Anyone can join: make it an activity" icon="plus" selected={openUp} onPress={() => !busy && setOpenUp(!openUp)} />
          </View>
        ) : null}
        <Button label="Post live" icon="zap" full haptic={false} loading={busy} disabled={!text.trim() && !media} onPress={submit} />
      </ScrollView>
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
  goLiveBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: radius.xl },
  input: { minHeight: 96, borderRadius: radius.lg, padding: 16, fontFamily: font.medium, fontSize: 17, textAlignVertical: 'top' },
  photoFrame: { height: 168, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  removeMedia: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
