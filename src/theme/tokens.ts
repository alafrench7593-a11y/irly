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
  /** Steel blue of the IRLY light (logo gradient): the one quiet accent. */
  steel: string;
  /**
   * Card laid on a page that may have a photo behind it (detail pages sit
   * on the blurred photo of the place): translucent on IRLY Noir.
   */
  card: string;
};

/**
 * IRLY Clair: off-white ground, white cards, black for the logo and the
 * main action. Kept as the "Light" appearance setting; IRLY Noir (below)
 * is the default since v5.
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
  steel: '#5E7A99',
  card: '#FFFFFF',
};
/**
 * IRLY Noir (v5, default): the screen of the logo. Near-black ground with
 * a hint of blue, surfaces that step up in quiet greys, glass over photos,
 * white for the one main action. Photography brings the colour.
 */
const night: Palette = {
  bg: '#050506',
  surface: '#0E0F12',
  raised: '#16181C',
  overlay: '#202227',
  glass: 'rgba(20,22,26,0.46)',
  line: 'rgba(255,255,255,0.08)',
  lineStrong: 'rgba(255,255,255,0.15)',
  text: '#FFFFFF',
  textSecondary: 'rgba(236,239,244,0.68)',
  textTertiary: 'rgba(236,239,244,0.44)',
  onDark: '#FFFFFF',
  brand: '#FFFFFF',
  brandPressed: '#E4E7EC',
  brandSoft: 'rgba(255,255,255,0.10)',
  onBrand: '#050506',
  live: '#FF453A',
  liveSoft: 'rgba(255,69,58,0.16)',
  positive: '#32D74B',
  positiveSoft: 'rgba(50,215,75,0.14)',
  caution: '#FF9F0A',
  critical: '#FF453A',
  scrim: 'rgba(0,0,0,0.62)',
  shadow: 'rgba(0,0,0,0.6)',
  steel: '#8EA5BF',
  card: 'rgba(255,255,255,0.055)',
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
  /** Hero statements over photos: « PEOPLE. PLACES. REAL LIFE. » */
  displayXL: { fontFamily: font.heavy, fontSize: 46, lineHeight: 48, letterSpacing: -1.4 },
  /** The one big question of a screen. */
  displayL: { fontFamily: font.heavy, fontSize: 36, lineHeight: 40, letterSpacing: -1 },
  displayM: { fontFamily: font.heavy, fontSize: 28, lineHeight: 32, letterSpacing: -0.6 },
  /** Title of a large photo card: « PADEL TONIGHT ». */
  cardTitle: { fontFamily: font.heavy, fontSize: 28, lineHeight: 30, letterSpacing: -0.4, textTransform: 'uppercase' },
  titleL: { fontFamily: font.heavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
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
 * Elevation. On the light ground, soft wide shadows. On IRLY Noir a shadow
 * barely reads, so depth comes from glass, lighter surfaces and a faint
 * white glow under the main action.
 */
const dayShadows = {
  card: '0px 8px 24px rgba(10, 10, 10, 0.06)',
  float: '0px 18px 48px rgba(10, 10, 10, 0.14)',
  glow: '0px 10px 30px rgba(10, 10, 10, 0.18)',
};
const nightShadows = {
  card: '0px 14px 34px rgba(0, 0, 0, 0.42)',
  float: '0px 26px 64px rgba(0, 0, 0, 0.62)',
  glow: '0px 8px 28px rgba(255, 255, 255, 0.16)',
};
export const elevation = { night: nightShadows, day: dayShadows } as const;

/**
 * Glass, in three thicknesses. Glass says "this floats above that": use it
 * for chrome (bars, controls, sheets) and for panels laid over a photo,
 * never for everything.
 * - thin: chips and small controls on photos
 * - regular: cards and panels over a photo or the blurred backdrop
 * - thick: bars, sheets and menus that hold their own content
 */
export const glassLevels = {
  thin: { blur: 30, night: 'rgba(255,255,255,0.08)', day: 'rgba(255,255,255,0.55)' },
  regular: { blur: 55, night: 'rgba(22,24,28,0.42)', day: 'rgba(255,255,255,0.72)' },
  thick: { blur: 80, night: 'rgba(14,15,18,0.66)', day: 'rgba(255,255,255,0.86)' },
} as const;
export type GlassLevel = keyof typeof glassLevels;

/** Layout constants shared by navigation chrome. */
export const layout = {
  tabBarHeight: 68,
  tabBarBottomGap: 16,
  headerHeight: 52,
  maxContentWidth: 560,
} as const;
