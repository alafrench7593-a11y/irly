import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomIn, ZoomOut, useReducedMotion } from 'react-native-reanimated';
import { Glass } from '@/components/ui/Glass';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { duration } from '@/motion/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Floating on the posts: « Publish » (the composer for photos, video and
 * text) and « New posts », when others posted while you read further down.
 */

export function PublishButton({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.springify(420).dampingRatio(0.75)} exiting={reduced ? undefined : ZoomOut.duration(duration.fast)} style={[styles.fabWrap, { bottom }]} pointerEvents="box-none">
      <PressableScale haptic="tap" scaleTo={0.94} onPress={onPress} style={[styles.fab, { backgroundColor: t.c.brand, boxShadow: t.shadow.card }]} accessibilityRole="button" accessibilityLabel="Publish" testID="community-publish">
        <Icon name="edit" size={18} color={t.c.onBrand} />
        <Text variant="label" color={t.c.onBrand}>
          Publish
        </Text>
      </PressableScale>
    </Animated.View>
  );
}

export function NewPostsPill({ count, onPress, top }: { count: number; onPress: () => void; top: number }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  if (!count) return null;
  return (
    <View style={[styles.pillWrap, { top }]} pointerEvents="box-none">
      <Animated.View entering={reduced ? undefined : FadeInUp.springify(420).dampingRatio(0.85)} exiting={reduced ? undefined : FadeOutUp.duration(duration.fast)}>
        <PressableScale haptic="select" scaleTo={0.95} onPress={onPress} style={[styles.pill, { boxShadow: t.shadow.card }]} accessibilityRole="button" accessibilityLabel={tx('New posts')}>
          <Glass style={StyleSheet.absoluteFill} border={false} intensity={70} />
          <Icon name="chevronUp" size={14} color={t.c.text} />
          <Text variant="label">{count === 1 ? tx('1 new post') : tx('{n} new posts', { n: count })}</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 20 },
  fab: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingHorizontal: 20, borderRadius: 25 },
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, overflow: 'hidden' },
});
