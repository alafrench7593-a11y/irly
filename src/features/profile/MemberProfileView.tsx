import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '@/components/navigation/TabBar';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Divider, IconButton, Segmented } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { webLink } from '@/config/app';
import { INTERESTS } from '@/data/catalog';
import { areaName, CITIES } from '@/data/destinations';
import { blockUser } from '@/features/moderation/moderation';
import { openReport } from '@/features/moderation/reportStore';
import { useSignedLinks } from '@/features/server/media';
import { changed } from '@/features/server/sync';
import { t as tx, useT } from '@/i18n';
import { hueOf } from '@/lib/format';
import { cityWhen, timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import {
  openDirect,
  setFollow,
  setFriend,
  useMemberActivities,
  useMemberLives,
  useMemberPosts,
  useMemberProfile,
  type MemberCommunity,
  type MemberProfile,
  type ProfileActivity,
} from './member';

type Tab = 'posts' | 'lives' | 'activities' | 'communities';

/**
 * A member's profile, yours included (the Profile tab shows it with `own`):
 * identity, followers / following / friends, then four tabs (Posts, Lives,
 * Activities, Communities). Everything comes from the server as the viewer
 * may see it; counts and buttons follow the server after every action.
 * Settings live behind the gear (your profile); the "…" menu holds share,
 * report and block (someone else's).
 */
export function MemberProfileView({ userId, own = false }: { userId: string; own?: boolean }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const reduced = useReducedMotion();
  const { profile: p, communities, loading, error, reload, signedIn } = useMemberProfile(userId);
  const faces = useSignedLinks('profile-photos', [p?.photo]);
  const [busy, setBusy] = useState<'follow' | 'message' | 'friend' | 'unfriend' | 'block' | null>(null);
  const [tab, setTab] = useState<Tab>('posts');
  const [menu, setMenu] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/messages'));
  const onBack = own ? undefined : back;

  const follow = async () => {
    if (!p || busy) return;
    setBusy('follow');
    try {
      await setFollow(p.id, !p.iFollow);
      haptic(p.iFollow ? 'select' : 'success');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  // Friend request, accept, withdraw, decline, unfriend: shown as done only once the server has it.
  const friend = async (action: 'add' | 'remove') => {
    if (!p || busy) return;
    setBusy(action === 'add' ? 'friend' : 'unfriend');
    try {
      const next = await setFriend(p.id, action);
      haptic(action === 'add' ? 'success' : 'select');
      if (action === 'add')
        toast(next === 'friends' ? tx('You and {name} are now friends', { name: p.firstName }) : tx('Request sent to {name}', { name: p.firstName }), next === 'friends' ? 'check' : 'send', 'positive');
      else toast(p.friendStatus === 'friends' ? tx('{name} is no longer your friend', { name: p.firstName }) : p.friendStatus === 'incoming' ? 'Request declined' : 'Request withdrawn', 'check', 'brand');
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
      reload();
    } finally {
      setBusy(null);
    }
  };
  const message = async () => {
    if (!p || busy) return;
    if (p.directId) {
      router.push(`/messages/${p.directId}`);
      return;
    }
    setBusy('message');
    try {
      const id = await openDirect(p.id);
      router.push(`/messages/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };
  const share = async () => {
    if (!p) return;
    setMenu(false);
    const who = p.username ? `@${p.username}` : p.firstName;
    await Share.share({ message: `${tx('{name} on IRLY', { name: who })}\n${webLink(`/person/${p.id}`)}` }).catch(() => undefined);
  };
  const block = async () => {
    if (!p || busy) return;
    setBusy('block');
    try {
      await blockUser(p.id);
      changed('friends', 'follows', 'inbox', 'people');
      setMenu(false);
      toast(tx('{name} is blocked', { name: p.firstName }), 'check', 'brand');
      back();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');
    } finally {
      setBusy(null);
    }
  };

  if (!signedIn)
    return (
      <Centered onBack={onBack}>
        <Text variant="titleM" align="center">
          Sign in to see this profile
        </Text>
        <Button label="Sign in" onPress={() => router.push('/account')} />
      </Centered>
    );
  if (loading)
    return (
      <Centered onBack={onBack}>
        <ActivityIndicator color={t.c.text} />
      </Centered>
    );
  if (error)
    return (
      <Centered onBack={onBack}>
        <Text variant="body" tone="secondary" align="center">
          {error}
        </Text>
        <Button label="Try again" variant="secondary" onPress={reload} />
      </Centered>
    );
  if (!p)
    return (
      <Centered onBack={onBack}>
        <Text variant="titleM" align="center">
          This person is no longer on IRLY
        </Text>
      </Centered>
    );

  const city = p.cityId ? CITIES[p.cityId as keyof typeof CITIES] : undefined;
  const photo = p.photo ? faces[p.photo] : undefined;
  const lists = (which: 'followers' | 'following' | 'friends') => (p.visible ? () => router.push(`/follows/${p.id}?which=${which}`) : undefined);
  return (
    <View style={[styles.root, { backgroundColor: t.c.bg }]}>
      <Animated.ScrollView contentContainerStyle={{ paddingBottom: (own ? tabSpace : insets.bottom) + 48 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.cover, { height: insets.top + 150 }]}>
          <Photo visual={{ photo: city?.photo ?? 'dubai' }} light={city?.light ?? 'dubai'} scrim="full" width={1000} style={StyleSheet.absoluteFill} />
        </View>

        {/* Identity */}
        <View style={styles.identity}>
          <Animated.View entering={reduced ? undefined : enter.pop(0)} style={[styles.ring, { borderColor: t.c.bg, boxShadow: t.shadow.float }]}>
            <Avatar name={p.firstName} hue={hueOf(p.id)} size={96} photo={photo} />
          </Animated.View>
          <Animated.View entering={reduced ? undefined : enter.rise(1)} style={{ alignItems: 'center', gap: 2 }}>
            <Text variant="displayL" align="center" raw>
              {p.firstName}
            </Text>
            {p.username ? (
              <Text variant="body" tone="secondary" raw>
                @{p.username}
              </Text>
            ) : own ? (
              <PressableScale onPress={() => router.push('/edit-profile')} accessibilityRole="button" style={styles.chooseHandle}>
                <Text variant="caption" tone="tertiary">
                  Choose your @username
                </Text>
              </PressableScale>
            ) : null}
            {p.followsMe && !p.isMe ? (
              <Text variant="caption" tone="tertiary">
                Follows you
              </Text>
            ) : null}
          </Animated.View>
          {p.visible && p.bio ? (
            <Text variant="body" align="center" style={styles.bio} raw>
              {p.bio}
            </Text>
          ) : null}
          {p.visible && city ? (
            <View style={styles.place}>
              <Icon name="pin" size={14} color={t.c.textSecondary} />
              <Text variant="caption" tone="secondary">
                {tr(city.name)}
              </Text>
            </View>
          ) : null}

          <Animated.View entering={reduced ? undefined : enter.rise(2)} style={[styles.counts, { borderColor: t.c.line }]}>
            <Count n={p.followers} label="Followers" onPress={lists('followers')} />
            <View style={[styles.sep, { backgroundColor: t.c.line }]} />
            <Count n={p.following} label="Following" onPress={lists('following')} />
            <View style={[styles.sep, { backgroundColor: t.c.line }]} />
            <Count n={p.friends} label="Friends" onPress={lists('friends')} />
          </Animated.View>

          {p.isMe ? (
            <View style={styles.buttons}>
              <View style={{ flex: 1 }}>
                <Button label="Edit profile" icon="user" variant="secondary" full onPress={() => router.push('/edit-profile')} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Share profile" icon="share" variant="secondary" full onPress={share} />
              </View>
            </View>
          ) : (
            <Actions p={p} busy={busy} onFriend={friend} onFollow={follow} onMessage={message} />
          )}
        </View>

        {p.visible && p.interests.length ? (
          <View style={styles.interests}>
            {p.interests.slice(0, 8).map((i) => {
              const it = INTERESTS[i as keyof typeof INTERESTS];
              return (
                <View key={i} style={[styles.tag, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
                  {it ? <Icon name={it.icon} size={13} color={t.c.textSecondary} /> : null}
                  <Text variant="caption">{it?.label ?? i}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {!p.visible ? (
          <Animated.View entering={FadeIn} style={[styles.card, { backgroundColor: t.c.surface }]}>
            <Icon name="lock" size={18} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" style={{ flex: 1 }}>
              {tx('{name} keeps their profile private. You see their name and photo only.', { name: p.firstName })}
            </Text>
          </Animated.View>
        ) : (
          <>
            <View style={styles.tabs}>
              <Segmented<Tab>
                options={[
                  { value: 'posts', label: tr('Posts') },
                  { value: 'lives', label: tr('Lives') },
                  { value: 'activities', label: tr('Activities') },
                  { value: 'communities', label: tr('Communities') },
                ]}
                value={tab}
                onChange={(v) => {
                  haptic('select');
                  setTab(v);
                }}
              />
            </View>
            <Animated.View key={tab} entering={reduced ? undefined : FadeInDown.duration(220)}>
              {tab === 'posts' ? <PostsTab userId={p.id} own={p.isMe} name={p.firstName} /> : null}
              {tab === 'lives' ? <LivesTab userId={p.id} own={p.isMe} name={p.firstName} cityId={p.cityId} /> : null}
              {tab === 'activities' ? <ActivitiesTab userId={p.id} own={p.isMe} name={p.firstName} /> : null}
              {tab === 'communities' ? <CommunitiesTab list={communities} own={p.isMe} name={p.firstName} /> : null}
            </Animated.View>
          </>
        )}
      </Animated.ScrollView>

      <View style={[styles.topBar, { top: insets.top + 10 }]} pointerEvents="box-none">
        {onBack ? <IconButton icon="arrowLeft" label="Back" variant="glass" onPress={onBack} /> : <View />}
        {p.isMe ? (
          <IconButton icon="settings" label={tr('Settings')} variant="glass" onPress={() => router.push('/preferences')} />
        ) : (
          <IconButton icon="more" label={tr('More actions')} variant="glass" onPress={() => setMenu(true)} />
        )}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={p.username ? `@${p.username}` : p.firstName}>
        <View style={{ paddingHorizontal: space.gutter }}>
          <MenuRow icon="share" label="Share profile" onPress={share} />
          <Divider />
          <MenuRow
            icon="flag"
            label="Report"
            onPress={() => {
              setMenu(false);
              openReport({ kind: 'profile', userId: p.id }, p.firstName);
            }}
          />
          <Divider />
          <MenuRow icon="x" label={busy === 'block' ? 'One moment…' : tx('Block {name}', { name: p.firstName })} danger onPress={block} />
          <Text variant="caption" tone="tertiary" style={{ paddingVertical: 10 }}>
            {tx('Blocking hides you from each other everywhere and ends any friendship. {name} is not told.', { name: p.firstName })}
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

/* ───────── Follow, friend and message (someone else's profile) ───────── */

function Actions({ p, busy, onFriend, onFollow, onMessage }: { p: MemberProfile; busy: string | null; onFriend: (a: 'add' | 'remove') => void; onFollow: () => void; onMessage: () => void }) {
  return (
    <View style={{ alignSelf: 'stretch', gap: 10 }}>
      <View style={styles.buttons}>
        <View style={{ flex: 1 }}>
          <Button
            label={p.iFollow ? 'Following' : p.followsMe ? 'Follow back' : 'Follow'}
            icon={p.iFollow ? 'userCheck' : 'userPlus'}
            variant={p.iFollow ? 'secondary' : 'primary'}
            loading={busy === 'follow'}
            full
            onPress={onFollow}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            label={p.friendStatus === 'friends' ? 'Friends' : p.friendStatus === 'outgoing' ? 'Request sent' : p.friendStatus === 'incoming' ? 'Accept' : 'Add friend'}
            icon={p.friendStatus === 'friends' ? 'userCheck' : p.friendStatus === 'outgoing' ? 'clock' : p.friendStatus === 'incoming' ? 'check' : 'users'}
            variant={p.friendStatus === 'friends' ? 'done' : p.friendStatus === 'incoming' ? 'primary' : 'secondary'}
            loading={busy === 'friend'}
            full
            haptic={false}
            onPress={p.friendStatus === 'none' || p.friendStatus === 'incoming' ? () => onFriend('add') : undefined}
          />
        </View>
      </View>
      <Button label="Message" icon="message" variant="secondary" loading={busy === 'message'} full disabled={!p.canMessage} onPress={onMessage} />
      {p.friendStatus !== 'none' ? (
        <PressableScale
          onPress={() => onFriend('remove')}
          disabled={Boolean(busy)}
          style={styles.link}
          accessibilityRole="button"
          accessibilityLabel={p.friendStatus === 'friends' ? tx('Remove {name} from your friends', { name: p.firstName }) : p.friendStatus === 'incoming' ? 'Decline the request' : 'Cancel the request'}
        >
          <Text variant="caption" tone="tertiary">
            {busy === 'unfriend' ? 'One moment…' : p.friendStatus === 'friends' ? 'Remove from friends' : p.friendStatus === 'incoming' ? 'Decline the request' : 'Cancel the request'}
          </Text>
        </PressableScale>
      ) : null}
      {!p.canMessage ? (
        <Text variant="caption" tone="tertiary" align="center">
          {p.friendStatus === 'friends'
            ? tx('{name} does not accept private messages right now.', { name: p.firstName })
            : p.friendStatus === 'incoming'
              ? tx('Accept {name}’s request to start chatting.', { name: p.firstName })
              : p.friendStatus === 'outgoing'
                ? tx('You can message {name} once they accept your request.', { name: p.firstName })
                : tx('Add {name} as a friend to send a message. Following does not open a chat.', { name: p.firstName })}
        </Text>
      ) : null}
    </View>
  );
}

/* ───────── Tabs ───────── */

function PostsTab({ userId, own, name }: { userId: string; own: boolean; name: string }) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const posts = useMemberPosts(userId);
  if (posts.loading) return <Loading />;
  if (posts.error && !posts.items.length) return <Failed message={posts.error} onRetry={posts.reload} />;
  if (!posts.items.length)
    return (
      <Empty
        icon="message"
        title={own ? 'No posts yet' : tx('{name} has not posted yet', { name })}
        body={own ? 'What you post in your communities shows here.' : 'Posts in communities you can see show here.'}
        cta={own ? { label: 'Open my communities', go: () => router.push('/communities') } : undefined}
      />
    );
  return (
    <View style={styles.list}>
      {posts.items.map((x) => (
        <PressableScale
          key={x.id}
          haptic="select"
          scaleTo={0.98}
          onPress={() => router.push(`/comments?type=community_post&id=${x.id}`)}
          style={[styles.post, { backgroundColor: t.c.surface, borderColor: t.c.line }]}
          accessibilityLabel={tx('Post in {name}', { name: x.communityName })}
        >
          <PressableScale onPress={() => router.push(`/c/${x.communityId}`)} accessibilityRole="link" style={{ alignSelf: 'flex-start' }}>
            <Text variant="caption" tone="tertiary" raw>
              {x.communityName} · {timeAgo(Math.max(0, Math.round((now - x.at) / 60000)))}
            </Text>
          </PressableScale>
          <Text variant="body" raw>
            {x.body}
          </Text>
          <View style={styles.meta}>
            <Icon name="heart" size={14} color={x.liked ? t.c.live : t.c.textTertiary} />
            <Text variant="caption" tone="tertiary">
              {x.likes}
            </Text>
            <Icon name="message" size={14} color={t.c.textTertiary} />
            <Text variant="caption" tone="tertiary">
              {x.comments}
            </Text>
          </View>
        </PressableScale>
      ))}
      {!posts.done ? <Button label={posts.loadingMore ? 'Loading…' : 'Show more'} variant="ghost" onPress={posts.more} loading={posts.loadingMore} /> : null}
    </View>
  );
}

function LivesTab({ userId, own, name, cityId }: { userId: string; own: boolean; name: string; cityId: string | null }) {
  const t = useTheme();
  const router = useRouter();
  const now = useNow();
  const lives = useMemberLives(userId);
  const pics = useSignedLinks('irl-media', lives.items.map((l) => l.media));
  if (lives.loading) return <Loading />;
  if (lives.error) return <Failed message={lives.error} onRetry={lives.reload} />;
  const live = lives.items.filter((l) => l.live && l.expiresAt > now);
  const past = lives.items.filter((l) => !(l.live && l.expiresAt > now));
  if (!lives.items.length)
    return (
      <Empty
        icon="zap"
        title={own ? 'You are not live' : tx('{name} is not live right now', { name })}
        body={own ? 'Share what you are doing: it stays live for 4 hours.' : 'When they go live in your circle, it shows here.'}
        cta={own ? { label: 'Go live', go: () => router.push('/live?compose=1' as never) } : undefined}
      />
    );
  const row = (l: (typeof lives.items)[number], isLive: boolean) => (
    <PressableScale key={l.id} haptic="select" scaleTo={0.98} onPress={isLive ? () => router.push('/live') : undefined} disabled={!isLive} style={[styles.post, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={styles.meta}>
        {isLive ? <View style={[styles.dot, { backgroundColor: t.c.live }]} /> : null}
        <Text variant="caption" tone={isLive ? 'live' : 'tertiary'}>
          {isLive ? tx('Live · {n} min left', { n: Math.max(1, Math.round((l.expiresAt - now) / 60000)) }) : cityWhen(l.at, cityId)}
        </Text>
        <Text variant="caption" tone="tertiary" raw>
          {' · '}
          {l.placeName ?? (cityId && cityId in CITIES ? areaName(CITIES[cityId as keyof typeof CITIES], l.areaId) : l.areaId)}
        </Text>
      </View>
      {l.media && pics[l.media] ? <Photo visual={{ photo: 'meeting', uri: pics[l.media] }} light="dubai" width={700} style={styles.livePhoto} /> : null}
      <Text variant="body" raw>
        {l.body}
      </Text>
    </PressableScale>
  );
  return (
    <View style={styles.list}>
      {live.length ? <Label text="Live now" /> : null}
      {live.map((l) => row(l, true))}
      {past.length ? <Label text="Past lives" hint="Only you see them" /> : null}
      {past.map((l) => row(l, false))}
    </View>
  );
}

function ActivitiesTab({ userId, own, name }: { userId: string; own: boolean; name: string }) {
  const t = useTheme();
  const tr = useT();
  const router = useRouter();
  const acts = useMemberActivities(userId);
  const [which, setWhich] = useState<'created' | 'joined'>('created');
  const covers = useSignedLinks('activity-photos', acts.items.map((a) => a.cover));
  if (acts.loading) return <Loading />;
  if (acts.error) return <Failed message={acts.error} onRetry={acts.reload} />;
  const list = acts.items.filter((a) => a.role === which);
  const created = acts.items.filter((a) => a.role === 'created').length;
  const joined = acts.items.length - created;
  return (
    <View style={styles.list}>
      <Segmented
        options={[
          { value: 'created', label: `${tr('Created')} · ${created}` },
          { value: 'joined', label: `${tr('Joined')} · ${joined}` },
        ]}
        value={which}
        onChange={(v) => setWhich(v as 'created' | 'joined')}
      />
      {!list.length ? (
        <Empty
          icon="calendar"
          title={which === 'created' ? (own ? 'You have not organised anything yet' : tx('{name} has not organised anything yet', { name })) : own ? 'You have not joined an activity yet' : tx('{name} has not joined an activity you can see', { name })}
          body={which === 'created' ? 'A run, a brunch, a padel game: plans you host show here.' : 'Plans you are going to show here.'}
          cta={own ? { label: which === 'created' ? 'Plan something' : 'Find a plan', go: () => router.push(which === 'created' ? '/social' : '/discover') } : undefined}
        />
      ) : (
        list.map((a) => <ActivityRow key={a.id} a={a} cover={a.cover ? covers[a.cover] : undefined} onPress={() => router.push(`/a/${a.id}`)} border={t.c.line} />)
      )}
    </View>
  );
}

function ActivityRow({ a, cover, onPress, border }: { a: ProfileActivity; cover?: string; onPress: () => void; border: string }) {
  const t = useTheme();
  const city = CITIES[a.cityId as keyof typeof CITIES];
  const badge: Record<ProfileActivity['state'], { label: string; color: string }> = {
    upcoming: { label: 'Upcoming', color: t.c.text },
    live: { label: 'Happening now', color: t.c.live },
    past: { label: 'Ended', color: t.c.textTertiary },
    cancelled: { label: 'Cancelled', color: t.c.critical },
  };
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={[styles.row, { borderColor: border }]} accessibilityLabel={`${a.title}, ${tx(badge[a.state].label)}`}>
      <View style={[styles.thumb, { backgroundColor: t.c.overlay }]}>
        {cover ? <Photo visual={{ photo: 'meeting', uri: cover }} light="dubai" width={160} style={StyleSheet.absoluteFill} /> : <Icon name="calendar" size={18} color={t.c.textSecondary} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" numberOfLines={1} raw>
          {a.title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1} raw>
          {cityWhen(a.startsAt, a.cityId)} · {a.placeName ?? (city ? areaName(city, a.areaId) : a.areaId)}
        </Text>
        <Text variant="caption" color={badge[a.state].color}>
          {tx(badge[a.state].label)} · {tx('{n} going', { n: a.going })}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
}

function CommunitiesTab({ list, own, name }: { list: MemberCommunity[]; own: boolean; name: string }) {
  const t = useTheme();
  const router = useRouter();
  const covers = useSignedLinks('activity-photos', list.map((c) => c.cover));
  if (!list.length)
    return (
      <Empty
        icon="heartHandshake"
        title={own ? 'No community yet' : tx('{name} is not in a community you can see', { name })}
        body="Communities bring together people who like the same things, in your city."
        cta={own ? { label: 'Explore communities', go: () => router.push('/communities') } : undefined}
      />
    );
  const created = list.filter((c) => c.role === 'created');
  const joined = list.filter((c) => c.role === 'joined');
  const card = (c: MemberCommunity) => (
    <PressableScale key={c.id} haptic="select" scaleTo={0.98} onPress={() => router.push(`/c/${c.id}`)} style={[styles.row, { borderColor: t.c.line }]} accessibilityLabel={c.name}>
      <View style={[styles.thumb, { backgroundColor: t.c.overlay }]}>
        {c.cover && covers[c.cover] ? <Photo visual={{ photo: 'meeting', uri: covers[c.cover] }} light="dubai" width={160} style={StyleSheet.absoluteFill} /> : <Icon name="heartHandshake" size={18} color={t.c.textSecondary} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" numberOfLines={1} raw>
          {c.name}
        </Text>
        {c.tagline ? (
          <Text variant="caption" tone="secondary" numberOfLines={1} raw>
            {c.tagline}
          </Text>
        ) : null}
        <Text variant="caption" tone="tertiary">
          {tx('{n} members', { n: c.members })}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={t.c.textTertiary} />
    </PressableScale>
  );
  return (
    <View style={styles.list}>
      {created.length ? <Label text="Created" /> : null}
      {created.map(card)}
      {joined.length ? <Label text="Joined" /> : null}
      {joined.map(card)}
    </View>
  );
}

/* ───────── Small parts ───────── */

function Count({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  return (
    <PressableScale haptic={onPress ? 'select' : false} disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : 'text'} accessibilityLabel={`${n} ${tx(label)}`} style={styles.count}>
      {/* A new count fades in: the number on screen is always the server's. */}
      <Animated.View key={n} entering={FadeIn.duration(220)}>
        <Text variant="titleL" align="center">
          {n}
        </Text>
      </Animated.View>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </PressableScale>
  );
}

function MenuRow({ icon, label, onPress, danger }: { icon: IconName; label: string; onPress: () => void; danger?: boolean }) {
  const t = useTheme();
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onPress} style={styles.menuRow} accessibilityRole="button" accessibilityLabel={tx(label)}>
      <Icon name={icon} size={18} color={danger ? t.c.critical : t.c.text} />
      <Text variant="titleS" color={danger ? t.c.critical : undefined}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Label({ text, hint }: { text: string; hint?: string }) {
  return (
    <View style={styles.label}>
      <Text variant="overline" tone="tertiary">
        {text}
      </Text>
      {hint ? (
        <Text variant="caption" tone="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

function Loading() {
  const t = useTheme();
  return <ActivityIndicator color={t.c.textSecondary} style={{ marginTop: space[6] }} />;
}

function Failed({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.empty}>
      <Text variant="body" tone="secondary" align="center">
        {message}
      </Text>
      <Button label="Try again" size="sm" variant="secondary" onPress={onRetry} />
    </View>
  );
}

function Empty({ icon, title, body, cta }: { icon: IconName; title: string; body: string; cta?: { label: string; go: () => void } }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.c.overlay }]}>
        <Icon name={icon} size={20} color={t.c.textSecondary} />
      </View>
      <Text variant="titleS" align="center">
        {title}
      </Text>
      <Text variant="bodyS" tone="secondary" align="center">
        {body}
      </Text>
      {cta ? <Button label={cta.label} size="sm" variant="secondary" onPress={cta.go} /> : null}
    </View>
  );
}

function Centered({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, styles.centered, { backgroundColor: t.c.bg }]}>
      {children}
      {onBack ? (
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          <IconButton icon="arrowLeft" label="Back" onPress={onBack} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: space.gutter },
  cover: { overflow: 'hidden' },
  identity: { alignItems: 'center', gap: 10, marginTop: -52, paddingHorizontal: space.gutter },
  ring: { borderWidth: 4, borderRadius: 56 },
  chooseHandle: { paddingVertical: 2, paddingHorizontal: 8 },
  bio: { maxWidth: 520, marginTop: 2 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  counts: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', justifyContent: 'space-around', marginTop: 6, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth * 2, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  count: { alignItems: 'center', minWidth: 80, paddingVertical: 2 },
  sep: { width: StyleSheet.hairlineWidth * 2, height: 28 },
  link: { alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 12 },
  buttons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 4 },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', paddingHorizontal: space.gutter, marginTop: space[4] },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth * 2 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'center', margin: space.gutter, marginTop: space[6], padding: 14, borderRadius: radius.lg },
  tabs: { paddingHorizontal: space.gutter, marginTop: space[6], marginBottom: space[3] },
  list: { paddingHorizontal: space.gutter, gap: 10 },
  post: { gap: 8, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  livePhoto: { height: 200, borderRadius: radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  thumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  label: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 },
  empty: { alignItems: 'center', gap: 8, paddingHorizontal: space.gutter * 1.5, paddingVertical: space[6] },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 54 },
  topBar: { position: 'absolute', left: space.gutter, right: space.gutter, flexDirection: 'row', justifyContent: 'space-between' },
});
