import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { deckOf, type WwMode } from '@/features/games/werewolf/cards';
import { PORTRAIT, SCENES } from '@/features/games/werewolf/dubai/art';
import { GoldDust, LivingScene } from '@/features/games/werewolf/dubai/Motion';
import { DX, serif, useDubaiFonts } from '@/features/games/werewolf/dubai/theme';
import { MODE_INFO } from '@/features/games/werewolf/home/WerewolfHome';
import { t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';

/** The nine modes, in the order of the book; Dubaï has its own block under them. */
const NINE: WwMode[] = ['classic', 'chaos', 'nightmare', 'manipulation', 'nightmare_chaos', 'manipulation_chaos', 'nightmare_manipulation', 'apocalypse', 'dubai'];
/** One accent per mode, within the game's palette. */
const ACCENT: Record<string, string> = {
  classic: DX.gold,
  chaos: '#D69A2D',
  nightmare: DX.redLight,
  manipulation: '#7C8FD9',
  nightmare_chaos: '#C2553A',
  manipulation_chaos: '#B98BD6',
  nightmare_manipulation: '#9B4FD0',
  apocalypse: '#E0623A',
  dubai: DX.goldLight,
};
const STEPS: { title: string; body: string }[] = [
  { title: 'The night', body: 'Everyone gets a secret card. At night the Wolves choose a victim, and the special characters use their powers.' },
  { title: 'The day', body: 'The village wakes up, finds out who died, and debates: who is lying?' },
  { title: 'The vote', body: 'Everyone votes to eliminate a suspect. The village wins when no Wolf is left; the Wolves win when they are as many as the others.' },
];

/**
 * « Discover the game »: what Loup-Garou is, in three steps, its characters,
 * and the nine modes, each with its scene, its cast and a button that opens
 * the real game on that mode. Opened from the Home.
 */
export default function DiscoverGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState<WwMode>('classic');
  const pageW = Math.min(width, 620);
  const heroH = Math.min(Math.round(height * 0.52), 460);
  const play = (m: WwMode) => router.push(m === 'dubai' ? '/games/dubai' : `/games/werewolf?mode=${m}`);
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { width, height: heroH }]}>
          <LivingScene source={SCENES.classic.home} />
          <LinearGradient colors={['rgba(11,9,7,0.3)', 'rgba(11,9,7,0.1)', 'rgba(11,9,7,0.75)', DX.black]} locations={[0, 0.3, 0.75, 1]} style={StyleSheet.absoluteFill} />
          <GoldDust count={10} height={heroH} />
          <View style={[styles.heroTop, { width: pageW, top: insets.top + 8 }]}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round} testID="discover-back">
              <Icon name="arrowLeft" size={20} color={DX.goldLight} />
            </Pressable>
          </View>
          <Animated.View entering={reduced ? undefined : FadeInDown.duration(600)} style={[styles.heroCopy, { width: pageW }]}>
            <Text style={[styles.brand, serif(fonts, '700')]}>IRLY GAME</Text>
            <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
              LOUP-GAROU
            </Text>
            <Text style={[styles.tagline, serif(fonts, '600')]}>{tx('Bluff, investigate and unmask the Wolves.')}</Text>
          </Animated.View>
        </View>

        <View style={[styles.block, { width: pageW }]}>
          <Text style={styles.lead}>{tx('A game of bluff for 6 to 20 players. You do not need to know it: your card tells you what to do, and you can learn against AI players first.')}</Text>
          {STEPS.map((s, i) => (
            <Animated.View key={s.title} entering={reduced ? undefined : FadeInDown.delay(120 * i).duration(450)} style={styles.step}>
              <View style={styles.stepNo}>
                <Text style={[styles.stepNoText, serif(fonts, '900')]}>{i + 1}</Text>
              </View>
              <View style={styles.stepCopy}>
                <Text style={[styles.stepTitle, serif(fonts, '700')]}>{tx(s.title)}</Text>
                <Text style={styles.stepBody}>{tx(s.body)}</Text>
              </View>
            </Animated.View>
          ))}
          <Gold label="Play now" onPress={() => router.push('/games/werewolf')} fonts={fonts} testID="discover-play" />
          <View style={styles.row}>
            <Ghost label="The characters" onPress={() => router.push('/games/cards?mode=classic')} fonts={fonts} testID="discover-cards" />
            <Ghost label="The rules" onPress={() => router.push('/games/dubai-rules?mode=classic')} fonts={fonts} testID="discover-rules" />
          </View>
        </View>

        <View style={[styles.block, { width: pageW }]}>
          <Text style={[styles.h2, serif(fonts, '900')]} accessibilityRole="header">
            {tx('Nine modes')}
          </Text>
          <Text style={styles.lead}>{tx('The same game, nine ways to play it. Tap a mode to see it.')}</Text>
          {NINE.map((m) => (
            <ModeCard
              key={m}
              mode={m}
              open={open === m}
              fonts={fonts}
              reduced={reduced}
              onOpen={() => {
                haptic('select');
                setOpen(m);
              }}
              onPlay={() => play(m)}
              onCards={() => router.push(`/games/cards?mode=${m}`)}
            />
          ))}
        </View>

        <View style={[styles.dubai, { width: pageW - 32 }]} testID="discover-dubai">
          <Image source={SCENES.dubai.home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityLabel={tx('The Dubai skyline at night, under the moon')} />
          <LinearGradient colors={['rgba(11,9,7,0.15)', 'rgba(11,9,7,0.35)', 'rgba(11,9,7,0.95)']} locations={[0, 0.4, 0.8]} style={StyleSheet.absoluteFill} />
          <View style={styles.dubaiCopy}>
            <View style={styles.cast}>
              {(['expat', 'escroc', 'influencer', 'emirati', 'golden_visa'] as const).map((c) => (
                <Image key={c} source={PORTRAIT[c]} style={styles.castBig} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
              ))}
            </View>
            <Text style={[styles.dubaiTitle, serif(fonts, '900')]} accessibilityRole="header">
              {'DUBAÏ — EXPATS VS ESCROCS 🇦🇪'}
            </Text>
            <Text style={[styles.dubaiLine, serif(fonts, '600')]}>{tx('In Dubai, everyone has something to hide…')}</Text>
            <Gold label="Discover the Dubai mode" onPress={() => router.push('/games/dubai')} fonts={fonts} testID="discover-dubai-open" />
          </View>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dubaiEdge]} />
        </View>
      </ScrollView>
    </View>
  );
}

const ModeCard = memo(function ModeCard({ mode, open, fonts, reduced, onOpen, onPlay, onCards }: { mode: WwMode; open: boolean; fonts: boolean; reduced: boolean; onOpen: () => void; onPlay: () => void; onCards: () => void }) {
  const info = MODE_INFO[mode];
  const accent = ACCENT[mode] ?? DX.gold;
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(260)} style={[styles.mode, { borderColor: open ? accent : 'rgba(226,182,83,0.22)' }]}>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${tx(info.name)}. ${tx(info.tagline)}`} testID={`discover-mode-${mode}`}>
        <View style={[styles.modeArt, { height: open ? 150 : 92 }]}>
          <Image source={SCENES[mode].home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" transition={250} accessibilityIgnoresInvertColors />
          <LinearGradient colors={['rgba(11,9,7,0.1)', 'rgba(11,9,7,0.9)']} style={StyleSheet.absoluteFill} />
          <View style={styles.modeHead}>
            <View style={styles.modeNames}>
              <Text style={[styles.modeName, { color: accent }, serif(fonts, '900')]}>{tx(info.name).toUpperCase()}</Text>
              <Text style={styles.modeTag} numberOfLines={2}>
                {tx(info.tagline)}
              </Text>
            </View>
            <View style={styles.cast}>
              {info.cast.slice(0, 3).map((c) => (
                <Image key={c} source={PORTRAIT[c]} style={[styles.castSmall, { borderColor: accent }]} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
              ))}
            </View>
          </View>
        </View>
      </Pressable>
      {open ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(260)} style={styles.modeBody}>
          <Text style={styles.stepBody}>{tx(info.line)}</Text>
          <Text style={styles.count}>{tx('{n} cards', { n: deckOf(mode).length })}</Text>
          <View style={styles.row}>
            <Gold label="Play" onPress={onPlay} fonts={fonts} testID={`discover-play-${mode}`} flex />
            <Ghost label="The characters" onPress={onCards} fonts={fonts} testID={`discover-cards-${mode}`} />
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
});

function Gold({ label, onPress, fonts, testID, flex }: { label: string; onPress: () => void; fonts: boolean; testID?: string; flex?: boolean }) {
  return (
    <PressableScale haptic="press" scaleTo={0.96} onPress={onPress} accessibilityRole="button" accessibilityLabel={tx(label)} testID={testID} style={[styles.goldWrap, flex ? styles.flex : null]}>
      <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gold}>
        <Text style={[styles.goldLabel, serif(fonts, '900')]}>{tx(label)}</Text>
      </LinearGradient>
    </PressableScale>
  );
}

function Ghost({ label, onPress, fonts, testID }: { label: string; onPress: () => void; fonts: boolean; testID?: string }) {
  return (
    <PressableScale haptic="select" scaleTo={0.97} onPress={onPress} accessibilityRole="button" accessibilityLabel={tx(label)} testID={testID} style={[styles.ghost, styles.flex]}>
      <Text style={[styles.ghostLabel, serif(fonts, '700')]}>{tx(label)}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  flex: { flex: 1 },
  hero: { justifyContent: 'flex-end', alignItems: 'center', overflow: 'hidden' },
  heroTop: { position: 'absolute', paddingHorizontal: 16, flexDirection: 'row' },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,9,7,0.55)', borderWidth: 1, borderColor: 'rgba(226,182,83,0.4)' },
  heroCopy: { paddingHorizontal: 16, paddingBottom: 18, gap: 4 },
  brand: { color: DX.gold, fontSize: 13, letterSpacing: 3 },
  title: { color: DX.ivory, fontSize: 38, lineHeight: 44, letterSpacing: 1 },
  tagline: { color: DX.goldLight, fontSize: 15, lineHeight: 21 },
  block: { paddingHorizontal: 16, paddingTop: 22, gap: 12 },
  lead: { color: DX.muted, fontSize: 15, lineHeight: 22 },
  h2: { color: DX.ivory, fontSize: 22, letterSpacing: 1 },
  step: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 18, backgroundColor: DX.panelSolid, borderWidth: 1, borderColor: 'rgba(226,182,83,0.18)' },
  stepNo: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: DX.gold },
  stepNoText: { color: DX.goldLight, fontSize: 15 },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { color: DX.ivory, fontSize: 16 },
  stepBody: { color: DX.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10 },
  goldWrap: { borderRadius: 16, overflow: 'hidden' },
  gold: { minHeight: 50, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  goldLabel: { color: '#221506', fontSize: 15, letterSpacing: 1.2, textTransform: 'uppercase', textAlign: 'center' },
  ghost: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(226,182,83,0.55)', paddingHorizontal: 12 },
  ghostLabel: { color: DX.goldLight, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  mode: { borderRadius: 20, borderWidth: 1.5, overflow: 'hidden', backgroundColor: DX.panelSolid },
  modeArt: { justifyContent: 'flex-end' },
  modeHead: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12 },
  modeNames: { flex: 1, gap: 2 },
  modeName: { fontSize: 17, letterSpacing: 1 },
  modeTag: { color: DX.ivory, fontSize: 13, lineHeight: 18 },
  cast: { flexDirection: 'row', gap: 6 },
  castSmall: { width: 34, height: 44, borderRadius: 8, borderWidth: 1 },
  castBig: { width: 46, height: 60, borderRadius: 10, borderWidth: 1, borderColor: DX.gold },
  modeBody: { padding: 12, gap: 10 },
  count: { color: DX.goldLight, fontSize: 13 },
  dubai: { marginTop: 26, minHeight: 380, borderRadius: 24, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: DX.panelSolid },
  dubaiCopy: { padding: 16, gap: 10 },
  dubaiTitle: { color: DX.goldLight, fontSize: 19, lineHeight: 25, letterSpacing: 0.8 },
  dubaiLine: { color: DX.ivory, fontSize: 15, lineHeight: 21 },
  dubaiEdge: { borderRadius: 24, borderWidth: 1.5, borderColor: DX.gold },
});
