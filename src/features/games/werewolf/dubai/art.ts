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
  // The book V3's families: Chaos, Nightmare, Manipulation, Hybrids.
  scammer: require('../../../../../assets/games/v3/scammer.webp'),
  swapper: require('../../../../../assets/games/v3/swapper.webp'),
  gambler: require('../../../../../assets/games/v3/gambler.webp'),
  mirror: require('../../../../../assets/games/v3/mirror.webp'),
  saboteur: require('../../../../../assets/games/v3/saboteur.webp'),
  chameleon: require('../../../../../assets/games/v3/chameleon.webp'),
  clown: require('../../../../../assets/games/v3/clown.webp'),
  shapeshifter: require('../../../../../assets/games/v3/shapeshifter.webp'),
  anomaly: require('../../../../../assets/games/v3/anomaly.webp'),
  ninja: require('../../../../../assets/games/v3/ninja.webp'),
  revenant: require('../../../../../assets/games/v3/revenant.webp'),
  cursed: require('../../../../../assets/games/v3/cursed.webp'),
  exorcist: require('../../../../../assets/games/v3/exorcist.webp'),
  possessed: require('../../../../../assets/games/v3/possessed.webp'),
  reaper: require('../../../../../assets/games/v3/reaper.webp'),
  spider: require('../../../../../assets/games/v3/spider.webp'),
  vampire: require('../../../../../assets/games/v3/vampire.webp'),
  gravedigger: require('../../../../../assets/games/v3/gravedigger.webp'),
  sleepwalker: require('../../../../../assets/games/v3/sleepwalker.webp'),
  dark_oracle: require('../../../../../assets/games/v3/dark_oracle.webp'),
  manipulator: require('../../../../../assets/games/v3/manipulator.webp'),
  hacker: require('../../../../../assets/games/v3/hacker.webp'),
  double_agent: require('../../../../../assets/games/v3/double_agent.webp'),
  corrupt: require('../../../../../assets/games/v3/corrupt.webp'),
  lawyer: require('../../../../../assets/games/v3/lawyer.webp'),
  paparazzi: require('../../../../../assets/games/v3/paparazzi.webp'),
  usurper: require('../../../../../assets/games/v3/usurper.webp'),
  spy: require('../../../../../assets/games/v3/spy.webp'),
  dictator: require('../../../../../assets/games/v3/dictator.webp'),
  bounty_hunter: require('../../../../../assets/games/v3/bounty_hunter.webp'),
  detective: require('../../../../../assets/games/v3/detective.webp'),
  vigilante: require('../../../../../assets/games/v3/vigilante.webp'),
  prophet: require('../../../../../assets/games/v3/prophet.webp'),
  guardian: require('../../../../../assets/games/v3/guardian.webp'),
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
const NIGHTMARE_FOG = require('../../../../../assets/games/classic/bg_nightmare.webp') as ImageSourcePropType;
const POWERS_SQUARE = require('../../../../../assets/games/classic/bg_powers.webp') as ImageSourcePropType;

const MANIPULATION_HALL = require('../../../../../assets/games/v3/bg_manipulation.webp') as ImageSourcePropType;
const APOCALYPSE_SKY = require('../../../../../assets/games/v3/bg_apocalypse.webp') as ImageSourcePropType;

/** Each mode's scenes: its home, its night, its day and its victory. */
export const SCENES: Record<WwMode, Scene> = {
  classic: VILLAGE,
  dubai: BACKGROUND,
  chaos: { ...VILLAGE, home: CHAOS_SKY, night: CHAOS_SKY },
  nightmare: { ...VILLAGE, home: NIGHTMARE_FOG, night: NIGHTMARE_FOG },
  manipulation: { ...VILLAGE, home: MANIPULATION_HALL, night: MANIPULATION_HALL },
  nightmare_chaos: { ...VILLAGE, home: NIGHTMARE_FOG, night: CHAOS_SKY },
  manipulation_chaos: { ...VILLAGE, home: MANIPULATION_HALL, night: CHAOS_SKY },
  nightmare_manipulation: { ...VILLAGE, home: NIGHTMARE_FOG, night: MANIPULATION_HALL },
  apocalypse: { ...VILLAGE, home: APOCALYPSE_SKY, night: APOCALYPSE_SKY },
  powers: { ...VILLAGE, home: POWERS_SQUARE, night: POWERS_SQUARE },
};
