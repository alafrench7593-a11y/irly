// Same as scripts/grant-owner.mjs, but picks the account by its id, so its
// email never appears anywhere (owner-approved on 2026-10-23 for the
// recreated "Irly Admin" account after the launch clean-up).
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const id = (process.env.OWNER_ID || '').trim().toLowerCase();
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing');
// A strict shape keeps the value safe to put in SQL.
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) throw new Error('OWNER_ID is not an account id');

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SQL ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : [];
}

const [{ uid }] = await sql(`select private.grant_owner(u.email) as uid from auth.users u where u.id = '${id}'`);
if (uid !== id) throw new Error('grant went to another account');
const [{ role }] = await sql(`select private.staff_role('${uid}') as role`);
if (role !== 'owner') throw new Error(`grant check failed (role: ${role})`);
console.log('✓ owner granted; the account sees "Back office" in Settings after reopening the app');
