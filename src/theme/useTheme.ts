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
 * v3 has a single black theme. The `appearance` setting and the city's
 * local time no longer change the palette; the signature is kept so the
 * call sites stay unchanged.
 */
export function resolveMode(_appearance: 'auto' | 'day' | 'night', _cityId: CityId | null): Mode {
  return 'night';
}

export function buildTheme(mode: Mode, lightId: LightId): Theme {
  // The destination keeps its sky (onboarding, portal transition) but no
  // longer tints the interface: accents are white, colour is reserved for
  // categories and statuses.
  const light: Light = { ...lights[lightId], accent: '#FFFFFF', accentDay: '#FFFFFF', accentSoft: 'rgba(255,255,255,0.10)' };
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
