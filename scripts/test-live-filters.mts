// The Realtime filters the app listens with (src/features/server/live-filters.ts):
// every id is named exactly once, within what Realtime accepts, and a listener
// that cannot name its rows falls back to listening without a filter.
//
//   node --experimental-strip-types --no-warnings scripts/test-live-filters.mts
import { allKnown, IN_FILTER_MAX, inFilters } from '../src/features/server/live-filters.ts';

let failed = 0;
const expect = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failed += 1;
};
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ids = (n: number) => Array.from({ length: n }, (_, i) => id(i));
/** The ids a filter names, read back the way the server does. */
const named = (filter: string) => {
  const m = /^([a-z_]+)=in\.\((.*)\)$/.exec(filter);
  return m ? m[2].split(',') : [];
};

expect(JSON.stringify(inFilters('conversation_id', [])) === '[]', 'no id: no filter (nothing to listen to)');
expect(JSON.stringify(inFilters('conversation_id', [id(1)])) === JSON.stringify([`conversation_id=in.(${id(1)})`]), 'one id: one filter on the column');

const two = inFilters('id', [id(2), id(1), id(2)]);
expect(JSON.stringify(two) === JSON.stringify([`id=in.(${id(1)},${id(2)})`]), 'repeated ids are named once, in a stable order');
expect(JSON.stringify(inFilters('id', [id(1), id(2)])) === JSON.stringify(inFilters('id', [id(2), id(1)])), 'the same ids in another order give the same filters (no needless resubscription)');

const exact = inFilters('conversation_id', ids(IN_FILTER_MAX));
expect(exact?.length === 1 && named(exact[0]).length === IN_FILTER_MAX, `${IN_FILTER_MAX} ids fit one filter`);

const many = inFilters('conversation_id', ids(250));
const all = (many ?? []).flatMap(named);
expect(many?.length === 3, '250 ids: three filters');
expect((many ?? []).every((f) => named(f).length <= IN_FILTER_MAX), 'no filter names more ids than Realtime accepts');
expect(all.length === 250 && new Set(all).size === 250 && ids(250).every((x) => all.includes(x)), 'every id is named exactly once');

expect(inFilters('conversation_id', ids(300))?.length === 3, '300 ids still fit three filters');
expect(inFilters('conversation_id', ids(301)) === null, 'more ids than three filters can name: no filter (listen to everything, as before)');
expect(inFilters('activity_id', ids(101), 1) === null, 'the caller chooses how many filters it allows');
expect(inFilters('activity_id', ids(100), 1)?.length === 1, '… and what fits is filtered');

for (const bad of ['a,b', 'a)b', 'a b', '', 'x=eq.1', '(a']) expect(inFilters('id', [id(1), bad]) === null, `an id that cannot be written in a filter (${JSON.stringify(bad)}): no filter, never a broken one`);
expect(inFilters('id', ['echo-beach', 'a.b:c_d-1'])?.length === 1, 'slugs are fine');

expect(allKnown(new Set([id(1), id(2)]), [id(2)]), 'a chat already named needs nothing new');
expect(!allKnown(new Set([id(1)]), [id(1), id(3)]), 'a chat not named yet is noticed (the member was just added to it)');
expect(allKnown(null, [id(9)]), 'listening to everything names every chat');
expect(allKnown(new Set(), []), 'no chat: nothing to name');

if (failed) {
  console.error(`\n${failed} live-filter check(s) failed`);
  process.exit(1);
}
console.log('\nlive filters ok');
