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

export const palettes: Record<Mode, Palette> = {
  night: {
    bg: '#08080C',
    surface: '#111117',
    raised: '#18181F',
    overlay: '#22222B',
    glass: 'rgba(17,17,23,0.62)',
    line: 'rgba(255,255,255,0.07)',
    lineStrong: 'rgba(255,255,255,0.14)',
    text: '#F4F3F8',
    textSecondary: 'rgba(244,243,248,0.66)',
    textTertiary: 'rgba(244,243,248,0.42)',
    onDark: '#FFFFFF',
    brand: '#8B6CFF',
    brandPressed: '#7A59F5',
    brandSoft: 'rgba(139,108,255,0.16)',
    onBrand: '#FFFFFF',
    live: '#FF6A4D',
    liveSoft: 'rgba(255,106,77,0.16)',
    positive: '#3DDC97',
    positiveSoft: 'rgba(61,220,151,0.14)',
    caution: '#FFC15E',
    critical: '#FF5D6C',
    scrim: 'rgba(4,4,8,0.62)',
    shadow: 'rgba(0,0,0,0.45)',
  },
  day: {
    bg: '#F5F4F0',
    surface: '#FFFFFF',
    raised: '#FFFFFF',
    overlay: '#EEECE6',
    glass: 'rgba(255,255,255,0.72)',
    line: 'rgba(12,11,20,0.07)',
    lineStrong: 'rgba(12,11,20,0.14)',
    text: '#0C0B14',
    textSecondary: 'rgba(12,11,20,0.62)',
    textTertiary: 'rgba(12,11,20,0.42)',
    onDark: '#FFFFFF',
    brand: '#6A4CF5',
    brandPressed: '#5A3DE6',
    brandSoft: 'rgba(106,76,245,0.10)',
    onBrand: '#FFFFFF',
    live: '#F2542D',
    liveSoft: 'rgba(242,84,45,0.12)',
    positive: '#12A86B',
    positiveSoft: 'rgba(18,168,107,0.12)',
    caution: '#C98500',
    critical: '#E23B4E',
    scrim: 'rgba(12,11,20,0.36)',
    shadow: 'rgba(22,16,60,0.12)',
  },
};

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
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
} as const;

/** Font families, loaded once in the root layout. */
export const font = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

export type TypeVariant =
  | 'displayXL'
  | 'displayL'
  | 'displayM'
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
 * Type scale. Instrument Serif carries the editorial, human moments
 * (greetings, destinations); Manrope carries the interface.
 */
export const type: Record<TypeVariant, TypeStyle> = {
  displayXL: { fontFamily: font.serif, fontSize: 46, lineHeight: 48, letterSpacing: -0.6 },
  displayL: { fontFamily: font.serif, fontSize: 36, lineHeight: 40, letterSpacing: -0.4 },
  displayM: { fontFamily: font.serif, fontSize: 28, lineHeight: 32, letterSpacing: -0.2 },
  titleL: { fontFamily: font.heavy, fontSize: 24, lineHeight: 30, letterSpacing: -0.6 },
  titleM: { fontFamily: font.bold, fontSize: 19, lineHeight: 25, letterSpacing: -0.35 },
  titleS: { fontFamily: font.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  bodyL: { fontFamily: font.medium, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 22 },
  bodyS: { fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
  caption: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: font.heavy, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: 'uppercase' },
  number: { fontFamily: font.heavy, fontSize: 22, lineHeight: 26, letterSpacing: -0.8 },
};

/** Elevation, expressed as CSS box-shadow strings (New Architecture). */
export const elevation = {
  night: {
    card: '0px 10px 30px rgba(0, 0, 0, 0.32)',
    float: '0px 18px 48px rgba(0, 0, 0, 0.5)',
    glow: '0px 10px 32px rgba(139, 108, 255, 0.42)',
  },
  day: {
    card: '0px 8px 24px rgba(22, 16, 60, 0.07)',
    float: '0px 18px 44px rgba(22, 16, 60, 0.14)',
    glow: '0px 10px 30px rgba(106, 76, 245, 0.32)',
  },
} as const;

/** Layout constants shared by navigation chrome. */
export const layout = {
  tabBarHeight: 64,
  tabBarBottomGap: 14,
  headerHeight: 52,
  maxContentWidth: 560,
} as const;
