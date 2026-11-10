/**
 * What IRLY Games says on the Home, by the member's own hour: night lines
 * between 22:00 and 06:00, then morning, afternoon and evening ones. One
 * line per hour (it changes with the hour, never on every render). The
 * « your friends are online » line waits for a real count of friends
 * playing (a later part of IRLY Games): never shown without one.
 */
type Line = { title: string; body: string };

const NIGHT: Line[] = [
  { title: "Can't sleep? Come and play 🎮", body: "Others may be awake too. Join a game and meet new people!" },
  { title: 'Night owls, this way 🌙', body: 'A round of Loup-Garou with the night owls?' },
];
const MORNING: Line[] = [
  { title: 'Coffee and a game? ☕', body: 'Train against the AI over breakfast: a quick Loup-Garou.' },
];
const AFTERNOON: Line[] = [
  { title: 'Bored? 🎲', body: 'Players are waiting on IRLY Games. Join them!' },
  { title: 'Want to meet new people? 👥', body: 'Break the ice over a game of Loup-Garou!' },
];
const EVENING: Line[] = [
  { title: 'Staying in tonight? 🏠', body: 'No need to go out to meet people. A game, anyone?' },
  { title: 'Game night 🎲', body: 'Gather a table of 6 to 20 and play Loup-Garou.' },
];

export function gamesLine(hour: number, now: number): Line {
  const pool = hour >= 22 || hour < 6 ? NIGHT : hour < 12 ? MORNING : hour < 18 ? AFTERNOON : EVENING;
  return pool[Math.floor(now / 3_600_000) % pool.length];
}
