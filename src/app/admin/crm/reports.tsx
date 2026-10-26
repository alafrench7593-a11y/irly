import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Text } from '@/components/ui/Text';
import { adminStyles, Card } from '@/features/admin/ui';
import { CATEGORIES, CHANNEL_LABEL, overview, PARTNERSHIP_STATUSES, PERIODS, since, STAGE_LABEL, type Period } from '@/features/crm/model';
import { Bar, CrmGate, CrmLoad, Filter, money, useCrm } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** Reports: contacts by type and source, pipeline, partnerships, campaigns, team workload, over a period. */
export default function Reports() {
  return (
    <Page overline="CRM" title="Reports" subtitle="Counts from the CRM itself, over the period you choose.">
      <View style={adminStyles.body}>
        <CrmGate>
          <Body />
        </CrmGate>
      </View>
    </Page>
  );
}

function Body() {
  const { data, error, reload } = useCrm();
  const [period, setPeriod] = useState<Period>('all');
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const from = since(period);
        const added = d.contacts.filter((c) => !c.archived_at && new Date(c.created_at).getTime() >= from);
        const o = overview(d, period, 'all');
        const byType = CATEGORIES.map((c) => ({ label: c.label, n: added.filter((x) => x.category === c.value).length }));
        const sources = Object.entries(
          added.reduce<Record<string, number>>((acc, c) => {
            const k = c.source?.trim() || tx('Unknown');
            acc[k] = (acc[k] ?? 0) + 1;
            return acc;
          }, {}),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
        const parts = d.partnerships.filter((p) => !p.archived_at);
        const doneTasks = d.tasks.filter((t) => t.done_at && new Date(t.done_at).getTime() >= from).length;
        const max = (xs: number[]) => Math.max(1, ...xs);
        return (
          <>
            <Filter options={PERIODS.filter((p) => p.value !== 'all')} value={period} onChange={(v) => setPeriod(v)} />
            <Text variant="caption" tone="tertiary">
              The period applies to new contacts, their sources and completed tasks. The pipeline, partnerships and campaigns show where things stand today.
            </Text>
            <Card>
              <Text variant="label">{tx('New contacts by type ({n})', { n: added.length })}</Text>
              {added.length ? byType.map((r) => <Bar key={r.label} label={r.label} value={r.n} max={max(byType.map((x) => x.n))} />) : <Empty />}
            </Card>
            <Card>
              <Text variant="label">Where new contacts come from</Text>
              {sources.length ? (
                sources.map(([k, n]) => (
                  <View key={k} style={{ gap: 2 }}>
                    <Bar label={k} value={n} max={max(sources.map((s) => s[1]))} />
                  </View>
                ))
              ) : (
                <Empty />
              )}
            </Card>
            <Card>
              <Text variant="label">Pipeline today</Text>
              {o.byStage.some((s) => s.n) ? o.byStage.map((s) => <Bar key={s.stage} label={STAGE_LABEL[s.stage]} value={s.n} max={max(o.byStage.map((x) => x.n))} />) : <Empty />}
              <Text variant="bodyS" tone="secondary" raw>
                {o.conversion === null ? tx('Conversion: no decision yet') : tx('Conversion: {p} % of decided prospects became partners', { p: Math.round(o.conversion * 100) })}
              </Text>
            </Card>
            <Card>
              <Text variant="label">Partnerships by status</Text>
              {parts.length ? PARTNERSHIP_STATUSES.map((s) => <Bar key={s.value} label={s.label} value={parts.filter((p) => p.status === s.value).length} max={max(PARTNERSHIP_STATUSES.map((x) => parts.filter((p) => p.status === x.value).length))} />) : <Empty />}
            </Card>
            <Card>
              <Text variant="label">Campaigns</Text>
              {o.campaigns.length ? (
                o.campaigns.map((c) => (
                  <View key={c.id} style={{ gap: 2 }}>
                    <Text variant="bodyS" raw>
                      {c.name} · {tx(CHANNEL_LABEL[c.channel])}
                    </Text>
                    <Text variant="caption" tone="secondary" raw>
                      {[
                        c.budget !== null ? money(c.budget, c.currency) : null,
                        c.signups !== null ? tx('{n} signups', { n: c.signups }) : tx('Signups not tracked'),
                        c.costPerSignup !== null ? tx('{v} per signup', { v: money(c.costPerSignup, c.currency) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                ))
              ) : (
                <Empty />
              )}
            </Card>
            <Card>
              <Text variant="label">Tasks</Text>
              <Text variant="bodyS" raw>
                {tx('{n} completed in the period', { n: doneTasks })} · {tx('{n} late', { n: o.tasksLate })}
              </Text>
            </Card>
          </>
        );
      }}
    </CrmLoad>
  );
}

function Empty() {
  return (
    <Text variant="bodyS" tone="secondary">
      No data yet.
    </Text>
  );
}
