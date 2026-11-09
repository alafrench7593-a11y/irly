// The scrubbing of crash reports (src/lib/crashScrub.ts): nothing personal leaves the phone.
import { scrubDetail, scrubRoute } from '../src/lib/crashScrub.ts';

let failed = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'ok ' : 'FAIL'} ${what}`);
  if (!ok) failed += 1;
};

check(scrubRoute('/person/3f2b1c4d-1111-2222-3333-444455556666') === '/person/:id', 'a uuid in the screen becomes :id');
check(scrubRoute('/a/ga-shopping') === '/a/ga-shopping', 'a named page stays');
check(scrubRoute('/messages/42') === '/messages/:id', 'a numeric id becomes :id');
check(scrubDetail("Cannot read property 'id' of undefined") === "Cannot read property 'id' of undefined", 'a property name stays');
check(scrubDetail('Invalid value "Marie Dupont"') === 'Invalid value <text>', 'double-quoted text goes');
check(scrubDetail("Bad input 'hello my name is Sara'") === 'Bad input <text>', 'a quoted sentence goes');
check(!scrubDetail('Failed for sara@example.com').includes('sara'), 'an email goes');
check(!scrubDetail('fetch https://x.supabase.co/rest/v1/profiles?id=eq.123 failed').includes('supabase'), 'a link goes');
check(!scrubDetail('row 3f2b1c4d-1111-2222-3333-444455556666 missing').includes('3f2b'), 'a uuid goes');
check(!/\d{2,}/.test(scrubDetail('phone +971501234567 invalid')), 'a phone number goes');
check(scrubDetail('line one\nline two with secrets') === 'line one', 'only the first line');
check(scrubDetail('x'.repeat(200)).length === 80, 'at most 80 characters');
check(scrubDetail(undefined) === '' && scrubDetail(42) === '', 'not a string: nothing');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
