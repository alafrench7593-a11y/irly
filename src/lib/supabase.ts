import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO } from '@/config/app';
import { t } from '@/i18n';
import { serverError } from '@/i18n/errors';
import { secureSessionStorage } from '@/lib/secureSession';

/**
 * The IRLY backend (Supabase: Postgres + auth + storage + realtime).
 * Configured with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (see .env.example). The anon key is public by design: every rule lives in
 * row level security and server functions (supabase/migrations).
 *
 * Without keys this is null and features fall back to on-device data, so
 * the app stays usable in development and demos.
 */
// The IRLY project. Both values are public (the anon key only grants what
// row level security allows); .env can override them for another project.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yqutcmgslwxcmnsqmhvy.supabase.co';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';

/**
 * No request may wait forever: a phone on a bad network can leave a request
 * hanging, and every button waiting on it spins without end. Reads and
 * actions give up after 20 s, file uploads after 3 min; the caller then shows
 * an error and lets the member try again.
 */
export class TimeoutError extends Error {
  constructor() {
    super('IRLY did not answer in time. Check your connection and try again.');
  }
}
/** A server or network error in words a member understands, in their language (see i18n/errors). */
export function friendlyError(message: string): string {
  const server = serverError(message);
  if (server) return t(server.text, server.vars);
  if (/did not answer|abort/i.test(message)) return 'IRLY did not answer in time. Check your connection and try again.';
  if (/fetch|network|Failed to fetch|Network request failed/i.test(message)) return 'No connection: try again';
  if (/JWT|token is expired|sign in required/i.test(message)) return 'Your session has ended. Sign in again';
  return message;
}
const timedFetch: typeof fetch = (input, init) => {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const limit = /\/storage\/v1\/object/.test(href) && init?.method && init.method !== 'GET' ? 180_000 : 20_000;
  const ctrl = new AbortController();
  const outer = init?.signal;
  if (outer) outer.addEventListener('abort', () => ctrl.abort(), { once: true });
  const timer = setTimeout(() => ctrl.abort(), limit);
  return fetch(input, { ...init, signal: ctrl.signal })
    .catch((e) => {
      if (ctrl.signal.aborted && !outer?.aborted) throw new TimeoutError();
      throw e;
    })
    .finally(() => clearTimeout(timer));
};

export const supabase: SupabaseClient | null =
  // The demo never talks to the server: nothing a visitor does is saved.
  !DEMO && url && anonKey.length > 20
    ? createClient(url, anonKey, {
        // Phones keep the session in the Keychain / Keystore; the web keeps it in the browser.
        auth: { storage: Platform.OS === 'web' ? AsyncStorage : secureSessionStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'implicit' },
        global: { fetch: timedFetch },
      })
    : null;

export const hasBackend = supabase !== null;

// Native: refresh the session only while the app is in the foreground, and
// right away when it comes back (Supabase's recommended pattern for React
// Native). Otherwise a long background leaves realtime with an expired token.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase?.auth.startAutoRefresh();
    else supabase?.auth.stopAutoRefresh();
  });
}

/** True when a member is signed in to the backend. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

let channelSeq = 0;
/**
 * A realtime topic unique to this subscription. supabase-js hands back the
 * existing channel when a topic is reused, and adding listeners to a joined
 * channel throws; two mounted screens (tabs stay mounted) or an effect
 * re-run while the old channel is still leaving would collide.
 */
export function topic(name: string) {
  channelSeq += 1;
  return `${name}#${channelSeq}`;
}

/**
 * A database-changes channel (unique topic, see topic()) whose SUBSCRIBED
 * means the server really listens: by default Realtime reports it as soon as
 * the channel has joined, before its postgres_changes subscription is active
 * (realtime-js `postgres_changes_options.wait`), and a change committed in
 * between is never sent.
 */
export function liveChannel(name: string) {
  return supabase!.channel(topic(name), { config: { postgres_changes_options: { wait: true } } });
}

/**
 * A subscribe() callback for a liveChannel: `catchUp` runs each time the
 * channel starts listening, the first time too. A change committed after the
 * screen's own first read was sent and before that moment is never sent to
 * it (and a reconnection leaves the same gap).
 */
export const whenListening = (catchUp: () => void) => (status: string) => {
  if (status === 'SUBSCRIBED') catchUp();
};

/**
 * Which sign-in providers are switched on in Supabase (Authentication →
 * Providers). Read from the public auth settings, so the app only offers
 * Apple / Google when they actually work.
 */
export async function enabledProviders(): Promise<{ apple: boolean; google: boolean; phone: boolean }> {
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
    const j = (await res.json()) as { external?: Record<string, boolean> };
    return { apple: Boolean(j.external?.apple), google: Boolean(j.external?.google), phone: Boolean(j.external?.phone) };
  } catch {
    // Settings unreachable: still offer Google (switched on for IRLY); Supabase answers if it is not.
    return { apple: false, google: true, phone: false };
  }
}
