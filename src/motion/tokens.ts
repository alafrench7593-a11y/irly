import { Easing } from 'react-native-reanimated';

/**
 * IRLY Motion System.
 *
 * Every animation in the app resolves to one of these tokens. Motion links
 * two states and always serves orientation or feedback, never decoration.
 * Only transform and opacity are animated; blur is static and fades in with
 * its layer. Gestures drive animations directly: while a finger is down
 * nothing is timed, on release a spring takes over from the finger's
 * velocity.
 *
 * Names follow the IRLY brief (`motion.fast`, `spring.soft`...). The older
 * v2 names (`spring.smooth`, `spring.bouncy`...) are kept as aliases so the
 * whole codebase reads from one table.
 */

/**
 * Durations by role (IRLY brief, section 21):
 * - fast (micro-interactions): press, like, chip, toggle
 * - standard (navigation): tabs, pages, sheets
 * - emphasized (major transitions): card to page, IRL menu, destination
 * - cinematic: the match, onboarding, an IRL moment
 */
export const motion = {
  /** Fades, colour changes, content swap inside a control. */
  fast: 160,
  /** Press feedback, chips, small toggles. */
  normal: 260,
  /** Navigation: tabs, pages, sheets. */
  standard: 300,
  /** Camera recentring, larger fades. */
  slow: 400,
  /** Major transitions: card → page, IRL menu, destination switch. */
  emphasized: 500,
  /** Match, onboarding, IRL moments. */
  cinematic: 760,
} as const;

export const duration = {
  micro: 120,
  fast: motion.fast,
  base: motion.normal,
  slow: motion.slow,
  xslow: 700,
} as const;

export const ease = {
  /** Anything moving on screen without a spring. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Elements entering: fast start, long settle. */
  enter: Easing.bezier(0.05, 0.7, 0.1, 1),
  /** Elements leaving: slow start, quick finish. */
  exit: Easing.bezier(0.3, 0, 0.8, 0.15),
  /** Map camera: 2D to 3D tilt and flights. */
  camera: Easing.bezier(0.65, 0, 0.15, 1),
} as const;

/** v2 name of `ease`. */
export const easing = {
  standard: ease.standard,
  emphasized: Easing.bezier(0.3, 0, 0, 1),
  exit: ease.exit,
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  enter: ease.enter,
  camera: ease.camera,
} as const;

/**
 * Springs use perceptual duration + damping ratio (Reanimated 4).
 *
 * - soft: large surfaces that change shape (card to page, avatar to profile).
 * - medium: things that travel (sheets, tab indicator, screens sliding in).
 * - strong: feedback that should be felt (marker selected, Join, Create).
 */
const soft = { duration: 520, dampingRatio: 0.96 };
const medium = { duration: 460, dampingRatio: 0.9 };
const strong = { duration: 560, dampingRatio: 0.58 };

export const spring = {
  soft,
  medium,
  strong,
  /** Physical controls that open a world: the IRL button and its menu. */
  physical: { duration: 420, dampingRatio: 0.74 },
  /** The match moment and onboarding statements. */
  cinematic: { duration: 760, dampingRatio: 0.88 },
  /** Press feedback: quick, barely lively. */
  press: { duration: 260, dampingRatio: 0.72 },
  /** Directive names: fast = press/snap, standard = travel, gentle = surfaces. */
  fast: { duration: 300, dampingRatio: 0.8 },
  standard: medium,
  gentle: soft,
  /** v2 aliases. */
  snappy: { duration: 380, dampingRatio: 0.86 },
  smooth: soft,
  bouncy: strong,
  sheet: medium,
} as const;

export const scale = {
  /** Every touchable surface while pressed. */
  press: 0.96,
  /** Web pointer hover. */
  hover: 1.02,
  /** Selected marker, active tab icon, chosen category. */
  selected: 1.12,
} as const;

/** Blur intensities (expo-blur scale) for glass layers. */
export const blur = {
  light: 30,
  medium: 55,
  strong: 80,
} as const;

export const pressScale = scale.press;
/** Delay between items of a list that reveals in order. At most 6 steps. */
export const staggerStep = 55;
export const maxStagger = 6;

/**
 * Named transitions. Screens and overlays pick one of these instead of
 * inventing timings: page and modal slide on springs, the match moment and
 * the IRLY Girl morph have their own choreography built from these steps.
 */
export const transition = {
  page: spring.medium,
  modal: spring.soft,
  sheet: spring.medium,
  sharedElement: spring.soft,
  fade: { duration: motion.normal, easing: ease.standard },
  /** IRLY → IRLY Girl: colour wash, blur, wordmark morph. */
  morph: { wash: 520, hold: 260, reveal: 420 },
  /** IT'S AN IRLY MATCH: cards meet, glass merges, text and actions follow. */
  match: { approach: 520, merge: 280, text: 360, actions: 420 },
} as const;
