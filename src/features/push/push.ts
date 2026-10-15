import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAccount } from '@/features/auth/account';
import { dateLocale, useLang, type Lang } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Phone notifications. Each signed-in phone registers its Expo push token
 * on the server (register_push_token); the server pushes every
 * notification you have not muted (migrations 2700 and 20261013), titled in
 * the phone's language, with the screen to open. Tapping one opens that
 * screen. On the web nothing happens here.
 *
 * Permission is asked in context, never on the first screen: the first time
 * you send a friend request, join an activity or a community, or write a
 * message (askPushInContext), or when you turn notifications on in
 * Settings. Once granted, the phone registers by itself at every launch.
 *
 * Each app install has a random secret of its own (installSecret), sent with
 * the token: the server keeps only a hash of it, and a token moves to another
 * account only with the same secret (migration 20261020001300). Someone who
 * learns this phone's token therefore cannot redirect its notifications,
 * while signing in with another account on this phone still works. Neither
 * the token nor the secret is ever logged.
 *
 * Signing out offline: unregister_push_token needs the old session, so the
 * token is first kept as "to release" on the phone, and released with the
 * install secret (release_push_token, no session needed) right away and
 * again at each launch, return to the app and every minute until the server
 * confirms. Registering it for the next account on this phone also settles it.
 */

export type PushState = 'on' | 'denied' | 'unsupported' | 'not-configured';

let registered: string | null = null;
const native = Platform.OS === 'ios' || Platform.OS === 'android';

if (native) {
  // A notification arriving while the app is open shows as a banner too.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

/** The EAS project id the Expo push service needs (set by `eas init`). */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId ?? null;
}

/**
 * The phone's notification calls (permission, Expo token) have no timeout of their own and can
 * stay unanswered (no network, Expo push service down): a sign-out or a delete waiting on them
 * never finished. Bounded here.
 */
const PHONE_LIMIT = 8000;
function bounded<T>(work: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what}: no answer from the phone`)), PHONE_LIMIT);
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Asks permission (once), then registers this phone for your notifications. */
export async function registerPush(lang: Lang, ask = true): Promise<PushState> {
  if (!native || !Device.isDevice || !supabase) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'IRLY', importance: Notifications.AndroidImportance.HIGH }).catch(() => undefined);
  }
  let { status } = await bounded(Notifications.getPermissionsAsync(), 'Notification permission');
  // Not bounded: the system prompt waits for the person's answer.
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const id = projectId();
  if (!id) return 'not-configured';
  const token = (await bounded(Notifications.getExpoPushTokenAsync({ projectId: id }), 'Push token')).data;
  await serial(() => sendToken(token, lang));
  registered = token;
  return 'on';
}

/** Token work on this phone, one call at a time (a release never races a new registration). */
let chain: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = chain.then(job, job);
  chain = run.catch(() => undefined);
  return run;
}

const RELEASE_KEY = 'irly-push-release';

async function toRelease(): Promise<string[]> {
  try {
    const v: unknown = JSON.parse((await AsyncStorage.getItem(RELEASE_KEY)) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

async function setToRelease(tokens: string[]): Promise<void> {
  try {
    if (tokens.length) await AsyncStorage.setItem(RELEASE_KEY, JSON.stringify(tokens.slice(-5)));
    else await AsyncStorage.removeItem(RELEASE_KEY);
  } catch {
    // Nothing more to do: the next sign-in on this phone registers the token anyway.
  }
}

async function keepToRelease(token: string): Promise<void> {
  const list = await toRelease();
  if (!list.includes(token)) await setToRelease([...list, token]);
}

async function settled(token: string): Promise<void> {
  const list = await toRelease();
  if (list.includes(token)) await setToRelease(list.filter((x) => x !== token));
}

/** Asks the server, without a session, to stop pushing to this token. True once the server has answered. */
async function release(token: string): Promise<boolean> {
  if (!supabase) return false;
  const secret = await installSecret();
  if (!secret) return false;
  const { error } = await supabase.rpc('release_push_token', { p_token: token, p_install: secret });
  // No error: done (a token the server never bound to this install cannot be released: nothing more to try).
  // Server without release_push_token yet, or offline: kept for the next try.
  return !error;
}

/** Releases the tokens left by a sign-out that could not reach the server. */
export function releasePending(): Promise<void> {
  if (!native) return Promise.resolve();
  return serial(async () => {
    for (const token of await toRelease()) {
      if (await release(token).catch(() => false)) await settled(token);
    }
  }).catch(() => undefined);
}

const INSTALL_KEY = 'irly-push-install';
// Readable after the first unlock, so a token renewed in the background still registers.
const INSTALL_OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
let install: Promise<string | null> | null = null;

/** 32 random bytes, hex: what the server's check expects (32 to 128 of [A-Za-z0-9_-]). */
function newInstallSecret(): string {
  return Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function keptOrNew(read: () => Promise<string | null>, write: (v: string) => Promise<void>): Promise<string> {
  const kept = await read();
  if (kept && /^[A-Za-z0-9_-]{32,128}$/.test(kept)) return kept;
  const fresh = newInstallSecret();
  await write(fresh);
  return fresh;
}

/**
 * This install's secret, created once and kept across sign-outs (it belongs to
 * the install, not to an account): in the Keychain / Keystore, or in app
 * storage if the secure store fails. Null only when neither works; the token
 * is then registered the old way.
 */
function installSecret(): Promise<string | null> {
  install ??= keptOrNew(
    () => SecureStore.getItemAsync(INSTALL_KEY, INSTALL_OPTS),
    (v) => SecureStore.setItemAsync(INSTALL_KEY, v, INSTALL_OPTS),
  )
    .catch(() => keptOrNew(() => AsyncStorage.getItem(INSTALL_KEY), (v) => AsyncStorage.setItem(INSTALL_KEY, v)))
    .catch(() => null)
    .then((v) => {
      if (!v) install = null;
      return v;
    });
  return install;
}

/** A server without migration 20261020001300 does not know p_install yet (PostgREST: no such function). */
function serverWithoutInstall(error: { code?: string; message: string }): boolean {
  return error.code === 'PGRST202' || /p_install|could not find the function/i.test(error.message);
}

/** Registers the token for the signed-in account, with this install's secret when the server takes it. */
async function sendToken(token: string, lang: Lang): Promise<void> {
  if (!supabase) return;
  const args = { p_token: token, p_platform: Platform.OS, p_lang: lang };
  const secret = await installSecret();
  if (secret) {
    const { error } = await supabase.rpc('register_push_token', { ...args, p_install: secret });
    if (!error) return settled(token);
    if (!serverWithoutInstall(error)) throw new Error(error.message);
  }
  const { error } = await supabase.rpc('register_push_token', args);
  if (error) throw new Error(error.message);
  await settled(token);
}

/** Signing out: this phone stops receiving the account's notifications. */
export async function unregisterPush(): Promise<void> {
  if (!native || !supabase) return;
  // Signed out before registration finished: ask the phone for its token (no prompt) so it is still removed.
  let token = registered;
  if (!token && Device.isDevice) {
    const id = projectId();
    const granted = (await bounded(Notifications.getPermissionsAsync(), 'Notification permission').catch(() => null))?.status === 'granted';
    if (id && granted) token = (await bounded(Notifications.getExpoPushTokenAsync({ projectId: id }), 'Push token').catch(() => null))?.data ?? null;
  }
  registered = null;
  if (!token) return;
  const sb = supabase;
  await serial(async () => {
    // Kept first: if the calls below never answer (offline), the next launch releases it.
    await keepToRelease(token);
    const { error } = await sb.rpc('unregister_push_token', { p_token: token }).then(
      (r) => r,
      (e: unknown) => ({ error: e }),
    );
    // Second path, no session needed (the session may already be gone on the server).
    const released = await release(token).catch(() => false);
    if (!error || released) await settled(token);
  });
}

/** What iOS / Android allow for IRLY right now, without asking. */
export async function phonePermission(): Promise<'granted' | 'denied' | 'undetermined' | 'unsupported'> {
  if (!native || !Device.isDevice) return 'unsupported';
  const p = await bounded(Notifications.getPermissionsAsync(), 'Notification permission').catch(() => null);
  if (!p) return 'unsupported';
  return p.status === 'granted' ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

const ASKED = 'irly-push-asked';

/**
 * After an action where notifications help (a request sent, an activity or a
 * community joined, a message written): asks once per phone, never again if
 * the person said no (iOS only shows its prompt once anyway).
 */
export async function askPushInContext(lang: Lang = dateLocale() === 'fr-FR' ? 'fr' : 'en'): Promise<void> {
  if (!native || !Device.isDevice) return;
  try {
    if (await AsyncStorage.getItem(ASKED)) return;
    await AsyncStorage.setItem(ASKED, '1');
  } catch {
    return;
  }
  await registerPush(lang, true).catch(() => undefined);
}

/** Opens the screen a notification points to. */
function open(response: Notifications.NotificationResponse | null) {
  const url = (response?.notification.request.content.data as { url?: unknown } | undefined)?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
}

/**
 * Mounted once at the root: registers the phone when you are signed in
 * (and again when the language changes), and opens the right screen when
 * you tap a notification, including the one that launched the app.
 */
export function usePush() {
  const uid = useAccount()?.userId;
  const lang = useLang();

  // Signed in: register if this phone already allows notifications (no prompt here).
  useEffect(() => {
    if (!native || !uid) return;
    registerPush(lang, false).catch(() => undefined);
  }, [uid, lang]);

  // A sign-out that could not reach the server: released at launch, on return to the app, and every minute.
  useEffect(() => {
    if (!native) return;
    void releasePending();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void releasePending();
    });
    const timer = setInterval(() => void releasePending(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  // Apple or Google can renew the phone's token: the server gets the new one.
  useEffect(() => {
    if (!native || !uid) return;
    const sub = Notifications.addPushTokenListener(() => {
      registerPush(lang, false).catch(() => undefined);
    });
    return () => sub.remove();
  }, [uid, lang]);

  useEffect(() => {
    if (!native) return;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          open(r);
          Notifications.clearLastNotificationResponseAsync?.().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
