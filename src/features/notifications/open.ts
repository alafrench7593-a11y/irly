import { router } from 'expo-router';
import { toast } from '@/components/ui/Toast';
import { LIVE_TTL_MIN } from '@/features/live/liveStore';
import { markNotificationRead } from '@/features/server/social';
import { FEATURES } from '@/lib/features';
import { supabase } from '@/lib/supabase';

/**
 * Where a notification leads, and opening it: the same rules for a row of the
 * Notifications list and for a phone notification tapped (app open, in the
 * background or launched by it).
 *
 * Each kind opens its own page (a chat, an activity, a community, a profile,
 * a post's thread), never Home. A page that is gone or no longer yours to see
 * (deleted, ended, a blocked member) is checked first, under your own read
 * rules: you get "This is no longer available" and a page that makes sense
 * instead (the calendar for an activity, your chats for a chat…).
 */

export type NotificationLike = { id: string; kind: string; payload: Record<string, string>; createdAt: number };

/** What a page needs to exist for you (read with your own rights: RLS hides what you may not see). */
type Check =
  | { table: 'activities' | 'communities' | 'conversations' | 'profiles_public' | 'irl_posts'; id: string }
  | { table: 'community_posts'; id: string; live: true };

export type Destination = {
  href: string;
  /** Opened instead when the page is gone (none: stay where you are). */
  fallback?: string;
  check?: Check;
  /** A liked or answered comment: its thread is found first. */
  comment?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** A thread of comments: an activity's opens the activity, a post's opens its comments. */
function thread(type: string | undefined, id: string | undefined): Destination | null {
  if (!type || !id) return null;
  if (type === 'activity') return isId(id) ? { href: `/a/${id}`, fallback: '/calendar', check: { table: 'activities', id } } : null;
  if (type === 'comment') return isId(id) ? { href: '', comment: id } : null;
  const href = `/comments?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`;
  if (type === 'irl_post' && isId(id)) return { href, fallback: '/live', check: { table: 'irl_posts', id } };
  if (type === 'community_post' && isId(id)) return { href, check: { table: 'community_posts', id, live: true } };
  if (type === 'community' && isId(id)) return { href: `/c/${id}`, fallback: '/communities', check: { table: 'communities', id } };
  if (type === 'profile' && isId(id)) return { href: `/person/${id}`, check: { table: 'profiles_public', id } };
  return { href };
}

const person = (id: string | undefined): Destination | null => (isId(id) ? { href: `/person/${id}`, check: { table: 'profiles_public', id } } : null);
const chat = (id: string | undefined, fallback = '/messages'): Destination => (isId(id) ? { href: `/messages/${id}`, fallback, check: { table: 'conversations', id } } : { href: fallback });
const activity = (id: string | undefined): Destination => (isId(id) ? { href: `/a/${id}`, fallback: '/calendar', check: { table: 'activities', id } } : { href: '/calendar' });
const community = (id: string | undefined): Destination => (isId(id) ? { href: `/c/${id}`, fallback: '/communities', check: { table: 'communities', id } } : { href: '/communities' });

/** The page a notification opens, or null when it has said everything (a match ended, a deleted plan). */
export function destinationOf(n: NotificationLike, now = Date.now()): Destination | null {
  const p = n.payload ?? {};
  switch (n.kind) {
    case 'MATCH_CREATED':
      return isId(p.conversation_id) ? chat(p.conversation_id) : { href: FEATURES.matchIrly ? '/match' : '/messages' };
    case 'MESSAGE_CREATED':
    case 'GROUP_ADDED':
    case 'COMMUNITY_JOINED':
      return chat(p.conversation_id);
    case 'ACTIVITY_JOINED':
    case 'ACTIVITY_REMINDER':
    case 'ACTIVITY_INVITATION':
    case 'ACTIVITY_CREATED':
      return activity(p.activity_id);
    case 'ACTIVITY_UPDATED':
      // Deleted by its organiser: nothing left to open.
      return p.change === 'deleted' ? null : activity(p.activity_id);
    case 'LIKE':
    case 'COMMENT':
    case 'COMMENT_REPLY':
    case 'MENTION':
      return thread(p.target_type, p.target_id);
    case 'FRIEND_REQUEST':
    case 'FRIEND_ACCEPTED':
    case 'NEW_FOLLOWER':
      // A request is answered on the profile (Accept / Decline), as in the list.
      return person(p.from);
    case 'PRO_CONNECT_REQUEST':
    case 'PRO_CONNECT_ACCEPTED':
      return isId(p.from) ? { href: `/network/${p.from}`, fallback: '/network' } : { href: '/network' };
    case 'COMMUNITY_ANNOUNCEMENT':
    case 'COMMUNITY_POST':
    case 'COMMUNITY_INVITATION':
      return community(p.community_id);
    case 'IRLY_POST_CREATED':
      // A Live lasts 24 hours: an ended one has nothing to open.
      return now - n.createdAt >= LIVE_TTL_MIN * 60_000 ? null : { href: '/live' };
    case 'IRLY_NEWS':
      // The page itself asks the server whether this news item is still for you.
      return isId(p.news_id) ? { href: `/actu/${p.news_id}`, fallback: '/notifications' } : null;
    case 'PROFILE_UPDATED':
      if (p.type === 'friend_request' || p.type === 'friend_accepted') return person(p.from);
      if (p.type === 'verified') return { href: FEATURES.matchIrly ? '/match' : '/verify' };
      if (p.type === 'verification_rejected') return { href: '/verify' };
      return null;
    default:
      return null;
  }
}

type Found = 'yes' | 'gone' | 'unknown';

/** Does the page still exist for me? 'unknown' (offline, slow): the page is opened anyway and says so itself. */
async function exists(c: Check): Promise<Found> {
  if (!supabase) return 'yes';
  let q = supabase.from(c.table).select('id').eq('id', c.id);
  if ('live' in c) q = q.is('deleted_at', null);
  const read = q.maybeSingle().then(
    ({ data, error }) => (error ? 'unknown' : data ? 'yes' : 'gone') as Found,
    () => 'unknown' as Found,
  );
  const late = new Promise<Found>((resolve) => setTimeout(() => resolve('unknown'), 4000));
  return Promise.race([read, late]);
}

/** The thread a comment was written in. */
async function commentThread(id: string): Promise<Destination | 'gone' | 'unknown'> {
  if (!supabase) return 'unknown';
  const { data, error } = await supabase.from('comments').select('target_type, target_id').eq('id', id).is('deleted_at', null).maybeSingle();
  if (error) return 'unknown';
  if (!data) return 'gone';
  const d = thread(data.target_type, data.target_id);
  return d && !d.comment ? d : 'gone';
}

// One notification opens at a time: a second tap (or the same phone notification
// heard twice at launch) while the first one opens is ignored.
let opening = false;

/**
 * Opens a notification: marks it read (at once on screen, then on the server;
 * unread again with a message if that fails) and goes to its page, or to a
 * fallback with a message when that page is gone. `from: 'push'` falls back to
 * the Notifications list when there is no better page. Resolves when done.
 */
export async function openNotification(n: NotificationLike, from: 'list' | 'push'): Promise<void> {
  if (opening) return;
  opening = true;
  try {
    void markNotificationRead(n.id).then((ok) => {
      if (!ok) toast('Could not mark it as read. Check your connection.', 'x', 'live');
    });
    let d = destinationOf(n);
    if (d?.comment) {
      const t = await commentThread(d.comment);
      if (t === 'gone') return gone(from);
      if (t === 'unknown') {
        toast('Can’t reach IRLY right now', 'x', 'live');
        return from === 'push' ? go('/notifications') : undefined;
      }
      d = t;
    }
    if (!d) return from === 'push' ? go('/notifications') : undefined;
    if (d.check && (await exists(d.check)) === 'gone') return gone(from, d.fallback);
    go(d.href);
  } finally {
    // Kept a moment: the page being pushed has not taken the screen yet.
    setTimeout(() => {
      opening = false;
    }, 700);
  }
}

function go(href: string) {
  router.push(href as never);
}

function gone(from: 'list' | 'push', fallback?: string) {
  toast('This is no longer available', 'x', 'live');
  const to = fallback ?? (from === 'push' ? '/notifications' : undefined);
  if (to) go(to);
}
