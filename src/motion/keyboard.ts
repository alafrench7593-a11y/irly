import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Current keyboard height in px (0 on web, where the browser resizes the
 * page itself). Uses Keyboard events rather than Reanimated's
 * useAnimatedKeyboard, which does not see the keyboard inside an Android
 * Modal (a separate window). Android is edge-to-edge since SDK 54, so
 * bottom-anchored UI must lift itself.
 */
export function useKeyboardHeight(enabled = true): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
      setHeight(0);
    };
  }, [enabled]);
  return height;
}
