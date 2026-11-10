import { t as tx } from '@/i18n';
import { cardOf } from './cards';
import type { WwLog } from './api';

/**
 * What the game log and the AI players say, in the member's language. The
 * server stores keys and seats, never a sentence: the same game reads in
 * French and in English, and a line never carries a card the reader may not know.
 */

type Name = (seat: number | undefined) => string;

export function logLine(e: WwLog, name: Name): string | null {
  const d = e.data as Record<string, unknown>;
  const seat = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : undefined);
  const seats = (k: string) => (Array.isArray(d[k]) ? (d[k] as number[]) : []);
  switch (e.kind) {
    case 'start':
      return tx('The cards are dealt. Night falls on the village…');
    case 'phase': {
      const p = d.phase as string;
      if (p === 'night') return tx('Night {n}: the village sleeps', { n: Number(d.night) });
      if (p === 'witch') return tx('The witch wakes up…');
      if (p === 'day') return tx('Day {n}: the village wakes up', { n: Number(d.day) });
      if (p === 'vote') return tx('Time to vote');
      if (p === 'revote') return tx('A tie: second round');
      return null;
    }
    case 'morning': {
      const dead = seats('dead');
      if (!dead.length) return tx('A quiet night: nobody died');
      return tx('Found dead this morning: {names}', { names: dead.map(name).join(', ') });
    }
    case 'votes':
      return null;
    case 'voted_out': {
      const dead = seats('dead').filter((s) => s !== seat('seat'));
      const base = tx('The village eliminated {name}', { name: name(seat('seat')) });
      return dead.length ? `${base} · ${tx('{names} died of grief', { names: dead.map(name).join(', ') })}` : base;
    }
    case 'tie':
      return tx('Tie between {names}', { names: seats('seats').map(name).join(', ') });
    case 'no_elimination':
      return tx('Another tie: nobody is eliminated today');
    case 'left_game':
      return tx('{name} left the game', { name: name(seat('seat')) });
    case 'game_over':
      return tx('The game is over');
    // Private lines (only their reader receives them).
    case 'seer_saw':
      return tx('Your vision: {name} is {card}', { name: name(seat('seat')), card: tx(cardOf(d.card as string).name) });
    case 'hint':
      return tx('Among {names}, at least one is a werewolf', { names: seats('seats').map(name).join(', ') });
    case 'lover':
      return tx('Cupid linked you to {name} 💘', { name: name(seat('seat')) });
    case 'linked':
      return tx('You linked {a} and {b}', { a: name(seat('a')), b: name(seat('b')) });
    case 'thief_took':
      return tx('You took the card {card}', { card: tx(cardOf(d.card as string).name) });
    case 'thief_kept':
      return tx('You kept your card');
    case 'pack_target':
      return tx('The pack chose {name}', { name: name(seat('seat')) });
    case 'shot_hit':
      return tx('Your shot hit a werewolf: {name}', { name: name(seat('seat')) });
    case 'shot_missed':
      return tx('{name} was not a werewolf: your shot turns against you', { name: name(seat('seat')) });
    case 'elder_resisted':
      return tx('The werewolves attacked you, but you resisted');
    // Dubaï.
    case 'vote_doubled':
      return d.ceo ? tx('{name} calls a board meeting: their vote counts double today', { name: name(seat('seat')) }) : tx('{name}’s vote counts double today', { name: name(seat('seat')) });
    case 'immune':
      return tx('{name} cannot be voted out today', { name: name(seat('seat')) });
    case 'immune_saved':
      return tx('{name} was the most voted, but is immune today: nobody is out', { name: name(seat('seat')) });
    case 'dumped':
      return tx('You cancelled {name}’s vote today', { name: name(seat('seat')) });
    case 'probe_result':
      return d.escroc ? tx('Your investigation: {name} is an Escroc', { name: name(seat('seat')) }) : tx('Your investigation: {name} is not an Escroc', { name: name(seat('seat')) });
    case 'network_result':
      return tx('Your address book: {name} is with the {faction}', {
        name: name(seat('seat')),
        faction: d.faction === 'escrocs' ? 'Escrocs' : d.faction === 'independents' ? tx('Independents') : 'Expats',
      });
    case 'story_result':
      return d.acted ? tx('Your story: {name} acted tonight', { name: name(seat('seat')) }) : tx('Your story: {name} did not act tonight', { name: name(seat('seat')) });
    case 'watch_result':
      return d.visited ? tx('VIP access: {name} got a visit tonight', { name: name(seat('seat')) }) : tx('VIP access: nobody visited {name} tonight', { name: name(seat('seat')) });
    case 'second_chance':
      return tx('The Escrocs attacked you: your Second Chance saved you');
    case 'seduced':
      return tx('You seduced {name} ({n}/3)', { name: name(seat('seat')), n: Number(d.count) });
    case 'seduce_failed':
      return tx('Your seduction of {name} did not count', { name: name(seat('seat')) });
    case 'solo_won':
      return tx('Three players seduced: your personal victory is won, whatever happens now');
    default:
      return null;
  }
}

/** The lines an AI player can say: several ways each, picked by the message id (stable, not repeated in a row). */
const BOT: Record<string, string[]> = {
  accuse: ['I find {name} suspicious since the first vote.', '{name}, you are too quiet. Something is off.', 'My vote goes to {name}, I don’t trust them.'],
  doubt: ['Why are you accusing others so fast, {name}?', '{name}, your story doesn’t add up.', 'I have a doubt about {name}.'],
  watch: ['Let’s keep an eye on {name}.', 'Did you see how {name} voted yesterday?', '{name} always follows the crowd. Strange.'],
  vote_for: ['I’m voting for {name} today.', 'For me it’s {name}. Who’s with me?', 'Let’s go for {name}.'],
  unsure: ['I think there’s a werewolf among us.', 'Hard to say… let’s listen to everyone.', 'I have no clue yet, let’s talk.'],
  claim_seer_wolf: ['I’m the Seer. {name} is a werewolf, I saw it.', 'Listen: I’m the Seer and I saw {name}. Werewolf.'],
  why_me: ['Why are you accusing me, {name}?', 'Me? {name}, you’re wrong.', '{name}, that’s exactly what a werewolf would say.'],
  defend: ['I’m with the village, {name}. Look elsewhere.', 'I’m almost sure you’re lying, {name}.'],
  calm: ['Calm down {name}, we need proof.', 'Let’s not rush, {name}.'],
  pack_plan: ['Who do we take tonight?', 'Let’s stay discreet tomorrow.', 'Careful, someone suspects us.'],
};

export function botLine(key: string, id: number, data: Record<string, unknown> | null, name: Name): string {
  const variants = BOT[key] ?? BOT.unsure;
  const pick = variants[id % variants.length];
  const target = typeof data?.target === 'number' ? (data.target as number) : undefined;
  return tx(pick, { name: name(target) });
}
