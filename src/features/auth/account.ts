import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useStore, type Profile } from '@/state/store';
import { imageBytes, imageType } from '@/lib/media';
import { wipeLocal } from '@/state/wipe';
import { CITIES } from '@/data/destinations';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';

/** Signup language names → ISO codes stored server-side. */
const LANG: Record<string, string> = { English: 'en', Français: 'fr', العربية: 'ar', हिन्दी: 'hi', Русский: 'ru', Español: 'es', Italiano: 'it', Deutsch: 'de', Bahasa: 'id', Filipino: 'tl', اردو: 'ur', Português: 'pt' };

export type Account = { userId: string; email?: string } | null;

type AuthState = { status: 'unknown' | 'in' | 'out'; account: Account };
const useAuthStore = create<AuthState>(() => ({ status: supabase ? 'unknown' : 'out', account: null }));

function setSession(u: { id: string; email?: string } | null | undefined) {
  const cur = useAuthStore.getState();
  // Same person (a token refresh): keep the same object, nothing re-renders.
  if (u && cur.account?.userId === u.id && cur.account.email === u.email) {
    if (cur.status !== 'in') useAuthStore.setState({ status: 'in' });
    return;
  }
  // Another person signed in (another tab, or a stored session): this device's
  // profile, plans and chats belong to the previous one.
  if (u && cur.account && cur.account.userId !== u.id) wipeLocal();
  useAuthStore.setState(u ? { status: 'in', account: { userId: u.id, email: u.email } } : { status: 'out', account: null });
}

// Signup finished while signed in: publish the profile now.
useStore.subscribe((st, prev) => {
  const uid = useAuthStore.getState().account?.userId;
  if (uid && st.onboarded && !prev.onboarded) syncProfile(uid).catch(() => undefined);
});

// One session reader and one auth listener for the whole app (every screen
// used to start "signed out" and resolve on its own, flashing Sign in).
if (supabase) {
  supabase.auth
    .getSession()
    .then(({ data }) => {
      setSession(data.session?.user);
      // Still signed in but this device never finished signup (or was reset).
      if (data.session?.user) {
        const uid = data.session.user.id;
        restoreProfile(uid)
          .then((restored) => (restored ? undefined : refreshOwnPhoto(uid)))
          .catch(() => undefined);
      }
    })
    .catch(() => setSession(null));
  supabase.auth.onAuthStateChange((event, session) => {
    setSession(session?.user);
    // Signed out in another tab: forget this person here too.
    if (event === 'SIGNED_OUT') wipeLocal();
    // Signed in: a returning member gets their profile back on this device;
    // a new one publishes the signup profile once.
    if (event === 'SIGNED_IN' && session?.user) {
      const uid = session.user.id;
      restoreProfile(uid)
        .then((restored) => (restored ? undefined : syncProfile(uid)))
        .catch(() => undefined);
    }
  });
}

/** The signed-in member, kept in sync with Supabase Auth (null while unknown or signed out). */
export function useAccount(): Account {
  return useAuthStore((st) => st.account);
}

/** 'unknown' until the stored session is read: show a spinner, not "Sign in". */
export function useAuthStatus(): AuthState['status'] {
  return useAuthStore((st) => st.status);
}

/** Where the email link sends the member back: this web page, or the app. */
function redirectTo(): string {
  // On the web the app can live under a path (GitHub Pages: /irly).
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}/account`;
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
const syncing = new Map<string, Promise<void>>();

export function syncProfile(uid: string): Promise<void> {
  // Every mounted useAccount() and verifyCode() call this on sign-in: share one run.
  const running = syncing.get(uid);
  if (running) return running;
  const run = writeProfile(uid).finally(() => syncing.delete(uid));
  syncing.set(uid, run);
  return run;
}

type ServerProfile = {
  first_name: string | null;
  birthdate: string | null;
  gender: Profile['gender'] | null;
  city_id: string | null;
  country: string | null;
  languages: string[] | null;
  bio: string | null;
  faith: string | null;
  faith_visible: boolean | null;
  arrived_at: string | null;
  interests: string[] | null;
  activity_prefs: string[] | null;
  intentions: string[] | null;
  photo_paths: string[] | null;
};

const restoring = new Map<string, Promise<boolean>>();

/**
 * A returning member signing in on a new device (or after a reset) gets
 * their server profile back and goes straight to the app, instead of
 * signing up again. Returns true when a profile was restored.
 */
export function restoreProfile(uid: string): Promise<boolean> {
  const running = restoring.get(uid);
  if (running) return running;
  const run = readBack(uid).finally(() => restoring.delete(uid));
  restoring.set(uid, run);
  return run;
}

async function readBack(uid: string): Promise<boolean> {
  if (!supabase || useStore.getState().onboarded) return false;
  const { data, error } = await supabase.rpc('my_profile');
  const r = ((data as ServerProfile[] | null) ?? [])[0];
  if (error || !r || !r.first_name) return false;
  const back = Object.fromEntries(Object.entries(LANG).map(([name, code]) => [code, name]));
  let photoUri: string | undefined;
  const path = r.photo_paths?.[0];
  if (path) {
    const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
    photoUri = signed?.signedUrl ?? undefined;
  }
  const born = r.birthdate ? new Date(r.birthdate).getFullYear() : null;
  const st = useStore.getState();
  if (st.onboarded) return false;
  st.updateProfile({
    ownerId: uid,
    name: r.first_name,
    gender: r.gender ?? undefined,
    age: born ? new Date().getFullYear() - born : undefined,
    country: r.country ?? undefined,
    languages: (r.languages ?? []).map((l) => back[l] ?? l),
    bio: r.bio ?? undefined,
    faith: r.faith ?? undefined,
    faithVisible: Boolean(r.faith_visible),
    arrivedAt: r.arrived_at ? Date.parse(r.arrived_at) : undefined,
    // Only values this version of the app knows (older or newer apps may differ).
    interests: (r.interests ?? []).filter((i): i is Profile['interests'][number] => i in INTERESTS),
    activities: (r.activity_prefs ?? []).filter((a): a is Profile['activities'][number] => a in ACTIVITIES),
    lookingFor: (r.intentions ?? []) as Profile['lookingFor'],
    ...(photoUri ? { photoUri } : {}),
  });
  const city = r.city_id && r.city_id in CITIES ? (r.city_id as keyof typeof CITIES) : 'dubai';
  st.setDestination(CITIES[city].destinationId, city);
  st.completeOnboarding();
  return true;
}

async function writeProfile(uid: string): Promise<void> {
  if (!supabase) return;
  const { profile, cityId, onboarded } = useStore.getState();
  // A profile filled in for another account is never published to this one.
  if (profile.ownerId && profile.ownerId !== uid) return;
  // Signed in (Google, email) before finishing signup: wait for the real
  // profile. Publishing a placeholder would lock the wrong gender for good.
  if (!onboarded || !profile.name.trim() || !profile.gender) return;
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (existing) return;
  const row = toRow(uid, profile, cityId ?? 'dubai');
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  useStore.getState().updateProfile({ ownerId: uid });
  // The signup photo follows to the member's own folder (best effort).
  if (profile.photoUri && !/^https?:/.test(profile.photoUri)) {
    try {
      const body = await imageBytes(profile.photoUri);
      const img = imageType(profile.photoUri);
      const path = `${uid}/avatar-${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from('profile-photos').upload(path, body, { contentType: img.contentType });
      if (!up.error) await supabase.from('profiles').update({ photo_paths: [path] }).eq('id', uid);
    } catch {
      // The profile works without it; the photo can be added later.
    }
  }
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
    // Onboarding choices feed recommendations and matching.
    interests: (p.interests ?? []).map(String),
    activity_prefs: (p.activities ?? []).map(String),
    intentions: (p.lookingFor ?? []).map(String),
    onboarded_at: new Date().toISOString(),
  };
}

/** The fields a member can change after signup (gender stays as declared). */
export type ProfilePatch = Partial<Pick<Profile, 'name' | 'bio' | 'age' | 'country' | 'languages' | 'interests' | 'activities' | 'lookingFor'>> & {
  /** A new photo picked on the phone (local or data URI). */
  photoUri?: string;
  cityId?: string;
};

/**
 * Edit profile: saves on the server first (when signed in), then on this
 * phone, so what you see is what others see. A new photo replaces the old
 * file in your storage folder.
 */
export async function updateMyProfile(patch: ProfilePatch): Promise<void> {
  const st = useStore.getState();
  const uid = useAuthStore.getState().account?.userId;
  if (patch.name !== undefined && !patch.name.trim()) throw new Error('Add your first name');
  if (patch.age !== undefined && (patch.age < 18 || patch.age > 120)) throw new Error('IRLY is for people aged 18 and over');
  let photoUri: string | undefined;
  if (supabase && uid) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.first_name = patch.name.trim().slice(0, 40);
    if (patch.bio !== undefined) row.bio = patch.bio.trim().slice(0, 300) || null;
    if (patch.age !== undefined) row.birthdate = `${new Date().getFullYear() - patch.age}-01-01`;
    if (patch.country !== undefined) row.country = patch.country || null;
    if (patch.languages !== undefined) row.languages = patch.languages.map((l) => LANG[l] ?? l);
    if (patch.interests !== undefined) row.interests = patch.interests.map(String);
    if (patch.activities !== undefined) row.activity_prefs = patch.activities.map(String);
    if (patch.lookingFor !== undefined) row.intentions = patch.lookingFor.map(String);
    if (patch.cityId !== undefined) row.city_id = patch.cityId;
    if (patch.photoUri && !/^https?:/.test(patch.photoUri)) {
      const body = await imageBytes(patch.photoUri);
      const img = imageType(patch.photoUri);
      const path = `${uid}/avatar-${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from('profile-photos').upload(path, body, { contentType: img.contentType });
      if (up.error) throw new Error('Could not upload the photo. Try again.');
      const { data: old } = await supabase.rpc('my_profile');
      const before = ((old as ServerProfile[] | null) ?? [])[0]?.photo_paths ?? [];
      row.photo_paths = [path];
      const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
      photoUri = signed?.signedUrl ?? patch.photoUri;
      // The previous photo file goes once the new one is saved (below).
      if (Object.keys(row).length) {
        const { error } = await supabase.from('profiles').update(row).eq('id', uid);
        if (error) {
          await supabase.storage.from('profile-photos').remove([path]);
          throw new Error(error.message);
        }
      }
      const stale = before.filter((p) => p !== path && p.startsWith(`${uid}/`));
      if (stale.length) await supabase.storage.from('profile-photos').remove(stale);
    } else if (Object.keys(row).length) {
      const { error } = await supabase.from('profiles').update(row).eq('id', uid);
      if (error) throw new Error(/check constraint|birthdate/i.test(error.message) ? 'Some fields are not valid' : error.message);
    }
  }
  const { cityId, photoUri: picked, ...rest } = patch;
  st.updateProfile({ ...rest, ...(picked ? { photoUri: photoUri ?? picked } : {}) });
  if (cityId && cityId in CITIES) st.setDestination(CITIES[cityId as keyof typeof CITIES].destinationId, cityId as keyof typeof CITIES);
}

/**
 * Signed photo links expire: on every launch the profile photo link is
 * renewed from the server, so it never turns into a broken image.
 */
export async function refreshOwnPhoto(uid: string): Promise<void> {
  if (!supabase) return;
  const st = useStore.getState();
  if (!st.onboarded || (st.profile.ownerId && st.profile.ownerId !== uid)) return;
  const { data } = await supabase.rpc('my_profile');
  const path = ((data as ServerProfile[] | null) ?? [])[0]?.photo_paths?.[0];
  if (!path) return;
  const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
  if (signed?.signedUrl) st.updateProfile({ photoUri: signed.signedUrl });
}

export async function signOut(): Promise<void> {
  // This phone stops receiving the account's notifications (needs the session, so first).
  await import('@/features/push/push').then((m) => m.unregisterPush()).catch(() => undefined);
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

/* ───────── Password, providers, phone ───────── */

function client() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

/** Plain-language errors for the messages people actually hit. */
export function authMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/invalid login credentials/i.test(m)) return 'Wrong email or password';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first: open the link we sent you';
  if (/user already registered/i.test(m)) return 'You already have an account: sign in instead';
  if (/provider is not enabled|unsupported provider/i.test(m)) return 'This sign-in option is not switched on yet. Use email for now';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again';
  if (/password should be at least/i.test(m)) return 'Use at least 8 characters for your password';
  if (/phone.*(provider|sms)|sms provider/i.test(m)) return 'Phone sign-in is not switched on yet. Use email for now';
  return m;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(authMessage(error));
  if (data.user) await syncProfile(data.user.id).catch(() => undefined);
}

/** Creates the account; returns true when it still needs the email confirmed. */
export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  if (password.length < 8) throw new Error('Use at least 8 characters for your password');
  const { data, error } = await client().auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: redirectTo() } });
  if (error) throw new Error(authMessage(error));
  if (data.session && data.user) {
    await syncProfile(data.user.id).catch(() => undefined);
    return false;
  }
  return true;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const base = redirectTo();
  const { error } = await client().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${base}${base.includes('?') ? '&' : '?'}reset=1` });
  if (error) throw new Error(authMessage(error));
}

export async function updatePassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('Use at least 8 characters for your password');
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new Error(authMessage(error));
}

/**
 * Apple / Google. The web redirects; the app opens the provider in the
 * browser and comes back on irly://account#access_token=… (completeFromUrl).
 * The provider must be switched on in Supabase (Authentication → Providers).
 */
export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  const web = Platform.OS === 'web';
  const { data, error } = await client().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(), skipBrowserRedirect: !web } });
  if (error) throw new Error(authMessage(error));
  if (!web && data.url) {
    // In-app auth session: closes itself and hands back the redirect URL.
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo());
    if (res.type !== 'success' || !res.url) return;
    const failed = res.url.match(/[#?&]error_description=([^&]+)/);
    if (failed) throw new Error(decodeURIComponent(failed[1].replace(/\+/g, ' ')));
    if (!(await completeFromUrl(res.url))) throw new Error('Sign-in did not complete. Try again.');
  }
}

export async function sendPhoneCode(phone: string): Promise<void> {
  const { error } = await client().auth.signInWithOtp({ phone: phone.replace(/[^\d+]/g, '') });
  if (error) throw new Error(authMessage(error));
}

export async function verifyPhoneCode(phone: string, code: string): Promise<void> {
  const { data, error } = await client().auth.verifyOtp({ phone: phone.replace(/[^\d+]/g, ''), token: code.trim(), type: 'sms' });
  if (error) throw new Error(authMessage(error));
  if (data.user) await syncProfile(data.user.id).catch(() => undefined);
}
