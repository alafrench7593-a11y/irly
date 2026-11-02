import { forwardRef, useRef, type ReactNode } from 'react';
import { Platform, Pressable, type AccessibilityRole, type AccessibilityState, type PressableProps, type StyleProp, type View, type ViewStyle } from 'react-native';
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
  /**
   * Lets presses follow each other as fast as the finger goes (steppers,
   * zoom). Otherwise a second press within `REPEAT_GAP` is the same tap
   * landing twice (a double tap, a bounce) and is dropped, so one tap
   * never pushes a screen twice, sends twice or pops two pages.
   */
  repeat?: boolean;
};

/** Below this gap, two presses on the same control are one accidental double tap. */
const REPEAT_GAP = 450;

const DISABLED = { opacity: 0.45 } as const;
/**
 * Web: react-native-web lets taps through a disabled Pressable
 * (pointer-events: box-none), so the extra taps on a busy Save or Post
 * landed on whatever lay underneath. A disabled control keeps its taps, as on phones.
 */
const DISABLED_WEB = { opacity: 0.45, pointerEvents: 'auto', cursor: 'auto' } as unknown as ViewStyle;

/** Roles whose chosen item is announced as selected; every other control (a toggle chip, a button) as pressed. */
const SELECT_ROLES = new Set<string>(['tab', 'option', 'menuitem', 'radio', 'gridcell', 'row']);

/**
 * Web: react-native-web ignores `accessibilityState`, so a chosen chip or
 * tab was never announced. Its `selected` / `checked` become the matching
 * aria attributes there (phones read `accessibilityState` directly).
 */
function webAria(role: AccessibilityRole | undefined, state: AccessibilityState | null | undefined): Record<string, boolean> | null {
  if (Platform.OS !== 'web' || !state) return null;
  const aria: Record<string, boolean> = {};
  if (state.selected != null) aria[SELECT_ROLES.has(role ?? 'button') ? 'aria-selected' : 'aria-pressed'] = state.selected;
  if (typeof state.checked === 'boolean') aria['aria-checked'] = state.checked;
  if (state.disabled != null) aria['aria-disabled'] = state.disabled;
  return aria;
}

/**
 * The base of every tappable surface: scales down on touch with a spring,
 * springs back on release, fires a haptic on press. Runs on the UI thread.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(function PressableScale(
  { scaleTo = pressScale, haptic = 'tap', repeat = false, onPressIn, onPressOut, onPress, style, children, disabled, accessibilityLabel, ...rest },
  ref,
) {
  const lang = useLang();
  const lastPress = useRef(0);
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
        if (!repeat) {
          const now = Date.now();
          if (now - lastPress.current < REPEAT_GAP) return;
          lastPress.current = now;
        }
        if (haptic) triggerHaptic(haptic);
        onPress?.(e);
      }}
      style={[style, animated, disabled ? (Platform.OS === 'web' ? DISABLED_WEB : DISABLED) : null]}
      {...webAria(rest.accessibilityRole ?? 'button', rest.accessibilityState)}
      {...rest}
      accessibilityLabel={localizeLabel(lang, accessibilityLabel)}
    >
      {children}
    </AnimatedPressable>
  );
});
