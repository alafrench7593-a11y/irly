import { Platform } from 'react-native';
import { useAnimatedKeyboard, useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Keyboard height as a shared value (0 on web, where the browser resizes the
 * page itself). Android is edge-to-edge since SDK 54, so the window no longer
 * shrinks for the keyboard: bottom-anchored UI must lift itself.
 */
function useNativeKeyboardHeight(): SharedValue<number> {
  return useAnimatedKeyboard().height;
}
function useWebKeyboardHeight(): SharedValue<number> {
  return useSharedValue(0);
}
export const useKeyboardHeight = Platform.OS === 'web' ? useWebKeyboardHeight : useNativeKeyboardHeight;
