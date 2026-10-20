import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { useAccount } from '@/features/auth/account';
import { isAvatar } from '@/features/avatar/avatar';
import { thumbOf } from '@/features/server/media';
import { track } from '@/lib/analytics';
import { NONE } from '@/lib/none';
import { liveChannel, supabase, whenListening } from '@/lib/supabase';
import { LINK_KINDS, NO_LINKS, safeLink, type ProLinks } from './links';
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
  /** Your links (already normalised by links.ts); left out when the server has no link columns yet. */
  links?: ProLinks;
};

type LinkRow = { linkedin_url?: string | null; website_url?: string | null; instagram_url?: string | null; tiktok_url?: string | null };

/** Links as stored → links shown: each one re-checked, an invalid one is no link. */
const toLinks = (r: LinkRow | null | undefined): ProLinks =>
  r ? { linkedin: safeLink('linkedin', r.linkedin_url), website: safeLink('website', r.website_url), instagram: safeLink('instagram', r.instagram_url), tiktok: safeLink('tiktok', r.tiktok_url) } : NO_LINKS;

/** The server has not got the link columns (migration 20261024008000) yet: links are left out, nothing else changes. */
const noLinkColumns = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === '42703' || e.code === 'PGRST204' || e.code === 'PGRST202' || /linkedin_url|pro_links_of/i.test(e.message ?? '')));

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
// Photos stored before small copies existed (signing their small copy failed).
const noSmall = new Set<string>();

/** Log out: signed photo links of the account that left are forgotten. */
export function clearNetworkLinks(): void {
  signed.clear();
  noSmall.clear();
}
/**
 * Links for profile photos, keyed by the photo's path. Cards ask for the small
 * copy (256 px, next to the photo) when there is one, and get the photo itself
 * when there is not; a profile page asks for the full photo.
 */
export async function photoUrls(paths: string[], size: 'small' | 'full' = 'full'): Promise<Record<string, string>> {
  const now = Date.now();
  // IRLY avatars are stored as is: they stand for themselves, nothing to sign.
  for (const p of paths) if (isAvatar(p)) signed.set(p, { url: p, until: Infinity });
  const valid = (p: string) => (signed.get(p)?.until ?? 0) > now;
  const files = [...new Set(paths.filter(Boolean))];
  const smallOf = (p: string) => (size === 'small' && !isAvatar(p) && !noSmall.has(p) ? thumbOf(p) : null);
  const ask = new Set<string>();
  for (const p of files) {
    const small = smallOf(p);
    if (small && valid(small)) continue;
    if (small) ask.add(small);
    // The photo itself too, in the same request, in case it has no small copy.
    if (!valid(p)) ask.add(p);
  }
  if (ask.size && supabase) {
    const { data } = await supabase.storage.from('profile-photos').createSignedUrls([...ask], DAY);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, { url: d.signedUrl, until: now + (DAY - 600) * 1000 });
    // Asked for and not there: this photo has no small copy (the answer came, so it is not a network error).
    if (data) for (const p of files) if (smallOf(p) && ask.has(thumbOf(p)) && !signed.has(thumbOf(p))) noSmall.add(p);
  }
  const out: Record<string, string> = {};
  for (const p of files) {
    const small = smallOf(p);
    const hit = (small && signed.get(small)) || signed.get(p);
    if (hit) out[p] = hit.url;
  }
  return out;
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
  const [res, setRes] = useState<{ for: string; pro: ProProfile | null; visible: boolean; links: ProLinks; linksOn: boolean; error: string | null }>({
    for: '',
    pro: null,
    visible: true,
    links: NO_LINKS,
    linksOn: false,
    error: null,
  });

  const load = useCallback(async () => {
    if (!uid || !supabase) return { pro: null, visible: true, links: NO_LINKS, linksOn: false };
    const [{ data, error: e }, own, mine] = await Promise.all([
      supabase.rpc('pro_profile_of', { p_user: uid }),
      supabase.from('pro_profiles').select('visible').eq('user_id', uid).maybeSingle(),
      supabase.from('pro_profiles').select('linkedin_url, website_url, instagram_url, tiktok_url').eq('user_id', uid).maybeSingle(),
    ]);
    if (e) throw new Error(e.message);
    // Unread, "visible" would default to on: saving would publish a hidden profile.
    if (own.error) throw new Error(own.error.message);
    // Unread links would be saved as empty: the editor waits for them, unless the server has no such columns.
    const linksOn = !noLinkColumns(mine.error);
    if (mine.error && linksOn) throw new Error(mine.error.message);
    const r = ((data as Row[]) ?? [])[0];
    return { pro: r ? toPro(r) : null, visible: (own.data as { visible?: boolean } | null)?.visible ?? true, links: linksOn ? toLinks(mine.data as LinkRow | null) : NO_LINKS, linksOn };
  }, [uid]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    load()
      .then((x) => alive && setRes({ for: current, pro: x.pro, visible: x.visible, links: x.links, linksOn: x.linksOn, error: null }))
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
        // Only when the server has the columns (read when the profile loaded): never written blind.
        ...(d.links && res.linksOn ? Object.fromEntries(LINK_KINDS.map((k) => [k.column, d.links?.[k.id] ?? null])) : {}),
      };
      const { error: e } = await need().from('pro_profiles').upsert(row, { onConflict: 'user_id' });
      if (e) throw new Error(/_url_check/i.test(e.message) ? 'One of your links is not valid' : /check constraint/i.test(e.message) ? 'Some fields are not valid' : e.message);
      track('PRO_PROFILE_SAVE', { industries: d.industries.length, intents: d.intents.length });
      bump();
    },
    [uid, bump, res.linksOn],
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
    /** Your links as saved (re-checked). */
    links: res.links,
    /** The server stores links (its link columns exist). */
    linksOn: res.linksOn,
    loading: on && !fresh,
    error: on ? res.error : null,
    save,
    remove,
    reload: bump,
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
  // "Try again" after a failure asks the server once more.
  const [attempt, setAttempt] = useState(0);

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
          const urls = await photoUrls(l.map((p) => p.photoPath).filter(Boolean) as string[], 'small');
          if (alive && mine === n) setPhotos(urls);
        })
        .catch((e) => alive && mine === n && setRes((r) => ({ for: current, list: r.list, error: e instanceof Error ? e.message : 'offline' })));
    };
    reload();
    // Requests sent or accepted (here or on another phone) update the buttons.
    const channel = liveChannel(`pros-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, reload)
      // Listening: a request sent or accepted before then is in no event.
      .subscribe(whenListening(reload));
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, load, current, attempt]);

  /** Optimistic connection state for one card, while the server answers. */
  const setConnection = useCallback((userId: string, connection: ProProfile['connection']) => {
    setRes((r) => ({ ...r, list: r.list.map((p) => (p.userId === userId ? { ...p, connection } : p)) }));
  }, []);

  const on = Boolean(uid && supabase);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { list: on ? res.list : NONE, photos, loading: on && res.for !== current, error: res.error, setConnection, retry, signedIn: Boolean(uid) };
}

/** One professional's profile. */
export function usePro(userId: string) {
  const uid = useAccount()?.userId;
  const [res, setRes] = useState<{ id: string; pro: ProProfile | null; failed: boolean }>({ id: '', pro: null, failed: false });
  const [photo, setPhoto] = useState<string | null>(null);
  const [links, setLinks] = useState<{ id: string; links: ProLinks }>({ id: '', links: NO_LINKS });

  const load = useCallback(async () => {
    if (!uid || !supabase) return null;
    const [{ data, error: e }, l] = await Promise.all([supabase.rpc('pro_profile_of', { p_user: userId }), supabase.rpc('pro_links_of', { p_user: userId })]);
    if (e) throw new Error(e.message);
    const r = ((data as Row[]) ?? [])[0];
    // Links are an extra: unreadable (or not on the server yet), the profile shows without them.
    setLinks({ id: userId, links: l.error ? NO_LINKS : toLinks(((l.data as LinkRow[] | null) ?? [])[0]) });
    return r ? toPro(r) : null;
  }, [uid, userId]);

  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    // Answers can cross (the first read and a catch-up): only the latest one sent is shown.
    let sent = 0;
    const reload = () =>
      (() => {
        const n = ++sent;
        const current = () => alive && n === sent;
        load()
          .then(async (p) => {
            if (!current()) return;
            setRes({ id: userId, pro: p, failed: false });
            if (p?.photoPath) {
              const urls = await photoUrls([p.photoPath]);
              if (current()) setPhoto(urls[p.photoPath] ?? null);
            } else setPhoto(null); // Removed meanwhile: the old one does not stay.
          })
          .catch(() => current() && setRes((r) => ({ id: userId, pro: r.id === userId ? r.pro : null, failed: true })));
      })();
    reload();
    const channel = liveChannel(`pro-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, reload)
      .subscribe(whenListening(reload));
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, userId, load]);

  const setConnection = useCallback((connection: ProProfile['connection']) => setRes((r) => (r.pro ? { ...r, pro: { ...r.pro, connection } } : r)), []);

  const on = Boolean(uid && supabase);
  const pro = on && res.id === userId ? res.pro : null;
  const state: 'loading' | 'ready' | 'missing' | 'error' = !on ? 'missing' : res.id !== userId ? 'loading' : res.failed && !pro ? 'error' : pro ? 'ready' : 'missing';
  return { pro, photo: res.id === userId ? photo : null, links: pro && links.id === userId ? links.links : NO_LINKS, state, setConnection };
}

/** Connect from Networking: sends a request, or accepts theirs. Returns 'pending' or 'accepted'. */
export async function proConnect(userId: string): Promise<string> {
  const { data, error: e } = await need().rpc('pro_connect', { p_user: userId });
  if (e) throw new Error(/many requests/i.test(e.message) ? 'You sent many requests today. Try again tomorrow.' : /not available/i.test(e.message) ? 'This member is not available' : e.message);
  return data as string;
}
