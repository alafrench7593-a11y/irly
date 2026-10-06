import type { View } from 'react-native';
import { create } from 'zustand';

export type Rect = { x: number; y: number; width: number; height: number };
export type Flight = { personId: string; name: string; hue: number; from: Rect; to?: Rect };

type FlightState = {
  flight: Flight | null;
  /** Window offset of the overlay (the phone column on desktop). */
  hostOffset: { x: number; y: number };
  launch: (f: Flight) => void;
  land: (personId: string, to: Rect) => void;
  clear: () => void;
  setHostOffset: (o: { x: number; y: number }) => void;
};

/**
 * Avatar → profile. The tapped face takes off from where it is (a bubble,
 * a card), the profile page fades in and the same face flies into its
 * place at the top of the page, growing on the way.
 */
export const useAvatarFlight = create<FlightState>((set, get) => ({
  flight: null,
  hostOffset: { x: 0, y: 0 },
  launch: (flight) => set({ flight }),
  land: (personId, to) => {
    const f = get().flight;
    if (f && f.personId === personId && !f.to) set({ flight: { ...f, to } });
  },
  clear: () => set({ flight: null }),
  setHostOffset: (hostOffset) => set({ hostOffset }),
}));

/** Measures a face on screen and takes off, then runs `go` (the navigation). */
export function flyFrom(ref: View | null, person: { id: string; name: string; hue: number }, go: () => void) {
  if (!ref?.measureInWindow) {
    go();
    return;
  }
  ref.measureInWindow((x, y, width, height) => {
    const { hostOffset, launch } = useAvatarFlight.getState();
    if (width > 0) launch({ personId: person.id, name: person.name, hue: person.hue, from: { x: x - hostOffset.x, y: y - hostOffset.y, width, height } });
    go();
  });
}

/** True while a face is flying to this person's page: the page keeps its own avatar hidden. */
export function useFlyingTo(personId: string): boolean {
  return useAvatarFlight((s) => s.flight?.personId === personId);
}
