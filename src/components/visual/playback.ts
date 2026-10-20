/**
 * One video plays at a time, app-wide.
 *
 * - A video the member started (a Live, a post: sound on) takes the floor:
 *   every other video pauses, including the silent films behind a page.
 *   When another one starts, it pauses and lets go for good (it never
 *   restarts on its own).
 * - The silent looping films (Home hero, activity header) wait in a stack:
 *   only the most recent one plays (the page on top; the Home film under
 *   an activity's film pauses), and the one below picks up again when the
 *   top one goes away or a member's video stops.
 *
 * Plain module state, no React: players register from their own effects.
 */
type Slot = { id: number; kind: 'ambient' | 'user'; pause: () => void; resume: () => void };

let next = 1;
let stack: Slot[] = [];

const top = () => stack[stack.length - 1];

function safe(fn: () => void) {
  try {
    fn();
  } catch {
    // The player was released (screen unmounting): nothing left to pause or play.
  }
}

/** A new id for a player (kept for its whole life). */
export function playbackId(): number {
  return next++;
}

/**
 * This player plays now: the one that was playing pauses. A member's video
 * displaced by another is dropped from the stack; a silent film waits.
 */
export function claimPlayback(id: number, kind: Slot['kind'], pause: () => void, resume: () => void): void {
  const before = top();
  if (before?.id === id) return;
  stack = stack.filter((s) => s.id !== id);
  if (before) {
    safe(before.pause);
    if (before.kind === 'user') stack = stack.filter((s) => s.id !== before.id);
  }
  stack.push({ id, kind, pause, resume });
}

/** This player stopped or left: the silent film below it (if any) plays again. */
export function releasePlayback(id: number): void {
  const wasTop = top()?.id === id;
  stack = stack.filter((s) => s.id !== id);
  const now = top();
  if (wasTop && now?.kind === 'ambient') safe(now.resume);
}

/** Whether this player is the one allowed to play (a film back from the background checks first). */
export function ownsPlayback(id: number): boolean {
  return top()?.id === id;
}
