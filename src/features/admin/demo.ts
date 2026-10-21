/**
 * Example answers for the back office in the demo build only
 * (EXPO_PUBLIC_DEMO=1, no server): the screens can be shown and checked
 * without any real member's data. Never used when a server is configured.
 * Changes are refused (nothing is saved in the demo).
 */
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ahead = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const U1 = 'd0000000-0000-0000-0000-000000000001';
const U2 = 'd0000000-0000-0000-0000-000000000002';
const C1 = 'd0000000-0000-0000-0000-0000000000c1';
const K1 = 'd0000000-0000-0000-0000-0000000000a1';
const K2 = 'd0000000-0000-0000-0000-0000000000a2';
const A1 = 'd0000000-0000-0000-0000-0000000000e1';
const P1 = 'd0000000-0000-0000-0000-0000000000f1';
const LIB = 'https://alafrench7593-a11y.github.io/irly/photos';

const READS: Record<string, unknown> = {
  mod_dashboard: { new: 2, high: 1, reviewing: 1, need_info: 0, week: 3, sanctions: 1, members: 128 },
  admin_overview: {
    users: 128, new_7d: 9, new_30d: 31, active_30d: 54, signins_30d: null, communities: 12, activities: 40, activities_upcoming: 17,
    posts: 210, lives: 4, reports_open: 2, reports_review: 1, reports_action: 0, reports_7d: 3, important_7d: 1, suspended: 1, banned: 0,
    hidden: 1, email_pending: 0, email_failed: 0,
    recent: [
      { at: ago(35), by: 'Demo admin', action: 'content.hide', target: 'Demo member' },
      { at: ago(240), by: 'Demo admin', action: 'sanction.suspension', target: 'Demo member' },
    ],
  },
  mod_cases: [
    { case_id: K1, status: 'open', priority: 'high', created_at: ago(20), updated_at: ago(20), category: 'threats', target_kind: 'community_post', target_id: P1, details: 'Example report text', reporter_id: U2, reporter_name: 'Demo reporter', target_user_id: U1, target_name: 'Demo member', reports_on_target: 2 },
    { case_id: K2, status: 'reviewing', priority: 'normal', created_at: ago(300), updated_at: ago(60), category: 'spam', target_kind: 'profile', target_id: U1, details: null, reporter_id: U2, reporter_name: 'Demo reporter', target_user_id: U1, target_name: 'Demo member', reports_on_target: 2 },
  ],
  mod_case: {
    case: { id: K1, status: 'open', priority: 'high', created_at: ago(20), updated_at: ago(20), decision: null },
    report: { id: K1, category: 'threats', details: 'Example report text', target_kind: 'community_post', target_id: P1, created_at: ago(20), reporter: { id: U2, name: 'Demo reporter' }, target_user: { id: U1, name: 'Demo member', deleted: false, role: null } },
    target: { body: 'Example post that was reported', removed: false },
    others: 1,
    notes: [],
    history: [],
    sanctions: [],
  },
  admin_case_related: [{ case_id: K2, status: 'reviewing', category: 'spam', target_kind: 'profile', created_at: ago(300), same_item: false }],
  mod_users: [{ user_id: U1, first_name: 'Demo member', username: 'demo', email: null, created_at: ago(60 * 24 * 40), deleted: false, role: null, sanction: 'suspension', sanction_ends: ahead(3), reports: 2 }],
  admin_user: {
    id: U1, first_name: 'Demo member', username: 'demo', city_id: 'dubai', created_at: ago(60 * 24 * 40), verified: false, role: null, photos: 3, email: null,
    status: 'suspended', status_until: ahead(3),
    counts: { activities: 2, communities: 1, posts: 5, reports_about: 2, reports_filed: 0 },
    reports: [{ case_id: K1, status: 'open', category: 'threats', target_kind: 'community_post', created_at: ago(20) }],
    sanctions: [{ id: A1, kind: 'suspension', reason: 'Threats in a community', created_at: ago(240), ends_at: ahead(3), lifted_at: null, lift_reason: null, by: 'Demo admin' }],
    history: [{ at: ago(240), action: 'sanction.suspension', by: 'Demo admin', reason: 'Threats in a community' }],
  },
  admin_communities: [
    { id: C1, name: 'Demo runners', city_id: 'dubai', girl_only: false, official: false, parent_id: null, members_count: 42, created_at: ago(60 * 24 * 30), removed: false, hidden: false, cover_path: null, creator_name: 'Demo member', reports: 1 },
  ],
  admin_community: {
    id: C1, name: 'Demo runners', tagline: 'Run together', description: 'An example community for the demo.', city_id: 'dubai', girl_only: false, official: false, emoji: null,
    cover_path: null, created_at: ago(60 * 24 * 30), parent_id: null, parent_name: null, creator: { id: U1, name: 'Demo member' },
    admins: [{ id: U1, name: 'Demo member', role: 'owner' }], member_count: 42, groups: 0, removed: false, hold: null,
    reports: [{ case_id: K2, status: 'reviewing', category: 'inappropriate', created_at: ago(500) }],
  },
  admin_content: [
    { id: P1, kind: 'community_post', title: 'Demo runners', body: 'Example post that was reported', author_id: U1, author_name: 'Demo member', created_at: ago(60), state: 'visible', girl_only: false, context: 'Demo runners', reports: 1 },
  ],
  admin_content_item: { kind: 'community_post', id: P1, body: 'Example post that was reported', author_id: U1, author_name: 'Demo member', created_at: ago(60), community: 'Demo runners', media: 0, deleted: false, hold: null, reports: [{ case_id: K1, status: 'open', category: 'threats', created_at: ago(20) }] },
  admin_journal: [
    { id: 2, at: ago(35), actor_name: 'Demo admin', action: 'content.hide', target_user: U1, target_name: 'Demo member', case_id: null, kind: 'activity', item_id: K1, reason: 'Unsafe meeting point', result: 'done' },
    { id: 1, at: ago(240), actor_name: 'Demo admin', action: 'sanction.suspension', target_user: U1, target_name: 'Demo member', case_id: K1, kind: null, item_id: null, reason: 'Threats in a community', result: 'done' },
  ],
  mod_audit: [],
  admin_settings: {
    report_email_to: null, report_email_scope: 'important', dashboard_url: 'https://getirly.com/app', updated: null,
    outbox: { pending: 0, sent: 0, failed: 0, last_sent: null, recent: [] },
  },
  staff_list: [{ user_id: U2, first_name: 'Demo admin', role: 'owner', granted_at: ago(60 * 24 * 60) }],
  mod_user_sanctions: [],
  // Photos: IRLY library pictures stand in for members' files (links show as they are).
  admin_photos: [
    { id: C1, kind: 'community', title: 'Demo runners', owner_id: U1, owner_name: 'Demo member', bucket: 'activity-photos', paths: [`${LIB}/running-480.jpg`], media: 'photo', created_at: ago(60 * 24 * 30), girl_only: false, hidden: false },
    { id: K1, kind: 'community', title: 'Demo padel club', owner_id: U2, owner_name: 'Demo reporter', bucket: 'activity-photos', paths: [`${LIB}/padel-480.jpg`], media: 'photo', created_at: ago(60 * 24 * 12), girl_only: false, hidden: false },
    { id: K2, kind: 'community', title: 'Demo brunch girls', owner_id: U1, owner_name: 'Demo member', bucket: 'activity-photos', paths: [`${LIB}/brunch-480.jpg`], media: 'photo', created_at: ago(60 * 24 * 3), girl_only: true, hidden: false },
    { id: A1, kind: 'community', title: 'Demo sunset club', owner_id: U2, owner_name: 'Demo reporter', bucket: 'activity-photos', paths: [], media: 'photo', created_at: ago(60 * 5), girl_only: false, hidden: true },
  ],
};

/** The photos of one thing in the demo, by kind: a cover, a post's photos, a member's profile photos. */
function demoPhotos(kind: unknown): unknown {
  if (kind === 'profile') {
    return [
      { slot: 'profile', bucket: 'profile-photos', path: `${LIB}/girlCoffee-480.jpg`, media: 'photo', thumb: null },
      { slot: 'profile', bucket: 'profile-photos', path: `${LIB}/girlHike-480.jpg`, media: 'photo', thumb: null },
      { slot: 'match', bucket: 'match-photos', path: `${LIB}/girlTravel-480.jpg`, media: 'photo', thumb: null },
    ];
  }
  if (kind === 'community_post' || kind === 'irl_post') return [{ slot: 'media', bucket: 'post-media', path: `${LIB}/marathon-480.jpg`, media: 'photo', thumb: null }];
  return [{ slot: 'cover', bucket: 'activity-photos', path: `${LIB}/running-1200.jpg`, media: 'photo', thumb: null }];
}

/** The demo's answer to a back office call. */
export function demoCall(fn: string, args: Record<string, unknown> = {}): unknown {
  if (fn === 'admin_item_photos') return demoPhotos(args.p_kind);
  if (fn in READS) return READS[fn];
  throw new Error('Demo: nothing is saved');
}
