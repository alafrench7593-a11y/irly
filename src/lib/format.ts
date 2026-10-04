import type { City } from '@/data/types';

export function formatPrice(amount: number, currency: City['currency']): string {
  if (amount === 0) return 'Free';
  if (currency === 'IDR') {
    if (amount >= 1_000_000) {
      const m = amount / 1_000_000;
      return `IDR ${Number.isInteger(m) ? m : m.toFixed(1)}M`;
    }
    return `IDR ${Math.round(amount / 1000)}K`;
  }
  return `AED ${amount.toLocaleString('en-US')}`;
}

export function formatCount(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
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
