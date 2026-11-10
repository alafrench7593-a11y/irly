import type { ImageSourcePropType } from 'react-native';
import type { DubaiCardId } from '../cards';

/**
 * The Dubaï mode's illustrations (generated for IRLY from the official mockups, fictional people).
 * Portraits 720×960, backgrounds 900×1600, WebP.
 */
export const PORTRAIT: Record<DubaiCardId, ImageSourcePropType> = {
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
