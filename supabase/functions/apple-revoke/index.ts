/**
 * Sign in with Apple: revoke the member's Apple tokens when the account is
 * deleted (App Store Review Guideline 5.1.1(v), Apple's REST endpoint
 * https://appleid.apple.com/auth/revoke).
 *
 * Called by the app (supabase.functions.invoke('apple-revoke'), with the
 * member's session) with one of:
 *   { action: 'store', code }  right after a native Sign in with Apple: the
 *                              one-time authorization code is exchanged for
 *                              Apple's refresh token, kept in
 *                              private.apple_tokens (never on the phone).
 *   { action: 'revoke' }       before the account is deleted: the member's
 *                              token goes on private.apple_revoke_queue and
 *                              the queue is revoked.
 * Every call also revokes up to 5 tokens left on the queue (accounts deleted
 * another way: the database queues their token when the sign-in account goes).
 *
 * Environment (Supabase → Edge Functions → Secrets; set by the owner, never
 * in the app or in this repository):
 *   APPLE_TEAM_ID       the Apple Developer Team ID (10 characters)
 *   APPLE_KEY_ID        the Key ID of a "Sign in with Apple" key
 *   APPLE_PRIVATE_KEY   that key's .p8 file content (PEM; "\n" accepted)
 *   APPLE_CLIENT_ID     optional, the app's bundle id (default app.irly.mobile)
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
 * by the Edge Functions runtime itself.
 * Without the Apple variables the function answers { ok: false,
 * configured: false } and changes nothing at Apple; 'revoke' still queues
 * the token, so it is revoked once the key is set.
 * Deploy: supabase functions deploy apple-revoke
 */
export {};

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const APPLE = 'https://appleid.apple.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const env = (name: string) => (Deno.env.get(name) ?? '').trim();

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Apple = { team: string; keyId: string; key: string; clientId: string };

function appleConfig(): Apple | null {
  const team = env('APPLE_TEAM_ID');
  const keyId = env('APPLE_KEY_ID');
  const key = env('APPLE_PRIVATE_KEY').replace(/\\n/g, '\n');
  const clientId = env('APPLE_CLIENT_ID') || 'app.irly.mobile';
  return team && keyId && key ? { team, keyId, key, clientId } : null;
}

/** The client secret Apple asks for: an ES256 JWT signed with the Sign in with Apple key, valid 5 minutes. */
async function clientSecret(apple: Apple): Promise<string> {
  const body = apple.key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const text = new TextEncoder();
  const head = base64url(text.encode(JSON.stringify({ alg: 'ES256', kid: apple.keyId })));
  const claims = base64url(text.encode(JSON.stringify({ iss: apple.team, iat: now, exp: now + 300, aud: APPLE, sub: apple.clientId })));
  // WebCrypto signs ECDSA as r || s (64 bytes): the JWS form.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, text.encode(`${head}.${claims}`)));
  return `${head}.${claims}.${base64url(sig)}`;
}

async function applePost(apple: Apple, path: string, fields: Record<string, string>): Promise<{ status: number; json: Record<string, unknown> }> {
  const form = new URLSearchParams({ client_id: apple.clientId, client_secret: await clientSecret(apple), ...fields });
  const res = await fetch(`${APPLE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

/** The database, as the service role (only these functions are granted to it; see migration 20261103200000). */
async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  const url = env('SUPABASE_URL');
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** The member calling, from the session the app sent (null when there is none). */
async function caller(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!/^Bearer \S+$/.test(auth)) return null;
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: auth } });
  if (!res.ok) return null;
  const user = (await res.json().catch(() => null)) as { id?: string } | null;
  return typeof user?.id === 'string' ? user.id : null;
}

/** Revokes what waits on the queue; returns how many were revoked. */
async function drain(apple: Apple, limit: number): Promise<number> {
  const rows = ((await rpc('apple_revoke_take', { p_limit: limit })) ?? []) as { id: number; refresh_token: string }[];
  let revoked = 0;
  for (const row of rows) {
    try {
      const { status, json } = await applePost(apple, '/auth/revoke', { token: row.refresh_token, token_type_hint: 'refresh_token' });
      // A token Apple no longer knows (already revoked, expired) has nothing left to revoke.
      const ok = status === 200 || json.error === 'invalid_grant';
      await rpc('apple_revoke_done', { p_id: row.id, p_ok: ok, p_error: ok ? null : `${status} ${String(json.error ?? '')}` });
      if (ok) revoked += 1;
    } catch (e) {
      await rpc('apple_revoke_done', { p_id: row.id, p_ok: false, p_error: e instanceof Error ? e.message : String(e) }).catch(() => undefined);
    }
  }
  return revoked;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false });
  if (!env('SUPABASE_URL') || !env('SUPABASE_SERVICE_ROLE_KEY') || !env('SUPABASE_ANON_KEY')) return reply(503, { ok: false, configured: false });
  const uid = await caller(req);
  if (!uid) return reply(401, { ok: false });
  const input = (await req.json().catch(() => ({}))) as { action?: unknown; code?: unknown };
  const apple = appleConfig();
  try {
    if (input.action === 'store') {
      const code = typeof input.code === 'string' ? input.code : '';
      if (!/^[\w.-]{10,2000}$/.test(code)) return reply(400, { ok: false });
      if (!apple) return reply(200, { ok: false, configured: false });
      const { status, json } = await applePost(apple, '/auth/token', { code, grant_type: 'authorization_code' });
      const token = typeof json.refresh_token === 'string' ? json.refresh_token : null;
      if (status !== 200 || !token) return reply(200, { ok: false, configured: true });
      await rpc('apple_token_save', { p_user: uid, p_token: token });
      await drain(apple, 5);
      return reply(200, { ok: true, configured: true });
    }
    if (input.action === 'revoke') {
      const queued = Number(await rpc('apple_token_queue', { p_user: uid })) || 0;
      if (!apple) return reply(200, { ok: false, configured: false, queued });
      const revoked = await drain(apple, Math.max(5, queued));
      return reply(200, { ok: true, configured: true, queued, revoked });
    }
    return reply(400, { ok: false });
  } catch {
    // Never Apple's or the database's own words to the app.
    return reply(502, { ok: false });
  }
});
