import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Field } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles } from '@/features/admin/ui';
import { saveTask, setTaskDone } from '@/features/crm/api';
import { cleanDate, contactName, matchesSearch, PRIORITIES, type Priority, type Task } from '@/features/crm/model';
import { Choice, crmStyles, CrmGate, CrmLoad, DateInput, Labeled, useCrm, useTeam, type CrmData } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/** One task: what, for which contact or partnership, by when, how urgent, for whom. */
export default function TaskScreen() {
  const q = useLocalSearchParams<{ id?: string; contact?: string; partnership?: string }>();
  const { data, error, reload } = useCrm();
  return (
    <Page overline="CRM" title={q.id ? 'Task' : 'New task'}>
      <View style={adminStyles.body}>
        <CrmGate>
          <CrmLoad data={data} error={error} retry={reload}>
            {(d) => {
              const found = q.id ? d.tasks.find((t) => t.id === q.id) : null;
              if (q.id && !found) {
                return (
                  <Text variant="body" tone="secondary">
                    This task no longer exists.
                  </Text>
                );
              }
              return <Editor key={q.id ?? 'new'} data={d} initial={found ?? null} contact={q.contact ?? null} partnership={q.partnership ?? null} />;
            }}
          </CrmLoad>
        </CrmGate>
      </View>
    </Page>
  );
}

function Editor({ data, initial, contact, partnership }: { data: CrmData; initial: Task | null; contact: string | null; partnership: string | null }) {
  const team = useTeam();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [contactId, setContactId] = useState<string | null>(initial?.contact_id ?? (data.contacts.some((c) => c.id === contact) ? contact : null));
  const [partnershipId, setPartnershipId] = useState<string | null>(initial?.partnership_id ?? (data.partnerships.some((p) => p.id === partnership) ? partnership : null));
  const [due, setDue] = useState(initial?.due_on ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'normal');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [assignee, setAssignee] = useState<string | null>(initial?.assignee_id ?? null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = () => {
    if (busy) return;
    if (!title.trim()) return toast(tx('Say what is to be done'), 'x', 'live');
    if (due.trim() && !cleanDate(due)) return toast(tx('A date is not valid: use the format YYYY-MM-DD'), 'x', 'live');
    setBusy(true);
    saveTask({ id: initial?.id, title: title.trim(), contact_id: contactId, partnership_id: partnershipId, due_on: cleanDate(due), priority, notes: notes.trim() || null, assignee_id: assignee })
      .then(() => {
        toast(tx(initial ? 'Task saved' : 'Task added'), 'check', 'brand');
        router.back();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const done = () => {
    if (!initial || busy) return;
    setBusy(true);
    setTaskDone(initial.id, !initial.done_at)
      .then((t) => {
        toast(tx(t.done_at ? 'Task done' : 'Task reopened'), 'check', 'brand');
        router.back();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const picked = data.contacts.find((c) => c.id === contactId);
  const found = search.trim() ? data.contacts.filter((c) => !c.archived_at && c.id !== contactId && matchesSearch(c, search)).slice(0, 8) : [];

  return (
    <>
      <Labeled label="What is to be done" value={title} onChange={setTitle} max={200} />
      <Text variant="label">Contact</Text>
      {picked ? <Chip size="sm" raw selected label={`${contactName(picked)} ×`} onPress={() => setContactId(null)} /> : null}
      <Field icon="search" value={search} onChangeText={setSearch} placeholder="Find a contact" accessibilityLabel="Find a contact" autoCapitalize="none" />
      {found.length ? (
        <View style={crmStyles.wrap}>
          {found.map((c) => (
            <Chip
              key={c.id}
              size="sm"
              raw
              label={contactName(c)}
              onPress={() => {
                setContactId(c.id);
                setSearch('');
              }}
            />
          ))}
        </View>
      ) : null}
      {data.partnerships.some((p) => !p.archived_at) ? (
        <>
          <Text variant="label">Partnership</Text>
          <View style={crmStyles.wrap}>
            <Chip size="sm" label="None" selected={!partnershipId} onPress={() => setPartnershipId(null)} />
            {data.partnerships
              .filter((p) => !p.archived_at || p.id === partnershipId)
              .slice(0, 30)
              .map((p) => (
                <Chip key={p.id} size="sm" raw label={p.title} selected={partnershipId === p.id} onPress={() => setPartnershipId(p.id)} />
              ))}
          </View>
        </>
      ) : null}
      <DateInput label="Deadline" value={due} onChange={setDue} />
      <Choice label="Priority" options={PRIORITIES} value={priority} onChange={setPriority} />
      {team.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="secondary">
            Assigned to
          </Text>
          <View style={crmStyles.wrap}>
            <Chip size="sm" label="Nobody" selected={!assignee} onPress={() => setAssignee(null)} />
            {team.map((m) => (
              <Chip key={m.user_id} size="sm" raw label={m.first_name ?? '—'} selected={assignee === m.user_id} onPress={() => setAssignee(m.user_id)} />
            ))}
          </View>
        </View>
      ) : null}
      <Labeled label="Notes" value={notes} onChange={setNotes} multiline max={5000} />
      <Button label={initial ? 'Save' : 'Add the task'} loading={busy} full onPress={submit} />
      {initial ? <Button label={initial.done_at ? 'Reopen' : 'Mark as done'} variant="ghost" full onPress={done} /> : null}
    </>
  );
}
