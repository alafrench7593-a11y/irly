import * as ImagePicker from 'expo-image-picker';
import { AreaPicker } from '@/components/ui/AreaPicker';
import { t as tx, a11y } from '@/i18n';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { InboxButtons } from '@/components/navigation/Headers';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { LiveRing } from '@/features/live/LiveStrip';
import { useAccount } from '@/features/auth/account';
import { addFriend, deleteServerIrl, postServerIrl, useFriends, useServerIrl } from '@/features/server/social';
import { ActionBar } from '@/components/social/ActionBar';
import { createServerActivity } from '@/features/server/activities';
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
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * IRL: what people around you are doing right now. Photo or text, tied to
 * a venue or a neighbourhood (never an address), gone after 4 hours. Every
 * post is an invitation: message the person or go there.
 */
export default function LiveScreen() {
  const cityId = useCityId();
  const city = CITIES[cityId];
  const lives = useLives();
  const { compose } = useLocalSearchParams<{ compose?: string }>();
  const router = useRouter();
  const [manual, setManual] = useState<false | 'now' | 'post'>(false);
  // Opened from the IRL menu (Post IRL, Share what I'm doing): the composer is already up.
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
    <View style={[styles.card, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
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
        <TapPhoto photo={live.photoUri ? { uri: live.photoUri } : { visual: { photo: live.photo! }, light: city.light }} style={styles.photo}>
          {live.photoUri ? (
            <Image source={{ uri: live.photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Photo visual={{ photo: live.photo! }} light={city.light} style={StyleSheet.absoluteFill} width={800} recyclingKey={live.id} />
          )}
        </TapPhoto>
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
 * the feed, so it never floats over the IRL button. The whole card opens
 * the words; the camera opens the photo-first composer.
 */
function GoLiveCard({ onText, onPhoto }: { onText: () => void; onPhoto: () => void }) {
  const t = useTheme();
  const name = useStore((s) => s.profile.name) || 'You';
  const photo = useStore((s) => s.profile.photoUri);
  return (
    <View style={[styles.goLive, { marginHorizontal: space.gutter, backgroundColor: t.c.card, borderColor: t.c.line }]}>
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
                style={[styles.friend, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}
                accessibilityLabel={tx('{name}, live: {text}, {area}', { name: p.name, text: l.text, area: areaName(city, l.areaId) })}
              >
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
  const { posts } = useServerIrl(cityId);
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
          <Animated.View key={p.id} entering={enter.rise(i)} style={[styles.card, { backgroundColor: t.c.surface, boxShadow: t.shadow.card }]}>
            <View style={styles.head}>
              {/* The author's face and name open their profile. */}
              <PressableScale haptic="select" scaleTo={0.94} onPress={() => router.push(`/person/${p.authorId}`)} accessibilityLabel={p.mine ? 'My profile' : tx('Open {name}’s profile', { name: p.firstName })}>
                <Avatar name={p.firstName} hue={(p.authorId.charCodeAt(0) * 37) % 360} size={40} />
              </PressableScale>
              <View style={{ flex: 1 }}>
                <Text variant="titleS" onPress={() => router.push(`/person/${p.authorId}`)}>{p.mine ? 'You' : p.firstName}</Text>
                <View style={styles.meta}>
                  <LiveDot size={6} color={t.c.live} />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {placeLabel(cityId, p.cityId, p.areaId, p.placeName)} · {timeAgo(Math.max(1, Math.round((now - p.createdAt) / 60000)))} · {p.visibility === 'friends' ? 'Friends' : 'Everyone'}
                  </Text>
                </View>
              </View>
            </View>
            {p.mediaUrl ? (
              <TapPhoto
                photo={{ uri: p.mediaUrl }}
                style={styles.photo}
                liked={eng.get(p.id).liked}
                onLike={() => {
                  if (!eng.signedIn) {
                    toast('Sign in to interact', 'user', 'brand');
                    return;
                  }
                  eng.like(p.id).catch((e) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live'));
                }}
              >
                <Image source={{ uri: p.mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
              </TapPhoto>
            ) : null}
            <Text variant={p.mediaUrl ? 'body' : 'titleM'} raw>
              {p.body}
            </Text>
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
    </View>
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
  const city = CITIES[cityId];
  const post = useLiveStore((s) => s.post);
  const [text, setText] = useState('');
  const [picked, setArea] = useState(city.areas[0].id);
  // Switching destination keeps the composer mounted: never post a Dubai area in Bali.
  const area = city.areas.some((a) => a.id === picked) ? picked : city.areas[0].id;
  const [uri, setUri] = useState<string | undefined>();
  // Untouched, the post follows the member's IRL visibility setting; the chips show it.
  const [chosen, setChosen] = useState<'friends' | 'everyone' | null>(null);
  const [setting, setSetting] = useState<'friends' | 'everyone' | 'private'>('friends');
  const visibility = chosen ?? (setting === 'private' ? null : setting);
  const [openUp, setOpenUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const account = useAccount();
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

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true });
    if (!res.canceled && res.assets[0]) setUri(res.assets[0].uri);
  };

  const createdActivity = useRef<string | null>(null);
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (account) {
      // Signed in: the post goes to the server, friends see it live.
      setBusy(true);
      try {
        // "Anyone want to join?" becomes a real activity the post points at.
        // A retry after a failed post reuses the activity already created.
        let activityId: string | null = openUp ? createdActivity.current : null;
        if (openUp && !activityId) {
          const start = new Date(Date.now() + 30 * 60 * 1000);
          activityId = await createServerActivity(
            {
              cityId,
              title: text.trim().slice(0, 80).padEnd(3, '.'),
              place: areaName(city, area),
              areaId: area,
              day: 'Today',
              time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
              spots: 0,
              privacy: visibility === 'everyone' ? 'public' : 'connections',
              format: 'meetup',
              currency: city.currency,
            },
            start,
          );
          createdActivity.current = activityId;
          track('ACTIVITY_CREATE', { via: 'irl' });
        }
        await postServerIrl({ cityId, areaId: area, placeName: areaName(city, area), body: text.trim(), photoUri: uri, visibility: chosen ?? undefined, activityId });
        createdActivity.current = null;
        setChosen(null);
        track('IRL_CREATE', { photo: Boolean(uri), activity: Boolean(activityId) });
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Could not post', 'x', 'live');
        setBusy(false);
        return;
      }
      setBusy(false);
    } else {
      post({ cityId, kind: uri ? 'photo' : 'text', text: text.trim(), photoUri: uri, place: areaName(city, area), areaId: area });
    }
    haptic('success');
    toast("You're live for 4 hours", 'zap', 'live');
    setText('');
    setUri(undefined);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={mode === 'post' ? 'Post IRL' : 'Go live'}
      subtitle={
        mode === 'post'
          ? 'A photo of where you are, right now. Only your area is shown, never your address.'
          : 'What are you doing right now? Only your area is shown, never your address.'
      }
    >
      <View style={{ paddingHorizontal: space.gutter, gap: space[5] }}>
        {mode === 'post' && !uri ? (
          <PressableScale haptic="select" onPress={pick} style={[styles.photoFrame, { borderColor: t.c.lineStrong }]} accessibilityLabel="Add a photo">
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
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('What are you doing right now?')}
        />
        {uri ? (
          <Animated.View entering={FadeIn}>
            <Image source={{ uri }} style={styles.preview} contentFit="cover" />
          </Animated.View>
        ) : null}
        {mode === 'post' && !uri ? null : (
          <PressableScale haptic="select" onPress={pick} style={[styles.addPhoto, { borderColor: t.c.lineStrong }]} accessibilityLabel="Add a photo">
            <Icon name="camera" size={18} color={t.c.text} />
            <Text variant="label">{uri ? 'Change photo' : 'Add a photo'}</Text>
          </PressableScale>
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
            <Chip size="sm" label="Anyone can join: make it an activity" icon="plus" selected={openUp} onPress={() => setOpenUp(!openUp)} />
          </View>
        ) : null}
        <Button label="Post live" icon="zap" full haptic={false} loading={busy} disabled={!text.trim()} onPress={submit} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.gutter, gap: 14 },
  card: { borderRadius: radius.xl, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photo: { height: 220, borderRadius: radius.lg, overflow: 'hidden' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
  goLive: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 12, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  goLiveMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  goLiveBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  round: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, borderRadius: radius.xl },
  input: { minHeight: 96, borderRadius: radius.lg, padding: 16, fontFamily: font.medium, fontSize: 17, textAlignVertical: 'top' },
  preview: { height: 180, borderRadius: radius.lg },
  photoFrame: { height: 168, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10 },
  addPhoto: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: radius.pill, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
