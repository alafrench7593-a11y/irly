import { useCallback, useRef } from 'react';
import type { View } from 'react-native';
import { openHero, useIsHeroSource, type HeroKind } from './heroStore';

/**
 * Wires a card to the hero transition: a ref to measure from, a press
 * handler that opens the detail, and a flag to hide the card while its
 * expanded twin is on screen (so the photo never appears twice).
 */
export function useHeroCard(kind: HeroKind, id: string) {
  const ref = useRef<View>(null);
  const hidden = useIsHeroSource(kind, id);
  const onPress = useCallback(() => openHero({ kind, id }, ref), [kind, id]);
  return { ref, onPress, hidden };
}
