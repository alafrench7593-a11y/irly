import { create } from 'zustand';

type IrlMenuState = { open: boolean; show: () => void; hide: () => void };

/**
 * The IRL menu is one overlay for the whole app: the central button of the
 * tab bar opens it, other surfaces (Home, empty states) can too.
 */
export const useIrlMenu = create<IrlMenuState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

export function openIrlMenu() {
  useIrlMenu.getState().show();
}
