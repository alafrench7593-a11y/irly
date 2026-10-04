/**
 * IRLY Design System: foundation tokens.
 *
 * Every visual decision in the app resolves to one of these values.
 * Screens never hardcode colours, sizes or radii: they read tokens
 * through `useTheme()` so a destination or a time of day can restyle
 * the whole product at once.
 */

export type Mode = 'night' | 'day';

export type Palette = {
  /** App background. */
  bg: string;
  /** Default card / list surface. */
  surface: string;
  /** Raised surface: sheets, popovers, selected cards. */
  raised: string;
  /** Overlay surface used inside raised elements. */
  overlay: string;
  /** Translucent tint painted under blurred glass. */
  glass: string;
  line: string;
  lineStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  /** Text and icons placed on brand or photo backgrounds. */
  onDark: string;
  brand: string;
  brandPressed: string;
  brandSoft: string;
  onBrand: string;
  /** "Happening now": the colour of real life. */
  live: string;
  liveSoft: string;
  positive: string;
  positiveSoft: string;
  caution: string;
  critical: string;
  scrim: string;
  shadow: string;
};

/**
 * IRLY v4 is light. Off-white ground, white cards, translucent glass over
 * photos and the map, and black for the logo, strong titles and the main
 * action. Colour only on categories, statuses and actions. `night` is kept
 * is the immersive palette used before onboarding is done (full-bleed
 * photos with white text and glass).
 */
const light: Palette = {
  bg: '#F6F6F4',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  overlay: '#EDEDEA',
  glass: 'rgba(255,255,255,0.72)',
  line: 'rgba(10,10,10,0.07)',
  lineStrong: 'rgba(10,10,10,0.13)',
  text: '#0A0A0A',
  textSecondary: '#5E5E5E',
  textTertiary: '#8E8E8E',
  onDark: '#FFFFFF',
  brand: '#0A0A0A',
  brandPressed: '#262626',
  brandSoft: 'rgba(10,10,10,0.06)',
  onBrand: '#FFFFFF',
  live: '#FF3B30',
  liveSoft: 'rgba(255,59,48,0.12)',
  positive: '#1F9D45',
  positiveSoft: 'rgba(52,199,89,0.14)',
  caution: '#D97A00',
  critical: '#E5352B',
  scrim: 'rgba(10,10,10,0.32)',
  shadow: 'rgba(10,10,10,0.12)',
};
/**
 * Immersive palette: onboarding and other photo-led screens, where the
 * interface floats over a full-bleed photograph (white text, glass).
 */
const night: Palette = {
  bg: '#000000',
  surface: '#0D0D0D',
  raised: '#1A1A1A',
  overlay: '#262626',
  glass: 'rgba(255,255,255,0.12)',
  line: 'rgba(255,255,255,0.10)',
  lineStrong: 'rgba(255,255,255,0.18)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.72)',
  textTertiary: 'rgba(255,255,255,0.5)',
  onDark: '#FFFFFF',
  brand: '#FFFFFF',
  brandPressed: '#E6E6E6',
  brandSoft: 'rgba(255,255,255,0.14)',
  onBrand: '#0A0A0A',
  live: '#FF453A',
  liveSoft: 'rgba(255,69,58,0.18)',
  positive: '#32D74B',
  positiveSoft: 'rgba(50,215,75,0.16)',
  caution: '#FF9F0A',
  critical: '#FF453A',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: 'rgba(0,0,0,0.5)',
};

export const palettes: Record<Mode, Palette> = { night, day: light };

/**
 * Category and status colours. Used on an icon, a dot or a halo, never as
 * a background fill.
 */
export const category = {
  sport: '#34C759',
  food: '#FF9500',
  coffee: '#A2845E',
  padel: '#32ADE6',
  beach: '#F2B600',
  nightlife: '#AF52DE',
  travel: '#007AFF',
  wellness: '#30B0C7',
  activities: '#FF2D55',
  dogwalk: '#C69C6D',
  business: '#5E5E5E',
  culture: '#FF2D55',
  networking: '#5856D6',
  shopping: '#FF6482',
  events: '#FF3B30',
} as const;
export type CategoryId = keyof typeof category;

export const status = {
  live: '#FF3B30',
  availableNow: '#34C759',
  availableLater: '#FF9500',
} as const;

/** 4-pt spacing scale. `gutter` is the screen side padding. */
export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 8,
  4: 12,
  5: 16,
  6: 20,
  7: 24,
  8: 32,
  9: 40,
  10: 56,
  11: 72,
  gutter: 20,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  /** Cards. */
  xl: 28,
  /** Large cards and the top of sheets. */
  xxl: 32,
  pill: 999,
} as const;

/** Font families, loaded once in the root layout. */
export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
  /** v3 has a single family: the former serif slots resolve to Manrope. */
  serif: 'Manrope_800ExtraBold',
  serifItalic: 'Manrope_800ExtraBold',
} as const;

export type TypeVariant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
  | 'cardTitle'
  | 'titleL'
  | 'titleM'
  | 'titleS'
  | 'bodyL'
  | 'body'
  | 'bodyS'
  | 'label'
  | 'caption'
  | 'overline'
  | 'number';

type TypeStyle = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
};

/**
 * Type scale. One family, Manrope. Display is reserved for the one big
 * question of a screen ("What's happening today?"); card titles on photos
 * are set in capitals.
 */
export const type: Record<TypeVariant, TypeStyle> = {
  displayXL: { fontFamily: font.heavy, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  displayL: { fontFamily: font.heavy, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
  displayM: { fontFamily: font.heavy, fontSize: 26, lineHeight: 30, letterSpacing: -0.4 },
  /** Title of a large photo card: « PADEL TONIGHT ». */
  cardTitle: { fontFamily: font.heavy, fontSize: 26, lineHeight: 28, letterSpacing: -0.2, textTransform: 'uppercase' },
  titleL: { fontFamily: font.heavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  titleM: { fontFamily: font.bold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3 },
  titleS: { fontFamily: font.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  bodyL: { fontFamily: font.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  bodyS: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: font.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' },
  number: { fontFamily: font.heavy, fontSize: 22, lineHeight: 26, letterSpacing: -0.8 },
};

/**
 * Elevation. On a light ground, soft wide shadows give floating surfaces
 * (cards, glass bars, sheets) a physical presence.
 */
const shadows = {
  card: '0px 8px 24px rgba(10, 10, 10, 0.06)',
  float: '0px 18px 48px rgba(10, 10, 10, 0.14)',
  glow: '0px 10px 30px rgba(10, 10, 10, 0.18)',
};
export const elevation = { night: shadows, day: shadows } as const;

/** Layout constants shared by navigation chrome. */
export const layout = {
  tabBarHeight: 68,
  tabBarBottomGap: 16,
  headerHeight: 52,
  maxContentWidth: 560,
} as const;
