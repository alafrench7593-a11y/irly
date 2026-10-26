import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { CATEGORIES, CHANNEL_LABEL, overview, PERIODS, STAGE_LABEL, type Category, type Period } from '@/features/crm/model';
import { Bar, CrmGate, CrmLoad, Filter, money, shortDate, useCrm } from '@/features/crm/ui';
import { adminStyles, Card, Stat } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';

/**
 * CRM overview, inside the back office: every figure comes from the CRM's
 * own rows (and the SIGNUP events of tagged campaigns), never an estimate.
 * Empty figures say so instead of showing a made-up number.
 */
export default function CrmHome() {
  return (
    <Page overline="Back office" title="CRM" subtitle="Contacts, prospects, partnerships, campaigns and follow-ups.">
      <View style={adminStyles.body}>
        <CrmGate>
          <Overview />
        </CrmGate>
      </View>
    </Page>
  );
}

const SECTIONS: { label: string; icon: Parameters<typeof Button>[0]['icon']; path: string }[] = [
  { label: 'Contacts and prospects', icon: 'users', path: '/admin/crm/contacts' },
  { label: 'Sales pipeline', icon: 'layers', path: '/admin/crm/pipeline' },
  { label: 'Influencers', icon: 'star', path: '/admin/crm/contacts?category=influencer' },
  { label: 'Event organisers', icon: 'calendar', path: '/admin/crm/contacts?category=event_organizer' },
  { label: 'Companies and partners', icon: 'briefcase', path: '/admin/crm/organizations' },
  { label: 'Partnerships', icon: 'network', path: '/admin/crm/partnerships' },
  { label: 'Marketing campaigns', icon: 'megaphone', path: '/admin/crm/campaigns' },
  { label: 'Tasks and follow-ups', icon: 'check', path: '/admin/crm/tasks' },
  { label: 'Reports', icon: 'file', path: '/admin/crm/reports' },
  { label: 'Import and export', icon: 'send', path: '/admin/crm/io' },
];

function Overview() {
  const { data, error, reload } = useCrm();
  const [period, setPeriod] = useState<Period>('30d');
  const [category, setCategory] = useState<Category | 'all'>('all');
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const o = overview(d, period, category);
        const empty = !d.contacts.length && !d.partnerships.length && !d.tasks.length && !d.campaigns.length;
        return (
          <>
            {empty ? (
              <Card>
                <Text variant="titleS">The CRM is empty</Text>
                <Text variant="bodyS" tone="secondary">
                  Add a first contact, or import a CSV file. The figures below fill in as you work.
                </Text>
                <Button label="Add a contact" icon="plus" size="sm" onPress={() => router.push('/admin/crm/contact')} />
              </Card>
            ) : null}
            <Text variant="label" style={{ marginTop: space[2] }}>
              Period
            </Text>
            <Filter options={PERIODS.filter((p) => p.value !== 'all')} value={period === 'all' ? 'all' : period} onChange={(v) => setPeriod(v === 'all' ? 'all' : v)} />
            <Text variant="label">Type of contact</Text>
            <Filter options={CATEGORIES} value={category} onChange={setCategory} />

            {o.tasksLate || o.toFollowUp ? (
              <Card>
                <Text variant="titleS" tone="live">
                  Needs attention
                </Text>
                {o.tasksLate ? <Button size="sm" variant="ghost" label={o.tasksLate === 1 ? tx('1 late task') : tx('{n} late tasks', { n: o.tasksLate })} raw onPress={() => router.push('/admin/crm/tasks?filter=late')} /> : null}
                {o.toFollowUp ? <Button size="sm" variant="ghost" label={o.toFollowUp === 1 ? tx('1 contact to follow up') : tx('{n} contacts to follow up', { n: o.toFollowUp })} raw onPress={() => router.push('/admin/crm/contacts?filter=follow_up')} /> : null}
              </Card>
            ) : null}

            <View style={adminStyles.row}>
              <Stat index={0} icon="users" label="Open prospects" value={o.prospects} onPress={() => router.push('/admin/crm/pipeline')} />
              <Stat index={1} icon="plus" label={period === 'all' ? tx('New contacts') : tx('New contacts ({period})', { period: tx(PERIODS.find((p) => p.value === period)!.label) })} value={o.newContacts} />
              <Stat index={2} icon="clock" label="To follow up" value={o.toFollowUp} alert={o.toFollowUp > 0} onPress={() => router.push('/admin/crm/contacts?filter=follow_up')} />
              <Stat index={3} icon="flame" label="Late tasks" value={o.tasksLate} alert={o.tasksLate > 0} onPress={() => router.push('/admin/crm/tasks?filter=late')} />
              <Stat index={4} icon="network" label="Partnerships in progress" value={o.partnershipsOngoing} onPress={() => router.push('/admin/crm/partnerships')} />
              <Stat index={5} icon="check" label="Active partners" value={o.partnersActive} onPress={() => router.push('/admin/crm/partnerships?status=active')} />
              <Stat index={6} icon="star" label="Influencers contacted" value={o.influencersContacted} onPress={() => router.push('/admin/crm/contacts?category=influencer')} />
              <Stat index={7} icon="calendar" label="Event organisers contacted" value={o.organisersContacted} onPress={() => router.push('/admin/crm/contacts?category=event_organizer')} />
              <Stat index={8} icon="briefcase" label="Companies for IRLY Network" value={o.networkInterested} onPress={() => router.push('/admin/crm/organizations?filter=network')} />
              <Stat index={9} icon="layers" label="Conversion" value={o.conversion === null ? '—' : `${Math.round(o.conversion * 100)} %`} />
            </View>
            {o.conversion === null ? (
              <Text variant="caption" tone="tertiary">
                Conversion appears once a prospect is confirmed or dropped.
              </Text>
            ) : null}

            <Text variant="label" style={{ marginTop: space[2] }}>
              Sections
            </Text>
            <View style={{ gap: 8 }}>
              {SECTIONS.map((s) => (
                <Button key={s.path} label={s.label} icon={s.icon} variant="secondary" full onPress={() => router.push(s.path as never)} />
              ))}
            </View>
            <Card>
              <Text variant="label">Next deadlines (14 days)</Text>
              {o.upcoming.length ? (
                o.upcoming.map((u, i) => (
                  <View key={`${u.kind}-${u.id}`} style={{ gap: 2 }}>
                    {i ? <Divider /> : null}
                    <Text variant="caption" tone="tertiary" raw>
                      {shortDate(u.on)} · {tx(u.kind === 'task' ? 'Task' : u.kind === 'follow_up' ? 'Follow-up' : 'Partnership')}
                    </Text>
                    <Text
                      variant="bodyS"
                      raw
                      onPress={() => router.push(u.kind === 'task' ? `/admin/crm/task?id=${u.id}` : u.kind === 'follow_up' ? `/admin/crm/contact?id=${u.id}` : `/admin/crm/partnership?id=${u.id}`)}
                    >
                      {u.title}
                    </Text>
                  </View>
                ))
              ) : (
                <Text variant="bodyS" tone="secondary">
                  Nothing due in the next 14 days.
                </Text>
              )}
            </Card>

            <Card>
              <Text variant="label">Pipeline</Text>
              {o.byStage.some((s) => s.n) ? (
                o.byStage.map((s) => <Bar key={s.stage} label={STAGE_LABEL[s.stage]} value={s.n} max={Math.max(...o.byStage.map((x) => x.n))} />)
              ) : (
                <Text variant="bodyS" tone="secondary">
                  No contact yet.
                </Text>
              )}
            </Card>

            <Card>
              <Text variant="label">Marketing campaigns</Text>
              {o.campaigns.length ? (
                o.campaigns.map((c, i) => (
                  <View key={c.id} style={{ gap: 2 }}>
                    {i ? <Divider /> : null}
                    <Text variant="bodyS" raw onPress={() => router.push(`/admin/crm/campaign?id=${c.id}`)}>
                      {c.name} · {tx(CHANNEL_LABEL[c.channel])}
                    </Text>
                    <Text variant="caption" tone="secondary" raw>
                      {[
                        c.budget !== null ? tx('Budget {v}', { v: money(c.budget, c.currency) }) : null,
                        c.clicks !== null ? tx('{n} clicks', { n: c.clicks }) : null,
                        c.signups !== null ? tx('{n} signups', { n: c.signups }) : tx('Signups not tracked'),
                        c.costPerSignup !== null ? tx('{v} per signup', { v: money(c.costPerSignup, c.currency) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ))
              ) : (
                <Text variant="bodyS" tone="secondary">
                  No campaign yet.
                </Text>
              )}
            </Card>
          </>
        );
      }}
    </CrmLoad>
  );
}
