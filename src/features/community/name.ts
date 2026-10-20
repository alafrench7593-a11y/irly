import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';

/**
 * The one way a community's title is shown. A stored name is shown as its
 * owner wrote it; only a word that is a technical code (an id, a uuid, a run
 * stamp such as "mvgq82y1" left by a test account, "abc12345", "#12345") is
 * never shown as if it were part of a title. When nothing readable is left
 * (or the name is missing), the community is named by its topic or category
 * and its city ("Gym & Fitness · Dubai"), never by its id.
 *
 * The same rule as private.community_name_is_technical() on the server
 * (migration 20261024006000_irly_community_titles).
 */

type NameRow = {
  name?: string | null;
  topic?: string | null;
  categoryId?: string | null;
  category_id?: string | null;
  cityId?: string | null;
  city_id?: string | null;
};

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** One word of a name that reads as a code, not as a word. */
export function isTechnicalWord(word: string): boolean {
  const w = word.trim();
  if (!w) return false;
  if (UUID.test(w)) return true;
  // "#12345", "12345": a number of five digits or more, or a numbered tag.
  if (/^#\d{3,}$/.test(w) || /^\d{5,}$/.test(w)) return true;
  if (!/^[A-Za-z0-9_-]+$/.test(w)) return false;
  const digits = (w.match(/\d/g) ?? []).length;
  const letters = (w.match(/[A-Za-z]/g) ?? []).length;
  // "abc12345", "u48213": letters, then a run of five digits or more.
  if (/\d{5,}/.test(w) && letters > 0) return true;
  // A word and a year ("cafe2024", "bali2026") is a word.
  if (/^[A-Za-z]+(19|20)\d\d$/.test(w)) return false;
  // A run stamp: Date.now() in base 36 ("mvgq82y1", "mv00tl2o"), letters and digits mixed.
  const switches = (w.match(/[a-z](?=\d)|\d(?=[a-z])/g) ?? []).length;
  if (/^[l-n][a-z0-9]{7}$/.test(w) && digits >= 2 && switches >= 2) return true;
  // A uuid fragment ("3f2a91c0"): eight hexadecimal characters or more, two digits and two letters at least.
  if (/^[0-9a-f]{8,}$/.test(w) && digits >= 2 && letters >= 2) return true;
  return false;
}

const TOPIC_LABEL: Record<string, string> = {
  gym: 'Gym & Fitness',
  sport: 'Sport',
  football: 'Football',
  running: 'Running',
  trip: 'Trips',
  beach: 'Beach',
  food: 'Food',
  network: 'Network',
  entrepreneurs: 'Entrepreneurs',
  ecom: 'E-commerce',
  tech: 'Tech',
  ai: 'AI',
  girls: 'IRLY Girl',
  moms: 'IRLY Moms',
  families: 'IRLY Family',
  newcomers: 'Newcomers',
  lifestyle: 'Lifestyle',
  nights: 'Nights out',
  help: 'Help & Questions',
};

const words = (slug: string) => slug.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/** "Gym & Fitness · Dubai": what the community is about and where, for a name that is missing or only a code. */
export function fallbackCommunityName(row: NameRow): string {
  const topic = row.topic ? (TOPIC_LABEL[row.topic] ?? words(row.topic)) : null;
  const category = row.categoryId ?? row.category_id;
  const about = topic || (category ? words(category) : '') || 'Community';
  const cityId = row.cityId ?? row.city_id;
  const city = cityId ? (CITIES[cityId as CityId]?.name ?? words(cityId)) : null;
  return city ? `${about} · ${city}` : about;
}

/** The title to show for a community row (server or local). */
export function displayCommunityName(row: NameRow | null | undefined): string {
  if (!row) return 'Community';
  const raw = typeof row.name === 'string' ? row.name.replace(/\s+/g, ' ').trim() : '';
  if (!raw) return fallbackCommunityName(row);
  const parts = raw.split(' ');
  if (!parts.some(isTechnicalWord)) return raw;
  const kept = parts
    .filter((w) => !isTechnicalWord(w))
    .join(' ')
    // A separator left dangling by the code ("Padel · ", "- Padel").
    .replace(/^[\s·\-–|:,]+|[\s·\-–|:,]+$/g, '')
    .trim();
  return kept.length >= 3 && /\p{L}/u.test(kept) ? kept : fallbackCommunityName(row);
}
