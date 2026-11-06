import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { changed, useRefreshOn } from '@/features/server/sync';
import { isMissingFunction } from '@/features/live/livePublish';
import { friendlyError, supabase } from '@/lib/supabase';
import { cacheKey, load as loadCached, peek } from './cache';

/**
 * A community's governance on the client: what the signed-in member may do
 * there, its members (grouped by role), its header numbers, and every
 * action of « Manage the community » (roles, permissions, warnings,
 * restrictions, kicks, bans, activity moderation, stats, history).
 *
 * Every call is one server function (docs/COMMUNITIES-CONTRACT.md): the
 * server checks ranks and rights and writes the audit journal; the app only
 * hides what the member may not do. The demo build has no server: reads
 * return empty values and actions say they are not available.
 */

export type CommunityRole = 'owner' | 'co_admin' | 'moderator' | 'member';
export const ROLE_RANK: Record<CommunityRole, number> = { owner: 3, co_admin: 2, moderator: 1, member: 0 };
export const asRole = (r: unknown): CommunityRole => (r === 'owner' || r === 'co_admin' || r === 'moderator' ? r : 'member');

/** A co-admin's rights, set by the owner. */
export type PermKey = 'members' | 'moderation' | 'announcements' | 'activities' | 'settings' | 'stats' | 'roles';
export const PERM_KEYS: PermKey[] = ['members', 'moderation', 'announcements', 'activities', 'settings', 'stats', 'roles'];
export type Permissions = Record<PermKey, boolean>;
const NO_PERMS: Permissions = { members: false, moderation: false, announcements: false, activities: false, settings: false, stats: false, roles: false };

export type MyRights = {
  role: CommunityRole | null;
  permissions: Permissions;
  canManageMembers: boolean;
  canModerate: boolean;
  canRoles: boolean;
  canSettings: boolean;
  canStats: boolean;
  canAnnounce: boolean;
  canOfficial: boolean;
  bannedUntil: number | null;
  restrictedUntil: number | null;
};

export const NO_RIGHTS: MyRights = {
  role: null,
  permissions: NO_PERMS,
  canManageMembers: false,
  canModerate: false,
  canRoles: false,
  canSettings: false,
  canStats: false,
  canAnnounce: false,
  canOfficial: false,
  bannedUntil: null,
  restrictedUntil: null,
};

/** « Manage the community » is for those who can do at least one thing there. */
export const isManager = (r: MyRights) => r.canManageMembers || r.canModerate || r.canRoles || r.canSettings || r.canStats;
/** The history: the owner, or a co-admin with stats or members. */
export const canSeeAudit = (r: MyRights) => r.role === 'owner' || (r.role === 'co_admin' && (r.permissions.stats || r.permissions.members));

export type Member = { userId: string; name: string; role: CommunityRole; joinedAt: number | null };
export type Face = { userId: string; name: string };
export type CommunityHeader = { members: number; upcomingActivities: number; faces: Face[]; newMembers7d: number };

export type SanctionKind = 'ban' | 'restriction' | 'warning';
export type Sanction = { kind: SanctionKind; userId: string; name: string; reason: string | null; until: number | null; createdBy: string | null; createdAt: number | null };

export type AuditEntry = { id: string; actor: string | null; actorName: string | null; action: string; targetUser: string | null; targetName: string | null; targetId: string | null; reason: string | null; createdAt: number | null };

/** Real counts from the server; null where a value is missing (shown as « — »). */
export type CommunityStats = {
  members: number | null;
  new7d: number | null;
  new30d: number | null;
  upcomingActivities: number | null;
  activities30d: number | null;
  participants30d: number | null;
  messages7d: number | null;
  openReports: number | null;
};

/* ───────── plumbing ───────── */

function sb() {
  if (!supabase) throw new Error(DEMO ? 'Not available in the demo' : 'The IRLY server is not configured');
  return supabase;
}

/** The server's refusal in the app's words; a server not updated yet says so. */
function fail(error: { code?: string | null; message: string }): never {
  if (isMissingFunction(error)) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
  throw new Error(friendlyError(error.message));
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : ms;
};
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
type Row = Record<string, unknown>;

/** Runs an action, then tells every community screen to reload. */
async function act(fn: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await sb().rpc(fn, args);
  if (error) fail(error);
  changed('communities');
}

/* ───────── reads ───────── */

function toRights(r: Row | null): MyRights {
  if (!r) return NO_RIGHTS;
  const p = (r.permissions && typeof r.permissions === 'object' ? r.permissions : {}) as Row;
  return {
    role: r.role ? asRole(r.role) : null,
    permissions: Object.fromEntries(PERM_KEYS.map((k) => [k, Boolean(p[k])])) as Permissions,
    canManageMembers: Boolean(r.can_manage_members),
    canModerate: Boolean(r.can_moderate),
    canRoles: Boolean(r.can_roles),
    canSettings: Boolean(r.can_settings),
    canStats: Boolean(r.can_stats),
    canAnnounce: Boolean(r.can_announce),
    canOfficial: Boolean(r.can_official),
    bannedUntil: time(r.banned_until),
    restrictedUntil: time(r.restricted_until),
  };
}

export async function fetchMyRights(communityId: string): Promise<MyRights> {
  if (!supabase || !communityId) return NO_RIGHTS;
  const { data, error } = await supabase.rpc('community_my_rights', { p_community: communityId });
  if (error) {
    // A server not updated yet: no management, the page still works.
    if (isMissingFunction(error)) return NO_RIGHTS;
    fail(error);
  }
  return toRights((Array.isArray(data) ? data[0] : data) as Row | null);
}

export async function fetchHeader(communityId: string): Promise<CommunityHeader | null> {
  if (!supabase || !communityId) return null;
  const { data, error } = await supabase.rpc('community_header', { p_community: communityId });
  if (error) {
    if (isMissingFunction(error)) return null;
    fail(error);
  }
  const r = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (!r) return null;
  const faces = Array.isArray(r.faces) ? (r.faces as Row[]) : [];
  return {
    members: num(r.members) ?? 0,
    upcomingActivities: num(r.upcoming_activities) ?? 0,
    faces: faces.filter((f) => typeof f.user_id === 'string').map((f) => ({ userId: f.user_id as string, name: str(f.name) ?? '' })),
    newMembers7d: num(r.new_members_7d) ?? 0,
  };
}

export async function fetchMembers(communityId: string, search: string | null = null, limit = 200, offset = 0): Promise<Member[]> {
  if (!supabase || !communityId) return [];
  const { data, error } = await supabase.rpc('community_members_list', { p_community: communityId, p_search: search?.trim() || null, p_limit: limit, p_offset: offset });
  if (error) fail(error);
  return ((data as Row[] | null) ?? []).map((m) => ({ userId: m.user_id as string, name: str(m.name) ?? '', role: asRole(m.role), joinedAt: time(m.joined_at) }));
}

const kindOf = (k: unknown): SanctionKind => (/ban/i.test(String(k)) ? 'ban' : /restrict/i.test(String(k)) ? 'restriction' : 'warning');

/** Bans, restrictions and warnings; of one member when `userId` is given. Managers only. */
export async function fetchSanctions(communityId: string, userId: string | null = null): Promise<Sanction[]> {
  if (!supabase || !communityId) return [];
  const { data, error } = await supabase.rpc('community_sanctions', { p_community: communityId, p_user: userId });
  if (error) fail(error);
  return ((data as Row[] | null) ?? []).map((s) => ({
    kind: kindOf(s.kind),
    userId: s.user_id as string,
    name: str(s.name) ?? '',
    reason: str(s.reason),
    until: time(s.until),
    createdBy: str(s.created_by),
    createdAt: time(s.created_at),
  }));
}

export async function fetchAuditLog(communityId: string, limit = 100): Promise<AuditEntry[]> {
  if (!supabase || !communityId) return [];
  const { data, error } = await supabase.rpc('community_audit_log', { p_community: communityId, p_limit: limit });
  if (error) fail(error);
  return ((data as Row[] | null) ?? []).map((a, i) => ({
    id: str(a.id) ?? `${str(a.created_at) ?? ''}-${i}`,
    actor: str(a.actor),
    actorName: str(a.actor_name),
    action: str(a.action) ?? '',
    targetUser: str(a.target_user),
    targetName: str(a.target_name),
    targetId: str(a.target_id),
    reason: str(a.reason),
    createdAt: time(a.created_at),
  }));
}

export async function fetchStats(communityId: string): Promise<CommunityStats | null> {
  if (!supabase || !communityId) return null;
  const { data, error } = await supabase.rpc('community_stats', { p_community: communityId });
  if (error) fail(error);
  const r = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (!r) return null;
  return {
    members: num(r.members),
    new7d: num(r.new_7d),
    new30d: num(r.new_30d),
    upcomingActivities: num(r.upcoming_activities),
    activities30d: num(r.activities_30d),
    participants30d: num(r.participants_30d),
    messages7d: num(r.messages_7d),
    openReports: num(r.open_reports),
  };
}

/**
 * The co-admins' permissions, for the owner's toggles (Roles): the co-admins
 * from the members list, each read through community_permissions (owner
 * only on the server). Null when they cannot be read: the toggles then stay
 * off rather than overwrite what is set.
 */
export async function fetchCoAdminPermissions(communityId: string): Promise<Record<string, Permissions> | null> {
  if (!supabase || !communityId) return null;
  const db = supabase;
  const { data, error } = await db.rpc('community_members_list', { p_community: communityId, p_search: null, p_limit: 500, p_offset: 0 });
  if (error) return null;
  const coAdmins = ((data as Row[] | null) ?? []).filter((r) => r.role === 'co_admin').map((r) => r.user_id as string);
  const entries = await Promise.all(
    coAdmins.map(async (userId) => {
      const res = await db.rpc('community_permissions', { p_community: communityId, p_user: userId });
      if (res.error) return null;
      const p = (res.data && typeof res.data === 'object' ? res.data : {}) as Row;
      return [userId, Object.fromEntries(PERM_KEYS.map((k) => [k, Boolean(p[k])])) as Permissions] as const;
    }),
  );
  if (entries.some((e) => e === null)) return null;
  return Object.fromEntries(entries as (readonly [string, Permissions])[]);
}

export function useCoAdminPermissions(communityId: string, enabled = true) {
  const r = useServerRead<Record<string, Permissions> | null>(enabled ? communityId : '', null, () => fetchCoAdminPermissions(communityId));
  return { perms: r.value, loading: r.loading, reload: r.reload };
}

/* ───────── actions (the server checks every rank) ───────── */

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

export const setMemberRole = (communityId: string, userId: string, role: Exclude<CommunityRole, 'owner'>) => act('community_set_role', { p_community: communityId, p_user: userId, p_role: role });
export const setPermissions = (communityId: string, userId: string, perms: Permissions) => act('community_set_permissions', { p_community: communityId, p_user: userId, p_perms: perms });
export const transferOwnership = (communityId: string, userId: string) => act('community_transfer_ownership', { p_community: communityId, p_user: userId });
export const kickMember = (communityId: string, userId: string, reason: string) => act('community_kick', { p_community: communityId, p_user: userId, p_reason: reason.trim() || null });
/** `until` null: permanent. */
export const banMember = (communityId: string, userId: string, reason: string, until: number | null) => act('community_ban', { p_community: communityId, p_user: userId, p_reason: reason.trim() || null, p_until: iso(until) });
export const unbanMember = (communityId: string, userId: string) => act('community_unban', { p_community: communityId, p_user: userId });
export const warnMember = (communityId: string, userId: string, reason: string) => act('community_warn', { p_community: communityId, p_user: userId, p_reason: reason.trim() || null });
export const restrictMember = (communityId: string, userId: string, until: number, reason: string) => act('community_restrict', { p_community: communityId, p_user: userId, p_until: iso(until), p_reason: reason.trim() || null });
export const unrestrictMember = (communityId: string, userId: string) => act('community_unrestrict', { p_community: communityId, p_user: userId });
export async function moderateActivity(activityId: string, reason: string): Promise<void> {
  await act('community_moderate_activity', { p_activity: activityId, p_reason: reason.trim() || null });
  changed('activities');
}

/* ───────── hooks ───────── */

/**
 * One server read kept fresh: reloaded when communities change, the last
 * request wins, and a failure is kept apart from « nothing ».
 */
function useServerRead<T>(key: string, empty: T, read: () => Promise<T>, kind?: string) {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ key: string; value: T; error: string | null }>({ key: '', value: empty, error: null });
  const seq = useRef(0);
  const readRef = useRef(read);
  // Before the load below (effects run in order): the read of this render.
  useEffect(() => {
    readRef.current = read;
  });
  const full = `${uid ?? ''}|${key}`;
  // With a kind: the last known answer (community cache) shows at once, and one request
  // per key is shared by every screen and the prefetch asking at the same time.
  const ck = kind && uid && key ? cacheKey(uid, kind, key) : '';
  const load = useCallback(
    (join = false) => {
      if (!uid || !supabase || !key) return;
      const n = ++seq.current;
      (ck ? loadCached(ck, () => readRef.current(), join) : readRef.current())
        .then((value) => n === seq.current && setState({ key: full, value, error: null }))
        .catch((e: unknown) => n === seq.current && setState((s) => ({ key: full, value: s.key === full ? s.value : (peek<T>(ck) ?? empty), error: e instanceof Error ? e.message : 'Can’t reach IRLY right now' })));
    },
    // `empty` is a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uid, key, full, ck],
  );
  const reload = useCallback(() => load(false), [load]);
  useEffect(() => load(true), [load]);
  useRefreshOn(['communities'], reload);
  const ready = state.key === full;
  const known = peek<T>(ck);
  // No server (demo) or no account: nothing to wait for.
  const idle = !uid || !supabase || !key;
  return { value: ready ? state.value : (known ?? empty), loading: !idle && !ready && known === undefined, error: ready ? state.error : null, reload };
}

export function useMyRights(communityId: string) {
  const r = useServerRead(communityId, NO_RIGHTS, () => fetchMyRights(communityId), 'rights');
  return { rights: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

export function useCommunityHeader(communityId: string) {
  const r = useServerRead<CommunityHeader | null>(communityId, null, () => fetchHeader(communityId), 'header');
  return { header: r.value, loading: r.loading, reload: r.reload };
}

const NO_MEMBERS: Member[] = [];
export function useMembersList(communityId: string, search: string) {
  const [q, setQ] = useState(search.trim());
  // Typing searches after a short pause, not on every letter.
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);
  const r = useServerRead(communityId ? `${communityId}|${q}` : '', NO_MEMBERS, () => fetchMembers(communityId, q || null), 'members');
  return { members: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

const NO_SANCTIONS: Sanction[] = [];
export function useSanctions(communityId: string, userId: string | null = null, enabled = true) {
  const r = useServerRead(enabled && communityId ? `${communityId}|${userId ?? '*'}` : '', NO_SANCTIONS, () => fetchSanctions(communityId, userId));
  return { sanctions: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

const NO_AUDIT: AuditEntry[] = [];
export function useAuditLog(communityId: string, enabled = true) {
  const r = useServerRead(enabled ? communityId : '', NO_AUDIT, () => fetchAuditLog(communityId));
  return { entries: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

export function useCommunityStats(communityId: string, enabled = true) {
  const r = useServerRead<CommunityStats | null>(enabled ? communityId : '', null, () => fetchStats(communityId));
  return { stats: r.value, loading: r.loading, error: r.error, reload: r.reload };
}

/* ───────── what one manager may do to one member ───────── */

export type MemberActions = {
  makeCoAdmin: boolean;
  makeModerator: boolean;
  removeRole: boolean;
  warn: boolean;
  restrict: boolean;
  kick: boolean;
  ban: boolean;
  sanctions: boolean;
};

/**
 * The actions shown for a member. Nobody acts on an equal or higher rank
 * (the owner on co-admins is the owner outranking them). The server checks
 * the same rules again: this only hides what would be refused.
 */
export function memberActions(me: MyRights, myId: string | null, target: Member): MemberActions {
  const none: MemberActions = { makeCoAdmin: false, makeModerator: false, removeRole: false, warn: false, restrict: false, kick: false, ban: false, sanctions: false };
  if (!me.role || target.userId === myId) return none;
  const mine = ROLE_RANK[me.role];
  const theirs = ROLE_RANK[target.role];
  const sanctions = isManager(me);
  if (theirs >= mine) return { ...none, sanctions };
  const owner = me.role === 'owner';
  // A co-admin with « roles » names moderators and members only, on members and moderators.
  const roles = owner || (me.canRoles && target.role !== 'co_admin');
  return {
    makeCoAdmin: owner && target.role !== 'co_admin',
    makeModerator: roles && target.role !== 'moderator',
    removeRole: roles && target.role !== 'member',
    warn: me.canModerate,
    restrict: me.canModerate,
    kick: me.canManageMembers || me.canModerate,
    ban: me.canManageMembers || me.canModerate,
    sanctions,
  };
}
