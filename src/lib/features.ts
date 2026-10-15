/**
 * Features that exist in the code but are not open to members yet.
 *
 * One switch per feature, read everywhere the feature can be reached, so
 * turning it on later is this one line: navigation, routes and deep links
 * stay as they are.
 *
 * `matchIrly`: Match IRLY (people to meet, the disc in the middle of the
 * tab bar, /match). While it is off, /match and every link to it show the
 * coming-soon page (same page as /soon/match), the disc wears a « Soon »
 * tag, the "It's an IRLY match" celebration never plays and no Match
 * request reaches the server. IRLY Girl has its own matching and is NOT
 * affected by this switch.
 *
 * A build can open it for testing with EXPO_PUBLIC_MATCH_IRLY=on.
 */
export const FEATURES = {
  matchIrly: process.env.EXPO_PUBLIC_MATCH_IRLY === 'on',
} as const;

export type FeatureId = keyof typeof FEATURES;
