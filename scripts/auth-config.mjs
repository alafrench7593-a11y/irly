/**
 * Sign-in setup on the IRLY Supabase project, through the Management API.
 * Always: sets the app's redirect URLs to exactly the list below (the
 * app scheme, the websites, local dev), removing any other. When their secrets exist: switches on Google and Apple.
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

// Set, never merged: a host anyone can register (*.vercel.app, a tunnel, any
// exp:// address) must never receive a sign-in code. Same list in deploy-db.mjs.
// IRLY_DEV_REDIRECTS adds one exact dev URL for this run only (a fixed host, at
// most a trailing /**), e.g. exp://192.168.1.20:8081/**.
const REDIRECTS = ['https://getirly.com/**', 'https://www.getirly.com/**', 'https://alafrench7593-a11y.github.io/irly/**', 'irly://**', 'http://localhost:8081/**', 'http://localhost:19006/**'];
function devRedirect(value) {
  const v = (value ?? '').trim();
  if (!v) return null;
  const bare = v.replace(/\/\*\*$/, '');
  let u = null;
  try {
    u = new URL(bare);
  } catch {
    u = null;
  }
  if (v.includes(',') || bare.includes('*') || !u || !u.hostname || !/^(https?|exp):$/.test(u.protocol)) {
    throw new Error('IRLY_DEV_REDIRECTS must be one exact URL (http, https or exp, a fixed host, at most a trailing /**), never a wildcard host');
  }
  return v;
}
const dev = devRedirect(process.env.IRLY_DEV_REDIRECTS);
const allow = dev ? [...REDIRECTS, dev] : REDIRECTS;
if (dev) console.log(`! IRLY_DEV_REDIRECTS: ${dev} is allowed on the LIVE project until the next run without it`);
const dropped = String(current.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter((u) => u && !allow.includes(u));
if (dropped.length) console.log(`Redirect URLs removed: ${dropped.join(', ')}`);

// Passwords: 8 characters at least, as the app already asks (the server allowed 6).
const patch = { uri_allow_list: allow.join(','), password_min_length: Math.max(8, current.password_min_length ?? 0) };
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

// Own email sender (SMTP_HOST, SMTP_USER, SMTP_PASS; SMTP_PORT 465 by
// default): Supabase's built-in sender allows 2 emails an hour for the whole
// project. With it, new accounts must confirm their address (nobody can
// sign up with someone else's email) and 60 emails an hour can go out.
const smtpHost = clean(env.SMTP_HOST);
const smtpUser = clean(env.SMTP_USER);
const smtpPass = (env.SMTP_PASS ?? '').trim();
if (smtpHost && smtpUser && smtpPass) {
  Object.assign(patch, {
    smtp_host: smtpHost,
    smtp_port: clean(env.SMTP_PORT) || '465',
    smtp_user: smtpUser,
    smtp_pass: smtpPass,
    smtp_admin_email: clean(env.SMTP_SENDER) || smtpUser,
    smtp_sender_name: 'IRLY',
    rate_limit_email_sent: 60,
    mailer_autoconfirm: false,
  });
  console.log(`Own email sender configured (${smtpHost}); email confirmation required for new accounts`);
} else if (current.mailer_autoconfirm) {
  // Left as it is (switching it off without a sender would block every sign-up), but said loudly.
  console.warn(
    '!!! WARNING: no own email sender (SMTP_HOST, SMTP_USER, SMTP_PASS): new accounts are confirmed WITHOUT proving they own their email.\n' +
      '!!! Anyone can sign up with someone else\'s address. Add the SMTP secrets to require confirmation (2 emails an hour until then).',
  );
} else {
  console.log('No own email sender (SMTP_HOST, SMTP_USER, SMTP_PASS): email confirmation unchanged (on), 2 emails an hour');
}

// The sign-in and confirmation emails carry the 6-digit code the app asks for, and the link as well: the app says
// « enter the code », and Supabase's own templates only send a link. French and English in one email (the server
// does not know the member's language). Supabase fills {{ .Token }} and {{ .ConfirmationURL }}.
const codeEmail = [
  '<h2>IRLY</h2>',
  '<p>Ton code IRLY · Your IRLY code</p>',
  '<p style="font-size:30px;font-weight:700;letter-spacing:6px;margin:12px 0">{{ .Token }}</p>',
  '<p>Saisis-le dans l’application, ou ouvre ce lien sur ton téléphone.<br>Enter it in the app, or open this link on your phone.</p>',
  '<p><a href="{{ .ConfirmationURL }}">Continuer vers IRLY · Continue to IRLY</a></p>',
  '<p style="color:#777;font-size:13px">Si tu n’as rien demandé, ignore cet e-mail.<br>If you did not ask for this, ignore this email.</p>',
].join('\n');
Object.assign(patch, {
  mailer_subjects_confirmation: 'Ton code IRLY · Your IRLY code',
  mailer_templates_confirmation_content: codeEmail,
  mailer_subjects_magic_link: 'Ton code IRLY · Your IRLY code',
  mailer_templates_magic_link_content: codeEmail,
});
console.log('Sign-in emails: 6-digit code and link, French and English');

const put = await fetch(api, { method: 'PATCH', headers, body: JSON.stringify(patch) });
if (!put.ok) throw new Error(`Updating the auth config failed (${put.status}): ${(await put.text()).slice(0, 200)}`);
const after = await put.json();
console.log('Redirect URLs:', after.uri_allow_list);
console.log('Google:', after.external_google_enabled ? 'on' : 'off (add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)');
console.log('Apple:', after.external_apple_enabled ? 'on' : 'off (add APPLE_SERVICES_ID, APPLE_TEAM_ID, APPLE_KEY_ID and APPLE_PRIVATE_KEY)');
console.log('Google callback to register in Google Cloud:', `https://${ref}.supabase.co/auth/v1/callback`);
