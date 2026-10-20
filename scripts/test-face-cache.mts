// Faces and links kept on the phone (src/features/server/faces.ts, media.ts),
// run for real against a fake Supabase client:
// - a new profile photo replaces the old one on the next profile change
//   (your own: at once, through changed('people'));
// - a list read before that change (an inbox, a chat's members) never puts
//   the old photo back: the server is asked which one is current;
// - a link that fails to load (expired) is signed again, once;
// - after sign-out (clearFaces), nothing of the account that left comes back:
//   not an answer still on its way, not the faces remembered at launch, not a
//   save that was about to be written.
// Run: node --experimental-strip-types --no-warnings scripts/test-face-cache.mts
import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const stub = (code: string) => `data:text/javascript,${encodeURIComponent(code)}`;
const H = 'globalThis.__f';
// Hooks run as plain functions: an effect runs at once, a store is read as it is.
const STUBS: Record<string, string> = {
  react: stub(
    `const r = { useEffect: (fn) => { fn(); }, useLayoutEffect: (fn) => { fn(); }, useRef: (v) => ({ current: v }), useSyncExternalStore: (s, get) => get(), useDebugValue: () => undefined, useMemo: (f) => f(), useCallback: (f) => f, useState: (v) => [v, () => undefined] };
     export default r; export const { useEffect, useLayoutEffect, useRef, useSyncExternalStore, useDebugValue, useMemo, useCallback, useState } = r;`,
  ),
  'react-native': stub(`export const AppState = { addEventListener: () => ({ remove() {} }) }; export const Platform = { OS: 'ios' };`),
  'expo-image-picker': stub(`export const launchImageLibraryAsync = async () => ({ canceled: true });`),
  '@react-native-async-storage/async-storage': stub(`export default ${H}.storage;`),
  '@/lib/media': stub(`export const faceThumb = async () => new Uint8Array(); export const imageBytes = async () => new Uint8Array(); export const imageType = () => ({ ext: 'jpg', contentType: 'image/jpeg' }); export const prepareImage = async (u) => ({ uri: u });`),
  '@/lib/supabase': stub(`export const supabase = ${H}.supabase; export const topic = (s) => s; export const friendlyError = (m) => m;`),
  '@/features/auth/account': stub(`export const useAccount = () => ({ userId: ${H}.uid });`),
};
const hooks = `
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const STUBS = ${JSON.stringify(STUBS)};
const SRC = ${JSON.stringify(SRC)};
export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  let target = null;
  if (specifier.startsWith('@/')) target = path.join(SRC, specifier.slice(2));
  else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:') && !path.extname(specifier))
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  if (target) for (const ext of ['.ts', '.tsx', '/index.ts']) if (fs.existsSync(target + ext)) return { url: pathToFileURL(target + ext).href, shortCircuit: true };
  return next(specifier, context);
}`;
register(stub(hooks));

let failed = 0;
const expect = (ok: boolean, label: string, got?: unknown) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.error(`✗ ${label}`, got === undefined ? '' : JSON.stringify(got));
  }
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ───────── Fake server ───────── */
const A = '0b6f3a52-1c1e-4c4e-9a43-2f0e8b1d7a11';
const B = '1c7f4b63-2d2f-4d5f-8b54-3f1f9c2e8b22';
const C = '2d8a5c74-3e3a-4e6a-9c65-4a2aad3f9c33';
const photos: Record<string, string | null> = { [A]: `${A}/avatar-1.jpg`, [B]: `${B}/avatar-1.jpg`, [C]: `${C}/avatar-1.jpg` };
let facesDelay = 0;
let faceCalls = 0;
let token = 0;
const saved: string[] = [];
let launchFaces: (v: string | null) => void = () => undefined;
(globalThis as Record<string, unknown>).__f = {
  uid: A,
  storage: {
    getItem: () => new Promise<string | null>((r) => (launchFaces = r)),
    setItem: async (_k: string, v: string) => void saved.push(v),
    removeItem: async () => undefined,
  },
  supabase: {
    rpc: async (fn: string, args: { p_ids: string[] }) => {
      if (fn !== 'profile_faces') return { data: null, error: { message: 'unknown' } };
      faceCalls++;
      const answer = args.p_ids.map((id) => ({ id, photo_path: photos[id] ?? null }));
      if (facesDelay) await sleep(facesDelay);
      return { data: answer, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((p) => ({ path: p, signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${p}?token=${++token}` })),
          error: null,
        }),
      }),
    },
    auth: { getSession: async () => ({ data: { session: null } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: async () => undefined,
  },
};

const faces = await import(process.env.FACES_FILE ?? '../src/features/server/faces.ts');
const sync = await import(process.env.SYNC_FILE ?? '../src/features/server/sync.ts');
const face = (id: string) => faces.useAccountFace(id);
const settle = () => sleep(200);

/* ───────── Faces remembered at launch, read after a sign-out ───────── */
faces.clearFaces();
launchFaces(JSON.stringify({ [C]: { src: `${C}/old.jpg`, path: `${C}/old-s.jpg`, uri: 'https://old/link', until: Date.now() + 3600_000 } }));
await sleep(20);
expect(face(C) === undefined, 'sign-out before the remembered faces were read: none of them comes back');
await settle();

/* ───────── A new photo, everywhere ───────── */
face(A);
await settle();
expect(face(A)?.key === `${A}/avatar-1-s.jpg`, 'a face is shown from its small copy, keyed by the stored file', face(A));
photos[A] = `${A}/avatar-2.jpg`;
sync.changed('people'); // what updateMyProfile does once the server has the new photo
await settle();
face(A); // a mounted avatar re-renders with the new version
await settle();
expect(face(A)?.key === `${A}/avatar-2-s.jpg`, 'own new photo: shown at once after changed(people), without signing out', face(A));

/* ───────── A list read before the change never brings the old photo back ───────── */
const before = faceCalls;
faces.primeFaces([{ id: A, path: `${A}/avatar-1.jpg` }]);
await settle();
expect(face(A)?.key === `${A}/avatar-2-s.jpg`, 'an older photo handed over by a list does not replace the current one', face(A));
expect(faceCalls === before + 1, 'the server was asked which photo is current (one request)', faceCalls - before);
faces.primeFaces([{ id: B, path: `${B}/avatar-1.jpg` }]);
await settle();
expect(face(B)?.key === `${B}/avatar-1-s.jpg` && faceCalls === before + 1, 'a face not known yet is taken from the list as is (no request)', face(B));
faces.primeFaces([{ id: B, path: `${B}/avatar-1.jpg` }]);
await settle();
expect(faceCalls === before + 1, 'the same photo handed over again: nothing asked');

/* ───────── An expired link is signed again, once ───────── */
const old = face(B)!.uri;
faces.renewFace(B, old);
await settle();
const renewed = face(B)!.uri;
expect(renewed !== old && face(B)?.key === `${B}/avatar-1-s.jpg`, 'a link that failed is replaced by a new one for the same photo', [old, renewed]);
const calls = faceCalls;
faces.renewFace(B, old);
await settle();
expect(faceCalls === calls && face(B)!.uri === renewed, 'the same failed link is not renewed twice (no loop)');
faces.renewFace(B, 'https://someone/else');
await settle();
expect(faceCalls === calls, 'a link that is not this face’s current one is ignored');

/* ───────── Sign-out: nothing of the account that left comes back ───────── */
saved.length = 0;
photos[C] = `${C}/avatar-1.jpg`;
facesDelay = 100;
face(C);
await sleep(60); // asked, the answer is on its way
faces.clearFaces();
await sleep(150);
expect(faces.useAccountFace(C) === undefined, 'an answer asked for before sign-out is dropped');
facesDelay = 0;
await sleep(1300);
expect(saved.every((s) => !s.includes(A) && !s.includes(B)), 'no save of the faces of the account that left after sign-out', saved);

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nface cache ok');
process.exit(0);
