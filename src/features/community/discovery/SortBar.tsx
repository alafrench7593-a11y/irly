import { StyleSheet, View } from 'react-native';
import { Rail } from '@/components/cards/Blocks';
import { gridStyles } from '@/components/layout/grid';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';
import { type DirectorySort, useDirectorySort } from './directory';

/**
 * How « Discover » is ordered: most members (the default), most active,
 * newest, most upcoming activities. The choice holds for the session.
 */
export function SortBar({ wide }: { wide: boolean }) {
  const sort = useDirectorySort((s) => s.sort);
  const setSort = useDirectorySort((s) => s.setSort);
  const pick = (value: DirectorySort) => ({ selected: sort === value, onPress: () => setSort(value) });
  const chips = (
    <>
      <Chip size="sm" icon="users" label="Most members" {...pick('members')} />
      <Chip size="sm" icon="zap" label="Most active" {...pick('active')} />
      <Chip size="sm" icon="sparkles" label="Newest" {...pick('recent')} />
      <Chip size="sm" icon="calendar" label="Most activities" {...pick('activities')} />
    </>
  );
  return (
    <View style={wide ? styles.wide : styles.phone} accessibilityRole="radiogroup">
      <Text variant="overline" tone="tertiary" style={wide ? null : styles.label}>
        Sort by
      </Text>
      {wide ? <View style={[gridStyles.row, { gap: 8 }]}>{chips}</View> : <Rail gap={8}>{chips}</Rail>}
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { gap: space[2] },
  phone: { gap: space[2], marginBottom: space[3] },
  label: { paddingHorizontal: space.gutter },
});
