import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FrameContext, useFrame } from '@/components/layout/frame';
import { LIST_PANE } from '@/components/layout/responsive';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * A list and its detail side by side (`split`, see useSplit), or the list
 * alone. The list keeps the same place in the tree at every width, so
 * unfolding, folding or resizing never remounts it: scroll, filters and
 * the selection stay. Each pane reports its own width through useFrame().
 * A hairline divides the two panes.
 */
export function SplitView({ split, detail, children }: { split: boolean; detail: ReactNode; children: ReactNode }) {
  const t = useTheme();
  const frame = useFrame();
  const listFrame = useMemo(() => ({ ...frame, width: split ? LIST_PANE : frame.width }), [frame, split]);
  const detailFrame = useMemo(() => ({ ...frame, width: Math.max(0, frame.width - LIST_PANE - StyleSheet.hairlineWidth) }), [frame]);
  return (
    <View style={[styles.row, { backgroundColor: t.c.bg }]}>
      <View style={split ? styles.list : styles.fill}>
        <FrameContext.Provider value={listFrame}>{children}</FrameContext.Provider>
      </View>
      {split ? (
        <>
          <View style={[styles.divider, { backgroundColor: t.c.line }]} />
          <View style={styles.fill}>
            <FrameContext.Provider value={detailFrame}>{detail}</FrameContext.Provider>
          </View>
        </>
      ) : null}
    </View>
  );
}

/** The detail pane with nothing to show yet (nothing picked, or an empty list). */
export function PaneEmpty({ icon, title, body, children }: { icon: IconName; title: string; body?: string; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.c.brandSoft }]}>
        <Icon name={icon} size={26} color={t.c.text} />
      </View>
      <Text variant="titleM" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" tone="secondary" align="center" style={styles.emptyBody}>
          {body}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  list: { width: LIST_PANE },
  fill: { flex: 1, minWidth: 0 },
  divider: { width: StyleSheet.hairlineWidth },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.gutter },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyBody: { maxWidth: 340 },
});
