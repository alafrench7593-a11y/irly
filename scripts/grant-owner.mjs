/**
 * Makes one existing IRLY account the owner of the back office.
 * - The account must already exist (sign up in the app first); nothing is
 *   created, no password is involved.
 * - Runs private.grant_owner on the server with the project's management
 *   token, which never reaches the app. The grant is written to the staff
 *   audit log ("role.owner_granted", by the server).
 * - The owner then gives admin, moderator or content roles from the app
 *   (Back office → Team); nobody can become owner from the app.
 * Run: Actions → Grant owner → Run workflow, with the account's email.
 */
const ref = process.env.SUPABASE_PROJECT_REF || 'yqutcmgslwxcmnsqmhvy';
const token = (process.env.SUPABASE_ACCESS_TOKEN || '').match(/sbp_[^\s"'`]+/)?.[0];
const email = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN missing');
// A strict shape keeps the value safe to put in SQL.
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) throw new Error('OWNER_EMAIL is not an email address');

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

const [{ uid }] = await sql(`select private.grant_owner('${email}') as uid`);
const [{ role }] = await sql(`select private.staff_role('${uid}') as role`);
if (role !== 'owner') throw new Error(`grant check failed (role: ${role})`);
console.log('✓ owner granted; the account sees "Back office" in Settings after reopening the app');
