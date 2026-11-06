import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

/** What a card says when the server gave no count: never a guessed number. */
const UNKNOWN = '—';

/**
 * A community's two real counts: its members and its upcoming activities.
 * null means the server did not say, and the card shows « — ».
 */
export const CommunityStats = memo(function CommunityStats({ members, upcoming }: { members: number | null; upcoming: number | null }) {
  return (
    <View style={styles.row}>
      <Stat icon="users" value={members} label={members == null ? tx('Member count unknown') : tx('{n} members', { n: members })} />
      <Stat icon="calendar" value={upcoming} label={upcoming == null ? tx('Upcoming activities unknown') : tx('{n} upcoming activities', { n: upcoming })} />
    </View>
  );
});

function Stat({ icon, value, label }: { icon: IconName; value: number | null; label: string }) {
  const t = useTheme();
  return (
    <View style={styles.stat} accessible accessibilityLabel={label}>
      <Icon name={icon} size={13} color={t.c.textTertiary} />
      <Text variant="caption" tone={value ? 'secondary' : 'tertiary'} raw>
        {value == null ? UNKNOWN : String(value)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
