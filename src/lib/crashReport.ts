import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import { track } from '@/lib/analytics';
import { scrubDetail, scrubRoute } from '@/lib/crashScrub';

/**
 * Crash reports, through the app's own analytics (public.analytics_events):
 * no third-party service, nothing new to declare to the stores.
 *
 * What a report holds: the kind of error (TypeError…), a scrubbed first line
 * of its message (no quoted text, numbers, ids, emails or links), the screen
 * (ids replaced by :id), whether it was fatal, the app version and the
 * over-the-air update it ran. Never the error's full text, a stack or
 * anything a member typed. Read back by scripts/health-check.mjs.
 */

const PENDING = 'irly.crash.pending';
const MAX_PER_SESSION = 20;
let sent = 0;
let route = '';

/** The screen shown, for the reports: ids and numbers removed. */
export function setCrashRoute(pathname: string): void {
  route = scrubRoute(pathname);
}

type Report = { kind: string; detail: string; screen: string; fatal: boolean; app: string; ota: string };

function describe(error: unknown, fatal: boolean, screen?: string): Report {
  const e = error as { name?: unknown; message?: unknown } | null;
  return {
    kind: typeof e?.name === 'string' ? e.name.slice(0, 40) : 'Error',
    detail: scrubDetail(e?.message ?? (typeof error === 'string' ? error : '')),
    screen: screen ?? (route || 'unknown'),
    fatal,
    app: Constants.expoConfig?.version ?? '?',
    ota: Updates.updateId ? Updates.updateId.slice(0, 8) : 'embedded',
  };
}

/** A screen's ErrorBoundary caught a crash. */
export function reportScreenError(error: unknown, screen: string): void {
  if (sent >= MAX_PER_SESSION) return;
  sent += 1;
  track('SCREEN_ERROR', { ...describe(error, false, screen) });
}

function reportJsError(error: unknown, fatal: boolean): void {
  if (sent >= MAX_PER_SESSION) return;
  sent += 1;
  track('JS_ERROR', { ...describe(error, fatal) });
}

/** A fatal error ends the app before the analytics batch leaves: kept on the device, sent at next launch. */
async function keepForNextLaunch(error: unknown): Promise<void> {
  const write = AsyncStorage.setItem(PENDING, JSON.stringify(describe(error, true)));
  await Promise.race([write, new Promise((r) => setTimeout(r, 800))]);
}

async function sendPending(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING);
    if (!raw) return;
    await AsyncStorage.removeItem(PENDING);
    const r = JSON.parse(raw) as Partial<Report>;
    track('JS_ERROR', { kind: r.kind, detail: r.detail, screen: r.screen, fatal: true, app: r.app, ota: r.ota, late: true });
  } catch {
    // Unreadable storage: that report is lost, the app goes on.
  }
}

let installed = false;

/** Listens for errors no screen caught (event handlers, timers, promises). Called once, at startup. */
export function installCrashReporting(): void {
  if (installed) return;
  installed = true;
  void sendPending();

  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (ev) => reportJsError(ev.error ?? ev.message, false));
    window.addEventListener('unhandledrejection', (ev) => reportJsError(ev.reason, false));
    return;
  }

  type Handler = (error: unknown, isFatal?: boolean) => void;
  const utils = (globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void } }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) {
      reportJsError(error, false);
      previous(error, isFatal);
      return;
    }
    // The previous handler ends the app: the report is written first (at most 0.8 s).
    void keepForNextLaunch(error).finally(() => previous(error, isFatal));
  });
}
