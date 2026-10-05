import { t as tx } from '@/i18n';
import type { City, When } from '@/data/types';

/**
 * Time is always expressed in the destination's local time: a Dubai user
 * planning from Paris still sees "Tonight · 20:30" in Dubai time.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A Date whose UTC fields read as the city's wall-clock time. */
export function cityNow(city: Pick<City, 'utcOffset'>, now = Date.now()): Date {
  return new Date(now + city.utcOffset * 60 * 60 * 1000);
}

export function cityHour(city: Pick<City, 'utcOffset'>, now = Date.now()): number {
  const d = cityNow(city, now);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export function isDaytime(city: Pick<City, 'utcOffset'>, now = Date.now()): boolean {
  const h = cityHour(city, now);
  return h >= 6.5 && h < 18;
}

export type Greeting = { lead: string; place: string };

export function greeting(city: Pick<City, 'utcOffset' | 'name'>, now = Date.now()): Greeting {
  const h = cityHour(city, now);
  if (h >= 5 && h < 12) return { lead: 'Good morning,', place: `${city.name}.` };
  if (h >= 12 && h < 17) return { lead: 'Good afternoon,', place: `${city.name}.` };
  if (h >= 17 || h < 0.5) return { lead: 'Good evening,', place: `${city.name}.` };
  return { lead: 'Still up,', place: `${city.name}?` };
}

export function localClock(city: Pick<City, 'utcOffset'>, now = Date.now()): string {
  const d = cityNow(city, now);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function startHour(when: When) {
  return Number(when.time.split(':')[0]);
}

/** Calendar date of a plan, in the city's time. */
export function planDate(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()): Date {
  return new Date(cityNow(city, now).getTime() + when.dayOffset * DAY);
}

/** "tonight", "this morning", "tomorrow", "Saturday"… used inside sentences. */
export function relativeDay(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()): string {
  const h = startHour(when);
  if (when.dayOffset === 0) {
    if (h >= 17) return 'tonight';
    if (h < 12) return 'this morning';
    return 'today';
  }
  if (when.dayOffset === 1) return h >= 17 ? 'tomorrow night' : 'tomorrow';
  return WEEKDAYS[planDate(when, city, now).getUTCDay()];
}

/** "Tonight · 20:30", "Tomorrow · 06:00", "Sat 12 Oct · 10:00" */
export function whenLabel(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()): string {
  const h = startHour(when);
  if (when.dayOffset === 0) return `${tx(h >= 17 ? 'Tonight' : 'Today')} · ${when.time}`;
  if (when.dayOffset === 1) return `${tx('Tomorrow')} · ${when.time}`;
  const d = planDate(when, city, now);
  return `${tx(WEEKDAYS_SHORT[d.getUTCDay()])} ${d.getUTCDate()} ${tx(MONTHS[d.getUTCMonth()])} · ${when.time}`;
}

export function dayChip(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()) {
  const d = planDate(when, city, now);
  return { weekday: tx(WEEKDAYS_SHORT[d.getUTCDay()]).toUpperCase(), day: d.getUTCDate() };
}

export function isWeekend(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()): boolean {
  const day = planDate(when, city, now).getUTCDay();
  return day === 0 || day === 6;
}

export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export function timeAgo(minAgo: number): string {
  if (minAgo < 1) return 'now';
  if (minAgo < 60) return `${Math.round(minAgo)} min`;
  const h = Math.round(minAgo / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

/** True while a plan is actually under way, in the city's time. */
export function isHappeningNow(when: When, city: Pick<City, 'utcOffset'>, now = Date.now()): boolean {
  if (when.dayOffset !== 0) return false;
  const [h, m] = when.time.split(':').map(Number);
  const start = h + (m || 0) / 60;
  const current = cityHour(city, now);
  return current >= start - 0.25 && current <= start + when.durationMin / 60;
}
