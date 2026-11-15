/**
 * The staging guard refuses production and anything it cannot prove to be the staging branch.
 * No network: the Management API is a stand-in. Run: node scripts/test-staging-guard.mjs
 */
import assert from 'node:assert/strict';
import { PRODUCTION_REF, assertStaging, createStaging, stagingRefFrom } from './staging-lib.mjs';
import { PRODUCTION_REF as LOAD_PRODUCTION_REF, assertLoadTarget } from './load/guard.mjs';

const STAGING = 'opnvyzxzikuqcigqfsvr';
const good = [
  { name: 'main', project_ref: PRODUCTION_REF, parent_project_ref: PRODUCTION_REF, is_default: true },
  { name: 'staging', project_ref: STAGING, parent_project_ref: PRODUCTION_REF, is_default: false },
];
const withStaging = (patch) => [good[0], { ...good[1], ...patch }];
let n = 0;
const refuses = (what, fn) => {
  n += 1;
  assert.throws(fn, /staging guard|load guard/, what);
};

// The staging branch, and only it.
assert.equal(stagingRefFrom(good), STAGING);
assert.equal(assertStaging(STAGING, good), STAGING);
assert.equal(assertStaging(`/projects/${STAGING}/database/query`, good), STAGING);
assert.equal(assertStaging(`https://${STAGING}.supabase.co/rest/v1`, good), STAGING);
assert.equal(assertStaging(`wss://${STAGING}.supabase.co/realtime/v1/websocket`, good), STAGING);

// Production, however it is named.
refuses('production reference', () => assertStaging(PRODUCTION_REF, good));
refuses('production path', () => assertStaging(`/projects/${PRODUCTION_REF}/database/query`, good));
refuses('production URL', () => assertStaging(`https://${PRODUCTION_REF}.supabase.co/rest/v1`, good));
refuses('production websocket', () => assertStaging(`wss://${PRODUCTION_REF}.supabase.co/realtime/v1/websocket`, good));
refuses('production in a query string', () => assertStaging(`https://${STAGING}.supabase.co/rest/v1?x=${PRODUCTION_REF}`, good));
refuses('staging branch that is production', () => assertStaging(PRODUCTION_REF, withStaging({ project_ref: PRODUCTION_REF })));
refuses('staging branch marked default', () => assertStaging(STAGING, withStaging({ is_default: true })));
refuses('staging branch with no default flag', () => assertStaging(STAGING, withStaging({ is_default: undefined })));
refuses('staging branch of another project', () => assertStaging(STAGING, withStaging({ parent_project_ref: 'abcdefghijklmnopqrst' })));

// A missing or odd branch list.
for (const [what, list] of [
  ['no list', undefined],
  ['null', null],
  ['an error object', { failed: '401' }],
  ['an empty list', []],
  ['no staging branch', [good[0]]],
  ['two staging branches', [...good, { ...good[1], project_ref: 'abcdefghijklmnopqrst' }]],
  ['a staging branch without a reference', withStaging({ project_ref: undefined })],
  ['a reference of the wrong shape', withStaging({ project_ref: 'opnv/../x' })],
  ['a list of nothing', [null]],
]) {
  refuses(what, () => stagingRefFrom(list));
  refuses(what, () => assertStaging(STAGING, list));
}

// Another project, another host, another scheme.
refuses('another reference', () => assertStaging('abcdefghijklmnopqrst', good));
refuses('another host', () => assertStaging(`https://${STAGING}.supabase.co.example.com/rest/v1`, good));
refuses('another domain', () => assertStaging(`https://${STAGING}.example.com/`, good));
refuses('userinfo trick', () => assertStaging(`https://${STAGING}.supabase.co@example.com/`, good));
refuses('plain http', () => assertStaging(`http://${STAGING}.supabase.co/`, good));
refuses('a port', () => assertStaging(`https://${STAGING}.supabase.co:8443/`, good));
refuses('a path without a project', () => assertStaging('/organizations', good));
refuses('an empty target', () => assertStaging('', good));
refuses('no target', () => assertStaging(undefined, good));

// The door: with a sound list, calls go to the staging branch only; production is asked for its branch list and nothing else.
const seen = [];
const fakeFetch = (list) => async (url, init) => {
  seen.push(`${init.method} ${url}`);
  const body = url.endsWith(`/projects/${PRODUCTION_REF}/branches`) ? list : [{ ok: 1 }];
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};
{
  const api = createStaging({ token: 'sbp_test', fetch: fakeFetch(good) });
  await api.sql('select 1');
  await api.request('GET', '/postgrest');
  const t = await api.targets();
  assert.equal(t.rest, `https://${STAGING}.supabase.co/rest/v1`);
  assert.equal(t.realtime, `wss://${STAGING}.supabase.co/realtime/v1/websocket`);
  assert.deepEqual(
    seen.filter((s) => s.includes(PRODUCTION_REF)),
    [`GET https://api.supabase.com/v1/projects/${PRODUCTION_REF}/branches`],
  );
  assert.equal(seen.filter((s) => s.includes(`/projects/${STAGING}/`)).length, 2);
}
// With a list that is wrong, nothing is sent after the list itself.
for (const list of [[], [good[0]], withStaging({ project_ref: PRODUCTION_REF }), withStaging({ is_default: true }), { message: 'Unauthorized' }]) {
  seen.length = 0;
  const api = createStaging({ token: 'sbp_test', fetch: fakeFetch(list) });
  await assert.rejects(api.sql('insert into x values (1)'), /staging guard/);
  await assert.rejects(api.request('POST', '/database/query', { query: 'select 1' }), /staging guard/);
  await assert.rejects(api.targets(), /staging guard/);
  n += 3;
  assert.deepEqual(seen, [`GET https://api.supabase.com/v1/projects/${PRODUCTION_REF}/branches`]);
}
// A failing list (401, network) stops everything too.
{
  const api = createStaging({ token: 'sbp_test', fetch: async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' }) });
  await assert.rejects(api.sql('select 1'), /401/);
  n += 1;
}

// The load scripts' own check (they receive their URL from the orchestrator and trust nothing).
assert.equal(assertLoadTarget(`https://${STAGING}.supabase.co`, STAGING, PRODUCTION_REF), `https://${STAGING}.supabase.co`);
refuses('load: production URL', () => assertLoadTarget(`https://${PRODUCTION_REF}.supabase.co`, STAGING, PRODUCTION_REF));
refuses('load: production as the staging reference', () => assertLoadTarget(`https://${PRODUCTION_REF}.supabase.co`, PRODUCTION_REF, PRODUCTION_REF));
refuses('load: no URL', () => assertLoadTarget('', STAGING, PRODUCTION_REF));
refuses('load: no staging reference', () => assertLoadTarget(`https://${STAGING}.supabase.co`, '', PRODUCTION_REF));
refuses('load: another Supabase project', () => assertLoadTarget('https://abcdefghijklmnopqrst.supabase.co', STAGING, PRODUCTION_REF));
refuses('load: production in the path', () => assertLoadTarget(`https://${STAGING}.supabase.co/${PRODUCTION_REF}`, STAGING, PRODUCTION_REF));
refuses('load: another host', () => assertLoadTarget('https://example.com', STAGING, PRODUCTION_REF));
refuses('load: plain http to staging', () => assertLoadTarget(`http://${STAGING}.supabase.co`, STAGING, PRODUCTION_REF));
refuses('load: a local run aimed elsewhere', () => assertLoadTarget(`https://${STAGING}.supabase.co`, 'local', PRODUCTION_REF));
refuses('load: userinfo trick', () => assertLoadTarget(`https://${STAGING}.supabase.co@example.com/`, STAGING, PRODUCTION_REF));
assert.equal(assertLoadTarget('http://127.0.0.1:54399', 'local'), 'http://127.0.0.1:54399');
assert.equal(LOAD_PRODUCTION_REF, PRODUCTION_REF, 'both guards name the same production');

console.log(`staging guard: ${n} refusals checked, staging accepted, production never called beyond its branch list`);
