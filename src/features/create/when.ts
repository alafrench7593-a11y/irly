/**
 * The date and time of an activity, as the member picks them: a calendar
 * day and a clock time in the CITY's time (Dubai UTC+4, Bali UTC+8, no
 * daylight saving in either). Stored as one UTC instant; read back to the
 * same day and time whatever the phone's own time zone. Pure functions, no
 * React: tested by scripts/check-when.mts.
 */

/** A calendar day in the city: "2026-10-25". */
export type DayKey = string;
export type Clock = { h: number; m: number };
export type When = { day: DayKey; start: Clock; end: Clock | null };

const pad = (n: number) => String(n).padStart(2, '0');

/** The city's calendar day and clock for an instant. */
export function cityParts(ms: number, utcOffset: number): { day: DayKey; h: number; m: number } {
  const d = new Date(ms + utcOffset * 3600_000);
  return { day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, h: d.getUTCHours(), m: d.getUTCMinutes() };
}

/** A day and a clock in the city → the UTC instant. */
export function toInstant(day: DayKey, clock: Clock, utcOffset: number): Date {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, clock.h, clock.m) - utcOffset * 3600_000);
}

/** The day after (or n days after) a day key. */
export function addDays(day: DayKey, n: number): DayKey {
  const [y, mo, d] = day.split('-').map(Number);
  const x = new Date(Date.UTC(y, mo - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** The next `count` days in the city, starting today. */
export function nextDays(now: number, utcOffset: number, count = 90): DayKey[] {
  const today = cityParts(now, utcOffset).day;
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

/**
 * Start and end instants. An end earlier than the start is the next morning
 * (a party from 22:00 to 02:00): problemOf refuses it when that would make
 * the plan last more than 12 hours, which is a mistyped end, not a night out.
 */
export function instants(w: When, utcOffset: number): { startsAt: Date; endsAt: Date | null } {
  const startsAt = toInstant(w.day, w.start, utcOffset);
  if (!w.end) return { startsAt, endsAt: null };
  let endsAt = toInstant(w.day, w.end, utcOffset);
  if (endsAt.getTime() < startsAt.getTime()) endsAt = toInstant(addDays(w.day, 1), w.end, utcOffset);
  return { startsAt, endsAt };
}

/** True when the end falls on the day after the start. */
export const endsNextDay = (w: When) => Boolean(w.end && w.end.h * 60 + w.end.m < w.start.h * 60 + w.start.m);

export type WhenProblem = 'past' | 'end-before-start' | null;

const MAX_OVERNIGHT_MS = 12 * 3600_000;

/** Why this choice cannot be published, or null. */
export function problemOf(w: When, utcOffset: number, now: number): WhenProblem {
  const { startsAt, endsAt } = instants(w, utcOffset);
  if (startsAt.getTime() < now) return 'past';
  if (endsAt) {
    const length = endsAt.getTime() - startsAt.getTime();
    if (length === 0 || (endsNextDay(w) && length > MAX_OVERNIGHT_MS)) return 'end-before-start';
  }
  return null;
}

/** A stored instant → the city's day and clock (what the form shows when editing). */
export function whenFrom(startsAtMs: number, endsAtMs: number | null, utcOffset: number): When {
  const s = cityParts(startsAtMs, utcOffset);
  const e = endsAtMs ? cityParts(endsAtMs, utcOffset) : null;
  return { day: s.day, start: { h: s.h, m: s.m }, end: e ? { h: e.h, m: e.m } : null };
}

export const clockLabel = (c: Clock) => `${pad(c.h)}:${pad(c.m)}`;

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * A plan kept on this phone only (signed out) stores words, not an instant:
 * "Today", "Tomorrow", a weekday within the week, "Next week" a week ahead
 * (read back by plans/when.ts). Further than a week: null, it cannot be said.
 */
export function localPlanDay(w: When, now: number, utcOffset: number): string | null {
  const today = cityParts(now, utcOffset).day;
  const ahead = Math.round((Date.parse(`${w.day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
  if (ahead === 0) return 'Today';
  if (ahead === 1) return 'Tomorrow';
  if (ahead === 7) return 'Next week';
  if (ahead > 1 && ahead < 7) return WEEKDAY_NAMES[new Date(Date.parse(`${w.day}T00:00:00Z`)).getUTCDay()];
  return null;
}
