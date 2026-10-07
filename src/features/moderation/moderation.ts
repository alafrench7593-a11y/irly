import { useCallback, useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { NONE } from '@/lib/none';
import { supabase } from '@/lib/supabase';
import type { ReportCategory } from '@/features/server/engage';

/**
 * Reporting and blocking on the server. A report goes to IRLY's moderation
 * queue (only moderators read it). Blocking hides both people from each
 * other everywhere, ends a connection or request, stops messages and
 * removes them from recommendations (enforced in the database).
 */

export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'harassment', label: 'Harassment' },
  { id: 'hate_speech', label: 'Hate speech' },
  { id: 'spam', label: 'Spam' },
  { id: 'scam', label: 'Scam' },
  { id: 'fake_profile', label: 'Fake profile' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'threats', label: 'Threats' },
  { id: 'other', label: 'Other' },
];

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
  /slow down|too many/i.test(m) ? 'You sent many reports in a short time. Try again later.' : /cannot report yourself/i.test(m) ? 'You cannot report yourself' : /not found/i.test(m) ? 'This is no longer available' : m;

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
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await need().rpc('unblock_user', { p_target: userId });
  if (error) throw new Error(error.message);
}

export type Blocked = { userId: string; firstName: string; at: number };

/** The people you blocked (Settings → Blocked members). */
export function useBlocked() {
  const uid = useAccount()?.userId;
  const [res, setRes] = useState<{ for: string; list: Blocked[]; error: string | null }>({ for: '', list: [], error: null });
  const [v, setV] = useState(0);
  const current = `${uid}|${v}`;
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase
      .rpc('my_blocks')
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setRes((r) => ({ ...r, for: current, error: error.message }));
        else
          setRes({
            for: current,
            error: null,
            list: ((data as { user_id: string; first_name: string; blocked_at: string }[]) ?? []).map((r) => ({ userId: r.user_id, firstName: r.first_name, at: Date.parse(r.blocked_at) })),
          });
      });
    return () => {
      alive = false;
    };
  }, [uid, current]);
  const refresh = useCallback(() => setV((x) => x + 1), []);
  const on = Boolean(uid && supabase);
  return { list: on ? res.list : NONE, loading: on && res.for !== current && !res.list.length, error: res.error, refresh };
}
