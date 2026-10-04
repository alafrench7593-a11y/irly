/**
 * Destination lights.
 *
 * IRLY is one product with a different light in every city. A light is a
 * small palette taken from the city's real photography: it tints the
 * accents, the destination pill, the map and the loading state behind
 * photos. Core UI colours (brand, text, surfaces) never change between
 * destinations, so the identity stays recognisable.
 */

export type Light = {
  id: string;
  /** Four tones sampled from the city at dusk, top to bottom. */
  sky: [string, string, string, string];
  /** Readable accent on dark surfaces. */
  accent: string;
  /** Accent used on light (day) surfaces. */
  accentDay: string;
  accentSoft: string;
};

export const lights = {
  dubai: {
    id: 'dubai',
    sky: ['#120D2B', '#3A1C5A', '#B44669', '#F59B6B'],
    accent: '#FFAD80',
    accentDay: '#D9622E',
    accentSoft: 'rgba(255,173,128,0.16)',
  },
  abudhabi: {
    id: 'abudhabi',
    sky: ['#0A1A2C', '#114560', '#2B9E9A', '#EAD7B2'],
    accent: '#6FD8CB',
    accentDay: '#14837A',
    accentSoft: 'rgba(111,216,203,0.16)',
  },
  sharjah: {
    id: 'sharjah',
    sky: ['#1A0E14', '#5A2330', '#C2603E', '#F2C9A0'],
    accent: '#F59A72',
    accentDay: '#B5502C',
    accentSoft: 'rgba(245,154,114,0.16)',
  },
  ajman: {
    id: 'ajman',
    sky: ['#061C26', '#0E4C5C', '#3AA2B2', '#F5E2C2'],
    accent: '#74D3DE',
    accentDay: '#167C8A',
    accentSoft: 'rgba(116,211,222,0.16)',
  },
  rak: {
    id: 'rak',
    sky: ['#0E1522', '#2C3850', '#9A6B5B', '#E9BBA2'],
    accent: '#E9AA90',
    accentDay: '#A85A3E',
    accentSoft: 'rgba(233,170,144,0.16)',
  },
  fujairah: {
    id: 'fujairah',
    sky: ['#06181D', '#0E4545', '#4A8E7A', '#D8E8CF'],
    accent: '#82D8B8',
    accentDay: '#1F8462',
    accentSoft: 'rgba(130,216,184,0.16)',
  },
  uaq: {
    id: 'uaq',
    sky: ['#071812', '#143D2D', '#3C8868', '#CCE6D3'],
    accent: '#93E2BB',
    accentDay: '#23845A',
    accentSoft: 'rgba(147,226,187,0.16)',
  },
  bali: {
    id: 'bali',
    sky: ['#051D17', '#0E4A38', '#2C9E82', '#F8C99A'],
    accent: '#62E2B2',
    accentDay: '#0F8A62',
    accentSoft: 'rgba(98,226,178,0.16)',
  },
  thailand: {
    id: 'thailand',
    sky: ['#1A0B1C', '#5B1F4B', '#D2557A', '#FFC48F'],
    accent: '#FF9BB4',
    accentDay: '#C13A66',
    accentSoft: 'rgba(255,155,180,0.16)',
  },
  singapore: {
    id: 'singapore',
    sky: ['#071423', '#123A63', '#3F7FBF', '#BFE3F2'],
    accent: '#8CC8FF',
    accentDay: '#2A6DB0',
    accentSoft: 'rgba(140,200,255,0.16)',
  },
  london: {
    id: 'london',
    sky: ['#0D1016', '#2A3140', '#6E7A92', '#D7DCE6'],
    accent: '#B6C2DA',
    accentDay: '#4A5878',
    accentSoft: 'rgba(182,194,218,0.16)',
  },
  paris: {
    id: 'paris',
    sky: ['#120E1E', '#34284F', '#8C6C9E', '#F1D3C4'],
    accent: '#D8B4F0',
    accentDay: '#7A4A9C',
    accentSoft: 'rgba(216,180,240,0.16)',
  },
} satisfies Record<string, Light>;

export type LightId = keyof typeof lights;
