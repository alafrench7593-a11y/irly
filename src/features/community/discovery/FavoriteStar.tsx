import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { duration, spring } from '@/motion/tokens';
import { useTheme } from '@/theme/useTheme';
import { toggleFavorite, useFavorites, useIsFavorite } from './directory';

/**
 * The star of a community card: one tap pins it first in « My communities »,
 * at once; the server confirms, or the star goes back as it was.
 */
export const FavoriteStar = memo(function FavoriteStar({ id, name, known }: { id: string; name: string; known: boolean | null | undefined }) {
  const t = useTheme();
  const on = useIsFavorite(id, known);
  const pending = useFavorites((s) => Boolean(s.pending[id]));
  const pop = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const press = () => {
    if (pending) return;
    pop.set(withSequence(withTiming(1.28, { duration: duration.micro }), withSpring(1, spring.strong)));
    void toggleFavorite(id, on, name);
  };
  const color = on ? t.accent : t.c.textTertiary;
  return (
    <PressableScale
      onPress={press}
      haptic="select"
      scaleTo={0.9}
      hitSlop={8}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityState={{ selected: on, busy: pending }}
      accessibilityLabel={on ? tx('Remove {name} from favourites', { name }) : tx('Add {name} to favourites', { name })}
      testID={`favorite-${id}`}
    >
      <Animated.View style={style}>
        <Icon name="star" size={18} color={color} fill={on ? color : undefined} strokeWidth={on ? 2 : 1.75} />
      </Animated.View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  hit: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
