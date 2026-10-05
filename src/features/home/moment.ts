import type { CategoryKey } from '@/data/catalog/categories';
import { t as tx } from '@/i18n';
import { INTEREST_CATEGORY } from '@/data/catalog/mapping';
import type { City, Interest } from '@/data/types';
import { cityNow } from '@/lib/time';

export type Moment = { title: string; categories: CategoryKey[] };

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * What fits right now, in the city's time. The Home leads with it instead of
 * a fixed list: mornings are for sport and wellness, weekday evenings for
 * networking and going out, weekends for trips and the outdoors. The member's
 * interests are blended in first.
 */
export function momentFor(city: Pick<City, 'utcOffset'>, now: number, interests: Interest[]): Moment {
  const d = cityNow(city, now);
  const h = d.getUTCHours();
  const day = d.getUTCDay();
  const weekend = day === 6 || day === 0;
  const part = h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  let base: CategoryKey[];
  if (weekend) base = h < 12 ? ['outdoor', 'travel', 'sport', 'food'] : ['travel', 'food', 'outdoor', 'nightlife'];
  else if (part === 'morning') base = ['sport', 'wellness', 'food', 'networking'];
  else if (part === 'afternoon') base = ['food', 'networking', 'shopping', 'culture'];
  else base = day === 4 || day === 5 ? ['nightlife', 'food', 'networking', 'entertainment'] : ['sport', 'networking', 'food', 'wellness'];
  const mine = interests.map((i) => INTEREST_CATEGORY[i]);
  const categories = [...new Set([...mine.filter((c) => base.includes(c)), ...base, ...mine])];
  return { title: tx('{day} {part}', { day: tx(DAYS[day]), part: tx(part) }), categories };
}
