/**
 * Access tokens for the audio server (LiveKit): a JWT signed HS256 with the
 * API secret, issuer = the API key, subject = the participant's identity, and
 * a `video` grant naming one room and what the participant may do in it.
 * Pure Web Crypto, no dependency: runs in the Edge Functions runtime and in
 * Node (scripts/test-voice-token.mts checks it against the official verifier).
 */

export type VoiceGrant = {
  /** The one audio room this token opens. */
  room: string;
  /** May publish their microphone (nothing else: no camera, no screen, no data). */
  speak: boolean;
  /** May hear the others. */
  listen: boolean;
};

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: Record<string, unknown>, secret: string): Promise<string> {
  const head = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${head}.${body}`)));
  return `${head}.${body}.${base64url(mac)}`;
}

/** A participant's token for one room. Short-lived: it only has to last until the connection is made. */
export function participantToken(apiKey: string, secret: string, identity: string, grant: VoiceGrant, ttlSeconds: number, now = Math.floor(Date.now() / 1000)): Promise<string> {
  return sign(
    {
      iss: apiKey,
      sub: identity,
      nbf: now - 5,
      exp: now + ttlSeconds,
      video: {
        room: grant.room,
        roomJoin: true,
        canPublish: grant.speak,
        canPublishSources: grant.speak ? ['microphone'] : [],
        canSubscribe: grant.listen,
        canPublishData: false,
        canUpdateOwnMetadata: false,
      },
    },
    secret,
  );
}

/** The server's own token to close rooms (RoomService.DeleteRoom asks for roomCreate). Never sent to a client. */
export function adminToken(apiKey: string, secret: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  return sign({ iss: apiKey, nbf: now - 5, exp: now + 60, video: { roomCreate: true } }, secret);
}

/** wss://host → https://host (the audio server's HTTP API lives on the same host). */
export function httpBase(url: string): string {
  return url.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/+$/, '');
}
