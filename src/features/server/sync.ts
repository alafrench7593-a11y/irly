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
export type SyncKind = 'activities' | 'communities' | 'inbox' | 'people' | 'saved' | 'notifs' | 'follows' | 'friends';
const KINDS: SyncKind[] = ['activities', 'communities', 'inbox', 'people', 'saved', 'notifs', 'follows', 'friends'];

type Versions = Record<SyncKind, number> & { online: boolean };
const useVersions = create<Versions>(() => ({ activities: 0, communities: 0, inbox: 0, people: 0, saved: 0, notifs: 0, follows: 0, friends: 0, online: true }));

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

// Other people's changes: a little slower, so a lively chat or a wave of
// joins becomes one reload per kind instead of one per event.
let remoteTimer: ReturnType<typeof setTimeout> | null = null;
const remote = new Set<SyncKind>();
function changedRemotely(kinds: SyncKind[]) {
  kinds.forEach((k) => remote.add(k));
  if (remoteTimer) return;
  remoteTimer = setTimeout(() => {
    remoteTimer = null;
    const ks = [...remote];
    remote.clear();
    changed(...ks);
  }, 1000);
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
    // One channel per table: a table the server does not publish (yet) can
    // only silence itself, never the others.
    const TABLES: { table: string; filter?: string; event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE'; kinds: SyncKind[] }[] = [
      { table: 'activities', kinds: ['activities'] },
      { table: 'activity_participants', kinds: ['activities'] },
      { table: 'communities', kinds: ['communities', 'inbox'] },
      { table: 'community_members', kinds: ['communities'] },
      { table: 'community_activity_pins', kinds: ['activities'] },
      { table: 'community_channels', kinds: ['communities'] },
      { table: 'community_pins', kinds: ['communities'] },
      // Joining or leaving a chat follows a join or leave elsewhere; reading,
      // archiving or hiding a chat (an UPDATE, on every message read) is the inbox only.
      // A new chat is the inbox only: the join that made it (activity, community) already
      // signals its own table, so opening a chat no longer reloads every list.
      { table: 'conversation_members', filter: `user_id=eq.${uid}`, event: 'INSERT', kinds: ['inbox'] },
      { table: 'conversation_members', filter: `user_id=eq.${uid}`, event: 'DELETE', kinds: ['inbox', 'activities', 'communities'] },
      { table: 'conversation_members', filter: `user_id=eq.${uid}`, event: 'UPDATE', kinds: ['inbox'] },
      { table: 'conversations', event: 'UPDATE', kinds: ['inbox'] },
      { table: 'profiles', event: 'UPDATE', kinds: ['people'] },
      { table: 'saves', filter: `user_id=eq.${uid}`, kinds: ['saved'] },
      { table: 'notifications', filter: `user_id=eq.${uid}`, kinds: ['notifs'] },
      // Follows you are part of (the read rule limits them): counts and buttons everywhere.
      { table: 'follows', kinds: ['follows'] },
      // Friend requests and friendships you are part of (the read rule limits them):
      // Add / Requested / Accept / Friends, the bell and who may message whom.
      { table: 'friendships', kinds: ['friends'] },
    ];
    const channels = TABLES.map(({ table, filter, event = '*', kinds }) => {
      let first = true;
      return supabase!
        .channel(topic(`sync:${table}:${event}:${uid}`))
        .on('postgres_changes', { event, schema: 'public', table, ...(filter ? { filter } : {}) }, () => changedRemotely(kinds))
        .subscribe((status) => {
          // A (re)connection may have missed events: catch up once.
          if (status === 'SUBSCRIBED') {
            if (!first) changed(...kinds);
            first = false;
          }
        });
    });
    // Back to the app: whatever happened meanwhile.
    // A quick switch to another app (a link, a photo) reloads nothing.
    let away = 0;
    const app = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        if (!away) away = Date.now();
        return;
      }
      if (away && Date.now() - away > 30_000) changedAll();
      away = 0;
    });
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
      channels.forEach((c) => supabase?.removeChannel(c));
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
