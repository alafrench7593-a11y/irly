/**
 * The Classic cards of IRLY Loup-Garou, as the server plays them
 * (docs/LOUP-GAROU.md, supabase/migrations/20261112000000_irly_werewolf.sql).
 * English source; French through the dictionary (src/i18n/fr.ts).
 */
export type ClassicCardId = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'cupid' | 'little_girl' | 'salvateur' | 'thief' | 'elder';
/** The Dubaï mode's 20 cards (docs/LOUP-GAROU-DUBAI.md, supabase/migrations/20261113000000_irly_werewolf_dubai.sql). */
export type DubaiCardId =
  | 'expat'
  | 'escroc'
  | 'influencer'
  | 'entrepreneur'
  | 'millionaire'
  | 'single'
  | 'charo'
  | 'golden_visa'
  | 'investor'
  | 'ceo'
  | 'ecommerce'
  | 'newcomer'
  | 'emirati'
  | 'realtor'
  | 'creator'
  | 'broker'
  | 'tourist'
  | 'concierge'
  | 'fake_millionaire'
  | 'networker';
export type CardId = ClassicCardId | DubaiCardId;
export type Camp = 'village' | 'wolves' | 'solo';
export type WwMode = 'classic' | 'dubai' | 'chaos' | 'nightmare' | 'powers';
export const MODES: WwMode[] = ['classic', 'dubai', 'chaos', 'nightmare', 'powers'];
/** A mode read from the server or a link; anything unknown is Classic. */
export const toMode = (m: string | null | undefined): WwMode => (MODES.includes(m as WwMode) ? (m as WwMode) : 'classic');
export const MODE_NAME: Record<WwMode, string> = { classic: 'Classic', dubai: 'Dubai', chaos: 'Chaos', nightmare: 'Nightmare', powers: 'All powers' };
export const MODE_LABEL: Record<WwMode, string> = { classic: 'Classic mode', dubai: 'Dubai mode', chaos: 'Chaos mode', nightmare: 'Nightmare mode', powers: 'All powers mode' };

export type CardInfo = {
  id: CardId;
  emoji: string;
  name: string;
  camp: Camp;
  /** One line: what the card does. */
  power: string;
  /** The goal, as the card says it. */
  goal: string;
};

export const CARDS: Record<CardId, CardInfo> = {
  werewolf: { id: 'werewolf', emoji: '🐺', name: 'Werewolf', camp: 'wolves', power: 'Each night, the pack chooses a victim.', goal: 'Outnumber the village.' },
  villager: { id: 'villager', emoji: '🧑‍🌾', name: 'Villager', camp: 'village', power: 'No power at night: your vote and your instinct.', goal: 'Find and eliminate every werewolf.' },
  seer: { id: 'seer', emoji: '🔮', name: 'Seer', camp: 'village', power: 'Each night, discover the card of one player.', goal: 'Find and eliminate every werewolf.' },
  witch: { id: 'witch', emoji: '🧙', name: 'Witch', camp: 'village', power: 'One potion of life, one potion of death; one per night.', goal: 'Find and eliminate every werewolf.' },
  hunter: {
    id: 'hunter',
    emoji: '🏹',
    name: 'Hunter',
    camp: 'village',
    power: 'One shot, at night. A werewolf: it dies. Anyone else: you die.',
    goal: 'Find and eliminate every werewolf.',
  },
  cupid: { id: 'cupid', emoji: '💘', name: 'Cupid', camp: 'village', power: 'The first night, link two players: if one dies, the other too.', goal: 'Find and eliminate every werewolf.' },
  little_girl: {
    id: 'little_girl',
    emoji: '👧',
    name: 'Little Girl',
    camp: 'village',
    power: 'Once, the night you choose: three players, at least one is a werewolf.',
    goal: 'Find and eliminate every werewolf.',
  },
  salvateur: {
    id: 'salvateur',
    emoji: '🛡️',
    name: 'Protector',
    camp: 'village',
    power: 'Each night, protect one player (not yourself, not the same twice in a row).',
    goal: 'Find and eliminate every werewolf.',
  },
  thief: { id: 'thief', emoji: '🃏', name: 'Thief', camp: 'village', power: 'The first night, take one of two extra cards, or keep yours.', goal: 'Win with your new card’s camp.' },
  elder: { id: 'elder', emoji: '👴', name: 'Elder', camp: 'village', power: 'Survives the first attack of the werewolves.', goal: 'Find and eliminate every werewolf.' },
  // Dubaï: the Expats are the village, the Escrocs the werewolves, the Indépendants play alone.
  expat: { id: 'expat', emoji: '🧳', name: 'The Expat', camp: 'village', power: 'No power: your vote and your instinct.', goal: 'Eliminate every Escroc.' },
  escroc: { id: 'escroc', emoji: '🎭', name: 'The Escroc', camp: 'wolves', power: 'Each night, the Escrocs choose a victim together.', goal: 'Take control of the city.' },
  influencer: { id: 'influencer', emoji: '📸', name: 'The Influencer', camp: 'village', power: 'Bad Buzz: once, by day, one player’s vote counts double today.', goal: 'Make the Expats win.' },
  entrepreneur: { id: 'entrepreneur', emoji: '💼', name: 'The Entrepreneur', camp: 'village', power: 'Business Plan: once, at night, protect another player from the Escrocs.', goal: 'Make the Expats win.' },
  millionaire: { id: 'millionaire', emoji: '💎', name: 'The Millionaire', camp: 'village', power: 'Second Chance: survives the Escrocs’ attack once.', goal: 'Make the Expats win.' },
  single: { id: 'single', emoji: '🌹', name: 'The Single', camp: 'village', power: 'Crush: the first night, fall for a player; you become lovers.', goal: 'Make the Expats win (or the lovers’ goal).' },
  charo: { id: 'charo', emoji: '🕶️', name: 'The Charmer', camp: 'solo', power: 'Each night, try to seduce a new player.', goal: 'Three players seduced, alive at the third: a victory for good.' },
  golden_visa: { id: 'golden_visa', emoji: '🪪', name: 'The Golden Visa Resident', camp: 'village', power: 'Protected Residence: once, at night, protect yourself from the Escrocs.', goal: 'Make the Expats win.' },
  investor: { id: 'investor', emoji: '📈', name: 'The Investor', camp: 'village', power: 'Due Diligence: once, learn whether a player is an Escroc.', goal: 'Make the Expats win.' },
  ceo: { id: 'ceo', emoji: '🏢', name: 'The CEO', camp: 'village', power: 'Board Meeting: once, before a vote, your vote counts double that day.', goal: 'Make the Expats win.' },
  ecommerce: { id: 'ecommerce', emoji: '📦', name: 'The E-merchant', camp: 'village', power: 'Express Delivery: once, at night, protect another player from the Escrocs.', goal: 'Make the Expats win.' },
  newcomer: { id: 'newcomer', emoji: '✈️', name: 'The Newcomer', camp: 'village', power: 'Fresh Start: once, by day, you cannot be voted out today.', goal: 'Make the Expats win.' },
  emirati: { id: 'emirati', emoji: '🌴', name: 'The Emirati', camp: 'village', power: 'Local Knowledge: once, learn whether a player is an Escroc.', goal: 'Make the Expats win.' },
  realtor: { id: 'realtor', emoji: '🏠', name: 'The Real Estate Agent', camp: 'wolves', power: 'Fake Listing: once, investigations on one player are reversed that night.', goal: 'Help the Escrocs win.' },
  creator: { id: 'creator', emoji: '🎥', name: 'The Content Creator', camp: 'village', power: 'Exclusive Story: once, learn whether a player acted that night.', goal: 'Make the Expats win.' },
  broker: { id: 'broker', emoji: '📊', name: 'The Broker', camp: 'wolves', power: 'Market Manipulation: once, by day, secretly cancel one player’s vote.', goal: 'Help the Escrocs win.' },
  tourist: { id: 'tourist', emoji: '📷', name: 'The Tourist', camp: 'village', power: 'Short Stay: once, the Escrocs cannot reach you that night.', goal: 'Make the Expats win.' },
  concierge: { id: 'concierge', emoji: '🛎️', name: 'The Concierge', camp: 'village', power: 'VIP Access: each night, learn whether a player got a visit (not the same twice in a row).', goal: 'Make the Expats win.' },
  fake_millionaire: { id: 'fake_millionaire', emoji: '🎩', name: 'The Fake Millionaire', camp: 'solo', power: 'Bluff: once, investigations see you as an Expat that night.', goal: 'Be alive at the end of the game.' },
  networker: { id: 'networker', emoji: '🤝', name: 'The Networker', camp: 'village', power: 'Address Book: once, learn a player’s faction.', goal: 'Expats’ victory; also yours if you investigated an Escroc and survive.' },
};

export const DUBAI_ORDER: DubaiCardId[] = [
  'escroc', 'realtor', 'broker', 'expat', 'investor', 'emirati', 'networker', 'concierge', 'creator', 'entrepreneur', 'ecommerce',
  'golden_visa', 'tourist', 'millionaire', 'influencer', 'ceo', 'newcomer', 'single', 'charo', 'fake_millionaire',
];

/** The factions as each mode names them. */
export const campName = (camp: Camp | string | undefined, mode: WwMode | string | undefined): string =>
  mode === 'dubai' ? (camp === 'wolves' ? 'Escrocs' : camp === 'solo' ? 'Independents' : 'Expats') : camp === 'wolves' ? 'Werewolves' : camp === 'solo' ? 'Solo' : 'Village';

export const CARD_ORDER: ClassicCardId[] = ['werewolf', 'villager', 'seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder', 'thief'];
export const SPECIALS: ClassicCardId[] = ['seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder', 'thief'];

export const cardOf = (id: string | null | undefined): CardInfo => CARDS[(id as CardId) in CARDS ? (id as CardId) : 'villager'];

/** What a night or day action asks, as a title. */
export const ACTION_TITLE: Record<string, string> = {
  wolf: 'Choose your victim',
  seer: 'Whose card do you want to see?',
  protect: 'Who do you protect tonight?',
  shoot: 'Shoot someone? (once in the game)',
  hint: 'Spy on the werewolves tonight? (once)',
  link: 'Link two players',
  steal: 'Take a card, or keep yours',
  heal: 'Save the victim?',
  poison: 'Use your potion of death?',
  ready: 'Ready to vote?',
  vote: 'Who do you eliminate?',
  shield: 'Protect someone from the Escrocs tonight? (once)',
  visa: 'Protect yourself tonight? (once)',
  stay: 'Out of reach tonight? (once)',
  bluff: 'Look like an Expat tonight? (once)',
  probe: 'Investigate someone? (once)',
  listing: 'Fake listing: reverse the investigations on someone tonight? (once)',
  story: 'Did someone act tonight? (once)',
  watch: 'Who do you watch tonight?',
  crush: 'Who do you fall for?',
  seduce: 'Who do you try to seduce tonight?',
  buzz: 'Bad Buzz: whose vote counts double today? (once)',
  board: 'Board Meeting: your vote counts double today (once)',
  fresh: 'Fresh Start: immune to the vote today (once)',
  dump: 'Cancel someone’s vote today? (once, secret)',
};

/** Actions without a target: a single button. */
export const NO_TARGET = new Set(['ready', 'hint', 'board', 'fresh', 'stay', 'bluff']);

/** The table's default deck for a number of players (the server's ww_default_composition, for display before the start). */
export function wolvesFor(size: number): number {
  return size < 8 ? 1 : size < 12 ? 2 : size < 15 ? 3 : size < 20 ? 4 : 5;
}
