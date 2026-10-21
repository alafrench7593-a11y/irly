import { useEffect, useState } from 'react';
import { DEMO } from '@/config/app';
import { useAccount } from '@/features/auth/account';
import { refreshPhotoOverrides } from '@/features/photo/overrides';
import type { Bucket } from '@/features/server/media';
import { changed, type SyncKind } from '@/features/server/sync';
import { cleanImage } from '@/lib/media';
import { supabase } from '@/lib/supabase';

/**
 * The back office, as the server exposes it (migration
 * 20261023000000_irly_admin_moderation). Every call is checked by the
 * server against the caller's staff role; the app only decides what to show.
 */
export type StaffRole = 'owner' | 'admin' | 'moderator' | 'content';
export type CaseStatus = 'open' | 'reviewing' | 'need_info' | 'actioned' | 'dismissed' | 'closed';
export type SanctionKind = 'warning' | 'suspension' | 'ban';

/** The team's words for each status (the server keeps its own names). */
export const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'New',
  reviewing: 'In review',
  need_info: 'Action needed',
  actioned: 'Resolved: action taken',
  dismissed: 'Rejected',
  closed: 'Resolved',
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
  unsafe: 'Dangerous behaviour',
  sexual_content: 'Sexual content',
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
  if (DEMO && !supabase) return (await import('./demo')).demoCall(fn, args) as T;
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

// ───────── Back office, completed (migrations 20261027200000, 20261027200100) ─────────

export type Overview = {
  users: number;
  new_7d: number;
  new_30d: number;
  active_30d: number;
  signins_30d: number | null;
  communities: number;
  activities: number;
  activities_upcoming: number;
  posts: number;
  lives: number;
  reports_open: number;
  reports_review: number;
  reports_action: number;
  reports_7d: number;
  important_7d: number;
  suspended: number;
  banned: number;
  hidden: number;
  email_pending: number;
  email_failed: number;
  recent: { at: string; by: string; action: string; target: string | null }[];
};

export type UserSheet = {
  id: string;
  first_name: string | null;
  username: string | null;
  city_id: string | null;
  created_at: string;
  verified: boolean;
  role: StaffRole | null;
  photos: number;
  email: string | null;
  status: 'active' | 'suspended' | 'banned' | 'deleted';
  status_until: string | null;
  counts: { activities: number; communities: number; posts: number; reports_about: number; reports_filed: number };
  reports: { case_id: string; status: CaseStatus; category: string; target_kind: string; created_at: string }[];
  sanctions: { id: string; kind: SanctionKind; reason: string; created_at: string; ends_at: string | null; lifted_at: string | null; lift_reason: string | null; by: string | null }[];
  history: { at: string; action: string; by: string; reason: string | null }[];
};

export type CommunityRow = {
  id: string;
  name: string;
  city_id: string;
  girl_only: boolean;
  official: boolean;
  parent_id: string | null;
  members_count: number;
  created_at: string;
  removed: boolean;
  hidden: boolean;
  cover_path: string | null;
  creator_name: string | null;
  reports: number;
};

export type Hold = { reason: string; at: string; by: string | null; final?: boolean } | null;
export type ItemReport = { case_id: string; status: CaseStatus; category: string; created_at: string };

export type CommunitySheet = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  city_id: string;
  girl_only: boolean;
  official: boolean;
  emoji: string | null;
  cover_path: string | null;
  created_at: string;
  parent_id: string | null;
  parent_name: string | null;
  creator: { id: string; name: string } | null;
  admins: { id: string; name: string; role: string }[];
  member_count: number;
  groups: number;
  removed: boolean;
  hold: Hold;
  reports: ItemReport[];
};

export type ContentKind = 'activity' | 'community_post' | 'comment' | 'irl_post';
export type ModerationKind = ContentKind | 'community';
export type ContentRow = {
  id: string;
  kind: ContentKind;
  title: string | null;
  body: string | null;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  state: 'visible' | 'hidden' | 'cancelled' | 'past' | 'deleted' | 'expired';
  girl_only: boolean;
  context: string | null;
  reports: number;
};
export type ContentItem = {
  kind: ContentKind;
  id: string;
  title?: string;
  body?: string | null;
  author_id?: string;
  author_name?: string | null;
  created_at?: string;
  starts_at?: string;
  place?: string;
  city?: string;
  community?: string | null;
  girl_only?: boolean;
  cancelled?: boolean;
  hidden?: boolean;
  deleted?: boolean;
  gone?: boolean;
  going?: number;
  media?: number | string | null;
  hold: Hold;
  reports: ItemReport[];
};
export type RelatedRow = { case_id: string; status: CaseStatus; category: string; target_kind: string; created_at: string; same_item: boolean };
export type JournalRow = { id: number; at: string; actor_name: string; action: string; target_user: string | null; target_name: string | null; case_id: string | null; kind: string | null; item_id: string | null; reason: string | null; result: string };
export type EmailScope = 'off' | 'important' | 'all';
export type AdminSettings = {
  report_email_to: string | null;
  report_email_scope: EmailScope;
  dashboard_url: string;
  updated: Record<string, { at: string; by: string | null }> | null;
  outbox: {
    pending: number;
    sent: number;
    failed: number;
    last_sent: string | null;
    recent: { id: string; case_id: string; status: 'pending' | 'sending' | 'sent' | 'failed'; attempts: number; last_error: string | null; created_at: string; sent_at: string | null }[];
  };
};

export const loadOverview = () => call<Overview>('admin_overview');
export const loadUser = (id: string) => call<UserSheet>('admin_user', { p_user: id });
export const suspendUntil = (user: string, until: Date, reason: string, caseId: string | null = null) =>
  call<string>('admin_suspend', { p_user: user, p_until: until.toISOString(), p_reason: reason, p_case: caseId });
export const reactivate = (user: string, reason: string) => call<number>('admin_reactivate', { p_user: user, p_reason: reason });
export const deleteAccount = (user: string, confirm: string, reason: string) => call<void>('admin_delete_account', { p_user: user, p_confirm: confirm, p_reason: reason });
export const loadCommunities = (search: string, filter: string | null) => call<CommunityRow[]>('admin_communities', { p_search: search || null, p_filter: filter, p_limit: 60 });
export const loadCommunity = (id: string) => call<CommunitySheet>('admin_community', { p_id: id });
export const updateCommunity = (id: string, name: string, tagline: string, description: string, reason: string) =>
  call<void>('admin_update_community', { p_id: id, p_name: name, p_tagline: tagline, p_description: description, p_reason: reason }).then(() => changed('communities'));
export const loadContent = (kind: ContentKind, search: string, filter: string | null) => call<ContentRow[]>('admin_content', { p_kind: kind, p_search: search || null, p_filter: filter, p_limit: 60 });
export const loadContentItem = (kind: ContentKind, id: string) => call<ContentItem>('admin_content_item', { p_kind: kind, p_id: id });
export const moderate = (kind: ModerationKind, id: string, action: 'hide' | 'restore' | 'delete', reason: string, caseId: string | null = null) =>
  call<void>('admin_moderate', { p_kind: kind, p_id: id, p_action: action, p_reason: reason, p_case: caseId }).then(() => changed('communities', 'activities', 'inbox'));
export const loadRelated = (caseId: string) => call<RelatedRow[]>('admin_case_related', { p_case: caseId });
export const loadJournal = (before?: string) => call<JournalRow[]>('admin_journal', { p_limit: 200, p_before: before ?? null });
export const loadSettings = () => call<AdminSettings>('admin_settings');
export const saveSetting = (key: 'report_email_to' | 'report_email_scope' | 'dashboard_url', value: string) => call<void>('admin_set_setting', { p_key: key, p_value: value });
export const retryEmail = (id: string) => call<void>('admin_email_retry', { p_id: id });

/** Largest photo the team sends (after cleanImage re-encodes it as a JPEG of 1600 px at most). */
const COVER_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Replaces a community's photo: the picked image is decoded and re-encoded
 * (a file that is not an image fails here; no EXIF or location kept), checked
 * for size, uploaded to the staff member's own folder under a new name (so
 * every screen fetches it fresh), then saved by the server, which queues the
 * old file for removal. A refused save removes the upload. null removes the photo.
 */
export async function replaceCommunityCover(id: string, uri: string | null, reason: string): Promise<void> {
  if (!supabase) throw new Error('Not connected');
  let path: string | null = null;
  if (uri) {
    const img = await cleanImage(uri).catch(() => {
      throw new Error('This file is not a photo IRLY can use');
    });
    if (img.body.byteLength > COVER_MAX_BYTES) throw new Error('This photo is too large');
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) throw new Error('Sign in first');
    path = `${uid}/${Date.now()}.${img.ext}`;
    const { error } = await supabase.storage.from('activity-photos').upload(path, img.body, { contentType: img.contentType });
    if (error) throw new Error('Could not upload the photo');
  }
  const { error } = await supabase.rpc('admin_set_community_cover', { p_id: id, p_path: path, p_reason: reason });
  if (error) {
    if (path) await supabase.storage.from('activity-photos').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  changed('communities', 'inbox');
}

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

// ───────── Photos (migration 20261027700000_irly_admin_photos) ─────────

/** Members' photos the team can browse. */
export type PhotoKind = 'community' | 'activity' | 'community_post' | 'irl_post' | 'profile';
export type PhotoRow = {
  id: string;
  kind: PhotoKind;
  title: string | null;
  owner_id: string | null;
  owner_name: string | null;
  bucket: Bucket;
  paths: string[];
  media: 'photo' | 'video' | null;
  created_at: string;
  girl_only: boolean;
  hidden: boolean;
};
/** One photo of a thing, on its sheet: 'cover' (community, activity), 'media' (post, Live), 'profile' and 'match' (a member). */
export type PhotoSlot = { slot: 'cover' | 'media' | 'profile' | 'match'; bucket: Bucket; path: string; media: 'photo' | 'video' | null; thumb: string | null };
export type PhotoStep = 'checking' | 'uploading' | 'saving';

export const loadPhotos = (kind: PhotoKind, search: string) => call<PhotoRow[]>('admin_photos', { p_kind: kind, p_search: search || null, p_limit: 60 });
export const loadItemPhotos = (kind: PhotoKind, id: string) => call<PhotoSlot[]>('admin_item_photos', { p_kind: kind, p_id: id });

/** Largest photo the team sends (after cleanImage re-encodes it as a JPEG of 1600 px at most). */
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A picked image, checked and sent to the staff member's own folder of a
 * bucket under a new name (so every screen fetches it fresh). The image is
 * decoded and re-encoded first: a file that is not an image fails here, and
 * no EXIF or location is kept.
 */
async function uploadStaffPhoto(bucket: 'activity-photos' | 'app-photos', uri: string, onStep?: (step: PhotoStep) => void): Promise<string> {
  if (!supabase) throw new Error('Not connected');
  onStep?.('checking');
  const img = await cleanImage(uri).catch(() => {
    throw new Error('This file is not a photo IRLY can use');
  });
  if (img.body.byteLength > PHOTO_MAX_BYTES) throw new Error('This photo is too large');
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error('Sign in first');
  const path = `${uid}/${Date.now()}.${img.ext}`;
  onStep?.('uploading');
  const { error } = await supabase.storage.from(bucket).upload(path, img.body, { contentType: img.contentType });
  if (error) throw new Error('Could not upload the photo');
  onStep?.('saving');
  return path;
}

/**
 * Replaces (uri) or removes (null) the photo of a community or an activity:
 * upload, then the server saves the new reference and queues the old file
 * for removal once nothing uses it. A refused save removes the upload.
 */
export async function replaceItemPhoto(kind: 'community' | 'activity', id: string, uri: string | null, reason: string, onStep?: (step: PhotoStep) => void): Promise<void> {
  if (DEMO && !supabase) throw new Error('Demo: nothing is saved');
  if (!supabase) throw new Error('Not connected');
  const path = uri ? await uploadStaffPhoto('activity-photos', uri, onStep) : null;
  if (!uri) onStep?.('saving');
  const { error } = await supabase.rpc('admin_set_photo', { p_kind: kind, p_id: id, p_path: path, p_old: null, p_reason: reason });
  if (error) {
    if (path) await supabase.storage.from('activity-photos').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  changed(kind === 'community' ? 'communities' : 'activities', 'inbox');
}

/** Takes one of a member's photos off (profile, IRLY Match, post or Live): never replaced by another picture. */
export const removeMemberPhoto = (kind: 'profile' | 'match' | 'community_post' | 'irl_post', id: string, path: string, reason: string) =>
  call<void>('admin_set_photo', { p_kind: kind, p_id: id, p_path: null, p_old: path, p_reason: reason }).then(() =>
    changed(...((kind === 'profile' || kind === 'match' ? ['people'] : kind === 'irl_post' ? ['irl'] : ['communities']) as SyncKind[])),
  );

/**
 * Puts the team's photo (uri) in place of IRLY's own photo for a key, or
 * (null) goes back to IRLY's own photo, for everyone: the new list is read
 * at once here, and by every phone when it next syncs.
 */
export async function replaceAppPhoto(key: string, uri: string | null, reason: string, onStep?: (step: PhotoStep) => void): Promise<void> {
  if (DEMO && !supabase) throw new Error('Demo: nothing is saved');
  if (!supabase) throw new Error('Not connected');
  const path = uri ? await uploadStaffPhoto('app-photos', uri, onStep) : null;
  if (!uri) onStep?.('saving');
  const { error } = await supabase.rpc('admin_set_app_photo', { p_key: key, p_path: path, p_reason: reason });
  if (error) {
    if (path) await supabase.storage.from('app-photos').remove([path]).catch(() => undefined);
    throw new Error(error.message);
  }
  await refreshPhotoOverrides(true);
  changed('communities', 'activities');
}
