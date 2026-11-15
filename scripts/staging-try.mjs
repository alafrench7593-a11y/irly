/**
 * Runs one call as a fictitious member on the STAGING branch inside a transaction that is rolled back,
 * and prints how long it took or the error it raised. Through the staging guard: never production.
 * Env: SUPABASE_ACCESS_TOKEN. Usage: node scripts/staging-try.mjs
 */
import { accessToken, createStaging, memberId } from './staging-lib.mjs';

const api = createStaging({ token: accessToken() });
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const CALLS = [
  ['delete_my_account()', 'perform public.delete_my_account()'],
];
for (const [label, call] of CALLS) {
  for (const member of [3, 40, 500]) {
    const id = memberId(member);
    try {
      const rows = await api.sql(
        `begin;
create temp table _r (t text) on commit drop;
do $do$
declare t0 timestamptz := clock_timestamp(); msg text; ctx text;
begin
  perform set_config('request.jwt.claim.sub', ${lit(id)}, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', ${lit(JSON.stringify({ sub: id, role: 'authenticated', aud: 'authenticated' }))}, true);
  begin
    set local role authenticated;
    ${call};
    reset role;
    insert into _r values ('ok in ' || round(extract(epoch from clock_timestamp() - t0) * 1000) || ' ms');
  exception when others then
    get stacked diagnostics msg = message_text, ctx = pg_exception_context;
    reset role;
    insert into _r values ('ERROR ' || sqlstate || ': ' || msg || ' | ' || left(ctx, 900) || ' | after ' || round(extract(epoch from clock_timestamp() - t0) * 1000) || ' ms');
  end;
end
$do$;
select t from _r;
rollback;`,
        { readOnly: false, tries: 1 },
      );
      console.log(`${label} as member ${member}: ${rows?.[0]?.t}`);
    } catch (e) {
      console.log(`${label} as member ${member}: request failed: ${String(e.message).slice(0, 500)}`);
    }
  }
}
