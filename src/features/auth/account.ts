import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useStore, type Profile } from '@/state/store';

/** Signup language names → ISO codes stored server-side. */
const LANG: Record<string, string> = { English: 'en', Français: 'fr', العربية: 'ar', हिन्दी: 'hi', Русский: 'ru', Español: 'es', Italiano: 'it', Deutsch: 'de', Bahasa: 'id', Filipino: 'tl', اردو: 'ur', Português: 'pt' };

export type Account = { userId: string; email?: string } | null;

/** The signed-in member, kept in sync with Supabase Auth. */
export function useAccount(): Account {
  const [account, setAccount] = useState<Account>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      setAccount(u ? { userId: u.id, email: u.email } : null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      setAccount(u ? { userId: u.id, email: u.email } : null);
      // Signed in from the email link: publish the signup profile once.
      if (event === 'SIGNED_IN' && u) syncProfile(u.id).catch(() => undefined);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return account;
}

/** Where the email link sends the member back: this web page, or the app. */
function redirectTo(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}/account`;
  return Linking.createURL('/account');
}

/**
 * Step 1: email a sign-in link (and a 6-digit code when the email template
 * includes one). Creates the account on first use.
 */
export async function sendCode(email: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { shouldCreateUser: true, emailRedirectTo: redirectTo() },
  });
  if (error) throw new Error(error.message);
}

/** Native: the email link opens irly://account#access_token=… ; finish sign-in. */
export async function completeFromUrl(url: string): Promise<boolean> {
  if (!supabase) return false;
  const hash = url.split('#')[1] ?? url.split('?')[1] ?? '';
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return false;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw new Error(error.message);
  return true;
}

/** Step 2: check the code, then publish the signup profile server-side. */
export async function verifyCode(email: string, code: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
  if (error) throw new Error(error.message);
  const uid = data.user?.id;
  if (uid) await syncProfile(uid);
}

/**
 * Writes the profile filled in at signup to `profiles`, once. Gender is
 * locked server-side after this first write (IRLY Girl access).
 */
export async function syncProfile(uid: string): Promise<void> {
  if (!supabase) return;
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (existing) return;
  const { profile, cityId } = useStore.getState();
  const row = toRow(uid, profile, cityId ?? 'dubai');
  const { error } = await supabase.from('profiles').insert(row);
  if (error) throw new Error(error.message);
}

function toRow(uid: string, p: Profile, cityId: string) {
  const age = p.age ?? 25;
  // Only the age was asked at signup: store 1 January of that birth year.
  const birthdate = `${new Date().getFullYear() - age}-01-01`;
  return {
    id: uid,
    first_name: (p.name || 'IRLY member').slice(0, 40),
    birthdate,
    gender: p.gender ?? 'other',
    city_id: cityId,
    country: p.country ?? null,
    languages: (p.languages ?? []).map((l) => LANG[l] ?? l),
    bio: p.bio?.slice(0, 300) ?? null,
    faith: p.faith ?? null,
    faith_visible: Boolean(p.faithVisible),
    arrived_at: p.arrivedAt ? new Date(p.arrivedAt).toISOString().slice(0, 10) : null,
  };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Deletes the server account (and with it every row that belongs to it). */
export async function deleteServerAccount(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw new Error(error.message);
  await supabase.auth.signOut();
}
