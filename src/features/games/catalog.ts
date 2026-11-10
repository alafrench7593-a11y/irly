import type { ImageSourcePropType } from 'react-native';

/**
 * The games of IRLY Games. A game listed here is playable today: no
 * « coming soon » entry. Adding a game is adding one entry (and its screens).
 * Ludo is put aside for now: its tables still open from a link.
 */
export type GameEntry = {
  /** The game's id on the server (game_rooms.game). */
  id: 'werewolf';
  name: string;
  description: string;
  /** Where « Play » leads: the game's own home. */
  href: '/games/werewolf';
  art: ImageSourcePropType;
  artLabel: string;
};

export const GAMES: GameEntry[] = [
  {
    id: 'werewolf',
    name: 'LOUP-GAROU 🐺',
    description: 'Bluff, investigate and unmask the Wolves with other players.',
    href: '/games/werewolf',
    art: require('../../../assets/games/classic/werewolf.webp'),
    artLabel: 'A werewolf under the full moon, above the village',
  },
];
