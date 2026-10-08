import { DEMO } from '@/config/app';
import { GIRLS as EXAMPLE_GIRLS } from '@/data/content/girls';
import { isAvatar } from '@/features/avatar/avatar';

// Example members exist only in the demo build; real members come from the server.
const GIRLS = DEMO ? EXAMPLE_GIRLS : [];
import { hasSession, supabase } from '@/lib/supabase';
import { useStore } from '@/state/store';
import { portrait } from '@/data/photos';
import { DEFAULT_WEIGHTS, matchScore, normalizeReasons, type MatchProfile, type Reasons, type Weights } from './compat';
import { useGirlStore } from './girlStore';
import type { Candidate, Filters, MatchAction, MatchProfileDraft, MatchResult, MatchState, MatchSummary, ReportCategory } from './types';
import { imageBytes, imageType } from '@/lib/media';

/**
 * IRLY Match data access. Screens only talk to this.
 *
 * - Server: Supabase RPCs (`irly_match_*`), where eligibility, visibility,
 *   scoring, match creation and chats are enforced.
 * - Device: the same behaviour on local data when no backend is configured
 *   or nobody is signed in (development, demos).
 */
export interface MatchApi {
  mode: 'server' | 'device';
  state(): Promise<MatchState>;
  completeOnboarding(): Promise<void>;
  getProfile(): Promise<MatchProfileDraft | null>;
  saveProfile(draft: MatchProfileDraft): Promise<void>;
  discover(filters: Filters, offset?: number): Promise<Candidate[]>;
  act(userId: string, action: MatchAction): Promise<MatchResult | null>;
  matches(): Promise<MatchSummary[]>;
  unmatch(matchId: string): Promise<void>;
  block(userId: string): Promise<void>;
  report(userId: string, category: ReportCategory, details?: string): Promise<void>;
}

export const PAGE_SIZE = 20;

/* ───────────────────────── Server ───────────────────────── */

const toFilters = (f: Filters) => ({
  section: f.section,
  interests: f.interests?.length ? f.interests : undefined,
  sport: f.sport,
  language: f.language,
  goal: f.goal,
  area: f.area,
  availability: f.availability,
  travel: f.travel || undefined,
  age_min: f.ageMin,
  age_max: f.ageMax,
});

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

async function signedPhotos(paths: string[]): Promise<string[]> {
  if (!paths.length) return [];
  // IRLY avatars are stored as is and need no signing; order is kept.
  const files = paths.filter((p) => !isAvatar(p));
  const { data } = files.length ? await supabase!.storage.from('match-photos').createSignedUrls(files, 3600) : { data: [] };
  const urls = new Map((data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => (isAvatar(p) ? p : urls.get(p))).filter(Boolean) as string[];
}

const hueOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

type DiscoverRow = {
  user_id: string;
  first_name: string;
  age: number | null;
  city_id: string;
  bio: string | null;
  photo_paths: string[];
  interests: string[];
  sports: string[];
  activities: string[];
  goals: string[];
  languages: string[];
  areas: string[];
  travel: string[];
  active_now: boolean;
  is_new: boolean;
  saved: boolean;
  score: number;
  reasons: Reasons;
};

const serverApi: MatchApi = {
  mode: 'server',
  async state() {
    try {
      return await rpc<MatchState>('irly_match_state');
    } catch (e) {
      if (String(e).includes('reserved for women')) return 'ineligible';
      throw e;
    }
  },
  completeOnboarding: () => rpc('complete_irly_match_onboarding'),
  async getProfile() {
    const { data, error } = await supabase!.from('irly_match_profiles').select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      bio: data.bio ?? '',
      photoUris: await signedPhotos(data.photo_paths ?? []),
      interests: data.interests,
      sports: data.sports,
      activities: data.activities,
      goals: data.goals,
      languages: data.languages,
      areas: data.areas,
      availability: data.availability,
      travel: data.travel,
      lifestyle: data.lifestyle,
      ageMin: data.age_min,
      ageMax: data.age_max,
      hiddenFields: data.hidden_fields,
      visible: data.visible,
      showActive: false,
    };
  },
  async saveProfile(d) {
    const { data: auth } = await supabase!.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) throw new Error('Sign in to save your profile');
    // Local photos are uploaded to the member's own folder first.
    const paths: string[] = [];
    for (const [i, uri] of d.photoUris.entries()) {
      if (uri.startsWith('http')) continue;
      if (isAvatar(uri)) {
        paths.push(uri);
        continue;
      }
      const body = await imageBytes(uri);
      const img = imageType(uri);
      const path = `${uid}/${Date.now()}-${i}.${img.ext}`;
      const { error } = await supabase!.storage.from('match-photos').upload(path, body, { contentType: img.contentType, upsert: false });
      if (error) throw new Error(error.message);
      paths.push(path);
    }
    const { error } = await supabase!.from('irly_match_profiles').upsert({
      user_id: uid,
      bio: d.bio || null,
      photo_paths: paths,
      interests: d.interests,
      sports: d.sports,
      activities: d.activities,
      goals: d.goals,
      languages: d.languages,
      areas: d.areas,
      availability: d.availability,
      travel: d.travel,
      lifestyle: d.lifestyle,
      age_min: d.ageMin,
      age_max: d.ageMax,
      hidden_fields: d.hiddenFields,
      visible: d.visible,
    });
    if (error) throw new Error(error.message);
    await supabase!.from('safety_settings').upsert({ user_id: uid, show_active: d.showActive });
  },
  async discover(filters, offset = 0) {
    const rows = await rpc<DiscoverRow[]>('irly_match_discover', { p_filters: toFilters(filters), p_limit: PAGE_SIZE, p_offset: offset });
    return Promise.all(
      rows.map(async (r) => ({
        userId: r.user_id,
        firstName: r.first_name,
        age: r.age,
        cityId: r.city_id,
        bio: r.bio ?? undefined,
        photoUrls: await signedPhotos(r.photo_paths),
        hue: hueOf(r.user_id),
        interests: r.interests,
        sports: r.sports,
        activities: r.activities,
        goals: r.goals,
        languages: r.languages,
        areas: r.areas,
        travel: r.travel,
        activeNow: r.active_now,
        isNew: r.is_new,
        saved: r.saved,
        score: r.score,
        reasons: normalizeReasons(r.reasons),
      })),
    );
  },
  async act(userId, action) {
    const rows = await rpc<{ match_id: string; conversation_id: string; score: number; reasons: Reasons }[]>('irly_match_act', {
      p_target: userId,
      p_action: action,
    });
    const r = rows?.[0];
    return r ? { matchId: r.match_id, conversationId: r.conversation_id, score: r.score, reasons: normalizeReasons(r.reasons) } : null;
  },
  async matches() {
    const rows = await rpc<
      { match_id: string; conversation_id: string; user_id: string; first_name: string; photo_paths: string[]; score: number; reasons: Reasons; created_at: string }[]
    >('irly_my_matches');
    return Promise.all(
      rows.map(async (r) => ({
        matchId: r.match_id,
        conversationId: r.conversation_id,
        userId: r.user_id,
        firstName: r.first_name,
        hue: hueOf(r.user_id),
        photoUrls: await signedPhotos(r.photo_paths),
        score: r.score,
        reasons: normalizeReasons(r.reasons),
        createdAt: Date.parse(r.created_at),
      })),
    );
  },
  unmatch: (matchId) => rpc('irly_unmatch', { p_match: matchId }),
  block: (userId) => rpc('block_user', { p_target: userId }),
  async report(userId, category, details) {
    await rpc('report', { p_kind: 'profile', p_target_user: userId, p_target_id: null, p_category: category, p_details: details ?? null });
  },
};

/* ───────────────────────── Device (no backend) ───────────────────────── */

/** In development, another member "likes back" when you get along this well. */
const DEV_LIKES_BACK_FROM = 50;

function me(): MatchProfile | null {
  const profile = useStore.getState().profile;
  const cityId = useStore.getState().cityId ?? 'dubai';
  const draft = useGirlStore.getState().profile;
  if (!draft) return null;
  return {
    ...draft,
    userId: 'me',
    firstName: profile.name || 'You',
    age: profile.age ?? 28,
    cityId,
    communities: [],
  };
}

function seedProfile(id: string): MatchProfile | null {
  const g = GIRLS.find((x) => x.person.id === id);
  if (!g) return null;
  return { ...g.match, userId: g.person.id, firstName: g.person.name, age: g.person.age, cityId: g.person.cityId };
}

let weights: Weights = DEFAULT_WEIGHTS;

const deviceApi: MatchApi = {
  mode: 'device',
  async state() {
    if (useStore.getState().profile.gender !== 'woman') return 'ineligible';
    const s = useGirlStore.getState();
    if (!s.onboarded) return 'onboarding';
    if (!s.profile) return 'profile';
    return 'ready';
  },
  async completeOnboarding() {
    useGirlStore.getState().setOnboarded();
  },
  async getProfile() {
    return useGirlStore.getState().profile;
  },
  async saveProfile(d) {
    useGirlStore.getState().setProfile(d);
  },
  async discover(filters, offset = 0) {
    const mine = me();
    if (!mine) return [];
    const s = useGirlStore.getState();
    const section = filters.section ?? 'for_you';
    const list = GIRLS.filter((g) => {
      const id = g.person.id;
      const m = g.match;
      const hidden = (f: string) => m.hiddenFields.includes(f);
      if (s.blocked[id] || s.decisions[id] || s.matches.some((x) => x.userId === id)) return false;
      if (section === 'saved' && !s.saved[id]) return false;
      if (filters.interests?.length && !filters.interests.some((i) => m.interests.includes(i))) return false;
      if (filters.sport && !m.sports.includes(filters.sport)) return false;
      if (filters.language && (hidden('languages') || !m.languages.includes(filters.language))) return false;
      if (filters.goal && !m.goals.includes(filters.goal)) return false;
      if (filters.area && (hidden('areas') || !m.areas.includes(filters.area))) return false;
      if (filters.availability && !m.availability.includes(filters.availability)) return false;
      if (filters.travel && !m.travel.length) return false;
      if (filters.ageMin && g.person.age < filters.ageMin) return false;
      if (filters.ageMax && g.person.age > filters.ageMax) return false;
      switch (section) {
        case 'new':
          return Boolean(g.newHere);
        case 'active':
          return Boolean(g.activeNow);
        case 'nearby':
          return !hidden('areas') && m.areas.some((a) => mine.areas.includes(a));
        case 'interests':
          return m.interests.some((i) => mine.interests.includes(i));
        case 'sports':
          return m.sports.some((x) => mine.sports.includes(x));
        case 'travel':
          return m.travel.length > 0;
        default:
          return g.person.cityId === mine.cityId;
      }
    })
      .map((g): Candidate => {
        const other = seedProfile(g.person.id)!;
        const { score, reasons } = matchScore(mine, other, weights);
        const hidden = (f: string) => g.match.hiddenFields.includes(f);
        if (hidden('areas')) reasons.areas = [];
        return {
          userId: g.person.id,
          firstName: g.person.name,
          age: hidden('age') ? null : g.person.age,
          cityId: g.person.cityId,
          bio: g.match.bio,
          photoUrls: [portrait(g.person.id)],
          cover: g.cover,
          hue: g.person.hue,
          interests: g.match.interests,
          sports: g.match.sports,
          activities: g.match.activities,
          goals: g.match.goals,
          languages: hidden('languages') ? [] : g.match.languages,
          areas: hidden('areas') ? [] : g.match.areas,
          travel: g.match.travel,
          activeNow: Boolean(g.activeNow),
          isNew: Boolean(g.newHere),
          saved: Boolean(s.saved[g.person.id]),
          score,
          reasons,
        };
      })
      .sort((a, b) => b.score - a.score);
    return list.slice(offset, offset + PAGE_SIZE);
  },
  async act(userId, action) {
    const s = useGirlStore.getState();
    if (s.blocked[userId]) throw new Error('Profile not available');
    if (action === 'save' || action === 'unsave') {
      s.toggleSaved(userId, action === 'save');
      return null;
    }
    s.decide(userId, action);
    if (action !== 'like') return null;
    const existing = s.matches.find((m) => m.userId === userId);
    if (existing) return { matchId: existing.id, conversationId: existing.conversationId, score: existing.score, reasons: existing.reasons };
    const mine = me();
    const other = seedProfile(userId);
    if (!mine || !other) return null;
    const { score, reasons } = matchScore(mine, other, weights);
    if (score < DEV_LIKES_BACK_FROM) return null;
    const match = { id: `match-${userId}`, userId, conversationId: `cv-match-${userId}`, score, reasons, createdAt: Date.now() };
    useGirlStore.getState().addMatch(match);
    return { matchId: match.id, conversationId: match.conversationId, score, reasons };
  },
  async matches() {
    return useGirlStore
      .getState()
      .matches.map((m) => {
        const g = GIRLS.find((x) => x.person.id === m.userId);
        return {
          matchId: m.id,
          conversationId: m.conversationId,
          userId: m.userId,
          firstName: g?.person.name ?? 'IRLY member',
          hue: g?.person.hue ?? 0,
          cover: g?.cover,
          photoUrls: g ? [portrait(g.person.id)] : [],
          score: m.score,
          reasons: m.reasons,
          createdAt: m.createdAt,
        };
      });
  },
  async unmatch(matchId) {
    useGirlStore.getState().removeMatch(matchId);
  },
  async block(userId) {
    useGirlStore.getState().block(userId);
  },
  async report(userId, category, details) {
    useGirlStore.getState().report(userId, category, details);
  },
};

/** The API to use right now: the server when signed in, the device otherwise. */
export async function matchApi(): Promise<MatchApi> {
  if (supabase && (await hasSession())) {
    const { data } = await supabase.from('irly_match_config').select('weights').maybeSingle();
    if (data?.weights) weights = { ...DEFAULT_WEIGHTS, ...(data.weights as Partial<Weights>) };
    return serverApi;
  }
  return deviceApi;
}

/** Synchronous access to on-device matches (chat list, conversations). */
export function deviceMatchSeed(userId: string) {
  return GIRLS.find((g) => g.person.id === userId);
}
