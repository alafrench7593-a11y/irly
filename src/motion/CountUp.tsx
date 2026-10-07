import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { Text } from '@/components/ui/Text';
import type { TypeVariant } from '@/theme/tokens';

/**
 * A number that counts up to its value when it appears, and rolls to the
 * new value when it changes (ease-out, about 0.7 s). Static with Reduce
 * Motion. For small counters only (connections, plans, members).
 */
export function CountUp({ value, variant = 'number', duration = 700 }: { value: number; variant?: TypeVariant; duration?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) return;
    const start = Date.now();
    const a = from.current;
    let frame = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(a + (value - a) * eased);
      setShown(v);
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);
  return (
    <Text variant={variant} raw accessibilityLabel={String(value)}>
      {reduced ? value : shown}
    </Text>
  );
}
