import type { ImageSourcePropType } from 'react-native';
import type { CardId, WwMode } from '../cards';

/**
 * The game's illustrations (generated for IRLY, fictional people): the Classic village and the Dubaï cast.
 * Portraits 720×960, backgrounds 900×1600, WebP.
 */
export const PORTRAIT: Record<CardId, ImageSourcePropType> = {
  // Classic (and Chaos): the village.
  werewolf: require('../../../../../assets/games/classic/werewolf.webp'),
  villager: require('../../../../../assets/games/classic/villager.webp'),
  seer: require('../../../../../assets/games/classic/seer.webp'),
  witch: require('../../../../../assets/games/classic/witch.webp'),
  hunter: require('../../../../../assets/games/classic/hunter.webp'),
  salvateur: require('../../../../../assets/games/classic/salvateur.webp'),
  cupid: require('../../../../../assets/games/classic/cupid.webp'),
  little_girl: require('../../../../../assets/games/classic/little_girl.webp'),
  elder: require('../../../../../assets/games/classic/elder.webp'),
  thief: require('../../../../../assets/games/classic/thief.webp'),
  // Dubaï.

  expat: require('../../../../../assets/games/dubai/expat.webp'),
  escroc: require('../../../../../assets/games/dubai/escroc.webp'),
  influencer: require('../../../../../assets/games/dubai/influencer.webp'),
  entrepreneur: require('../../../../../assets/games/dubai/entrepreneur.webp'),
  millionaire: require('../../../../../assets/games/dubai/millionaire.webp'),
  single: require('../../../../../assets/games/dubai/single.webp'),
  charo: require('../../../../../assets/games/dubai/charo.webp'),
  golden_visa: require('../../../../../assets/games/dubai/golden_visa.webp'),
  investor: require('../../../../../assets/games/dubai/investor.webp'),
  ceo: require('../../../../../assets/games/dubai/ceo.webp'),
  ecommerce: require('../../../../../assets/games/dubai/ecommerce.webp'),
  newcomer: require('../../../../../assets/games/dubai/newcomer.webp'),
  emirati: require('../../../../../assets/games/dubai/emirati.webp'),
  realtor: require('../../../../../assets/games/dubai/realtor.webp'),
  creator: require('../../../../../assets/games/dubai/creator.webp'),
  broker: require('../../../../../assets/games/dubai/broker.webp'),
  tourist: require('../../../../../assets/games/dubai/tourist.webp'),
  concierge: require('../../../../../assets/games/dubai/concierge.webp'),
  fake_millionaire: require('../../../../../assets/games/dubai/fake_millionaire.webp'),
  networker: require('../../../../../assets/games/dubai/networker.webp'),
};

export const BACKGROUND = {
  home: require('../../../../../assets/games/dubai/bg_home.webp') as ImageSourcePropType,
  night: require('../../../../../assets/games/dubai/bg_night.webp') as ImageSourcePropType,
  day: require('../../../../../assets/games/dubai/bg_day.webp') as ImageSourcePropType,
  victory: require('../../../../../assets/games/dubai/bg_victory.webp') as ImageSourcePropType,
};

type Scene = { home: ImageSourcePropType; night: ImageSourcePropType; day: ImageSourcePropType; victory: ImageSourcePropType };
const VILLAGE: Scene = {
  home: require('../../../../../assets/games/classic/bg_night.webp') as ImageSourcePropType,
  night: require('../../../../../assets/games/classic/bg_night.webp') as ImageSourcePropType,
  day: require('../../../../../assets/games/classic/bg_day.webp') as ImageSourcePropType,
  victory: require('../../../../../assets/games/classic/bg_victory.webp') as ImageSourcePropType,
};
const CHAOS_SKY = require('../../../../../assets/games/classic/bg_chaos.webp') as ImageSourcePropType;

/** Each mode's scenes: its home, its night, its day and its victory. */
export const SCENES: Record<WwMode, Scene> = {
  classic: VILLAGE,
  dubai: BACKGROUND,
  chaos: { ...VILLAGE, home: CHAOS_SKY, night: CHAOS_SKY },
};
