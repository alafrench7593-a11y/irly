import { useEffect, useState } from 'react';

/**
 * How many of a long list of sections to mount now: the first `first` at
 * once, then `step` more on each following frame, so the first frame shows
 * the top of the screen without building everything below the fold first
 * (Home: 2,600 nodes in one task, 2–3.5 s at 4x CPU on the demo web build).
 * Resets when `key` changes (a city or app-space switch).
 */
export function useProgressiveCount(total: number, first = 3, step = 2, key?: unknown): number {
  const [count, setCount] = useState(first);
  // A new key starts again from the top (adjusting state while rendering, not in an effect).
  const [seenKey, setSeenKey] = useState(key);
  if (seenKey !== key) {
    setSeenKey(key);
    setCount(first);
  }
  useEffect(() => {
    if (count >= total) return;
    let frame = 0;
    const id = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setCount((n) => Math.min(total, n + step)));
    });
    return () => {
      cancelAnimationFrame(id);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count, total, step]);
  return Math.min(count, total);
}
