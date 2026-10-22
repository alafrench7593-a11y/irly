import { router } from 'expo-router';

/**
 * One tap, one page. PressableScale drops a second press on the SAME control,
 * but a double tap on Back lands its second tap on the page below, whose own
 * Back sits at the same spot: two pages were popped (seen on the web build at
 * 80 ms, 250 ms and 600 ms between taps). The same goes for a link tapped
 * again while its page slides in, which stacked the same page twice.
 *
 * Every screen navigates through expo-router's one `router` object (useRouter
 * returns it), so the guard is installed there once, at start:
 * - a Back within BACK_GAP of the previous Back is the same gesture: dropped;
 * - a push / navigate to the page just opened within SAME_GAP: dropped.
 * Anything else (another page, replace, a later tap) goes through unchanged.
 */
const BACK_GAP = 500;
const SAME_GAP = 1000;

let installed = false;

export function guardNavigation(): void {
  if (installed) return;
  installed = true;
  const r = router as unknown as Record<'back' | 'push' | 'navigate', (...args: unknown[]) => unknown>;
  const back = r.back;
  const push = r.push;
  const navigate = r.navigate;
  let lastBack = 0;
  let last: { key: string; at: number } = { key: '', at: 0 };

  r.back = (...args) => {
    const now = Date.now();
    if (now - lastBack < BACK_GAP) return;
    lastBack = now;
    return back(...args);
  };
  const once =
    (go: (...args: unknown[]) => unknown, kind: string) =>
    (...args: unknown[]) => {
      const now = Date.now();
      const key = `${kind}|${typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0])}`;
      if (key === last.key && now - last.at < SAME_GAP) return;
      last = { key, at: now };
      return go(...args);
    };
  r.push = once(push, 'push');
  r.navigate = once(navigate, 'navigate');
}
