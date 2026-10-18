import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { girl, serif } from './theme';

/**
 * The IRLY Girl wordmark: the parent brand set in spaced Manrope capitals,
 * then « Girl » (or « Moms ») in Instrument Serif italic, a small rose stop between them.
 * `onDark` inverts it for photos; sizes stay crisp from 14 to 48.
 */
export function GirlLogo({ size = 20, onDark = false, word = 'Girl' }: { size?: number; onDark?: boolean; word?: 'Girl' | 'Moms' }) {
  const ink = onDark ? '#FFFFFF' : girl.ink;
  const accent = onDark ? '#FFFFFF' : girl.brand;
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel={`IRLY ${word}`}>
      <Text raw style={{ fontFamily: 'Manrope_800ExtraBold', fontSize: size * 0.62, letterSpacing: size * 0.18, color: ink }}>
        IRLY
      </Text>
      <View style={[styles.stop, { width: size * 0.18, height: size * 0.18, borderRadius: size, backgroundColor: accent, marginHorizontal: size * 0.16 }]} />
      <Text raw style={{ fontFamily: serif.italic, fontSize: size * 1.15, lineHeight: size * 1.25, color: accent, fontWeight: 'normal' }}>
        {word}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stop: { marginTop: 2 },
});
