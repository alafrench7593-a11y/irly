import type { City } from '@/data/types';
import { formatNumber, t as tx } from '@/i18n';

export function formatPrice(amount: number, currency: City['currency']): string {
  if (amount === 0) return tx('Free');
  if (currency === 'IDR') {
    if (amount >= 1_000_000) {
      const m = amount / 1_000_000;
      return `IDR ${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    return `IDR ${Math.round(amount / 1000)}K`;
  }
  return `AED ${formatNumber(amount)}`;
}

/**
 * An amount of money: whole amounts as they are (« 120 »), the others always
 * with their two decimals (« 37.50 », « 37,50 » in French), never « 37.5 ».
 */
export const formatAmount = (amount: number): string => formatNumber(amount, Number.isInteger(amount) ? undefined : 2);

/** A count shown short: 860, 1.2k (« 1,2k » in French), 12k. */
export function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${formatNumber(Math.round(n / 100) / 10)}k`;
  return `${n}`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function priceLevel(level: number): string {
  return '$'.repeat(level);
}

/** A stable avatar hue for a name or id (server members have no preset hue). */
export function hueOf(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
  return h;
}
