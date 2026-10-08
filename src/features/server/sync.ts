import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';
import { useAccount } from '@/features/auth/account';
import { supabase, topic } from '@/lib/supabase';

/**
 * One living system. The server is the only source of truth; screens never
 * keep their own copy of a fact. Every server-backed hook reads one of these
 * versions, and a version moves whenever that kind of data changes, by
 * anyone, anywhere:
 *   · your own actions (create, edit, join, leave, delete) call changed();
 *   · everyone else's arrive through ONE realtime channel (SyncBridge),
 *     mounted once for the whole app;
 *   · coming back to the app, or back online, refreshes everything once.
 * So an activity created, joined, renamed or deleted on one screen (or on
 * another phone) shows up, updated, on every screen that shows it.
 */
export type SyncKind = 'activities' | 'communities' | 'inbox' | 'people' | 'saved' | 'notifs';
const KINDS: SyncKind[] = ['activities', 'communities', 'inbox', 'people', 'saved', 'notifs'];

type Versions = Record<SyncKind, number> & { online: boolean };
const useVersions = create<Versions>(() => ({ activities: 0, communities: 0, inbox: 0, people: 0, saved: 0, notifs: 0, online: true }));

/** The version of a kind of data: put it in an effect's dependencies to reload when it changes. */
export const useSyncVersion = (kind: SyncKind) => useVersions((s) => s[kind]);
/** False while the device is offline (web), so screens can say "will sync". */
export const useOnline = () => useVersions((s) => s.online);

// Bursts (ten people joining, a big cascade) become one reload per kind.
const pending = new Set<SyncKind>();
let timer: ReturnType<typeof setTimeout> | null = null;
const flush = () => {
  timer = null;
  const next = { ...useVersions.getState() };
  pending.forEach((k) => (next[k] += 1));
  pending.clear();
  useVersions.setState(next);
};

/** Something of these kinds changed: every screen showing them reloads. */
export function changed(...kinds: SyncKind[]) {
  kinds.forEach((k) => pending.add(k));
  if (!timer) timer = setTimeout(flush, 120);
}
export const changedAll = () => changed(...KINDS);

/**
 * The app's single realtime channel. Row-level security decides what each
 * member hears; filters keep personal tables personal.
 */
export function SyncBridge() {
  const uid = useAccount()?.userId;
  useEffect(() => {
    if (!supabase || !uid) return;
    let first = true;
    const channel = supabase
      .channel(topic(`sync:${uid}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => changed('activities'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_participants' }, () => changed('activities'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'communities' }, () => changed('communities', 'inbox'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_members' }, () => changed('communities'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${uid}` }, () => changed('inbox', 'activities', 'communities'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversations' }, () => changed('inbox'))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => changed('people'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saves', filter: `user_id=eq.${uid}` }, () => changed('saved'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () => changed('notifs'))
      .subscribe((status) => {
        // A (re)connection may have missed events: catch up once.
        if (status === 'SUBSCRIBED') {
          if (!first) changedAll();
          first = false;
        }
      });
    // Back to the app: whatever happened meanwhile.
    const app = AppState.addEventListener('change', (s) => s === 'active' && changedAll());
    // Back online (web): resync; offline: screens can say so.
    const online = () => {
      useVersions.setState({ online: true });
      changedAll();
    };
    const offline = () => useVersions.setState({ online: false });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      useVersions.setState({ online: navigator.onLine !== false });
      window.addEventListener('online', online);
      window.addEventListener('offline', offline);
    }
    return () => {
      supabase?.removeChannel(channel);
      app.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', online);
        window.removeEventListener('offline', offline);
      }
    };
  }, [uid]);
  return null;
}

/**
 * Reload when any of these kinds of data changes (skips the first render:
 * the hook's own effect has just loaded).
 */
export function useRefreshOn(kinds: SyncKind[], refresh: () => void) {
  const v = useVersions((s) => kinds.reduce((sum, k) => sum + s[k], 0));
  const last = useRef(v);
  const fn = useRef(refresh);
  useEffect(() => {
    fn.current = refresh;
  });
  useEffect(() => {
    if (v === last.current) return;
    last.current = v;
    fn.current();
  }, [v]);
}
