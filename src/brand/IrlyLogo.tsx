import { memo } from 'react';
import { Text, View } from 'react-native';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { IrlyMark, type MarkState } from './IrlyMark';

type WordmarkProps = { size?: number; color?: string };

/**
 * The IRLY wordmark: four capitals, ExtraBold, tight tracking, set as one
 * compact block that reads at 16 px in a navbar and at 120 px on a splash.
 */
export const IrlyWordmark = memo(function IrlyWordmark({ size = 18, color }: WordmarkProps) {
  const t = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={{
        fontFamily: font.heavy,
        fontSize: size,
        lineHeight: size * 1.1,
        letterSpacing: -size * 0.03,
        color: color ?? t.c.text,
      }}
    >
      IRLY
    </Text>
  );
});

type LogoProps = { size?: number; state?: MarkState; color?: string };

/** Mark + wordmark lockup used in headers. */
export const IrlyLogo = memo(function IrlyLogo({ size = 18, state = 'static', color }: LogoProps) {
  const t = useTheme();
  const ring = color ?? t.c.text;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.45 }}>
      <IrlyMark size={size * 1.7} state={state} ringColor={ring} lensColor={t.c.brand} glow={false} />
      <IrlyWordmark size={size} color={ring} />
    </View>
  );
});
