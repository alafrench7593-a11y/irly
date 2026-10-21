import { girlElevation, girlNacre, girlSerif } from '@/theme/tokens';

/**
 * IRLY Girl: its own visual universe, editorial and luminous. A pearl-rose
 * ground lit by rose, nude and plum glows; frosted pearl glass with a nacre
 * rim; a deep luminous rose for the main action; dark plum glass for the
 * secondary one and for the moments that need contrast; plum ink instead of
 * black; bordeaux for errors. Pink is one voice among several, never a wash
 * over everything.
 *
 * Contrast (WCAG, measured): `rose` carries white text at 5.8:1 and reads at
 * 4.7:1 or better on the pearl glass (`powder` included); `ink` 13:1 and
 * `inkSoft` 5:1 on the glass; pearl text on `plum` 11:1. `brand`, `bonbon`,
 * `pink` and `inkFaint` are for large or decorative marks (logo, glows,
 * dots, placeholders), never the only colour of small text.
 */
export const girl = {
  bg: '#FBF2F4',
  surface: '#FFFFFF',
  cream: '#FCEFF3',
  blush: '#F6E1E8',
  blushStrong: '#F0CDDB',
  /** Powder rose: soft fills (icon wells, tags) under plum or rose text. */
  powder: '#F3D3DF',
  /** Rosy beige: the warm counterpoint to the rose (badges, quiet fills). */
  nude: '#F2E3DB',
  pink: '#F6C5D8',
  bonbon: '#F15B9A',
  /** The brand pink: logo, large marks, selected glows. */
  brand: '#E83E87',
  /** Deep luminous rose for text and filled controls (buttons, links, accents). */
  rose: '#B92B69',
  /** Plum: dark glass, selected chips, contrast panels. */
  plum: '#4A2440',
  /** Plum-black: the darkest surface, behind pearl text. */
  plumBlack: '#24121E',
  /** Bordeaux: errors and destructive actions. */
  bordeaux: '#8E1F45',
  /** Pearl: text and icons on plum and rose. */
  pearl: '#FFF6FA',
  /** Nacre highlight (rims, glints, the top light of glass). */
  nacre: 'rgba(255,252,254,0.92)',
  ink: '#2F1B29',
  inkSoft: '#6F5A67',
  inkFaint: '#8C7684',
  /** Warm off-white and a whisper of lavender, for washes behind glass. */
  beige: '#F8F1EB',
  lavender: '#F1ECF8',
  line: 'rgba(74,36,64,0.10)',
  glass: 'rgba(255,249,251,0.80)',
  glassDark: 'rgba(43,20,36,0.40)',
  /** The pearl veil laid over IRLY Girl's frosted glass (see GlassFill). */
  glassRose: 'rgba(255,240,246,0.40)',
  positive: '#2B7F55',
  critical: '#8E1F45',
  /** The primary gradient (buttons): white text stays above 4.5:1 under the label. */
  gradient: ['#D63A7E', '#B92B69', '#9E2358'] as const,
  /** Plum gradient: selected states and dark panels. */
  plumGradient: ['#55294A', '#3A1A31', '#24121E'] as const,
  /** Mother-of-pearl: the faint iridescence laid on glass and highlights. */
  nacreGradient: girlNacre,
  /** A soft wash for heroes and empty states. */
  wash: ['#FBF2F4', '#F6E1E8'] as const,
  /** A pane lifted off the ground (cards that float over others). */
  shadow: '0px 16px 36px rgba(122,31,61,0.13), 0px 3px 8px rgba(74,36,64,0.06)',
  shadowSoft: girlElevation.card,
  /** Rose glow: the main action only. */
  glow: girlElevation.glow,
  shadowPlum: girlElevation.plum,
} as const;

/**
 * Editorial type: Instrument Serif (bundled, SIL OFL) for titles that carry
 * the brand voice; the rest of the interface stays in Manrope.
 */
export const serif = girlSerif;

export const girlType = {
  /** Hero headline. */
  display: { fontFamily: serif.regular, fontSize: 42, lineHeight: 44, letterSpacing: -0.4, fontWeight: 'normal' },
  /** Section titles. */
  section: { fontFamily: serif.regular, fontSize: 30, lineHeight: 34, letterSpacing: -0.2, fontWeight: 'normal' },
  /** Card and sheet titles. */
  card: { fontFamily: serif.regular, fontSize: 24, lineHeight: 28, fontWeight: 'normal' },
  /** The word GIRL in the logo, and soft accents inside titles. */
  accent: { fontFamily: serif.italic, fontWeight: 'normal' },
} as const;

/** Photos inside IRLY Girl load (or fall back) on pink, never on grey or black. */
export const GIRL_TINT = { base: girl.blush, pulse: girl.cream } as const;
