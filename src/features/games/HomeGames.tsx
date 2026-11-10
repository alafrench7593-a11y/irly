import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useGamesOverview, type GameCount } from './api';
import { gamesLine } from './lines';

/**
 * « IRLY Games » on the Home: a line that fits the hour, and one card per
 * game with the server's real counts (nothing shown when there is nothing:
 * never a made-up player or game). Hidden in the demo and when signed out.
 */
export const HomeGames = memo(function HomeGames() {
  const account = useAccount();
  if (!hasBackend || !account) return null;
  return <Inner />;
});

function Inner() {
  const t = useTheme();
  const router = useRouter();
  const now = useNow(60_000);
  const { data } = useGamesOverview();
  const line = useMemo(() => gamesLine(new Date(now).getHours(), now), [now]);
  const wolves = data?.games.find((g) => g.game === 'werewolf');
  const online = data?.online ?? 0;

  return (
    <View style={styles.root}>
      <PressableScale haptic="select" scaleTo={0.99} onPress={() => router.push('/games')} accessibilityRole="button" accessibilityLabel={tx('IRLY Games')}>
        <View style={styles.head}>
          <Icon name="gamepad" size={18} color={t.c.text} />
          <Text variant="titleM" style={{ flex: 1 }}>
            IRLY Games
          </Text>
          {online > 0 ? (
            <View style={styles.online}>
              <View style={[styles.dot, { backgroundColor: t.c.positive }]} />
              <Text variant="caption" tone="secondary" raw>
                {tx('{n} online', { n: online })}
              </Text>
            </View>
          ) : null}
          <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
        </View>
      </PressableScale>
      <View style={[styles.line, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
        <Text variant="bodyL" style={styles.lineTitle} raw>
          {tx(line.title)}
        </Text>
        <Text tone="secondary" raw>
          {tx(line.body)}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        <GameCard emoji="🐺" name="Loup-Garou" subtitle="Classic, Dubai, Chaos · online, in person or against AI" count={wolves} playLabel="Play" onPlay={() => router.push('/games')} onOpen={() => router.push('/games')} />
      </ScrollView>
    </View>
  );
}

const GameCard = memo(function GameCard({
  emoji,
  name,
  subtitle,
  count,
  soon,
  playLabel,
  onPlay,
  onOpen,
}: {
  emoji: string;
  name: string;
  subtitle: string;
  count?: GameCount;
  soon?: boolean;
  playLabel?: string;
  onPlay?: () => void;
  onOpen: () => void;
}) {
  const t = useTheme();
  const facts: string[] = [];
  if (count?.in_game) facts.push(tx('{n} playing now', { n: count.in_game }));
  if (count?.waiting) facts.push(tx('{n} games to join', { n: count.waiting }));
  if (count?.open_seats) facts.push(tx('{n} free seats', { n: count.open_seats }));
  return (
    <PressableScale haptic="select" scaleTo={0.98} onPress={onOpen} accessibilityRole="button" accessibilityLabel={name} style={[styles.card, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Text style={styles.emoji} raw>
        {emoji}
      </Text>
      <Text variant="titleS" raw>
        {name}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {subtitle}
      </Text>
      <View style={styles.facts}>
        {soon ? (
          <Text variant="caption" tone="tertiary">
            Opens soon
          </Text>
        ) : facts.length ? (
          facts.map((f) => (
            <Text key={f} variant="caption" tone="secondary" raw>
              {f}
            </Text>
          ))
        ) : (
          <Text variant="caption" tone="tertiary">
            No game yet: start one
          </Text>
        )}
      </View>
      {onPlay && !soon ? <Button label={playLabel ?? (count?.waiting ? 'Join a game' : 'Play now')} size="sm" icon="play" onPress={onPlay} /> : null}
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  root: { gap: space[4], paddingTop: space[6] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space.gutter },
  online: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 7, height: 7, borderRadius: 4 },
  line: { marginHorizontal: space.gutter, padding: space[5], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: space[2] },
  lineTitle: { fontWeight: '700' },
  rail: { paddingHorizontal: space.gutter, gap: space[4] },
  card: { width: 210, padding: space[5], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, gap: space[2] },
  emoji: { fontSize: 34, lineHeight: 40 },
  facts: { minHeight: 48, gap: 2, marginVertical: space[2] },
});
