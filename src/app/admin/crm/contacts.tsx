import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { adminStyles, Card } from '@/features/admin/ui';
import { CATEGORIES, CATEGORY_LABEL, contactName, matchesSearch, STAGE_LABEL, STAGES, today, type Category, type Contact, type Stage } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, shortDate, Tag, useCrm, useTeam } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

type Quick = 'all' | 'follow_up' | 'late' | 'no_owner' | 'archived';
const QUICK: { value: Exclude<Quick, 'all'>; label: string }[] = [
  { value: 'follow_up', label: 'To follow up' },
  { value: 'late', label: 'Follow-up overdue' },
  { value: 'no_owner', label: 'Nobody in charge' },
  { value: 'archived', label: 'Archived' },
];

const TITLES: Partial<Record<Category, string>> = { influencer: 'Influencers', event_organizer: 'Event organisers' };

/** Contacts and prospects: search, filters by type, stage, person in charge and quick filters. */
export default function Contacts() {
  const q = useLocalSearchParams<{ category?: string; filter?: string }>();
  const preset = CATEGORIES.some((c) => c.value === q.category) ? (q.category as Category) : null;
  return (
    <Page overline="CRM" title={preset ? (TITLES[preset] ?? CATEGORY_LABEL[preset]) : 'Contacts and prospects'} subtitle="Search, filter, open a contact to edit it.">
      <View style={adminStyles.body}>
        <CrmGate>
          <List preset={preset} quick={QUICK.some((x) => x.value === q.filter) ? (q.filter as Quick) : 'all'} />
        </CrmGate>
      </View>
    </Page>
  );
}

function List({ preset, quick: quick0 }: { preset: Category | null; quick: Quick }) {
  const { data, error, reload } = useCrm();
  const team = useTeam();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>(preset ?? 'all');
  const [stage, setStage] = useState<Stage | 'all'>('all');
  const [owner, setOwner] = useState<string>('all');
  const [quick, setQuick] = useState<Quick>(quick0);

  const rows = useMemo(() => {
    if (!data) return null;
    const day = today();
    const org = (id: string | null) => data.orgs.find((o) => o.id === id)?.name;
    return data.contacts
      .filter((c) => (quick === 'archived' ? c.archived_at : !c.archived_at))
      .filter((c) => category === 'all' || c.category === category)
      .filter((c) => stage === 'all' || c.stage === stage)
      .filter((c) => owner === 'all' || (owner === 'none' ? !c.owner_id : c.owner_id === owner))
      .filter((c) => (quick === 'follow_up' ? c.stage === 'follow_up' || (c.next_follow_up !== null && c.next_follow_up <= day && c.stage !== 'lost') : true))
      .filter((c) => (quick === 'late' ? c.next_follow_up !== null && c.next_follow_up < day && c.stage !== 'lost' : true))
      .filter((c) => (quick === 'no_owner' ? !c.owner_id : true))
      .filter((c) => matchesSearch(c, search, org(c.organization_id)))
      .sort((a, b) => (a.next_follow_up ?? '9999').localeCompare(b.next_follow_up ?? '9999') || b.updated_at.localeCompare(a.updated_at));
  }, [data, category, stage, owner, quick, search]);

  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => (
        <>
          <Button label="Add a contact" icon="plus" full onPress={() => router.push(`/admin/crm/contact${category !== 'all' ? `?category=${category}` : ''}`)} />
          <Field icon="search" value={search} onChangeText={setSearch} placeholder="Name, company, email, city, tag" accessibilityLabel="Search contacts" autoCapitalize="none" />
          <Text variant="label">Quick filters</Text>
          <Filter options={QUICK} value={quick} onChange={setQuick} />
          {preset ? null : (
            <>
              <Text variant="label">Type of contact</Text>
              <Filter options={CATEGORIES} value={category} onChange={setCategory} />
            </>
          )}
          <Text variant="label">Stage</Text>
          <Filter options={STAGES} value={stage} onChange={setStage} />
          {team.length ? (
            <>
              <Text variant="label">Person in charge</Text>
              <View style={crmStyles.wrap}>
                <Chip size="sm" label="All" selected={owner === 'all'} onPress={() => setOwner('all')} />
                <Chip size="sm" label="Nobody" selected={owner === 'none'} onPress={() => setOwner('none')} />
                {team.map((m) => (
                  <Chip key={m.user_id} size="sm" raw label={m.first_name ?? '—'} selected={owner === m.user_id} onPress={() => setOwner(m.user_id)} />
                ))}
              </View>
            </>
          ) : null}
          <Text variant="caption" tone="tertiary" raw>
            {rows?.length === 1 ? tx('1 contact') : tx('{n} contacts', { n: rows?.length ?? 0 })}
          </Text>
          {rows && rows.length ? (
            rows.slice(0, 300).map((c, i) => <Row key={c.id} c={c} index={i} org={d.orgs.find((o) => o.id === c.organization_id)?.name} owner={team.find((m) => m.user_id === c.owner_id)?.first_name ?? null} />)
          ) : (
            <Text variant="body" tone="secondary">
              {d.contacts.length ? 'No contact matches these filters.' : 'No contact yet. Add one, or import a CSV file.'}
            </Text>
          )}
        </>
      )}
    </CrmLoad>
  );
}

function Row({ c, index, org, owner }: { c: Contact; index: number; org?: string; owner: string | null }) {
  const day = today();
  const late = c.next_follow_up !== null && c.next_follow_up < day && c.stage !== 'lost';
  return (
    <Card index={index} onPress={() => router.push(`/admin/crm/contact?id=${c.id}`)} accessibilityLabel={contactName(c)}>
      <View style={crmStyles.row}>
        <Text variant="titleS" style={{ flex: 1 }} raw>
          {contactName(c)}
        </Text>
        <Tag label={STAGE_LABEL[c.stage]} tone={c.stage === 'lost' ? 'tertiary' : c.stage === 'active' || c.stage === 'confirmed' ? 'positive' : 'secondary'} />
      </View>
      <Text variant="bodyS" tone="secondary" raw>
        {[tx(CATEGORY_LABEL[c.category]), org ?? c.company, c.job_title, c.city].filter(Boolean).join(' · ')}
      </Text>
      {c.next_follow_up || owner ? (
        <Text variant="caption" tone={late ? 'live' : 'tertiary'} raw>
          {[c.next_follow_up ? tx('Follow up on {d}', { d: shortDate(c.next_follow_up) }) : null, owner ? tx('In charge: {name}', { name: owner }) : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {c.tags.length ? (
        <View style={crmStyles.wrap}>
          {c.tags.slice(0, 6).map((t) => (
            <Tag key={t} label={t} raw tone="tertiary" />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
