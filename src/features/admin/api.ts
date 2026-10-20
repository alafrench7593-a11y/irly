import { useEffect, useState } from 'react';
import { useAccount } from '@/features/auth/account';
import { supabase } from '@/lib/supabase';

/**
 * The back office, as the server exposes it (migration
 * 20261023000000_irly_admin_moderation). Every call is checked by the
 * server against the caller's staff role; the app only decides what to show.
 */
export type StaffRole = 'owner' | 'admin' | 'moderator' | 'content';
export type CaseStatus = 'open' | 'reviewing' | 'need_info' | 'actioned' | 'dismissed' | 'closed';
export type SanctionKind = 'warning' | 'suspension' | 'ban';

export const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'New',
  reviewing: 'Under review',
  need_info: 'More information needed',
  actioned: 'Action taken',
  dismissed: 'No violation found',
  closed: 'Closed',
};

export const KIND_LABEL: Record<string, string> = {
  profile: 'Profile',
  message: 'Private message',
  activity: 'Activity',
  event: 'Event',
  community: 'Community',
  irl_post: 'Live post',
  comment: 'Comment',
  community_post: 'Community post',
};

export const CATEGORY_LABEL: Record<string, string> = {
  harassment: 'Harassment',
  threats: 'Threats',
  impersonation: 'Impersonation',
  fake_profile: 'Fake profile',
  spam: 'Spam',
  inappropriate: 'Inappropriate content',
  hate_speech: 'Discrimination or hate',
  scam: 'Scam',
  unsafe: 'Unsafe behaviour',
  other: 'Other',
};

export const isModerator = (r: StaffRole | null | undefined) => r === 'owner' || r === 'admin' || r === 'moderator';
export const isContentStaff = (r: StaffRole | null | undefined) => r === 'owner' || r === 'admin' || r === 'content';
export const isAdmin = (r: StaffRole | null | undefined) => r === 'owner' || r === 'admin';

export type Dashboard = { new: number; high: number; reviewing: number; need_info: number; week: number; sanctions: number; members: number };

export type CaseRow = {
  case_id: string;
  status: CaseStatus;
  priority: 'normal' | 'high';
  created_at: string;
  updated_at: string;
  category: string;
  target_kind: string;
  target_id: string | null;
  details: string | null;
  reporter_id: string | null;
  reporter_name: string | null;
  target_user_id: string | null;
  target_name: string | null;
  reports_on_target: number;
};

export type CaseDetail = {
  case: { id: string; status: CaseStatus; priority: string; created_at: string; updated_at: string; decision: string | null };
  report: {
    id: string;
    category: string;
    details: string | null;
    target_kind: string;
    target_id: string | null;
    created_at: string;
    reporter: { id: string; name: string } | null;
    target_user: { id: string; name: string; deleted: boolean; role: StaffRole | null } | null;
  };
  target: Record<string, string | boolean | null>;
  others: number;
  notes: { body: string; at: string; author: string | null }[];
  history: { action: string; at: string; by: string | null; details: Record<string, unknown> }[];
  sanctions: { id: string; kind: SanctionKind; reason: string; created_at: string; ends_at: string | null; lifted_at: string | null }[];
};

export type ContextMessage = { id: string; sender_id: string; sender_name: string | null; body: string | null; kind: string; created_at: string; reported: boolean; removed: boolean };

export type MemberRow = {
  user_id: string;
  first_name: string | null;
  username: string | null;
  email: string | null;
  created_at: string;
  deleted: boolean;
  role: StaffRole | null;
  sanction: SanctionKind | null;
  sanction_ends: string | null;
  reports: number;
};

export type SanctionRow = { id: string; kind: SanctionKind; reason: string; created_at: string; ends_at: string | null; lifted_at: string | null; by_name: string | null; lift_reason: string | null };
export type AuditRow = { at: string; actor_name: string; action: string; target_name: string | null; case_id: string | null; details: Record<string, unknown> };
export type StaffRow = { user_id: string; first_name: string | null; role: StaffRole; granted_at: string | null };

async function call<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!supabase) throw new Error('Not connected');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const loadDashboard = () => call<Dashboard>('mod_dashboard');
export const loadCases = (f: { status?: string | null; kind?: string | null; priority?: string | null; search?: string; offset?: number }) =>
  call<CaseRow[]>('mod_cases', { p_status: f.status ?? null, p_kind: f.kind ?? null, p_priority: f.priority ?? null, p_search: f.search || null, p_limit: 50, p_offset: f.offset ?? 0 });
export const loadCase = (id: string) => call<CaseDetail>('mod_case', { p_case: id });
export const setCaseStatus = (id: string, status: CaseStatus, note?: string) => call<void>('mod_case_update', { p_case: id, p_status: status, p_note: note || null });
export const addCaseNote = (id: string, body: string) => call<void>('mod_case_note', { p_case: id, p_body: body });
export const readReportedMessage = (id: string, reason: string) => call<ContextMessage[]>('mod_reported_message', { p_case: id, p_reason: reason });
export const removeContent = (id: string, note: string) => call<void>('mod_remove_content', { p_case: id, p_note: note });
export const sanction = (user: string, kind: SanctionKind, reason: string, days: number | null, caseId: string | null) =>
  call<string>('mod_sanction', { p_user: user, p_kind: kind, p_reason: reason, p_days: days, p_case: caseId });
export const liftSanction = (id: string, reason: string) => call<void>('mod_lift_sanction', { p_sanction: id, p_reason: reason });
export const searchMembers = (q: string) => call<MemberRow[]>('mod_users', { p_search: q, p_limit: 30 });
export const memberSanctions = (user: string) => call<SanctionRow[]>('mod_user_sanctions', { p_user: user });
export const loadAudit = () => call<AuditRow[]>('mod_audit', { p_limit: 200 });
export const loadStaff = () => call<StaffRow[]>('staff_list');
export const setRole = (user: string, role: Exclude<StaffRole, 'owner'> | null) => call<void>('staff_set_role', { p_user: user, p_role: role });

/** The signed-in person's staff role: undefined while it loads, null for members and signed-out visitors. */
export function useStaffRole(): StaffRole | null | undefined {
  const uid = useAccount()?.userId;
  const [state, setState] = useState<{ for: string; role: StaffRole | null }>({ for: '', role: null });
  useEffect(() => {
    if (!uid || !supabase) return;
    let alive = true;
    supabase.rpc('my_staff_role').then(({ data, error }) => alive && setState({ for: uid, role: error ? null : ((data as StaffRole | null) ?? null) }));
    return () => {
      alive = false;
    };
  }, [uid]);
  if (!uid || !supabase) return null;
  return state.for === uid ? state.role : undefined;
}
