/**
 * IRLY Girl: its own visual universe, editorial and soft. Near-white pink
 * backgrounds, white surfaces, a controlled candy pink for the brand and a
 * plum ink instead of black. Used only inside IRLY Girl, so crossing into it
 * is felt.
 *
 * Contrast (WCAG, measured): `rose` carries white text at 5.1:1 and reads at
 * 4.8:1 on `bg`; `ink` 13:1 and `inkSoft` 4.8:1 on `bg`. `brand`, `bonbon`,
 * `pink` and `inkFaint` are for large or decorative marks (logo, glows, dots,
 * placeholders), never the only colour of small text.
 */
export const girl = {
  bg: '#FFF5F8',
  surface: '#FFFFFF',
  cream: '#FFEEF4',
  blush: '#F8DCE7',
  blushStrong: '#F6C5D8',
  pink: '#F6C5D8',
  bonbon: '#F15B9A',
  /** The brand pink: logo, large marks, selected glows. */
  brand: '#E83E87',
  /** Rose for text and filled controls (buttons, selected chips, links). */
  rose: '#C92F72',
  ink: '#382832',
  inkSoft: '#7E6873',
  inkFaint: '#947F8A',
  line: 'rgba(201,47,114,0.12)',
  glass: 'rgba(255,245,248,0.78)',
  glassDark: 'rgba(56,40,50,0.35)',
  positive: '#2F8F5E',
  critical: '#B3261E',
  /** The primary gradient (buttons): white text stays above 4.5:1 end to end. */
  gradient: ['#D63579', '#C2296B'] as const,
  /** A soft wash for heroes and empty states. */
  wash: ['#FFF5F8', '#FBE4EE'] as const,
  shadow: '0 12px 30px rgba(201,47,114,0.14)',
  shadowSoft: '0 4px 14px rgba(56,40,50,0.06)',
} as const;

/**
 * Editorial type: Instrument Serif (bundled, SIL OFL) for titles that carry
 * the brand voice; the rest of the interface stays in Manrope.
 */
export const serif = {
  regular: 'InstrumentSerif_400Regular',
  italic: 'InstrumentSerif_400Regular_Italic',
} as const;

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
