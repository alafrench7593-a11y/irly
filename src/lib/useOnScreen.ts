import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** How long the app may be left before a screen stops listening (a link, a photo, a glance elsewhere). */
const AWAY_MS = 30_000;

/**
 * True while this screen is the one in front and the app is open. A screen
 * under another one, or an app left for more than a moment, shows nothing:
 * a listener that only serves what is on screen can stop meanwhile, and
 * catch up when it listens again (whenListening).
 */
export function useOnScreen(): boolean {
  const focused = useIsFocused();
  const [here, setHere] = useState(true);
  useEffect(() => {
    let away: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (away) clearTimeout(away);
        away = null;
        setHere(true);
      } else if (state === 'background' && !away) {
        away = setTimeout(() => {
          away = null;
          setHere(false);
        }, AWAY_MS);
      }
    });
    return () => {
      if (away) clearTimeout(away);
      sub.remove();
    };
  }, []);
  return focused && here;
}
