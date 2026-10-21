import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { isDestination } from './destinations';

/** Opens a checked link: an app screen in the app, a web address in the in-app browser. Anything else does nothing. */
export function openDestination(url: string | null | undefined): void {
  if (!url || !isDestination(url)) return;
  if (url.startsWith('/')) router.push(url as never);
  else void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}
