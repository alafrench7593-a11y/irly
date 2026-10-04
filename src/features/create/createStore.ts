import { create } from 'zustand';

type CreateState = {
  open: boolean;
  /** Centre of the button the composer grows from, in host coordinates. */
  origin: { x: number; y: number } | null;
  show: (origin?: { x: number; y: number } | null) => void;
  hide: () => void;
};

export const useCreateStore = create<CreateState>((set) => ({
  open: false,
  origin: null,
  show: (origin) => set({ open: true, origin: origin ?? null }),
  hide: () => set({ open: false }),
}));

/** Opens "Create an activity", growing from `origin` when given. */
export function openCreate(origin?: { x: number; y: number } | null) {
  useCreateStore.getState().show(origin);
}
