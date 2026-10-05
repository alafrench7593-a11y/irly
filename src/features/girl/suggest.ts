import type { IconName } from '@/components/ui/Icon';
import { CATEGORY_BY_ID, ideaPhoto, type CategoryKey } from '@/data/catalog/categories';
import type { PhotoKey } from '@/data/photos';
import type { CreatePreset } from '@/features/create/createStore';
import type { Reasons } from './compat';

/**
 * "Find something to do": what two matched girls could do together, from
 * what they actually share. Each suggestion opens Create on the real
 * catalog entry (category → subcategory), so the plan becomes a real
 * activity with its own chat, never a separate record.
 */
export type Suggestion = { id: string; label: string; icon: IconName; photo: PhotoKey; preset: CreatePreset };

const MAP: Record<string, { label: string; category: CategoryKey; sub?: string; icon: IconName; format?: CreatePreset['format'] }> = {
  padel: { label: 'Padel', category: 'sport', sub: 'padel', icon: 'trophy', format: 'sport' },
  tennis: { label: 'Tennis', category: 'sport', sub: 'tennis', icon: 'trophy', format: 'sport' },
  running: { label: 'Run together', category: 'sport', sub: 'running', icon: 'footprints', format: 'sport' },
  gym: { label: 'Gym session', category: 'sport', sub: 'gym', icon: 'dumbbell', format: 'sport' },
  pilates: { label: 'Pilates', category: 'wellness', sub: 'pilates', icon: 'leaf' },
  yoga: { label: 'Yoga', category: 'wellness', sub: 'yoga', icon: 'leaf' },
  swimming: { label: 'Swim', category: 'sport', sub: 'swimming', icon: 'waves', format: 'sport' },
  boxing: { label: 'Boxing class', category: 'sport', sub: 'boxing', icon: 'dumbbell', format: 'sport' },
  surf: { label: 'Surf & paddle', category: 'sport', sub: 'surf', icon: 'waves', format: 'sport' },
  hiking: { label: 'Hike', category: 'outdoor', sub: 'hiking', icon: 'mountain' },
  dance: { label: 'Dance class', category: 'creative', sub: 'dance', icon: 'music' },
  coffee: { label: 'Coffee', category: 'food', sub: 'coffee', icon: 'coffee', format: 'meetup' },
  brunch: { label: 'Brunch', category: 'food', sub: 'brunch', icon: 'utensils' },
  dinner: { label: 'Girls dinner', category: 'food', sub: 'dinner', icon: 'utensils' },
  restaurants: { label: 'New restaurant', category: 'food', sub: 'dinner', icon: 'utensils' },
  beach: { label: 'Beach afternoon', category: 'outdoor', sub: 'sunset', icon: 'sun' },
  shopping: { label: 'Shopping', category: 'shopping', sub: 'fashion', icon: 'shoppingBag' },
  fashion: { label: 'Shopping', category: 'shopping', sub: 'fashion', icon: 'shoppingBag' },
  beauty: { label: 'Beauty day', category: 'shopping', sub: 'beauty', icon: 'sparkles' },
  spa: { label: 'Spa day', category: 'wellness', sub: 'spa', icon: 'sparkles' },
  wellness: { label: 'Wellness day', category: 'wellness', sub: 'spa', icon: 'leaf' },
  girls_night: { label: 'Girls night', category: 'nightlife', sub: 'lounges', icon: 'martini' },
  nightlife: { label: 'Girls night', category: 'nightlife', sub: 'lounges', icon: 'martini' },
  photo_walk: { label: 'Photo walk', category: 'creative', sub: 'photography', icon: 'camera' },
  museums: { label: 'Museum visit', category: 'culture', sub: 'museums', icon: 'landmark' },
  culture: { label: 'Gallery visit', category: 'culture', sub: 'galleries', icon: 'palette' },
  desert: { label: 'Desert trip', category: 'travel', sub: 'desert', icon: 'sunset', format: 'trip' },
  yacht: { label: 'Yacht day', category: 'outdoor', sub: 'yacht', icon: 'sailboat' },
  networking: { label: 'Founders coffee', category: 'networking', sub: 'entrepreneurs', icon: 'briefcase', format: 'meetup' },
  entrepreneurship: { label: 'Founders coffee', category: 'networking', sub: 'entrepreneurs', icon: 'briefcase', format: 'meetup' },
  oman: { label: 'Trip to Oman', category: 'travel', sub: 'oman', icon: 'plane', format: 'trip' },
  hatta: { label: 'Day in Hatta', category: 'travel', sub: 'hatta', icon: 'mountain', format: 'trip' },
  abudhabi: { label: 'Day in Abu Dhabi', category: 'travel', sub: 'abudhabi', icon: 'landmark', format: 'trip' },
  rak: { label: 'Ras Al Khaimah weekend', category: 'travel', sub: 'rak', icon: 'mountain', format: 'trip' },
  weekend_trips: { label: 'Weekend trip', category: 'travel', sub: 'weekend-trips', icon: 'plane', format: 'trip' },
};

const FALLBACK = ['coffee', 'brunch', 'beach', 'shopping', 'dinner'];

export function suggestFor(reasons: Reasons, limit = 8): Suggestion[] {
  const ids = [...reasons.sports, ...reasons.activities, ...reasons.travel, ...reasons.interests, ...FALLBACK];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const id of ids) {
    const m = MAP[id];
    if (!m || seen.has(m.label)) continue;
    seen.add(m.label);
    const category = CATEGORY_BY_ID[m.category];
    const sub = category.subs.find((s) => s.id === m.sub);
    out.push({
      id,
      label: m.label,
      icon: m.icon,
      photo: ideaPhoto(m.category, m.label),
      preset: { categoryId: m.category, subId: sub?.id, format: m.format ?? 'activity' },
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** "You both: • Love padel • Like brunch …" lines for a match. */
export function reasonLines(reasons: Reasons, label: (id: string) => string, max = 6): string[] {
  // The same thing can be shared as an interest and as a plan (brunch):
  // say it once, in its strongest form.
  const seen = new Set<string>();
  const lines: string[] = [];
  const add = (ids: string[], text: (l: string) => string, limit = 99) => {
    ids.slice(0, limit).forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      lines.push(text(label(id)));
    });
  };
  add(reasons.sports, (l) => `Love ${l.toLowerCase()}`);
  add(reasons.activities, (l) => `Like ${l.toLowerCase()}`);
  add(reasons.interests, (l) => `Into ${l.toLowerCase()}`);
  add(reasons.goals, (l) => `Want ${l.toLowerCase()}`, 1);
  add(reasons.travel, (l) => `Dream of ${l}`, 1);
  add(reasons.languages, (l) => `Speak ${l}`, 1);
  add(reasons.availability, (l) => `Free on ${l.toLowerCase()}`, 1);
  return lines.slice(0, max);
}
