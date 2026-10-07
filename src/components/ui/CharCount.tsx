import { t as tx } from '@/i18n';
import { Text } from './Text';

/**
 * Under a text field: how many characters are left, and why the field is
 * not accepted yet ("3 more characters (minimum 10)", "Maximum 160 reached").
 */
export function CharCount({ length, min = 0, max, color, warn }: { length: number; min?: number; max: number; color?: string; warn?: string }) {
  const short = min > 0 && length < min;
  const full = length >= max;
  const text = short
    ? length === 0
      ? tx('Minimum {min} characters', { min })
      : tx('{n} more characters (minimum {min})', { n: min - length, min })
    : full
      ? tx('Maximum {max} characters reached', { max })
      : `${length}/${max}`;
  return (
    <Text variant="caption" color={(short && length > 0) || full ? warn : color} tone={(short && length > 0) || full ? (warn ? undefined : 'critical') : color ? undefined : 'tertiary'} align="right" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}
