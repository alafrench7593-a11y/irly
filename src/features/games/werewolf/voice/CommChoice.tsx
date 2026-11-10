import { StyleSheet, Text, View } from 'react-native';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { DX, serif, useDubaiFonts } from '../dubai/theme';

export type Comm = 'text' | 'voice';

const CARDS: { value: Comm; title: string; body: string }[] = [
  { value: 'text', title: '💬 Text mode', body: 'Chat with the other players by messages.' },
  { value: 'voice', title: '🎙️ Voice mode', body: 'Talk directly with the other players during the game.' },
];

/** The host's choice: a game in writing, or a voice game (the written chat stays in both). */
export function CommChoice({ value, onChange, disabled }: { value: Comm; onChange: (v: Comm) => void; disabled?: boolean }) {
  const fonts = useDubaiFonts();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {CARDS.map((c) => {
        const on = c.value === value;
        return (
          <PressableScale key={c.value} disabled={disabled} onPress={() => onChange(c.value)} accessibilityRole="radio" accessibilityState={{ selected: on, disabled }} accessibilityLabel={`${tx(c.title)}. ${tx(c.body)}`} style={styles.flex} testID={`comm-${c.value}`}>
            <View style={[styles.card, on ? styles.on : null]}>
              <Text style={[styles.title, on ? styles.titleOn : null, serif(fonts, '700')]}>{tx(c.title).toUpperCase()}</Text>
              <Text style={styles.body}>{tx(c.body)}</Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  card: { flex: 1, minHeight: 104, borderRadius: 16, borderWidth: 1.2, borderColor: DX.goldDark, backgroundColor: DX.black, padding: 12, gap: 6 },
  on: { borderColor: DX.gold, backgroundColor: 'rgba(142,27,34,0.55)' },
  title: { color: DX.ivory, fontSize: 13, letterSpacing: 0.6 },
  titleOn: { color: DX.goldLight },
  body: { color: DX.muted, fontSize: 12.5, lineHeight: 17 },
});
