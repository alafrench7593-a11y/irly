/**
 * The Classic cards of IRLY Loup-Garou, as the server plays them
 * (docs/LOUP-GAROU.md, supabase/migrations/20261112000000_irly_werewolf.sql).
 * English source; French through the dictionary (src/i18n/fr.ts).
 */
export type CardId = 'werewolf' | 'villager' | 'seer' | 'witch' | 'hunter' | 'cupid' | 'little_girl' | 'salvateur' | 'thief' | 'elder';
export type Camp = 'village' | 'wolves';

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
};

export const CARD_ORDER: CardId[] = ['werewolf', 'villager', 'seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder', 'thief'];
export const SPECIALS: CardId[] = ['seer', 'witch', 'hunter', 'salvateur', 'cupid', 'little_girl', 'elder', 'thief'];

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
};

/** The table's default deck for a number of players (the server's ww_default_composition, for display before the start). */
export function wolvesFor(size: number): number {
  return size < 8 ? 1 : size < 12 ? 2 : size < 15 ? 3 : size < 20 ? 4 : 5;
}
