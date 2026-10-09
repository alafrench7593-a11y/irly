import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAccount } from '@/features/auth/account';
import { useLang, type Lang } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Phone notifications. Each signed-in phone registers its Expo push token
 * on the server (register_push_token); the server pushes every
 * notification you have not muted (see migration 2700), titled in the
 * phone's language, with the screen to open. Tapping one opens that
 * screen. On the web nothing happens here.
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

/** Asks permission (once), then registers this phone for your notifications. */
export async function registerPush(lang: Lang, ask = true): Promise<PushState> {
  if (!native || !Device.isDevice || !supabase) return 'unsupported';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'IRLY', importance: Notifications.AndroidImportance.HIGH }).catch(() => undefined);
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'denied';
  const id = projectId();
  if (!id) return 'not-configured';
  const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
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
    const granted = (await Notifications.getPermissionsAsync().catch(() => null))?.status === 'granted';
    if (id && granted) token = (await Notifications.getExpoPushTokenAsync({ projectId: id }).catch(() => null))?.data ?? null;
  }
  registered = null;
  if (token) await supabase.rpc('unregister_push_token', { p_token: token });
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

  useEffect(() => {
    if (!native || !uid) return;
    registerPush(lang).catch(() => undefined);
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
