import { CITIES } from '@/data/destinations';
import { dateFor, dayOf } from '@/features/ai/intent';
import { cityDayKey, cityWhen } from '@/lib/time';
import type { MyPlan } from '@/state/store';

/**
 * A plan stores the words chosen when it was made ("Today", "Tomorrow",
 * "Saturday") and the hour. Its real start is computed from when it was
 * created, so a week later it is not still "Tomorrow".
 */
export function planStart(p: Pick<MyPlan, 'day' | 'time' | 'createdAt' | 'cityId'>): number {
  return dateFor(dayOf(p.day), p.time, new Date(p.createdAt), CITIES[p.cityId]?.utcOffset).getTime();
}

/** "Today", "Tomorrow" or "Sat 12 Oct", from now, in the plan's city. */
export function planDayLabel(p: Pick<MyPlan, 'day' | 'time' | 'createdAt' | 'cityId'>, now = Date.now()): string {
  const at = planStart(p);
  const key = cityDayKey(at, p.cityId);
  if (key === cityDayKey(now, p.cityId)) return 'Today';
  if (key === cityDayKey(now + 86400000, p.cityId)) return 'Tomorrow';
  return cityWhen(at, p.cityId, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Plans that have not finished yet (kept 3 hours after their start). */
export function upcomingPlans<T extends Pick<MyPlan, 'day' | 'time' | 'createdAt' | 'cityId'>>(plans: T[], now = Date.now()): T[] {
  return plans.filter((p) => planStart(p) > now - 3 * 3600 * 1000).sort((a, b) => planStart(a) - planStart(b));
}
