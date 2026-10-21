import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { CATEGORY_LABEL, KIND_LABEL, loadCases, STATUS_LABEL, type CaseRow, type CaseStatus } from '@/features/admin/api';
import { adminStyles, ago, Card, Loadable, StatusPill } from '@/features/admin/ui';
import { t as tx } from '@/i18n';

const STATUSES: (CaseStatus | 'active' | null)[] = ['active', 'open', 'reviewing', 'need_info', 'actioned', 'dismissed', 'closed', null];
const KINDS = [null, 'message', 'profile', 'community_post', 'comment', 'irl_post', 'activity', 'community'];

/** Reports inbox: newest and highest priority first, filtered and searchable. */
export default function ReportsInbox() {
  const q = useLocalSearchParams<{ status?: string; priority?: string }>();
  const [status, setStatus] = useState<string | null>(q.status ?? 'active');
  const [priority, setPriority] = useState<string | null>(q.priority ?? null);
  const [kind, setKind] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<CaseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);

  const load = useCallback(
    (offset = 0) => {
      setError(null);
      if (!offset) setRows(null);
      loadCases({ status, kind, priority, search: search.trim(), offset })
        .then((r) => {
          setRows((old) => (offset ? [...(old ?? []), ...r] : r));
          setMore(r.length === 50);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
    },
    [status, kind, priority, search],
  );
  useEffect(() => {
    const id = setTimeout(() => load(0), search ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, search]);

  return (
    <Page title="Reports" subtitle="Open a report to review it. Private messages are only shown for a report about a message, with a reason, and every read is logged.">
      <View style={adminStyles.body}>
        <Field icon="search" value={search} onChangeText={setSearch} placeholder="Search a name, a reason or a case number" accessibilityLabel="Search reports" autoCapitalize="none" />
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {STATUSES.map((s) => (
            <Chip key={String(s)} size="sm" label={s === null ? 'All' : s === 'active' ? 'To handle' : STATUS_LABEL[s]} selected={status === s} onPress={() => setStatus(s)} />
          ))}
        </ScrollView>
        <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <Chip size="sm" icon="flame" label="High priority" selected={priority === 'high'} onPress={() => setPriority(priority === 'high' ? null : 'high')} />
          {KINDS.map((k) => (
            <Chip key={String(k)} size="sm" label={k ? KIND_LABEL[k] : 'Every kind'} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ScrollView>
        <Loadable data={rows} error={error} retry={() => load(0)} empty="No report here.">
          {(list) => (
            <>
              {list.map((r, i) => (
                <Card index={i} key={r.case_id} onPress={() => router.push(`/admin/case/${r.case_id}`)} accessibilityLabel={tx('Open report')}>
                  <View style={adminStyles.row}>
                    <StatusPill status={r.status} />
                    {r.priority === 'high' ? (
                      <Text variant="caption" tone="live">
                        High priority
                      </Text>
                    ) : null}
                    <Text variant="caption" tone="tertiary" raw>
                      {ago(r.created_at)}
                    </Text>
                  </View>
                  <Text variant="titleS" raw>
                    {tx(CATEGORY_LABEL[r.category] ?? r.category)} · {tx(KIND_LABEL[r.target_kind] ?? r.target_kind)}
                  </Text>
                  <Text variant="bodyS" tone="secondary" raw>
                    {tx('Reported: {name}', { name: r.target_name ?? '—' })} · {tx('By: {name}', { name: r.reporter_name ?? tx('deleted account') })}
                    {r.reports_on_target > 1 ? ` · ${tx('{n} reports on this member', { n: r.reports_on_target })}` : ''}
                  </Text>
                  {r.details ? (
                    <Text variant="bodyS" numberOfLines={2} raw>
                      “{r.details}”
                    </Text>
                  ) : null}
                </Card>
              ))}
              {more ? <Button label="Load more" variant="ghost" onPress={() => load(list.length)} /> : null}
            </>
          )}
        </Loadable>
      </View>
    </Page>
  );
}
