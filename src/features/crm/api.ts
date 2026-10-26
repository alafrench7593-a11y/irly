import { DEMO } from '@/config/app';
import { supabase } from '@/lib/supabase';
import type { Campaign, Contact, Organization, Partnership, StageChange, Task } from './model';

/**
 * The CRM tables, read and written directly: row level security lets only
 * back office owners and admins in (migration 20261031000000_irly_crm), so
 * the app needs no privileged key. Nothing is deleted: rows are archived.
 *
 * The demo build (no server) keeps example rows in memory, for screenshots
 * and UI checks; they vanish on reload and never reach a server.
 */

type Table = 'crm_contacts' | 'crm_organizations' | 'crm_partnerships' | 'crm_tasks' | 'crm_campaigns';
type Row = { id: string } & Record<string, unknown>;

const memory: Record<Table, Row[]> | null = DEMO && !supabase ? demoRows() : null;
let links: { partnership_id: string; contact_id: string }[] = memory ? [{ partnership_id: 'demo-p1', contact_id: 'demo-c2' }] : [];
const history: StageChange[] = [];

function db() {
  if (!supabase) throw new Error('Not connected');
  return supabase;
}

async function list<T>(table: Table, order = 'updated_at'): Promise<T[]> {
  if (memory) return memory[table].map((r) => ({ ...r })) as T[];
  const { data, error } = await db().from(table).select('*').order(order, { ascending: false }).limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

const BOOKKEEPING = ['id', 'created_at', 'updated_at', 'created_by', 'stage_changed_at', 'contact_ids'];

async function save<T extends { id: string }>(table: Table, row: Partial<T>): Promise<T> {
  const values = Object.fromEntries(Object.entries(row).filter(([k, v]) => !BOOKKEEPING.includes(k) && v !== undefined));
  if (memory) {
    const now = new Date().toISOString();
    const rows = memory[table];
    const at = row.id ? rows.findIndex((r) => r.id === row.id) : -1;
    if (at >= 0) {
      const before = rows[at];
      if (table === 'crm_contacts' && values.stage && values.stage !== before.stage) {
        history.unshift({ id: history.length + 1, contact_id: before.id, from_stage: before.stage as StageChange['from_stage'], to_stage: values.stage as StageChange['to_stage'], changed_by: 'demo', at: now });
        values.stage_changed_at = now;
      }
      rows[at] = { ...before, ...values, updated_at: now };
      return { ...rows[at] } as unknown as T;
    }
    const created = { ...defaults(table), ...values, id: `demo-${Math.random().toString(36).slice(2, 10)}`, created_at: now, updated_at: now } as Row;
    if (table === 'crm_contacts') history.unshift({ id: history.length + 1, contact_id: created.id, from_stage: null, to_stage: created.stage as StageChange['to_stage'], changed_by: 'demo', at: now });
    rows.unshift(created);
    return { ...created } as unknown as T;
  }
  const q = row.id ? db().from(table).update(values).eq('id', row.id) : db().from(table).insert(values);
  const { data, error } = await q.select('*').single();
  if (error) throw new Error(error.message);
  return data as T;
}

const archive = (table: Table, id: string, archived: boolean) => save<Row>(table, { id, archived_at: archived ? new Date().toISOString() : null });

// ───────── Contacts ─────────
export const listContacts = () => list<Contact>('crm_contacts');
export const saveContact = (c: Partial<Contact>) => save<Contact>('crm_contacts', c);
export const archiveContact = (id: string, archived = true) => archive('crm_contacts', id, archived);

export async function stageHistory(contactId: string): Promise<StageChange[]> {
  if (memory) return history.filter((h) => h.contact_id === contactId);
  const { data, error } = await db().from('crm_stage_history').select('*').eq('contact_id', contactId).order('at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as StageChange[];
}

// ───────── Organisations ─────────
export const listOrgs = () => list<Organization>('crm_organizations');
export const saveOrg = (o: Partial<Organization>) => save<Organization>('crm_organizations', o);
export const archiveOrg = (id: string, archived = true) => archive('crm_organizations', id, archived);

// ───────── Partnerships ─────────
export async function listPartnerships(): Promise<Partnership[]> {
  const rows = await list<Omit<Partnership, 'contact_ids'>>('crm_partnerships');
  let all = links;
  if (!memory) {
    const { data, error } = await db().from('crm_partnership_contacts').select('partnership_id, contact_id').limit(10000);
    if (error) throw new Error(error.message);
    all = data ?? [];
  }
  return rows.map((p) => ({ ...p, contact_ids: all.filter((l) => l.partnership_id === p.id).map((l) => l.contact_id) }));
}

export async function savePartnership(p: Partial<Partnership>, contactIds: string[]): Promise<Partnership> {
  const saved = await save<Omit<Partnership, 'contact_ids'> & { id: string }>('crm_partnerships', p);
  const before = memory ? links.filter((l) => l.partnership_id === saved.id).map((l) => l.contact_id) : (p.contact_ids ?? []);
  const add = contactIds.filter((c) => !before.includes(c));
  const remove = before.filter((c) => !contactIds.includes(c));
  if (memory) {
    links = [...links.filter((l) => !(l.partnership_id === saved.id && remove.includes(l.contact_id))), ...add.map((c) => ({ partnership_id: saved.id, contact_id: c }))];
  } else {
    if (add.length) {
      const { error } = await db().from('crm_partnership_contacts').upsert(add.map((c) => ({ partnership_id: saved.id, contact_id: c })), { onConflict: 'partnership_id,contact_id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    if (remove.length) {
      const { error } = await db().from('crm_partnership_contacts').delete().eq('partnership_id', saved.id).in('contact_id', remove);
      if (error) throw new Error(error.message);
    }
  }
  return { ...saved, contact_ids: contactIds };
}
export const archivePartnership = (id: string, archived = true) => archive('crm_partnerships', id, archived);

// ───────── Tasks ─────────
export const listTasks = () => list<Task>('crm_tasks');
export const saveTask = (t: Partial<Task>) => save<Task>('crm_tasks', t);
export const setTaskDone = (id: string, done: boolean) => save<Task>('crm_tasks', { id, done_at: done ? new Date().toISOString() : null });

// ───────── Campaigns ─────────
export const listCampaigns = () => list<Campaign>('crm_campaigns');
export const saveCampaign = (c: Partial<Campaign>) => save<Campaign>('crm_campaigns', c);
export const archiveCampaign = (id: string, archived = true) => archive('crm_campaigns', id, archived);

/**
 * Signups per utm_campaign (lower case), counted from the app's SIGNUP
 * analytics events, which carry the utm values of the visit (src/lib/analytics).
 * Admins may read analytics events (policy analytics_admin); only the
 * campaign tag is read, never who signed up. Null when it cannot be read.
 */
export async function campaignSignups(): Promise<Record<string, number> | null> {
  if (memory) return { 'tiktok-launch': 3 };
  const { data, error } = await db().from('analytics_events').select('props').eq('name', 'SIGNUP').not('props->>utm_campaign', 'is', null).limit(10000);
  if (error) return null;
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { props: { utm_campaign?: string } }[]) {
    const k = String(r.props?.utm_campaign ?? '').toLowerCase();
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

// ───────── Demo rows (demo build only: invented, clearly marked) ─────────

function defaults(table: Table): Record<string, unknown> {
  switch (table) {
    case 'crm_contacts':
      return { first_name: null, last_name: null, organization_id: null, company: null, job_title: null, category: 'other', email: null, phone: null, website: null, socials: {}, city: null, country: null, language: null, source: null, stage: 'new', stage_changed_at: new Date().toISOString(), tags: [], notes: null, details: {}, last_contact_at: null, next_follow_up: null, owner_id: null, archived_at: null };
    case 'crm_organizations':
      return { kind: 'company', website: null, socials: {}, city: null, country: null, network_target: false, notes: null, archived_at: null };
    case 'crm_partnerships':
      return { kind: 'other', objective: null, status: 'proposed', organization_id: null, starts_on: null, ends_on: null, budget: null, currency: 'AED', deliverables: null, results: null, notes: null, next_due: null, archived_at: null };
    case 'crm_tasks':
      return { contact_id: null, partnership_id: null, due_on: null, priority: 'normal', notes: null, assignee_id: null, done_at: null };
    case 'crm_campaigns':
      return { channel: 'other', objective: null, status: 'draft', starts_on: null, ends_on: null, budget: null, currency: 'AED', url: null, utm_source: null, utm_medium: null, utm_campaign: null, impressions: null, clicks: null, signups_reported: null, notes: null, archived_at: null };
  }
}

function demoRows(): Record<Table, Row[]> {
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const ago = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
  const c = (id: string, v: Record<string, unknown>): Row => ({ ...defaults('crm_contacts'), id, created_at: ago(10), updated_at: ago(1), stage_changed_at: ago(3), ...v });
  return {
    crm_organizations: [
      { ...defaults('crm_organizations'), id: 'demo-o1', name: 'Example Events (demo)', kind: 'event_organizer', city: 'Dubai', country: 'UAE', network_target: false, created_at: ago(20), updated_at: ago(2) },
      { ...defaults('crm_organizations'), id: 'demo-o2', name: 'Example Studio (demo)', kind: 'company', city: 'Dubai', country: 'UAE', network_target: true, created_at: ago(15), updated_at: ago(5) },
    ],
    crm_contacts: [
      c('demo-c1', { first_name: 'Demo', last_name: 'Creator', category: 'influencer', stage: 'contacted', email: 'creator@example.com', socials: { tiktok: '@demo.creator' }, tags: ['launch'], details: { platforms: 'TikTok, Instagram', theme: 'Outings in Dubai' }, next_follow_up: day(-1), created_at: ago(3) }),
      c('demo-c2', { first_name: 'Demo', last_name: 'Organiser', category: 'event_organizer', organization_id: 'demo-o1', stage: 'negotiation', email: 'events@example.com', details: { event_types: 'Run clubs' }, next_follow_up: day(2) }),
      c('demo-c3', { first_name: 'Demo', last_name: 'Founder', category: 'company', organization_id: 'demo-o2', company: 'Example Studio (demo)', stage: 'new', created_at: ago(40) }),
      c('demo-c4', { company: 'Example Café (demo)', category: 'venue', stage: 'active' }),
      c('demo-c5', { first_name: 'Demo', last_name: 'Ambassador', category: 'ambassador', stage: 'lost' }),
    ],
    crm_partnerships: [
      { ...defaults('crm_partnerships'), id: 'demo-p1', title: 'Weekly run series (demo)', kind: 'event_organizer', status: 'negotiating', organization_id: 'demo-o1', objective: 'Co-host a weekly run', next_due: day(3), budget: 1500, created_at: ago(8), updated_at: ago(1) },
    ],
    crm_tasks: [
      { ...defaults('crm_tasks'), id: 'demo-t1', title: 'Send the partnership deck', contact_id: 'demo-c2', due_on: day(-2), priority: 'high', created_at: ago(5), updated_at: ago(5) },
      { ...defaults('crm_tasks'), id: 'demo-t2', title: 'Call back', contact_id: 'demo-c1', due_on: day(0), created_at: ago(2), updated_at: ago(2) },
    ],
    crm_campaigns: [
      { ...defaults('crm_campaigns'), id: 'demo-k1', name: 'TikTok launch (demo)', channel: 'tiktok', status: 'running', budget: 600, utm_source: 'tiktok', utm_medium: 'paid', utm_campaign: 'tiktok-launch', clicks: 240, impressions: 12000, created_at: ago(6), updated_at: ago(1) },
    ],
  };
}
