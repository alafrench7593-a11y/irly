import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { adminStyles, Card } from '@/features/admin/ui';
import { archiveContact, saveContact, stageHistory } from '@/features/crm/api';
import {
  CATEGORIES,
  cleanDate,
  contactName,
  duplicatesOf,
  PARTNERSHIP_STATUS_LABEL,
  PRIORITY_LABEL,
  SOCIAL_KEYS,
  STAGE_LABEL,
  STAGES,
  type Category,
  type Contact,
  type Details,
  type Socials,
  type Stage,
  type StageChange,
} from '@/features/crm/model';
import { Choice, crmStyles, CrmGate, CrmLoad, DateInput, Labeled, shortDate, Tag, useCrm, useTeam, type CrmData } from '@/features/crm/ui';
import { t as tx } from '@/i18n';
import { space } from '@/theme/tokens';

/** One contact: create (no id) or edit, archive, stage history, tasks and partnerships linked to it. */
export default function ContactScreen() {
  const q = useLocalSearchParams<{ id?: string; category?: string }>();
  return (
    <Page overline="CRM" title={q.id ? 'Contact' : 'New contact'}>
      <View style={adminStyles.body}>
        <CrmGate>
          <Loader id={q.id ?? null} category={CATEGORIES.some((c) => c.value === q.category) ? (q.category as Category) : 'other'} />
        </CrmGate>
      </View>
    </Page>
  );
}

function Loader({ id, category }: { id: string | null; category: Category }) {
  const { data, error, reload } = useCrm();
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const found = id ? d.contacts.find((c) => c.id === id) : null;
        if (id && !found) {
          return (
            <Text variant="body" tone="secondary">
              This contact no longer exists.
            </Text>
          );
        }
        return <Editor key={id ?? 'new'} data={d} initial={found ?? null} category={category} />;
      }}
    </CrmLoad>
  );
}

type Form = {
  first_name: string;
  last_name: string;
  organization_id: string | null;
  company: string;
  job_title: string;
  category: Category;
  email: string;
  phone: string;
  website: string;
  socials: Socials;
  city: string;
  country: string;
  language: string;
  source: string;
  stage: Stage;
  tags: string;
  notes: string;
  details: Details;
  last_contact_at: string;
  next_follow_up: string;
  owner_id: string | null;
};

const fromContact = (c: Contact | null, category: Category): Form => ({
  first_name: c?.first_name ?? '',
  last_name: c?.last_name ?? '',
  organization_id: c?.organization_id ?? null,
  company: c?.company ?? '',
  job_title: c?.job_title ?? '',
  category: c?.category ?? category,
  email: c?.email ?? '',
  phone: c?.phone ?? '',
  website: c?.website ?? '',
  socials: c?.socials ?? {},
  city: c?.city ?? '',
  country: c?.country ?? '',
  language: c?.language ?? '',
  source: c?.source ?? '',
  stage: c?.stage ?? 'new',
  tags: (c?.tags ?? []).join(', '),
  notes: c?.notes ?? '',
  details: c?.details ?? {},
  last_contact_at: c?.last_contact_at ?? '',
  next_follow_up: c?.next_follow_up ?? '',
  owner_id: c?.owner_id ?? null,
});

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function toRow(f: Form): Partial<Contact> {
  const clean = <T extends Record<string, string | undefined>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
  return {
    first_name: orNull(f.first_name),
    last_name: orNull(f.last_name),
    organization_id: f.organization_id,
    company: orNull(f.company),
    job_title: orNull(f.job_title),
    category: f.category,
    email: orNull(f.email)?.toLowerCase() ?? null,
    phone: orNull(f.phone),
    website: orNull(f.website),
    socials: clean(f.socials),
    city: orNull(f.city),
    country: orNull(f.country),
    language: orNull(f.language),
    source: orNull(f.source),
    stage: f.stage,
    tags: [...new Set(f.tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 30),
    notes: orNull(f.notes),
    details: clean(f.details),
    last_contact_at: cleanDate(f.last_contact_at),
    next_follow_up: cleanDate(f.next_follow_up),
    owner_id: f.owner_id,
  };
}

function Editor({ data, initial, category }: { data: CrmData; initial: Contact | null; category: Category }) {
  const team = useTeam();
  const [f, setF] = useState<Form>(() => fromContact(initial, category));
  const [busy, setBusy] = useState(false);
  const [dupesOk, setDupesOk] = useState(false);
  const [history, setHistory] = useState<StageChange[] | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setDetail = (k: keyof Details, v: string) => setF((x) => ({ ...x, details: { ...x.details, [k]: v } }));

  useEffect(() => {
    if (initial) stageHistory(initial.id).then(setHistory, () => setHistory([]));
  }, [initial]);

  const row = toRow(f);
  const dupes = duplicatesOf({ ...row, id: initial?.id }, data.contacts);
  const named = Boolean(row.first_name || row.last_name || row.company || row.organization_id);
  const badDate = (f.last_contact_at.trim() && !row.last_contact_at) || (f.next_follow_up.trim() && !row.next_follow_up);
  const badEmail = Boolean(row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email));

  const submit = () => {
    if (busy) return;
    if (!named) return toast(tx('Give at least a name or a company'), 'x', 'live');
    if (badEmail) return toast(tx('The email is not valid'), 'x', 'live');
    if (badDate) return toast(tx('A date is not valid: use the format YYYY-MM-DD'), 'x', 'live');
    if (dupes.length && !dupesOk) return toast(tx('This contact may already exist: check below'), 'x', 'live');
    setBusy(true);
    saveContact({ ...row, id: initial?.id })
      .then((saved) => {
        toast(tx(initial ? 'Contact saved' : 'Contact added'), 'check', 'brand');
        if (!initial) router.replace(`/admin/crm/contact?id=${saved.id}`);
        else stageHistory(saved.id).then(setHistory, () => undefined);
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const archive = (on: boolean) => {
    if (!initial || busy) return;
    setBusy(true);
    archiveContact(initial.id, on)
      .then(() => {
        toast(tx(on ? 'Contact archived' : 'Contact restored'), 'check', 'brand');
        router.back();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  const tasks = initial ? data.tasks.filter((t) => t.contact_id === initial.id) : [];
  const partnerships = initial ? data.partnerships.filter((p) => p.contact_ids.includes(initial.id)) : [];
  const orgs = data.orgs.filter((o) => !o.archived_at || o.id === f.organization_id);
  const showInfluencer = f.category === 'influencer' || f.category === 'ambassador';
  const showOrganiser = f.category === 'event_organizer' || f.category === 'venue';

  return (
    <>
      {initial?.archived_at ? (
        <Card>
          <Text variant="bodyS" tone="secondary">
            This contact is archived: it is hidden from lists and figures.
          </Text>
          <Button size="sm" variant="secondary" label="Restore" onPress={() => archive(false)} />
        </Card>
      ) : null}

      {initial ? (
        <Card>
          <Text variant="label">Next actions</Text>
          {f.next_follow_up ? (
            <Text variant="bodyS" raw>
              {tx('Follow up on {d}', { d: shortDate(f.next_follow_up) })}
            </Text>
          ) : null}
          {tasks.filter((t) => !t.done_at).map((t) => (
            <Text key={t.id} variant="bodyS" raw onPress={() => router.push(`/admin/crm/task?id=${t.id}`)}>
              {t.title}
              {t.due_on ? ` · ${shortDate(t.due_on)}` : ''} · {tx(PRIORITY_LABEL[t.priority])}
            </Text>
          ))}
          {!f.next_follow_up && !tasks.some((t) => !t.done_at) ? (
            <Text variant="bodyS" tone="secondary">
              No next action planned.
            </Text>
          ) : null}
          <Button size="sm" variant="ghost" icon="plus" label="Add a task" onPress={() => router.push(`/admin/crm/task?contact=${initial.id}`)} />
        </Card>
      ) : null}

      <Text variant="label">Identity</Text>
      <Labeled label="First name" value={f.first_name} onChange={(v) => set('first_name', v)} max={80} />
      <Labeled label="Last name" value={f.last_name} onChange={(v) => set('last_name', v)} max={80} />
      <Labeled label="Job title" value={f.job_title} onChange={(v) => set('job_title', v)} max={120} />
      <Choice label="Type of contact" options={CATEGORIES} value={f.category} onChange={(v) => set('category', v)} />

      <Text variant="label">Company or organisation</Text>
      {orgs.length ? (
        <View style={crmStyles.wrap}>
          <Chip size="sm" label="None" selected={!f.organization_id} onPress={() => set('organization_id', null)} />
          {orgs.slice(0, 40).map((o) => (
            <Chip key={o.id} size="sm" raw label={o.name} selected={f.organization_id === o.id} onPress={() => set('organization_id', o.id)} />
          ))}
        </View>
      ) : null}
      <Labeled label="Company (if not in the list)" value={f.company} onChange={(v) => set('company', v)} max={160} />

      <Text variant="label">Professional details</Text>
      <Labeled label="Professional email" value={f.email} onChange={(v) => set('email', v)} autoCapitalize="none" max={200} />
      {badEmail ? (
        <Text variant="caption" tone="live">
          The email is not valid
        </Text>
      ) : null}
      <Labeled label="Professional phone (optional)" value={f.phone} onChange={(v) => set('phone', v)} max={40} />
      <Labeled label="Website" value={f.website} onChange={(v) => set('website', v)} autoCapitalize="none" max={300} />
      {SOCIAL_KEYS.map((k) => (
        <Labeled key={k} label={SOCIAL_LABEL[k]} value={f.socials[k] ?? ''} onChange={(v) => set('socials', { ...f.socials, [k]: v })} autoCapitalize="none" max={200} />
      ))}
      <Labeled label="City" value={f.city} onChange={(v) => set('city', v)} max={80} />
      <Labeled label="Country" value={f.country} onChange={(v) => set('country', v)} max={80} />
      <Labeled label="Language" value={f.language} onChange={(v) => set('language', v)} max={40} />

      {showInfluencer ? (
        <>
          <Text variant="label">Influence</Text>
          <Labeled label="Platforms used" value={f.details.platforms ?? ''} onChange={(v) => setDetail('platforms', v)} max={300} />
          <Labeled label="Audience, if known" value={f.details.audience ?? ''} onChange={(v) => setDetail('audience', v)} max={300} />
          <Labeled label="Theme" value={f.details.theme ?? ''} onChange={(v) => setDetail('theme', v)} max={300} />
          <Labeled label="Budget they gave" value={f.details.budget ?? ''} onChange={(v) => setDetail('budget', v)} max={120} />
          <Labeled label="Collaboration proposal" value={f.details.proposal ?? ''} onChange={(v) => setDetail('proposal', v)} multiline max={2000} />
          <Labeled label="Expected content" value={f.details.deliverables ?? ''} onChange={(v) => setDetail('deliverables', v)} multiline max={2000} />
          <Labeled label="Results of the collaboration" value={f.details.results ?? ''} onChange={(v) => setDetail('results', v)} multiline max={2000} />
        </>
      ) : null}
      {showOrganiser ? (
        <>
          <Text variant="label">Events</Text>
          <Labeled label="Types of events" value={f.details.event_types ?? ''} onChange={(v) => setDetail('event_types', v)} max={300} />
          <Labeled label="Interest in IRLY" value={f.details.interest ?? ''} onChange={(v) => setDetail('interest', v)} multiline max={2000} />
          <Labeled label="Events or activities planned" value={f.details.planned ?? ''} onChange={(v) => setDetail('planned', v)} multiline max={2000} />
        </>
      ) : null}

      <Text variant="label">Follow-up</Text>
      <Choice label="Stage" options={STAGES} value={f.stage} onChange={(v) => set('stage', v)} />
      <Labeled label="Source of the contact" value={f.source} onChange={(v) => set('source', v)} placeholder="Instagram, event, referral…" max={120} />
      <DateInput label="Last contact" value={f.last_contact_at} onChange={(v) => set('last_contact_at', v)} />
      <DateInput label="Next follow-up" value={f.next_follow_up} onChange={(v) => set('next_follow_up', v)} />
      {team.length ? (
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="secondary">
            Person in charge
          </Text>
          <View style={crmStyles.wrap}>
            <Chip size="sm" label="Nobody" selected={!f.owner_id} onPress={() => set('owner_id', null)} />
            {team.map((m) => (
              <Chip key={m.user_id} size="sm" raw label={m.first_name ?? '—'} selected={f.owner_id === m.user_id} onPress={() => set('owner_id', m.user_id)} />
            ))}
          </View>
        </View>
      ) : null}
      <Labeled label="Tags (comma separated)" value={f.tags} onChange={(v) => set('tags', v)} autoCapitalize="none" max={600} />
      <Labeled label="Internal notes" value={f.notes} onChange={(v) => set('notes', v)} multiline max={10000} />

      {dupes.length ? (
        <Card>
          <Text variant="titleS" tone="live">
            Possible duplicate
          </Text>
          {dupes.slice(0, 5).map((o) => (
            <Text key={o.id} variant="bodyS" raw onPress={() => router.push(`/admin/crm/contact?id=${o.id}`)}>
              {contactName(o)}
              {o.email ? ` · ${o.email}` : ''}
              {o.archived_at ? ` · ${tx('Archived')}` : ''}
            </Text>
          ))}
          <Chip size="sm" label="It is someone else: save anyway" selected={dupesOk} onPress={() => setDupesOk(!dupesOk)} />
        </Card>
      ) : null}

      <Button label={initial ? 'Save' : 'Add the contact'} loading={busy} full onPress={submit} />
      {initial && !initial.archived_at ? <Button label="Archive" variant="ghost" full onPress={() => archive(true)} /> : null}

      {partnerships.length ? (
        <Card>
          <Text variant="label">Partnerships</Text>
          {partnerships.map((p) => (
            <View key={p.id} style={crmStyles.row}>
              <Text variant="bodyS" style={{ flex: 1 }} raw onPress={() => router.push(`/admin/crm/partnership?id=${p.id}`)}>
                {p.title}
              </Text>
              <Tag label={PARTNERSHIP_STATUS_LABEL[p.status]} />
            </View>
          ))}
        </Card>
      ) : null}

      {initial ? (
        <Card>
          <Text variant="label">Pipeline history</Text>
          {history === null ? null : history.length ? (
            history.map((h, i) => (
              <View key={h.id} style={{ gap: 2 }}>
                {i ? <Divider /> : null}
                <Text variant="caption" tone="tertiary" raw>
                  {shortDate(h.at)}
                  {h.changed_by ? ` · ${team.find((m) => m.user_id === h.changed_by)?.first_name ?? tx('Team')}` : ''}
                </Text>
                <Text variant="bodyS" raw>
                  {h.from_stage ? `${tx(STAGE_LABEL[h.from_stage])} → ${tx(STAGE_LABEL[h.to_stage])}` : tx('Added at stage {stage}', { stage: tx(STAGE_LABEL[h.to_stage]) })}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="bodyS" tone="secondary">
              No change yet.
            </Text>
          )}
        </Card>
      ) : null}
      <View style={{ height: space[4] }} />
    </>
  );
}

const SOCIAL_LABEL: Record<(typeof SOCIAL_KEYS)[number], string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  snapchat: 'Snapchat',
};
