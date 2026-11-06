import { createContext, useContext } from 'react';

export type Frame = { width: number; height: number; framed: boolean };

export const FrameContext = createContext<Frame>({ width: 390, height: 844, framed: false });

/** Size of the space this page is given. Use instead of the window size. */
export function useFrame(): Frame {
  return useContext(FrameContext);
}
