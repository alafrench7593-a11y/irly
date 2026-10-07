import { Children, memo, type ReactNode } from 'react';
import { translate, useLang, type Lang } from '@/i18n';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { type TypeVariant, type } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type Tone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'brand'
  | 'accent'
  | 'live'
  | 'positive'
  | 'critical'
  | 'onDark'
  | 'onBrand';

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  color?: string;
  align?: TextStyle['textAlign'];
  italic?: boolean;
  /** User-written content (messages, posts, comments): shown as typed, never translated. */
  raw?: boolean;
};

export const Text = memo(function Text({
  variant = 'body',
  tone = 'primary',
  color,
  align,
  italic,
  raw,
  style,
  children,
  ...rest
}: Props) {
  const t = useTheme();
  const lang = useLang();
  const tones: Record<Tone, string> = {
    primary: t.c.text,
    secondary: t.c.textSecondary,
    tertiary: t.c.textTertiary,
    brand: t.c.brand,
    accent: t.accent,
    live: t.c.live,
    positive: t.c.positive,
    critical: t.c.critical,
    onDark: t.c.onDark,
    onBrand: t.c.onBrand,
  };
  const base = type[variant];
  // v3 has no italic serif: `italic` is accepted for older call sites and ignored.
  void italic;
  const fontFamily = base.fontFamily;
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[base, { fontFamily, color: color ?? tones[tone], textAlign: align }, style]}
    >
      {lang === 'en' || raw ? children : localize(children, lang)}
    </RNText>
  );
});

/**
 * Every literal string rendered by <Text> goes through the dictionary, so
 * screens stay readable (plain English in JSX) and switch language for
 * free. Names, places and other data have no entry and pass through.
 */
function localize(children: ReactNode, lang: Lang): ReactNode {
  if (typeof children === 'string') return one(children, lang);
  if (Array.isArray(children)) return Children.map(children, (c) => (typeof c === 'string' ? one(c, lang) : c));
  return children;
}

function one(s: string, lang: Lang): string {
  const core = s.trim();
  if (!core || !/[A-Za-z]/.test(core)) return s;
  const out = translate(lang, core);
  if (out === core) return s;
  const lead = s.slice(0, s.indexOf(core));
  const trail = s.slice(s.indexOf(core) + core.length);
  return lead + out + trail;
}
