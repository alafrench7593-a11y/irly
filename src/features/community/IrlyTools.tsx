import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { a11y, t as tx } from '@/i18n';
import { haptic } from '@/motion/haptics';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { irlyAnnounce, irlyChatMessage } from './irly';

/**
 * The IRLY team's tools in an official community (shown when the server
 * says can_irly): publish a post, announce, write in the chat, all signed
 * « IRLY » (pins are on each post). Nothing here is under the person's name.
 */
export function IrlyTools({ communityId, name, onChanged }: { communityId: string; name: string; onChanged: () => void }) {
  const router = useRouter();
  const [sheet, setSheet] = useState<'announce' | 'chat' | null>(null);
  return (
    <View style={[styles.tools, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.row}>
        <IrlyBadge size={28} />
        <View style={{ flex: 1 }}>
          <Text variant="titleS">Publish as IRLY</Text>
          <Text variant="caption" tone="tertiary">
            Members see IRLY, not your name. Each action is kept in the moderation log.
          </Text>
        </View>
      </View>
      <View style={styles.wrap}>
        <Chip size="sm" icon="edit" label={tx('Post as IRLY')} onPress={() => router.push({ pathname: '/post/new', params: { community: communityId, name, asIrly: '1' } })} />
        <Chip size="sm" icon="megaphone" label={tx('Announce as IRLY')} onPress={() => setSheet('announce')} />
        <Chip size="sm" icon="message" label={tx('Write in the chat as IRLY')} onPress={() => setSheet('chat')} />
      </View>
      <IrlyAnnounceSheet visible={sheet === 'announce'} communityId={communityId} name={name} onClose={() => setSheet(null)} onSent={onChanged} />
      <IrlyChatSheet visible={sheet === 'chat'} communityId={communityId} name={name} onClose={() => setSheet(null)} onSent={onChanged} />
    </View>
  );
}

/** IRLY's round badge, where a member's photo would be. */
export function IrlyBadge({ size = 36 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.text }]} accessibilityLabel={a11y('IRLY')}>
      <Text variant="caption" color={t.c.bg} style={{ fontFamily: font.bold, fontSize: Math.max(9, size * 0.3) }}>
        IRLY
      </Text>
    </View>
  );
}

function IrlyAnnounceSheet({ visible, communityId, name, onClose, onSent }: { visible: boolean; communityId: string; name: string; onClose: () => void; onSent: () => void }) {
  const t = useTheme();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'announcement' | 'event' | 'info'>('announcement');
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (busy || body.trim().length < 3) return;
    setBusy(true);
    try {
      const n = await irlyAnnounce(communityId, body, kind, pin);
      haptic('success');
      toast(tx('Sent to {n} members', { n }), 'megaphone', 'brand');
      setBody('');
      onSent();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={tx('Announce as IRLY')} subtitle={tx('Every member of {name} is told, signed IRLY.', { name })} scroll>
      <View style={styles.sheet}>
        <View style={styles.wrap}>
          <Chip size="sm" label={tx('Announcement')} selected={kind === 'announcement'} onPress={() => setKind('announcement')} />
          <Chip size="sm" label={tx('Event')} selected={kind === 'event'} onPress={() => setKind('event')} />
          <Chip size="sm" label={tx('Practical info')} selected={kind === 'info'} onPress={() => setKind('info')} />
        </View>
        <TextInput
          value={body}
          onChangeText={(v) => setBody(v.slice(0, 500))}
          multiline
          placeholder={tx('What should everyone know?')}
          placeholderTextColor={t.c.textTertiary}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('Announcement')}
        />
        <Chip size="sm" icon="pinPost" label={tx('Pin it at the top')} selected={pin} onPress={() => setPin(!pin)} />
        <Text variant="caption" tone="tertiary">
          At most 3 a day, one per hour, never the same text twice in a week.
        </Text>
        <Button label="Send to everyone" icon="megaphone" full loading={busy} disabled={body.trim().length < 3} onPress={send} />
      </View>
    </Sheet>
  );
}

function IrlyChatSheet({ visible, communityId, name, onClose, onSent }: { visible: boolean; communityId: string; name: string; onClose: () => void; onSent: () => void }) {
  const t = useTheme();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      await irlyChatMessage(communityId, body);
      haptic('success');
      toast('Sent in the chat as IRLY', 'send', 'brand');
      setBody('');
      onSent();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={tx('Write in the chat as IRLY')} subtitle={tx('The message shows in the chat of {name} as IRLY’s.', { name })} scroll>
      <View style={styles.sheet}>
        <TextInput
          value={body}
          onChangeText={(v) => setBody(v.slice(0, 2000))}
          multiline
          placeholder={tx('Your message')}
          placeholderTextColor={t.c.textTertiary}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('Your message')}
        />
        <View style={styles.row}>
          <Icon name="shield" size={14} color={t.c.textTertiary} />
          <Text variant="caption" tone="tertiary" style={{ flex: 1 }}>
            No notification is sent for it: use an announcement to tell everyone.
          </Text>
        </View>
        <Button label="Send" icon="send" full loading={busy} disabled={!body.trim()} onPress={send} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tools: { marginHorizontal: space.gutter, padding: 14, borderRadius: radius.xl, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheet: { paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[2] },
  badge: { alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 110, borderRadius: radius.lg, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
});
