import { memo } from 'react';
import { StyleSheet } from 'react-native';
import type { GlassLevel } from '@/theme/tokens';
import { Glass } from './Glass';

/**
 * Glass as the background of an existing surface: drop it as the first
 * child of a row, card or panel (with overflow hidden and no background
 * colour of its own) and that surface becomes a pane of the shared glass,
 * edge and sheen following its corner radius.
 */
export const GlassLayer = memo(function GlassLayer({ radius, level = 'regular' }: { radius?: number; level?: GlassLevel }) {
  return <Glass level={level} style={[StyleSheet.absoluteFill, radius != null ? { borderRadius: radius } : null]} />;
});
