import { useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { isMissingFunction } from '@/features/live/livePublish';
import { friendlyError, supabase } from '@/lib/supabase';

/**
 * IRLY Girl on the server side of safety (migration 20261109100000_irly_admin_publish_girl_view):
 *
 * - The IRLY Girl safety moderator: ONE person, designated by the owner of
 *   the back office, reads IRLY Girl read-only through staff_girl_* only;
 *   the server writes every read to the staff journal. Nothing here joins,
 *   posts, messages or reacts: the server refuses it anyway.
 * - Selfie verification: required automatically once IRLY Girl has 100
 *   members (admins can force it on or off). The promise text follows it.
 */

type Row = Record<string, unknown>;

function sb() {
  if (!supabase) throw new Error('The IRLY server is not configured');
  return supabase;
}
function fail(error: { code?: string | null; message: string }): never {
  if (isMissingFunction(error)) throw new Error('This needs the latest version of IRLY’s server. Try again later.');
  throw new Error(friendlyError(error.message));
}
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number => (v === null || v === undefined || Number.isNaN(Number(v)) ? 0 : Number(v));
const time = (v: unknown): number => (typeof v === 'string' ? Date.parse(v) : 0);
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);

/* ───────── Am I the safety moderator? ───────── */

/** True only for the designated safety moderator (undefined while it loads). The server checks again on every read. */
export function useGirlModeration(): boolean | undefined {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; on: boolean }>({ for: '', on: false });
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase.rpc('my_girl_moderation').then(({ data, error }) => alive && setState({ for: uid, on: !error && data === true }));
    return () => {
      alive = false;
    };
  }, [uid]);
  if (!uid || !supabase) return false;
  return state.for === uid ? state.on : undefined;
}

/* ───────── The moderation view (each read journaled by the server) ───────── */

export type GirlViewCommunity = { id: string; name: string; tagline: string | null; cityId: string | null; official: boolean; members: number; retired: boolean };
export type GirlViewPost = { id: string; firstName: string; asIrly: boolean; body: string; kind: string; createdAt: number; media: number; pinned: boolean; likes: number; comments: number };
export type GirlViewMember = { userId: string; firstName: string; role: string };
export type GirlViewActivity = { id: string; title: string; startsAt: number; cancelled: boolean; going: number; community: string | null };
export type GirlViewMessage = { id: string; firstName: string; body: string | null; kind: string; createdAt: number };
export type GirlViewPage = { community: GirlViewCommunity & { description: string | null }; posts: GirlViewPost[]; members: GirlViewMember[]; activities: GirlViewActivity[] };

const toCommunity = (r: Row): GirlViewCommunity => ({
  id: r.id as string,
  name: str(r.name) ?? '',
  tagline: str(r.tagline),
  cityId: str(r.city_id),
  official: Boolean(r.official),
  members: num(r.members),
  retired: Boolean(r.retired),
});
const toActivity = (r: Row): GirlViewActivity => ({ id: r.id as string, title: str(r.title) ?? '', startsAt: time(r.starts_at), cancelled: Boolean(r.cancelled), going: num(r.going), community: str(r.community) });

export async function girlViewCommunities(): Promise<GirlViewCommunity[]> {
  const { data, error } = await sb().rpc('staff_girl_communities');
  if (error) fail(error);
  return rows(data).map(toCommunity);
}

export async function girlViewActivities(): Promise<GirlViewActivity[]> {
  const { data, error } = await sb().rpc('staff_girl_activities');
  if (error) fail(error);
  return rows(data).map(toActivity);
}

export async function girlViewCommunity(id: string): Promise<GirlViewPage> {
  const { data, error } = await sb().rpc('staff_girl_community', { p_community: id });
  if (error) fail(error);
  const r = (data ?? {}) as Row;
  const c = (r.community ?? {}) as Row;
  return {
    community: { ...toCommunity(c), description: str(c.description) },
    posts: rows(r.posts).map((p) => ({
      id: p.id as string,
      firstName: str(p.first_name) ?? '',
      asIrly: Boolean(p.as_irly),
      body: str(p.body) ?? '',
      kind: str(p.kind) ?? 'post',
      createdAt: time(p.created_at),
      media: num(p.media),
      pinned: Boolean(p.pinned),
      likes: num(p.likes),
      comments: num(p.comments),
    })),
    members: rows(r.members).map((m) => ({ userId: m.user_id as string, firstName: str(m.first_name) ?? '', role: str(m.role) ?? 'member' })),
    activities: rows(r.activities).map(toActivity),
  };
}

export async function girlViewChat(id: string): Promise<GirlViewMessage[]> {
  const { data, error } = await sb().rpc('staff_girl_chat', { p_community: id });
  if (error) fail(error);
  return rows(data).map((m) => ({ id: m.id as string, firstName: str(m.first_name) ?? '', body: str(m.body), kind: str(m.kind) ?? 'text', createdAt: time(m.created_at) }));
}

/* ───────── The owner designates the moderator ───────── */

export type GirlModerator = { userId: string; firstName: string | null; grantedAt: string | null; active: boolean } | null;

export async function loadGirlModerator(): Promise<GirlModerator> {
  const { data, error } = await sb().rpc('admin_girl_moderator');
  if (error) fail(error);
  const r = (data ?? {}) as Row;
  return r.user_id ? { userId: r.user_id as string, firstName: str(r.first_name), grantedAt: str(r.granted_at), active: Boolean(r.active) } : null;
}

/** Owner only: designates (null: removes) the one safety moderator, with a reason. */
export async function setGirlModerator(userId: string | null, reason: string): Promise<void> {
  const { error } = await sb().rpc('admin_set_girl_moderator', { p_user: userId, p_reason: reason });
  if (error) fail(error);
}

/* ───────── Selfie verification ───────── */

/** Whether IRLY Girl asks for selfie verification now (the promise text follows it). Null while unknown. */
export function useGirlSelfieRequired(): boolean | null {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; on: boolean | null }>({ for: '', on: null });
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase.rpc('girl_selfie_required').then(({ data, error }) => alive && setState({ for: uid, on: error ? null : data === true }));
    return () => {
      alive = false;
    };
  }, [uid]);
  return state.for === uid ? state.on : null;
}

/** IRLY Girl's women-only promise, true in both states (selfie verification off or required). */
export const girlPromise = (selfieRequired: boolean | null) =>
  selfieRequired === false
    ? 'IRLY Girl is for women only. Selfie verification will be switched on as the community grows. Only IRLY’s safety moderator can view it, read-only, to keep it safe.'
    : 'IRLY Girl is for women only, checked by our servers. Only IRLY’s safety moderator can view it, read-only, to keep it safe.';

export type GirlSelfie = { mode: 'auto' | 'on' | 'off'; threshold: number; members: number; reachedAt: string | null; required: boolean };

export async function loadGirlSelfie(): Promise<GirlSelfie> {
  const { data, error } = await sb().rpc('admin_girl_selfie');
  if (error) fail(error);
  const r = (data ?? {}) as Row;
  const mode = r.mode === 'on' || r.mode === 'off' ? r.mode : 'auto';
  return { mode, threshold: num(r.threshold), members: num(r.members), reachedAt: str(r.reached_at), required: Boolean(r.required) };
}

/** IRLY admins: auto (on from the threshold), on, or off. */
export async function setGirlSelfieMode(mode: GirlSelfie['mode']): Promise<void> {
  const { error } = await sb().rpc('admin_set_girl_selfie_mode', { p_mode: mode });
  if (error) fail(error);
}
