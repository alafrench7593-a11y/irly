import { useMemo } from 'react';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useStore } from '@/state/store';
import { lights, type Light, type LightId } from './lights';
import { elevation, palettes, type Mode, type Palette } from './tokens';

export type Theme = {
  mode: Mode;
  c: Palette;
  light: Light;
  /** Destination accent, tuned for the current mode. */
  accent: string;
  shadow: (typeof elevation)[Mode];
  isDay: boolean;
};

/**
 * v5: IRLY Noir everywhere by default (onboarding and app share one
 * immersive world). "Light" in Settings brings back IRLY Clair once the
 * member is in the app; onboarding always stays dark.
 */
export function resolveMode(appearance: 'auto' | 'day' | 'night', cityId: CityId | null): Mode {
  if (!cityId) return 'night';
  return appearance === 'day' ? 'day' : 'night';
}

export function buildTheme(mode: Mode, lightId: LightId): Theme {
  // The destination keeps its sky (onboarding, portal transition) but no
  // longer tints the interface: accents are white, colour is reserved for
  // categories and statuses.
  const ink = mode === 'day' ? '#0A0A0A' : '#FFFFFF';
  const light: Light = { ...lights[lightId], accent: ink, accentDay: ink, accentSoft: mode === 'day' ? 'rgba(10,10,10,0.06)' : 'rgba(255,255,255,0.12)' };
  return {
    mode,
    c: palettes[mode],
    light,
    accent: light.accent,
    shadow: elevation[mode],
    isDay: mode === 'day',
  };
}

/**
 * The single theme entry point. The whole interface follows the selected
 * destination (its light) and its local time of day (day / night).
 */
export function useTheme(override?: { mode?: Mode; light?: LightId }): Theme {
  const appearance = useStore((s) => s.appearance);
  const cityId = useStore((s) => s.cityId);
  const onboarded = useStore((s) => s.onboarded);
  const mode = override?.mode ?? resolveMode(appearance, onboarded ? cityId : null);
  const lightId: LightId = override?.light ?? (cityId ? CITIES[cityId].light : 'dubai');
  return useMemo(() => buildTheme(mode, lightId), [mode, lightId]);
}
