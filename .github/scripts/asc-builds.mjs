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

// TestFlight groups: who can test, and which builds each group gets.
// Email addresses are shortened in the log (j***@gmail.com).
const get = async (path) => {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${jwt}` } });
  const j = await r.json();
  if (!r.ok) return { error: `${r.status} ${JSON.stringify(j.errors?.[0]?.detail ?? j).slice(0, 160)}` };
  return j;
};
const mask = (e = '') => e.replace(/^(.).*?(@.*)$/, '$1***$2');
const groups = await get(`/v1/apps/${APP}/betaGroups?limit=20`);
if (groups.error) console.log('TestFlight groups: could not read:', groups.error);
else if (!groups.data.length) console.log('TestFlight groups: NONE (no group, so nobody can see a build)');
for (const g of groups.data ?? []) {
  const testers = await get(`/v1/betaGroups/${g.id}/betaTesters?limit=50`);
  const builds = await get(`/v1/betaGroups/${g.id}/builds?limit=10`);
  console.log(`\nGroup "${g.attributes.name}" · ${g.attributes.isInternalGroup ? 'internal' : 'external'}${g.attributes.hasAccessToAllBuilds ? ' · gets every build automatically' : ''}`);
  console.log(`  testers: ${testers.error ?? (testers.data.length ? testers.data.map((t) => `${mask(t.attributes.email)} (${t.attributes.state ?? 'state ?'})`).join(', ') : 'NONE')}`);
  console.log(`  builds: ${builds.error ?? (builds.data.length ? builds.data.map((b) => b.attributes.version).join(', ') : 'NONE')}`);
}
const users = await get('/v1/users?limit=20');
console.log(`\nApp Store Connect users: ${users.error ?? users.data.map((u) => `${mask(u.attributes.username)} [${(u.attributes.roles || []).join('/')}]`).join(', ')}`);

// ADD_TEAM_TESTERS=1: every App Store Connect user of the team becomes a
// tester of the internal groups (internal testers must be team users).
if (process.env.ADD_TEAM_TESTERS === '1' && !users.error) {
  for (const g of (groups.data ?? []).filter((x) => x.attributes.isInternalGroup)) {
    for (const u of users.data) {
      const r = await fetch('https://api.appstoreconnect.apple.com/v1/betaTesters', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: {
            type: 'betaTesters',
            attributes: { email: u.attributes.username, firstName: u.attributes.firstName, lastName: u.attributes.lastName },
            relationships: { betaGroups: { data: [{ type: 'betaGroups', id: g.id }] } },
          },
        }),
      });
      const j = await r.json().catch(() => ({}));
      console.log(`add ${mask(u.attributes.username)} to "${g.attributes.name}": ${r.ok ? 'done, Apple emails an invitation' : `${r.status} ${JSON.stringify(j.errors?.[0]?.detail ?? j).slice(0, 200)}`}`);
    }
  }
}
