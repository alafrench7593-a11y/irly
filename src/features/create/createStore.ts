import { create } from 'zustand';
import type { CategoryKey } from '@/data/catalog/categories';

/** What the member is creating. Every format becomes a session with its own chat. */
export type CreateFormat = 'activity' | 'sport' | 'event' | 'session' | 'meetup' | 'trip';

export type CreatePreset = { categoryId?: CategoryKey; subId?: string; activityId?: string; format?: CreateFormat };

type CreateState = {
  open: boolean;
  /** Centre of the button the composer grows from, in host coordinates. */
  origin: { x: number; y: number } | null;
  /** Opened from a category, an activity or a format: the composer starts there. */
  preset: CreatePreset | null;
  show: (origin?: { x: number; y: number } | null, preset?: CreatePreset | null) => void;
  hide: () => void;
};

export const useCreateStore = create<CreateState>((set) => ({
  open: false,
  origin: null,
  preset: null,
  show: (origin, preset) => set({ open: true, origin: origin ?? null, preset: preset ?? null }),
  hide: () => set({ open: false }),
}));

/** Opens the composer, growing from `origin` when given, starting from `preset`. */
export function openCreate(origin?: { x: number; y: number } | null, preset?: CreatePreset | null) {
  useCreateStore.getState().show(origin, preset);
}
