/**
 * The back office CRM, as the server stores it (migration
 * 20261031000000_irly_crm). Pure data and rules only: no React, no network,
 * so scripts/check-crm.mts can test the statistics, duplicates and CSV.
 */

export type Stage = 'new' | 'qualify' | 'to_contact' | 'contacted' | 'waiting' | 'follow_up' | 'interested' | 'negotiation' | 'confirmed' | 'active' | 'lost';
export type Category = 'influencer' | 'event_organizer' | 'company' | 'partner' | 'ambassador' | 'venue' | 'other';
export type OrgKind = 'company' | 'event_organizer' | 'venue' | 'community' | 'agency' | 'brand' | 'other';
export type PartnershipKind = 'event_organizer' | 'venue' | 'company' | 'community' | 'influencer' | 'launch' | 'network' | 'other';
export type PartnershipStatus = 'idea' | 'proposed' | 'negotiating' | 'active' | 'paused' | 'completed' | 'cancelled';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type Channel = 'tiktok' | 'instagram' | 'youtube' | 'snapchat' | 'x' | 'linkedin' | 'google' | 'email' | 'influencer' | 'event' | 'other';
export type CampaignStatus = 'draft' | 'planned' | 'running' | 'paused' | 'ended';

export type Socials = Partial<Record<'instagram' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'snapchat', string>>;

/** Fields that only fit some contacts (influencers, organisers): never required. */
export type Details = Partial<{
  platforms: string;
  audience: string;
  theme: string;
  budget: string;
  proposal: string;
  deliverables: string;
  results: string;
  event_types: string;
  interest: string;
  planned: string;
}>;

export type Contact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  organization_id: string | null;
  company: string | null;
  job_title: string | null;
  category: Category;
  email: string | null;
  phone: string | null;
  website: string | null;
  socials: Socials;
  city: string | null;
  country: string | null;
  language: string | null;
  source: string | null;
  stage: Stage;
  stage_changed_at: string;
  tags: string[];
  notes: string | null;
  details: Details;
  last_contact_at: string | null;
  next_follow_up: string | null;
  owner_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  kind: OrgKind;
  website: string | null;
  socials: Socials;
  city: string | null;
  country: string | null;
  network_target: boolean;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Partnership = {
  id: string;
  title: string;
  kind: PartnershipKind;
  objective: string | null;
  status: PartnershipStatus;
  organization_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  budget: number | null;
  currency: string;
  deliverables: string | null;
  results: string | null;
  notes: string | null;
  next_due: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Linked contacts (crm_partnership_contacts). */
  contact_ids: string[];
};

export type Task = {
  id: string;
  title: string;
  contact_id: string | null;
  partnership_id: string | null;
  due_on: string | null;
  priority: Priority;
  notes: string | null;
  assignee_id: string | null;
  done_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Campaign = {
  id: string;
  name: string;
  channel: Channel;
  objective: string | null;
  status: CampaignStatus;
  starts_on: string | null;
  ends_on: string | null;
  budget: number | null;
  currency: string;
  url: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  impressions: number | null;
  clicks: number | null;
  signups_reported: number | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StageChange = { id: number; contact_id: string; from_stage: Stage | null; to_stage: Stage; changed_by: string | null; at: string };

// ───────── Words (English keys; French in src/i18n/fr.ts) ─────────

export const STAGES: { value: Stage; label: string }[] = [
  { value: 'new', label: 'New prospect' },
  { value: 'qualify', label: 'To qualify' },
  { value: 'to_contact', label: 'To contact' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'waiting', label: 'Waiting for a reply' },
  { value: 'follow_up', label: 'Follow-up needed' },
  { value: 'interested', label: 'Interested' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'confirmed', label: 'Collaboration confirmed' },
  { value: 'active', label: 'Active partner' },
  { value: 'lost', label: 'Declined or dropped' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label])) as Record<Stage, string>;

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'influencer', label: 'Influencer' },
  { value: 'event_organizer', label: 'Event organiser' },
  { value: 'company', label: 'Company' },
  { value: 'partner', label: 'Business partner' },
  { value: 'ambassador', label: 'Ambassador' },
  { value: 'venue', label: 'Venue' },
  { value: 'other', label: 'Other' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((s) => [s.value, s.label])) as Record<Category, string>;

export const ORG_KINDS: { value: OrgKind; label: string }[] = [
  { value: 'company', label: 'Company' },
  { value: 'event_organizer', label: 'Event organiser' },
  { value: 'venue', label: 'Venue' },
  { value: 'community', label: 'Community' },
  { value: 'agency', label: 'Agency' },
  { value: 'brand', label: 'Brand' },
  { value: 'other', label: 'Other' },
];
export const ORG_KIND_LABEL = Object.fromEntries(ORG_KINDS.map((s) => [s.value, s.label])) as Record<OrgKind, string>;

export const PARTNERSHIP_KINDS: { value: PartnershipKind; label: string }[] = [
  { value: 'event_organizer', label: 'Event organiser' },
  { value: 'venue', label: 'Venue' },
  { value: 'company', label: 'Company' },
  { value: 'community', label: 'Community' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'launch', label: 'Launch partner' },
  { value: 'network', label: 'IRLY Network' },
  { value: 'other', label: 'Other' },
];
export const PARTNERSHIP_KIND_LABEL = Object.fromEntries(PARTNERSHIP_KINDS.map((s) => [s.value, s.label])) as Record<PartnershipKind, string>;

export const PARTNERSHIP_STATUSES: { value: PartnershipStatus; label: string }[] = [
  { value: 'idea', label: 'Idea' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
export const PARTNERSHIP_STATUS_LABEL = Object.fromEntries(PARTNERSHIP_STATUSES.map((s) => [s.value, s.label])) as Record<PartnershipStatus, string>;

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
export const PRIORITY_LABEL = Object.fromEntries(PRIORITIES.map((s) => [s.value, s.label])) as Record<Priority, string>;

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'x', label: 'X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google', label: 'Google' },
  { value: 'email', label: 'Email' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'event', label: 'Event' },
  { value: 'other', label: 'Other' },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((s) => [s.value, s.label])) as Record<Channel, string>;

export const CAMPAIGN_STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
  { value: 'running', label: 'Running' },
  { value: 'paused', label: 'Paused' },
  { value: 'ended', label: 'Ended' },
];
export const CAMPAIGN_STATUS_LABEL = Object.fromEntries(CAMPAIGN_STATUSES.map((s) => [s.value, s.label])) as Record<CampaignStatus, string>;

export const SOCIAL_KEYS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'snapchat'] as const;

// ───────── Helpers ─────────

/** Today in the device's calendar, as YYYY-MM-DD (dates in the CRM have no time). */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** A YYYY-MM-DD that is a real date, or null. */
export function cleanDate(v: string | null | undefined): string | null {
  const s = (v ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

export function contactName(c: Pick<Contact, 'first_name' | 'last_name' | 'company'>): string {
  const n = [c.first_name, c.last_name].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
  return n || (c.company ?? '').trim() || '—';
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

/**
 * Contacts that look like the same person: same email, or same full name at
 * the same company. Archived ones count too (re-adding someone already
 * archived is worth a warning).
 */
export function duplicatesOf(c: Partial<Contact>, all: Contact[]): Contact[] {
  const email = norm(c.email);
  const name = norm([c.first_name, c.last_name].filter(Boolean).join(' '));
  const company = norm(c.company);
  return all.filter((o) => {
    if (o.id === c.id) return false;
    if (email && norm(o.email) === email) return true;
    const oName = norm([o.first_name, o.last_name].filter(Boolean).join(' '));
    return Boolean(name) && oName === name && norm(o.company) === company && (Boolean(company) || (c.organization_id ?? null) === o.organization_id);
  });
}

export function matchesSearch(c: Contact, q: string, orgName?: string): boolean {
  const s = norm(q);
  if (!s) return true;
  return [c.first_name, c.last_name, c.company, orgName, c.email, c.city, c.country, c.job_title, c.source, ...c.tags, ...Object.values(c.socials ?? {})].some((v) => norm(v).includes(s));
}

// ───────── Overview statistics ─────────

export type Period = '7d' | '30d' | '90d' | 'all';
export const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'all', label: 'All time' },
];

export function since(period: Period, now = new Date()): number {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 0;
  return days ? now.getTime() - days * 86_400_000 : -Infinity;
}

const OPEN_STAGES: Stage[] = ['new', 'qualify', 'to_contact', 'contacted', 'waiting', 'follow_up', 'interested', 'negotiation'];
const REACHED: Stage[] = ['contacted', 'waiting', 'follow_up', 'interested', 'negotiation', 'confirmed', 'active', 'lost'];
const WON: Stage[] = ['confirmed', 'active'];

export type Overview = {
  prospects: number;
  newContacts: number;
  toFollowUp: number;
  partnershipsOngoing: number;
  partnersActive: number;
  influencersContacted: number;
  organisersContacted: number;
  networkInterested: number;
  tasksLate: number;
  upcoming: { kind: 'task' | 'follow_up' | 'partnership'; id: string; title: string; on: string }[];
  /** Won ÷ (won + lost) among contacts that reached a decision; null with no decision yet. */
  conversion: number | null;
  byStage: { stage: Stage; n: number }[];
  campaigns: { id: string; name: string; channel: Channel; budget: number | null; currency: string; signups: number | null; costPerSignup: number | null; clicks: number | null }[];
};

/**
 * Every figure of the overview from the CRM's own rows (no estimates): a
 * period limits "new" counts to contacts created within it, a category
 * limits the contact figures to that kind of contact.
 */
export function overview(
  input: { contacts: Contact[]; orgs: Organization[]; partnerships: Partnership[]; tasks: Task[]; campaigns: Campaign[]; signups: Record<string, number> | null },
  period: Period,
  category: Category | 'all',
  now = new Date(),
): Overview {
  const day = today(now);
  const from = since(period, now);
  const live = input.contacts.filter((c) => !c.archived_at && (category === 'all' || c.category === category));
  const inPeriod = (iso: string) => new Date(iso).getTime() >= from;
  const contactName2 = (id: string | null) => {
    const c = id ? input.contacts.find((x) => x.id === id) : null;
    return c ? contactName(c) : '';
  };
  const wonN = live.filter((c) => WON.includes(c.stage)).length;
  const lostN = live.filter((c) => c.stage === 'lost').length;
  const openTasks = input.tasks.filter((t) => !t.done_at);
  const parts = input.partnerships.filter((p) => !p.archived_at);
  const in14 = today(new Date(now.getTime() + 14 * 86_400_000));
  const upcoming: Overview['upcoming'] = [
    ...openTasks.filter((t) => t.due_on && t.due_on >= day && t.due_on <= in14).map((t) => ({ kind: 'task' as const, id: t.id, title: t.title + (t.contact_id ? ` · ${contactName2(t.contact_id)}` : ''), on: t.due_on! })),
    ...live.filter((c) => c.next_follow_up && c.next_follow_up >= day && c.next_follow_up <= in14).map((c) => ({ kind: 'follow_up' as const, id: c.id, title: contactName(c), on: c.next_follow_up! })),
    ...parts.filter((p) => p.next_due && p.next_due >= day && p.next_due <= in14).map((p) => ({ kind: 'partnership' as const, id: p.id, title: p.title, on: p.next_due! })),
  ].sort((a, b) => a.on.localeCompare(b.on));

  return {
    prospects: live.filter((c) => OPEN_STAGES.includes(c.stage)).length,
    newContacts: live.filter((c) => inPeriod(c.created_at)).length,
    toFollowUp: live.filter((c) => c.stage === 'follow_up' || (c.next_follow_up !== null && c.next_follow_up <= day && c.stage !== 'lost')).length,
    partnershipsOngoing: parts.filter((p) => p.status === 'proposed' || p.status === 'negotiating').length,
    partnersActive: parts.filter((p) => p.status === 'active').length,
    influencersContacted: live.filter((c) => c.category === 'influencer' && REACHED.includes(c.stage)).length,
    organisersContacted: live.filter((c) => c.category === 'event_organizer' && REACHED.includes(c.stage)).length,
    networkInterested: input.orgs.filter((o) => !o.archived_at && o.network_target).length,
    tasksLate: openTasks.filter((t) => t.due_on !== null && t.due_on < day).length,
    upcoming: upcoming.slice(0, 8),
    conversion: wonN + lostN ? wonN / (wonN + lostN) : null,
    byStage: STAGES.map((s) => ({ stage: s.value, n: live.filter((c) => c.stage === s.value).length })),
    campaigns: input.campaigns
      .filter((c) => !c.archived_at)
      .map((c) => {
        const tracked = input.signups && c.utm_campaign ? (input.signups[c.utm_campaign.toLowerCase()] ?? 0) : null;
        const signups = tracked ?? c.signups_reported;
        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          budget: c.budget,
          currency: c.currency,
          signups,
          costPerSignup: c.budget !== null && signups ? Math.round((c.budget / signups) * 100) / 100 : null,
          clicks: c.clicks,
        };
      }),
  };
}

// ───────── CSV ─────────

export const CSV_COLUMNS = [
  'first_name', 'last_name', 'company', 'job_title', 'category', 'email', 'phone', 'website',
  'instagram', 'tiktok', 'youtube', 'linkedin', 'city', 'country', 'language', 'source', 'stage', 'tags',
  'last_contact_at', 'next_follow_up', 'notes',
] as const;

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // A leading = + - @ would run as a formula in a spreadsheet: neutralised.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(contacts: Contact[]): string {
  const rows = contacts.map((c) =>
    CSV_COLUMNS.map((k) => {
      if (k === 'instagram' || k === 'tiktok' || k === 'youtube' || k === 'linkedin') return cell(c.socials?.[k]);
      if (k === 'tags') return cell(c.tags.join('; '));
      return cell(c[k]);
    }).join(','),
  );
  return [CSV_COLUMNS.join(','), ...rows].join('\n');
}

/** RFC 4180-ish: quoted fields, doubled quotes, commas or semicolons as separators. */
export function parseCsvRows(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export type ImportRow = { line: number; contact?: Partial<Contact>; error?: string };

const HEADER_ALIASES: Record<string, (typeof CSV_COLUMNS)[number]> = {
  firstname: 'first_name', prenom: 'first_name', 'first name': 'first_name',
  lastname: 'last_name', nom: 'last_name', 'last name': 'last_name',
  entreprise: 'company', organisation: 'company', organization: 'company',
  fonction: 'job_title', title: 'job_title', 'job title': 'job_title',
  categorie: 'category', mail: 'email', 'e-mail': 'email', telephone: 'phone', tel: 'phone',
  site: 'website', ville: 'city', pays: 'country', langue: 'language', statut: 'stage', status: 'stage',
};

/** CSV text → contacts to create (or the reason a line is refused). Unknown columns are ignored. */
export function parseContactsCsv(text: string): ImportRow[] {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => {
    const k = norm(h).replace(/[^a-z_ -]/g, '');
    return (CSV_COLUMNS as readonly string[]).includes(k) ? (k as (typeof CSV_COLUMNS)[number]) : (HEADER_ALIASES[k] ?? null);
  });
  if (!head.some(Boolean)) return [{ line: 1, error: 'No known column in the first line' }];
  const stages = new Set(STAGES.map((s) => s.value));
  const cats = new Set(CATEGORIES.map((s) => s.value));
  return rows.slice(1).map((r, i) => {
    const line = i + 2;
    const v: Record<string, string> = {};
    head.forEach((k, j) => {
      if (k) v[k] = (r[j] ?? '').trim().replace(/^'(?=[=+\-@])/, '');
    });
    const c: Partial<Contact> = {
      first_name: v.first_name || null,
      last_name: v.last_name || null,
      company: v.company || null,
      job_title: v.job_title || null,
      category: cats.has(v.category as Category) ? (v.category as Category) : 'other',
      email: v.email || null,
      phone: v.phone || null,
      website: v.website || null,
      city: v.city || null,
      country: v.country || null,
      language: v.language || null,
      source: v.source || 'CSV import',
      stage: stages.has(v.stage as Stage) ? (v.stage as Stage) : 'new',
      tags: (v.tags ?? '').split(/[;|]/).map((t) => t.trim()).filter(Boolean).slice(0, 30),
      last_contact_at: cleanDate(v.last_contact_at),
      next_follow_up: cleanDate(v.next_follow_up),
      notes: v.notes || null,
      socials: Object.fromEntries((['instagram', 'tiktok', 'youtube', 'linkedin'] as const).filter((k) => v[k]).map((k) => [k, v[k]])),
      details: {},
    };
    if (!c.first_name && !c.last_name && !c.company) return { line, error: 'A name or a company is needed' };
    if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return { line, error: 'The email is not valid' };
    return { line, contact: c };
  });
}
