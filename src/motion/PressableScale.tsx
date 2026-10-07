import { forwardRef, type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { localizeLabel, useLang } from '@/i18n';
import { haptic as triggerHaptic, type HapticKind } from './haptics';
import { pressScale, spring } from './tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Target scale while pressed. Cards use 0.97, small controls 0.92. */
  scaleTo?: number;
  /** Haptic fired on press. `false` to stay silent. */
  haptic?: HapticKind | false;
};

/**
 * The base of every tappable surface: scales down on touch with a spring,
 * springs back on release, fires a haptic on press. Runs on the UI thread.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = pressScale, haptic = 'tap', onPressIn, onPressOut, onPress, style, children, disabled, accessibilityLabel, ...rest },
  ref,
) {
  const lang = useLang();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, spring.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, spring.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic) triggerHaptic(haptic);
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: 0.45 } : null]}
      {...rest}
      accessibilityLabel={localizeLabel(lang, accessibilityLabel)}
    >
      {children}
    </AnimatedPressable>
  );
});
