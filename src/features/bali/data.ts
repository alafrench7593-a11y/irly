import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';
import { cityScope } from '@/data/destinations';
import { useCityFilter } from '@/features/server/scope';
import type { CityId } from '@/data/types';
import type { AreaProfile, OpeningHours } from './fit';

/**
 * Destination data from the IRLY server: areas (with their administrative
 * unit), editorial area profiles, sourced guides, the move checklist,
 * places from the data provider, and IRLY Girl circles. Area guides and
 * places can be browsed before signing in.
 */

function useQuery<T>(key: string, run: () => Promise<T>, initial: T): { data: T; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  // A new key (filter, search, city) or a reload: show loading, drop the old error.
  const [seen, setSeen] = useState(`${key}#${tick}`);
  if (seen !== `${key}#${tick}`) {
    setSeen(`${key}#${tick}`);
    // Keep the previous results on screen while refining (no spinner flash per keystroke).
    setLoading(Array.isArray(data) ? data.length === 0 : true);
    setError(null);
  }
  useEffect(() => {
    let alive = true;
    run()
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // `key` captures every input of `run`.
  }, [key, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, error, reload };
}

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}

/* ───────── Areas ───────── */

export type DestArea = { id: string; name: string; parentId: string | null; adminId: string | null; adminName: string | null; kind: string; lat: number | null; lng: number | null };

export function useDestAreas(cityId: string) {
  return useQuery<DestArea[]>(
    `areas-${cityId}`,
    async () => {
      const [{ data: areas, error }, { data: admins }] = await Promise.all([
        sb().from('areas').select('id, name, parent_area_id, admin_area_id, kind, lat, lng, sort').eq('city_id', cityId).order('sort'),
        sb().from('admin_areas').select('id, name'),
      ]);
      if (error) throw new Error(error.message);
      const adminName = new Map((admins ?? []).map((a) => [a.id as string, a.name as string]));
      return (areas ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        parentId: a.parent_area_id,
        adminId: a.admin_area_id,
        adminName: a.admin_area_id ? (adminName.get(a.admin_area_id) ?? null) : null,
        kind: a.kind,
        lat: a.lat == null ? null : Number(a.lat),
        lng: a.lng == null ? null : Number(a.lng),
      }));
    },
    [],
  );
}

export function useAreaProfiles(cityId: string) {
  return useQuery<AreaProfile[]>(
    `profiles-${cityId}`,
    async () => {
      const [{ data, error }, { data: areas }] = await Promise.all([
        sb().from('area_profiles').select('*').eq('city_id', cityId),
        sb().from('areas').select('id, name').eq('city_id', cityId),
      ]);
      if (error) throw new Error(error.message);
      const name = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
      return (data ?? []).map((r) => ({
        areaId: r.area_id,
        name: name.get(r.area_id) ?? r.area_id,
        tagline: r.tagline,
        vibe: r.vibe,
        bestFor: r.best_for ?? [],
        notIdealFor: r.not_ideal_for ?? [],
        traits: r.traits ?? {},
        pros: r.pros ?? [],
        cons: r.cons ?? [],
      }));
    },
    [],
  );
}

/* ───────── Guides ───────── */

export type GuideKind = 'official' | 'irly_guide' | 'third_party';
export type Guide = {
  id: string;
  section: string;
  title: string;
  body: string;
  kind: GuideKind;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceDate: string | null;
  lastVerifiedAt: string | null;
  reviewBy: string | null;
};

export function useGuides(destination: string, section?: string) {
  return useQuery<Guide[]>(
    `guides-${destination}-${section ?? 'all'}`,
    async () => {
      let q = sb().from('guide_articles').select('*').eq('destination', destination).order('sort');
      if (section) q = q.eq('section', section);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []).map((g) => ({
        id: g.id,
        section: g.section,
        title: g.title,
        body: g.body,
        kind: g.kind,
        sourceName: g.source_name,
        sourceUrl: g.source_url,
        sourceDate: g.source_date,
        lastVerifiedAt: g.last_verified_at,
        reviewBy: g.review_by,
      }));
    },
    [],
  );
}

/* ───────── My move ───────── */

export type MoveStep = { id: string; label: string; section: string | null; done: boolean };

export function useMove(destination: string) {
  const account = useAccount();
  const uid = account?.userId;
  const q = useQuery<MoveStep[]>(
    `move-${destination}-${uid ?? 'anon'}`,
    async () => {
      const [{ data: steps, error }, progress] = await Promise.all([
        sb().from('relocation_steps').select('id, label, section, sort').order('sort'),
        uid ? sb().from('relocation_progress').select('step_id').eq('destination', destination) : Promise.resolve({ data: [] as { step_id: string }[] }),
      ]);
      if (error) throw new Error(error.message);
      if ('error' in progress && progress.error) throw new Error(progress.error.message);
      const done = new Set((progress.data ?? []).map((p) => p.step_id));
      return (steps ?? []).map((s) => ({ id: s.id, label: s.label, section: s.section, done: done.has(s.id) }));
    },
    [],
  );
  const toggle = useCallback(
    async (step: MoveStep) => {
      if (!uid) throw new Error('Sign in to save your progress');
      const r = step.done
        ? await sb().from('relocation_progress').delete().eq('destination', destination).eq('step_id', step.id)
        : await sb().from('relocation_progress').upsert({ user_id: uid, destination, step_id: step.id }, { ignoreDuplicates: true });
      if (r.error) throw new Error(r.error.message);
      q.reload();
    },
    [uid, destination, q],
  );
  return { ...q, toggle, signedIn: Boolean(uid) };
}

/* ───────── Places ───────── */

export type PlaceHit = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  areaId: string | null;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  cuisines: string[];
  tags: string[];
  photo: string | null;
  openingHours: OpeningHours;
  amenities: Record<string, unknown>;
  going: number;
  score: number;
  confidence: number;
};

export type PlaceFilters = {
  area?: string | null;
  kind?: string | null;
  cuisine?: string | null;
  minRating?: number | null;
  maxPrice?: number | null;
  tags?: string[] | null;
  kids?: boolean;
  q?: string | null;
};

export function usePlaces(cityId: string, f: PlaceFilters) {
  const key = JSON.stringify({ cityId, ...f });
  return useQuery<PlaceHit[]>(
    `places-${key}`,
    async () => {
      const { data, error } = await sb().rpc('places_search', {
        p_city: cityId,
        p_area: f.area ?? null,
        p_kind: f.kind ?? null,
        p_cuisine: f.cuisine ?? null,
        p_min_rating: f.minRating ?? null,
        p_max_price: f.maxPrice ?? null,
        p_tags: f.tags?.length ? f.tags : null,
        p_kids: Boolean(f.kids),
        p_q: f.q?.trim() || null,
        p_limit: 60,
      });
      if (error) throw new Error(error.message);
      return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        kind: r.kind as string,
        areaId: (r.area_id as string) ?? null,
        rating: r.rating == null ? null : Number(r.rating),
        reviewCount: (r.review_count as number) ?? null,
        priceLevel: (r.price_level as number) ?? null,
        cuisines: (r.cuisines as string[]) ?? [],
        tags: (r.tags as string[]) ?? [],
        photo: (r.photo as string) ?? null,
        openingHours: r.opening_hours as OpeningHours,
        amenities: (r.amenities as Record<string, unknown>) ?? {},
        going: Number(r.going ?? 0),
        score: Number(r.score ?? 0),
        confidence: Number(r.confidence ?? 0),
      }));
    },
    [],
  );
}

export type PlaceDetail = PlaceHit & {
  cityId: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  bookingUrl: string | null;
  menuUrl: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  provider: string | null;
  fetchedAt: string | null;
};

export function usePlace(slug: string) {
  return useQuery<PlaceDetail | null>(
    `place-${slug}`,
    async () => {
      const { data, error } = await sb().from('places').select('*').eq('slug', slug).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id,
        slug: data.slug,
        cityId: data.city_id,
        name: data.name,
        kind: data.kind,
        areaId: data.area_id,
        rating: data.rating == null ? null : Number(data.rating),
        reviewCount: data.review_count,
        priceLevel: data.price_level,
        cuisines: data.cuisines ?? [],
        tags: data.tags ?? [],
        photo: data.photos?.[0] ?? data.image_url ?? null,
        photos: data.photos?.length ? data.photos : data.image_url ? [data.image_url] : [],
        openingHours: data.opening_hours,
        amenities: data.amenities ?? {},
        going: 0,
        score: 0,
        confidence: 0,
        address: data.address,
        phone: data.phone,
        website: data.website,
        bookingUrl: data.booking_url,
        menuUrl: data.menu_url,
        lat: data.lat == null ? null : Number(data.lat),
        lng: data.lng == null ? null : Number(data.lng),
        provider: data.provider,
        fetchedAt: data.fetched_at,
      };
    },
    null,
  );
}

export type PlaceActivity = { id: string; title: string; activityType: string | null; audience: string; startsAt: number; going: number };

/** "Who's going?": upcoming plans at this place, live as people join. */
export function usePlaceActivities(slug: string) {
  const account = useAccount();
  const q = useQuery<PlaceActivity[]>(
    `place-acts-${slug}-${account?.userId ?? 'anon'}`,
    async () => {
      const { data, error } = await sb().rpc('place_activities', { p_slug: slug });
      if (error) throw new Error(error.message);
      return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        activityType: (r.activity_type as string) ?? null,
        audience: r.audience as string,
        startsAt: Date.parse(r.starts_at as string),
        going: Number(r.going ?? 0),
      }));
    },
    [],
  );
  const { reload } = q;
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(topic(`place-acts-${slug}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_participants' }, () => reload())
      .subscribe();
    return () => {
      supabase?.removeChannel(channel);
    };
  }, [slug, reload]);
  return q;
}

/* ───────── IRLY Girl circles (moving to Bali, moms) ───────── */

export type CircleMember = {
  userId: string;
  firstName: string;
  areas: string[];
  status: 'visiting' | 'moving_soon' | 'just_arrived' | 'living' | null;
  moveMonth: string | null;
  momMode: boolean;
  kidsAgeGroups: string[];
  lookingFor: string[];
  interests: string[];
  score: number | null;
};

export function useGirlCircle(destination: string, opts: { status?: string | null; moms?: boolean; area?: string | null; looking?: string | null }) {
  const account = useAccount();
  const key = JSON.stringify({ destination, ...opts, u: account?.userId });
  return useQuery<CircleMember[]>(
    `circle-${key}`,
    async () => {
      if (!account) return [];
      const { data, error } = await sb().rpc('girl_circle', {
        p_destination: destination,
        p_status: opts.status ?? null,
        p_moms: Boolean(opts.moms),
        p_area: opts.area ?? null,
        p_limit: 40,
        p_looking: opts.looking ?? null,
      });
      if (error) throw new Error(error.message);
      return ((data as Record<string, unknown>[]) ?? []).map((r) => ({
        userId: r.user_id as string,
        firstName: r.first_name as string,
        areas: (r.areas as string[]) ?? [],
        status: (r.destination_status as CircleMember['status']) ?? null,
        moveMonth: (r.move_month as string) ?? null,
        momMode: Boolean(r.mom_mode),
        kidsAgeGroups: (r.kids_age_groups as string[]) ?? [],
        lookingFor: (r.looking_for as string[]) ?? [],
        interests: (r.interests as string[]) ?? [],
        score: r.score == null ? null : Number(r.score),
      }));
    },
    [],
  );
}

export type GirlExtras = {
  destination?: string | null;
  destinationStatus?: CircleMember['status'];
  moveMonth?: string | null;
  momMode?: boolean;
  kidsAgeGroups?: string[];
  lookingFor?: string[];
};

/** My Bali status / Mom mode, on my IRLY Match profile. */
export function useGirlExtras() {
  const account = useAccount();
  const uid = account?.userId;
  const q = useQuery<(GirlExtras & { hasProfile: boolean }) | null>(
    `extras-${uid ?? 'anon'}`,
    async () => {
      if (!uid) return null;
      const { data } = await sb()
        .from('irly_match_profiles')
        .select('destination, destination_status, move_month, mom_mode, kids_age_groups, looking_for')
        .eq('user_id', uid)
        .maybeSingle();
      if (!data) return { hasProfile: false };
      return {
        hasProfile: true,
        destination: data.destination,
        destinationStatus: data.destination_status,
        moveMonth: data.move_month,
        momMode: data.mom_mode,
        kidsAgeGroups: data.kids_age_groups ?? [],
        lookingFor: data.looking_for ?? [],
      };
    },
    null,
  );
  const save = useCallback(
    async (patch: GirlExtras) => {
      if (!uid) throw new Error('Sign in first');
      const row: Record<string, unknown> = {};
      if ('destination' in patch) row.destination = patch.destination;
      if ('destinationStatus' in patch) row.destination_status = patch.destinationStatus;
      if ('moveMonth' in patch) row.move_month = patch.moveMonth;
      if ('momMode' in patch) row.mom_mode = patch.momMode;
      if ('kidsAgeGroups' in patch) row.kids_age_groups = patch.kidsAgeGroups;
      if ('lookingFor' in patch) row.looking_for = patch.lookingFor;
      const { data, error } = await sb().from('irly_match_profiles').update(row).eq('user_id', uid).select('user_id');
      if (error) throw new Error(error.message);
      if (!data?.length) throw new Error('Create your IRLY Girl profile first');
      q.reload();
    },
    [uid, q],
  );
  return { ...q, save, signedIn: Boolean(uid) };
}

/** Communities of a destination matching a word (Moms, Girls…), with membership. */
export function useCommunitiesLike(cityId: string, like: string, girlOnly = false) {
  const account = useAccount();
  const { keep } = useCityFilter(cityId as CityId);
  const q = useQuery<{ id: string; name: string; tagline: string | null; member: boolean; members: number; cityId: string }[]>(
    `comm-${cityId}-${like}-${girlOnly}-${account?.userId ?? 'anon'}`,
    async () => {
      if (!account) return [];
      let q = sb()
        .from('communities')
        .select('id, name, tagline, city_id, community_members(user_id)')
        .in('city_id', cityScope(cityId as CityId))
        .ilike('name', `%${like}%`)
        .is('deleted_at', null);
      if (girlOnly) q = q.eq('girl_only', true);
      const { data, error } = await q.order('name');
      if (error) throw new Error(error.message);
      return (data ?? []).map((c) => {
        const m = (c.community_members ?? []) as { user_id: string }[];
        return { id: c.id, name: c.name, tagline: c.tagline, member: m.some((x) => x.user_id === account.userId), members: m.length, cityId: c.city_id as string };
      });
    },
    [],
  );
  const data = useMemo(() => q.data.filter((c) => keep(c.cityId)), [q.data, keep]);
  return { ...q, data };
}

// One join for the whole app: the same function as the community pages, so every list hears about it.
export { joinCommunity } from '@/features/community/data';
