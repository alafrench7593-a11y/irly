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
