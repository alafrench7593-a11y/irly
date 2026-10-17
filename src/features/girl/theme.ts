/**
 * IRLY Girl: its own visual universe. Powder-pink light backgrounds, white
 * rounded cards, candy-pink accents and a deep plum ink instead of black.
 * Used only inside IRLY Girl, so crossing into it is felt.
 *
 * Contrast (WCAG): `rose` carries white text at 4.7:1 and reads at 4.4:1 on
 * `bg`; `ink` 13.5:1 and `inkSoft` 5.9:1 on `bg`. `bonbon` and `pink` are
 * decorative (gradients, glows, dots), never the only colour of a text.
 */
export const girl = {
  bg: '#FFF5F8',
  surface: '#FFFFFF',
  cream: '#FFEAF1',
  blush: '#FFDCE8',
  blushStrong: '#FFB8CF',
  pink: '#F48FB6',
  bonbon: '#FF7EB0',
  rose: '#D1376F',
  ink: '#3B2230',
  inkSoft: '#7A5568',
  inkFaint: '#B898A8',
  line: 'rgba(209,55,111,0.12)',
  glass: 'rgba(255,245,248,0.78)',
  glassDark: 'rgba(59,34,48,0.35)',
  positive: '#2F8F5E',
  /** The primary gradient (buttons, active tab): candy pink to rose. */
  gradient: ['#FF8DBA', '#D1376F'] as const,
  /** A soft wash for heroes and empty states. */
  wash: ['#FFF5F8', '#FFE3EE'] as const,
  shadow: '0 14px 34px rgba(209,55,111,0.16)',
  shadowSoft: '0 6px 16px rgba(209,55,111,0.10)',
} as const;

/** Photos inside IRLY Girl load (or fall back) on pink, never on grey or black. */
export const GIRL_TINT = { base: girl.blush, pulse: girl.cream } as const;
