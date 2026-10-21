import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Dimensions, type View } from 'react-native';

/** How long a row stays on screen before it counts as seen: scrolling quickly past it does not. */
const SEEN_MS = 600;

/** The list scrolled: every row tracker looks again. */
export type Viewport = { listen: (fn: () => void) => () => void; moved: () => void };

/** One per screen: its Page reports scrolling (onScrolled={viewport.moved}), the lists inside listen. */
export function useViewport(): Viewport {
  const [viewport] = useState<Viewport>(() => {
    const fns = new Set<() => void>();
    return {
      listen: (fn) => {
        fns.add(fn);
        return () => void fns.delete(fn);
      },
      moved: () => fns.forEach((fn) => fn()),
    };
  });
  return viewport;
}

/**
 * "New" and "Earlier": what was unread when this visit of the list first
 * showed it is New, the rest Earlier. Seen or opened, a New one loses its
 * unread look at once (and leaves the bell) but keeps its place until the
 * list is opened again: nothing moves under the finger. History is kept.
 */
export function useSplit<T extends { id: string }>(items: T[], unread: (n: T) => boolean): { fresh: T[]; earlier: T[] } {
  const [first, setFirst] = useState<Record<string, boolean>>({});
  const added = items.filter((n) => !(n.id in first));
  let known = first;
  if (added.length) {
    // Rows new to this visit: placed now (state adjusted while rendering, React's own pattern).
    known = { ...first, ...Object.fromEntries(added.map((n) => [n.id, unread(n)])) };
    setFirst(known);
  }
  return { fresh: items.filter((n) => known[n.id]), earlier: items.filter((n) => !known[n.id]) };
}

/**
 * Notifications actually seen. A row counts once at least half of it has been
 * inside the window for SEEN_MS, while this list is the screen in front
 * (focused) and the app is open: rows loaded below the fold, a list left open
 * under another page, or one updated while the phone is locked are not seen.
 * `unread` are the ids still to see; `onSeen` gets them in batches. Returns
 * the ref to put on each row (on a plain View).
 */
export function useSeen(unread: string[], viewport: Viewport, onSeen: (ids: string[]) => void): (id: string) => (v: View | null) => void {
  const rows = useRef(new Map<string, View>());
  const refs = useRef(new Map<string, (v: View | null) => void>());
  // id → when it was first found on screen (this time round).
  const since = useRef(new Map<string, number>());
  const focused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const want = useRef(unread);
  const seen = useRef(onSeen);
  useEffect(() => {
    want.current = unread;
    seen.current = onSeen;
  });

  const check = useCallback(function check() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!focused.current || AppState.currentState !== 'active') {
      since.current.clear();
      return;
    }
    const ids = want.current.filter((id) => rows.current.has(id));
    since.current.forEach((_, id) => {
      if (!ids.includes(id)) since.current.delete(id);
    });
    const height = Dimensions.get('window').height;
    const now = Date.now();
    const ready: string[] = [];
    let left = ids.length;
    ids.forEach((id) =>
      rows.current.get(id)?.measureInWindow((_x, y, _w, h) => {
        const middle = y + h / 2;
        if (h > 0 && middle >= 0 && middle <= height) {
          const first = since.current.get(id);
          if (first === undefined) since.current.set(id, now);
          else if (now - first >= SEEN_MS - 50) {
            since.current.delete(id);
            ready.push(id);
          }
        } else since.current.delete(id);
        left -= 1;
        if (left > 0) return;
        if (ready.length) seen.current(ready);
        // Rows on screen but not long enough yet: looked at again in a moment.
        if (since.current.size && !timer.current) timer.current = setTimeout(check, SEEN_MS);
      }),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      check();
      return () => {
        focused.current = false;
        since.current.clear();
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
      };
    }, [check]),
  );
  useEffect(() => viewport.listen(check), [viewport, check]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, [check]);
  // New rows (or rows read elsewhere): once they are laid out.
  const key = unread.join(',');
  useEffect(() => {
    const t = setTimeout(check, 50);
    return () => clearTimeout(t);
  }, [key, check]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback((id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (v: View | null) => {
        if (v) rows.current.set(id, v);
        else rows.current.delete(id);
      };
      refs.current.set(id, ref);
    }
    return ref;
  }, []);
}
