import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles, Card } from '@/features/admin/ui';
import { archivePartnership, savePartnership } from '@/features/crm/api';
import { cleanDate, contactName, matchesSearch, PARTNERSHIP_KINDS, PARTNERSHIP_STATUSES, PRIORITY_LABEL, type Partnership, type PartnershipKind, type PartnershipStatus } from '@/features/crm/model';
import { Choice, crmStyles, CrmGate, CrmLoad, DateInput, Labeled, shortDate, useCrm, type CrmData } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** One partnership: its company, its contacts (several), goal, dates, budget, deliverables, results. */
export default function PartnershipScreen() {
  const q = useLocalSearchParams<{ id?: string; org?: string }>();
  const { data, error, reload } = useCrm();
  return (
    <Page overline="CRM" title={q.id ? 'Partnership' : 'New partnership'}>
      <View style={adminStyles.body}>
        <CrmGate>
          <CrmLoad data={data} error={error} retry={reload}>
            {(d) => {
              const found = q.id ? d.partnerships.find((p) => p.id === q.id) : null;
              if (q.id && !found) {
                return (
                  <Text variant="body" tone="secondary">
                    This partnership no longer exists.
                  </Text>
                );
              }
              return <Editor key={q.id ?? 'new'} data={d} initial={found ?? null} org={q.org ?? null} />;
            }}
          </CrmLoad>
        </CrmGate>
      </View>
    </Page>
  );
}

function Editor({ data, initial, org }: { data: CrmData; initial: Partnership | null; org: string | null }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [kind, setKind] = useState<PartnershipKind>(initial?.kind ?? 'other');
  const [status, setStatus] = useState<PartnershipStatus>(initial?.status ?? 'proposed');
  const [orgId, setOrgId] = useState<string | null>(initial?.organization_id ?? (data.orgs.some((o) => o.id === org) ? org : null));
  const [objective, setObjective] = useState(initial?.objective ?? '');
  const [starts, setStarts] = useState(initial?.starts_on ?? '');
  const [ends, setEnds] = useState(initial?.ends_on ?? '');
  const [nextDue, setNextDue] = useState(initial?.next_due ?? '');
  const [budget, setBudget] = useState(initial?.budget !== null && initial?.budget !== undefined ? String(initial.budget) : '');
  const [currency, setCurrency] = useState(initial?.currency ?? 'AED');
  const [deliverables, setDeliverables] = useState(initial?.deliverables ?? '');
  const [results, setResults] = useState(initial?.results ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [people, setPeople] = useState<string[]>(initial?.contact_ids ?? []);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (busy) return;
    if (!title.trim()) return toast(tx('Give the partnership a title'), 'x', 'live');
    const s = cleanDate(starts);
    const e = cleanDate(ends);
    if ((starts.trim() && !s) || (ends.trim() && !e) || (nextDue.trim() && !cleanDate(nextDue))) return toast(tx('A date is not valid: use the format YYYY-MM-DD'), 'x', 'live');
    if (s && e && e < s) return toast(tx('The end date is before the start date'), 'x', 'live');
    const b = budget.trim() ? Number(budget.replace(',', '.')) : null;
    if (b !== null && (!Number.isFinite(b) || b < 0)) return toast(tx('The budget must be a positive number'), 'x', 'live');
    const cur = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) return toast(tx('The currency is a 3-letter code, like AED or EUR'), 'x', 'live');
    setBusy(true);
    savePartnership(
      {
        id: initial?.id,
        title: title.trim(),
        kind,
        status,
        organization_id: orgId,
        objective: objective.trim() || null,
        starts_on: s,
        ends_on: e,
        next_due: cleanDate(nextDue),
        budget: b,
        currency: cur,
        deliverables: deliverables.trim() || null,
        results: results.trim() || null,
        notes: notes.trim() || null,
        contact_ids: initial?.contact_ids ?? [],
      },
      people,
    )
      .then((p) => {
        toast(tx(initial ? 'Saved' : 'Partnership added'), 'check', 'brand');
        if (!initial) router.replace(`/admin/crm/partnership?id=${p.id}`);
      })
      .catch((err) => toast(tx(err instanceof Error ? err.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const archive = (on: boolean) => {
    if (!initial || busy) return;
    setBusy(true);
    archivePartnership(initial.id, on)
      .then(() => {
        toast(tx(on ? 'Archived' : 'Restored'), 'check', 'brand');
        router.back();
      })
      .catch((err) => toast(tx(err instanceof Error ? err.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const live = data.contacts.filter((c) => !c.archived_at || people.includes(c.id));
  const chosen = live.filter((c) => people.includes(c.id));
  const found = search.trim() ? live.filter((c) => !people.includes(c.id) && matchesSearch(c, search, data.orgs.find((o) => o.id === c.organization_id)?.name)).slice(0, 8) : [];
  const fromOrg = orgId ? live.filter((c) => c.organization_id === orgId && !people.includes(c.id)) : [];
  const tasks = initial ? data.tasks.filter((t) => t.partnership_id === initial.id) : [];

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
      <Labeled label="Title" value={title} onChange={setTitle} max={160} />
      <Choice label="Type of partnership" options={PARTNERSHIP_KINDS} value={kind} onChange={setKind} />
      <Choice label="Status" options={PARTNERSHIP_STATUSES} value={status} onChange={setStatus} />
      <Labeled label="Goal" value={objective} onChange={setObjective} multiline max={2000} />

      <Text variant="label">Company or partner</Text>
      <View style={crmStyles.wrap}>
        <Chip size="sm" label="None" selected={!orgId} onPress={() => setOrgId(null)} />
        {data.orgs
          .filter((o) => !o.archived_at || o.id === orgId)
          .slice(0, 40)
          .map((o) => (
            <Chip key={o.id} size="sm" raw label={o.name} selected={orgId === o.id} onPress={() => setOrgId(o.id)} />
          ))}
      </View>

      <Text variant="label">Contacts</Text>
      {chosen.length ? (
        <View style={crmStyles.wrap}>
          {chosen.map((c) => (
            <Chip key={c.id} size="sm" raw selected label={`${contactName(c)} ×`} onPress={() => setPeople(people.filter((x) => x !== c.id))} />
          ))}
        </View>
      ) : (
        <Text variant="caption" tone="tertiary">
          No contact linked yet.
        </Text>
      )}
      {fromOrg.length ? (
        <View style={crmStyles.wrap}>
          {fromOrg.map((c) => (
            <Chip key={c.id} size="sm" raw label={`+ ${contactName(c)}`} onPress={() => setPeople([...people, c.id])} />
          ))}
        </View>
      ) : null}
      <Field icon="search" value={search} onChangeText={setSearch} placeholder="Find a contact to link" accessibilityLabel="Find a contact to link" autoCapitalize="none" />
      {found.length ? (
        <View style={crmStyles.wrap}>
          {found.map((c) => (
            <Chip
              key={c.id}
              size="sm"
              raw
              label={`+ ${contactName(c)}`}
              onPress={() => {
                setPeople([...people, c.id]);
                setSearch('');
              }}
            />
          ))}
        </View>
      ) : null}

      <DateInput label="Start date" value={starts} onChange={setStarts} />
      <DateInput label="End date (if any)" value={ends} onChange={setEnds} />
      <DateInput label="Next deadline" value={nextDue} onChange={setNextDue} />
      <View style={crmStyles.row}>
        <View style={{ flex: 2 }}>
          <Labeled label="Budget (if any)" value={budget} onChange={setBudget} max={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Labeled label="Currency" value={currency} onChange={setCurrency} autoCapitalize="none" max={3} />
        </View>
      </View>
      <Labeled label="Deliverables" value={deliverables} onChange={setDeliverables} multiline max={5000} />
      <Labeled label="Measurable results" value={results} onChange={setResults} multiline max={5000} />
      <Labeled label="Notes" value={notes} onChange={setNotes} multiline max={5000} />
      <Button label={initial ? 'Save' : 'Add the partnership'} loading={busy} full onPress={submit} />
      {initial && !initial.archived_at ? <Button label="Archive" variant="ghost" full onPress={() => archive(true)} /> : null}

      {initial ? (
        <Card>
          <Text variant="label">Tasks</Text>
          {tasks.length ? (
            tasks.map((t) => (
              <Text key={t.id} variant="bodyS" tone={t.done_at ? 'tertiary' : 'primary'} raw onPress={() => router.push(`/admin/crm/task?id=${t.id}`)}>
                {t.done_at ? '✓ ' : ''}
                {t.title}
                {t.due_on ? ` · ${shortDate(t.due_on)}` : ''} · {tx(PRIORITY_LABEL[t.priority])}
              </Text>
            ))
          ) : (
            <Text variant="bodyS" tone="secondary">
              No task yet.
            </Text>
          )}
          <Button size="sm" variant="ghost" icon="plus" label="Add a task" onPress={() => router.push(`/admin/crm/task?partnership=${initial.id}`)} />
        </Card>
      ) : null}
    </>
  );
}
