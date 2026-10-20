// Activity date and time: city wall clock → UTC instant → same wall clock, in Dubai (+4) and Bali (+8).
import { addDays, cityParts, instants, localPlanDay, nextDays, problemOf, toInstant, whenFrom, type When } from '../src/features/create/when.ts';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`);
};
const iso = (d: Date | null) => (d ? d.toISOString() : 'null');

const DUBAI = 4;
const BALI = 8;

// 1. Dubai: Sat 25 Oct 2026, 19:30 → 15:30 UTC, and back.
{
  const w: When = { day: '2026-10-25', start: { h: 19, m: 30 }, end: null };
  const { startsAt, endsAt } = instants(w, DUBAI);
  check('Dubai 19:30 is saved as 15:30 UTC', iso(startsAt) === '2026-10-25T15:30:00.000Z', iso(startsAt));
  check('Dubai without an end saves ends_at null', endsAt === null);
  const back = whenFrom(startsAt.getTime(), null, DUBAI);
  check('Dubai reads back the same day and time', back.day === '2026-10-25' && back.start.h === 19 && back.start.m === 30, JSON.stringify(back));
}

// 2. Bali: 19:45 → 11:45 UTC; read with Dubai's offset it would be 15:45 (the bug this avoids).
{
  const w: When = { day: '2026-10-25', start: { h: 19, m: 45 }, end: { h: 22, m: 0 } };
  const { startsAt, endsAt } = instants(w, BALI);
  check('Bali 19:45 is saved as 11:45 UTC', iso(startsAt) === '2026-10-25T11:45:00.000Z', iso(startsAt));
  check('Bali 22:00 end is saved as 14:00 UTC', iso(endsAt) === '2026-10-25T14:00:00.000Z', iso(endsAt));
  const back = whenFrom(startsAt.getTime(), endsAt!.getTime(), BALI);
  check('Bali reads back 19:45–22:00 on the 25th', back.day === '2026-10-25' && back.start.h === 19 && back.start.m === 45 && back.end?.h === 22 && back.end?.m === 0, JSON.stringify(back));
}

// 3. Across midnight in the city, not in UTC: Dubai 01:30 on the 26th is 21:30 UTC on the 25th.
{
  const w: When = { day: '2026-10-26', start: { h: 1, m: 30 }, end: null };
  const { startsAt } = instants(w, DUBAI);
  check('Dubai 01:30 on the 26th is 21:30 UTC on the 25th', iso(startsAt) === '2026-10-25T21:30:00.000Z', iso(startsAt));
  check('…and reads back as the 26th', whenFrom(startsAt.getTime(), null, DUBAI).day === '2026-10-26');
  const bali = instants({ ...w, day: '2026-10-26' }, BALI).startsAt;
  check('Bali 01:30 on the 26th is 17:30 UTC on the 25th', iso(bali) === '2026-10-25T17:30:00.000Z', iso(bali));
}

// 4. An overnight plan: 22:00 → 02:00 ends the next day, after the start.
{
  const w: When = { day: '2026-10-31', start: { h: 22, m: 0 }, end: { h: 2, m: 0 } };
  const { startsAt, endsAt } = instants(w, DUBAI);
  check('22:00 → 02:00 Dubai ends 1 Nov 02:00 local (22:00 UTC on the 31st)', iso(endsAt) === '2026-10-31T22:00:00.000Z' && cityParts(endsAt!.getTime(), DUBAI).day === '2026-11-01' && endsAt!.getTime() > startsAt.getTime(), iso(endsAt));
  check('22:00 → 02:00 is accepted', problemOf(w, DUBAI, Date.UTC(2026, 9, 20)) === null);
  // Month end in the city: Bali 31 Oct 23:00 → 01:00 is 1 Nov.
  const b = instants({ day: '2026-10-31', start: { h: 23, m: 0 }, end: { h: 1, m: 0 } }, BALI);
  check('Bali 31 Oct 23:00 → 01:00 ends 1 Nov 01:00 local', whenFrom(b.startsAt.getTime(), b.endsAt!.getTime(), BALI).end?.h === 1 && cityParts(b.endsAt!.getTime(), BALI).day === '2026-11-01');
}

// 5. Invalid: an end before the start (19:00 → 18:00 would be 23 hours) and an end equal to the start.
{
  const now = Date.UTC(2026, 9, 20);
  check('19:00 → 18:00 is refused (end before start)', problemOf({ day: '2026-10-25', start: { h: 19, m: 0 }, end: { h: 18, m: 0 } }, DUBAI, now) === 'end-before-start');
  check('19:00 → 19:00 is refused', problemOf({ day: '2026-10-25', start: { h: 19, m: 0 }, end: { h: 19, m: 0 } }, DUBAI, now) === 'end-before-start');
  check('19:00 → 21:30 is accepted', problemOf({ day: '2026-10-25', start: { h: 19, m: 0 }, end: { h: 21, m: 30 } }, DUBAI, now) === null);
}

// 6. A start in the past is reported, never moved.
{
  // 20 Oct 2026, 18:00 in Dubai = 14:00 UTC.
  const now = Date.UTC(2026, 9, 20, 14, 0);
  const w: When = { day: '2026-10-20', start: { h: 17, m: 0 }, end: null };
  check('Dubai 17:00 today at 18:00 is "past"', problemOf(w, DUBAI, now) === 'past');
  check('…and its instant is unchanged (still today 17:00)', iso(instants(w, DUBAI).startsAt) === '2026-10-20T13:00:00.000Z');
  // Same instant, Bali: it is already 22:00 there, 21:00 has passed but 22:30 has not.
  check('Bali 21:00 at 22:00 local is "past"', problemOf({ day: '2026-10-20', start: { h: 21, m: 0 }, end: null }, BALI, now) === 'past');
  check('Bali 22:30 at 22:00 local is accepted', problemOf({ day: '2026-10-20', start: { h: 22, m: 30 }, end: null }, BALI, now) === null);
}

// 7. The date strip: 90 days from the city's today (Bali is already tomorrow at 20:00 UTC).
{
  const now = Date.UTC(2026, 9, 20, 20, 0);
  const d = nextDays(now, DUBAI);
  const b = nextDays(now, BALI);
  check('Dubai strip starts on the 21st at 00:00 Dubai', d[0] === '2026-10-21', d[0]);
  check('Bali strip starts on the 21st (04:00 Bali)', b[0] === '2026-10-21', b[0]);
  check('90 days, last one 18 Jan 2027', d.length === 90 && d[89] === addDays('2026-10-21', 89) && d[89] === '2027-01-18', d[89]);
  const early = Date.UTC(2026, 9, 20, 18, 0); // 22:00 Dubai, 02:00 Bali next day
  check('at 18:00 UTC Dubai is still the 20th, Bali the 21st', nextDays(early, DUBAI)[0] === '2026-10-20' && nextDays(early, BALI)[0] === '2026-10-21');
}

// 8. The phone's own time zone never matters: toInstant uses only the city's offset.
{
  const a = toInstant('2026-12-31', { h: 23, m: 55 }, DUBAI);
  check('31 Dec 23:55 Dubai is 19:55 UTC', iso(a) === '2026-12-31T19:55:00.000Z', iso(a));
}

// 9. Plans kept on the phone (signed out) store words that plans/when.ts reads back.
{
  const now = Date.UTC(2026, 9, 20, 8, 0); // Tue 20 Oct, 12:00 Dubai
  const at = (day: string) => localPlanDay({ day, start: { h: 19, m: 0 }, end: null }, now, DUBAI);
  check('same day → Today', at('2026-10-20') === 'Today');
  check('next day → Tomorrow', at('2026-10-21') === 'Tomorrow');
  check('Sat 24 → Saturday', at('2026-10-24') === 'Saturday');
  check('a week later → Next week', at('2026-10-27') === 'Next week');
  check('further → null (sign in needed)', at('2026-11-05') === null);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
