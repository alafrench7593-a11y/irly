/**
 * The voice tokens signed by supabase/functions/voice-token/token.ts.
 * Checks the signature with Node's own HMAC, the claims the audio server
 * reads, and that a listener can never publish. No network, no real secret.
 * Run: node --experimental-strip-types --no-warnings scripts/test-voice-token.mts
 * (not an npm script on purpose: package.json scripts are part of the native fingerprint, and a new one would cut over-the-air updates)
 */
import { createHmac } from 'node:crypto';
import { adminToken, httpBase, participantToken } from '../supabase/functions/voice-token/token.ts';

const KEY = 'APItestkey';
const SECRET = 'test-secret-not-a-real-one-0123456789abcdef';
let failed = 0;
function check(ok: boolean, label: string) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok ' : 'FAIL'} ${label}`);
}
const decode = (part: string) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
function verified(jwt: string, secret: string): boolean {
  const [h, b, s] = jwt.split('.');
  return createHmac('sha256', secret).update(`${h}.${b}`).digest('base64url') === s;
}

const now = 1_800_000_000;
const speaker = await participantToken(KEY, SECRET, 'user-1', { room: 'ww-abc-all-1', speak: true, listen: true }, 600, now);
const listener = await participantToken(KEY, SECRET, 'user-2', { room: 'ww-abc-all-1', speak: false, listen: true }, 600, now);
const admin = await adminToken(KEY, SECRET, now);

check(speaker.split('.').length === 3 && verified(speaker, SECRET), 'a participant token is a JWT signed HS256 with the API secret');
check(!verified(speaker, 'another-secret'), 'another secret does not verify it');
check(decode(speaker.split('.')[0]).alg === 'HS256', 'header: HS256');
const sp = decode(speaker.split('.')[1]);
check(sp.iss === KEY && sp.sub === 'user-1' && sp.exp === now + 600 && sp.nbf <= now, 'issuer = API key, subject = identity, expires after the TTL');
check(sp.video.room === 'ww-abc-all-1' && sp.video.roomJoin === true, 'the token opens one room only');
check(sp.video.canPublish === true && JSON.stringify(sp.video.canPublishSources) === '["microphone"]' && sp.video.canSubscribe === true, 'a speaker publishes the microphone only, and hears');
check(sp.video.canPublishData === false && sp.video.roomAdmin === undefined && sp.video.roomCreate === undefined, 'no data channel, no admin right');
const li = decode(listener.split('.')[1]);
check(li.video.canPublish === false && li.video.canPublishSources.length === 0 && li.video.canSubscribe === true, 'a listener (an eliminated player) cannot publish anything');
const ad = decode(admin.split('.')[1]);
check(verified(admin, SECRET) && ad.video.roomCreate === true && ad.video.roomJoin === undefined && ad.sub === undefined && ad.exp - now <= 60, 'the server token closes rooms, joins none, lasts a minute');
check(httpBase('wss://x.livekit.cloud/') === 'https://x.livekit.cloud' && httpBase('ws://localhost:7880') === 'http://localhost:7880', 'wss:// → https:// for the room API');

// The official server SDK, when it is installed beside this script (not a dependency of the app), must accept them too.
const sdk = process.env.LIVEKIT_SDK_PATH;
if (sdk) {
  const { TokenVerifier } = await import(sdk);
  const realNow = Math.floor(Date.now() / 1000);
  const fresh = await participantToken(KEY, SECRET, 'user-9', { room: 'ww-abc-dead-2', speak: false, listen: true }, 600, realNow);
  const claims = await new TokenVerifier(KEY, SECRET).verify(fresh);
  check(claims.sub === 'user-9' && claims.video?.room === 'ww-abc-dead-2' && claims.video?.canPublish === false && claims.video?.roomJoin === true, 'the official LiveKit verifier accepts the token and reads the same grant');
  let refused = false;
  try {
    await new TokenVerifier(KEY, 'wrong').verify(fresh);
  } catch {
    refused = true;
  }
  check(refused, 'the official verifier refuses a token signed with another secret');
}
if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
