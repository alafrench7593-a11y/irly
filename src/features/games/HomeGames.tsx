import { useRouter } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useAccount } from '@/features/auth/account';
import { t as tx } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { useGamesOverview } from './api';

/**
 * The way into IRLY Games from the Home: one quiet row, the platform's name
 * and what it is for. No game is promoted here (Loup-Garou lives inside
 * IRLY Games, with its illustration, modes and rules). The number of members
 * online is the server's, shown only when there are some.
 */
export const HomeGames = memo(function HomeGames() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const signedIn = hasBackend && Boolean(account);
  return (
    <View style={styles.root}>
      <PressableScale haptic="select" scaleTo={0.98} onPress={() => router.push('/games')} accessibilityRole="button" accessibilityLabel={`IRLY Games. ${tx('Games to break the ice and meet people.')}`} testID="home-games">
        <View style={[styles.row, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
          <View style={[styles.icon, { backgroundColor: t.c.bg }]}>
            <Icon name="gamepad" size={20} color={t.c.text} />
          </View>
          <View style={styles.copy}>
            <Text variant="titleS">IRLY Games</Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              Games to break the ice and meet people.
            </Text>
          </View>
          {signedIn ? <Online /> : null}
          <Icon name="chevronRight" size={18} color={t.c.textTertiary} />
        </View>
      </PressableScale>
    </View>
  );
});

function Online() {
  const t = useTheme();
  const { data } = useGamesOverview();
  const online = data?.online ?? 0;
  if (online <= 0) return null;
  return (
    <View style={styles.online}>
      <View style={[styles.dot, { backgroundColor: t.c.positive }]} />
      <Text variant="caption" tone="secondary" raw>
        {tx('{n} online', { n: online })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingTop: space[6], paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[5], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  online: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
