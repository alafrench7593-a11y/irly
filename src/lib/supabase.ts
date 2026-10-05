import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The IRLY backend (Supabase: Postgres + auth + storage + realtime).
 * Configured with EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
 * (see .env.example). The anon key is public by design: every rule lives in
 * row level security and server functions (supabase/migrations).
 *
 * Without keys this is null and features fall back to on-device data, so
 * the app stays usable in development and demos.
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export const hasBackend = supabase !== null;

/** True when a member is signed in to the backend. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
