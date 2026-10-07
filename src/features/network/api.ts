import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { useAccount } from '@/features/auth/account';
import { track } from '@/lib/analytics';
import { NONE } from '@/lib/none';
import { supabase, topic } from '@/lib/supabase';
import type { ProProfile } from './match';
import type { IndustryId, IntentId, RoleId } from './taxonomy';

/**
 * Professional profiles on the server (pro_profiles). Discovery and the
 * profile of someone else go through pro_discover / pro_profile_of, which
 * apply blocks and profile visibility; "Connect" is a friendship, so a
 * connection opens the private chat like any other.
 */

export type ProFilters = { industry?: IndustryId | null; role?: RoleId | null; intent?: IntentId | null; city?: string | null; q?: string };

export type ProDraft = {
  role: RoleId;
  jobTitle: string;
  company: string;
  industries: IndustryId[];
  skills: string[];
  project: string;
  lookingFor: string;
  canOffer: string;
  intents: IntentId[];
  cityId: string;
  areaId: string | null;
  visible: boolean;
};

type Row = {
  user_id: string;
  first_name: string;
  photo_path: string | null;
  role: RoleId;
  job_title: string;
  company: string | null;
  industries: IndustryId[];
  skills: string[];
  project: string | null;
  looking_for: string | null;
  can_offer: string | null;
  intents: IntentId[];
  city_id: string;
  area_id: string | null;
  lat: number | string | null;
  lng: number | string | null;
  connection: ProProfile['connection'];
};

const num = (v: number | string | null) => (v == null ? null : Number(v));

const toPro = (r: Row): ProProfile => ({
  userId: r.user_id,
  firstName: r.first_name,
  photoPath: r.photo_path,
  role: r.role,
  jobTitle: r.job_title,
  company: r.company,
  industries: r.industries ?? [],
  skills: r.skills ?? [],
  project: r.project,
  lookingFor: r.looking_for,
  canOffer: r.can_offer,
  intents: r.intents ?? [],
  cityId: r.city_id,
  areaId: r.area_id,
  lat: num(r.lat),
  lng: num(r.lng),
  connection: r.connection ?? 'none',
});

function need() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

// Signed photo links, reused until shortly before they expire (a day).
const DAY = 24 * 3600;
const signed = new Map<string, { url: string; until: number }>();
export async function photoUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths.filter((p) => p && !((signed.get(p)?.until ?? 0) > now)))];
  if (missing.length && supabase) {
    const { data } = await supabase.storage.from('profile-photos').createSignedUrls(missing, DAY);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, until: now + (DAY - 600) * 1000 });
  }
  return Object.fromEntries(paths.filter((p) => signed.has(p)).map((p) => [p, signed.get(p)!.url]));
}

// Bumped when you save or delete your professional profile, so every screen
// showing it (Discover, a profile page, the editor) reloads it.
const useProVersion = create<{ v: number; bump: () => void }>((set) => ({ v: 0, bump: () => set((s) => ({ v: s.v + 1 })) }));

/** Your own professional profile (null until you create it), the same on every screen. */
export function useMyPro() {
  const uid = useAccount()?.userId;
  const version = useProVersion((s) => s.v);
  const bump = useProVersion((s) => s.bump);
  const current = `${uid}|${version}`;
  // Loading is "the last answer is for another account or an older version".
  const [res, setRes] = useState<{ for: string; pro: ProProfile | null; visible: boolean; error: string | null }>({ for: '', pro: null, visible: true, error: null });

  const load = useCallback(async () => {
    if (!uid || !supabase) return { pro: null, visible: true };
    const [{ data, error: e }, own] = await Promise.all([
      supabase.rpc('pro_profile_of', { p_user: uid }),
      supabase.from('pro_profiles').select('visible').eq('user_id', uid).maybeSingle(),
    ]);
    if (e) throw new Error(e.message);
    const r = ((data as Row[]) ?? [])[0];
    return { pro: r ? toPro(r) : null, visible: (own.data as { visible?: boolean } | null)?.visible ?? true };
  }, [uid]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    load()
      .then((x) => alive && setRes({ for: current, pro: x.pro, visible: x.visible, error: null }))
      .catch((e) => alive && setRes((r) => ({ ...r, for: current, error: e instanceof Error ? e.message : 'offline' })));
    return () => {
      alive = false;
    };
  }, [uid, load, current]);

  const save = useCallback(
    async (d: ProDraft) => {
      if (!uid) throw new Error('Sign in to create your professional profile');
      const row = {
        user_id: uid,
        role: d.role,
        job_title: d.jobTitle.trim(),
        company: d.company.trim() || null,
        industries: d.industries,
        skills: d.skills,
        project: d.project.trim() || null,
        looking_for: d.lookingFor.trim() || null,
        can_offer: d.canOffer.trim() || null,
        intents: d.intents,
        city_id: d.cityId,
        area_id: d.areaId,
        visible: d.visible,
      };
      const { error: e } = await need().from('pro_profiles').upsert(row, { onConflict: 'user_id' });
      if (e) throw new Error(/check constraint/i.test(e.message) ? 'Some fields are not valid' : e.message);
      track('PRO_PROFILE_SAVE', { industries: d.industries.length, intents: d.intents.length });
      bump();
    },
    [uid, bump],
  );

  const remove = useCallback(async () => {
    if (!uid) return;
    const { error: e } = await need().from('pro_profiles').delete().eq('user_id', uid);
    if (e) throw new Error(e.message);
    bump();
  }, [uid, bump]);

  const on = Boolean(uid && supabase);
  const fresh = res.for === current;
  return {
    // The previous answer stays on screen while a newer version loads (no flash of "create your profile").
    pro: on && res.for.startsWith(`${uid}|`) ? res.pro : null,
    visible: res.visible,
    loading: on && !fresh,
    error: on ? res.error : null,
    save,
    remove,
    signedIn: Boolean(uid),
  };
}

/** Professionals of the country (or one city), filtered on the server; live connection states. */
export function usePros(cityId: string, filters: ProFilters) {
  const uid = useAccount()?.userId;
  const key = JSON.stringify(filters);
  const current = `${uid}|${cityId}|${key}`;
  // What the last answer was for: loading is "the answer is for other filters".
  const [res, setRes] = useState<{ for: string; list: ProProfile[]; error: string | null }>({ for: '', list: [], error: null });
  const [photos, setPhotos] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!uid || !supabase) return [];
    const f = JSON.parse(key) as ProFilters;
    const { data, error: e } = await supabase.rpc('pro_discover', {
      p_city: cityId,
      p_filters: { industry: f.industry ?? '', role: f.role ?? '', intent: f.intent ?? '', city: f.city ?? '', q: f.q?.trim() ?? '' },
      p_limit: 150,
    });
    if (e) throw new Error(e.message);
    return ((data as Row[]) ?? []).map(toPro);
  }, [uid, cityId, key]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    let n = 0;
    const reload = () => {
      const mine = ++n;
      load()
        .then(async (l) => {
          if (!alive || mine !== n) return;
          setRes({ for: current, list: l, error: null });
          const urls = await photoUrls(l.map((p) => p.photoPath).filter(Boolean) as string[]);
          if (alive && mine === n) setPhotos(urls);
        })
        .catch((e) => alive && mine === n && setRes((r) => ({ for: current, list: r.list, error: e instanceof Error ? e.message : 'offline' })));
    };
    reload();
    // Requests sent or accepted (here or on another phone) update the buttons.
    const channel = supabase
      .channel(topic(`pros-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, load, current]);

  /** Optimistic connection state for one card, while the server answers. */
  const setConnection = useCallback((userId: string, connection: ProProfile['connection']) => {
    setRes((r) => ({ ...r, list: r.list.map((p) => (p.userId === userId ? { ...p, connection } : p)) }));
  }, []);

  const on = Boolean(uid && supabase);
  return { list: on ? res.list : NONE, photos, loading: on && res.for !== current, error: res.error, setConnection, signedIn: Boolean(uid) };
}

/** One professional's profile. */
export function usePro(userId: string) {
  const uid = useAccount()?.userId;
  const [res, setRes] = useState<{ id: string; pro: ProProfile | null; failed: boolean }>({ id: '', pro: null, failed: false });
  const [photo, setPhoto] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!uid || !supabase) return null;
    const { data, error: e } = await supabase.rpc('pro_profile_of', { p_user: userId });
    if (e) throw new Error(e.message);
    const r = ((data as Row[]) ?? [])[0];
    return r ? toPro(r) : null;
  }, [uid, userId]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    const reload = () =>
      load()
        .then(async (p) => {
          if (!alive) return;
          setRes({ id: userId, pro: p, failed: false });
          if (p?.photoPath) {
            const urls = await photoUrls([p.photoPath]);
            if (alive) setPhoto(urls[p.photoPath] ?? null);
          }
        })
        .catch(() => alive && setRes((r) => ({ id: userId, pro: r.id === userId ? r.pro : null, failed: true })));
    reload();
    const channel = supabase
      .channel(topic(`pro-${userId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, userId, load]);

  const setConnection = useCallback((connection: ProProfile['connection']) => setRes((r) => (r.pro ? { ...r, pro: { ...r.pro, connection } } : r)), []);

  const on = Boolean(uid && supabase);
  const pro = on && res.id === userId ? res.pro : null;
  const state: 'loading' | 'ready' | 'missing' | 'error' = !on ? 'missing' : res.id !== userId ? 'loading' : res.failed && !pro ? 'error' : pro ? 'ready' : 'missing';
  return { pro, photo: res.id === userId ? photo : null, state, setConnection };
}
