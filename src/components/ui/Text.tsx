import { Children, memo, useLayoutEffect, useRef, type ReactNode } from 'react';
import { translate, useLang, type Lang } from '@/i18n';
import { Platform, Text as RNText, StyleSheet, type TextProps, type TextStyle } from 'react-native';
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
  const fitOn = Platform.OS === 'web' && Boolean(rest.adjustsFontSizeToFit) && rest.numberOfLines === 1;
  const fit = useWebFit(fitOn, fitOn ? (StyleSheet.flatten(style)?.fontSize ?? base.fontSize) : 0, rest.minimumFontScale, lang, children);
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      {...(fitOn ? { ref: fit } : null)}
      style={[base, { fontFamily, color: color ?? tones[tone], textAlign: align }, style]}
    >
      {lang === 'en' || raw ? children : localize(children, lang)}
    </RNText>
  );
});

/**
 * The web has no adjustsFontSizeToFit: a one-line label longer than its
 * room (« Cette semaine » in a segmented control) was cut with an ellipsis.
 * On the web, a size smaller instead, as iOS does, down to minimumFontScale.
 */
function useWebFit(on: boolean, size: number, minScale = 0.5, ...deps: unknown[]) {
  const ref = useRef<RNText>(null);
  useLayoutEffect(() => {
    const el = ref.current as unknown as HTMLElement | null;
    if (!on || !el?.style || typeof ResizeObserver === 'undefined') return;
    const fitNow = () => {
      // Letter spacing does not scale with the size: a few passes, a hair under the room so no ellipsis is left.
      let s = size;
      el.style.fontSize = `${s}px`;
      for (let i = 0; i < 4 && el.scrollWidth > el.clientWidth && s > size * minScale; i++) {
        s = Math.max(size * minScale, (s * el.clientWidth * 0.98) / el.scrollWidth);
        el.style.fontSize = `${s}px`;
      }
    };
    fitNow();
    const watch = new ResizeObserver(fitNow);
    watch.observe(el);
    return () => watch.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, size, minScale, ...deps]);
  return ref;
}

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
