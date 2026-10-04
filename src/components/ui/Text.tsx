import { memo } from 'react';
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
};

export const Text = memo(function Text({
  variant = 'body',
  tone = 'primary',
  color,
  align,
  italic,
  style,
  ...rest
}: Props) {
  const t = useTheme();
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
  const fontFamily =
    italic && (variant === 'displayXL' || variant === 'displayL' || variant === 'displayM')
      ? 'InstrumentSerif_400Regular_Italic'
      : base.fontFamily;
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[base, { fontFamily, color: color ?? tones[tone], textAlign: align }, style]}
    />
  );
});
