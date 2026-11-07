import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { ConversationView } from '@/features/messages/ConversationView';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The Chat tab: the community's conversation in the page (the same view as
 * Messages, as a pane), for members. The pane sits under the page header and
 * the tabs, so it sees no top inset of its own; `top` (from the top of the
 * screen) is also what the keyboard avoider must add, as it measures from the
 * pane, not from the screen.
 */
export function ChatPane({ conversationId, top }: { conversationId: string; top: number }) {
  const insets = useSafeAreaInsets();
  const inner = useMemo(() => ({ ...insets, top: 0 }), [insets]);
  return (
    <View style={[styles.fill, { top }]}>
      <SafeAreaInsetsContext.Provider value={inner}>
        <ConversationView id={conversationId} pane keyboardOffset={top} />
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}

/** Not a member (or no chat yet): what the chat is, and the way in. */
export function ChatInvite({ top, title, body, action, busy = false, onPress, extra }: { top: number; title: string; body: string; action?: string; busy?: boolean; onPress?: () => void; extra?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={[styles.fill, styles.center, { top }]}>
      <View style={styles.card}>
        <GlassLayer radius={radius.xl} />
        <View style={[styles.icon, { backgroundColor: t.c.overlay }]}>
          <Icon name="message" size={24} color={t.c.text} />
        </View>
        <Text variant="titleM" align="center">
          {title}
        </Text>
        <Text variant="body" tone="secondary" align="center">
          {body}
        </Text>
        {action && onPress ? <Button label={action} icon="users" loading={busy} onPress={onPress} /> : null}
        {extra}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.gutter },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl, overflow: 'hidden' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
