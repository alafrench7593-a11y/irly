/**
 * iOS signing for EAS builds, made with the App Store Connect API key only
 * (no Apple login, no interactive prompt):
 *   1. a new private key and certificate request (openssl),
 *   2. an Apple Distribution certificate from Apple,
 *   3. an App Store provisioning profile for app.irly.mobile,
 *   4. credentials.json + the files EAS reads with credentialsSource "local".
 * Older certificates and profiles made by this script are revoked first, so
 * Apple's limit on distribution certificates is never reached. Revoking a
 * distribution certificate does not affect builds already on TestFlight.
 * Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC key file at ./asc-api-key.p8.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const BUNDLE = 'app.irly.mobile';
const PROFILE_NAME = 'IRLY EAS App Store';
const DIR = 'ios-signing';
// Pasted secrets often carry a stray space or line break.
const ASC_KEY_ID = (process.env.ASC_KEY_ID || '').trim();
const ASC_ISSUER_ID = (process.env.ASC_ISSUER_ID || '').trim();
if (!ASC_KEY_ID || !ASC_ISSUER_ID) throw new Error('ASC_KEY_ID and ASC_ISSUER_ID are required');
const p8 = fs.readFileSync('asc-api-key.p8', 'utf8').trim() + '\n';
// Rewritten clean, for EAS Submit which reads the same file.
fs.writeFileSync('asc-api-key.p8', p8);

const b64url = (b) => Buffer.from(b).toString('base64url');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: ASC_KEY_ID, typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: p8, dsaEncoding: 'ieee-p1363' });
  return `${head}.${body}.${b64url(sig)}`;
}

async function api(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR);

// The app's identifier on Apple's side.
const bundles = await api('GET', `/v1/bundleIds?filter[identifier]=${BUNDLE}&limit=10`);
const bundle = bundles.data.find((b) => b.attributes.identifier === BUNDLE);
if (!bundle) throw new Error(`Bundle ID ${BUNDLE} not found in the Apple developer account`);
console.log('bundle id ok');

// Clean up what earlier runs made.
const profiles = await api('GET', `/v1/profiles?filter[name]=${encodeURIComponent(PROFILE_NAME)}&limit=50`);
for (const p of profiles.data) await api('DELETE', `/v1/profiles/${p.id}`);
const certs = await api('GET', '/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=50');
// IRLY's account signs only this app, through this script.
for (const c of certs.data) {
  try {
    await api('DELETE', `/v1/certificates/${c.id}`);
    console.log('revoked an older distribution certificate');
  } catch (e) {
    console.log('could not revoke a certificate:', e.message.slice(0, 120));
  }
}

// New key and certificate request.
execFileSync('openssl', ['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', `${DIR}/dist.key`, '-out', `${DIR}/dist.csr`, '-subj', '/CN=IRLY EAS/O=IRLY/C=AE']);
const csr = fs.readFileSync(`${DIR}/dist.csr`, 'utf8');
const cert = await api('POST', '/v1/certificates', { data: { type: 'certificates', attributes: { certificateType: 'DISTRIBUTION', csrContent: csr } } });
fs.writeFileSync(`${DIR}/dist.cer`, Buffer.from(cert.data.attributes.certificateContent, 'base64'));
execFileSync('openssl', ['x509', '-inform', 'DER', '-in', `${DIR}/dist.cer`, '-out', `${DIR}/dist.pem`]);
// A password you chose (IOS_P12_PASSWORD) when the files go to Expo; otherwise a random one.
const password = (process.env.IOS_P12_PASSWORD || '').trim() || crypto.randomBytes(18).toString('base64url');
// 3DES/SHA1 so the macOS keychain on the build machine can import it.
execFileSync('openssl', ['pkcs12', '-export', '-inkey', `${DIR}/dist.key`, '-in', `${DIR}/dist.pem`, '-out', `${DIR}/dist.p12`, '-passout', `pass:${password}`, '-keypbe', 'PBE-SHA1-3DES', '-certpbe', 'PBE-SHA1-3DES', '-macalg', 'sha1']);
console.log('distribution certificate created');

// App Store provisioning profile.
const profile = await api('POST', '/v1/profiles', {
  data: {
    type: 'profiles',
    attributes: { name: PROFILE_NAME, profileType: 'IOS_APP_STORE' },
    relationships: {
      bundleId: { data: { type: 'bundleIds', id: bundle.id } },
      certificates: { data: [{ type: 'certificates', id: cert.data.id }] },
    },
  },
});
fs.writeFileSync(`${DIR}/profile.mobileprovision`, Buffer.from(profile.data.attributes.profileContent, 'base64'));
console.log('provisioning profile created');

fs.writeFileSync(
  'credentials.json',
  JSON.stringify({ ios: { provisioningProfilePath: `${DIR}/profile.mobileprovision`, distributionCertificate: { path: `${DIR}/dist.p12`, password } } }, null, 2),
);
console.log('credentials.json written');
