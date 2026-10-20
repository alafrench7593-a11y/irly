import { changed } from '@/features/server/sync';
import { router } from 'expo-router';
import { track } from '@/lib/analytics';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { create } from 'zustand';
import { Platform } from 'react-native';
import { friendlyError, supabase } from '@/lib/supabase';
import * as Crypto from 'expo-crypto';
import { useStore, type Profile } from '@/state/store';
import { cleanImage } from '@/lib/media';
import { thumbOf, uploadFaceThumb as uploadThumb } from '@/features/server/media';
import { wipeLocal } from '@/state/wipe';
import { CITIES } from '@/data/destinations';
import { ACTIVITIES, INTERESTS } from '@/data/catalog';
import { isAvatar } from '@/features/avatar/avatar';
import { authMessage, errorCode, MESSAGES, passwordProblem, returnLinkError, signUpHitExisting } from './signup';

export { authMessage, errorCode };

/** Signup language names → ISO codes stored server-side. */
const LANG: Record<string, string> = { English: 'en', Français: 'fr', العربية: 'ar', हिन्दी: 'hi', Русский: 'ru', Español: 'es', Italiano: 'it', Deutsch: 'de', Bahasa: 'id', Filipino: 'tl', اردو: 'ur', Português: 'pt' };

export type Account = { userId: string; email?: string } | null;

type AuthState = { status: 'unknown' | 'in' | 'out'; account: Account };
const useAuthStore = create<AuthState>(() => ({ status: supabase ? 'unknown' : 'out', account: null }));

/** True while this phone is ending the session on purpose (Log out, Delete account). */
let ending = false;

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

// Signup finished while signed in: publish the profile now. Changing city
// later moves your profile too (people nearby, recommendations).
useStore.subscribe((st, prev) => {
  const uid = useAuthStore.getState().account?.userId;
  if (uid && st.onboarded && !prev.onboarded) syncProfile(uid).catch(() => undefined);
  if (uid && supabase && st.onboarded && prev.onboarded && st.cityId && st.cityId !== prev.cityId && (!st.profile.ownerId || st.profile.ownerId === uid)) {
    supabase.from('profiles').update({ city_id: st.cityId }).eq('id', uid).then(() => undefined);
  }
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
        // A profile whose first publish failed (offline at signup) is published now:
        // without it every join is refused by the server.
        restoreProfile(uid)
          .then((restored) => (restored ? undefined : syncProfile(uid).catch(publishFailed).then(() => refreshOwnPhoto(uid))))
          .catch(() => undefined);
      }
    })
    .catch(() => setSession(null));
  supabase.auth.onAuthStateChange((event, session) => {
    // Already signed out here (Log out finished, a late answer of its server call): nothing more to say.
    const wasIn = useAuthStore.getState().status !== 'out';
    setSession(session?.user);
    // Signed out in another tab, or the session ended elsewhere (signed out on the server, account
    // deleted on another phone, refresh token revoked): forget this person here too, and leave
    // the private screens (Log out and Delete account do that themselves).
    if (event === 'SIGNED_OUT') {
      wipeLocal();
      if (!ending && wasIn) {
        void closeRealtime();
        // This phone stops getting the account's notifications (released without a session, see push.ts).
        void settled(
          import('@/features/push/push').then((m) => m.unregisterPush()),
          PUSH_MS,
        );
        setTimeout(goPublic, 0);
        // Said, never a silent jump to Welcome (an expired or revoked session, signed out elsewhere).
        void import('@/components/ui/Toast').then((m) => m.toast(MESSAGES.sessionEnded, 'lock', 'live')).catch(() => undefined);
      }
    }
    // Signed in: a returning member gets their profile back on this device;
    // a new one publishes the signup profile once.
    if (event === 'SIGNED_IN' && session?.user) {
      const uid = session.user.id;
      restoreProfile(uid)
        .then((restored) => (restored ? undefined : syncProfile(uid)))
        .catch(publishFailed);
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
  if (error) throw new Error(authMessage(error));
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
  if (error) throw new Error(authMessage(error));
  const uid = data.user?.id;
  // Signed in already: a profile that fails to publish now is published at the next launch.
  if (uid) await syncProfile(uid).catch(() => undefined);
}

/**
 * Writes the profile filled in at signup to `profiles`, once. Gender is
 * locked server-side after this first write (IRLY Girl access).
 */
const syncing = new Map<string, Promise<boolean>>();

/**
 * Runs a server action; when the server answers that this account has no
 * profile yet (its publish failed earlier), publishes it and tries once more.
 */
export async function withProfile<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (e) {
    const uid = useAuthStore.getState().account?.userId;
    if (!uid || !(e instanceof Error) || !(await profileMissing(uid, e.message))) throw e;
    // Published now if this phone has the profile; otherwise the member finishes it.
    const published = await syncProfile(uid).then(
      (onServer) => onServer,
      (err: unknown) => {
        track('SERVER_ERROR', { code: errorCode(err instanceof Error ? err.message : String(err)), where: 'profile_publish' });
        return false;
      },
    );
    if (published) {
      try {
        return await action();
      } catch (again) {
        if (!(again instanceof Error) || !(await profileMissing(uid, again.message))) throw again;
      }
    }
    askToFinishProfile();
    throw new Error('Finish your profile first');
  }
}

/** The server refused because this account has no profile row (not for another reason, such as a community it is not in). */
async function profileMissing(uid: string, message: string): Promise<boolean> {
  if (/Finish your profile first/i.test(message)) return true;
  // Only a refusal that can come from a missing profile row; another foreign key (a place, a community)
  // is a different problem, and the profiles table always has the last word.
  if (!/row-level security|profiles_?\w*fkey|creator_id_fkey|created_by_fkey|user_id_fkey|author_id_fkey|sender_id_fkey|follower_id_fkey/i.test(message) || !supabase) return false;
  const { data, error } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  return !error && !data;
}

/** Opens the profile step of signup, already filled with what this phone knows; finishing it publishes the profile. */
let asked = 0;
function askToFinishProfile() {
  if (Date.now() - asked < 5000) return;
  asked = Date.now();
  track('PROFILE_MISSING', {});
  setTimeout(() => router.push('/onboarding/profile'), 600);
}

// A profile that could not reach the server at sign-in: its cause is recorded
// (no personal data), the member is asked again on their first action.
function publishFailed(err: unknown) {
  track('SERVER_ERROR', { code: errorCode(err instanceof Error ? err.message : String(err)), where: 'profile_signin' });
}

/** Publishes this phone's signup profile when the server has none; resolves true once the server has this account's profile. */
export function syncProfile(uid: string): Promise<boolean> {
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

/**
 * A signed-in member whose profile is not on this phone: their server profile
 * comes back (true) and they go to the app, never through sign-up again; false
 * only when the server answered that this account has no profile yet. Throws
 * when the server could not be asked (offline), so nobody is sent to sign up
 * again by a network error.
 */
export async function resumeProfile(uid: string): Promise<boolean> {
  if (useStore.getState().onboarded && useStore.getState().profile.ownerId === uid) return true;
  return readBack(uid, true, true);
}

/** Still the signed-in account (an account switch can happen while a request is on its way). */
const stillSignedIn = (uid: string) => useAuthStore.getState().account?.userId === uid;

/**
 * The server refused a profile because its account no longer exists (deleted
 * on another phone, or by an admin) while this phone still holds a valid
 * session token: asked to the auth server, never guessed. Signing out here
 * wipes this phone (SIGNED_OUT) instead of asking that person to finish a
 * profile that can never be saved. A network failure is not an answer.
 */
async function signOutIfAccountGone(uid: string): Promise<void> {
  if (!supabase || !stillSignedIn(uid)) return;
  const { data, error } = await supabase.auth.getUser();
  const gone = error ? error.status === 401 || error.status === 403 || error.code === 'user_not_found' : !data.user;
  if (gone && stillSignedIn(uid)) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

async function readBack(uid: string, force = false, strict = false): Promise<boolean> {
  if (!supabase || (!force && useStore.getState().onboarded)) return false;
  const { data, error } = await supabase.rpc('my_profile');
  // Asked by the person (Finish my profile): a failed read is said, never taken for "no profile".
  if (error && strict) throw new Error(authMessage(error));
  const r = ((data as ServerProfile[] | null) ?? [])[0];
  if (error || !r || !r.first_name) return false;
  const back = Object.fromEntries(Object.entries(LANG).map(([name, code]) => [code, name]));
  let photoUri: string | undefined;
  const path = r.photo_paths?.[0];
  if (isAvatar(path)) {
    // An IRLY avatar is its own description: nothing to sign.
    photoUri = path;
  } else if (path) {
    const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
    photoUri = signed?.signedUrl ?? undefined;
  }
  const born = r.birthdate ? new Date(r.birthdate).getFullYear() : null;
  const st = useStore.getState();
  if (!force && st.onboarded) return false;
  // Another account signed in meanwhile: this answer is not its profile.
  if (!stillSignedIn(uid)) return false;
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

async function writeProfile(uid: string): Promise<boolean> {
  if (!supabase) return false;
  const { profile, cityId, onboarded } = useStore.getState();
  const { data: existing, error: lookup } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (lookup) throw new Error(lookup.message);
  if (existing) {
    // Signed in to an existing account after filling a profile on this phone as a guest:
    // the account's own profile (from the server) replaces the guest one on this phone.
    if (onboarded && !profile.ownerId) await readBack(uid, true).catch(() => undefined);
    return true;
  }
  // A profile filled in for another account is never published to this one.
  if (profile.ownerId && profile.ownerId !== uid) return skipped(onboarded, 'other_owner');
  // Signed in (Google, email) before finishing signup: wait for the real
  // profile. Publishing a placeholder would lock the wrong gender for good.
  // A missing first name is not a reason to wait (Google and Apple often give none): it becomes "IRLY member".
  if (!onboarded) return false;
  if (!profile.gender) return skipped(onboarded, 'incomplete');
  const row = toRow(uid, profile, cityId ?? 'dubai');
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    // Still recorded by the caller (profiles_id_fkey): a deleted account's leftover session.
    if (/profiles_id_fkey/.test(error.message)) await signOutIfAccountGone(uid);
    throw new Error(error.message);
  }
  // Another account signed in meanwhile: the profile on this phone is now theirs, never stamped with this one.
  if (!stillSignedIn(uid)) return true;
  useStore.getState().updateProfile({ ownerId: uid });
  // An IRLY avatar is stored as is (no file to upload).
  if (isAvatar(profile.photoUri)) {
    await supabase.from('profiles').update({ photo_paths: [profile.photoUri] }).eq('id', uid);
    return true;
  }
  // The signup photo follows to the member's own folder (best effort).
  if (profile.photoUri && !/^https?:/.test(profile.photoUri)) {
    try {
      const img = await cleanImage(profile.photoUri);
      const path = `${uid}/avatar-${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from('profile-photos').upload(path, img.body, { contentType: img.contentType });
      if (!up.error) {
        await uploadThumb(path, profile.photoUri);
        await supabase.from('profiles').update({ photo_paths: [path] }).eq('id', uid);
      }
    } catch {
      // The profile works without it; the photo can be added later.
    }
  }
  return true;
}

// Signup finished on this phone but its profile was not sent: why, so the cause can be fixed (nothing personal).
function skipped(onboarded: boolean, why: string): false {
  if (onboarded) track('PROFILE_SKIPPED', { why });
  return false;
}

function toRow(uid: string, p: Profile, cityId: string) {
  const age = p.age ?? 25;
  // Only the age was asked at signup: store 1 January of that birth year.
  const birthdate = `${new Date().getFullYear() - age}-01-01`;
  return {
    id: uid,
    first_name: (p.name?.trim() || 'IRLY member').slice(0, 40),
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

/** The fields a member can change after signup (gender and birth date stay as declared: the server refuses changes). */
export type ProfilePatch = Partial<Pick<Profile, 'name' | 'bio' | 'country' | 'languages' | 'interests' | 'activities' | 'lookingFor'>> & {
  /** Unique @username (server only); empty clears it. */
  username?: string;
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
  let photoUri: string | undefined;
  if (supabase && uid) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.first_name = patch.name.trim().slice(0, 40);
    if (patch.bio !== undefined) row.bio = patch.bio.trim().slice(0, 300) || null;
    if (patch.country !== undefined) row.country = patch.country || null;
    if (patch.languages !== undefined) row.languages = patch.languages.map((l) => LANG[l] ?? l);
    if (patch.interests !== undefined) row.interests = patch.interests.map(String);
    if (patch.activities !== undefined) row.activity_prefs = patch.activities.map(String);
    if (patch.lookingFor !== undefined) row.intentions = patch.lookingFor.map(String);
    if (patch.cityId !== undefined) row.city_id = patch.cityId;
    if (patch.username !== undefined) row.username = patch.username.trim().toLowerCase() || null;
    if (isAvatar(patch.photoUri)) {
      // An IRLY avatar replaces the photo without an upload; the old photo file goes.
      const before = await myPhotoPaths();
      // Only the main picture changes: the other photos of the profile stay.
      row.photo_paths = [patch.photoUri, ...before.slice(1)];
      photoUri = patch.photoUri;
      await saveProfileRow(uid, row);
      const stale = before.slice(0, 1).filter((p) => !isAvatar(p) && p.startsWith(`${uid}/`));
      if (stale.length) await supabase.storage.from('profile-photos').remove([...stale, ...stale.map(thumbOf)]);
    } else if (patch.photoUri && !/^https?:/.test(patch.photoUri)) {
      const img = await cleanImage(patch.photoUri);
      const path = `${uid}/avatar-${Date.now()}.${img.ext}`;
      const up = await supabase.storage.from('profile-photos').upload(path, img.body, { contentType: img.contentType });
      if (up.error) throw new Error('Could not upload the photo. Try again.');
      await uploadThumb(path, patch.photoUri);
      const before = await myPhotoPaths();
      // Only the main picture changes: the other photos of the profile stay.
      row.photo_paths = [path, ...before.slice(1).filter((p) => p !== path)];
      const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
      photoUri = signed?.signedUrl ?? patch.photoUri;
      // The previous photo file goes once the new one is saved (below).
      if (Object.keys(row).length) {
        try {
          await saveProfileRow(uid, row);
        } catch (e) {
          await supabase.storage.from('profile-photos').remove([path, thumbOf(path)]);
          throw e;
        }
      }
      const stale = before.slice(0, 1).filter((p) => p !== path && !isAvatar(p) && p.startsWith(`${uid}/`));
      if (stale.length) await supabase.storage.from('profile-photos').remove([...stale, ...stale.map(thumbOf)]);
    } else if (Object.keys(row).length) {
      await saveProfileRow(uid, row);
    }
  }
  // Every screen that shows this profile (yours, lists, chats) reloads.
  if (supabase && uid) changed('people');
  const { cityId, photoUri: picked, username: _handle, ...rest } = patch;
  void _handle;
  st.updateProfile({ ...rest, ...(picked ? { photoUri: photoUri ?? picked } : {}) });
  if (cityId && cityId in CITIES) st.setDestination(CITIES[cityId as keyof typeof CITIES].destinationId, cityId as keyof typeof CITIES);
}

/** The photos already on the profile. A failed read stops the save: writing without them would drop the other photos. */
async function myPhotoPaths(): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_profile');
  if (error) throw new Error(profileError(error.message));
  return ((data as ServerProfile[] | null) ?? [])[0]?.photo_paths ?? [];
}

/** Saves on the server; an update that reached no row (profile never published) is not a success. */
async function saveProfileRow(uid: string, row: Record<string, unknown>): Promise<void> {
  if (!supabase) return;
  const sb = supabase;
  await withProfile(async () => {
    const { data, error } = await sb.from('profiles').update(row).eq('id', uid).select('id');
    if (error) throw new Error(profileError(error.message));
    if (!data?.length) throw new Error('Finish your profile first');
  });
}

function profileError(m: string): string {
  if (/profiles_username_key|duplicate key/i.test(m)) return 'This username is taken';
  if (/username is reserved/i.test(m)) return 'This username is reserved';
  if (/profiles_username_format/i.test(m)) return 'Usernames: 3 to 24 characters, letters, numbers, dots and underscores';
  if (/fetch|network/i.test(m)) return 'No connection: try again';
  if (/check constraint/i.test(m)) return 'Some fields are not valid';
  return m;
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
  // Signed out (or another account signed in) while asking: this photo is no longer this phone's profile.
  const stillMine = () => stillSignedIn(uid) && useStore.getState().onboarded && (!useStore.getState().profile.ownerId || useStore.getState().profile.ownerId === uid);
  if (isAvatar(path)) {
    if (stillMine()) useStore.getState().updateProfile({ photoUri: path });
    return;
  }
  const { data: signed } = await supabase.storage.from('profile-photos').createSignedUrl(path, 7 * 24 * 3600);
  if (signed?.signedUrl && stillMine()) useStore.getState().updateProfile({ photoUri: signed.signedUrl });
}

/* ───────── Log out, delete account, download my data ───────── */

/**
 * Every step below has its own bound: a request that never answers (bad
 * network), a Keychain call or a native push call that never returns must not
 * leave a spinner turning. Requests already give up after 20 s (lib/supabase);
 * these bounds sit just above, so a step never keeps running after we moved on.
 */
const SERVER_MS = 25_000;
const PUSH_MS = 5_000;
const LOCAL_MS = 5_000;
const CHANNELS_MS = 3_000;
/** Ending the session on the server at Log out. */
const SIGNOUT_MS = 8_000;
/** One storage listing or delete while deleting the account (the server purges whatever is left). */
const FILES_MS = 10_000;
const NO_CONNECTION = 'IRLY did not answer in time. Check your connection and try again.';

/** Rejects with `message` when `work` has not settled after `ms`. */
export function within<T>(work: PromiseLike<T>, ms: number, message = NO_CONNECTION): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, fail) => {
    timer = setTimeout(() => fail(new Error(message)), ms);
  });
  return Promise.race([Promise.resolve(work), late]).finally(() => clearTimeout(timer));
}

/** Waits for `work` at most `ms`; true when it finished without error. */
const settled = (work: PromiseLike<unknown>, ms: number) => within(work, ms).then(
  () => true,
  () => false,
);

/**
 * Leaves the private screens for good: the history is reset, so Back (or the
 * iOS swipe) cannot return to a screen of the account that just left.
 */
export function goPublic(): void {
  try {
    if (router.canDismiss()) router.dismissAll();
    router.replace('/welcome');
  } catch {
    // Navigation not mounted yet (cold start): the entry gate sends the person to Welcome.
  }
}

type SessionStorage = { getItem(key: string): Promise<string | null> | string | null; removeItem(key: string): Promise<void> | void };

/**
 * Removes the stored session from this phone, whatever happened on the
 * server. supabase-js keeps the session when it cannot read it (an expired
 * token it cannot refresh while offline): its own sign-out then fails and the
 * next launch would sign the person back in. Returns true once it is gone.
 */
async function forgetSessionHere(): Promise<boolean> {
  if (!supabase) return true;
  const auth = supabase.auth as unknown as { storage?: SessionStorage; storageKey?: string };
  const { storage, storageKey } = auth;
  if (!storage || !storageKey) return false;
  const gone = await settled(
    (async () => {
      await storage.removeItem(storageKey);
      await storage.removeItem(`${storageKey}-user`);
      await storage.removeItem(`${storageKey}-code-verifier`);
      if ((await storage.getItem(storageKey)) !== null) throw new Error('still stored');
    })(),
    LOCAL_MS,
  );
  return gone;
}

/** Live connections opened for the account that is leaving (chats, inbox, sync). */
async function closeRealtime(): Promise<void> {
  if (!supabase) return;
  await settled(supabase.removeAllChannels(), CHANNELS_MS);
}

/** Ends the session on this phone (and on the server when it answers), then forgets the person. */
async function endSession(): Promise<{ serverEnded: boolean }> {
  if (!supabase) {
    wipeLocal();
    return { serverEnded: true };
  }
  // The server forgets this phone's session ("local": the member's other phones stay signed in).
  // Offline, the request fails fast and supabase-js removes the session here anyway.
  // Bounded tighter than other requests: the person waits on this screen, and the phone forgets the
  // session below whatever the server said (the result says when the server did not confirm).
  // The live connections close at the same time instead of after it: they need no answer.
  const [serverEnded] = await Promise.all([
    within(supabase.auth.signOut({ scope: 'local' }), SIGNOUT_MS).then(
      (r) => !r.error,
      () => false,
    ),
    closeRealtime(),
  ]);
  // Whatever the answer, nothing of the session may stay on this phone.
  if (!(await forgetSessionHere())) throw new Error('Could not sign you out on this phone. Try again.');
  setSession(null);
  wipeLocal();
  return { serverEnded };
}

/**
 * Log out: this phone stops receiving the account's notifications, the
 * session ends (on the server when reachable, always on this phone), live
 * connections close and everything this phone knows about the person is
 * wiped. Resolves once it is done; rejects (nothing wiped, still signed in)
 * only when the session could not be removed from this phone.
 */
export async function signOut(): Promise<{ serverEnded: boolean }> {
  ending = true;
  try {
    // Needs the session, so first. Bounded: asking the phone for its token has no timeout of its own.
    await settled(
      import('@/features/push/push').then((m) => m.unregisterPush()),
      PUSH_MS,
    );
    return await endSession();
  } finally {
    ending = false;
  }
}

/** Your files in each storage bucket (they live in a folder named after you). */
const BUCKETS = ['profile-photos', 'match-photos', 'irl-media', 'activity-photos', 'chat-media', 'post-media', 'verifications', 'data-exports'];
const PAGE = 100;
/** At most this many pages of a listing per bucket (2,000 files): a listing can never run forever. */
const MAX_PAGES = 20;
/** Sub-folders followed at most this deep (uploads are flat today: `<you>/<file>`). */
const MAX_DEPTH = 3;

/** Every file path in your folder of one bucket (sub-folders included), bounded; `complete` is false when the bound was reached. */
async function myFiles(bucket: string, uid: string): Promise<{ files: string[]; complete: boolean }> {
  if (!supabase) return { files: [], complete: true };
  const files: string[] = [];
  const folders: { path: string; depth: number }[] = [{ path: uid, depth: 0 }];
  let pages = 0;
  while (folders.length && pages < MAX_PAGES) {
    const folder = folders.shift()!;
    for (let offset = 0; pages < MAX_PAGES; offset += PAGE) {
      pages += 1;
      const { data, error } = await within(supabase.storage.from(bucket).list(folder.path, { limit: PAGE, offset }), FILES_MS);
      if (error) {
        // A bucket this server does not have (yet): nothing of yours in it.
        if (/bucket not found/i.test(error.message)) return { files, complete: true };
        throw new Error('Could not delete your files. Check your connection and try again.');
      }
      for (const f of data ?? []) {
        const path = `${folder.path}/${f.name}`;
        // A folder comes back as an entry without an id: its files are listed on their own.
        if (f.id === null) {
          if (folder.depth < MAX_DEPTH) folders.push({ path, depth: folder.depth + 1 });
        } else {
          files.push(path);
        }
      }
      if (!data || data.length < PAGE) break;
    }
  }
  return { files, complete: folders.length === 0 && pages < MAX_PAGES };
}

/**
 * Deletes your files, one listing then one delete per 100 files: no loop that
 * waits for a folder to become empty. A file the storage rules do not let you
 * delete is not an error from Supabase (it simply is not deleted): it no
 * longer blocks the account deletion, the server queues it for cleanup.
 * Returns how many files (at least) could not be deleted.
 */
async function removeMyFiles(uid: string): Promise<number> {
  if (!supabase) return 0;
  const sb = supabase;
  // Best effort: the server puts every file of the account on its purge list before deleting it
  // (delete_my_account), so a bucket this phone cannot list or empty (a refused listing, a network
  // blip, a timeout) never blocks the deletion; its files are counted as left for the purge job.
  const left = await Promise.all(
    BUCKETS.map(async (bucket) => {
      try {
        const { files, complete } = await myFiles(bucket, uid);
        let kept = complete ? 0 : 1;
        for (let i = 0; i < files.length; i += PAGE) {
          const chunk = files.slice(i, i + PAGE);
          const { data, error } = await within(sb.storage.from(bucket).remove(chunk), FILES_MS);
          kept += error ? chunk.length : chunk.length - (data?.length ?? 0);
        }
        return kept;
      } catch {
        return 1;
      }
    }),
  );
  return left.reduce((a, b) => a + b, 0);
}

/**
 * Whether the server confirms this signed-in account no longer exists:
 * true (gone), false (still there) or null (could not be asked).
 */
async function accountGone(): Promise<boolean | null> {
  if (!supabase) return null;
  const sb = supabase;
  const asked = await within(sb.rpc('my_account_exists'), SERVER_MS).then(
    (r) => (r.error ? null : r.data === false),
    () => null,
  );
  if (asked !== null) return asked;
  // The auth server itself: a deleted user's token is refused as "user not found".
  return within(sb.auth.getUser(), SERVER_MS).then(
    ({ data, error }) => {
      if (data.user) return false;
      const code = (error as { code?: string } | null)?.code;
      return code === 'user_not_found' || /user .*(not found|does not exist)/i.test(error?.message ?? '') ? true : null;
    },
    () => null,
  );
}

const SESSION_ENDED = 'Your session has ended. Sign in again to delete your account.';

/** The server refused the request because the session is no longer valid (expired, revoked, signed out elsewhere). */
function sessionRefused(message: string): boolean {
  return /jwt|session[_ ](not[_ ]found|expired|missing)|refresh[_ ]token|invalid claim|not authenticated|sign in required/i.test(message);
}

/**
 * Deletes the server account: your files first (the database cannot remove
 * files), then every row that belongs to you and the sign-in account itself
 * (one transaction: all or nothing), checked with the server before saying
 * so. Then the session and everything on this phone are forgotten. On any
 * failure nothing is wiped and the member can retry: every step is safe to
 * run again. `filesQueued`: files this phone could not remove; the server
 * queued them and the purge job removes them later (not instantly).
 */
export async function deleteServerAccount(): Promise<{ filesQueued: number }> {
  if (!supabase) return { filesQueued: 0 };
  const sb = supabase;
  const { data, error: sessionError } = await within(sb.auth.getSession(), SERVER_MS).catch((e: unknown) => ({
    data: { session: null },
    error: e instanceof Error ? e : new Error(String(e)),
  }));
  if (!data.session) {
    // Nothing was deleted: say why. A session that could not be renewed because the phone is
    // offline (or the server did not answer) is a connection problem; one the server refused, or
    // one that is simply gone from this phone while it still shows the account, has ended.
    const offline = Boolean(sessionError) && /retryable|fetch|network|did not answer|timed? ?out/i.test(`${sessionError?.name} ${sessionError?.message}`);
    if (offline) throw new Error('No connection: your account was not deleted. Try again.');
    if (sessionError || useAuthStore.getState().account) throw new Error(SESSION_ENDED);
    return { filesQueued: 0 };
  }
  ending = true;
  try {
    const left = await removeMyFiles(data.session.user.id);
    if (left) track('SERVER_ERROR', { code: 'storage_leftover', where: 'delete_account' });
    const { error } = await within(sb.rpc('delete_my_account'), SERVER_MS).catch((e: unknown) => ({
      error: { message: e instanceof Error ? e.message : String(e) },
    }));
    // Verified with the server before saying "deleted": the server checks it before answering
    // (a success means gone), and it is asked once more, which also settles an answer lost on the way.
    const confirmed = await accountGone();
    const gone = confirmed ?? !error;
    if (!gone) {
      // The session ended while deleting (revoked, signed out on another phone): nothing confirmed it.
      if (confirmed === null && error && sessionRefused(error.message)) throw new Error(SESSION_ENDED);
      throw new Error(
        confirmed === false
          ? 'Your account is not deleted yet. Try again to finish.'
          : 'IRLY could not confirm the deletion. Check your connection and try again.',
      );
    }
    await endSession().catch(async () => {
      // The account no longer exists: whatever the phone says, forget the person here.
      setSession(null);
      await closeRealtime();
      wipeLocal();
    });
    return { filesQueued: left };
  } finally {
    ending = false;
  }
}

/** Download my data, as a real file: 'downloaded' (web), 'opened' (the phone's browser saves it). */
export async function exportMyData(): Promise<'downloaded' | 'opened'> {
  const sb = client();
  const { data, error } = await within(sb.rpc('export_my_data'), SERVER_MS);
  if (error) throw new Error(friendlyError(error.message));
  if (!data || typeof data !== 'object') throw new Error('Your data could not be prepared. Try again.');
  const json = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString();
  const name = `irly-data-${stamp.slice(0, 10)}.json`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  }
  // Phones: the file goes to your private folder on the IRLY server and opens
  // in the phone's browser as a download (Files on iPhone, Downloads on
  // Android). A share sheet with the text pasted in is not a usable file.
  const uid = (data as { account?: { id?: string } }).account?.id ?? useAuthStore.getState().account?.userId;
  if (!uid) throw new Error('Sign in again to download your data.');
  const bucket = sb.storage.from('data-exports');
  // Earlier exports go first: only the newest copy is kept.
  const { data: old } = await within(bucket.list(uid, { limit: PAGE }), SERVER_MS).catch(() => ({ data: null }));
  const stale = (old ?? []).filter((f) => f.id !== null).map((f) => `${uid}/${f.name}`);
  if (stale.length) await settled(bucket.remove(stale), SERVER_MS);
  const path = `${uid}/irly-data-${stamp.replace(/[:.]/g, '-')}.json`;
  const up = await within(bucket.upload(path, json, { contentType: 'application/json', upsert: false }), SERVER_MS * 2);
  if (up.error) throw new Error(/bucket not found/i.test(up.error.message) ? 'Download my data is not available yet. Contact support for a copy.' : friendlyError(up.error.message));
  // A short-lived link (10 minutes), served as a download with its file name.
  const { data: link, error: linkError } = await within(bucket.createSignedUrl(path, 600, { download: name }), SERVER_MS);
  if (linkError || !link?.signedUrl) throw new Error('Your data could not be prepared. Try again.');
  await Linking.openURL(link.signedUrl);
  return 'opened';
}

/* ───────── Password, providers, phone ───────── */

function client() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!password) throw new Error(MESSAGES.wrongCredentials);
  const { data, error } = await client().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw new Error(authMessage(error));
  if (data.user) await syncProfile(data.user.id).catch(() => undefined);
}

/** Creates the account; returns true when it still needs the email confirmed. */
export async function signUpWithPassword(email: string, password: string): Promise<boolean> {
  const weak = passwordProblem(password);
  if (weak) throw new Error(weak);
  const { data, error } = await client().auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: redirectTo() } });
  if (error) throw new Error(authMessage(error));
  // An email that already has an account: Supabase answers "success" without sending anything.
  if (signUpHitExisting(data.user)) throw new Error(MESSAGES.existingAccount);
  if (!data.user) throw new Error(MESSAGES.serverDown);
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
  const weak = passwordProblem(password);
  if (weak) throw new Error(weak);
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new Error(authMessage(error));
}

/**
 * Apple / Google. The web redirects; the app opens the provider in the
 * browser and comes back on irly://account#access_token=… (completeFromUrl).
 * The provider must be switched on in Supabase (Authentication → Providers).
 */
/** Sign-in return links already used: the same link can also reach the Account screen (Android), never twice. */
export const handledAuthUrls = new Set<string>();

export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  // iPhone: Apple's own sheet (Face ID), no browser.
  if (provider === 'apple' && Platform.OS === 'ios' && (await signInWithAppleNative())) return;
  const web = Platform.OS === 'web';
  const { data, error } = await client().auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo(), skipBrowserRedirect: !web } });
  if (error) throw new Error(authMessage(error));
  if (!web && data.url) {
    // In-app auth session: closes itself and hands back the redirect URL.
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo());
    if (res.type !== 'success' || !res.url) return;
    // The provider's own text is never shown as is.
    const failed = returnLinkError(res.url);
    if (failed) throw new Error(failed);
    handledAuthUrls.add(res.url);
    if (!(await completeFromUrl(res.url))) throw new Error('Sign-in did not complete. Try again.');
  }
}

/**
 * Sign in with Apple, the native way: Apple's sheet returns a signed token,
 * Supabase checks it (with a one-time nonce, so a stolen token cannot be
 * replayed) and opens the session. An Apple account whose verified email
 * already has an IRLY account signs into that account; one that hides its
 * email (an @privaterelay.appleid.com address) gets its own account, never
 * merged with another without proof it is the same person. Apple gives the
 * name only the first time: it fills the profile name if there is none.
 * Returns false when Apple sign-in is not available on this device.
 */
async function signInWithAppleNative(): Promise<boolean> {
  const Apple = await import('expo-apple-authentication');
  if (!(await Apple.isAvailableAsync())) return false;
  const raw = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  let cred: Awaited<ReturnType<typeof Apple.signInAsync>>;
  try {
    cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL], nonce: hashed });
  } catch (e) {
    // Closed by the member: nothing to say.
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return true;
    throw new Error('Apple sign-in did not complete. Try again.');
  }
  if (!cred.identityToken) throw new Error('Apple sign-in did not complete. Try again.');
  // Before the session starts: signing in publishes the profile at once, with this name.
  const given = cred.fullName?.givenName?.trim();
  if (given && !useStore.getState().profile.name.trim()) useStore.getState().updateProfile({ name: given });
  const { error } = await client().auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: raw });
  if (error) throw new Error(authMessage(error));
  return true;
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

