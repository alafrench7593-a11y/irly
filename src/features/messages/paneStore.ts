import { create } from 'zustand';

/**
 * The conversation chosen in Messages. Outside the screens on purpose: a
 * window that folds, unfolds or is resized keeps it, so the wide layout
 * shows the same chat in its pane and the phone layout opens it as a page.
 * Memory only: a new launch starts on the list.
 */
type MessagesPane = {
  selected: string | null;
  select: (id: string | null) => void;
};

export const useMessagesPane = create<MessagesPane>((set) => ({
  selected: null,
  select: (selected) => set({ selected }),
}));

/** A chat that was left (blocked, archived, deleted, group left) is no longer the chosen one. */
export function forgetConversation(id: string) {
  if (useMessagesPane.getState().selected === id) useMessagesPane.getState().select(null);
}
