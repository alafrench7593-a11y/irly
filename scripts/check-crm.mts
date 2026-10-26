// Back office CRM rules, without the app or a server: the overview figures
// match the rows they are counted from, duplicates are found, CSV survives
// a round trip (commas, quotes, line breaks, spreadsheet formulas), bad
// lines are refused with a reason, dates are checked.
//
//   node --experimental-strip-types --no-warnings --import ./scripts/alias.mjs scripts/check-crm.mts
import assert from 'node:assert/strict';
import { cleanDate, duplicatesOf, overview, parseContactsCsv, parseCsvRows, toCsv, today, type Campaign, type Contact, type Organization, type Partnership, type Task } from '../src/features/crm/model.ts';

let n = 0;
function check(label: string, fn: () => void) {
  fn();
  n++;
  console.log(`ok  ${label}`);
}

const NOW = new Date('2026-10-26T10:00:00');
const day = (d: number) => today(new Date(NOW.getTime() + d * 86_400_000));
const iso = (d: number) => new Date(NOW.getTime() + d * 86_400_000).toISOString();

const contact = (id: string, v: Partial<Contact> = {}): Contact => ({
  id, first_name: null, last_name: null, organization_id: null, company: null, job_title: null, category: 'other', email: null, phone: null, website: null,
  socials: {}, city: null, country: null, language: null, source: null, stage: 'new', stage_changed_at: iso(-1), tags: [], notes: null, details: {},
  last_contact_at: null, next_follow_up: null, owner_id: null, archived_at: null, created_at: iso(-60), updated_at: iso(-1), ...v,
});
const task = (id: string, v: Partial<Task> = {}): Task => ({ id, title: id, contact_id: null, partnership_id: null, due_on: null, priority: 'normal', notes: null, assignee_id: null, done_at: null, created_at: iso(-5), updated_at: iso(-5), ...v });
const part = (id: string, v: Partial<Partnership> = {}): Partnership => ({
  id, title: id, kind: 'other', objective: null, status: 'proposed', organization_id: null, starts_on: null, ends_on: null, budget: null, currency: 'AED',
  deliverables: null, results: null, notes: null, next_due: null, archived_at: null, created_at: iso(-5), updated_at: iso(-5), contact_ids: [], ...v,
});
const org = (id: string, v: Partial<Organization> = {}): Organization => ({ id, name: id, kind: 'company', website: null, socials: {}, city: null, country: null, network_target: false, notes: null, archived_at: null, created_at: iso(-5), updated_at: iso(-5), ...v });
const camp = (id: string, v: Partial<Campaign> = {}): Campaign => ({
  id, name: id, channel: 'tiktok', objective: null, status: 'running', starts_on: null, ends_on: null, budget: null, currency: 'AED', url: null, utm_source: null,
  utm_medium: null, utm_campaign: null, impressions: null, clicks: null, signups_reported: null, notes: null, archived_at: null, created_at: iso(-5), updated_at: iso(-5), ...v,
});

const contacts = [
  contact('a', { first_name: 'Ana', category: 'influencer', stage: 'contacted', created_at: iso(-3), next_follow_up: day(-1) }),
  contact('b', { first_name: 'Ben', category: 'influencer', stage: 'new', created_at: iso(-20) }),
  contact('c', { first_name: 'Cas', category: 'event_organizer', stage: 'waiting', created_at: iso(-40) }),
  contact('d', { company: 'Venue', category: 'venue', stage: 'active' }),
  contact('e', { first_name: 'Eve', category: 'company', stage: 'lost' }),
  contact('f', { first_name: 'Fay', category: 'company', stage: 'follow_up' }),
  contact('g', { first_name: 'Gil', stage: 'new', archived_at: iso(-1), created_at: iso(-1) }),
  contact('h', { first_name: 'Hal', stage: 'lost', next_follow_up: day(-3) }),
];
const input = {
  contacts,
  orgs: [org('o1', { network_target: true }), org('o2'), org('o3', { network_target: true, archived_at: iso(-1) })],
  partnerships: [part('p1', { status: 'negotiating', next_due: day(2) }), part('p2', { status: 'active' }), part('p3', { status: 'proposed', archived_at: iso(-1) })],
  tasks: [task('t1', { due_on: day(-2) }), task('t2', { due_on: day(0), contact_id: 'a' }), task('t3', { due_on: day(-5), done_at: iso(-1) }), task('t4', { due_on: day(30) })],
  campaigns: [camp('k1', { budget: 600, utm_campaign: 'Launch' }), camp('k2', { budget: 100, signups_reported: 4 }), camp('k3', { budget: 50, utm_campaign: 'quiet' }), camp('k4', { archived_at: iso(-1) })],
  signups: { launch: 3 },
};

check('overview counts come from the rows (all time, every type)', () => {
  const o = overview(input, 'all', 'all', NOW);
  assert.equal(o.prospects, 4, 'open stages only, archived excluded'); // a, b, c, f
  assert.equal(o.newContacts, 7, 'all time: every live contact');
  assert.equal(o.toFollowUp, 2, 'follow_up stage or overdue follow-up, never a lost one'); // a (overdue), f (stage)
  assert.equal(o.partnershipsOngoing, 1);
  assert.equal(o.partnersActive, 1);
  assert.equal(o.influencersContacted, 1);
  assert.equal(o.organisersContacted, 1);
  assert.equal(o.networkInterested, 1, 'archived organisations do not count');
  assert.equal(o.tasksLate, 1, 'done tasks are never late');
  assert.equal(o.conversion, 1 / 3, 'won (active) ÷ decided (active + 2 lost)');
  assert.equal(o.byStage.reduce((s, x) => s + x.n, 0), 7);
});

check('period and type filters narrow the figures', () => {
  assert.equal(overview(input, '7d', 'all', NOW).newContacts, 1);
  assert.equal(overview(input, '30d', 'all', NOW).newContacts, 2);
  const inf = overview(input, 'all', 'influencer', NOW);
  assert.equal(inf.prospects, 2);
  assert.equal(inf.conversion, null, 'no decision yet: no made-up rate');
});

check('next deadlines: today to 14 days, sorted, with their kind', () => {
  const up = overview(input, 'all', 'all', NOW).upcoming;
  assert.deepEqual(up.map((u) => `${u.kind}:${u.id}`), ['task:t2', 'partnership:p1']);
  assert.match(up[0].title, /Ana/);
});

check('campaign signups: tracked by utm_campaign (any case), else entered by hand, else none', () => {
  const k = overview(input, 'all', 'all', NOW).campaigns;
  assert.equal(k.length, 3, 'archived campaigns left out');
  assert.deepEqual(k.find((c) => c.id === 'k1'), { id: 'k1', name: 'k1', channel: 'tiktok', budget: 600, currency: 'AED', signups: 3, costPerSignup: 200, clicks: null });
  assert.equal(k.find((c) => c.id === 'k2')!.signups, 4);
  assert.equal(k.find((c) => c.id === 'k2')!.costPerSignup, 25);
  assert.equal(k.find((c) => c.id === 'k3')!.signups, 0, 'a tagged campaign with no signup reads 0, not unknown');
  assert.equal(k.find((c) => c.id === 'k3')!.costPerSignup, null, 'no division by zero');
  const offline = overview({ ...input, signups: null }, 'all', 'all', NOW).campaigns;
  assert.equal(offline.find((c) => c.id === 'k1')!.signups, null, 'analytics unreadable: unknown, not 0');
});

check('duplicates: same email (any case), or same name at the same company', () => {
  const all = [contact('x', { first_name: 'Léa', last_name: 'Martin', company: 'Acme', email: 'Lea@Example.com' }), contact('y', { first_name: 'Sam' })];
  assert.equal(duplicatesOf({ email: 'lea@example.com ' }, all).length, 1);
  assert.equal(duplicatesOf({ first_name: 'lea', last_name: 'MARTIN', company: 'acme' }, all).length, 1, 'accents and case ignored');
  assert.equal(duplicatesOf({ first_name: 'Léa', last_name: 'Martin', company: 'Other' }, all).length, 0);
  assert.equal(duplicatesOf({ id: 'x', email: 'lea@example.com' }, all).length, 0, 'a contact is not its own duplicate');
  assert.equal(duplicatesOf({ first_name: 'Sam' }, all).length, 1);
});

check('CSV: round trip keeps commas, quotes and line breaks; formulas are neutralised', () => {
  const c = contact('r', { first_name: 'Zoé', last_name: 'O"Neil', company: 'A, B & Co', notes: 'line 1\nline 2', tags: ['vip', 'launch'], socials: { instagram: '@zoe' }, email: 'zoe@example.com', next_follow_up: '2026-11-02' });
  const evil = contact('s', { first_name: '=HYPERLINK("http://x")' });
  const csv = toCsv([c, evil]);
  assert.match(csv, /'=HYPERLINK/, 'a cell starting with = is prefixed so a spreadsheet does not run it');
  const back = parseContactsCsv(csv);
  assert.equal(back.length, 2);
  const r = back[0].contact!;
  assert.equal(r.first_name, 'Zoé');
  assert.equal(r.last_name, 'O"Neil');
  assert.equal(r.company, 'A, B & Co');
  assert.equal(r.notes, 'line 1\nline 2');
  assert.deepEqual(r.tags, ['vip', 'launch']);
  assert.deepEqual(r.socials, { instagram: '@zoe' });
  assert.equal(r.next_follow_up, '2026-11-02');
  assert.equal(back[1].contact!.first_name, '=HYPERLINK("http://x")', 'the protective quote is removed on import');
});

check('CSV import: French headers, semicolons, defaults, refused lines', () => {
  const rows = parseContactsCsv('Prénom;Nom;Entreprise;E-mail;Statut\nAli;Ba;;ali@example.com;interested\n;;;;\n;;;bad;new\nNo;Mail;Co;not-an-email;new\nUma;;;;won\n');
  assert.equal(rows.length, 4, 'empty lines skipped');
  assert.equal(rows[0].contact!.stage, 'interested');
  assert.equal(rows[0].contact!.source, 'CSV import');
  assert.equal(rows[1].error, 'A name or a company is needed');
  assert.equal(rows[2].error, 'The email is not valid');
  assert.equal(rows[3].contact!.stage, 'new', 'an unknown stage falls back to new');
  assert.equal(parseContactsCsv('foo,bar\n1,2')[0].error, 'No known column in the first line');
  assert.deepEqual(parseCsvRows('a,"b,c"\r\n"d ""e""",f'), [['a', 'b,c'], ['d "e"', 'f']]);
});

check('dates: real calendar days only', () => {
  assert.equal(cleanDate('2026-02-28'), '2026-02-28');
  assert.equal(cleanDate(' 2026-12-01 '), '2026-12-01');
  assert.equal(cleanDate('2026-02-30'), null);
  assert.equal(cleanDate('26/10/2026'), null);
  assert.equal(cleanDate(''), null);
});

console.log(`\n${n} CRM checks passed`);
