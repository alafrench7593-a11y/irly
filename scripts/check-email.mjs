// Read-only check of the sign-in emails before the App Store submission:
// the SMTP sender Supabase uses (never its password), the email texts, the
// sign-in providers, the getirly.com DNS records mail providers look at
// (SPF, DKIM, DMARC) and the last 24 hours of email errors in the auth logs,
// with email addresses hidden. Changes nothing.
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is missing');
const api = (path) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => {
    const text = await r.text();
    if (!r.ok) throw new Error(`${path} ${r.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  });
const hide = (s) => String(s ?? '').replace(/[\w.+-]+@([\w-]+\.)+\w+/g, (m) => `***@${m.split('@')[1]}`);

const c = await api('/config/auth');
console.log('--- sender ---');
console.log({
  smtp_host: c.smtp_host || '(none)',
  smtp_port: c.smtp_port || '(none)',
  smtp_user: c.smtp_user || '(none)',
  smtp_password: c.smtp_pass ? 'set' : 'not returned by the API',
  sender_address: c.smtp_admin_email || '(none)',
  sender_name: c.smtp_sender_name || '(none)',
  emails_per_hour: c.rate_limit_email_sent,
  min_seconds_between_emails: c.smtp_max_frequency,
});
console.log('--- sign-up and links ---');
console.log({
  email_sign_up: c.external_email_enabled,
  accounts_confirmed_right_away: c.mailer_autoconfirm,
  site_url: c.site_url,
  getirly_redirects_allowed: String(c.uri_allow_list || '').includes('getirly.com'),
  google: c.external_google_enabled,
  apple: c.external_apple_enabled,
  code_length: c.mailer_otp_length,
  code_valid_seconds: c.mailer_otp_exp,
});
console.log('--- email texts (subject; IRLY text or Supabase default) ---');
for (const k of ['confirmation', 'recovery', 'magic_link', 'email_change', 'invite', 'reauthentication']) {
  const body = c[`mailer_templates_${k}_content`];
  console.log(`${k}: "${c[`mailer_subjects_${k}`] ?? '(default)'}"; ${body ? (/IRLY/.test(body) ? 'IRLY text' : 'custom text') : 'Supabase default'}`);
}

console.log('\n--- DNS of the sender domain ---');
const domain = 'getirly.com';
console.log(`sender domain: ${String(c.smtp_admin_email || '').split('@')[1] || '(none)'}; records below are for ${domain}`);
const dns = async (name, type) => {
  const r = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`).then((x) => x.json()).catch(() => ({}));
  return (r.Answer ?? []).map((a) => a.data);
};
const spfHost = `send.${domain}`;
for (const [label, name, type] of [
  ['NS (who hosts the DNS)', domain, 'NS'],
  ['MX (root)', domain, 'MX'],
  ['TXT (root, SPF)', domain, 'TXT'],
  ['MX (send.)', spfHost, 'MX'],
  ['SPF (send.)', spfHost, 'TXT'],
  ['DKIM (resend._domainkey)', `resend._domainkey.${domain}`, 'TXT'],
  ['DMARC', `_dmarc.${domain}`, 'TXT'],
]) {
  const v = await dns(name, type);
  console.log(`${label}: ${v.length ? v.map((x) => x.slice(0, 90)).join(' | ') : 'MISSING'}`);
}

console.log('\n--- auth log, last 24 hours: email events and errors ---');
const end = new Date();
const start = new Date(end.getTime() - 24 * 3600 * 1000);
const sql = `select timestamp, event_message from auth_logs
  where regexp_contains(lower(event_message), 'mail|smtp|recover|otp|magiclink|error')
  order by timestamp desc limit 40`;
const logs = await api(
  `/analytics/endpoints/logs?sql=${encodeURIComponent(sql)}&iso_timestamp_start=${start.toISOString()}&iso_timestamp_end=${end.toISOString()}`,
).catch((e) => ({ error: e.message }));
if (logs.error) console.log('logs unavailable:', hide(logs.error));
const rows = logs.result ?? [];
console.log(`${rows.length} matching events`);
for (const r of rows) {
  let m = r.event_message;
  try {
    const j = JSON.parse(m);
    m = [j.level, j.msg, j.error, j.path, j.status].filter(Boolean).join(' · ');
  } catch {}
  console.log(new Date(Number(r.timestamp) / 1000).toISOString(), hide(m).slice(0, 220));
}
