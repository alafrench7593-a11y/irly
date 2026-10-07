import { View } from 'react-native';
import { CITIES } from '@/data/destinations';
import type { CityId } from '@/data/types';
import { useCityFilter } from '@/features/server/scope';
import { useT } from '@/i18n';
import { useStore } from '@/state/store';
import { space } from '@/theme/tokens';
import { Segmented } from './Controls';

/** « All Emirates | Dubai »: one switch for every list (sessions, communities, IRL). */
export function ScopeToggle({ cityId, inset = true }: { cityId: CityId; inset?: boolean }) {
  const tr = useT();
  const { multi, narrow } = useCityFilter(cityId);
  const setOnly = useStore((s) => s.setEmirateOnly);
  if (!multi) return null;
  return (
    <View style={{ paddingHorizontal: inset ? space.gutter : 0, marginBottom: space[3] }}>
      <Segmented
        options={[
          { value: 'all', label: tr('All Emirates') },
          { value: 'mine', label: CITIES[cityId].name },
        ]}
        value={narrow ? 'mine' : 'all'}
        onChange={(v) => setOnly(v === 'mine')}
      />
    </View>
  );
}
