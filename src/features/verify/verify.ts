import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAccount } from '@/features/auth/account';
import { isAvatar } from '@/features/avatar/avatar';
import { thumbOf, uploadFaceThumb } from '@/features/server/media';
import { changed, useRefreshOn } from '@/features/server/sync';
import { cleanImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

/**
 * Verified profiles for Match. A real check by a person: at least 3 photos
 * of yourself on the profile, then a selfie doing a gesture picked by the
 * server, reviewed by an IRLY admin who compares it with the photos. The
 * selfie is deleted after the decision. Nothing here grants the badge: only
 * the server does, after the review.
 */
export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 6;

export type Gesture = 'peace' | 'thumb' | 'nose' | 'ear' | 'three';
export const GESTURES: Record<Gesture, { emoji: string; text: string }> = {
  peace: { emoji: '✌️', text: 'Make a peace sign next to your face' },
  thumb: { emoji: '👍', text: 'Give a thumbs up next to your face' },
  nose: { emoji: '☝️', text: 'Touch your nose with your index finger' },
  ear: { emoji: '🤚', text: 'Put your hand on your ear' },
  three: { emoji: '🤟', text: 'Show three fingers next to your face' },
};

export type MyVerification = {
  photos: number;
  verifiedAt: number | null;
  requestId: string | null;
  status: 'started' | 'pending' | 'approved' | 'rejected' | null;
  gesture: Gesture | null;
  reason: string | null;
  ready: boolean;
};

const sb = () => {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
};
const friendly = (m: string) => (/fetch|network/i.test(m) ? 'Can’t reach IRLY right now' : m);

/** My photos and verification, kept fresh. */
export function useMyVerification() {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; v: MyVerification | null; paths: string[] }>({ for: '', v: null, paths: [] });
  const seq = useRef(0);
  const load = useCallback(() => {
    if (!uid || !supabase) return;
    const n = ++seq.current;
    Promise.all([sb().rpc('my_verification'), sb().rpc('my_profile')]).then(([v, p]) => {
      if (n !== seq.current) return;
      const r = ((v.data as Record<string, unknown>[] | null) ?? [])[0];
      const paths = ((((p.data as { photo_paths: string[] | null }[] | null) ?? [])[0]?.photo_paths ?? []) as string[]).filter(Boolean);
      setState({
        for: uid,
        paths,
        v: r
          ? {
              photos: Number(r.photos ?? 0),
              verifiedAt: r.verified_at ? Date.parse(r.verified_at as string) : null,
              requestId: (r.request_id as string | null) ?? null,
              status: (r.status as MyVerification['status']) ?? null,
              gesture: (r.gesture as Gesture | null) ?? null,
              reason: (r.reason as string | null) ?? null,
              ready: Boolean(r.ready),
            }
          : null,
      });
    });
  }, [uid]);
  useEffect(load, [load]);
  useRefreshOn(['people'], load);
  const ready = state.for === uid;
  return { v: ready ? state.v : null, paths: ready ? state.paths : [], loading: Boolean(uid) && !ready, reload: load };
}

async function me(): Promise<string> {
  const { data } = await sb().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  return uid;
}

/** Adds photos of yourself to the profile (after the main picture), cleaned of their metadata. */
export async function addProfilePhotos(current: string[]): Promise<void> {
  const room = MAX_PHOTOS - current.length;
  if (room <= 0) throw new Error(`${MAX_PHOTOS} photos at most`);
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: true, selectionLimit: room });
  if (res.canceled || !res.assets.length) return;
  const uid = await me();
  const added: string[] = [];
  for (const [i, a] of res.assets.slice(0, room).entries()) {
    const img = await cleanImage(a.uri);
    const path = `${uid}/photo-${Date.now()}-${i}.${img.ext}`;
    const { error } = await sb().storage.from('profile-photos').upload(path, img.body, { contentType: img.contentType });
    if (error) throw new Error('A photo could not be sent. Try again.');
    await uploadFaceThumb(path, a.uri);
    added.push(path);
  }
  const { error } = await sb().from('profiles').update({ photo_paths: [...current, ...added] }).eq('id', uid);
  if (error) {
    await sb().storage.from('profile-photos').remove([...added, ...added.map(thumbOf)]);
    throw new Error(friendly(error.message));
  }
  changed('people');
}

/** Removes one photo (never the main picture: change it in Edit profile). */
export async function removeProfilePhoto(current: string[], path: string): Promise<void> {
  const uid = await me();
  if (current[0] === path) throw new Error('Change your main picture in Edit profile');
  const { error } = await sb().from('profiles').update({ photo_paths: current.filter((p) => p !== path) }).eq('id', uid);
  if (error) throw new Error(friendly(error.message));
  if (!isAvatar(path) && path.startsWith(`${uid}/`)) await sb().storage.from('profile-photos').remove([path, thumbOf(path)]);
  changed('people');
}

export async function startVerification(): Promise<{ requestId: string; gesture: Gesture }> {
  const { data, error } = await sb().rpc('start_verification');
  if (error) throw new Error(friendly(error.message));
  const r = ((data as { request_id: string; gesture: Gesture }[] | null) ?? [])[0];
  if (!r) throw new Error('Try again');
  return { requestId: r.request_id, gesture: r.gesture };
}

/** The front camera only: a photo from the library is not a live selfie. */
export async function takeSelfie(): Promise<string | null> {
  if (Platform.OS === 'web') throw new Error('Take the selfie in the IRLY app on your phone');
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error('Allow the camera in your settings to take the selfie');
  const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, cameraType: ImagePicker.CameraType.front });
  return res.canceled ? null : (res.assets[0]?.uri ?? null);
}

export async function submitSelfie(requestId: string, uri: string): Promise<void> {
  const uid = await me();
  const img = await cleanImage(uri);
  const path = `${uid}/${requestId}.${img.ext}`;
  const { error: up } = await sb().storage.from('verifications').upload(path, img.body, { contentType: img.contentType, upsert: true });
  if (up) throw new Error('The selfie could not be sent. Try again.');
  const { error } = await sb().rpc('submit_verification', { p_request: requestId, p_path: path });
  if (error) {
    await sb().storage.from('verifications').remove([path]);
    throw new Error(friendly(error.message));
  }
  changed('people');
}

/* ───────── Badges ───────── */

/** Which of these members are verified (for the badge). */
export function useVerified(ids: string[]): Set<string> {
  const key = [...new Set(ids)].sort().join(',');
  const [state, setState] = useState<{ for: string; set: Set<string> }>({ for: '', set: new Set() });
  useEffect(() => {
    if (!key || !supabase) return;
    let alive = true;
    supabase.rpc('verified_members', { p_ids: key.split(',') }).then(({ data }) => {
      if (alive) setState({ for: key, set: new Set(((data as { id: string }[] | null) ?? []).map((r) => r.id)) });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state.for === key ? state.set : EMPTY;
}
const EMPTY = new Set<string>();

/* ───────── IRLY admins: the review queue ───────── */

export type PendingVerification = { requestId: string; userId: string; firstName: string; photos: string[]; selfie: string | null; gesture: Gesture; submittedAt: number };

export async function loadQueue(): Promise<PendingVerification[]> {
  const { data, error } = await sb().rpc('verification_queue');
  if (error) throw new Error(friendly(error.message));
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    requestId: r.request_id as string,
    userId: r.user_id as string,
    firstName: r.first_name as string,
    photos: ((r.photo_paths as string[] | null) ?? []).filter((p) => !isAvatar(p)),
    selfie: (r.selfie_path as string | null) ?? null,
    gesture: r.gesture as Gesture,
    submittedAt: Date.parse(r.submitted_at as string),
  }));
}

/** Approves or refuses, then deletes the selfie file (the decision keeps no copy). */
export async function decide(requestId: string, approve: boolean, reason?: string): Promise<void> {
  const { data, error } = await sb().rpc('decide_verification', { p_request: requestId, p_approve: approve, p_reason: reason ?? null });
  if (error) throw new Error(friendly(error.message));
  const path = data as string | null;
  if (path) await sb().storage.from('verifications').remove([path]);
}

/** Whether the signed-in member is an IRLY admin (the server decides; this only shows the tools). */
export function useIsAdmin(): boolean {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; admin: boolean }>({ for: '', admin: false });
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase.rpc('am_i_admin').then(({ data }) => alive && setState({ for: uid, admin: Boolean(data) }));
    return () => {
      alive = false;
    };
  }, [uid]);
  return state.for === uid && state.admin;
}
