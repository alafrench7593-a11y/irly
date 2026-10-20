import { Platform } from 'react-native';

/**
 * The web app, kept on the version that is online. A browser tab (or the
 * app saved to the phone's home screen) keeps running the code it loaded,
 * however many releases go out after it: getirly.com/app could show an
 * older IRLY than the one deployed. Each build writes its id into the
 * bundle (EXPO_PUBLIC_BUILD_ID) and next to it (version.json); when the
 * page comes back to the front, and every few minutes, the app compares
 * them and reloads itself on a newer one. Once per version, so a cache
 * that still serves the old page never loops.
 */

const BUILD = process.env.EXPO_PUBLIC_BUILD_ID ?? '';
const EVERY = 5 * 60_000;
const SEEN = 'irly-reloaded-for';

/** Where the app is served: /app on getirly.com, /demo, /irly on GitHub Pages, the root locally. */
function base(): string {
  const first = window.location.pathname.split('/')[1] ?? '';
  return ['app', 'demo', 'irly'].includes(first) ? `/${first}` : '';
}

async function check(): Promise<void> {
  try {
    const res = await fetch(`${base()}/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const online = String(((await res.json()) as { v?: unknown }).v ?? '');
    if (!online || online === BUILD) return;
    if (window.sessionStorage.getItem(SEEN) === online) return;
    window.sessionStorage.setItem(SEEN, online);
    window.location.reload();
  } catch {
    // Offline, or no version file (a local build): stay on this version.
  }
}

/** Starts the check on the web, in a build that knows its id. */
export function watchWebUpdates(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !BUILD) return;
  void check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void check();
  }, EVERY);
}
