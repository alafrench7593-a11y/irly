import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/Text';
import type { Universe } from '@/features/universe/universe';
import { t as tx } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

/**
 * The names of IRLY's universes, as the owner wrote them: product names, the
 * same in English and French (shown raw, never through the dictionary, where
 * « Mom » would become « Maman »).
 */
export const UNIVERSE_NAME: Record<Universe, string> = { mixte: 'Mixte', girl: 'Girl', mom: 'Mom', network: 'Network' };

/** A small label saying which universe a chat or a notification belongs to. */
export const UniverseBadge = memo(function UniverseBadge({ universe }: { universe: Universe }) {
  const t = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: t.c.overlay }]} accessible accessibilityLabel={tx('Universe: {name}', { name: UNIVERSE_NAME[universe] })}>
      <Text variant="caption" tone="secondary" style={styles.text} raw>
        {UNIVERSE_NAME[universe]}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  badge: { height: 18, paddingHorizontal: 7, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 10, lineHeight: 13 },
});
