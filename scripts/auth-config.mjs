/**
 * Sign-in setup on the IRLY Supabase project, through the Management API.
 * Always: allows the app's redirect URLs (Expo Go, the app scheme, the
 * browser preview). When their secrets exist: switches on Google and Apple.
 * Secrets are read from the environment and never printed.
 */
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');
const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const res = await fetch(api, { headers });
if (!res.ok) throw new Error(`Reading the auth config failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
const current = await res.json();

const wanted = ['exp://**', 'irly://**', 'https://*.trycloudflare.com/**', 'http://localhost:8081/**', 'https://alafrench7593-a11y.github.io/irly/**', 'https://getirly.com/**', 'https://www.getirly.com/**', 'https://*-link-a664.vercel.app/**'];
const allow = new Set((current.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean));
wanted.forEach((u) => allow.add(u));

const patch = { uri_allow_list: [...allow].join(',') };
const env = process.env;
// Pasted values often carry spaces, quotes or line breaks.
const clean = (v) => (v ?? '').trim().replace(/^["']|["']$/g, '').trim();
const googleId = clean(env.GOOGLE_OAUTH_CLIENT_ID);
const googleSecret = clean(env.GOOGLE_OAUTH_CLIENT_SECRET);
if (googleId && googleSecret) {
  // Checks the shape only; the values themselves are never printed.
  const problems = [];
  if (!/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(googleId)) {
    problems.push(
      googleId.startsWith('GOCSPX-')
        ? 'GOOGLE_OAUTH_CLIENT_ID holds the client SECRET: swap the two secrets'
        : `GOOGLE_OAUTH_CLIENT_ID is not a client ID (it must look like 1234…-abc….apps.googleusercontent.com; got ${googleId.length} characters)`,
    );
  }
  if (googleSecret.endsWith('.apps.googleusercontent.com')) problems.push('GOOGLE_OAUTH_CLIENT_SECRET holds the client ID: swap the two secrets');
  if (problems.length) throw new Error(problems.join('\n'));
  console.log(`Google client ID format OK (project number ${googleId.split('-')[0]})`);
  Object.assign(patch, {
    external_google_enabled: true,
    external_google_client_id: googleId,
    external_google_secret: googleSecret,
  });
}
// Sign in with Apple. The client secret Apple wants is a JWT signed with
// the .p8 key and valid 6 months at most: it is made here on every run (the
// workflow runs monthly), so it never expires. APPLE_CLIENT_SECRET (a ready
// JWT) still works when the key itself is not given.
const appleServicesId = clean(env.APPLE_SERVICES_ID);
let appleSecret = clean(env.APPLE_CLIENT_SECRET);
if (appleServicesId && env.APPLE_PRIVATE_KEY && env.APPLE_TEAM_ID && env.APPLE_KEY_ID) {
  const { createPrivateKey, sign } = await import('node:crypto');
  const b64 = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'ES256', kid: clean(env.APPLE_KEY_ID) });
  const body = b64({ iss: clean(env.APPLE_TEAM_ID), iat: now, exp: now + 180 * 24 * 3600, aud: 'https://appleid.apple.com', sub: appleServicesId });
  const key = createPrivateKey(env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n').trim());
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  appleSecret = `${head}.${body}.${sig}`;
  console.log('Apple client secret made from the key, valid 180 days');
}
if (appleServicesId && appleSecret) {
  Object.assign(patch, {
    external_apple_enabled: true,
    external_apple_client_id: appleServicesId,
    external_apple_secret: appleSecret,
  });
}

const put = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(patch) });
if (!put.ok) throw new Error(`Updating the auth config failed (${put.status}): ${(await put.text()).slice(0, 200)}`);
const after = await put.json();
console.log('Redirect URLs:', after.uri_allow_list);
console.log('Google:', after.external_google_enabled ? 'on' : 'off (add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)');
console.log('Apple:', after.external_apple_enabled ? 'on' : 'off (add APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY)');
console.log('Google callback to register in Google Cloud:', `https://${ref}.supabase.co/auth/v1/callback`);
