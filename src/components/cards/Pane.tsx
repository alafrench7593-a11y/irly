import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Glass } from '@/components/ui/Glass';
import type { GlassLevel } from '@/theme/tokens';

/**
 * The glass ground of a card, row or tile: placed as the first child of a
 * view (or pressable) whose own background is transparent, it fills it with
 * the shared glass (blur, tint, lit edge, sheen) at the card's own radius.
 * One line turns a flat surface into a pane of the design system, in Mixte
 * and in IRLY Girl alike (the glass reads the flavor).
 */
export const Pane = memo(function Pane({ radius, level = 'regular', dark }: { radius: number; level?: GlassLevel; dark?: boolean }) {
  return <Glass level={level} dark={dark} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} />;
});

/** Style for the host of a <Pane>: clips the glass to the card and drops the old flat fill and border. */
export const paneHost = { backgroundColor: 'transparent', borderColor: 'transparent', overflow: 'hidden' } as const;
