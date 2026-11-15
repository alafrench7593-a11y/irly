/**
 * Applies the SQL proposals of docs/perf/sql to the STAGING branch, and only to it (staging guard), so
 * that the load test can be run again with them. Production is not touched: there they stay proposals.
 * The indexes are built one statement at a time; the functions and policies in one transaction each.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging-apply.mjs
 */
import { readFileSync } from 'node:fs';
import { accessToken, createStaging } from './staging-lib.mjs';

const api = createStaging({ token: accessToken() });
const read = (f) => readFileSync(new URL(`../docs/perf/sql/${f}`, import.meta.url), 'utf8');

const indexes = read('01-indexes.sql').split('\n').filter((l) => /^create index/i.test(l));
let built = 0;
for (const statement of indexes) {
  await api.sql(statement.replace(/ concurrently/i, ''));
  built += 1;
}
console.log(`indexes: ${built} statements`);
for (const file of ['02-helper-plans.sql', '03-policies.sql', '04-own-rows-first.sql']) {
  await api.sql(`begin;\nset local lock_timeout = '5s';\n${read(file)}\ncommit;`);
  console.log(`${file}: applied`);
}
await api.sql('analyze');
const [shape] = await api.sql(
  `select (select count(*) from pg_indexes where schemaname in ('public', 'private'))::int as indexes,
     (select count(*) from pg_policies where schemaname in ('public', 'private', 'storage'))::int as policies,
     (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname in ('public', 'private'))::int as functions`,
  { readOnly: true },
);
console.log(`staging now: ${JSON.stringify(shape)}`);
