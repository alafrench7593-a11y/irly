/**
 * The load scripts' own check, on top of the orchestrator's guard (scripts/staging-lib.mjs): they are
 * handed their target and refuse it if it is production, or anything else than the staging branch.
 * Plain JavaScript with no import, so both k6 and Node (scripts/test-staging-guard.mjs) can load it.
 */
export const PRODUCTION_REF = 'yqutcmgslwxcmnsqmhvy';

/**
 * `url`: where the load would go. `stagingRef`: the staging branch's reference, from the orchestrator
 * (« local » for a stand-in on this machine, then only a loopback address is accepted).
 * Returns the URL, or throws.
 */
export function assertLoadTarget(url, stagingRef, productionRef = PRODUCTION_REF) {
  if (typeof url !== 'string' || !url) throw new Error('load guard: no target URL');
  if (typeof stagingRef !== 'string' || !stagingRef) throw new Error('load guard: no staging reference');
  if (stagingRef === productionRef || stagingRef === PRODUCTION_REF) throw new Error('load guard: the staging reference is production');
  if (url.indexOf(productionRef) !== -1 || url.indexOf(PRODUCTION_REF) !== -1) throw new Error('load guard: the target names production');
  const m = /^(https?|wss?):\/\/([^/?#@:]+)(:\d+)?(?:[/?#]|$)/.exec(url);
  if (!m) throw new Error('load guard: the target is not a plain URL');
  const [, scheme, host, port] = m;
  if (stagingRef === 'local') {
    if (host !== '127.0.0.1' && host !== 'localhost') throw new Error('load guard: a local run only targets this machine');
    return url;
  }
  if (!/^[a-z]{20}$/.test(stagingRef)) throw new Error('load guard: the staging reference has the wrong shape');
  if ((scheme !== 'https' && scheme !== 'wss') || port) throw new Error('load guard: only https and wss targets');
  if (host !== stagingRef + '.supabase.co') throw new Error('load guard: the target is not the staging branch');
  return url;
}
