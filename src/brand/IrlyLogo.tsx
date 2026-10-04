import { memo } from 'react';
import { Text, View } from 'react-native';
import { font } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { IrlyMark, type MarkState } from './IrlyMark';

type WordmarkProps = { size?: number; color?: string };

/** "IRLY" set in Manrope ExtraBold with open tracking. */
export const IrlyWordmark = memo(function IrlyWordmark({ size = 18, color }: WordmarkProps) {
  const t = useTheme();
  return (
    <Text
      allowFontScaling={false}
      style={{
        fontFamily: font.heavy,
        fontSize: size,
        lineHeight: size * 1.15,
        letterSpacing: size * 0.16,
        color: color ?? t.c.text,
        marginRight: -size * 0.16,
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
