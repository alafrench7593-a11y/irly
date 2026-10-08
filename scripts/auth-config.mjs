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
if (env.APPLE_SERVICES_ID && env.APPLE_CLIENT_SECRET) {
  Object.assign(patch, {
    external_apple_enabled: true,
    external_apple_client_id: env.APPLE_SERVICES_ID,
    external_apple_secret: env.APPLE_CLIENT_SECRET,
  });
}

const put = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(patch) });
if (!put.ok) throw new Error(`Updating the auth config failed (${put.status}): ${(await put.text()).slice(0, 200)}`);
const after = await put.json();
console.log('Redirect URLs:', after.uri_allow_list);
console.log('Google:', after.external_google_enabled ? 'on' : 'off (add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)');
console.log('Apple:', after.external_apple_enabled ? 'on' : 'off (add APPLE_SERVICES_ID and APPLE_CLIENT_SECRET)');
console.log('Google callback to register in Google Cloud:', `https://${ref}.supabase.co/auth/v1/callback`);
