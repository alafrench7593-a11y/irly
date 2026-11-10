import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/Icon';
import { useAccount } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { PressableScale } from '@/motion/PressableScale';
import { useGamesOverview, useGamesPresence, type GameCount } from './api';
import { GAMES, type GameEntry } from './catalog';
import { Breathe, GoldDust, LivingScene } from './werewolf/dubai/Motion';
import { DX, serif, useDubaiFonts } from './werewolf/dubai/theme';

/**
 * IRLY Games: the platform's home. One card per game that can be played
 * today, with the server's real numbers, and « Play » that opens that game's
 * own home. Loup-Garou is a game inside IRLY Games; others will sit beside it.
 */
export function GamesHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fonts = useDubaiFonts();
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const account = useAccount();
  const signedIn = hasBackend && Boolean(account);
  const pageW = Math.min(width, 560);
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={[DX.night, DX.black, DX.black]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <GoldDust count={10} height={height} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32, alignItems: 'center' }} showsVerticalScrollIndicator={false}>
        <View style={[styles.top, { width: pageW }]}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={tx('Back')} style={styles.round} testID="games-back">
            <Icon name="arrowLeft" size={20} color={DX.goldLight} />
          </Pressable>
          {signedIn ? <Online /> : null}
        </View>
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(500)} style={[styles.heading, { width: pageW }]}>
          <Text style={[styles.title, serif(fonts, '900')]} accessibilityRole="header">
            {'IRLY GAMES 🎮'}
          </Text>
          <Text style={styles.subtitle}>{tx('Games to break the ice and meet people.')}</Text>
        </Animated.View>
        <View style={[styles.list, { width: pageW }]}>
          {GAMES.map((g, i) => (
            <Animated.View key={g.id} entering={reduced ? undefined : FadeInDown.delay(150 + i * 120).duration(500)}>
              <GameCard game={g} fonts={fonts} width={pageW - 32} signedIn={signedIn} onPlay={() => router.push(g.href)} />
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Online() {
  const { data } = useGamesOverview();
  useGamesPresence();
  if (!data || data.online <= 0) return null;
  return (
    <View style={styles.online}>
      <View style={styles.dot} />
      <Text style={styles.onlineText}>{tx('{n} online', { n: data.online })}</Text>
    </View>
  );
}

function Counts({ id }: { id: string }) {
  const { data } = useGamesOverview();
  const c: GameCount | undefined = data?.games.find((g) => g.game === id);
  const facts = [c?.in_game ? tx('{n} playing now', { n: c.in_game }) : null, c?.waiting ? tx('{n} games to join', { n: c.waiting }) : null].filter(Boolean);
  if (!facts.length) return null;
  return <Text style={styles.facts}>{facts.join(' · ')}</Text>;
}

const GameCard = memo(function GameCard({ game, fonts, width, signedIn, onPlay }: { game: GameEntry; fonts: boolean; width: number; signedIn: boolean; onPlay: () => void }) {
  const h = Math.round(Math.min(width * 1.12, 470));
  return (
    <PressableScale onPress={onPlay} haptic="press" scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${game.name}. ${tx(game.description)} ${tx('Play')}`} style={[styles.card, { width, height: h }]} testID={`game-${game.id}`}>
      <LivingScene source={game.art} />
      <Image source={game.art} style={styles.hidden} accessibilityLabel={tx(game.artLabel)} />
      <LinearGradient colors={['rgba(11,9,7,0)', 'rgba(11,9,7,0.25)', 'rgba(11,9,7,0.9)', 'rgba(11,9,7,0.98)']} locations={[0, 0.4, 0.72, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.copy}>
        <Text style={[styles.name, serif(fonts, '900')]}>{game.name}</Text>
        <Text style={styles.desc}>{tx(game.description)}</Text>
        {signedIn ? <Counts id={game.id} /> : null}
        <Breathe>
          <LinearGradient colors={[DX.goldLight, DX.gold, DX.goldDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.play}>
            <Icon name="play" size={18} color="#221506" />
            <Text style={[styles.playText, serif(fonts, '900')]}>{tx('Play')}</Text>
          </LinearGradient>
        </Breathe>
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge]} />
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DX.black },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, minHeight: 44 },
  round: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: DX.gold, backgroundColor: 'rgba(11,9,7,0.6)', alignItems: 'center', justifyContent: 'center' },
  online: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: DX.goldDark, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(11,9,7,0.6)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3FBF6F' },
  onlineText: { color: DX.ivory, fontSize: 12, fontWeight: '700' },
  heading: { paddingHorizontal: 16, paddingTop: 22, gap: 6 },
  title: { color: DX.goldLight, fontSize: 34, lineHeight: 40, letterSpacing: 1 },
  subtitle: { color: DX.muted, fontSize: 16, lineHeight: 22 },
  list: { paddingHorizontal: 16, paddingTop: 22, gap: 18 },
  card: { borderRadius: 26, overflow: 'hidden', backgroundColor: DX.black, justifyContent: 'flex-end' },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  copy: { padding: 18, gap: 8 },
  name: { color: DX.ivory, fontSize: 28, lineHeight: 34, letterSpacing: 1 },
  desc: { color: DX.muted, fontSize: 15, lineHeight: 21 },
  facts: { color: DX.goldLight, fontSize: 13 },
  play: { minHeight: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 6 },
  playText: { color: '#221506', fontSize: 17, letterSpacing: 2, textTransform: 'uppercase' },
  edge: { borderRadius: 26, borderWidth: 1.5, borderColor: DX.gold },
});
