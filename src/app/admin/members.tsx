import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { searchMembers, type MemberRow } from '@/features/admin/api';
import { adminStyles, Card, day, Loadable, StatePill } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

/** Users: search by name, username, id (or email, for admins: the server decides). Open one for the full sheet. */
export default function Members() {
  const q = useLocalSearchParams<{ q?: string }>();
  const [search, setSearch] = useState(q.q ?? '');
  const [rows, setRows] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    setRows(null);
    searchMembers(search.trim())
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [search]);
  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <Page title="Users" subtitle="Most reported first. Open a member for their status, reports and history.">
      <View style={adminStyles.body}>
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="First name, username, id or email" accessibilityLabel="Search members" autoCapitalize="none" />
        <Loadable data={rows} error={error} retry={load} empty="Nobody found.">
          {(list) =>
            list.map((m, i) => (
              <Card index={i} key={m.user_id} onPress={() => router.push(`/admin/user/${m.user_id}`)} accessibilityLabel={m.first_name ?? undefined}>
                <View style={adminStyles.row}>
                  <Text variant="titleS" style={{ flex: 1 }} raw>
                    {m.first_name ?? '—'}
                    {m.username ? ` · @${m.username}` : ''}
                  </Text>
                  <StatePill state={m.deleted ? 'deleted' : m.sanction === 'ban' ? 'banned' : m.sanction === 'suspension' ? 'suspended' : 'active'} />
                </View>
                <Text variant="bodyS" tone="secondary" raw>
                  {[m.email, tx('joined {d}', { d: day(m.created_at) }), tx('{n} reports', { n: m.reports }), m.role ? tx(m.role[0].toUpperCase() + m.role.slice(1)) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {m.sanction_ends ? (
                  <Text variant="caption" tone="live" raw>
                    {tx('until {d}', { d: day(m.sanction_ends) })}
                  </Text>
                ) : null}
              </Card>
            ))
          }
        </Loadable>
      </View>
    </Page>
  );
}
