// Checks scripts/report-email.mjs against stand-ins of the Supabase REST API
// and of the email provider (nothing leaves this machine): nothing is claimed
// without configuration, each claimed email is sent once with its outbox id as
// idempotency key, a provider failure is marked failed (retried later), the
// email carries the case link and no personal data, and no key reaches the logs.
//   npm run test:report-email
import { buildEmail, run } from './report-email.mjs';

const KEY = 'sb_secret_TESTONLY0123456789abcdefghij';
const PROVIDER = 're_TESTONLY0123456789';

let failed = 0;
const check = (ok, label) => {
  if (ok) console.log(`✓ ${label}`);
  else {
    failed++;
    console.log(`✗ ${label}`);
  }
};

const rows = [
  { id: '11111111-1111-1111-1111-111111111111', case_id: 'aaaaaaaa-0000-0000-0000-000000000001', target_kind: 'message', category: 'threats', priority: 'high', reported_at: '2026-10-21T08:00:00Z', to_email: 'mod@example.org', case_url: 'https://getirly.com/app/admin/case/aaaaaaaa-0000-0000-0000-000000000001', attempt: 1 },
  { id: '22222222-2222-2222-2222-222222222222', case_id: 'aaaaaaaa-0000-0000-0000-000000000002', target_kind: 'community_post', category: 'sexual_content', priority: 'normal', reported_at: '2026-10-21T09:00:00Z', to_email: 'mod@example.org', case_url: 'https://getirly.com/app/admin/case/aaaaaaaa-0000-0000-0000-000000000002', attempt: 1 },
];

/** A fake project and provider: the queue hands out each row once; the provider fails the second email. */
function fake() {
  const hits = { claim: 0, done: [], failed: [], sent: [] };
  let queue = [...rows];
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    const auth = init?.headers?.Authorization ?? '';
    const json = (code, v) => new Response(v === undefined ? '' : JSON.stringify(v), { status: code });
    if (url.includes('/rest/v1/rpc/')) {
      if (auth !== `Bearer ${KEY}` || init.headers.apikey !== KEY) return json(401, { message: 'bad key' });
      if (url.endsWith('report_email_claim')) {
        hits.claim++;
        const out = queue;
        queue = [];
        return json(200, out);
      }
      if (url.endsWith('report_email_done')) {
        hits.done.push(body);
        return json(200, true);
      }
      if (url.endsWith('report_email_failed')) {
        hits.failed.push(body);
        return json(200, 'pending');
      }
    }
    if (url.endsWith('/emails')) {
      if (auth !== `Bearer ${PROVIDER}`) return json(401, { message: 'bad provider key' });
      hits.sent.push({ key: init.headers['Idempotency-Key'], body });
      if (body.subject.includes('Sexual')) return json(500, { message: `server exploded for ${PROVIDER}` });
      return json(200, { id: 'msg_123' });
    }
    return json(404, {});
  };
  return { hits, fetchImpl };
}

const logs = [];
const log = (s) => logs.push(String(s));

// 1. Not configured: nothing claimed, nothing sent.
{
  const f = fake();
  const r = await run({ env: { SUPABASE_PURGE_KEY: KEY }, fetchImpl: f.fetchImpl, log });
  check(!r.configured && f.hits.claim === 0 && f.hits.sent.length === 0, 'without a provider key or sender, nothing is claimed (emails wait)');
}

// 2. Configured: one sent, one failed, once each.
{
  const f = fake();
  const env = { SUPABASE_PURGE_KEY: KEY, RESEND_API_KEY: PROVIDER, REPORT_EMAIL_FROM: 'IRLY Moderation <mod@example.org>', SUPABASE_URL: 'https://example.supabase.co' };
  const r = await run({ env, fetchImpl: f.fetchImpl, log });
  check(r.claimed === 2 && r.sent === 1 && r.failed === 1, 'two claimed: one sent, one failed');
  check(f.hits.sent.length === 2 && f.hits.sent.every((s, i) => s.key === `irly-report-${rows[i].id}`), 'each email carries its outbox id as idempotency key');
  check(f.hits.done.length === 1 && f.hits.done[0].p_id === rows[0].id && f.hits.done[0].p_provider_id === 'msg_123', 'the sent email is marked sent with the provider id');
  check(f.hits.failed.length === 1 && f.hits.failed[0].p_id === rows[1].id, 'the failed email is marked failed (retried later)');
  check(!f.hits.failed[0].p_error.includes(PROVIDER), 'the stored error never carries the provider key');
  check(f.hits.sent[0].body.from === env.REPORT_EMAIL_FROM && f.hits.sent[0].body.to[0] === 'mod@example.org', 'sent from the configured sender to the configured address');
  check(f.hits.claim === 2, 'the run stops when the queue is empty');
}

// 3. The email itself.
{
  const m = buildEmail(rows[0]);
  check(m.text.includes(rows[0].case_url) && m.html.includes(rows[0].case_url), 'the email links to the case screen');
  check(m.subject.includes('High priority') && m.text.includes('Threats') && m.text.includes('Private message'), 'kind, reason and priority are in the email');
  check(!/sb_secret_|re_TEST|Bearer/.test(m.text + m.html + m.subject), 'no key or token in the email');
  let threw = false;
  try {
    buildEmail({ ...rows[0], case_url: 'http://insecure.example/x' });
  } catch {
    threw = true;
  }
  check(threw, 'a non-https case link is refused');
  check(buildEmail({ ...rows[0], case_url: 'https://getirly.com/app/admin/case/"><script>' }).html.includes('&quot;&gt;&lt;script&gt;'), 'the link is escaped in the HTML');
}

check(!logs.join('\n').match(/sb_secret_|re_TEST/), 'no key in the logs');

if (failed) {
  console.log(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll report email checks passed');
