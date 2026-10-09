import type { RefObject } from 'react';
import type { View } from 'react-native';
import { create } from 'zustand';
import type { Visual } from '@/data/types';
import type { LightId } from '@/theme/lights';

export type ViewerPhoto = { uri: string } | { visual: Visual; light: LightId };
type Rect = { x: number; y: number; width: number; height: number };

type ViewerState = {
  /** What should be open. `null` asks the host to close. */
  photo: ViewerPhoto | null;
  /** What is on screen, kept through the closing animation. */
  shown: ViewerPhoto | null;
  origin: Rect | null;
  key: number;
  hostOffset: { x: number; y: number };
  open: (photo: ViewerPhoto, origin: Rect | null) => void;
  close: () => void;
  finish: () => void;
  setHostOffset: (o: { x: number; y: number }) => void;
};

export const usePhotoViewer = create<ViewerState>((set) => ({
  photo: null,
  shown: null,
  origin: null,
  key: 0,
  hostOffset: { x: 0, y: 0 },
  open: (photo, origin) => set((s) => ({ photo, shown: photo, origin, key: s.key + 1 })),
  close: () => set({ photo: null }),
  finish: () => set({ shown: null, origin: null }),
  setHostOffset: (hostOffset) => set({ hostOffset }),
}));

/**
 * Opens a photo full screen, growing out of the frame it sits in. Pass the
 * frame's ref so the photo starts exactly where it is on screen (and
 * returns there when closed).
 */
export function openPhoto(photo: ViewerPhoto, ref?: RefObject<View | null>) {
  const node = ref?.current;
  const { hostOffset, open } = usePhotoViewer.getState();
  if (!node || typeof node.measureInWindow !== 'function') {
    open(photo, null);
    return;
  }
  node.measureInWindow((x, y, width, height) => {
    open(photo, width && height ? { x: x - hostOffset.x, y: y - hostOffset.y, width, height } : null);
  });
}
