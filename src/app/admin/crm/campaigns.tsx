import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { adminStyles, Card } from '@/features/admin/ui';
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUSES, CHANNEL_LABEL, CHANNELS, overview, type CampaignStatus, type Channel } from '@/features/crm/model';
import { crmStyles, CrmGate, CrmLoad, Filter, money, shortDate, Tag, useCrm } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** Acquisition campaigns (TikTok, Instagram, YouTube…): budget, UTM link, clicks, signups, cost per signup. */
export default function Campaigns() {
  return (
    <Page overline="CRM" title="Marketing campaigns" subtitle="Signups are counted from the app when the link carries the campaign's UTM tag.">
      <View style={adminStyles.body}>
        <CrmGate>
          <List />
        </CrmGate>
      </View>
    </Page>
  );
}

function List() {
  const { data, error, reload } = useCrm();
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all');
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const stats = overview(d, 'all', 'all').campaigns;
        const rows = d.campaigns.filter((c) => !c.archived_at && (channel === 'all' || c.channel === channel) && (status === 'all' || c.status === status));
        return (
          <>
            <Button label="New campaign" icon="plus" full onPress={() => router.push('/admin/crm/campaign')} />
            {d.signups === null ? (
              <Text variant="caption" tone="live">
                Signups could not be read from the app’s analytics: figures below use the numbers entered by hand.
              </Text>
            ) : null}
            <Text variant="label">Channel</Text>
            <Filter options={CHANNELS} value={channel} onChange={setChannel} />
            <Text variant="label">Status</Text>
            <Filter options={CAMPAIGN_STATUSES} value={status} onChange={setStatus} />
            {rows.length ? (
              rows.map((c, i) => {
                const s = stats.find((x) => x.id === c.id);
                return (
                  <Card key={c.id} index={i} onPress={() => router.push(`/admin/crm/campaign?id=${c.id}`)} accessibilityLabel={c.name}>
                    <View style={crmStyles.row}>
                      <Text variant="titleS" style={{ flex: 1 }} raw>
                        {c.name}
                      </Text>
                      <Tag label={CAMPAIGN_STATUS_LABEL[c.status]} tone={c.status === 'running' ? 'positive' : 'secondary'} />
                    </View>
                    <Text variant="bodyS" tone="secondary" raw>
                      {[tx(CHANNEL_LABEL[c.channel]), c.starts_on ? `${shortDate(c.starts_on)}${c.ends_on ? ` → ${shortDate(c.ends_on)}` : ''}` : null, c.budget !== null ? money(c.budget, c.currency) : null].filter(Boolean).join(' · ')}
                    </Text>
                    <Text variant="caption" tone="tertiary" raw>
                      {[
                        c.impressions !== null ? tx('{n} impressions', { n: c.impressions }) : null,
                        c.clicks !== null ? tx('{n} clicks', { n: c.clicks }) : null,
                        s?.signups !== null && s?.signups !== undefined ? tx('{n} signups', { n: s.signups }) : tx('Signups not tracked'),
                        s?.costPerSignup !== null && s?.costPerSignup !== undefined ? tx('{v} per signup', { v: money(s.costPerSignup, c.currency) }) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Card>
                );
              })
            ) : (
              <Text variant="body" tone="secondary">
                {d.campaigns.length ? 'Nothing matches these filters.' : 'No campaign yet.'}
              </Text>
            )}
          </>
        );
      }}
    </CrmLoad>
  );
}
