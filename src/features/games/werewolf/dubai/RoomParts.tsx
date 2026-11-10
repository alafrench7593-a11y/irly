import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { t as tx } from '@/i18n';
import type { DubaiCardId } from '../cards';
import { BACKGROUND } from './art';
import { DubaiCard } from './DubaiCard';
import { DX, serif, useDubaiFonts } from './theme';

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

/** My card, face down (nobody looking over the shoulder), turned with a 3D flip. */
export const DubaiMyCard = memo(function DubaiMyCard({ id, startShown, children }: { id: DubaiCardId; startShown: boolean; children?: ReactNode }) {
  const fonts = useDubaiFonts();
  const { width } = useWindowDimensions();
  // Small during the game (the table comes first), full size once revealed at the end.
  const w = Math.min(startShown ? 280 : 210, width - 80);
  const [shown, setShown] = useState(startShown);
  const flip = useSharedValue(startShown ? 1 : 0);
  const reduced = useReducedMotion();
  useEffect(() => {
    flip.set(reduced ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: 520 }));
  }, [shown, flip, reduced]);
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${180 - flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 1 : 0 }));
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 900 }, { rotateY: `${-flip.get() * 180}deg` }], opacity: flip.get() > 0.5 ? 0 : 1 }));
  const h = Math.round(w * 1.45);
  return (
    <View style={styles.myCard}>
      <Pressable onPress={() => setShown((v) => !v)} accessibilityRole="button" accessibilityLabel={shown ? tx('Hide my card') : tx('Show my card')}>
        <View style={{ width: w, height: h }}>
          <Animated.View style={[StyleSheet.absoluteFill, back]}>
            <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark, DX.gold]} style={styles.backFrame}>
              <LinearGradient colors={['#2A0C10', DX.black, '#2A0C10']} style={styles.backInner}>
                <View style={styles.backRing}>
                  <Text style={[styles.backMark, serif(fonts, '900')]}>IRLY</Text>
                </View>
                <Text style={[styles.backTitle, serif(fonts, '700')]}>{tx('Your role').toUpperCase()}</Text>
                <Text style={styles.backHint}>{tx('Tap to see your card')}</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, front]}>
            <DubaiCard id={id} width={w} details />
          </Animated.View>
        </View>
      </Pressable>
      {children}
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
  myCard: { alignItems: 'center', gap: 10 },
  backFrame: { flex: 1, borderRadius: 16, padding: 2.5 },
  backInner: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 14 },
  backRing: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: DX.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(226,182,83,0.06)' },
  backMark: { color: DX.gold, fontSize: 28, letterSpacing: 3 },
  backTitle: { color: DX.goldLight, fontSize: 18, letterSpacing: 2 },
  backHint: { color: DX.muted, fontSize: 13 },
});
