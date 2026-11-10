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
/** The cards of the book V3's families: Chaos, Nightmare, Manipulation, Hybrids. */
export type V3CardId =
  | 'scammer'
  | 'swapper'
  | 'gambler'
  | 'mirror'
  | 'saboteur'
  | 'chameleon'
  | 'clown'
  | 'shapeshifter'
  | 'anomaly'
  | 'ninja'
  | 'revenant'
  | 'cursed'
  | 'exorcist'
  | 'possessed'
  | 'reaper'
  | 'spider'
  | 'vampire'
  | 'gravedigger'
  | 'sleepwalker'
  | 'dark_oracle'
  | 'manipulator'
  | 'hacker'
  | 'double_agent'
  | 'corrupt'
  | 'lawyer'
  | 'paparazzi'
  | 'usurper'
  | 'spy'
  | 'dictator'
  | 'bounty_hunter'
  | 'detective'
  | 'vigilante'
  | 'prophet'
  | 'guardian';
export type CardId = ClassicCardId | DubaiCardId | V3CardId;
export type Camp = 'village' | 'wolves' | 'solo';
export type WwMode = 'classic' | 'chaos' | 'nightmare' | 'manipulation' | 'nightmare_chaos' | 'manipulation_chaos' | 'nightmare_manipulation' | 'apocalypse' | 'dubai' | 'powers';
/** The nine modes, then the « all powers » variant of the Classic. */
export const MODES: WwMode[] = ['classic', 'chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse', 'dubai', 'powers'];
/** A mode read from the server or a link; anything unknown is Classic. */
export const toMode = (m: string | null | undefined): WwMode => (MODES.includes(m as WwMode) ? (m as WwMode) : 'classic');
export const MODE_NAME: Record<WwMode, string> = {
  classic: 'Classic',
  chaos: 'Chaos',
  nightmare: 'Nightmare',
  manipulation: 'Manipulation',
  nightmare_chaos: 'Nightmare Chaos',
  manipulation_chaos: 'Manipulation Chaos',
  nightmare_manipulation: 'Nightmare Manipulation',
  apocalypse: 'Apocalypse',
  dubai: 'Dubai',
  powers: 'All powers',
};
export const MODE_LABEL: Record<WwMode, string> = {
  classic: 'Classic mode',
  chaos: 'Chaos mode',
  nightmare: 'Nightmare mode',
  manipulation: 'Manipulation mode',
  nightmare_chaos: 'Nightmare Chaos mode',
  manipulation_chaos: 'Manipulation Chaos mode',
  nightmare_manipulation: 'Nightmare Manipulation mode',
  apocalypse: 'Apocalypse mode',
  dubai: 'Dubai mode',
  powers: 'All powers mode',
};
export type Family = 'chaos' | 'nightmare' | 'manipulation' | 'hybrid';
/** The families a mode plays on top of the Classic cards (the server's ww_mode_families). */
export const MODE_FAMILIES: Record<WwMode, Family[]> = {
  classic: [],
  powers: [],
  dubai: [],
  chaos: ['chaos'],
  nightmare: ['nightmare'],
  manipulation: ['manipulation'],
  nightmare_chaos: ['nightmare', 'chaos', 'hybrid'],
  manipulation_chaos: ['manipulation', 'chaos', 'hybrid'],
  nightmare_manipulation: ['nightmare', 'manipulation', 'hybrid'],
  apocalypse: ['chaos', 'nightmare', 'manipulation', 'hybrid'],
};
export const isV3 = (m: WwMode): boolean => MODE_FAMILIES[m].length > 0;

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
  // The Chaos, Nightmare, Manipulation and Hybrid cards of the book V3 (docs/LOUP-GAROU-V3.md, supabase/migrations/20261116*).
  scammer: { id: 'scammer', emoji: '💳', name: 'Scammer', camp: 'village', power: 'Once: swap your card with another player’s, for good.', goal: 'Find and eliminate every werewolf.' },
  swapper: { id: 'swapper', emoji: '🔁', name: 'Swapper', camp: 'village', power: 'Once: two players trade their night powers for the next night.', goal: 'Find and eliminate every werewolf.' },
  gambler: { id: 'gambler', emoji: '🎲', name: 'Gambler', camp: 'village', power: 'Once: the server draws a protection, a block or an investigation on your target.', goal: 'Find and eliminate every werewolf.' },
  mirror: { id: 'mirror', emoji: '🪞', name: 'Mirror', camp: 'village', power: 'Once, by itself: sends back an attack aimed at you by one player. Never the Hunter’s.', goal: 'Find and eliminate every werewolf.' },
  saboteur: { id: 'saboteur', emoji: '🧨', name: 'Saboteur', camp: 'village', power: 'Twice: block a player’s night power.', goal: 'Find and eliminate every werewolf.' },
  chameleon: { id: 'chameleon', emoji: '🦎', name: 'Chameleon', camp: 'village', power: 'Once: copy a player’s night power for the next night.', goal: 'Find and eliminate every werewolf.' },
  clown: { id: 'clown', emoji: '🤡', name: 'Clown', camp: 'solo', power: 'No power: get yourself voted out.', goal: 'Win when the village votes you out.' },
  shapeshifter: { id: 'shapeshifter', emoji: '🎭', name: 'Shapeshifter', camp: 'village', power: 'Twice: show another player’s role to the investigations of the night.', goal: 'Find and eliminate every werewolf.' },
  anomaly: { id: 'anomaly', emoji: '🌀', name: 'Anomaly', camp: 'village', power: 'When you are eliminated, an event hits the next night: Fog or Curfew.', goal: 'Find and eliminate every werewolf.' },
  ninja: { id: 'ninja', emoji: '🥷', name: 'Ninja', camp: 'village', power: 'Twice: nothing can be seen of you that night.', goal: 'Find and eliminate every werewolf.' },
  revenant: { id: 'revenant', emoji: '👻', name: 'Revenant', camp: 'village', power: 'Once: killed at night, you come back at the start of the next night.', goal: 'Find and eliminate every werewolf.' },
  cursed: { id: 'cursed', emoji: '🩸', name: 'Cursed', camp: 'village', power: 'The pack’s first deadly attack on you makes you a werewolf.', goal: 'With the village… until you turn.' },
  exorcist: { id: 'exorcist', emoji: '📿', name: 'Exorcist', camp: 'village', power: 'Twice: lift what weighs on a player (a mark, a curse, a bite).', goal: 'Find and eliminate every werewolf.' },
  possessed: { id: 'possessed', emoji: '😈', name: 'Possessed', camp: 'solo', power: 'The server gives you a target, known to you alone.', goal: 'Win when your target is voted out.' },
  reaper: { id: 'reaper', emoji: '💀', name: 'Reaper', camp: 'village', power: 'Once: mark a player, who dies when the next night begins.', goal: 'Find and eliminate every werewolf.' },
  spider: { id: 'spider', emoji: '🕷️', name: 'Spider', camp: 'village', power: 'Twice: block a player’s night power.', goal: 'Find and eliminate every werewolf.' },
  vampire: { id: 'vampire', emoji: '🧛', name: 'Vampire', camp: 'solo', power: 'Each night, bite a player: a villager becomes your servant. Two at most.', goal: 'Win alive with two servants alive.' },
  gravedigger: { id: 'gravedigger', emoji: '⚰️', name: 'Gravedigger', camp: 'village', power: 'Each night, learn the role of an eliminated player.', goal: 'Find and eliminate every werewolf.' },
  sleepwalker: { id: 'sleepwalker', emoji: '🌙', name: 'Sleepwalker', camp: 'village', power: 'Each night, visit a player: you learn if an attack was aimed at them.', goal: 'Find and eliminate every werewolf.' },
  dark_oracle: { id: 'dark_oracle', emoji: '🔮', name: 'Dark Oracle', camp: 'village', power: 'Twice: learn a player’s camp. After the second, no vote for you the next day.', goal: 'Find and eliminate every werewolf.' },
  manipulator: { id: 'manipulator', emoji: '🎎', name: 'Manipulator', camp: 'village', power: 'Once, by day: a player cannot vote today.', goal: 'Find and eliminate every werewolf.' },
  hacker: { id: 'hacker', emoji: '💻', name: 'Hacker', camp: 'village', power: 'Each night, learn whether a player used a night power.', goal: 'Find and eliminate every werewolf.' },
  double_agent: { id: 'double_agent', emoji: '🕴️', name: 'Double Agent', camp: 'wolves', power: 'A werewolf who shows as Village to the investigations of camps.', goal: 'Outnumber the village.' },
  corrupt: { id: 'corrupt', emoji: '💰', name: 'Corrupt', camp: 'village', power: 'Once, by day: your vote counts double.', goal: 'Find and eliminate every werewolf.' },
  lawyer: { id: 'lawyer', emoji: '⚖️', name: 'Lawyer', camp: 'village', power: 'Once: cancel the elimination of the player you plead for.', goal: 'Find and eliminate every werewolf.' },
  paparazzi: { id: 'paparazzi', emoji: '📸', name: 'Paparazzi', camp: 'village', power: 'Each night, a true clue: a player on whom a power was used.', goal: 'Find and eliminate every werewolf.' },
  usurper: { id: 'usurper', emoji: '🖋️', name: 'Usurper', camp: 'wolves', power: 'A werewolf. Once: falsify what the investigations see of a player that night.', goal: 'Outnumber the village.' },
  spy: { id: 'spy', emoji: '🕵️', name: 'Spy', camp: 'village', power: 'Twice: learn whom a player targeted that night.', goal: 'Find and eliminate every werewolf.' },
  dictator: { id: 'dictator', emoji: '👑', name: 'Dictator', camp: 'village', power: 'Once: after a vote without elimination, call one more vote.', goal: 'Find and eliminate every werewolf.' },
  bounty_hunter: { id: 'bounty_hunter', emoji: '🎯', name: 'Bounty Hunter', camp: 'village', power: 'Two shots, at night: a werewolf dies; a shot at anyone else is lost.', goal: 'The village’s victory; yours too with two werewolves shot.' },
  detective: { id: 'detective', emoji: '🔎', name: 'Detective', camp: 'village', power: 'Each night, learn whether a player is a werewolf.', goal: 'The village’s victory; yours too with two werewolves identified.' },
  vigilante: { id: 'vigilante', emoji: '🔥', name: 'Vigilante', camp: 'village', power: 'No night power: your vote.', goal: 'The village’s victory; yours too with two werewolves voted out with your vote.' },
  prophet: { id: 'prophet', emoji: '📖', name: 'Prophet', camp: 'village', power: 'Each night, predict a player’s camp.', goal: 'The village’s victory; yours too with three right predictions.' },
  guardian: { id: 'guardian', emoji: '🛡️', name: 'Guardian', camp: 'village', power: 'Each night, protect a player from every attack.', goal: 'The village’s victory; yours too with two deadly attacks stopped.' },
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

export const FAMILY_CARDS: Record<Family, V3CardId[]> = {
  chaos: ['scammer', 'swapper', 'gambler', 'mirror', 'saboteur', 'chameleon', 'clown', 'shapeshifter', 'anomaly', 'ninja'],
  nightmare: ['revenant', 'cursed', 'exorcist', 'possessed', 'reaper', 'spider', 'vampire', 'gravedigger', 'sleepwalker', 'dark_oracle'],
  manipulation: ['manipulator', 'hacker', 'double_agent', 'corrupt', 'lawyer', 'paparazzi', 'usurper', 'spy', 'dictator'],
  hybrid: ['bounty_hunter', 'detective', 'vigilante', 'prophet', 'guardian'],
};
export const FAMILY_NAME: Record<Family, string> = { chaos: 'Chaos', nightmare: 'Nightmare', manipulation: 'Manipulation', hybrid: 'Hybrids' };
/** Every card a mode can deal, in the order shown (the server's ww_mode_roles; no Thief in the V3 modes). */
export const deckOf = (mode: WwMode): CardId[] =>
  mode === 'dubai' ? DUBAI_ORDER : isV3(mode) ? [...CARD_ORDER.filter((c) => c !== 'thief'), ...MODE_FAMILIES[mode].flatMap((f) => FAMILY_CARDS[f])] : CARD_ORDER;
export const HYBRIDS = new Set<string>(FAMILY_CARDS.hybrid);

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
  scam: 'Swap your card with a player’s, for good? (once)',
  exchange: 'Two players trade their powers next night (once)',
  gamble: 'Try your luck on a player? (once)',
  sabotage: 'Block a player’s power tonight?',
  web: 'Block a player’s power tonight?',
  copy: 'Copy a player’s power for the next night? (once)',
  disguise: 'Whose role do you show tonight?',
  hide: 'Vanish from the investigations tonight?',
  exorcise: 'Lift what weighs on a player?',
  mark: 'Mark a player for the next night? (once)',
  bite: 'Who do you bite tonight?',
  dig: 'Whose grave do you open?',
  visit: 'Who do you visit tonight?',
  omen: 'Whose camp do you want to know?',
  hack: 'Who do you hack tonight?',
  forge: 'Falsify the investigations on a player tonight? (once)',
  spy: 'Who do you spy on tonight?',
  bounty: 'Shoot a werewolf? (two shots in the game)',
  detect: 'Who do you investigate tonight?',
  predict_wolf: 'Your prediction: a werewolf',
  predict_village: 'Your prediction: not a werewolf',
  guard: 'Who do you guard tonight?',
  mute: 'Silence a player for today’s vote? (once)',
  bribe: 'Corruption: your vote counts double today (once)',
  plead: 'Plead for a player today? (used only if they are voted out)',
  decree: 'Decree: one more vote if nobody is eliminated (once)',
};

/** Actions without a target: a single button. */
export const NO_TARGET = new Set(['ready', 'hint', 'board', 'fresh', 'stay', 'bluff', 'hide', 'bribe', 'decree']);
/** Actions on two players, chosen one after the other. */
export const TWO_TARGETS = new Set(['link', 'exchange']);
/** Powers used by day, from their own buttons (the table by day is for the vote). */
export const DAY_POWERS = new Set(['buzz', 'dump', 'board', 'fresh', 'mute', 'bribe', 'plead', 'decree']);

/** The table's default deck for a number of players (the server's ww_default_composition, for display before the start). */
export function wolvesFor(size: number): number {
  return size < 8 ? 1 : size < 12 ? 2 : size < 15 ? 3 : size < 20 ? 4 : 5;
}
