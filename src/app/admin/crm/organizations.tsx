import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { adminStyles, Card } from '@/features/admin/ui';
import { ORG_KIND_LABEL, ORG_KINDS, type OrgKind } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, Tag, useCrm } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

type Quick = 'all' | 'network' | 'archived';

/** Companies, organisers, venues, communities: each with its contacts and partnerships. */
export default function Organizations() {
  const q = useLocalSearchParams<{ filter?: string }>();
  return (
    <Page overline="CRM" title="Companies and partners" subtitle="Several contacts can belong to the same company.">
      <View style={adminStyles.body}>
        <CrmGate>
          <List quick0={q.filter === 'network' || q.filter === 'archived' ? q.filter : 'all'} />
        </CrmGate>
      </View>
    </Page>
  );
}

function List({ quick0 }: { quick0: Quick }) {
  const { data, error, reload } = useCrm();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<OrgKind | 'all'>('all');
  const [quick, setQuick] = useState<Quick>(quick0);
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const s = search.trim().toLowerCase();
        const rows = d.orgs
          .filter((o) => (quick === 'archived' ? o.archived_at : !o.archived_at))
          .filter((o) => quick !== 'network' || o.network_target)
          .filter((o) => kind === 'all' || o.kind === kind)
          .filter((o) => !s || [o.name, o.city, o.country, o.website].some((v) => (v ?? '').toLowerCase().includes(s)))
          .sort((a, b) => a.name.localeCompare(b.name));
        return (
          <>
            <Button label="Add a company or partner" icon="plus" full onPress={() => router.push('/admin/crm/organization')} />
            <Field icon="search" value={search} onChangeText={setSearch} placeholder="Name, city, website" accessibilityLabel="Search companies" autoCapitalize="none" />
            <Filter
              options={[
                { value: 'network' as const, label: 'Targets for IRLY Network' },
                { value: 'archived' as const, label: 'Archived' },
              ]}
              value={quick}
              onChange={setQuick}
            />
            <Filter options={ORG_KINDS} value={kind} onChange={setKind} />
            {rows.length ? (
              rows.map((o, i) => {
                const people = d.contacts.filter((c) => c.organization_id === o.id && !c.archived_at).length;
                const parts = d.partnerships.filter((p) => p.organization_id === o.id && !p.archived_at).length;
                return (
                  <Card key={o.id} index={i} onPress={() => router.push(`/admin/crm/organization?id=${o.id}`)} accessibilityLabel={o.name}>
                    <View style={crmStyles.row}>
                      <Text variant="titleS" style={{ flex: 1 }} raw>
                        {o.name}
                      </Text>
                      {o.network_target ? <Tag label="IRLY Network" tone="accent" /> : null}
                    </View>
                    <Text variant="bodyS" tone="secondary" raw>
                      {[tx(ORG_KIND_LABEL[o.kind]), o.city, people === 1 ? tx('1 contact') : tx('{n} contacts', { n: people }), parts === 1 ? tx('1 partnership') : tx('{n} partnerships', { n: parts })]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Card>
                );
              })
            ) : (
              <Text variant="body" tone="secondary">
                {d.orgs.length ? 'Nothing matches these filters.' : 'No company or partner yet.'}
              </Text>
            )}
          </>
        );
      }}
    </CrmLoad>
  );
}
