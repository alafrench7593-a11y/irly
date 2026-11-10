import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { t as tx } from '@/i18n';
import { CARDS, type CardId } from '../cards';
import { BACKGROUND, PORTRAIT } from './art';
import { DX, factionLabel, FactionGlyph, factionOf, factionText, serif, useDubaiFonts } from './theme';

/** The phase's scene (Dubaï at night, at sunset, the fireworks), with its title and clock. */
export const DubaiHeader = memo(function DubaiHeader({ phase, title, subtitle, clock }: { phase: 'night' | 'day' | 'ended'; title: string; subtitle?: string; clock?: ReactNode }) {
  const fonts = useDubaiFonts();
  return (
    <View style={styles.header}>
      <Image source={phase === 'night' ? BACKGROUND.night : phase === 'day' ? BACKGROUND.day : BACKGROUND.victory} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={600} accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(11,9,7,0.1)', 'rgba(11,9,7,0.55)', 'rgba(11,9,7,0.92)']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.headerInner}>
        <View style={styles.banner}>
          <Text style={[styles.headerTitle, serif(fonts, '900')]} accessibilityRole="header">
            {title.toUpperCase()}
          </Text>
          {subtitle ? <Text style={[styles.headerSub, serif(fonts, '600')]}>{subtitle}</Text> : null}
        </View>
        {clock ? <View style={styles.clock}>{clock}</View> : null}
      </View>
    </View>
  );
});

/**
 * My card, face down (nobody looking over the shoulder), turned with a 3D flip.
 * Compact beside what it does and what I know, so the table and the actions stay on screen.
 */
export const DubaiMyCard = memo(function DubaiMyCard({ id, startShown, children }: { id: CardId; startShown: boolean; children?: ReactNode }) {
  const fonts = useDubaiFonts();
  const { width } = useWindowDimensions();
  const w = Math.min(132, Math.round((width - 64) * 0.4));
  const [shown, setShown] = useState(startShown);
  const flip = useSharedValue(startShown ? 1 : 0);
  const reduced = useReducedMotion();
  const card = CARDS[id];
  const faction = factionOf(id);
  useEffect(() => {
    flip.set(reduced ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: 520 }));
  }, [shown, flip, reduced]);
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${180 - flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 1 : 0 }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${-flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 0 : 1 }));
  const h = Math.round(w * 1.42);
  return (
    <View style={styles.myCard}>
      <Pressable onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityLabel={shown ? tx('Hide my card') : tx('Show my card')}>
        <View style={{ width: w, height: h }}>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark, DX.gold]} style={styles.backFrame}>
              <LinearGradient colors={['#2A0C10', DX.black, '#2A0C10']} style={styles.backInner}>
                <View style={[styles.backRing, { width: w * 0.62, height: w * 0.62, borderRadius: w * 0.31 }]}>
                  <Text style={[styles.backMark, serif(fonts, '900'), { fontSize: w * 0.17 }]}>IRLY</Text>
                </View>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, front]}>
            <View style={styles.frontFrame}>
              <Image source={PORTRAIT[id]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
              <LinearGradient colors={['transparent', 'rgba(11,9,7,0.85)']} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
              <View style={styles.medal}>
                <FactionGlyph faction={faction} size={16} />
              </View>
            </View>
          </Animated.View>
        </View>
      </Pressable>
      <View style={styles.side}>
        {shown ? (
          <>
            <Text style={[styles.cardName, serif(fonts, '900')]}>{tx(card.name).toUpperCase()}</Text>
            <Text style={[styles.camp, { color: factionText(faction) }]}>{factionLabel(faction, tx)}</Text>
            <Text style={styles.power}>{tx(card.power)}</Text>
            <Text style={styles.goal}>{tx(card.goal)}</Text>
          </>
        ) : (
          <>
            <Text style={[styles.backTitle, serif(fonts, '700')]}>{tx('Your role').toUpperCase()}</Text>
            <Text style={styles.backHint}>{tx('Tap to see your card')}</Text>
          </>
        )}
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: { height: 210, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5, borderColor: DX.goldDark },
  headerInner: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', padding: 14, gap: 8 },
  banner: { alignItems: 'center', borderWidth: 1.5, borderColor: DX.gold, borderRadius: 12, backgroundColor: 'rgba(11,9,7,0.72)', paddingHorizontal: 22, paddingVertical: 6 },
  headerTitle: { color: DX.goldLight, fontSize: 24, letterSpacing: 1.5 },
  headerSub: { color: DX.ivory, fontSize: 13 },
  clock: { borderWidth: 1.5, borderColor: DX.gold, borderRadius: 20, backgroundColor: 'rgba(11,9,7,0.8)', paddingHorizontal: 14, paddingVertical: 4 },
  myCard: { flexDirection: 'row', gap: 14, alignItems: 'center', borderWidth: 1.5, borderColor: DX.goldDark, borderRadius: 16, backgroundColor: 'rgba(21,16,12,0.95)', padding: 12 },
  backFrame: { flex: 1, borderRadius: 12, padding: 2 },
  backInner: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  backRing: { borderWidth: 2, borderColor: DX.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(226,182,83,0.06)' },
  backMark: { color: DX.gold, letterSpacing: 2 },
  frontFrame: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: DX.gold, backgroundColor: DX.black },
  medal: { position: 'absolute', left: 6, bottom: 6, width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: DX.black, alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, gap: 5 },
  cardName: { color: DX.goldLight, fontSize: 16, letterSpacing: 0.6 },
  camp: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  power: { color: DX.ivory, fontSize: 13, lineHeight: 18 },
  goal: { color: DX.muted, fontSize: 12, lineHeight: 16 },
  backTitle: { color: DX.goldLight, fontSize: 16, letterSpacing: 1.5 },
  backHint: { color: DX.muted, fontSize: 13 },
});
