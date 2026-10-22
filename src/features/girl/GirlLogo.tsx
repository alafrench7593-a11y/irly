import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { girl, serif } from './theme';

/**
 * The IRLY Girl wordmark: the parent brand set in spaced Manrope capitals,
 * then « Girl » (or « Maman ») in Instrument Serif italic, a small rose stop between them.
 * `onDark` inverts it for photos; sizes stay crisp from 14 to 48.
 *
 * This is the static logo. For motion (launch, intro, headers, loaders) use
 * GirlMark, which draws this same component and never redraws the letters.
 * `tint` paints every part one colour (GirlMark's shimmer copy) and
 * `decorative` hides that copy from screen readers.
 */
export function GirlLogo({
  size = 20,
  onDark = false,
  word = 'Girl',
  tint,
  decorative = false,
}: {
  size?: number;
  onDark?: boolean;
  word?: 'Girl' | 'Maman';
  tint?: string;
  decorative?: boolean;
}) {
  const ink = tint ?? (onDark ? '#FFFFFF' : girl.ink);
  const accent = tint ?? (onDark ? '#FFFFFF' : girl.brand);
  const a11y = decorative
    ? ({ accessible: false, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const)
    : ({ accessible: true, accessibilityRole: 'header', accessibilityLabel: `IRLY ${word}` } as const);
  return (
    <View style={styles.row} {...a11y}>
      <Text raw style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: size * 0.62, letterSpacing: size * 0.18, color: ink }}>
        IRLY
      </Text>
      <View style={[styles.stop, { width: size * 0.18, height: size * 0.18, borderRadius: size, backgroundColor: accent, marginHorizontal: size * 0.16 }]} />
      {/* The italic leans past its advance: room inside the text box (so native never clips it), none outside.
          The line is as tall as the face itself (ascent + descent = 1.3 em): a shorter line cuts the top of « Girl » on iOS. */}
      <Text raw style={{ fontFamily: serif.italic, fontSize: size * 1.15, lineHeight: Math.ceil(size * 1.5), color: accent, fontWeight: 'normal', paddingRight: size * 0.12, marginRight: -size * 0.12 }}>
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stop: { marginTop: 2 },
});
