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
      if (!d.card) return tx('Nothing can be seen of {name} tonight', { name: name(seat('seat')) });
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
      if (d.why) return tx('Your personal goal is reached: this victory is yours, whatever happens now');
      return tx('Three players seduced: your personal victory is won, whatever happens now');
    // ───── The book V3's cards (docs/LOUP-GAROU-V3.md) ─────
    case 'block_done':
      return tx('You blocked {name}’s power tonight', { name: name(seat('seat')) });
    case 'power_blocked':
      return tx('Your power was blocked tonight: it is not used up');
    case 'gamble_result': {
      const n = name(seat('seat'));
      if (d.outcome === 'protect') return tx('Luck: {name} is protected tonight', { name: n });
      if (d.outcome === 'block') return tx('Luck: {name}’s power is blocked tonight', { name: n });
      return d.card ? tx('Luck: {name} is {card}', { name: n, card: tx(cardOf(d.card as string).name) }) : tx('Nothing can be seen of {name} tonight', { name: n });
    }
    case 'scam_done':
      return tx('You swapped cards with {name}: you are now {card}', { name: name(seat('seat')), card: tx(cardOf(d.card as string).name) });
    case 'scam_victim':
      return tx('Someone swapped cards with you: you are now {card}', { card: tx(cardOf(d.card as string).name) });
    case 'scam_cancelled':
      return tx('Your swap with {name} did not happen: you can still use it', { name: name(seat('seat')) });
    case 'exchange_done':
      return tx('Next night, {a} and {b} trade their powers', { a: name(seat('a')), b: name(seat('b')) });
    case 'exchange_failed':
      return tx('Nothing to trade between {a} and {b}: you can still use your power', { a: name(seat('a')), b: name(seat('b')) });
    case 'power_lent':
      return tx('Next night, you play the power of {card} instead of yours', { card: tx(cardOf(d.card as string).name) });
    case 'copy_done':
      return tx('Next night, you can use the power of {card}', { card: tx(cardOf(d.card as string).name) });
    case 'copy_failed':
      return tx('{name} has no power to copy: you can still use yours', { name: name(seat('seat')) });
    case 'fog_blind':
      return tx('Fog: your power saw nothing tonight');
    case 'detect_result':
      if (d.wolf === null || d.wolf === undefined) return tx('Nothing can be seen of {name} tonight', { name: name(seat('seat')) });
      return d.wolf ? tx('Your investigation: {name} is a werewolf', { name: name(seat('seat')) }) : tx('Your investigation: {name} is not a werewolf', { name: name(seat('seat')) });
    case 'omen_result':
      if (!d.camp) return tx('Nothing can be seen of {name} tonight', { name: name(seat('seat')) });
      return tx('Your vision: {name} is of the camp {camp}', { name: name(seat('seat')), camp: tx(d.camp === 'wolves' ? 'Werewolves' : d.camp === 'solo' ? 'Solo' : 'Village') });
    case 'oracle_cursed':
      return tx('Your visions have a price: you cannot vote tomorrow');
    case 'predict_result':
      if (d.right === null || d.right === undefined) return tx('Nothing can be seen of {name} tonight', { name: name(seat('seat')) });
      return d.right ? tx('Your prediction about {name} was right', { name: name(seat('seat')) }) : tx('Your prediction about {name} was wrong', { name: name(seat('seat')) });
    case 'dig_result':
      return tx('{name} was {card}', { name: name(seat('seat')), card: tx(cardOf(d.card as string).name) });
    case 'hack_result':
      return d.acted ? tx('{name} used a power tonight', { name: name(seat('seat')) }) : tx('{name} did not use a power tonight', { name: name(seat('seat')) });
    case 'spy_result':
      return seat('target') !== undefined
        ? tx('{name} targeted {target} tonight', { name: name(seat('seat')), target: name(seat('target')) })
        : tx('{name} targeted nobody tonight', { name: name(seat('seat')) });
    case 'paparazzi_result':
      return seat('target') !== undefined ? tx('Your clue: a power was used on {name} tonight', { name: name(seat('target')) }) : tx('Your clue: nothing to report tonight');
    case 'marked':
      return tx('You marked {name}: the mark strikes when the next night begins', { name: name(seat('seat')) });
    case 'exorcise_result':
      return d.removed ? tx('You freed {name} from what weighed on them', { name: name(seat('seat')) }) : tx('Nothing weighed on {name}', { name: name(seat('seat')) });
    case 'freed':
      return tx('You are free of the Vampire');
    case 'cursed_turned':
      return tx('The werewolves attacked you: you are one of them now. You join the pack next night');
    case 'bite_done':
      return tx('{name} is your servant now', { name: name(seat('seat')) });
    case 'bitten':
      return tx('The Vampire ({name}) bit you: you serve him now, and win with him', { name: name(seat('seat')) });
    case 'bite_failed':
      return tx('Your bite on {name} failed', { name: name(seat('seat')) });
    case 'prey':
      return tx('Your target is {name}: get them voted out', { name: name(seat('seat')) });
    case 'visit_result':
      return d.attacked ? tx('An attack was aimed at {name} tonight', { name: name(seat('seat')) }) : tx('Nothing happened to {name} tonight', { name: name(seat('seat')) });
    case 'mirror_reflected':
      return tx('Your mirror sent an attack back to its author');
    case 'guard_saved':
      return tx('Your protection stopped an attack tonight');
    case 'muted':
      return tx('You silenced {name} for today’s vote', { name: name(seat('seat')) });
    case 'silenced':
      return tx('You cannot vote today');
    case 'bribed':
      return tx('Your vote counts double today');
    case 'pleading':
      return tx('You plead for {name} today', { name: name(seat('seat')) });
    case 'decree_ready':
      return tx('Your decree is ready for today');
    // Public.
    case 'anomaly_event':
      return d.event === 'fog'
        ? tx('The Anomaly is gone. Fog next night: no investigation will see anything')
        : tx('The Anomaly is gone. Curfew next night: the pack will not attack');
    case 'opening': {
      const parts: string[] = [];
      if (seats('revived').length) parts.push(tx('{names} came back from the dead', { names: seats('revived').map(name).join(', ') }));
      if (seats('dead').length) parts.push(tx('{names} died as the night began', { names: seats('dead').map(name).join(', ') }));
      return parts.join(' · ') || null;
    }
    case 'lawyer_saved':
      return tx('The Lawyer cancelled the elimination of {name}', { name: name(seat('seat')) });
    case 'decree':
      return tx('The Dictator decrees one more vote');
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
