import { useMemo } from 'react';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { isDaytime } from '@/lib/time';
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

export function resolveMode(appearance: 'auto' | 'day' | 'night', cityId: CityId | null): Mode {
  if (appearance !== 'auto') return appearance;
  // Onboarding happens "between destinations": always at night, the
  // atmosphere is what carries the colour.
  if (!cityId) return 'night';
  return isDaytime(CITIES[cityId]) ? 'day' : 'night';
}

export function buildTheme(mode: Mode, lightId: LightId): Theme {
  const light = lights[lightId];
  return {
    mode,
    c: palettes[mode],
    light,
    accent: mode === 'day' ? light.accentDay : light.accent,
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
