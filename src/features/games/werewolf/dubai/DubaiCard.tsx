import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t as tx } from '@/i18n';
import { CARDS, type DubaiCardId } from '../cards';
import { PORTRAIT } from './art';
import { DX, FACTION_COLOR, factionLabel, FactionGlyph, factionOf, serif, useDubaiFonts } from './theme';

type Props = {
  id: DubaiCardId;
  /** Card width; the height follows (portrait 3:4 + text). */
  width: number;
  /** With the power and the goal under the name (collection, my card). */
  details?: boolean;
  /** Dimmed: a card out of the game, or not chosen. */
  dim?: boolean;
};

/**
 * A Dubaï card as the official mockups draw it: a glowing gold frame, the
 * character's portrait, a gold medallion with the faction's emblem, the name
 * on a black band, the faction in its colour, then the power and the goal.
 */
export const DubaiCard = memo(function DubaiCard({ id, width, details = false, dim = false }: Props) {
  const fonts = useDubaiFonts();
  const card = CARDS[id];
  const faction = factionOf(id);
  const portraitH = Math.round((width - 6) * 0.86);
  const medal = Math.max(26, Math.round(width * 0.17));
  const label = tx(card.name).toUpperCase();
  // Long names (« L’AGENT IMMOBILIER », « THE REAL ESTATE AGENT ») take a smaller size rather than an ellipsis.
  const nameSize = Math.max(10, Math.min(20, Math.round((width / 11) * (label.length > 16 ? 0.72 : label.length > 12 ? 0.86 : 1))));
  return (
    <View style={[styles.glow, { width, opacity: dim ? 0.45 : 1 }]}>
      <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark, DX.gold]} locations={[0, 0.35, 0.7, 1]} style={styles.frame}>
        <View style={styles.inner}>
          <View style={{ height: portraitH }}>
            <Image source={PORTRAIT[id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={250} accessibilityIgnoresInvertColors />
            <LinearGradient colors={['transparent', 'rgba(11,9,7,0.15)', DX.black]} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
          </View>
          <View style={[styles.band, { paddingLeft: medal + 8 }]}>
            <Text style={[styles.name, serif(fonts, '700'), { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.2) }]} numberOfLines={2}>
              {label}
            </Text>
          </View>
          <View style={styles.body}>
            <View style={[styles.camp, { borderColor: FACTION_COLOR[faction] }]}>
              <Text style={[styles.campText, { color: FACTION_COLOR[faction] === DX.expats ? '#8FB2FF' : FACTION_COLOR[faction] }]}>
                {`${tx('Camp')} : ${factionLabel(faction, tx)}`}
              </Text>
            </View>
            {details ? (
              <>
                <Text style={styles.line}>
                  <Text style={styles.label}>{`${tx('Power')} : `}</Text>
                  {tx(card.power)}
                </Text>
                <Text style={styles.line}>
                  <Text style={styles.label}>{`${tx('Goal')} : `}</Text>
                  {tx(card.goal)}
                </Text>
              </>
            ) : null}
          </View>
          {/* Drawn last, over the portrait and the band. */}
          <View style={[styles.medal, { width: medal, height: medal, borderRadius: medal / 2, left: 6, top: portraitH - medal * 0.62 }]}>
            <FactionGlyph faction={faction} size={medal * 0.58} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  glow: {
    borderRadius: 16,
    shadowColor: DX.gold,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  frame: { borderRadius: 16, padding: 2.5 },
  inner: { borderRadius: 14, overflow: 'hidden', backgroundColor: DX.black },
  medal: {
    position: 'absolute',
    zIndex: 3,
    backgroundColor: DX.black,
    borderWidth: 2,
    borderColor: DX.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  band: { backgroundColor: DX.black, paddingRight: 8, paddingTop: 6, paddingBottom: 4, minHeight: 34, justifyContent: 'center' },
  name: { color: DX.goldLight, letterSpacing: 0.6, textShadowColor: 'rgba(0,0,0,0.9)', textShadowRadius: 4 },
  body: { paddingHorizontal: 8, paddingBottom: 9, gap: 5 },
  camp: { alignSelf: 'center', borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 10, paddingVertical: 2 },
  campText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  line: { color: DX.ivory, fontSize: 11.5, lineHeight: 15 },
  label: { color: DX.goldLight, fontWeight: '700' },
});
