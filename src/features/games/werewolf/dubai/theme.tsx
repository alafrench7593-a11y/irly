import { Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_900Black } from '@expo-google-fonts/cinzel';
import { useFonts } from 'expo-font';
import { memo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';
import type { DubaiCardId } from '../cards';

/** The Dubaï mode's palette (official mockups): black, burgundy, gold, night blue, ivory. */
export const DX = {
  black: '#0B0907',
  panel: 'rgba(14, 10, 8, 0.82)',
  panelSolid: '#15100C',
  gold: '#E2B653',
  goldLight: '#F7DE97',
  goldDark: '#8E6A24',
  red: '#8E1B22',
  redLight: '#C9343C',
  night: '#141B33',
  ivory: '#F6EEDD',
  muted: '#C9BFA9',
  expats: '#3D6FD6',
  escrocs: '#C9343C',
  independents: '#9B4FD0',
  double: '#D69A2D',
} as const;

/** Classical capitals for titles (Cinzel, OFL), loaded only where the game needs them. */
export function useDubaiFonts(): boolean {
  const [loaded] = useFonts({ Cinzel_600SemiBold, Cinzel_700Bold, Cinzel_900Black });
  return loaded;
}

export const serif = (loaded: boolean, weight: '600' | '700' | '900' = '700') =>
  loaded ? { fontFamily: weight === '900' ? 'Cinzel_900Black' : weight === '600' ? 'Cinzel_600SemiBold' : 'Cinzel_700Bold' } : { fontWeight: weight as '600' | '700' | '900' };

export type Faction = 'expats' | 'escrocs' | 'independents' | 'double';

/** The faction a Dubaï card shows (the Networker is an Expat with a personal goal: Double Jeu). */
export const factionOf = (id: DubaiCardId): Faction =>
  id === 'escroc' || id === 'realtor' || id === 'broker'
    ? 'escrocs'
    : id === 'charo' || id === 'fake_millionaire'
      ? 'independents'
      : id === 'networker'
        ? 'double'
        : 'expats';

export const FACTION_NAME: Record<Faction, string> = { expats: 'Expats', escrocs: 'Escrocs', independents: 'Independents', double: 'Double Game' };
/** The faction's name as shown: « Expats » and « Escrocs » are the game's own words, the same in every language. */
export const factionLabel = (f: Faction, tr: (s: string) => string): string => (f === 'expats' ? 'Expats' : f === 'escrocs' ? 'Escrocs' : tr(FACTION_NAME[f]));

export const FACTION_COLOR: Record<Faction, string> = { expats: DX.expats, escrocs: DX.escrocs, independents: DX.independents, double: DX.double };

/** The faction's emblem, drawn (no emoji): people, a mask, a diamond, scales. */
export const FactionGlyph = memo(function FactionGlyph({ faction, size = 22, color = DX.gold }: { faction: Faction; size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {faction === 'expats' ? (
        <>
          <Circle cx={12} cy={8} r={3.2} />
          <Path d="M5.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
          <Circle cx={5} cy={10} r={2.2} />
          <Circle cx={19} cy={10} r={2.2} />
        </>
      ) : faction === 'escrocs' ? (
        <>
          <Path d="M3 9c2.5-1.6 5.5-1.8 9-1.8S18.5 7.4 21 9c-.3 4.2-2.7 7-5.4 7-1.6 0-2.5-1-3.6-2.4C10.9 15 10 16 8.4 16 5.7 16 3.3 13.2 3 9z" />
          <Path d="M7 11h2.5M14.5 11H17" />
        </>
      ) : faction === 'independents' ? (
        <>
          <Path d="M6 4h12l3 5-9 11L3 9z" />
          <Path d="M3 9h18M9 4l3 16 3-16" />
        </>
      ) : (
        <>
          <Path d="M12 4v16M7 20h10M4 8h16" />
          <Path d="M4 8l-2.5 6h5zM20 8l-2.5 6h5z" />
        </>
      )}
    </Svg>
  );
});
