/**
 * One stage of load against the STAGING branch: members using the app, members connected to Realtime,
 * Loup-Garou tables being played. Started by scripts/staging-load.mjs, which hands over the target,
 * the members' tokens and the size of the stage through the environment and a file outside the repo.
 *
 * BASE_URL, WS_URL, STAGING_REF, ANON_KEY, DATA_FILE, SIZE, USERS, RT_USERS, WW_USERS, RAMP_S, HOLD_S, DOWN_S.
 * Thresholds are reported, never enforced: k6 says they were crossed, the run goes to its end.
 */
import { assertLoadTarget } from './guard.mjs';
import { BASE, MEMBERS, WS } from './lib.js';
export { app } from './app.js';
export { realtime } from './realtime.js';
export { werewolf } from './werewolf.js';

const n = (name, fallback) => Math.max(0, Math.floor(Number(__ENV[name] || fallback)));
const users = n('USERS', 5);
const ramp = n('RAMP_S', 30);
const hold = n('HOLD_S', 180);
const down = n('DOWN_S', 20);
const stages = (target) => [
  { duration: `${ramp}s`, target },
  { duration: `${hold}s`, target },
  { duration: `${down}s`, target: 0 },
];
const scenario = (target, fn) => ({ executor: 'ramping-vus', exec: fn, startVUs: 0, stages: stages(target), gracefulRampDown: '20s', gracefulStop: '20s' });
const scenarios = { app: scenario(users, 'app') };
if (n('RT_USERS', 0) > 0 && WS) scenarios.realtime = scenario(n('RT_USERS', 0), 'realtime');
if (n('WW_USERS', 0) > 0) scenarios.werewolf = scenario(n('WW_USERS', 0), 'werewolf');

export const options = {
  scenarios,
  thresholds: {
    http_req_duration: ['p(95)<500'],
    app_errors: ['rate<0.01'],
  },
  summaryTrendStats: ['count', 'avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  userAgent: 'irly-staging-load/1 (k6)',
  noConnectionReuse: false,
  insecureSkipTLSVerify: false,
};

export function setup() {
  // Again, where a failure stops the whole run before the first request.
  assertLoadTarget(BASE, __ENV.STAGING_REF);
  if (WS) assertLoadTarget(WS, __ENV.STAGING_REF);
  if (!MEMBERS.length) throw new Error('no member to play: the orchestrator wrote no token');
}

export function handleSummary(data) {
  const out = {};
  if (__ENV.SUMMARY_FILE) out[__ENV.SUMMARY_FILE] = JSON.stringify({ metrics: data.metrics, state: data.state });
  return out;
}
