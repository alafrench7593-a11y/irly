// Checks scripts/storage-purge.mjs against local stand-ins of the Supabase APIs
// (REST, Storage, Management): which access each run uses, that the project
// key never touches the Management API, the fallback while the REST wrappers
// are not deployed, and that no key reaches the logs. Nothing leaves this machine.
//   npm run test:purge
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const SCRIPT = path.join(path.dirname(new URL(import.meta.url).pathname), 'storage-purge.mjs');
const KEY = 'sb_secret_TESTONLY0123456789abcdefghij';
const TOKEN = 'sbp_TESTONLY0123456789abcdefghijklmnop';

let failed = 0;
const check = (ok, label) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.log(`✗ ${label}`);
  }
};

/** One fake project: a queue of two files; wrappers deployed or not. */
function fakeProject({ wrappers }) {
  const hits = { rest: [], storage: [], mgmt: [], auth: [] };
  let queue = [
    { bucket_id: 'profile-photos', name: 'u1/a.jpg' },
    { bucket_id: 'profile-photos', name: 'u1/b.jpg' },
  ];
  const status = () => ({ waiting: queue.length, in_progress: 0, flagged: 0, done: 2 - queue.length });
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (code, json) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(json === undefined ? '' : JSON.stringify(json));
      };
      const url = req.url ?? '';
      if (url.startsWith('/rest/v1/rpc/')) {
        hits.rest.push(url);
        hits.auth.push(req.headers.apikey);
        if (!wrappers) return send(404, { code: 'PGRST202', message: 'Could not find the function' });
        const fn = url.split('/').pop();
        const args = body ? JSON.parse(body) : {};
        if (fn === 'storage_purge_status') return send(200, status());
        if (fn === 'storage_purge_sweep') return send(200, 0);
        if (fn === 'storage_purge_claim') {
          const out = queue;
          queue = [];
          return send(200, out);
        }
        if (fn === 'storage_purge_done') return send(200, { done: args.p_names.length, still_stored: 0 });
        if (fn === 'storage_purge_failed') return send(200, args.p_names.length);
        return send(404, {});
      }
      if (url.startsWith('/storage/v1/object/')) {
        hits.storage.push(url);
        hits.auth.push(req.headers.apikey);
        return send(200, []);
      }
      if (url.startsWith('/v1/projects/')) {
        hits.mgmt.push(url);
        if (url.includes('/api-keys')) return send(200, [{ type: 'secret', api_key: KEY }]);
        const q = JSON.parse(body).query;
        if (q.includes('to_regprocedure')) return send(200, [{ ok: true }]);
        if (q.includes('storage_purge_sweep')) return send(200, [{ n: 0 }]);
        if (q.includes('storage_purge_claim')) {
          const out = queue;
          queue = [];
          return send(200, out);
        }
        if (q.includes('storage_purge_done')) return send(200, [{ r: { done: 2, still_stored: 0 } }]);
        if (q.includes('storage_purge_status')) return send(200, [{ s: status() }]);
        return send(200, []);
      }
      send(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, hits, base: `http://127.0.0.1:${server.address().port}` })));
}

function run(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT], { env: { PATH: process.env.PATH, ...env } });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('close', (code) => resolve({ code, out }));
  });
}

// 1. Project key, wrappers deployed: REST + Storage only, never the Management API.
{
  const p = await fakeProject({ wrappers: true });
  const r = await run({ SUPABASE_PURGE_KEY: KEY, SUPABASE_URL: p.base, SUPABASE_API_URL: p.base });
  p.server.close();
  check(r.code === 0, 'key: the run succeeds');
  check(/access: project secret key/.test(r.out), 'key: it says it uses the project key');
  check(p.hits.mgmt.length === 0, 'key: no Management API call at all');
  check(p.hits.storage.length === 1 && /2 removed/.test(r.out), 'key: the two queued files are deleted and marked done');
  check(p.hits.auth.every((k) => k === KEY), 'key: every call carries the project key');
  check(!r.out.includes(KEY), 'key: the key never appears in the output');
}

// 2. Project key set, wrappers not deployed yet, token present: falls back to the token, says so.
{
  const p = await fakeProject({ wrappers: false });
  const r = await run({ SUPABASE_PURGE_KEY: KEY, SUPABASE_ACCESS_TOKEN: TOKEN, SUPABASE_URL: p.base, SUPABASE_API_URL: p.base });
  p.server.close();
  check(r.code === 0, 'fallback: the run succeeds');
  check(/not deployed yet/.test(r.out) && /access: personal access token/.test(r.out), 'fallback: uses the token and says why');
  check(!r.out.includes(KEY) && !r.out.includes(TOKEN), 'fallback: no key or token in the output');
}

// 3. Project key set, wrappers not deployed, no token: stops with an error, deletes nothing.
{
  const p = await fakeProject({ wrappers: false });
  const r = await run({ SUPABASE_PURGE_KEY: KEY, SUPABASE_URL: p.base, SUPABASE_API_URL: p.base });
  p.server.close();
  check(r.code === 1 && p.hits.storage.length === 0, 'key without wrappers and no token: fails, nothing deleted');
}

// 4. Token only (today's setup): unchanged behaviour.
{
  const p = await fakeProject({ wrappers: true });
  const r = await run({ SUPABASE_ACCESS_TOKEN: TOKEN, SUPABASE_URL: p.base, SUPABASE_API_URL: p.base });
  p.server.close();
  check(r.code === 0 && /access: personal access token/.test(r.out) && p.hits.rest.length === 0, 'token only: as before, through the Management API');
}

// 5. Nothing set: refuses.
{
  const r = await run({});
  check(r.code === 1 && /Neither SUPABASE_PURGE_KEY/.test(r.out), 'no access at all: refuses, says what is missing');
}

console.log(failed ? `\n${failed} purge check(s) failed` : '\npurge ok');
process.exit(failed ? 1 : 0);
