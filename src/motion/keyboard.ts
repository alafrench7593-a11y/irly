import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

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
    // iOS: the keyboard also changes height while it is up (predictive bar, emoji, another language,
    // autofill bar) without a new show event; follow every frame change, a frame below the screen is hidden.
    const change =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillChangeFrame', (e) => {
            const { height: h, screenY } = e.endCoordinates;
            setHeight(screenY >= Dimensions.get('screen').height ? 0 : h);
          })
        : null;
    return () => {
      show.remove();
      hide.remove();
      change?.remove();
      setHeight(0);
    };
  }, [enabled]);
  return height;
}
