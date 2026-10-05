import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
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
// The IRLY project. Both values are public (the anon key only grants what
// row level security allows); .env can override them for another project.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://yqutcmgslwxcmnsqmhvy.supabase.co';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';

export const supabase: SupabaseClient | null =
  url && anonKey.length > 20
    ? createClient(url, anonKey, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: Platform.OS === 'web', flowType: 'implicit' },
      })
    : null;

export const hasBackend = supabase !== null;

/** True when a member is signed in to the backend. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}
