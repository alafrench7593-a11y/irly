// IRLY · enhance-photo
//
// Makes a member's cover photo (activity, community, group) look its best
// with Cloudinary's AI, without inventing anything:
//  - an enhanced full image (exposure, contrast, white balance, colour,
//    sharpness, noise; tuned to the kind of scene), and
//  - two subject-aware crops (16:10 for cards, 1:1 for thumbnails) centred
//    on what matters in the photo (people, a dish, the view).
// The original stays untouched in storage. The results are saved next to it
// under the member's folder, and the temporary copy at Cloudinary is
// deleted. Without CLOUDINARY_URL (Supabase function secret) the function
// answers { enabled: false } and the app keeps the original.
//
// POST { path: "<uid>/<name>.jpg", kind?: "food" | "outdoor" | "sport" | "indoor" | "night" | "default" }
// Authorization: the member's session (the path must be in their folder).

// eslint-disable-next-line import/no-unresolved -- Deno resolves npm: imports
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const BUCKET = 'activity-photos';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// One treatment per kind of scene: a restaurant is not a beach.
const LOOK: Record<string, string> = {
  food: 'e_improve:indoor:60,e_vibrance:15,e_sharpen:50',
  indoor: 'e_improve:indoor:60,e_sharpen:40',
  outdoor: 'e_improve:outdoor:60,e_vibrance:10,e_sharpen:40',
  sport: 'e_improve:outdoor:50,e_sharpen:60',
  night: 'e_improve:indoor:40,e_sharpen:30',
  default: 'e_improve:50,e_sharpen:40',
};

async function sha1(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cloudinary signature: the sorted parameters, then the secret. */
async function sign(params: Record<string, string>, secret: string) {
  const base = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&');
  return sha1(base + secret);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cloud = Deno.env.get('CLOUDINARY_URL') ?? '';
  const m = cloud.match(/^cloudinary:\/\/(\d+):([^@]+)@(.+)$/);
  if (!m) return json({ enabled: false });
  const [, apiKey, apiSecret, cloudName] = m;

  // Who is asking: the member's session.
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: who } = await admin.auth.getUser(jwt);
  const uid = who?.user?.id;
  if (!uid) return json({ error: 'sign in first' }, 401);

  const { path, kind = 'default' } = (await req.json().catch(() => ({}))) as { path?: string; kind?: string };
  if (!path || !/^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(path) || path.split('/')[0] !== uid || /\.(hd|c169|c11)\.jpg$/.test(path)) {
    return json({ error: 'not your photo' }, 403);
  }

  // The original, read by the function only for this request.
  const { data: signed, error: e1 } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  if (e1 || !signed) return json({ error: 'photo not found' }, 404);

  const look = LOOK[kind] ?? LOOK.default;
  const finish = 'q_auto:good,f_jpg';
  const eager = [
    `${look},c_limit,w_2048,${finish}`,
    `${look},c_fill,g_auto,ar_16:10,w_1280,${finish}`,
    `${look},c_fill,g_auto,ar_1:1,w_720,${finish}`,
  ].join('|');
  const publicId = `irly-tmp/${crypto.randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const params = { eager, public_id: publicId, timestamp };
  const form = new FormData();
  form.set('file', signed.signedUrl);
  for (const [k, v] of Object.entries(params)) form.set(k, v);
  form.set('api_key', apiKey);
  form.set('signature', await sign(params, apiSecret));

  const up = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const res = await up.json().catch(() => ({}));
  const destroy = async () => {
    const p = { public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)), invalidate: 'true' };
    const f = new FormData();
    for (const [k, v] of Object.entries(p)) f.set(k, v);
    f.set('api_key', apiKey);
    f.set('signature', await sign(p, apiSecret));
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, { method: 'POST', body: f }).catch(() => undefined);
  };
  if (!up.ok || !Array.isArray(res.eager) || res.eager.length < 3) {
    await destroy();
    return json({ error: res?.error?.message ?? 'enhancement failed' }, 502);
  }

  // Saved next to the original: <name>.hd.jpg, <name>.c169.jpg, <name>.c11.jpg.
  const base = path.replace(/\.[a-z0-9]+$/i, '');
  const names = [`${base}.hd.jpg`, `${base}.c169.jpg`, `${base}.c11.jpg`];
  try {
    for (let i = 0; i < 3; i++) {
      const r = await fetch(res.eager[i].secure_url);
      if (!r.ok) throw new Error(`download ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const { error } = await admin.storage.from(BUCKET).upload(names[i], bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    await admin.storage.from(BUCKET).remove(names).catch(() => undefined);
    await destroy();
    return json({ error: e instanceof Error ? e.message : 'save failed' }, 502);
  }
  await destroy();
  return json({ enabled: true, hd: names[0], card: names[1], square: names[2] });
});
