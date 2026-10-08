import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * One haptic vocabulary for the whole app. Screens call `haptic('select')`
 * and never talk to the platform directly.
 *
 * - iOS / Android: expo-haptics (Taptic Engine / vibrator).
 * - Android web: Vibration API.
 * - iOS 18+ Safari: toggling a native switch input triggers a system haptic,
 *   so we keep a hidden one around. Must run inside a user gesture.
 */
export type HapticKind = 'select' | 'tap' | 'press' | 'heavy' | 'success' | 'warning' | 'error';

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

const webPatterns: Record<HapticKind, number | number[]> = {
  select: 6,
  tap: 8,
  press: 12,
  heavy: 18,
  success: [10, 40, 14],
  warning: [14, 60, 14],
  error: [20, 50, 20, 50, 20],
};

let webSwitch: any = null;

function webHaptic(kind: HapticKind) {
  const g = globalThis as any;
  const nav = g.navigator;
  // Browsers only allow haptics inside a user gesture.
  if (nav?.userActivation && !nav.userActivation.isActive) return;
  if (nav && typeof nav.vibrate === 'function') {
    try {
      nav.vibrate(webPatterns[kind]);
      return;
    } catch {
      // fall through to the iOS switch technique
    }
  }
  const doc = g.document;
  if (!doc || !doc.body) return;
  // Never while typing: the hidden switch below would take the focus from the field.
  const active = doc.activeElement as HTMLElement | null;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
  try {
    if (!webSwitch) {
      const label = doc.createElement('label');
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText =
        'position:fixed;left:-20px;top:-20px;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none;';
      const input = doc.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.appendChild(input);
      doc.body.appendChild(label);
      webSwitch = label;
    }
    webSwitch.click();
    // The click can move the focus to the switch: give it back.
    if (active && doc.activeElement !== active && typeof active.focus === 'function') active.focus({ preventScroll: true });
  } catch {
    // Haptics are a nicety; never let them break an interaction.
  }
}

export function haptic(kind: HapticKind = 'tap') {
  if (!enabled) return;
  if (Platform.OS === 'web') {
    webHaptic(kind);
    return;
  }
  const run = () => {
    switch (kind) {
      case 'select':
        return Haptics.selectionAsync();
      case 'tap':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'press':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'heavy':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      case 'error':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };
  run()?.catch(() => undefined);
}
