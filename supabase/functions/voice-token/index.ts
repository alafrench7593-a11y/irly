/**
 * Loup-Garou voice games: hands a member the access tokens of the voice
 * channels they may be in right now.
 *
 * The app calls it with the member's session (supabase.functions.invoke(
 * 'voice-token', { body })) and one of:
 *   { probe: true }      is voice set up on this project? → { configured }
 *   { room_id }          the member's channels in that game, each with the
 *                        audio room's name, what they may do and a token.
 *
 * Who may speak or listen where is decided by the database alone
 * (public.ww_voice_grant, called here AS THE MEMBER with their own session:
 * this function holds no database privilege of its own). This function only
 * signs what the database answered, with the audio server's secret, and asks
 * the audio server to close the rooms the database says were replaced (a
 * death, a card that changed camp, night falling), which disconnects anyone
 * still in them.
 *
 * Environment (Supabase → Edge Functions → Secrets; set by the owner, never in
 * the app or in this repository):
 *   LIVEKIT_URL          wss://<project>.livekit.cloud (or a self-hosted server)
 *   LIVEKIT_API_KEY
 *   LIVEKIT_API_SECRET
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by the runtime.
 * Without the three LiveKit variables the function answers
 * { configured: false } and the app offers text games only.
 * No audio passes through here, nothing is recorded, nothing is stored.
 * Deploy: supabase functions deploy voice-token
 */
// @ts-expect-error -- the Edge Functions runtime (Deno) resolves imports with their .ts extension
import { adminToken, httpBase, participantToken } from './token.ts';

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
/** Long enough to connect and to reconnect after a network change; rights that change get a new room, not a new token. */
const TOKEN_SECONDS = 600;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const env = (name: string) => (Deno.env.get(name) ?? '').trim();

function reply(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

type Channel = { channel: string; room: string; speak: boolean; listen: boolean };
type Grant = { identity: string; channels: Channel[]; retire: string[] };

/** Closes replaced rooms on the audio server. A room already gone is fine; a failure never blocks the member's token. */
async function retire(base: string, key: string, secret: string, rooms: string[]): Promise<void> {
  if (!rooms.length) return;
  const token = await adminToken(key, secret);
  await Promise.allSettled(
    rooms.slice(0, 12).map((room) =>
      fetch(`${base}/twirp/livekit.RoomService/DeleteRoom`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
        signal: AbortSignal.timeout(4000),
      }),
    ),
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'method' });
  const url = env('LIVEKIT_URL');
  const key = env('LIVEKIT_API_KEY');
  const secret = env('LIVEKIT_API_SECRET');
  if (!url || !key || !secret) return reply(200, { ok: false, configured: false });

  let body: { probe?: boolean; room_id?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { ok: false, configured: true, error: 'body' });
  }
  if (body.probe) return reply(200, { ok: true, configured: true });
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return reply(401, { ok: false, configured: true, error: 'sign in to play' });
  if (!body.room_id || !UUID.test(body.room_id)) return reply(400, { ok: false, configured: true, error: 'room' });

  // The database decides, as the member.
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/ww_voice_grant`, {
    method: 'POST',
    headers: { apikey: env('SUPABASE_ANON_KEY'), Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_room: body.room_id }),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => ({}))) as { message?: string };
    return reply(res.status === 401 ? 401 : 403, { ok: false, configured: true, error: problem.message ?? 'refused' });
  }
  const grant = (await res.json()) as Grant;

  await retire(httpBase(url), key, secret, grant.retire ?? []);
  const channels = await Promise.all(
    (grant.channels ?? []).map(async (c) => ({
      channel: c.channel,
      room: c.room,
      speak: c.speak,
      listen: c.listen,
      token: await participantToken(key, secret, grant.identity, { room: c.room, speak: c.speak, listen: c.listen }, TOKEN_SECONDS),
    })),
  );
  return reply(200, { ok: true, configured: true, url, identity: grant.identity, channels });
});
