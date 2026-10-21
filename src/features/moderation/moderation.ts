import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
import { changed } from '@/features/server/sync';
import type { ReportCategory } from '@/features/server/engage';

/**
 * Reporting and blocking on the server. A report goes to IRLY's moderation
 * queue (only moderators read it). Blocking hides both people from each
 * other everywhere, ends a connection or request, stops messages and
 * removes them from recommendations (enforced in the database).
 */

export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'threats', label: 'Threats' },
  { id: 'hate_speech', label: 'Hate speech' },
  { id: 'sexual_content', label: 'Sexual content' },
  { id: 'fake_profile', label: 'Fake profile' },
  { id: 'impersonation', label: 'Impersonation' },
  { id: 'scam', label: 'Scam' },
  { id: 'spam', label: 'Spam' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'unsafe', label: 'Dangerous behaviour' },
  { id: 'other', label: 'Other' },
];

/** The reasons that fit what is reported (the server accepts any of them). */
const REASONS_FOR: Record<ReportTarget['kind'], ReportCategory[]> = {
  profile: ['harassment', 'threats', 'fake_profile', 'impersonation', 'sexual_content', 'hate_speech', 'scam', 'spam', 'unsafe', 'other'],
  message: ['harassment', 'threats', 'sexual_content', 'hate_speech', 'scam', 'spam', 'unsafe', 'other'],
  activity: ['unsafe', 'scam', 'spam', 'inappropriate', 'sexual_content', 'hate_speech', 'harassment', 'other'],
  community: ['inappropriate', 'hate_speech', 'sexual_content', 'impersonation', 'scam', 'spam', 'other'],
  irl_post: ['inappropriate', 'sexual_content', 'harassment', 'hate_speech', 'threats', 'spam', 'unsafe', 'other'],
  comment: ['harassment', 'threats', 'hate_speech', 'sexual_content', 'spam', 'scam', 'other'],
  community_post: ['inappropriate', 'sexual_content', 'harassment', 'hate_speech', 'threats', 'scam', 'spam', 'unsafe', 'other'],
};

export function reasonsFor(kind: ReportTarget['kind']): { id: ReportCategory; label: string }[] {
  const ids = REASONS_FOR[kind] ?? REPORT_CATEGORIES.map((c) => c.id);
  return ids.map((id) => REPORT_CATEGORIES.find((c) => c.id === id)).filter((c): c is { id: ReportCategory; label: string } => Boolean(c));
}

/** What is being reported. A message or profile is reported with its author. */
export type ReportTarget =
  | { kind: 'profile'; userId: string }
  | { kind: 'message'; id: string; userId?: string | null }
  | { kind: 'activity' | 'community' | 'irl_post' | 'comment' | 'community_post'; id: string; userId?: string | null };

function need() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

const plain = (m: string) =>
  /slow down|too many/i.test(m) ? "You've sent a lot of reports in a short time. Try again later." : /cannot report yourself/i.test(m) ? 'You cannot report yourself' : /not found/i.test(m) ? 'This is no longer available' : m;

export async function report(t: ReportTarget, category: ReportCategory, details?: string): Promise<void> {
  const { error } = await need().rpc('report', {
    p_kind: t.kind,
    p_target_user: t.kind === 'profile' ? t.userId : (t.userId ?? null),
    p_target_id: t.kind === 'profile' ? null : t.id,
    p_category: category,
    p_details: details?.trim() ? details.trim().slice(0, 1000) : null,
  });
  if (error) throw new Error(plain(error.message));
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await need().rpc('block_user', { p_target: userId });
  if (error) throw new Error(plain(error.message));
  forgetBlocked();
  changed('inbox', 'people', 'activities', 'communities');
  // Their live moments leave the feed now, not at the next live event.
  void import('@/features/server/social').then((m) => m.bumpIrl());
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await need().rpc('unblock_user', { p_target: userId });
  if (error) throw new Error(error.message);
  forgetBlocked();
  changed('inbox', 'people', 'activities', 'communities');
  void import('@/features/server/social').then((m) => m.bumpIrl());
}

export type Blocked = { userId: string; firstName: string; at: number };

/**
 * The list read last (this launch): every chat screen filters with it, so
 * opening chats one after another reuses it for a minute instead of asking
 * the server each time. Blocking or unblocking drops it; a refresh always asks.
 */
let blockedCache: { uid: string; list: Blocked[]; at: number } | null = null;
const BLOCKED_FRESH_MS = 60_000;
/**
 * Bumped each time the cache is dropped: a my_blocks read started before a
 * block/unblock must not write its older list back into the cache.
 */
let blockedGen = 0;
function forgetBlocked() {
  blockedCache = null;
  blockedGen += 1;
}

/** The people you blocked (Settings → Blocked members). */
export function useBlocked() {
  const uid = useAccount()?.userId;
  const [res, setRes] = useState<{ for: string; list: Blocked[]; error: string | null }>(() =>
    uid && blockedCache?.uid === uid ? { for: `${uid}|0`, list: blockedCache.list, error: null } : { for: '', list: [], error: null },
  );
  const [v, setV] = useState(0);
  const current = `${uid}|${v}`;
  useEffect(() => {
    if (!uid || !supabase) return;
    if (v === 0 && blockedCache?.uid === uid && Date.now() - blockedCache.at < BLOCKED_FRESH_MS && res.for === current) return;
    let alive = true;
    const gen = blockedGen;
    supabase
      .rpc('my_blocks')
      .then(({ data, error }) => {
        if (!alive) return;
        // Someone was blocked or unblocked while this read was in flight: its list is
        // older than that change, so it is neither cached nor shown; ask again.
        if (gen !== blockedGen) {
          setV((x) => x + 1);
          return;
        }
        if (error) setRes((r) => ({ ...r, for: current, error: error.message }));
        else {
          const list = ((data as { user_id: string; first_name: string; blocked_at: string }[]) ?? []).map((r) => ({ userId: r.user_id, firstName: r.first_name, at: Date.parse(r.blocked_at) }));
          blockedCache = { uid, list, at: Date.now() };
          setRes({ for: current, error: null, list });
        }
      });
    return () => {
      alive = false;
    };
    // res.for is only read to know the list came from the cache; it must not re-run the read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, current]);
  const refresh = useCallback(() => setV((x) => x + 1), []);
  const on = Boolean(uid && supabase);
  return { list: on ? res.list : NONE, loading: on && res.for !== current && !res.list.length, error: res.error, refresh };
}
