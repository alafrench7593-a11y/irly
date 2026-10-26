import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles, Card } from '@/features/admin/ui';
import { archiveOrg, saveOrg } from '@/features/crm/api';
import { contactName, ORG_KINDS, PARTNERSHIP_STATUS_LABEL, STAGE_LABEL, type Organization, type OrgKind } from '@/features/crm/model';
import { Choice, crmStyles, CrmGate, CrmLoad, Labeled, Tag, useCrm, type CrmData } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** One company or partner: details, its contacts and its partnerships. */
export default function OrganizationScreen() {
  const q = useLocalSearchParams<{ id?: string }>();
  const { data, error, reload } = useCrm();
  return (
    <Page overline="CRM" title={q.id ? 'Company or partner' : 'New company or partner'}>
      <View style={adminStyles.body}>
        <CrmGate>
          <CrmLoad data={data} error={error} retry={reload}>
            {(d) => {
              const found = q.id ? d.orgs.find((o) => o.id === q.id) : null;
              if (q.id && !found) {
                return (
                  <Text variant="body" tone="secondary">
                    This company no longer exists.
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

function Editor({ data, initial }: { data: CrmData; initial: Organization | null }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<OrgKind>(initial?.kind ?? 'company');
  const [website, setWebsite] = useState(initial?.website ?? '');
  const [instagram, setInstagram] = useState(initial?.socials.instagram ?? '');
  const [linkedin, setLinkedin] = useState(initial?.socials.linkedin ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [network, setNetwork] = useState(initial?.network_target ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const twin = data.orgs.find((o) => o.id !== initial?.id && o.name.trim().toLowerCase() === name.trim().toLowerCase());

  const submit = () => {
    if (busy) return;
    if (!name.trim()) return toast(tx('Give the company a name'), 'x', 'live');
    setBusy(true);
    const socials = Object.fromEntries(
      Object.entries({ instagram, linkedin })
        .filter(([, v]) => v.trim())
        .map(([k, v]) => [k, v.trim()]),
    );
    saveOrg({ id: initial?.id, name: name.trim(), kind, website: website.trim() || null, socials, city: city.trim() || null, country: country.trim() || null, network_target: network, notes: notes.trim() || null })
      .then((o) => {
        toast(tx(initial ? 'Saved' : 'Company added'), 'check', 'brand');
        if (!initial) router.replace(`/admin/crm/organization?id=${o.id}`);
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const archive = (on: boolean) => {
    if (!initial || busy) return;
    setBusy(true);
    archiveOrg(initial.id, on)
      .then(() => {
        toast(tx(on ? 'Archived' : 'Restored'), 'check', 'brand');
        router.back();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const people = initial ? data.contacts.filter((c) => c.organization_id === initial.id) : [];
  const parts = initial ? data.partnerships.filter((p) => p.organization_id === initial.id) : [];

  return (
    <>
      {initial?.archived_at ? (
        <Card>
          <Text variant="bodyS" tone="secondary">
            Archived: hidden from lists and figures.
          </Text>
          <Button size="sm" variant="secondary" label="Restore" onPress={() => archive(false)} />
        </Card>
      ) : null}
      <Labeled label="Name" value={name} onChange={setName} max={160} />
      {twin ? (
        <Text variant="caption" tone="live" raw onPress={() => router.push(`/admin/crm/organization?id=${twin.id}`)}>
          {tx('Already in the CRM: {name}', { name: twin.name })}
        </Text>
      ) : null}
      <Choice label="Type" options={ORG_KINDS} value={kind} onChange={setKind} />
      <Labeled label="Website" value={website} onChange={setWebsite} autoCapitalize="none" max={300} />
      <Labeled label="Instagram" value={instagram} onChange={setInstagram} autoCapitalize="none" max={200} />
      <Labeled label="LinkedIn" value={linkedin} onChange={setLinkedin} autoCapitalize="none" max={200} />
      <Labeled label="City" value={city} onChange={setCity} max={80} />
      <Labeled label="Country" value={country} onChange={setCountry} max={80} />
      <Chip size="sm" label="Target for IRLY Network" selected={network} onPress={() => setNetwork(!network)} />
      <Labeled label="Internal notes" value={notes} onChange={setNotes} multiline max={5000} />
      <Button label={initial ? 'Save' : 'Add'} loading={busy} full onPress={submit} />
      {initial && !initial.archived_at ? <Button label="Archive" variant="ghost" full onPress={() => archive(true)} /> : null}

      {initial ? (
        <>
          <Card>
            <Text variant="label">Contacts</Text>
            {people.length ? (
              people.map((c) => (
                <View key={c.id} style={crmStyles.row}>
                  <Text variant="bodyS" style={{ flex: 1 }} raw onPress={() => router.push(`/admin/crm/contact?id=${c.id}`)}>
                    {contactName(c)}
                    {c.job_title ? ` · ${c.job_title}` : ''}
                  </Text>
                  <Tag label={STAGE_LABEL[c.stage]} />
                </View>
              ))
            ) : (
              <Text variant="bodyS" tone="secondary">
                No contact yet.
              </Text>
            )}
          </Card>
          <Card>
            <Text variant="label">Partnerships</Text>
            {parts.length ? (
              parts.map((p) => (
                <View key={p.id} style={crmStyles.row}>
                  <Text variant="bodyS" style={{ flex: 1 }} raw onPress={() => router.push(`/admin/crm/partnership?id=${p.id}`)}>
                    {p.title}
                  </Text>
                  <Tag label={PARTNERSHIP_STATUS_LABEL[p.status]} />
                </View>
              ))
            ) : (
              <Text variant="bodyS" tone="secondary">
                No partnership yet.
              </Text>
            )}
            <Button size="sm" variant="ghost" icon="plus" label="New partnership" onPress={() => router.push(`/admin/crm/partnership?org=${initial.id}`)} />
          </Card>
        </>
      ) : null}
    </>
  );
}
