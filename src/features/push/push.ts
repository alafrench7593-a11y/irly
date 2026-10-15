import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
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
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS, p_lang: lang });
  if (error) throw new Error(error.message);
  registered = token;
  return 'on';
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
  if (token) await supabase.rpc('unregister_push_token', { p_token: token });
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
