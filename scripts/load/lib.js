/**
 * What the k6 scenarios share: the target (checked, never production), the fictitious members and
 * their tokens (from a file the orchestrator writes outside the repository), one way to call the API
 * that measures and counts, and the metrics the orchestrator's summary reads.
 * Nothing here logs a token or a key.
 */
import http from 'k6/http';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import { assertLoadTarget } from './guard.mjs';
import { ids, plan } from './plan.mjs';

export const BASE = __ENV.BASE_URL;
export const WS = __ENV.WS_URL;
export const ANON = __ENV.ANON_KEY || '';
// Refused before a single request leaves (and again in setup(), see main.js).
assertLoadTarget(BASE, __ENV.STAGING_REF);
if (WS) assertLoadTarget(WS, __ENV.STAGING_REF);
export const REST = `${BASE}/rest/v1`;
export const PLAN = plan(__ENV.SIZE || 'small');

// { n, t }: member number and access token. Shared between virtual users (one copy in memory).
export const MEMBERS = new SharedArray('members', () => JSON.parse(open(__ENV.DATA_FILE)).members);
// { room, kind, n, t, seat }: one entry per seat of a Loup-Garou table.
export const SEATS = new SharedArray('seats', () => JSON.parse(open(__ENV.DATA_FILE)).seats);

export const GROUPS = ['open_app', 'open_chat', 'send_direct', 'send_community', 'community', 'activities', 'werewolf', 'realtime'];
export const ENDPOINTS = [
  'rpc/my_profile', 'rpc/my_conversations', 'rpc/home_feed', 'rpc/my_calendar', 'rpc/live_feed', 'rpc/games_overview', 'notifications', 'conversation_members', 'activities',
  'conversations', 'messages', 'rpc/chat_members', 'rpc/mark_conversation_read', 'messages:insert',
  'rpc/community_detail', 'rpc/community_header', 'rpc/community_posts_page', 'rpc/engagement', 'rpc/set_like', 'rpc/comment_thread', 'comments:insert',
  'rpc/activity_detail', 'rpc/join_activity', 'rpc/leave_activity',
  'rpc/game_room', 'rpc/ww_view', 'rpc/ww_act', 'rpc/game_ping', 'game_messages',
];
const metricName = (s) => s.replace(/[^a-zA-Z0-9]/g, '_');
const groupTime = {};
const groupRequests = {};
const groupErrors = {};
for (const g of GROUPS) {
  groupTime[g] = new Trend(`grp_${g}`, true);
  groupRequests[g] = new Counter(`req_${g}`);
  groupErrors[g] = new Counter(`err_${g}`);
}
const endpointTime = {};
const endpointErrors = {};
for (const e of ENDPOINTS) {
  endpointTime[e] = new Trend(`ep_${metricName(e)}`, true);
  endpointErrors[e] = new Counter(`eperr_${metricName(e)}`);
}
export const errorRate = new Rate('app_errors');
export const skipped = new Counter('skipped_steps');

/**
 * This virtual user's rank in its scenario (0, 1, 2…). k6 numbers virtual users across scenarios in no
 * useful order; the first iteration's number is dense because every scenario here keeps a virtual user
 * in ONE long iteration (it loops until k6 stops it).
 */
let rank = null;
export function ordinal() {
  if (rank === null) rank = exec.scenario.iterationInInstance;
  return rank;
}
/** Member number `n` (1-based) as a player; when fewer members have a token than the stage wanted, they are shared. */
export function member(n) {
  const m = MEMBERS[(n - 1) % MEMBERS.length];
  return { n: m.n, id: ids.member(m.n), token: m.t };
}
export const USERS = Math.max(1, Math.floor(Number(__ENV.USERS || 5)));
export const RT_USERS = Math.max(1, Math.floor(Number(__ENV.RT_USERS || 1)));
export const headers = (token, extra) => Object.assign({ apikey: ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, extra || {});

let logged = 0;
/** One line per failure for the orchestrator to count (a few per virtual user at most), ids and numbers removed. */
function report(group, endpoint, res) {
  if (logged >= 8) return;
  logged += 1;
  let text = '';
  try {
    const b = res.json();
    text = `${b.code || ''} ${b.message || b.msg || b.error_description || b.error || ''}`;
  } catch {
    text = String(res.body || res.error || '').slice(0, 120);
  }
  text = text.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<id>').replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim().slice(0, 140);
  console.error(`LOADERR|${group}|${endpoint}|${res.status}|${text}`);
}

/** Records one answer. `ok`: statuses that are not failures (for instance 409: already there). */
export function record(group, endpoint, res, ok) {
  const good = (res.status >= 200 && res.status < 300) || (ok && ok.indexOf(res.status) !== -1);
  groupTime[group].add(res.timings.duration);
  groupRequests[group].add(1);
  if (endpointTime[endpoint]) endpointTime[endpoint].add(res.timings.duration);
  errorRate.add(!good);
  if (!good) {
    groupErrors[group].add(1);
    if (endpointErrors[endpoint]) endpointErrors[endpoint].add(1);
    report(group, endpoint, res);
  }
  return good;
}

const tags = (group, endpoint) => ({ group, name: endpoint });
/** A request description for http.batch (the app sends these together), or for one(). Bodies are kept: a refusal's text is what the summary reports. */
export function req(group, endpoint, token, method, path, body, opts) {
  const o = opts || {};
  return {
    group,
    endpoint,
    ok: o.ok,
    method,
    url: `${REST}/${path}`,
    body: body === undefined || body === null ? null : JSON.stringify(body),
    params: { headers: headers(token, o.headers), tags: tags(group, endpoint), responseType: 'text', timeout: '30s' },
  };
}
export const rpc = (group, token, fn, args, opts) => req(group, `rpc/${fn}`, token, 'POST', `rpc/${fn}`, args || {}, opts);
export const get = (group, endpoint, token, query, opts) => req(group, endpoint, token, 'GET', `${endpoint}?${query}`, null, opts);

export function one(r) {
  const res = http.request(r.method, r.url, r.body, r.params);
  record(r.group, r.endpoint, res, r.ok);
  return res;
}
export function together(list) {
  const out = http.batch(list.map((r) => ({ method: r.method, url: r.url, body: r.body, params: r.params })));
  list.forEach((r, i) => record(r.group, r.endpoint, out[i], r.ok));
  return out;
}
export const json = (res) => {
  try {
    return res.status >= 200 && res.status < 300 && res.body ? res.json() : null;
  } catch {
    return null;
  }
};
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const between = (a, b) => a + Math.random() * (b - a);
export function uuid() {
  const h = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < 36; i += 1) s += i === 8 || i === 13 || i === 18 || i === 23 ? '-' : i === 14 ? '4' : i === 19 ? h[8 + Math.floor(Math.random() * 4)] : h[Math.floor(Math.random() * 16)];
  return s;
}
