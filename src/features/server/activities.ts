import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';
import { NONE } from '@/lib/none';
import type { CityId } from '@/data/types';
import { CITIES } from '@/data/destinations';
import { dateFor, dayOf } from '@/features/ai/intent';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';
import type { MyPlan } from '@/state/store';
import { imageBytes, imageType } from '@/lib/media';

/**
 * Activities on the server (signed in). Creating a session in the app also
 * creates it here, so other members see it, can join it, and its chat is
 * shared. Joining goes through `join_activity` (capacity-safe).
 */

const PRIVACY: Record<NonNullable<MyPlan['privacy']>, string> = { public: 'public', connections: 'friends', community: 'community', invite: 'invite' };

/** "Today" / "Tomorrow" / "This weekend" / "Next week" / "Monday" + "19:30" → an instant, in the city's time. */
export function startsAt(day: string, time: string, now = new Date(), utcOffset?: number): Date {
  return dateFor(dayOf(day), time, now, utcOffset);
}

/** Extras that tie an activity to a place, a type (PLAYDATE, DINNER…) and an audience. */
export type ActivityExtras = { placeId?: string | null; activityType?: string | null; audience?: 'all' | 'girls' | 'moms' | 'families'; communityId?: string | null; girlOnly?: boolean; coverUri?: string | null };

/** Signed links for uploaded activity photos (private bucket); other values pass through. */
export async function coverLinks(paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  const own = [...new Set(paths.filter((p): p is string => Boolean(p) && !/^https?:/.test(p as string)))];
  const out: Record<string, string> = {};
  for (const p of paths) if (p && /^https?:/.test(p)) out[p] = p;
  if (!supabase || !own.length) return out;
  const { data } = await supabase.storage.from('activity-photos').createSignedUrls(own, 6 * 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function createServerActivity(plan: Omit<MyPlan, 'id' | 'createdAt'>, at?: Date, extras: ActivityExtras = {}): Promise<string | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  // The member's own photo goes up first, into their folder.
  let coverPath: string | null = null;
  if (extras.coverUri) {
    const img = imageType(extras.coverUri);
    coverPath = `${uid}/${Date.now()}.${img.ext}`;
    const up = await supabase.storage.from('activity-photos').upload(coverPath, await imageBytes(extras.coverUri), { contentType: img.contentType });
    if (up.error) throw new Error('Could not upload the photo');
  }
  const { data, error } = await supabase
    .from('activities')
    .insert({
      creator_id: uid,
      cover_path: coverPath,
      format: plan.format ?? 'session',
      title: (plan.title ?? 'IRLY session').slice(0, 80),
      description: plan.description ?? null,
      category_id: plan.categoryId ?? 'sport',
      sub_id: plan.subId ?? null,
      catalog_activity_id: plan.activityId ?? null,
      city_id: plan.cityId,
      area_id: plan.areaId,
      place_name: plan.place ?? null,
      starts_at: (at ?? startsAt(plan.day, plan.time, new Date(), CITIES[plan.cityId as CityId]?.utcOffset)).toISOString(),
      timezone: CITIES[plan.cityId as CityId]?.utcOffset === 8 ? 'Asia/Makassar' : 'Asia/Dubai',
      price_minor: Math.round((plan.price ?? 0) * 100),
      currency: plan.currency ?? 'AED',
      capacity: plan.spots ? Math.max(2, plan.spots) : null,
      privacy: PRIVACY[plan.privacy ?? 'public'],
      place_id: extras.placeId ?? null,
      activity_type: extras.activityType ?? null,
      audience: extras.audience ?? 'all',
      // Girls and moms plans are IRLY Girl plans (enforced server-side).
      girl_only: extras.girlOnly || extras.audience === 'girls' || extras.audience === 'moms',
      community_id: extras.communityId ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Could not create');
  bumpActivities();
  return data.id as string;
}

/** Bumped after you create an activity: every list reloads at once (Home, categories). */
const useActivitiesVersion = create<{ n: number }>(() => ({ n: 0 }));
export const bumpActivities = () => useActivitiesVersion.setState((v) => ({ n: v.n + 1 }));

export type ServerActivity = {
  id: string;
  title: string;
  categoryId: string;
  subId: string | null;
  areaId: string;
  placeName: string | null;
  startsAt: number;
  capacity: number | null;
  going: number;
  priceMinor: number;
  currency: string;
  creatorId: string;
  joined: boolean;
  /** The creator's own photo (signed link), when they added one. */
  coverUrl: string | null;
};

/** Upcoming activities other members created in this city. */
export function useServerActivities(cityId: CityId): { activities: ServerActivity[]; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [activities, setActivities] = useState<ServerActivity[]>([]);

  const load = useCallback(async (): Promise<ServerActivity[]> => {
    if (!supabase || !uid) return [];
    const { data, error } = await supabase
      .from('activities')
      .select('id, title, category_id, sub_id, area_id, place_name, starts_at, capacity, price_minor, currency, creator_id, going, cover_path, activity_participants(user_id, status)')
      .eq('city_id', cityId)
      .is('cancelled_at', null)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(30);
    if (error) throw new Error(error.message);
    const links = await coverLinks((data ?? []).map((a) => a.cover_path as string | null));
    return (
      (data ?? []).map((a) => {
        const parts = (a.activity_participants ?? []) as { user_id: string; status: string }[];
        return {
          id: a.id,
          title: a.title,
          categoryId: a.category_id,
          subId: a.sub_id,
          areaId: a.area_id,
          placeName: a.place_name,
          startsAt: Date.parse(a.starts_at),
          capacity: a.capacity,
          // Exact count (participant rows are filtered by each member's privacy).
          going: (a.going as number | null) ?? parts.filter((p) => p.status === 'going').length,
          priceMinor: a.price_minor,
          currency: a.currency,
          creatorId: a.creator_id,
          coverUrl: a.cover_path ? (links[a.cover_path as string] ?? null) : null,
          joined: parts.some((p) => p.user_id === uid && p.status === 'going'),
        };
      })
    );
  }, [cityId, uid]);

  const refresh = useCallback(() => {
    load().then(setActivities).catch(() => undefined);
  }, [load]);

  const version = useActivitiesVersion((v) => v.n);
  useEffect(() => {
    if (version) refresh();
  }, [version, refresh]);

  useEffect(() => {
    let alive = true;
    // A failed load keeps what is on screen.
    load()
      .then((list) => {
        if (alive) setActivities(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [load]);

  return { activities: uid ? activities : NONE, refresh };
}

/** Join (capacity-checked server-side). Returns the activity chat id, or 'full'. */
export async function joinServerActivity(activityId: string): Promise<string | 'full'> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data, error } = await supabase.rpc('join_activity', { p_activity: activityId, p_status: 'going' });
  if (error) throw new Error(error.message);
  if (data === 'full') return 'full';
  const { data: conv } = await supabase.from('conversations').select('id').eq('activity_id', activityId).maybeSingle();
  return (conv?.id as string) ?? '';
}

export async function createServerCommunity(input: { name: string; cityId: string; tagline?: string; description?: string; categoryId?: string; girlOnly?: boolean }): Promise<string> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Sign in to create a community');
  const { data, error } = await supabase.rpc('create_community', {
    p_name: input.name,
    p_city: input.cityId,
    p_tagline: input.tagline ?? null,
    p_description: input.description ?? null,
    p_category: input.categoryId ?? null,
    p_girl_only: Boolean(input.girlOnly),
  });
  if (error) throw new Error(error.message);
  const { data: conv } = await supabase.from('conversations').select('id').eq('community_id', data).maybeSingle();
  return (conv?.id as string) ?? '';
}

export type ActivityDetail = {
  id: string;
  creatorId: string;
  creatorName: string | null;
  format: string;
  title: string;
  description: string | null;
  categoryId: string;
  cityId: string;
  areaId: string;
  placeName: string | null;
  startsAt: number;
  endsAt: number | null;
  priceMinor: number;
  currency: string;
  capacity: number | null;
  going: number;
  girlOnly: boolean;
  communityId: string | null;
  coverUrl: string | null;
  myStatus: string | null;
  conversationId: string | null;
  cancelled: boolean;
};

type DetailRow = {
  id: string;
  creator_id: string;
  creator_name: string | null;
  format: string;
  title: string;
  description: string | null;
  category_id: string;
  city_id: string;
  area_id: string;
  place_name: string | null;
  starts_at: string;
  ends_at: string | null;
  price_minor: number;
  currency: string;
  capacity: number | null;
  going: number;
  girl_only: boolean;
  community_id: string | null;
  cover_url: string | null;
  my_status: string | null;
  conversation_id: string | null;
  cancelled: boolean;
};

/** One activity or event, live: participant count and my status update as people join. */
export function useServerActivity(id: string): { detail: ActivityDetail | null; loading: boolean; error: string | null; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<ActivityDetail | null> => {
    if (!supabase || !uid) return null;
    const { data, error: e } = await supabase.rpc('activity_detail', { p_id: id });
    // Network or server failure: say so, never "this activity no longer exists".
    if (e) throw new Error(e.message);
    const r = ((data as DetailRow[]) ?? [])[0];
    if (!r) return null;
    return {
      id: r.id,
      creatorId: r.creator_id,
      creatorName: r.creator_name,
      format: r.format,
      title: r.title,
      description: r.description,
      categoryId: r.category_id,
      cityId: r.city_id,
      areaId: r.area_id,
      placeName: r.place_name,
      startsAt: Date.parse(r.starts_at),
      endsAt: r.ends_at ? Date.parse(r.ends_at) : null,
      priceMinor: r.price_minor,
      currency: r.currency,
      capacity: r.capacity,
      going: r.going,
      girlOnly: r.girl_only,
      communityId: r.community_id,
      coverUrl: r.cover_url ? ((await coverLinks([r.cover_url]))[r.cover_url] ?? null) : null,
      myStatus: r.my_status,
      conversationId: r.conversation_id,
      cancelled: r.cancelled,
    };
  }, [id, uid]);

  const refresh = useCallback(() => {
    load()
      .then((d) => {
        setDetail(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'offline'));
  }, [load]);

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    const reload = () =>
      load()
        .then((d) => {
          if (!alive) return;
          setDetail(d);
          setError(null);
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'offline'))
        .finally(() => alive && setLoading(false));
    reload();
    const channel = supabase
      .channel(topic(`activity-${id}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_participants', filter: `activity_id=eq.${id}` }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'activities', filter: `id=eq.${id}` }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [id, uid, load]);

  return { detail: uid ? detail : null, loading: uid ? loading : false, error: uid ? error : null, refresh };
}

export async function leaveServerActivity(activityId: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.rpc('leave_activity', { p_activity: activityId });
  if (error) throw new Error(error.message);
}

export async function cancelServerActivity(activityId: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.from('activities').update({ cancelled_at: new Date().toISOString() }).eq('id', activityId);
  if (error) throw new Error(error.message);
}

export type CalendarItem = {
  id: string;
  title: string;
  format: string;
  categoryId: string;
  cityId: string;
  areaId: string;
  placeName: string | null;
  startsAt: number;
  endsAt: number | null;
  hosting: boolean;
  conversationId: string | null;
};

/** Everything I'm going to, soonest first. Live when I join or leave. */
export function useCalendar(): { items: CalendarItem[]; loading: boolean; error: string | null; signedIn: boolean } {
  const account = useAccount();
  const uid = account?.userId;
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<CalendarItem[]> => {
    if (!supabase || !uid) return [];
    const { data, error: e } = await supabase.rpc('my_calendar', {});
    if (e) throw new Error(e.message);
    return ((data as Record<string, string | boolean | null>[]) ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      format: r.format as string,
      categoryId: r.category_id as string,
      cityId: r.city_id as string,
      areaId: r.area_id as string,
      placeName: (r.place_name as string) ?? null,
      startsAt: Date.parse(r.starts_at as string),
      endsAt: r.ends_at ? Date.parse(r.ends_at as string) : null,
      hosting: Boolean(r.hosting),
      conversationId: (r.conversation_id as string) ?? null,
    }));
  }, [uid]);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    const reload = () =>
      load()
        .then((list) => {
          if (!alive) return;
          setItems(list);
          setError(null);
        })
        .catch((e) => alive && setError(e instanceof Error ? e.message : 'offline'))
        .finally(() => alive && setLoading(false));
    reload();
    const channel = supabase
      .channel(topic(`calendar-${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_participants', filter: `user_id=eq.${uid}` }, reload)
      .subscribe();
    return () => {
      alive = false;
      supabase?.removeChannel(channel);
    };
  }, [uid, load]);
  return { items: uid ? items : NONE, loading: uid ? loading : false, error: uid ? error : null, signedIn: Boolean(uid) };
}

/** An .ics file for the phone's own calendar (Apple, Google, Outlook). */
export function icsFor(a: { id: string; title: string; startsAt: number; endsAt: number | null; placeName: string | null; areaId: string }): string {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = a.endsAt ?? a.startsAt + 2 * 3600 * 1000;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IRLY//EN',
    'BEGIN:VEVENT',
    `UID:${a.id}@irly.app`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(a.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${a.title.replace(/[,;\n]/g, ' ')}`,
    `LOCATION:${(a.placeName ?? a.areaId).replace(/[,;\n]/g, ' ')}`,
    `URL:https://irly.app/a/${a.id}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export type Recommendation = { id: string; title: string; format: string; categoryId: string; areaId: string; startsAt: number; going: number; friendsGoing: number; reason: string };

/** Ranked for me: interests, friends going, what I liked before, never what I hid. */
export function useRecommendations(cityId: string): Recommendation[] {
  const account = useAccount();
  const uid = account?.userId;
  const [list, setList] = useState<Recommendation[]>([]);
  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    supabase.rpc('recommend_activities', { p_city: cityId, p_limit: 12 }).then(({ data, error }) => {
      if (error) return;
      if (!alive) return;
      setList(
        ((data as Record<string, string | number>[]) ?? []).map((r) => ({
          id: r.id as string,
          title: r.title as string,
          format: r.format as string,
          categoryId: r.category_id as string,
          areaId: r.area_id as string,
          startsAt: Date.parse(r.starts_at as string),
          going: Number(r.going),
          friendsGoing: Number(r.friends_going),
          reason: r.reason as string,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [cityId, uid]);
  return uid ? list : NONE;
}
