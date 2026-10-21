// Sends the "important report" emails queued by the database
// (private.report_email_outbox, migration 20261027200100) to the moderation
// address set in Back office → Settings. Run by .github/workflows/report-email.yml.
//
// Each run: claim a batch (FOR UPDATE SKIP LOCKED with a lease: two runs never
// take the same email; a crashed run's emails come back after the lease), send
// each through the provider with the outbox id as idempotency key (a retry after
// a crash is not delivered twice), then mark it sent, or failed (retried later
// with a growing delay, then left "failed" for a person in Settings).
//
// The email carries the case number, what was reported, the reason, the
// priority, the date and a link to the case screen (sign-in required). Never a
// name, an email address, the report's text, a token or a key. Logs show counts
// only.
//
// Env (secrets of the workflow, never in the app):
//   SUPABASE_PURGE_KEY or SUPABASE_SERVICE_KEY  this project's secret key (sb_secret_…):
//                                              only the public.report_email_* functions accept it
//   RESEND_API_KEY                              the email provider's key (Resend, re_…)
//   REPORT_EMAIL_FROM                           a sender on a domain verified at the provider,
//                                              e.g. "IRLY Moderation <moderation@your-domain>"
//   SUPABASE_URL (default: the IRLY project), RESEND_API_URL (only to point at a local stand-in)
// Without the provider key or the sender, nothing is claimed: emails wait in the outbox.

import { pathToFileURL } from 'node:url';

const KIND = {
  profile: 'Profile',
  message: 'Private message',
  activity: 'Activity',
  event: 'Event',
  community: 'Community',
  irl_post: 'Live post',
  comment: 'Comment',
  community_post: 'Community post',
};
const REASON = {
  harassment: 'Harassment',
  threats: 'Threats',
  hate_speech: 'Hate or discrimination',
  sexual_content: 'Sexual content',
  impersonation: 'Impersonation',
  fake_profile: 'Fake profile',
  scam: 'Scam',
  spam: 'Spam',
  inappropriate: 'Inappropriate content',
  unsafe: 'Dangerous behaviour',
  other: 'Other',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Hides anything that looks like a key before it is logged or stored. */
export const scrub = (s) => String(s ?? '').replace(/(re_|sb_secret_|sbp_|Bearer\s+)[A-Za-z0-9._-]+/g, '[hidden]');

/** The email for one claimed outbox row. Only what the row says: no personal data. */
export function buildEmail(row) {
  const kind = KIND[row.target_kind] ?? row.target_kind;
  const reason = REASON[row.category] ?? row.category;
  const high = row.priority === 'high';
  const when = new Date(row.reported_at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const caseNo = String(row.case_id);
  const url = String(row.case_url);
  if (!/^https:\/\//.test(url)) throw new Error('the case link is not https');
  const subject = `[IRLY] ${high ? 'High priority report' : 'Report'}: ${reason} (${kind}) · case ${caseNo.slice(0, 8)}`;
  const lines = [
    'A report on IRLY needs the team’s attention.',
    '',
    `Case: ${caseNo}`,
    `Reported: ${kind}`,
    `Reason: ${reason}`,
    `Priority: ${high ? 'high' : 'normal'}`,
    `Filed: ${when}`,
    '',
    `Open the case (sign-in required): ${url}`,
    '',
    'This email holds no personal data: the details are in the back office.',
  ];
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p>A report on IRLY needs the team’s attention.</p>
<table style="border-collapse:collapse">${[
    ['Case', caseNo],
    ['Reported', kind],
    ['Reason', reason],
    ['Priority', high ? 'high' : 'normal'],
    ['Filed', when],
  ]
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#666">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table>
<p><a href="${esc(url)}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:999px;text-decoration:none">Open the case</a></p>
<p style="color:#666;font-size:13px">Sign-in required. This email holds no personal data: the details are in the back office.</p>
</div>`;
  return { to: [row.to_email], subject, text: lines.join('\n'), html };
}

/** One run. Returns counts; never throws for one email (it is marked failed and retried later). */
export async function run({ env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const key = (env.SUPABASE_PURGE_KEY || env.SUPABASE_SERVICE_KEY || '').trim().match(/sb_secret_[\w-]+/)?.[0];
  const provider = (env.RESEND_API_KEY || '').trim();
  const from = (env.REPORT_EMAIL_FROM || '').trim();
  const project = (env.SUPABASE_URL || 'https://yqutcmgslwxcmnsqmhvy.supabase.co').replace(/\/+$/, '');
  const api = (env.RESEND_API_URL || 'https://api.resend.com').replace(/\/+$/, '');
  const counts = { claimed: 0, sent: 0, failed: 0 };
  if (!key || !provider || !from) {
    log(`Report email not configured (${[!key && 'SUPABASE_PURGE_KEY', !provider && 'RESEND_API_KEY', !from && 'REPORT_EMAIL_FROM'].filter(Boolean).join(', ')} missing): nothing sent, emails wait in the outbox.`);
    return { ...counts, configured: false };
  }
  const rpc = async (fn, args) => {
    const res = await fetchImpl(`${project}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${fn} failed (${res.status}): ${scrub(text).slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };

  for (let round = 0; round < 10; round++) {
    const rows = (await rpc('report_email_claim', { p_limit: 20, p_lease_seconds: 600 })) ?? [];
    if (!rows.length) break;
    counts.claimed += rows.length;
    for (const row of rows) {
      try {
        const mail = buildEmail(row);
        const res = await fetchImpl(`${api}/emails`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${provider}`, 'Content-Type': 'application/json', 'Idempotency-Key': `irly-report-${row.id}` },
          body: JSON.stringify({ from, ...mail }),
          signal: AbortSignal.timeout(30_000),
        });
        const body = await res.text();
        if (!res.ok) throw new Error(`provider ${res.status}: ${scrub(body).slice(0, 160)}`);
        let id = null;
        try {
          id = JSON.parse(body)?.id ?? null;
        } catch {
          id = null;
        }
        await rpc('report_email_done', { p_id: row.id, p_provider_id: id });
        counts.sent++;
      } catch (e) {
        counts.failed++;
        await rpc('report_email_failed', { p_id: row.id, p_error: scrub(e instanceof Error ? e.message : String(e)).slice(0, 280) }).catch(() => undefined);
      }
    }
  }
  log(`Report email: ${counts.claimed} claimed, ${counts.sent} sent, ${counts.failed} failed (retried later).`);
  return { ...counts, configured: true };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run().then(
    (r) => process.exit(r.configured && r.failed && !r.sent ? 1 : 0),
    (e) => {
      console.error(scrub(e instanceof Error ? e.message : String(e)));
      process.exit(1);
    },
  );
}
