import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

/**
 * Product analytics. Event names are UPPER_SNAKE (APP_OPEN, ACTIVITY_JOIN...)
 * and props carry ids and categories only: never message text, emails,
 * exact locations or anything about faith or gender.
 *
 * Fire and forget, batched every few seconds; failures are dropped.
 */

type Props = Record<string, string | number | boolean | null | undefined>;
type Queued = { name: string; props: Props; at: string; uid: string | null };

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
const BLOCKED = /email|phone|body|text|message|lat|lng|faith|gender|name/i;

// Who is signed in when the event happens, not when the batch is sent.
let currentUid: string | null = null;
supabase?.auth.getSession().then(({ data }) => (currentUid = data.session?.user.id ?? null));
supabase?.auth.onAuthStateChange((_e, session) => (currentUid = session?.user.id ?? null));

export function track(name: string, props: Props = {}): void {
  if (!/^[A-Z][A-Z_]{2,39}$/.test(name)) return;
  const clean: Props = {};
  for (const [k, v] of Object.entries(props)) if (!BLOCKED.test(k) && v !== undefined) clean[k] = typeof v === 'string' ? v.slice(0, 80) : v;
  queue.push({ name, props: clean, at: new Date().toISOString(), uid: currentUid });
  if (!timer) timer = setTimeout(flush, 4000);
}

async function flush() {
  timer = null;
  if (!supabase || !queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    const rows = batch.map((e) => ({ user_id: e.uid, name: e.name, props: e.props, platform: PLATFORM, created_at: e.at }));
    const { error } = await supabase.from('analytics_events').insert(rows);
    // A member without a profile row yet fails the user_id foreign key: keep the events, anonymously.
    if (error && (error.code === '23503' || error.code === '42501')) await supabase.from('analytics_events').insert(rows.map((r) => ({ ...r, user_id: null })));
  } catch {
    // Analytics never gets in the way.
  }
  if (queue.length) timer = setTimeout(flush, 4000);
}
