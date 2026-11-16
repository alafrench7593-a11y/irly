// A price typed by hand on the activity form: what is accepted, what is refused and why.
//
//   node --experimental-strip-types --no-warnings scripts/check-price.mts
import { parsePrice, priceMax, priceText } from '../src/features/create/price.ts';

let failed = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `  ${detail}`}`);
};
const minor = (text: string, currency = 'AED') => {
  const p = parsePrice(text, currency);
  return p.ok ? p.minor : p.problem;
};

// 1. Free: empty or zero.
check('empty is free', minor('') === 0);
check('spaces only is free', minor('   ') === 0);
check('0 is free', minor('0') === 0);
check('0,00 is free', minor('0,00') === 0);

// 2. Whole amounts and two decimals, comma or point.
check('37,50 (French comma)', minor('37,50') === 3750, String(minor('37,50')));
check('37.50 (point)', minor('37.50') === 3750);
check('37.5 is 37.50', minor('37.5') === 3750);
check('37, (still typing) is 37', minor('37,') === 3700);
check(',5 is 0.50', minor(',5') === 50);
check('120', minor('120') === 12000);
check('0,07 keeps its cents', minor('0,07') === 7);
check('19.99 has no rounding error', minor('19.99') === 1999);
check('1 250 (thousands space) is 1250', minor('1 250') === 125000);
check('1 250,50 (narrow space) is 1250.50', minor('1 250,50') === 125050);

// 3. Refused, with the reason.
check('-5 is negative', minor('-5') === 'negative');
check('-0,50 is negative', minor('-0,50') === 'negative');
check('abc is not a number', minor('abc') === 'not-a-number');
check('12abc is not a number', minor('12abc') === 'not-a-number');
check('a lone comma is not a number', minor(',') === 'not-a-number');
check('1,250.50 (two separators) is not a number', minor('1,250.50') === 'not-a-number');
check('1e3 is not a number', minor('1e3') === 'not-a-number');
check('+5 is not a number', minor('+5') === 'not-a-number');
check('three decimals are refused', minor('37,505') === 'decimals');

// 4. The ceiling: the server's for AED (price_minor ≤ 100,000,000), 20 million for IDR.
check('AED 1,000,000 is the highest', minor('1000000') === 100_000_000 && priceMax('AED') === 1_000_000);
check('AED 1,000,000.01 is too high', minor('1000000,01') === 'too-high');
check('a very long number is too high', minor('9'.repeat(30)) === 'too-high');
check('IDR 250000', minor('250000', 'IDR') === 25_000_000);
check('IDR 20,000,000 is the highest', minor('20000000', 'IDR') === 2_000_000_000);
check('IDR 20,000,001 is too high', minor('20000001', 'IDR') === 'too-high');
check('IDR stays under the integer column', priceMax('IDR') * 100 <= 2_147_483_647);
check('IDR 50.000 is not read as fifty', minor('50.000', 'IDR') === 'whole-only');
check('IDR takes no cents', minor('5000,50', 'IDR') === 'whole-only');

// 5. Back into the field when editing.
check('free shows an empty field', priceText(0) === '');
check('3750 shows 37.50', priceText(3750) === '37.50');
check('12000 shows 120', priceText(12000) === '120');
check('what the field shows parses back to the same price', minor(priceText(3750)) === 3750 && minor(priceText(12000)) === 12000 && minor(priceText(7)) === 7);

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('price: all checks passed');
