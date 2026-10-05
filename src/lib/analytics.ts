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
type Queued = { name: string; props: Props; at: string };

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const PLATFORM = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
const BLOCKED = /email|phone|body|text|message|lat|lng|faith|gender|name/i;

export function track(name: string, props: Props = {}): void {
  if (!/^[A-Z][A-Z_]{2,39}$/.test(name)) return;
  const clean: Props = {};
  for (const [k, v] of Object.entries(props)) if (!BLOCKED.test(k) && v !== undefined) clean[k] = typeof v === 'string' ? v.slice(0, 80) : v;
  queue.push({ name, props: clean, at: new Date().toISOString() });
  if (!timer) timer = setTimeout(flush, 4000);
}

async function flush() {
  timer = null;
  if (!supabase || !queue.length) return;
  const batch = queue.splice(0, 50);
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    await supabase.from('analytics_events').insert(batch.map((e) => ({ user_id: uid, name: e.name, props: e.props, platform: PLATFORM, created_at: e.at })));
  } catch {
    // Analytics never gets in the way.
  }
  if (queue.length) timer = setTimeout(flush, 4000);
}
