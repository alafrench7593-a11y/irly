import { Easing } from 'react-native-reanimated';

/**
 * IRLY motion language: things converge (meet), settle (springs) and
 * open up (expansions). Motion always serves orientation or feedback,
 * never decoration. Only transform and opacity are animated in loops.
 */

export const duration = {
  micro: 120,
  fast: 200,
  base: 300,
  slow: 450,
  xslow: 700,
} as const;

export const easing = {
  /** Default for anything entering or moving on screen. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Larger, more expressive moves (page-level). */
  emphasized: Easing.bezier(0.3, 0, 0, 1),
  /** Elements leaving the screen. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
} as const;

/**
 * Springs use perceptual duration + damping ratio (Reanimated 4), which is
 * easier to reason about than stiffness/mass.
 */
export const spring = {
  /** Press feedback: quick and slightly lively. */
  press: { duration: 260, dampingRatio: 0.72 },
  /** Default UI movement: indicators, chips, toggles. */
  snappy: { duration: 380, dampingRatio: 0.86 },
  /** Large surfaces: cards expanding, sheets. */
  smooth: { duration: 520, dampingRatio: 0.96 },
  /** Celebratory feedback: join, connect, success. */
  bouncy: { duration: 560, dampingRatio: 0.58 },
  /** Bottom sheets. */
  sheet: { duration: 460, dampingRatio: 0.9 },
} as const;

export const pressScale = 0.97;
export const staggerStep = 55;
