import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { loadCommunities, type CommunityRow } from '@/features/admin/api';
import { adminStyles, Card, Loadable, StatePill, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

const FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: 'reported', label: 'Reported' },
  { value: 'hidden', label: 'Suspended by the team' },
  { value: 'removed', label: 'Removed' },
  { value: 'official', label: 'Official' },
];

/** Communities: search, then open one to edit, change its photo, suspend, restore or delete it. */
export default function AdminCommunities() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<string | null>(FILTERS.some((f) => f.value === params.filter) ? (params.filter ?? null) : null);
  useEffect(() => {
    const id = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  const { data, error, reload } = useLoad<CommunityRow[]>(() => loadCommunities(q, filter), `${q}|${filter}`);

  return (
    <Page title="Communities" subtitle="Biggest first. IRLY Girl communities are included for moderation.">
      <View style={adminStyles.body}>
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="Name, tagline or id" accessibilityLabel="Search communities" autoCapitalize="none" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {FILTERS.map((f) => (
            <Chip key={String(f.value)} size="sm" label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
        <Loadable data={data} error={error} retry={reload} empty="No community here.">
          {(list) =>
            list.map((c, i) => (
              <Card index={i} key={c.id} onPress={() => router.push(`/admin/community/${c.id}`)} accessibilityLabel={c.name}>
                <View style={adminStyles.row}>
                  <Text variant="titleS" style={{ flex: 1 }} raw>
                    {c.name}
                  </Text>
                  <StatePill state={c.hidden ? 'hidden' : c.removed ? 'removed' : 'visible'} />
                </View>
                <Text variant="bodyS" tone="secondary" raw>
                  {[
                    c.city_id,
                    tx('{n} members', { n: c.members_count }),
                    c.creator_name ? tx('by {name}', { name: c.creator_name }) : null,
                    c.girl_only ? 'IRLY Girl' : null,
                    c.official ? tx('Official') : null,
                    c.parent_id ? tx('Group') : null,
                    c.reports ? (c.reports === 1 ? tx('1 report') : tx('{n} reports', { n: c.reports })) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Card>
            ))
          }
        </Loadable>
      </View>
    </Page>
  );
}
