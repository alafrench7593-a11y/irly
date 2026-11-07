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

/* ───────── The picker: a start and a length, never an end before the start ───────── */

/** The lengths offered in the picker, in minutes (an end is always after the start). */
export const DURATIONS = [30, 60, 90, 120, 180, 240, 360] as const;

const minutesOf = (c: Clock) => c.h * 60 + c.m;
const clockAt = (minutes: number): Clock => {
  const x = ((minutes % 1440) + 1440) % 1440;
  return { h: Math.floor(x / 60), m: x % 60 };
};

/** How long it lasts, in minutes (an end earlier than the start is the next morning), or null without an end. */
export function durationOf(w: When): number | null {
  if (!w.end) return null;
  const d = minutesOf(w.end) - minutesOf(w.start);
  return d > 0 ? d : d + 1440;
}

/** The same start with an end `minutes` later (null: no end). Past midnight, the end is the next day. */
export function withDuration(w: When, minutes: number | null): When {
  if (!minutes || minutes <= 0) return { ...w, end: null };
  return { ...w, end: clockAt(minutesOf(w.start) + Math.min(minutes, 1435)) };
}

/** "45 min", "2 h", "1 h 30". */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** The minute wheel moves in 5-minute steps: an older value (19:32) shows on the nearest step below. */
export const minuteStep = (m: number) => Math.min(55, Math.floor(m / 5) * 5);

/** True when this day and clock in the city is already behind `now`. */
export const clockIsPast = (day: DayKey, clock: Clock, utcOffset: number, now: number) => toInstant(day, clock, utcOffset).getTime() < now;

/** True when every 5-minute step of this hour has passed (the hour row is dimmed on the wheel). */
export const hourIsPast = (day: DayKey, h: number, utcOffset: number, now: number) => clockIsPast(day, { h, m: 55 }, utcOffset, now);

/**
 * The picker's first choice when nothing is set yet: 19:00 today, or 19:00
 * tomorrow once it is past 18:30 in the city. Never in the past.
 */
export function draftWhen(utcOffset: number, now: number): When {
  const p = cityParts(now, utcOffset);
  const late = p.h * 60 + p.m > 18 * 60 + 30;
  return { day: late ? addDays(p.day, 1) : p.day, start: { h: 19, m: 0 }, end: null };
}

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
