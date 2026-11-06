import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { radius } from '@/theme/tokens';
import { girl } from './theme';

/**
 * « Moderation view »: on every screen of the IRLY Girl safety moderator's
 * view. Read-only, and each opening is written to the staff journal.
 */
export function ModerationBanner() {
  return (
    <View style={[styles.banner, { backgroundColor: girl.blush }]} accessibilityRole="summary">
      <Icon name="eye" size={16} color={girl.rose} />
      <View style={{ flex: 1 }}>
        <Text variant="titleS" color={girl.ink}>
          Moderation view
        </Text>
        <Text variant="caption" color={girl.inkSoft}>
          Read-only. Each opening is written to the moderation log. Members are not told.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg },
});
