import { useCallback, useEffect, useState } from 'react';
import type { CityId } from '@/data/types';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';
import type { MyPlan } from '@/state/store';

/**
 * Activities on the server (signed in). Creating a session in the app also
 * creates it here, so other members see it, can join it, and its chat is
 * shared. Joining goes through `join_activity` (capacity-safe).
 */

const PRIVACY: Record<NonNullable<MyPlan['privacy']>, string> = { public: 'public', connections: 'friends', community: 'community', invite: 'invite' };

/** "Today" / "Tomorrow" / "This weekend" / "Next week" + "19:30" → a date. */
export function startsAt(day: string, time: string, now = new Date()): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(now);
  d.setSeconds(0, 0);
  if (day === 'Tomorrow') d.setDate(d.getDate() + 1);
  else if (day === 'This weekend') d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  else if (day === 'Next week') d.setDate(d.getDate() + 7);
  d.setHours(h || 19, m || 0);
  if (d.getTime() < now.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

export async function createServerActivity(plan: Omit<MyPlan, 'id' | 'createdAt'>): Promise<string | null> {
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from('activities')
    .insert({
      creator_id: uid,
      format: plan.format ?? 'session',
      title: (plan.title ?? 'IRLY session').slice(0, 80),
      description: plan.description ?? null,
      category_id: plan.categoryId ?? 'sport',
      sub_id: plan.subId ?? null,
      catalog_activity_id: plan.activityId ?? null,
      city_id: plan.cityId,
      area_id: plan.areaId,
      place_name: plan.place ?? null,
      starts_at: startsAt(plan.day, plan.time).toISOString(),
      price_minor: Math.round((plan.price ?? 0) * 100),
      currency: plan.currency ?? 'AED',
      capacity: plan.spots ? Math.max(2, plan.spots) : null,
      privacy: PRIVACY[plan.privacy ?? 'public'],
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

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
};

/** Upcoming activities other members created in this city. */
export function useServerActivities(cityId: CityId): { activities: ServerActivity[]; refresh: () => void } {
  const account = useAccount();
  const uid = account?.userId;
  const [activities, setActivities] = useState<ServerActivity[]>([]);

  const load = useCallback(async (): Promise<ServerActivity[]> => {
    if (!supabase || !uid) return [];
    const { data } = await supabase
      .from('activities')
      .select('id, title, category_id, sub_id, area_id, place_name, starts_at, capacity, price_minor, currency, creator_id, activity_participants(user_id, status)')
      .eq('city_id', cityId)
      .is('cancelled_at', null)
      .gte('starts_at', new Date().toISOString())
      .order('starts_at')
      .limit(30);
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
          going: parts.filter((p) => p.status === 'going').length,
          priceMinor: a.price_minor,
          currency: a.currency,
          creatorId: a.creator_id,
          joined: parts.some((p) => p.user_id === uid && p.status === 'going'),
        };
      })
    );
  }, [cityId, uid]);

  const refresh = useCallback(() => {
    load().then(setActivities);
  }, [load]);

  useEffect(() => {
    let alive = true;
    load().then((list) => {
      if (alive) setActivities(list);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  return { activities: uid ? activities : [], refresh };
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
