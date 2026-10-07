import { t as tx } from '@/i18n';
import { Alert, Platform } from 'react-native';

/** Asks before a destructive action (native alert, browser confirm on web). */
export function confirm(question: string, onYes: () => void, yes = 'Delete'): void {
  const q = tx(question);
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(q)) onYes();
    return;
  }
  Alert.alert(q, undefined, [
    { text: tx('Cancel'), style: 'cancel' },
    { text: tx(yes), style: 'destructive', onPress: onYes },
  ]);
}
