import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles, Card } from '@/features/admin/ui';
import { archiveCampaign, saveCampaign } from '@/features/crm/api';
import { CAMPAIGN_STATUSES, CHANNELS, cleanDate, type Campaign, type CampaignStatus, type Channel } from '@/features/crm/model';
import { Choice, crmStyles, CrmGate, CrmLoad, DateInput, Labeled, money, useCrm, type CrmData } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

const UTM = /^[A-Za-z0-9._-]{1,80}$/;
const APP_LINK = 'https://getirly.com/app/';

/** One campaign: dates, budget, destination link with UTM tags, results. */
export default function CampaignScreen() {
  const q = useLocalSearchParams<{ id?: string }>();
  const { data, error, reload } = useCrm();
  return (
    <Page overline="CRM" title={q.id ? 'Campaign' : 'New campaign'}>
      <View style={adminStyles.body}>
        <CrmGate>
          <CrmLoad data={data} error={error} retry={reload}>
            {(d) => {
              const found = q.id ? d.campaigns.find((c) => c.id === q.id) : null;
              if (q.id && !found) {
                return (
                  <Text variant="body" tone="secondary">
                    This campaign no longer exists.
                  </Text>
                );
              }
              return <Editor key={q.id ?? 'new'} data={d} initial={found ?? null} />;
            }}
          </CrmLoad>
        </CrmGate>
      </View>
    </Page>
  );
}

const num = (s: string) => (s.trim() ? Number(s.replace(/[\s,]/g, '')) : null);
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function Editor({ data, initial }: { data: CrmData; initial: Campaign | null }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? 'tiktok');
  const [status, setStatus] = useState<CampaignStatus>(initial?.status ?? 'draft');
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [starts, setStarts] = useState(initial?.starts_on ?? '');
  const [ends, setEnds] = useState(initial?.ends_on ?? '');
  const [budget, setBudget] = useState(str(initial?.budget));
  const [currency, setCurrency] = useState(initial?.currency ?? 'AED');
  const [url, setUrl] = useState(initial?.url ?? APP_LINK);
  const [source, setSource] = useState(initial?.utm_source ?? '');
  const [medium, setMedium] = useState(initial?.utm_medium ?? '');
  const [tag, setTag] = useState(initial?.utm_campaign ?? '');
  const [impressions, setImpressions] = useState(str(initial?.impressions));
  const [clicks, setClicks] = useState(str(initial?.clicks));
  const [signups, setSignups] = useState(str(initial?.signups_reported));
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const tracked = data.signups && tag.trim() ? (data.signups[tag.trim().toLowerCase()] ?? 0) : null;
  const link = (() => {
    const base = url.trim();
    if (!/^https?:\/\//.test(base)) return '';
    try {
      const u = new URL(base);
      if (source.trim()) u.searchParams.set('utm_source', source.trim());
      if (medium.trim()) u.searchParams.set('utm_medium', medium.trim());
      if (tag.trim()) u.searchParams.set('utm_campaign', tag.trim());
      return u.toString();
    } catch {
      return '';
    }
  })();

  const submit = () => {
    if (busy) return;
    if (!name.trim()) return toast(tx('Give the campaign a name'), 'x', 'live');
    const s = cleanDate(starts);
    const e = cleanDate(ends);
    if ((starts.trim() && !s) || (ends.trim() && !e)) return toast(tx('A date is not valid: use the format YYYY-MM-DD'), 'x', 'live');
    if (s && e && e < s) return toast(tx('The end date is before the start date'), 'x', 'live');
    for (const v of [source, medium, tag]) if (v.trim() && !UTM.test(v.trim())) return toast(tx('UTM values use letters, digits, dots, dashes and underscores only'), 'x', 'live');
    const values = { budget: num(budget), impressions: num(impressions), clicks: num(clicks), signups_reported: num(signups) };
    if (Object.values(values).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return toast(tx('Figures must be positive numbers'), 'x', 'live');
    const cur = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) return toast(tx('The currency is a 3-letter code, like AED or EUR'), 'x', 'live');
    const twin = tag.trim() && data.campaigns.find((c) => c.id !== initial?.id && !c.archived_at && (c.utm_campaign ?? '').toLowerCase() === tag.trim().toLowerCase());
    if (twin) return toast(tx('Another campaign already uses this utm_campaign'), 'x', 'live');
    setBusy(true);
    saveCampaign({
      id: initial?.id,
      name: name.trim(),
      channel,
      status,
      objective: objective.trim() || null,
      starts_on: s,
      ends_on: e,
      currency: cur,
      url: url.trim() || null,
      utm_source: source.trim() || null,
      utm_medium: medium.trim() || null,
      utm_campaign: tag.trim() || null,
      notes: notes.trim() || null,
      ...values,
      signups_reported: values.signups_reported === null ? null : Math.round(values.signups_reported),
    })
      .then((c) => {
        toast(tx(initial ? 'Saved' : 'Campaign added'), 'check', 'brand');
        if (!initial) router.replace(`/admin/crm/campaign?id=${c.id}`);
      })
      .catch((err) => toast(tx(err instanceof Error ? err.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const archive = () => {
    if (!initial || busy) return;
    setBusy(true);
    archiveCampaign(initial.id, !initial.archived_at)
      .then(() => {
        toast(tx(initial.archived_at ? 'Restored' : 'Archived'), 'check', 'brand');
        router.back();
      })
      .catch((err) => toast(tx(err instanceof Error ? err.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const b = num(budget);
  const counted = tracked ?? num(signups);
  return (
    <>
      <Labeled label="Name" value={name} onChange={setName} max={160} />
      <Choice label="Channel" options={CHANNELS} value={channel} onChange={setChannel} />
      <Choice label="Status" options={CAMPAIGN_STATUSES} value={status} onChange={setStatus} />
      <Labeled label="Goal" value={objective} onChange={setObjective} multiline max={2000} />
      <DateInput label="Start date" value={starts} onChange={setStarts} />
      <DateInput label="End date" value={ends} onChange={setEnds} />
      <View style={crmStyles.row}>
        <View style={{ flex: 2 }}>
          <Labeled label="Budget" value={budget} onChange={setBudget} max={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Labeled label="Currency" value={currency} onChange={setCurrency} autoCapitalize="none" max={3} />
        </View>
      </View>

      <Text variant="label">Destination link</Text>
      <Labeled label="Destination URL" value={url} onChange={setUrl} autoCapitalize="none" max={500} />
      <Labeled label="utm_source" value={source} onChange={setSource} placeholder="tiktok" autoCapitalize="none" max={80} />
      <Labeled label="utm_medium" value={medium} onChange={setMedium} placeholder="paid, organic, influencer" autoCapitalize="none" max={80} />
      <Labeled label="utm_campaign" value={tag} onChange={setTag} placeholder="launch-dubai-nov" autoCapitalize="none" max={80} />
      {link ? (
        <Card>
          <Text variant="caption" tone="secondary">
            Link to use in the campaign
          </Text>
          <Text variant="bodyS" raw selectable>
            {link}
          </Text>
          <Button size="sm" variant="ghost" label="Copy the link" onPress={() => Clipboard.setStringAsync(link).then(() => toast(tx('Link copied'), 'check', 'brand'))} />
          <Text variant="caption" tone="tertiary">
            Signups are counted when the visitor opens the web app with this link and creates an account in the same visit. Installs from the App Store carry no tag.
          </Text>
        </Card>
      ) : null}

      <Text variant="label">Results</Text>
      <Labeled label="Impressions (if available)" value={impressions} onChange={setImpressions} max={14} />
      <Labeled label="Clicks (if available)" value={clicks} onChange={setClicks} max={14} />
      {tracked !== null ? (
        <Text variant="bodyS" raw>
          {tx('Signups counted by the app: {n}', { n: tracked })}
        </Text>
      ) : (
        <Labeled label="Signups (entered by hand)" value={signups} onChange={setSignups} max={9} />
      )}
      {b !== null && counted ? (
        <Text variant="bodyS" tone="secondary" raw>
          {tx('Cost per signup: {v}', { v: money(Math.round((b / counted) * 100) / 100, currency.trim().toUpperCase() || 'AED') })}
        </Text>
      ) : null}
      <Labeled label="Notes" value={notes} onChange={setNotes} multiline max={5000} />
      <Button label={initial ? 'Save' : 'Add the campaign'} loading={busy} full onPress={submit} />
      {initial ? <Button label={initial.archived_at ? 'Restore' : 'Archive'} variant="ghost" full onPress={archive} /> : null}
    </>
  );
}
