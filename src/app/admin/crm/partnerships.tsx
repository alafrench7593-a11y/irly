import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { adminStyles, Card } from '@/features/admin/ui';
import { PARTNERSHIP_KIND_LABEL, PARTNERSHIP_KINDS, PARTNERSHIP_STATUS_LABEL, PARTNERSHIP_STATUSES, today, type PartnershipKind, type PartnershipStatus } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, money, shortDate, Tag, useCrm } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** Partnerships with organisers, venues, companies, communities, influencers and launch partners. */
export default function Partnerships() {
  const q = useLocalSearchParams<{ status?: string }>();
  return (
    <Page overline="CRM" title="Partnerships" subtitle="Goal, status, dates, budget, deliverables and results.">
      <View style={adminStyles.body}>
        <CrmGate>
          <List status0={PARTNERSHIP_STATUSES.some((s) => s.value === q.status) ? (q.status as PartnershipStatus) : 'all'} />
        </CrmGate>
      </View>
    </Page>
  );
}

function List({ status0 }: { status0: PartnershipStatus | 'all' }) {
  const { data, error, reload } = useCrm();
  const [status, setStatus] = useState<PartnershipStatus | 'all'>(status0);
  const [kind, setKind] = useState<PartnershipKind | 'all'>('all');
  const [archived, setArchived] = useState(false);
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const day = today();
        const rows = d.partnerships
          .filter((p) => (archived ? p.archived_at : !p.archived_at))
          .filter((p) => status === 'all' || p.status === status)
          .filter((p) => kind === 'all' || p.kind === kind)
          .sort((a, b) => (a.next_due ?? '9999').localeCompare(b.next_due ?? '9999'));
        return (
          <>
            <Button label="New partnership" icon="plus" full onPress={() => router.push('/admin/crm/partnership')} />
            <Text variant="label">Status</Text>
            <Filter options={PARTNERSHIP_STATUSES} value={status} onChange={setStatus} />
            <Text variant="label">Type</Text>
            <Filter options={PARTNERSHIP_KINDS} value={kind} onChange={setKind} />
            <Button size="sm" variant="ghost" label={archived ? 'Show current partnerships' : 'Show archived'} onPress={() => setArchived(!archived)} />
            {rows.length ? (
              rows.map((p, i) => {
                const org = d.orgs.find((o) => o.id === p.organization_id)?.name;
                return (
                  <Card key={p.id} index={i} onPress={() => router.push(`/admin/crm/partnership?id=${p.id}`)} accessibilityLabel={p.title}>
                    <View style={crmStyles.row}>
                      <Text variant="titleS" style={{ flex: 1 }} raw>
                        {p.title}
                      </Text>
                      <Tag label={PARTNERSHIP_STATUS_LABEL[p.status]} tone={p.status === 'active' ? 'positive' : p.status === 'cancelled' ? 'tertiary' : 'secondary'} />
                    </View>
                    <Text variant="bodyS" tone="secondary" raw>
                      {[tx(PARTNERSHIP_KIND_LABEL[p.kind]), org, p.budget !== null ? money(p.budget, p.currency) : null, p.contact_ids.length === 1 ? tx('1 contact') : p.contact_ids.length ? tx('{n} contacts', { n: p.contact_ids.length }) : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {p.next_due ? (
                      <Text variant="caption" tone={p.next_due < day ? 'live' : 'tertiary'} raw>
                        {tx('Next deadline {d}', { d: shortDate(p.next_due) })}
                      </Text>
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <Text variant="body" tone="secondary">
                {d.partnerships.length ? 'Nothing matches these filters.' : 'No partnership yet.'}
              </Text>
            )}
          </>
        );
      }}
    </CrmLoad>
  );
}
