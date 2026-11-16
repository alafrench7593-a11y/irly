/**
 * A price typed by hand on the activity form: « 37,50 », « 37.5 », « 120 ».
 * Stored in the activity's own currency as minor units (activities.price_minor:
 * 3750). Empty or 0 is free. Pure functions, no React: tested by
 * scripts/check-price.mts.
 */

/**
 * The highest amount the form takes, per currency. AED: the server's own
 * ceiling (price_minor ≤ 100,000,000, private.activity_input_guard). IDR: the
 * server only has the column's limit (about 21.4 million), so the form stops
 * at 20 million.
 */
export const PRICE_MAX: Record<string, number> = { AED: 1_000_000, IDR: 20_000_000 };
const PRICE_MAX_OTHER = 1_000_000;

/** Currencies written without cents. */
const WHOLE_ONLY = new Set(['IDR']);

export type PriceProblem = 'not-a-number' | 'negative' | 'decimals' | 'whole-only' | 'too-high';
export type ParsedPrice = { ok: true; amount: number; minor: number } | { ok: false; problem: PriceProblem };

export const priceMax = (currency: string) => PRICE_MAX[currency] ?? PRICE_MAX_OTHER;

/**
 * What was typed → the amount. A comma or a point is the decimal separator
 * (French keyboards type a comma); spaces are ignored (« 1 250 »). Anything
 * else is refused with its reason, never guessed.
 */
export function parsePrice(text: string, currency: string): ParsedPrice {
  const typed = text.replace(/[\s  ]/g, '');
  if (!typed) return { ok: true, amount: 0, minor: 0 };
  if (/^[-−–]\d*[.,]?\d*$/.test(typed) && /\d/.test(typed)) return { ok: false, problem: 'negative' };
  if (!/^(\d+[.,]?\d*|[.,]\d+)$/.test(typed)) return { ok: false, problem: 'not-a-number' };
  const [whole, cents = ''] = typed.split(/[.,]/);
  if (WHOLE_ONLY.has(currency) && cents.length > 0) return { ok: false, problem: 'whole-only' };
  if (cents.length > 2) return { ok: false, problem: 'decimals' };
  if (whole.length > 12) return { ok: false, problem: 'too-high' };
  const minor = Number(whole || '0') * 100 + Number(cents.padEnd(2, '0') || '0');
  if (minor > priceMax(currency) * 100) return { ok: false, problem: 'too-high' };
  return { ok: true, amount: minor / 100, minor };
}

/** A stored price → what the field shows when editing: « 37.50 », « 120 », empty when free. */
export function priceText(minor: number): string {
  if (!minor) return '';
  return minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2);
}
