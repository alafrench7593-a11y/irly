import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { Photo } from '@/components/visual/Photo';
import type { LightId } from '@/theme/lights';
import { useTheme } from '@/theme/useTheme';
import { communityPhoto } from './official';

/**
 * A community at a glance: its photo with its emoji on a small badge, or
 * just the emoji when it has no photo.
 */
export function CommunityThumb({ topic, categoryId, emoji, light, size = 44, member }: { topic?: string | null; categoryId?: string | null; emoji?: string | null; light: LightId; size?: number; member?: boolean }) {
  const t = useTheme();
  const key = communityPhoto(topic, categoryId);
  const radius = Math.round(size * 0.3);
  if (!key) {
    return (
      <View style={[styles.plain, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.c.overlay }]}>
        {emoji ? <Text style={{ fontSize: size * 0.48 }}>{emoji}</Text> : <Icon name={member ? 'check' : 'users'} size={size * 0.42} color={t.c.text} />}
      </View>
    );
  }
  return (
    <View style={{ width: size, height: size }}>
      <Photo visual={{ photo: key }} light={light} style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }} width={240} />
      {emoji ? (
        <View style={[styles.badge, { backgroundColor: t.c.surface, borderColor: t.c.bg }]}>
          <Text style={{ fontSize: 11 }}>{emoji}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, bottom: -4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
