import { memo } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { City, MapArt as MapArtKind } from '@/data/types';
import type { Mode } from '@/theme/tokens';

/**
 * IRLY's own cartography: a calm, stylised map per city. Coastlines and
 * main roads only, so markers (people, plans, places) are the loudest
 * thing on screen. Drawn in a 1000×1000 space; area points are 0..1.
 */

type Shapes = {
  /** Water shapes (sea, creeks, lagoons). */
  water: string[];
  /** Land shapes drawn on top of the water (islands, palms). */
  land: string[];
  roads: string[];
  /** Thin water strokes (creeks, canals). */
  canals: string[];
};

const SHAPES: Record<MapArtKind, Shapes> = {
  dubai: {
    water: [
      // Arabian Gulf: everything north-west of the coastline
      'M0 0H1000V150L940 196L900 222L860 246Q820 262 780 286L700 336Q640 370 580 398L500 446Q440 482 380 512L300 560L240 600L160 650L80 700L0 760Z',
      // Ras Al Khor lagoon
      'M900 470Q935 450 960 478Q972 506 944 520Q910 528 896 500Z',
    ],
    land: [
      // Palm Jumeirah: trunk, fronds and crescent
      'M296 600L282 590L196 470L206 462Z',
      'M250 540L170 548L172 556L254 548Z M240 524L162 516L164 524L244 532Z M228 506L160 484L163 476L232 498Z M264 556L196 590L200 597L268 563Z M216 490L170 450L176 445L222 485Z',
      'M150 440Q130 520 170 590L178 586Q144 522 162 446Z',
      // World islands, hinted
      'M380 300h12v8h-12z M404 292h10v10h-10z M424 302h12v8h-12z M396 316h14v9h-14z M420 318h10v8h-10z',
    ],
    canals: [
      // Dubai Creek
      'M872 236Q900 300 916 360Q926 420 920 470',
      // Dubai Water Canal
      'M918 478Q820 470 740 452Q660 430 600 410',
      // Marina channel
      'M214 668Q236 700 232 740',
    ],
    roads: [
      // Sheikh Zayed Road
      'M890 330Q760 410 640 470Q500 540 360 620Q240 690 60 800',
      // Al Khail Road
      'M960 520Q820 590 700 640Q560 700 420 770Q300 830 160 900',
      // Emirates Road
      'M1000 700Q860 780 720 840Q600 890 460 960',
      // Al Qudra road
      'M560 640Q580 760 600 920',
    ],
  },
  abudhabi: {
    water: ['M0 0H1000V1000H0Z'],
    land: [
      // Mainland
      'M0 640Q160 600 320 620Q480 640 600 580Q720 520 820 560Q920 600 1000 560V1000H0Z',
      // Abu Dhabi island
      'M120 420L300 280L500 200L580 260L660 400L520 520L300 600L140 560Z',
      // Al Reem
      'M580 290L680 280L690 370L600 380Z',
      // Al Maryah
      'M530 350L570 345L575 400L535 405Z',
      // Saadiyat
      'M560 80L800 70L810 200L590 220Z',
      // Yas
      'M780 300L940 290L950 470L790 480Z',
    ],
    canals: ['M660 400Q700 460 780 480'],
    roads: [
      'M160 520Q330 420 520 340Q600 300 690 330',
      'M520 520Q620 600 760 640Q880 680 1000 700',
      'M690 330Q760 360 860 380',
      'M620 210Q650 260 650 300',
    ],
  },
  coast: {
    water: [
      'M0 0H1000V250Q860 300 720 272Q580 246 440 288Q300 330 160 300Q80 284 0 296Z',
      // Lagoon
      'M640 330Q700 300 760 330Q790 360 750 380Q690 396 650 372Q624 352 640 330Z',
    ],
    land: [
      // Offshore island
      'M200 210Q236 196 268 214Q280 236 248 246Q212 250 198 232Z',
    ],
    canals: ['M440 288Q470 340 520 380'],
    roads: [
      'M0 420Q250 380 500 410Q750 440 1000 400',
      'M480 400Q500 600 560 800Q590 900 600 1000',
      'M0 680Q300 640 620 700Q820 740 1000 720',
    ],
  },
  bali: {
    water: ['M0 0H1000V1000H0Z'],
    land: [
      // South Bali and the Bukit peninsula
      'M0 0H1000V400L900 480L800 560L720 630L640 660L560 700L540 740L530 760L580 800L620 860L580 950L450 980L320 960L300 900L360 840L440 770L450 720L430 680L380 610L310 530L240 470L180 400L100 300L0 180Z',
      // Nusa Penida, hinted
      'M860 860Q920 840 960 880Q970 920 920 930Q870 930 856 900Z',
    ],
    canals: [
      // Benoa bay
      'M560 700Q600 720 600 760',
    ],
    roads: [
      'M300 500Q420 520 550 550',
      'M550 550Q590 400 640 200',
      'M550 550Q540 650 530 760Q560 820 600 880',
      'M550 550Q640 600 720 630',
      'M640 200Q760 160 900 120',
    ],
  },
};

type Props = {
  city: City;
  mode: Mode;
  width: number;
  height: number;
  /** Crop to a window of the 1000×1000 canvas (mini maps). */
  viewBox?: string;
  showAreas?: boolean;
};

export const MAP_SIZE = 1000;

/**
 * "IRLY Night": black land, anthracite water, dark grey roads, so the
 * markers (people, plans, places) are the only colour on screen. The same
 * palette is used for the Google vector style (Map ID "IRLY Night").
 */
export const MapArt = memo(function MapArt({ city, mode, width, height, viewBox, showAreas = true }: Props) {
  void mode;
  const shapes = SHAPES[city.map];
  const land = '#070707';
  const landEdge = 'rgba(255,255,255,0.10)';
  const road = '#262626';
  const waterTop = '#1B1B1D';
  const waterBottom = '#151517';
  const night = true;
  const isSeaFirst = city.map === 'abudhabi' || city.map === 'bali';

  return (
    <Svg width={width} height={height} viewBox={viewBox ?? `0 0 ${MAP_SIZE} ${MAP_SIZE}`} preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`water-${city.id}`} x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={waterTop} stopOpacity={night ? 0.95 : 1} />
          <Stop offset="1" stopColor={waterBottom} stopOpacity={night ? 0.7 : 1} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} fill={isSeaFirst ? `url(#water-${city.id})` : land} />
      {!isSeaFirst ? shapes.water.map((d, i) => <Path key={`w${i}`} d={d} fill={`url(#water-${city.id})`} />) : null}
      {shapes.land.map((d, i) => (
        <Path key={`l${i}`} d={d} fill={land} stroke={landEdge} strokeWidth={2} />
      ))}
      {isSeaFirst ? shapes.water.slice(1).map((d, i) => <Path key={`w2${i}`} d={d} fill={`url(#water-${city.id})`} />) : null}
      {shapes.canals.map((d, i) => (
        <Path key={`c${i}`} d={d} stroke={waterBottom} strokeOpacity={night ? 0.9 : 1} strokeWidth={9} fill="none" strokeLinecap="round" />
      ))}
      <G>
        {shapes.roads.map((d, i) => (
          <Path key={`r${i}`} d={d} stroke={road} strokeWidth={i === 0 ? 7 : 5} fill="none" strokeLinecap="round" />
        ))}
      </G>
      {showAreas
        ? city.areas.map((a) => (
            <Circle key={a.id} cx={a.point.x * MAP_SIZE} cy={a.point.y * MAP_SIZE} r={70} fill="#FFFFFF" opacity={0.025} />
          ))
        : null}
    </Svg>
  );
});
