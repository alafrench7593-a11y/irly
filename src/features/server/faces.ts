import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { create } from 'zustand';
import { storageName } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { isAvatar } from '@/features/avatar/avatar';
import { supabase } from '@/lib/supabase';
import { isAccountId } from './faceRule';
import { forgetLink, linkUntil, signedLinks, thumbOf, uploadFaceThumb } from './media';
import { useSyncVersion } from './sync';

export { isAccountId };

/**
 * Members' faces, one logic for the whole app: any avatar given a member id
 * shows that member's current profile photo (or IRLY avatar).
 *
 * Fast on purpose:
 * - a small copy of the photo (256 px, "-s.jpg" next to it) is shown when it
 *   exists, never the 1600 px original in a 30 px circle;
 * - the image is cached on the phone under its storage path, not under its
 *   signed link (which changes), so a face seen once shows instantly, even
 *   after the app is closed;
 * - faces are remembered between launches and checked again once per launch,
 *   then at most every 10 minutes for a face shown again
 *   (or when a profile changes), in one request for every face on screen;
 * - screens that already know the photo (chat members) hand it over, with no
 *   extra request.
 */
export type Face = { uri: string; key?: string };
/** src: the photo as stored on the profile; path: the file shown (its small copy when there is one). */
type Entry = { src: string | null; path: string | null; uri: string | null; until: number };
type Faces = { byId: Record<string, Entry> };
const useFaces = create<Faces>(() => ({ byId: {} }));

const STORE = storageName('irly-faces');
const LINK_LIFE = 5 * 3600 * 1000; // signedLinks keeps a link 6 h; a little less here.
const KEEP = 600;

// Ids confirmed by the server, and when. A member's new photo is heard live only by people
// who share a private chat with her (profiles' read rule): the others ask again after a while.
const checked = new Map<string, number>();
const RECHECK = 10 * 60 * 1000;
const fresh = (id: string, now = Date.now()) => (checked.get(id) ?? -Infinity) > now - RECHECK;
const noThumb = new Set<string>(); // Photos without a small copy (older uploads).
const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
// Moves on every clearFaces(): an answer asked for before (the account that left) is dropped.
let epoch = 0;

/* Remembered faces, read once at launch; what the server says meanwhile wins. */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
AsyncStorage.getItem(STORE)
  .then((raw) => {
    // Signed out meanwhile: the faces remembered belonged to the account that left.
    if (!raw || epoch !== 0) return;
    const saved = JSON.parse(raw) as Record<string, Entry>;
    useFaces.setState((s) => ({ byId: { ...saved, ...s.byId } }));
  })
  .catch(() => undefined);
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const all = Object.entries(useFaces.getState().byId);
    AsyncStorage.setItem(STORE, JSON.stringify(Object.fromEntries(all.slice(-KEEP)))).catch(() => undefined);
  }, 1000);
}

/** Links for these members' photos (small copy first), in one signing request. */
async function resolve(list: { id: string; path: string | null }[]) {
  const asked = epoch;
  const files = list.map((r) => r.path).filter((p): p is string => Boolean(p) && !isAvatar(p!));
  const thumbs = files.filter((p) => !noThumb.has(p)).map(thumbOf);
  const links = await signedLinks('profile-photos', [...thumbs, ...files]);
  if (asked !== epoch) return;
  const now = Date.now();
  // A link from the shared cache may have been signed hours ago: kept no longer than it lives.
  const lifeOf = (file: string) => Math.min(now + LINK_LIFE, linkUntil('profile-photos', file) ?? Infinity);
  const next: Record<string, Entry> = {};
  for (const { id, path } of list) {
    checked.set(id, now);
    if (!path) next[id] = { src: null, path: null, uri: null, until: now + LINK_LIFE };
    else if (isAvatar(path)) next[id] = { src: path, path, uri: path, until: Number.MAX_SAFE_INTEGER };
    else {
      const small = noThumb.has(path) ? undefined : links[thumbOf(path)];
      if (!small) {
        noThumb.add(path);
        if (links[path]) heal(path, links[path]);
      }
      const shown = small ? thumbOf(path) : path;
      next[id] = { src: path, path: shown, uri: small ?? links[path] ?? null, until: lifeOf(shown) };
    }
  }
  useFaces.setState((s) => ({ byId: { ...s.byId, ...next } }));
  save();
}

/** My own photo sent before small copies existed gets one, so everyone's lists load it fast. */
const healed = new Set<string>();
function heal(path: string, link: string) {
  if (healed.has(path) || !supabase) return;
  healed.add(path);
  supabase.auth
    .getSession()
    .then(({ data }) => (data.session && path.startsWith(`${data.session.user.id}/`) ? uploadFaceThumb(path, link) : undefined))
    .catch(() => undefined);
}

async function flush() {
  timer = null;
  const ids = [...pending];
  pending.clear();
  if (!supabase || !ids.length) return;
  const asked = epoch;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await supabase.rpc('profile_faces', { p_ids: chunk });
    if (asked !== epoch) return;
    if (error) continue; // Tried again on the next sync or screen.
    const rows = (data as { id: string; photo_path: string | null }[] | null) ?? [];
    const found = new Map(rows.map((r) => [r.id, r.photo_path]));
    await resolve(chunk.map((id) => ({ id, path: found.get(id) ?? null })));
  }
}

function want(id: string) {
  if (!isAccountId(id)) return;
  pending.add(id);
  if (!timer) timer = setTimeout(flush, 30);
}

/**
 * Faces a screen already knows (e.g. a chat's members with their photo
 * paths): shown without asking the server again.
 */
export function primeFaces(list: { id: string; path: string | null | undefined }[]) {
  const known = useFaces.getState().byId;
  const now = Date.now();
  const todo: { id: string; path: string | null }[] = [];
  for (const r of list) {
    if (!isAccountId(r.id)) continue;
    const path = r.path ?? null;
    const same = known[r.id]?.src === path && known[r.id].until > now;
    // The same photo already resolved since launch: nothing to do.
    if (fresh(r.id, now) && same) continue;
    // The server already answered something else since the last profile change: this list
    // may have been read before it (an older photo); the server says which one is current.
    if (fresh(r.id, now)) want(r.id);
    else todo.push({ id: r.id, path });
  }
  if (todo.length) resolve(todo).catch(() => undefined);
}

/**
 * A face whose link failed to load (expired, or signed long ago for another
 * screen): its link is forgotten and the face is asked for again, once per link.
 */
const renewed = new Set<string>();
export function renewFace(userId: string | null | undefined, uri: string | null | undefined) {
  if (!isAccountId(userId) || !uri || isAvatar(uri) || renewed.has(uri)) return;
  const e = useFaces.getState().byId[userId];
  if (e?.uri !== uri) return;
  renewed.add(uri);
  forgetLink(uri);
  checked.delete(userId);
  useFaces.setState((s) => ({ byId: { ...s.byId, [userId]: { ...e, until: 0 } } }));
  want(userId);
}

let seenVersion = 0;
/**
 * The face of a member: a Face (link + cache key, or an IRLY avatar string),
 * null when the server says this account has no photo, or undefined while
 * unknown (and for anything that is not a real account id).
 */
export function useAccountFace(userId?: string | null): Face | null | undefined {
  const id = isAccountId(userId) ? userId : undefined;
  const entry = useFaces((s) => (id ? s.byId[id] : undefined));
  const version = useSyncVersion('people');
  useEffect(() => {
    if (!id) return;
    // A profile changed somewhere: every face known is checked again, once per change.
    if (version !== seenVersion) {
      seenVersion = version;
      checked.clear();
    }
    const e = useFaces.getState().byId[id];
    if (!fresh(id) || !e || e.until < Date.now()) want(id);
  }, [id, version]);
  if (!entry) return undefined;
  if (!entry.src) return null;
  if (!entry.uri) return undefined;
  return { uri: entry.uri, key: entry.path && !isAvatar(entry.path) ? entry.path : undefined };
}

/** The face of a member (link + cache key, or an IRLY avatar string), or undefined while unknown / without photo. */
export function useFace(userId?: string | null): Face | undefined {
  return useAccountFace(userId) ?? undefined;
}

/** Mounted once at the root: your own face is known early (and gets its small copy if it has none). */
export function FaceSync() {
  useFace(useAccount()?.userId);
  return null;
}

/** Forget every face (sign-out). */
export function clearFaces() {
  epoch += 1;
  checked.clear();
  pending.clear();
  noThumb.clear();
  renewed.clear();
  if (timer) clearTimeout(timer);
  timer = null;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  useFaces.setState({ byId: {} });
  AsyncStorage.removeItem(STORE).catch(() => undefined);
}
