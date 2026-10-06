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

const wanted = ['exp://**', 'irly://**', 'https://*.trycloudflare.com/**', 'http://localhost:8081/**', 'https://alafrench7593-a11y.github.io/irly/**'];
const allow = new Set((current.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean));
wanted.forEach((u) => allow.add(u));

const patch = { uri_allow_list: [...allow].join(',') };
const env = process.env;
if (env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET) {
  Object.assign(patch, {
    external_google_enabled: true,
    external_google_client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    external_google_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
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
