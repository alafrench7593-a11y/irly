/**
 * Where the latest builds stand at Apple (App Store Connect API, read only):
 * version, build number, processing state, TestFlight availability.
 * Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_APP_ID; key at ./asc-api-key.p8.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const KEY_ID = (process.env.ASC_KEY_ID || '').trim();
const ISSUER = (process.env.ASC_ISSUER_ID || '').trim();
const APP = (process.env.ASC_APP_ID || '').trim();
const p8 = fs.readFileSync('asc-api-key.p8', 'utf8').trim() + '\n';
const b64url = (b) => Buffer.from(b).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const head = b64url(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
const body = b64url(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
const jwt = `${head}.${body}.${b64url(crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: p8, dsaEncoding: 'ieee-p1363' }))}`;

const res = await fetch(`https://api.appstoreconnect.apple.com/v1/builds?filter[app]=${APP}&sort=-uploadedDate&limit=5&include=buildBetaDetail,preReleaseVersion`, {
  headers: { Authorization: `Bearer ${jwt}` },
});
const data = await res.json();
if (!res.ok) throw new Error(JSON.stringify(data).slice(0, 500));
const inc = Object.fromEntries((data.included || []).map((x) => [`${x.type}:${x.id}`, x]));
for (const b of data.data) {
  const pre = inc[`preReleaseVersions:${b.relationships?.preReleaseVersion?.data?.id}`];
  const beta = inc[`buildBetaDetails:${b.relationships?.buildBetaDetail?.data?.id}`];
  console.log(
    `version ${pre?.attributes?.version ?? '?'} (${b.attributes.version}) · uploaded ${b.attributes.uploadedDate} · processing: ${b.attributes.processingState}` +
      ` · expired: ${b.attributes.expired} · internal TestFlight: ${beta?.attributes?.internalBuildState ?? '?'} · external: ${beta?.attributes?.externalBuildState ?? '?'}`,
  );
}
