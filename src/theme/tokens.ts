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
 * IRLY Girl, as a palette of the same design system: the shared components
 * (buttons, chips, fields, glass, sheets, pages) render in it inside IRLY
 * Girl. Values come from features/girl/theme: a rosy-pearl ground, plum ink,
 * a deep luminous rose for text and filled controls, bordeaux for errors.
 * Small text is 4.5:1 or better on the pearl glass (measured, WCAG).
 */
export const girlPalette: Palette = {
  bg: '#FBF2F4',
  surface: '#FFFFFF',
  raised: '#FFFFFF',
  overlay: '#F6E4EB',
  glass: 'rgba(255,249,251,0.72)',
  line: 'rgba(74,36,64,0.10)',
  lineStrong: 'rgba(74,36,64,0.18)',
  text: '#2F1B29',
  textSecondary: '#6F5A67',
  textTertiary: '#86707D',
  onDark: '#FFFFFF',
  brand: '#B92B69',
  brandPressed: '#9E2358',
  brandSoft: 'rgba(185,43,105,0.10)',
  onBrand: '#FFFFFF',
  live: '#E5352B',
  liveSoft: 'rgba(229,53,43,0.12)',
  positive: '#2B7F55',
  positiveSoft: 'rgba(43,127,85,0.14)',
  caution: '#B05F00',
  critical: '#8E1F45',
  scrim: 'rgba(36,18,30,0.46)',
  shadow: 'rgba(74,36,64,0.14)',
  steel: '#9C7088',
  card: '#FFFFFF',
};

/**
 * IRLY Network inside IRLY Girl: the one violet place of the app. Same
 * roles as girlPalette, violet and lavender instead of rose; the rest of
 * IRLY Girl (and the website) keeps its rose. Read through <NetworkScope>.
 * Contrast (WCAG): brand 5.5:1 on the ground and 6:1 under white text,
 * text 15.5:1, secondary 6.7:1, tertiary 4.75:1.
 */
export const networkGirlPalette: Palette = {
  ...girlPalette,
  bg: '#F6F2FF',
  overlay: '#ECE6FF',
  glass: 'rgba(250,247,255,0.72)',
  line: 'rgba(45,29,84,0.10)',
  lineStrong: 'rgba(45,29,84,0.18)',
  text: '#211634',
  textSecondary: '#5B5072',
  textTertiary: '#71678A',
  brand: '#6A3BEE',
  brandPressed: '#5A2FD6',
  brandSoft: 'rgba(106,59,238,0.10)',
  scrim: 'rgba(22,14,46,0.46)',
  shadow: 'rgba(45,29,84,0.14)',
  steel: '#8A7FB0',
};

/** The violet glass of IRLY Network in IRLY Girl (same recipe as girlGlass). */
export const networkGirlGlass: typeof girlGlass = {
  card: { blur: 40, tint: 'rgba(251,249,255,0.56)', fallback: 'rgba(249,246,255,0.95)', rim: 'rgba(255,255,255,0.78)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.50)' },
  chip: { blur: 28, tint: 'rgba(251,249,255,0.60)', fallback: 'rgba(249,246,255,0.95)', rim: 'rgba(255,255,255,0.85)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.55)' },
  field: { blur: 28, tint: 'rgba(253,252,255,0.70)', fallback: 'rgba(251,250,255,0.97)', rim: 'rgba(255,255,255,0.85)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.45)' },
  bar: { blur: 50, tint: 'rgba(244,240,255,0.62)', fallback: 'rgba(245,242,255,0.96)', rim: 'rgba(255,255,255,0.70)', light: 'rgba(255,255,255,0.95)', sheen: 'rgba(255,255,255,0.40)' },
  sheet: { blur: 70, tint: 'rgba(250,248,255,0.86)', fallback: 'rgba(250,248,255,0.98)', rim: 'rgba(255,255,255,0.90)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.55)' },
  plum: { blur: 40, tint: 'rgba(30,20,62,0.86)', fallback: 'rgba(30,20,62,0.96)', rim: 'rgba(201,182,255,0.24)', light: 'rgba(220,208,255,0.55)', sheen: 'rgba(255,255,255,0.10)', dark: true },
};
export const networkGirlNacre = ['rgba(214,200,255,0.30)', 'rgba(204,226,255,0.20)', 'rgba(236,222,255,0.24)'] as const;

/** The violet accents of IRLY Network in IRLY Girl (buttons, selected chips, panels). */
export const networkGirl = {
  gradient: ['#8B5CF6', '#6A3BEE', '#5A2FD6'] as const,
  plum: '#2D1D54',
  plumGradient: ['#3A2670', '#2D1D54', '#1E1340'] as const,
  pearl: '#FAF7FF',
  lilac: '#C9B6FF',
  glow: '0px 10px 28px rgba(106,59,238,0.32)',
};


/**
 * IRLY Girl glass, one recipe per role. Each pane is a live blur, a tint,
 * a thin nacre rim, a pearl light along its top edge and a soft sheen;
 * Android (no live blur) paints `fallback` instead, dense enough to read on.
 * - card: content panes, translucent so the rose light behind shows through
 * - chip: chips and small controls, a touch lighter
 * - field: text fields, whiter so typed text keeps its contrast
 * - bar: floating and navigation bars, translucent like the ground
 * - sheet: sheets and modals, the densest pearl
 * - plum: the dark plum glass of secondary actions and contrast panels
 */
export type GirlGlassVariant = 'card' | 'chip' | 'field' | 'bar' | 'sheet' | 'plum';
export const girlGlass: Record<GirlGlassVariant, { blur: number; tint: string; fallback: string; rim: string; light: string; sheen: string; dark?: boolean }> = {
  card: { blur: 40, tint: 'rgba(255,250,252,0.56)', fallback: 'rgba(255,248,250,0.95)', rim: 'rgba(255,255,255,0.78)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.50)' },
  chip: { blur: 28, tint: 'rgba(255,250,252,0.60)', fallback: 'rgba(255,248,250,0.95)', rim: 'rgba(255,255,255,0.85)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.55)' },
  field: { blur: 28, tint: 'rgba(255,252,253,0.70)', fallback: 'rgba(255,250,252,0.97)', rim: 'rgba(255,255,255,0.85)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.45)' },
  bar: { blur: 50, tint: 'rgba(252,242,246,0.62)', fallback: 'rgba(252,244,247,0.96)', rim: 'rgba(255,255,255,0.70)', light: 'rgba(255,255,255,0.95)', sheen: 'rgba(255,255,255,0.40)' },
  sheet: { blur: 70, tint: 'rgba(255,248,250,0.86)', fallback: 'rgba(255,248,250,0.98)', rim: 'rgba(255,255,255,0.90)', light: 'rgba(255,255,255,1)', sheen: 'rgba(255,255,255,0.55)' },
  plum: { blur: 40, tint: 'rgba(46,18,38,0.86)', fallback: 'rgba(46,18,38,0.96)', rim: 'rgba(255,205,226,0.22)', light: 'rgba(255,222,236,0.55)', sheen: 'rgba(255,255,255,0.10)', dark: true },
};

/** Mother-of-pearl: rose, lavender and peach, barely there (glass, highlights). */
export const girlNacre = ['rgba(255,214,232,0.30)', 'rgba(236,224,250,0.20)', 'rgba(255,228,214,0.24)'] as const;

/**
 * IRLY Girl depth: diffuse plum-tinted shadows (never grey, never a hard
 * pink halo), and a rose glow reserved for the main action.
 */
export const girlElevation = {
  card: '0px 14px 34px rgba(74,36,64,0.10), 0px 2px 6px rgba(74,36,64,0.05)',
  float: '0px 24px 60px rgba(46,22,40,0.22), 0px 4px 14px rgba(46,22,40,0.08)',
  glow: '0px 12px 26px rgba(185,43,105,0.30), 0px 3px 8px rgba(122,31,61,0.20)',
  plum: '0px 12px 28px rgba(36,18,30,0.26), 0px 2px 6px rgba(36,18,30,0.14)',
} as const;

/** Editorial serif of IRLY Girl (Instrument Serif, bundled), for titles. */
export const girlSerif = {
  regular: 'InstrumentSerif_400Regular',
  italic: 'InstrumentSerif_400Regular_Italic',
} as const;

/**
 * Ambient light: the soft glows painted once behind every screen so glass
 * has something to refract (a frosted pane over a flat colour reads as a
 * flat colour). Three glows per flavor and mode, never animated in a loop.
 */
export const ambient = {
  mixte: {
    night: { base: '#050506', glows: ['rgba(110,142,180,0.62)', 'rgba(88,86,214,0.42)', 'rgba(196,140,92,0.30)'] },
    day: { base: '#F4F4F1', glows: ['rgba(142,165,191,0.42)', 'rgba(190,200,230,0.40)', 'rgba(240,214,190,0.40)'] },
  },
  // IRLY Girl: luminous rose, a warm nude and a plum-lavender, on a pearl ground.
  girl: {
    night: { base: '#FBF2F4', glows: ['rgba(232,76,140,0.34)', 'rgba(240,206,188,0.80)', 'rgba(176,132,190,0.34)'] },
    day: { base: '#FBF2F4', glows: ['rgba(232,76,140,0.34)', 'rgba(240,206,188,0.80)', 'rgba(176,132,190,0.34)'] },
  },
} as const;

/**
 * The light of IRLY Network pages: steel greys only in IRLY (Mixte), violet,
 * ice blue and lilac on a lavender ground in IRLY Girl.
 */
export const networkAmbient = {
  mixte: {
    night: { base: '#050506', glows: ['rgba(118,134,156,0.52)', 'rgba(86,94,110,0.44)', 'rgba(150,156,166,0.22)'] },
    day: { base: '#F4F4F2', glows: ['rgba(150,162,178,0.40)', 'rgba(196,202,212,0.44)', 'rgba(214,214,210,0.40)'] },
  },
  girl: {
    night: { base: '#F6F2FF', glows: ['rgba(124,77,255,0.30)', 'rgba(190,212,255,0.70)', 'rgba(176,140,240,0.36)'] },
    day: { base: '#F6F2FF', glows: ['rgba(124,77,255,0.30)', 'rgba(190,212,255,0.70)', 'rgba(176,140,240,0.36)'] },
  },
} as const;

/**
 * The surfaces of IRLY Network pages only: the glass of its cards, their
 * light and depth, the slow light drifting behind the page, portraits and
 * loaders. Two systems on one recipe:
 * - IRLY (Mixte): silver glass. Anthracite panes with a cool silver rim on
 *   IRLY Noir, milky off-white panes with a grey rim on IRLY Clair.
 * - IRLY Girl: lavender glass, a violet light, deep plum scrims.
 * Cards fake the glass (gradients and rims, no live blur) so long lists stay
 * smooth on any phone. Read through useNetworkTone(), never elsewhere.
 */
export type NetworkSurface = {
  /** Fill of a pane, top to bottom (translucent, the ambient light shows through). */
  pane: readonly [string, string];
  /** Thin rim of a pane, and its brighter top edge (light from above). */
  rim: string;
  rimTop: string;
  /** Sheen across the top half of a pane. */
  sheen: string;
  /** Light that blooms on a pane while a finger is on it. */
  press: string;
  /** Diffuse shadow of a card, and the deeper one of a hero (profile photo, contrast panel). */
  shadow: string;
  shadowHero: string;
  /** The two slow lights drifting behind the top of the page. */
  drift: readonly [string, string];
  /** Loading placeholders: the block and the glint that sweeps it. */
  skeleton: string;
  glint: string;
  /** Bottom scrim over a photo, so a name stays legible on any picture. */
  scrim: readonly [string, string];
  /** Behind a portrait without photo (or until it loads), and its initials. */
  portrait: readonly [string, string];
  initials: string;
  /** Resting filter chip: fill and line. */
  chip: string;
  chipLine: string;
};

export const networkSurface: { mixte: Record<Mode, NetworkSurface>; girl: NetworkSurface } = {
  mixte: {
    night: {
      pane: ['rgba(48,51,58,0.66)', 'rgba(20,22,26,0.74)'],
      rim: 'rgba(255,255,255,0.08)',
      rimTop: 'rgba(226,232,240,0.30)',
      sheen: 'rgba(255,255,255,0.055)',
      press: 'rgba(214,222,234,0.11)',
      shadow: '0px 18px 40px rgba(0,0,0,0.46), 0px 2px 6px rgba(0,0,0,0.32)',
      shadowHero: '0px 30px 72px rgba(0,0,0,0.62), 0px 4px 12px rgba(0,0,0,0.36)',
      drift: ['rgba(176,188,206,0.22)', 'rgba(120,130,146,0.18)'],
      skeleton: 'rgba(255,255,255,0.055)',
      glint: 'rgba(255,255,255,0.09)',
      scrim: ['rgba(5,5,6,0)', 'rgba(5,5,6,0.84)'],
      portrait: ['#2C2F36', '#15171B'],
      initials: 'rgba(236,240,246,0.88)',
      chip: 'rgba(255,255,255,0.06)',
      chipLine: 'rgba(255,255,255,0.13)',
    },
    day: {
      pane: ['rgba(255,255,255,0.86)', 'rgba(241,242,245,0.78)'],
      rim: 'rgba(16,20,28,0.075)',
      rimTop: 'rgba(255,255,255,1)',
      sheen: 'rgba(255,255,255,0.7)',
      press: 'rgba(110,122,140,0.09)',
      shadow: '0px 14px 34px rgba(28,32,40,0.08), 0px 2px 6px rgba(28,32,40,0.05)',
      shadowHero: '0px 26px 60px rgba(28,32,40,0.18), 0px 4px 12px rgba(28,32,40,0.08)',
      drift: ['rgba(148,160,178,0.30)', 'rgba(198,204,214,0.34)'],
      skeleton: 'rgba(28,32,40,0.06)',
      glint: 'rgba(255,255,255,0.8)',
      scrim: ['rgba(10,10,10,0)', 'rgba(10,10,10,0.74)'],
      portrait: ['#E6E8EC', '#CED2D8'],
      initials: '#3A3E46',
      chip: 'rgba(255,255,255,0.72)',
      chipLine: 'rgba(16,20,28,0.09)',
    },
  },
  girl: {
    pane: ['rgba(255,255,255,0.82)', 'rgba(242,236,255,0.72)'],
    rim: 'rgba(106,59,238,0.11)',
    rimTop: 'rgba(255,255,255,1)',
    sheen: 'rgba(255,255,255,0.66)',
    press: 'rgba(139,92,246,0.11)',
    shadow: '0px 16px 38px rgba(45,29,84,0.11), 0px 2px 6px rgba(45,29,84,0.06)',
    shadowHero: '0px 28px 64px rgba(45,29,84,0.24), 0px 4px 12px rgba(45,29,84,0.10)',
    drift: ['rgba(139,92,246,0.24)', 'rgba(186,208,255,0.44)'],
    skeleton: 'rgba(106,59,238,0.07)',
    glint: 'rgba(255,255,255,0.88)',
    scrim: ['rgba(30,19,64,0)', 'rgba(30,19,64,0.80)'],
    portrait: ['#EAE2FF', '#CBBBF6'],
    initials: '#3A2670',
    chip: 'rgba(255,255,255,0.74)',
    chipLine: 'rgba(106,59,238,0.13)',
  },
};

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
export const glassLevels: Record<'thin' | 'regular' | 'thick', { blur: number; night: string; day: string; girl: GirlGlassVariant }> = {
  thin: { blur: 30, night: 'rgba(255,255,255,0.07)', day: 'rgba(255,255,255,0.45)', girl: 'chip' },
  regular: { blur: 55, night: 'rgba(24,27,33,0.38)', day: 'rgba(255,255,255,0.58)', girl: 'card' },
  thick: { blur: 80, night: 'rgba(14,15,18,0.62)', day: 'rgba(255,255,255,0.80)', girl: 'sheet' },
};
export type GlassLevel = keyof typeof glassLevels;

/** Layout constants shared by navigation chrome. */
export const layout = {
  tabBarHeight: 68,
  tabBarBottomGap: 16,
  headerHeight: 52,
  maxContentWidth: 560,
} as const;
