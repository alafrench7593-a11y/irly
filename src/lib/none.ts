/**
 * One shared empty list. Hooks return it when signed out instead of a new
 * `[]` per render: a fresh array in an effect's dependencies re-runs the
 * effect on every render (Saved froze the app in a set-state loop).
 */
export const NONE: never[] = [];
