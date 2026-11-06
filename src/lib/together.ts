/**
 * Reads asked for in the same moment share ONE request. Several components
 * of a screen often read the same thing as they mount (Home's live faces and
 * its Live strip, the bell and the Notifications page, two IRLY Girl doors),
 * and a sync bump reaches them all at once: each used to send its own copy.
 *
 * The shared request is sent once the current task is over, so it starts
 * after every caller asked: it is as fresh as each of them needs. A caller
 * coming once it has been sent gets a new request (never an older answer).
 * `key` must name everything the request depends on (account, city, space…).
 */
const waiting = new Map<string, Promise<unknown>>();

export function together<T>(key: string, run: () => PromiseLike<T>): Promise<T> {
  const asked = waiting.get(key) as Promise<T> | undefined;
  if (asked) return asked;
  const p = new Promise<void>((go) => setTimeout(go, 0)).then(() => {
    // Sent now: a caller from here on asks again.
    waiting.delete(key);
    return run();
  });
  waiting.set(key, p);
  return p;
}

const kept = new Map<string, { at: number; p: Promise<unknown> }>();
/**
 * Like together(), and an answer read less than `ms` ago is handed out again
 * (a tab opened right after another one that read the same list). `key`
 * must also carry the sync version of what it reads, so a change bumps it
 * and the next caller reads again. A failed read (an error answer or a
 * thrown one) is never kept.
 */
export function togetherRecent<T>(key: string, ms: number, run: () => PromiseLike<T>): Promise<T> {
  const now = Date.now();
  const hit = kept.get(key);
  if (hit && now - hit.at < ms) return hit.p as Promise<T>;
  if (kept.size > 50) for (const [k, v] of kept) if (now - v.at >= ms) kept.delete(k);
  const p = together(key, run);
  kept.set(key, { at: now, p });
  const drop = () => {
    if (kept.get(key)?.p === p) kept.delete(key);
  };
  p.then((r) => (r && typeof r === 'object' && 'error' in r && (r as { error: unknown }).error ? drop() : undefined), drop);
  return p;
}
