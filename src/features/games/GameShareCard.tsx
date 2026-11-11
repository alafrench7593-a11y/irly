import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { Text as ThemedText } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { joinSharedGame, useGameShare, type GameShareStatus } from './share';
import { MODE_LABEL, toMode } from './werewolf/cards';
import { SCENES } from './werewolf/dubai/art';
import { DX } from './werewolf/dubai/theme';

const STATUS: Record<GameShareStatus, { label: string; color: string }> = {
  waiting: { label: 'Waiting', color: '#6FD08C' },
  full: { label: 'Full', color: DX.gold },
  playing: { label: 'In progress', color: '#7CB6FF' },
  finished: { label: 'Finished', color: DX.muted },
  cancelled: { label: 'Cancelled', color: DX.redLight },
};

/**
 * A shared game inside a post (a community's page, the Live): the mode's
 * scene, who created it, the real number of players, text or voice, the
 * status, and one button that enters that very room. Nothing is shown while
 * the game is being read; one quiet line when the post's game is no longer
 * there for the reader.
 */
export const GameShareCard = memo(function GameShareCard({ postId }: { postId: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { card, loaded, reload } = useGameShare(postId);
  const [busy, setBusy] = useState(false);
  if (!card) {
    return loaded ? (
      <ThemedText variant="caption" tone="tertiary" testID="game-share-gone">
        {tx('This game is no longer available')}
      </ThemedText>
    ) : null;
  }
  const mode = toMode(card.mode);
  const st = STATUS[card.status];
  const open = () => router.push(`/games/${card.room_id}`);
  const join = () => {
    if (busy) return;
    setBusy(true);
    joinSharedGame(postId)
      .then(open)
      .catch((e: unknown) => {
        toast(e instanceof Error ? tx(e.message) : tx('Try again'), 'x', 'live');
        reload();
      })
      .finally(() => setBusy(false));
  };
  const left = Math.max(0, card.max - card.players);
  const action = card.mine && (card.status === 'waiting' || card.status === 'full' || card.status === 'playing') ? { label: 'Return to the game', onPress: open } : card.status === 'waiting' ? { label: 'Join the game', onPress: join } : null;
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.duration(240)} style={styles.card} testID="game-share">
      <Image source={SCENES[mode].home} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="top" accessibilityIgnoresInvertColors />
      <LinearGradient colors={['rgba(11,9,7,0.35)', 'rgba(11,9,7,0.78)', 'rgba(11,9,7,0.96)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.body}>
        <Text style={styles.title} accessibilityRole="header">
          {`🐺 LOUP-GAROU — ${tx(MODE_LABEL[mode]).toUpperCase()}`}
        </Text>
        {card.title ? (
          <Text style={styles.name} numberOfLines={1}>
            {card.title}
          </Text>
        ) : null}
        <Text style={styles.line}>{tx('Created by {name}', { name: card.host ?? tx('A member') })}</Text>
        <Text style={styles.line} testID="game-share-players">
          {`👥 ${tx('{n}/{max} players', { n: card.players, max: card.max })}${card.status === 'waiting' ? ` · ${tx('{n} seats left', { n: left })}` : ''}`}
        </Text>
        <Text style={styles.line}>{card.comm === 'voice' ? tx('🎙️ Voice on') : tx('💬 Written chat')}</Text>
        <View style={styles.status}>
          <View style={[styles.dot, { backgroundColor: st.color }]} />
          <Text style={[styles.statusText, { color: st.color }]} testID="game-share-status">
            {tx(st.label)}
          </Text>
        </View>
        {action ? (
          <PressableScale onPress={action.onPress} disabled={busy} haptic="press" scaleTo={0.97} accessibilityRole="button" accessibilityLabel={tx(action.label)} style={[styles.button, busy ? styles.busy : null]} testID="game-share-join">
            <Text style={styles.buttonText}>{tx(action.label)}</Text>
          </PressableScale>
        ) : null}
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge]} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 18, overflow: 'hidden', backgroundColor: DX.black },
  body: { padding: 14, gap: 5 },
  title: { color: DX.goldLight, fontSize: 15, fontWeight: '800', letterSpacing: 0.6 },
  name: { color: DX.ivory, fontSize: 15, fontWeight: '700' },
  line: { color: DX.ivory, fontSize: 14, lineHeight: 20 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700' },
  button: { marginTop: 8, minHeight: 48, borderRadius: 14, backgroundColor: DX.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  busy: { opacity: 0.6 },
  buttonText: { color: '#221506', fontSize: 15, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  edge: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(226,182,83,0.55)' },
});
