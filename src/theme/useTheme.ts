import { useMemo } from 'react';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useStore } from '@/state/store';
import { lights, type Light, type LightId } from './lights';
import { useFlavor, type FlavorId } from './flavor';
import { elevation, girlElevation, girlPalette, palettes, type Mode, type Palette } from './tokens';

export type Theme = {
  mode: Mode;
  c: Palette;
  light: Light;
  /** Destination accent, tuned for the current mode. */
  accent: string;
  shadow: (typeof elevation)[Mode];
  isDay: boolean;
  /** mixte or girl: same components, the identity of the experience. */
  flavor: FlavorId;
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

export function buildTheme(mode: Mode, lightId: LightId, flavor: FlavorId = 'mixte'): Theme {
  if (flavor === 'girl') {
    const violet = girlPalette.brand;
    const light: Light = { ...lights[lightId], accent: violet, accentDay: violet, accentSoft: girlPalette.brandSoft };
    // IRLY Girl stays light whatever the appearance setting: its identity is the lavender-pearl ground.
    return { mode: 'day', c: girlPalette, light, accent: violet, shadow: girlElevation, isDay: true, flavor };
  }
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
    flavor,
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
  const flavor = useFlavor();
  return useMemo(() => buildTheme(mode, lightId, flavor), [mode, lightId, flavor]);
}
