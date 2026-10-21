import { girlElevation, girlNacre, girlSerif } from '@/theme/tokens';

/**
 * IRLY Girl: its own visual universe, editorial, luminous and tech. A
 * lavender-pearl ground lit by violet, ice-blue and lilac glows; frosted
 * pearl glass with a thin iridescent rim; an electric violet for the main
 * action; deep plum-violet glass for the secondary one and for the moments
 * that need contrast; plum ink instead of black; berry for errors. Violet is
 * one voice among several, never a wash over everything.
 *
 * Contrast (WCAG, measured): `rose` (the violet of text and filled
 * controls, the name is kept so every screen follows) carries white text at
 * 6:1 and reads at 4.8:1 or better on the pearl glass (`powder` included);
 * `ink` 15:1 and `inkSoft` 6.7:1 on the ground; pearl text on `plum` 14:1,
 * `lilac` on `plum` 8:1. `brand`, `bonbon`, `pink` and `inkFaint` are for
 * large or decorative marks (logo, glows, dots, placeholders), never the
 * only colour of small text.
 */
export const girl = {
  bg: '#F6F2FF',
  surface: '#FFFFFF',
  cream: '#F5F0FF',
  blush: '#EDE7FF',
  blushStrong: '#DDD2FF',
  /** Powder lavender: soft fills (icon wells, tags) under plum or violet text. */
  powder: '#E9E1FF',
  /** Cool pearl: the quiet counterpoint to the violet (badges, quiet fills). */
  nude: '#EEEAF6',
  pink: '#D4C6FF',
  bonbon: '#A78BFA',
  /** The brand violet: logo, large marks, selected glows. */
  brand: '#7C4DFF',
  /** Deep electric violet for text and filled controls (buttons, links, accents). */
  rose: '#6A3BEE',
  /** Plum-violet: dark glass, selected chips, contrast panels. */
  plum: '#2D1D54',
  /** Violet-black: the darkest surface, behind pearl text. */
  plumBlack: '#160E2E',
  /** Berry: errors and destructive actions. */
  bordeaux: '#A0154A',
  /** Pearl: text and icons on plum and violet. */
  pearl: '#FAF7FF',
  /** Lilac: accents (icons, checks, italic words) on plum glass and dark photos. */
  lilac: '#C9B6FF',
  /** Nacre highlight (rims, glints, the top light of glass). */
  nacre: 'rgba(253,252,255,0.92)',
  ink: '#211634',
  inkSoft: '#5B5072',
  inkFaint: '#8A80A0',
  /** Cool off-white and a whisper of lavender, for washes behind glass. */
  beige: '#F7F4FB',
  lavender: '#EEE9FB',
  line: 'rgba(45,29,84,0.10)',
  glass: 'rgba(250,247,255,0.80)',
  glassDark: 'rgba(26,17,52,0.40)',
  /** The pearl veil laid over IRLY Girl's frosted glass (see GlassFill). */
  glassRose: 'rgba(244,240,255,0.40)',
  positive: '#2B7F55',
  critical: '#A0154A',
  /** The primary gradient (buttons): white text stays above 4.5:1 under the label. */
  gradient: ['#8B5CF6', '#6A3BEE', '#5A2FD6'] as const,
  /** Plum gradient: selected states and dark panels. */
  plumGradient: ['#3A2870', '#2A1B52', '#160E2E'] as const,
  /** Iridescence: the faint lavender and ice-blue sheen laid on glass and highlights. */
  nacreGradient: girlNacre,
  /** A soft wash for heroes and empty states. */
  wash: ['#F6F2FF', '#EDE7FF'] as const,
  /** A pane lifted off the ground (cards that float over others). */
  shadow: '0px 16px 36px rgba(64,34,150,0.13), 0px 3px 8px rgba(45,29,84,0.06)',
  shadowSoft: girlElevation.card,
  /** Violet glow: the main action only. */
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

/** Photos inside IRLY Girl load (or fall back) on lavender, never on grey or black. */
export const GIRL_TINT = { base: girl.blush, pulse: girl.cream } as const;
