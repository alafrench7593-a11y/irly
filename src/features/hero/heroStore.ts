import type { RefObject } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';

export type HeroKind = 'event' | 'session' | 'place' | 'community' | 'service' | 'editorial';
export type HeroItem = { kind: HeroKind; id: string };
export type Rect = { x: number; y: number; width: number; height: number };

type HeroState = {
  /** What should be open. `null` asks the host to close. */
  item: HeroItem | null;
  /** What is on screen, including during the closing animation. */
  active: HeroItem | null;
  origin: Rect | null;
  /** Window position of the hero host, subtracted from measured origins. */
  hostOffset: { x: number; y: number };
  open: (item: HeroItem, origin: Rect | null) => void;
  close: () => void;
  finish: () => void;
  setHostOffset: (o: { x: number; y: number }) => void;
};

export const useHeroStore = create<HeroState>((set) => ({
  item: null,
  active: null,
  origin: null,
  hostOffset: { x: 0, y: 0 },
  open: (item, origin) => set({ item, active: item, origin }),
  close: () => set({ item: null }),
  finish: () => set({ active: null, origin: null }),
  setHostOffset: (hostOffset) => set({ hostOffset }),
}));

/**
 * Opens a card into its full-screen detail. Pass the card's ref so the
 * transition starts exactly where the card sits on screen.
 */
export function openHero(item: HeroItem, ref?: RefObject<View | null>) {
  const node = ref?.current;
  const { hostOffset, open } = useHeroStore.getState();
  if (!node || typeof node.measureInWindow !== 'function') {
    open(item, null);
    return;
  }
  node.measureInWindow((x, y, width, height) => {
    if (!width || !height) {
      open(item, null);
      return;
    }
    open(item, { x: x - hostOffset.x, y: y - hostOffset.y, width, height });
  });
}

export function closeHero() {
  useHeroStore.getState().close();
}

/** True while this card is the one expanded (so the original can hide). */
export function useIsHeroSource(kind: HeroKind, id: string): boolean {
  return useHeroStore((s) => s.active?.kind === kind && s.active.id === id);
}
