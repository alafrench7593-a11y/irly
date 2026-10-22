import { useCallback, useRef, useState } from 'react';

/**
 * One server action at a time on a screen, for buttons that wait for an
 * answer (leave, delete, block, mute…). The lock is a ref, taken in the
 * same tick as the tap: two taps in one frame both read a state `busy` that
 * is still null. `busy` names the action running, for its button's spinner;
 * every button is free again once it ends, success or not, so a failed
 * action can be tried again. The action handles its own errors (a toast).
 */
export function useBusy<K extends string = string>() {
  const running = useRef(false);
  const [busy, setBusy] = useState<K | null>(null);
  const run = useCallback(async (key: K, action: () => Promise<unknown>): Promise<void> => {
    if (running.current) return;
    running.current = true;
    setBusy(key);
    try {
      await action();
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, []);
  /** True while an action runs (read in a handler: never stale). */
  const isRunning = useCallback(() => running.current, []);
  return { busy, run, isRunning };
}
