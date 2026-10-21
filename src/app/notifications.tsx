import { useRouter } from 'expo-router';
import { useAuthStatus } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/ui/Toast';
import { proConnect } from '@/features/network/api';
import { setFriend } from '@/features/profile/member';
import { markNotificationsRead, removeFriend, useFriends, useServerNotifications, type ServerNotification } from '@/features/server/social';
import { useOnline } from '@/features/server/sync';
import { destinationOf, openNotification } from '@/features/notifications/open';
import { useSeen, useSplit, useViewport, type Viewport } from '@/features/notifications/seen';
import { timeAgo } from '@/lib/time';
import { FEATURES } from '@/lib/features';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, type IconName } from '@/components/ui/Icon';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Text } from '@/components/ui/Text';
import { findPerson, getCityContent } from '@/data/repo';
import { DEMO } from '@/config/app';
import { demoNotifications, demoPhoto, EXAMPLE_UNREAD, markDemoRead, useDemoRead } from '@/features/girl/demo';
import { openHero } from '@/features/hero/heroStore';
import { enter } from '@/motion/enter';
import { PressableScale } from '@/motion/PressableScale';
import { useCityId } from '@/state/store';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { SpaceFlavor } from '@/theme/space';
import { GirlHeaderMark } from '@/features/girl/GirlMark';
import { useNow } from '@/lib/useNow';
import { displayCommunityName } from '@/features/community/name';

type Item = { id: string; icon: IconName; title: string; body: string; ago: string; personId?: string; onPress?: () => void; unread?: boolean };

/**
 * Notifications: few and useful. Someone joined your session, a session
 * starts near you, someone is live nearby, a reminder. No likes spam.
 *
 * Read means seen: a notification that has really been on screen (see
 * features/notifications/seen), or opened, is read here, in the bell and on
 * the member's other phones. Unread ones come first under "New"; the rest stay
 * listed under "Earlier" (nothing is deleted).
 */
export default function NotificationsRoute() {
  // Opened from IRLY Girl, the list wears the Girl look (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <Notifications />
    </SpaceFlavor>
  );
}

function Notifications() {
  const t = useTheme();
  const router = useRouter();
  const content = getCityContent(useCityId());
  const [a, b, c] = content.people;
  const s = content.sessions[0];
  const e = content.events[0];
  const viewport = useViewport();
  // Examples of what IRLY sends, only before sign-in (never mixed with real ones).
  const auth = useAuthStatus();
  const items: Item[] = auth !== 'out' ? [] : [
    a && s ? { id: 'n1', icon: 'users', title: tx('{name} joined {what}', { name: a.name, what: tx(s.title) }), body: tx('7 people are going now'), ago: '4 min', personId: a.id, onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    b ? { id: 'n2', icon: 'zap', title: tx('{name} is live nearby', { name: b.name }), body: tx('Coffee and laptop, anyone around?'), ago: '12 min', personId: b.id, onPress: () => router.push('/live') } : null,
    s ? { id: 'n3', icon: 'pin', title: tx('New session near you'), body: tx(s.title), ago: '1 h', onPress: () => openHero({ kind: 'session', id: s.id }) } : null,
    c ? { id: 'n4', icon: 'handshake', title: tx('{name} accepted your connection', { name: c.name }), body: tx('Say hi in Messages'), ago: '3 h', personId: c.id, onPress: () => router.push('/messages') } : null,
    e ? { id: 'n5', icon: 'calendar', title: tx('Tomorrow'), body: tx(e.title), ago: '5 h', onPress: () => openHero({ kind: 'event', id: e.id }) } : null,
  ].filter(Boolean) as Item[];
  // The demonstration build adds its IRLY Girl examples (likes, replies, invitations), first.
  const KIND_ICON: Record<string, IconName> = { like: 'heart', comment: 'message', reply: 'message', invite: 'calendar', joined: 'users', follow: 'user', message: 'message' };
  const girlItems: Item[] =
    DEMO && auth === 'out'
      ? demoNotifications().map((g) => ({
          id: g.id,
          icon: KIND_ICON[g.kind] ?? 'bell',
          title: `${g.name} ${tx(g.text)}`,
          body: 'IRLY Girl',
          ago: timeAgo(g.ago),
          personId: g.by,
          unread: g.unread,
          onPress: () => router.push((g.target.startsWith('/') ? g.target : `/comments?type=community_post&id=${g.target}`) as never),
        }))
      : [];
  items.unshift(...girlItems);
  // The examples are read like real ones (seen or opened), in this tab's memory only.
  const read = useDemoRead((st) => st.ids);
  const local = items.map((n) => ({ ...n, unread: (n.unread || EXAMPLE_UNREAD.includes(n.id)) && !read[n.id] }));

  return (
    <Page title="Notifications" subtitle="Only what helps you meet people." right={t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : undefined} onScrolled={viewport.moved}>
      {/* The demo has no server: only its examples, no loading line. */}
      {DEMO ? null : <ServerNotifications viewport={viewport} />}
      {auth === 'out' && !items.length ? (
        <View style={[styles.list, { alignItems: 'center', gap: 12, paddingTop: space[6] }]}>
          <Icon name="bell" size={26} color={t.c.textSecondary} />
          <Text variant="body" tone="secondary" align="center">
            Sign in to get notified when someone joins your plans, writes to you or wants to connect.
          </Text>
          <Button label="Sign in" icon="user" onPress={() => router.push('/account')} />
        </View>
      ) : null}
      {local.length ? <LocalNotifications items={local} viewport={viewport} /> : null}
    </Page>
  );
}

/** The examples (signed out, and the demo build): same rows, same reading rules, nothing sent. */
function LocalNotifications({ items, viewport }: { items: Item[]; viewport: Viewport }) {
  const t = useTheme();
  const content = getCityContent(useCityId());
  const { fresh, earlier } = useSplit(items, (n) => Boolean(n.unread));
  const seenRef = useSeen(
    items.filter((n) => n.unread).map((n) => n.id),
    viewport,
    markDemoRead,
  );
  // One tap at a time: a second one while the first page opens is ignored.
  const opening = useRef(false);
  const open = (n: Item) => {
    if (opening.current) return;
    opening.current = true;
    setTimeout(() => {
      opening.current = false;
    }, 700);
    markDemoRead([n.id]);
    n.onPress?.();
  };
  const row = (n: Item, i: number) => {
    const p = n.personId ? (content.people.find((x) => x.id === n.personId) ?? findPerson(n.personId)) : undefined;
    return (
      <Animated.View key={n.id} entering={enter.rise(Math.min(i, 8), 60)}>
        <View ref={seenRef(n.id)} collapsable={false}>
          <PressableScale onPress={() => open(n)} haptic="select" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={n.unread ? tx('{title}, unread', { title: n.title }) : n.title} style={[styles.row, { overflow: 'hidden', boxShadow: n.unread ? t.shadow.card : undefined }]}>
            {n.unread ? <GlassLayer radius={radius.lg} /> : null}
            {p ? (
              <Avatar name={p.name} hue={p.hue} size={44} photo={p.photo ?? demoPhoto(p.id)} />
            ) : (
              <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
                <Icon name={n.icon} size={18} color={t.c.text} />
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={2}>
                {n.title}
              </Text>
              <Text variant="bodyS" tone="secondary" numberOfLines={1}>
                {n.body}
              </Text>
            </View>
            <Text variant="caption" tone="tertiary">
              {n.ago}
            </Text>
          </PressableScale>
        </View>
      </Animated.View>
    );
  };
  return <Sections fresh={fresh} earlier={earlier} row={row} />;
}

/** "New notifications" first, then "Earlier" (headings only when there are both). */
function Sections<T>({ fresh, earlier, row, top }: { fresh: T[]; earlier: T[]; row: (n: T, i: number) => ReactNode; top?: ReactNode }) {
  const both = fresh.length > 0 && earlier.length > 0;
  return (
    <View style={[styles.list, { marginBottom: space[6] }]}>
      {top}
      {[
        { key: 'new', title: 'New notifications', list: fresh, from: 0 },
        { key: 'earlier', title: 'Earlier', list: earlier, from: fresh.length },
      ].map((sec) =>
        sec.list.length ? (
          <Fragment key={sec.key}>
            {both ? (
              <Text variant="overline" tone="tertiary" accessibilityRole="header" style={styles.heading}>
                {sec.title}
              </Text>
            ) : null}
            {sec.list.map((n, i) => row(n, sec.from + i))}
          </Fragment>
        ) : null,
      )}
    </View>
  );
}

const ago = (ms: number) => timeAgo(Math.max(1, (Date.now() - ms) / 60000));

/** First names of the people behind notifications (followers, commenters…), not only friends. */
function useNames(ids: string[]) {
  const [names, setNames] = useState<Record<string, string>>({});
  const key = [...new Set(ids)].sort().join(',');
  useEffect(() => {
    const want = key ? key.split(',') : [];
    if (!supabase || !want.length) return;
    let alive = true;
    supabase
      .from('profiles_public')
      .select('id, first_name')
      .in('id', want)
      .then(({ data }) => {
        if (!alive || !data) return;
        setNames((prev) => ({ ...prev, ...Object.fromEntries((data as { id: string; first_name: string }[]).map((r) => [r.id, r.first_name])) }));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return names;
}

/** Signed in: real notifications from the server, live, read when seen or opened. */
function ServerNotifications({ viewport }: { viewport: Viewport }) {
  const t = useTheme();
  const { items, markAllRead, status, reload } = useServerNotifications();
  const { friends, refresh } = useFriends();
  const now = useNow();
  const online = useOnline();
  const names = useNames(items.map((n) => (typeof n.payload?.from === 'string' ? n.payload.from : '')).filter((x) => /^[0-9a-f-]{36}$/.test(x)));
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n.id);
  const { fresh, earlier } = useSplit(items, (n) => !n.readAt);
  // Seen on screen: read (at once here and in the bell, then on the server). If the server cannot
  // be reached they show unread again, with one message, and seeing waits a little before trying again.
  const waitUntil = useRef(0);
  const seenRef = useSeen(unreadIds, viewport, (ids) => {
    if (!online || Date.now() < waitUntil.current) return;
    void markNotificationsRead(ids).then((ok) => {
      if (ok || Date.now() < waitUntil.current) return;
      waitUntil.current = Date.now() + 15_000;
      toast('Could not mark these notifications as read. Check your connection.', 'x', 'live');
    });
  });
  const [markingAll, setMarkingAll] = useState(false);
  const readAll = () => {
    if (markingAll) return;
    setMarkingAll(true);
    void markAllRead()
      .then((ok) => {
        if (!ok) toast('Could not mark everything as read. Check your connection.', 'x', 'live');
      })
      .finally(() => setMarkingAll(false));
  };
  // Accept / Decline on a request: one answer at a time per row, a second tap while it runs is ignored.
  const answering = useRef(new Set<string>());
  const [answer, setAnswer] = useState<Record<string, 'accept' | 'decline'>>({});
  const respond = (id: string, which: 'accept' | 'decline', run: () => Promise<unknown>) => {
    if (answering.current.has(id)) return;
    answering.current.add(id);
    setAnswer((a) => ({ ...a, [id]: which }));
    void run().finally(() => {
      answering.current.delete(id);
      setAnswer((a) => {
        const next = { ...a };
        delete next[id];
        return next;
      });
    });
  };
  if (!items.length && status === 'loading') {
    return (
      <View style={[styles.list, { alignItems: 'center', paddingTop: space[6] }]}>
        <ActivityIndicator color={t.c.textSecondary} />
      </View>
    );
  }
  if (!items.length && status === 'failed') {
    return (
      <View style={[styles.list, { alignItems: 'center', gap: 10, paddingTop: space[6] }]}>
        <Text variant="body" tone="secondary" align="center">
          Can’t reach IRLY right now
        </Text>
        <Button label="Try again" size="sm" variant="secondary" onPress={reload} />
      </View>
    );
  }
  if (!items.length) {
    return (
      <View style={[styles.list, { alignItems: 'center', gap: 10, paddingTop: space[6] }]}>
        <Icon name="bell" size={26} color={t.c.textSecondary} />
        <Text variant="body" tone="secondary" align="center">
          Nothing new yet. Join a plan or connect with someone and it shows up here.
        </Text>
      </View>
    );
  }
  const name = (id?: string) => friends.find((f) => f.userId === id)?.firstName ?? (id ? names[id] : undefined) ?? 'Someone';
  // What a row says. Where it leads is features/notifications/open (the same for a phone notification).
  const describe = (n: ServerNotification): { icon: IconName; title: string; body: string; accept?: string; pro?: boolean } => {
    const p = n.payload;
    switch (n.kind) {
      case 'MATCH_CREATED':
        return { icon: 'sparkles', title: "It's an IRLY match", body: 'Say hello and find something to do' };
      case 'MATCH_REMOVED':
        return { icon: 'x', title: 'A match ended', body: 'The private chat is closed' };
      case 'MESSAGE_CREATED':
        return { icon: 'message', title: 'New message', body: 'Tap to open the conversation' };
      case 'ACTIVITY_JOINED':
        return { icon: 'users', title: 'Someone joined your activity', body: 'Their name is in the activity chat' };
      case 'ACTIVITY_REMINDER':
        return { icon: 'clock', title: p.title ? tx('{title} starts soon', { title: p.title }) : 'Your activity starts soon', body: 'Open the activity' };
      case 'ACTIVITY_INVITATION':
        return { icon: 'calendar', title: tx('{name} invited you', { name: name(p.from) }), body: p.title ?? 'Open the activity' };
      case 'ACTIVITY_UPDATED':
        // Deleted by its organiser: nothing left to open.
        if (p.change === 'deleted') return { icon: 'x', title: tx('{title} was deleted', { title: p.title ?? '' }), body: 'It\'s been removed from your calendar' };
        return {
          icon: p.cancelled ? 'x' : 'clock',
          title: p.cancelled ? tx('{title} was cancelled', { title: p.title ?? '' }) : tx('{title} changed', { title: p.title ?? '' }),
          body: p.cancelled ? 'It\'s been removed from your calendar' : 'New time or place: check the details',
        };
      case 'LIKE':
      case 'COMMENT':
      case 'COMMENT_REPLY':
      case 'MENTION': {
        const who = name(p.from);
        const title =
          n.kind === 'LIKE'
            ? tx('{name} liked your post', { name: who })
            : n.kind === 'COMMENT'
              ? tx('{name} commented', { name: who })
              : n.kind === 'COMMENT_REPLY'
                ? tx('{name} replied to you', { name: who })
                : tx('{name} mentioned you', { name: who });
        return { icon: n.kind === 'LIKE' ? 'heart' : 'message', title, body: p.body ?? '' };
      }
      case 'FRIEND_REQUEST': {
        const pending = friends.find((f) => f.userId === p.from && f.incoming);
        return {
          icon: 'user',
          title: tx('{name} wants to be friends', { name: name(p.from) }),
          body: pending ? 'Accept to chat and see each other’s IRL posts' : friends.some((f) => f.userId === p.from && f.status === 'accepted') ? 'You are now friends' : 'See their profile',
          accept: pending ? p.from : undefined,
        };
      }
      case 'PRO_CONNECT_REQUEST': {
        const pending = friends.find((f) => f.userId === p.from && f.incoming);
        return {
          icon: 'network',
          title: tx('{name} wants to connect', { name: name(p.from) }),
          body: 'Networking · see their professional profile',
          accept: pending ? p.from : undefined,
          pro: true,
        };
      }
      case 'PRO_CONNECT_ACCEPTED':
        return { icon: 'handshake', title: tx('{name} accepted your request', { name: name(p.from) }), body: 'Networking · say hi' };
      case 'NEW_FOLLOWER':
        return { icon: 'userPlus', title: tx('{name} started following you', { name: name(p.from) }), body: 'See their profile' };
      case 'GROUP_ADDED':
        return { icon: 'users', title: tx('{name} added you to {title}', { name: name(p.from), title: String(p.title ?? '') }), body: 'Open the group chat' };
      case 'FRIEND_ACCEPTED':
        return { icon: 'check', title: tx('{name} accepted', { name: name(p.from) }), body: 'You are now friends: say hi' };
      case 'COMMUNITY_JOINED':
        return { icon: 'heartHandshake', title: 'You joined a community', body: 'Its chat is in Messages' };
      case 'COMMUNITY_INVITATION':
        return { icon: 'heartHandshake', title: tx('{name} invited you to {community}', { name: name(p.from), community: p.community ? displayCommunityName({ name: String(p.community) }) : 'IRLY' }), body: 'Open the community' };
      case 'COMMUNITY_ANNOUNCEMENT':
        return { icon: 'megaphone', title: tx('Announcement · {name}', { name: p.community ? displayCommunityName({ name: String(p.community) }) : 'IRLY' }), body: p.body ?? '' };
      case 'COMMUNITY_POST':
        return { icon: 'message', title: tx('{name} posted in {community}', { name: name(p.from), community: p.community ? displayCommunityName({ name: String(p.community) }) : '' }), body: p.body ?? '' };
      case 'IRLY_POST_CREATED':
        // A Live lasts 4 hours (a deleted one takes its notice with it): an ended one neither quotes nor opens it.
        if (!destinationOf(n, now)) return { icon: 'zap', title: tx('{name} was live', { name: name(p.from) }), body: tx('This Live has ended') };
        return { icon: 'zap', title: tx('{name} is live', { name: name(p.from) }), body: p.body ?? 'See what they are doing' };
      case 'PROFILE_UPDATED':
        if (p.type === 'friend_request') {
          const pending = friends.find((f) => f.userId === p.from && f.incoming);
          return { icon: 'user', title: tx('{name} wants to be friends', { name: name(p.from) }), body: 'Friends see each other’s IRL posts', accept: pending ? p.from : undefined };
        }
        if (p.type === 'friend_accepted') return { icon: 'check', title: tx('{name} accepted', { name: name(p.from) }), body: 'You are now friends' };
        if (p.type === 'verified') return { icon: 'shield', title: 'Your profile is verified ✓', body: FEATURES.matchIrly ? 'Match is open' : 'The badge shows on your profile' };
        if (p.type === 'verification_rejected') return { icon: 'x', title: 'Verification declined', body: p.reason ? tx('Reason: {reason}. You can try again.', { reason: p.reason }) : 'You can try again' };
        return { icon: 'user', title: 'Profile update', body: '' };
      default:
        return { icon: 'bell', title: 'IRLY', body: '' };
    }
  };
  const row = (n: ServerNotification, i: number) => {
    const d = describe(n);
    // Nothing to open (a match ended, a deleted plan): a tap only marks it read.
    const opens = destinationOf(n, now) !== null;
    return (
      <Animated.View key={n.id} entering={enter.rise(Math.min(i, 8), 60)}>
        <View ref={seenRef(n.id)} collapsable={false}>
          <PressableScale
            onPress={() => (opens ? void openNotification(n, 'list') : void markNotificationsRead([n.id]))}
            haptic="select"
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={n.readAt ? d.title : tx('{title}, unread', { title: d.title })}
            style={[styles.row, { overflow: 'hidden', boxShadow: n.readAt ? undefined : t.shadow.card }]}
          >
            {n.readAt ? null : <GlassLayer radius={radius.lg} />}
            <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
              <Icon name={d.icon} size={18} color={t.c.text} />
              {n.readAt ? null : <View testID="unread-dot" style={[styles.dot, { backgroundColor: t.c.brand, borderColor: t.c.bg }]} />}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="label" numberOfLines={2}>
                {d.title}
              </Text>
              {d.body ? (
                <Text variant="bodyS" tone="secondary" numberOfLines={1} raw>
                  {d.body}
                </Text>
              ) : null}
            </View>
            {d.accept ? (
              <View style={styles.actions}>
                <Button
                  label="Decline"
                  size="sm"
                  variant="secondary"
                  loading={answer[n.id] === 'decline'}
                  disabled={Boolean(answer[n.id])}
                  onPress={() =>
                    respond(n.id, 'decline', () =>
                      (d.pro ? removeFriend(d.accept!) : setFriend(d.accept!, 'remove'))
                        .then(() => toast('Request declined', 'check', 'brand'))
                        .catch((e) => toast(e instanceof Error ? e.message : 'Could not decline', 'x', 'live')),
                    )
                  }
                />
                <Button
                label="Accept"
                size="sm"
                loading={answer[n.id] === 'accept'}
                disabled={Boolean(answer[n.id])}
                onPress={() =>
                  respond(n.id, 'accept', () =>
                    (d.pro ? proConnect(d.accept!).then((s) => s === 'accepted') : setFriend(d.accept!, 'add').then((s) => s === 'friends'))
                      .then((accepted) => {
                        // The request may have been withdrawn meanwhile: then this only sent yours.
                        if (accepted) toast(d.pro ? 'You are now connected' : 'You are now friends', 'check', 'positive');
                        else toast('Request sent', 'check', 'brand');
                        refresh();
                      })
                      .catch((e) => toast(e instanceof Error ? e.message : 'Could not accept', 'x', 'live')),
                  )
                }
              />
              </View>
            ) : (
              <Text variant="caption" tone="tertiary">
                {ago(n.createdAt)}
              </Text>
            )}
          </PressableScale>
        </View>
      </Animated.View>
    );
  };
  return (
    <Sections
      fresh={fresh}
      earlier={earlier}
      row={row}
      top={
        unreadIds.length ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Button label="Mark all as read" size="sm" variant="ghost" icon="check" loading={markingAll} onPress={readAll} />
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 6 },
  list: { paddingHorizontal: space.gutter, gap: 8 },
  heading: { marginTop: 6, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 0, right: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
});
