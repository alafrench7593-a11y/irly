import { useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { friendlyError, supabase } from '@/lib/supabase';

/**
 * The community calls the chat makes, in one typed place (docs/COMMUNITIES-CONTRACT.md):
 * the server functions community_my_rights, community_members_list and
 * community_delete_message, by their exact names and arguments. Every rule
 * (ranks, IRLY Girl, blocks, community chats only) is checked by the server;
 * the chat only reads the answers.
 */

export type CommunityRole = 'owner' | 'co_admin' | 'moderator' | 'member';

/** community_my_rights(p_community) */
export type CommunityRights = {
  role: CommunityRole | null;
  permissions: Record<string, boolean>;
  can_manage_members: boolean;
  can_moderate: boolean;
  can_roles: boolean;
  can_settings: boolean;
  can_stats: boolean;
  can_announce: boolean;
  can_official: boolean;
  banned_until: string | null;
  restricted_until: string | null;
};

/** One row of community_members_list(p_community, p_search, p_limit, p_offset). */
export type CommunityMemberRow = { user_id: string; name: string; role: CommunityRole; joined_at: string };

const ROLES = new Set<CommunityRole>(['owner', 'co_admin', 'moderator', 'member']);
const asRole = (r: unknown): CommunityRole | null => (typeof r === 'string' && ROLES.has(r as CommunityRole) ? (r as CommunityRole) : null);

export async function communityMyRights(communityId: string): Promise<CommunityRights | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('community_my_rights', { p_community: communityId });
  if (error) throw new Error(friendlyError(error.message));
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<CommunityRights>;
  return {
    role: asRole(d.role),
    permissions: d.permissions && typeof d.permissions === 'object' ? d.permissions : {},
    can_manage_members: d.can_manage_members === true,
    can_moderate: d.can_moderate === true,
    can_roles: d.can_roles === true,
    can_settings: d.can_settings === true,
    can_stats: d.can_stats === true,
    can_announce: d.can_announce === true,
    can_official: d.can_official === true,
    banned_until: d.banned_until ?? null,
    restricted_until: d.restricted_until ?? null,
  };
}

export async function communityMembersList(
  communityId: string,
  opts: { search?: string | null; limit?: number; offset?: number } = {},
): Promise<CommunityMemberRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('community_members_list', {
    p_community: communityId,
    p_search: opts.search ?? null,
    p_limit: opts.limit ?? 200,
    p_offset: opts.offset ?? 0,
  });
  if (error) throw new Error(friendlyError(error.message));
  return ((data as CommunityMemberRow[] | null) ?? []).filter((r) => r && typeof r.user_id === 'string');
}

/** A moderator removes someone else's message from a community chat, with the reason (kept in the community's journal). */
export async function communityDeleteMessage(messageId: string, reason: string): Promise<void> {
  if (!supabase) throw new Error('The IRLY server is not configured');
  const { error } = await supabase.rpc('community_delete_message', { p_message: messageId, p_reason: reason });
  if (error) throw new Error(friendlyError(error.message));
}

/**
 * Cached answers, by account and community: one read when a community chat
 * opens, none per message. Kept a few minutes, then read again at the next
 * opening (a role given meanwhile shows then).
 */
const FRESH_MS = 3 * 60_000;
type Entry<T> = { at: number; value: T; ask?: Promise<T> };
const rolesCache = new Map<string, Entry<Record<string, CommunityRole>>>();
const rightsCache = new Map<string, Entry<CommunityRights | null>>();

function cached<T>(cache: Map<string, Entry<T>>, key: string, empty: T, read: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit?.ask) return hit.ask;
  if (hit && Date.now() - hit.at < FRESH_MS) return Promise.resolve(hit.value);
  const ask = read().then(
    (value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    },
    () => {
      // Not answered (offline, not deployed yet): what was known stays, asked again next time.
      const value = hit?.value ?? empty;
      cache.set(key, { at: 0, value });
      return value;
    },
  );
  cache.set(key, { at: hit?.at ?? 0, value: hit?.value ?? empty, ask });
  return ask;
}

/** Staff of a community (owner, co-admins, moderators) by user id; members are left out. */
async function readRoles(communityId: string): Promise<Record<string, CommunityRole>> {
  // Ordered owner, co-admins, moderators, then members: the first page holds every badge.
  const rows = await communityMembersList(communityId, { limit: 200 });
  const out: Record<string, CommunityRole> = {};
  for (const r of rows) {
    const role = asRole(r.role);
    if (role && role !== 'member') out[r.user_id] = role;
  }
  return out;
}

const NO_ROLES: Record<string, CommunityRole> = {};

/** The badges of a community chat (id → role), read once per conversation. */
export function useCommunityRoles(communityId: string | null): Record<string, CommunityRole> {
  const uid = useAccount()?.userId;
  const key = uid && communityId ? `${uid}|${communityId}` : '';
  const [state, setState] = useState<{ key: string; roles: Record<string, CommunityRole> }>(() => ({ key, roles: (key && rolesCache.get(key)?.value) || NO_ROLES }));
  useEffect(() => {
    if (!key || !communityId) return;
    let alive = true;
    cached(rolesCache, key, NO_ROLES, () => readRoles(communityId)).then((roles) => alive && setState({ key, roles }));
    return () => {
      alive = false;
    };
  }, [key, communityId]);
  return state.key === key ? state.roles : NO_ROLES;
}

/** What I may do in this community (moderate its chat…); null while unknown or outside a community. */
export function useCommunityRights(communityId: string | null): CommunityRights | null {
  const uid = useAccount()?.userId;
  const key = uid && communityId ? `${uid}|${communityId}` : '';
  const [state, setState] = useState<{ key: string; rights: CommunityRights | null }>(() => ({ key, rights: (key && rightsCache.get(key)?.value) || null }));
  useEffect(() => {
    if (!key || !communityId) return;
    let alive = true;
    cached(rightsCache, key, null, () => communityMyRights(communityId)).then((rights) => alive && setState({ key, rights }));
    return () => {
      alive = false;
    };
  }, [key, communityId]);
  return state.key === key ? state.rights : null;
}
