import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { isAdmin, loadStaff, type StaffRow } from '@/features/admin/api';
import { AdminInput, NoAccess, useAdminRole } from '@/features/admin/ui';
import { dateLocale, t as tx } from '@/i18n';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { campaignSignups, listCampaigns, listContacts, listOrgs, listPartnerships, listTasks } from './api';
import { cleanDate, today, type Campaign, type Contact, type Organization, type Partnership, type Task } from './model';

export type CrmData = {
  contacts: Contact[];
  orgs: Organization[];
  partnerships: Partnership[];
  tasks: Task[];
  campaigns: Campaign[];
  signups: Record<string, number> | null;
};

/**
 * Every CRM table at once (small tables: the team's own contacts), with
 * reload. Loaded again each time the screen comes back into view: the stack
 * keeps a list mounted while a contact is edited above it.
 */
export function useCrm() {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    Promise.all([listContacts(), listOrgs(), listPartnerships(), listTasks(), listCampaigns(), campaignSignups()]).then(
      ([contacts, orgs, partnerships, tasks, campaigns, signups]) => {
        setData({ contacts, orgs, partnerships, tasks, campaigns, signups });
        setError(null);
      },
      (e) => setError(e instanceof Error ? e.message : 'Could not load'),
    );
  }, []);
  useFocusEffect(reload);
  return { data, error, reload };
}

/** Owners and admins of the back office: the only people a contact or a task can be given to. */
export function useTeam(): StaffRow[] {
  const [team, setTeam] = useState<StaffRow[]>([]);
  useEffect(() => {
    loadStaff().then(
      (r) => setTeam(r.filter((s) => s.role === 'owner' || s.role === 'admin')),
      () => setTeam([]),
    );
  }, []);
  return team;
}

/**
 * The CRM is for back office owners and admins: others see the usual
 * "not open to your role" line. The server enforces the same rule on every
 * row (RLS), whatever the app shows.
 */
export function CrmGate({ children }: { children: ReactNode }) {
  const t = useTheme();
  const role = useAdminRole();
  if (role === undefined) return <ActivityIndicator color={t.c.text} style={{ marginTop: 24 }} />;
  if (!isAdmin(role)) return <NoAccess />;
  return <>{children}</>;
}

/** Loading, error with retry, then the screen. */
export function CrmLoad({ data, error, retry, children }: { data: CrmData | null; error: string | null; retry: () => void; children: (d: CrmData) => ReactNode }) {
  const t = useTheme();
  if (error) {
    return (
      <View style={{ gap: space[2] }}>
        <Text variant="body" tone="secondary">
          {tx(error)}
        </Text>
        <Button label="Try again" variant="secondary" onPress={retry} />
      </View>
    );
  }
  if (!data) return <ActivityIndicator color={t.c.text} style={{ marginTop: 24 }} />;
  return <>{children(data)}</>;
}

/** A labelled text box. */
export function Labeled({ label, value, onChange, placeholder, multiline, max, autoCapitalize }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; max?: number; autoCapitalize?: 'none' | 'sentences' }) {
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <AdminInput label={label} value={value} onChange={onChange} placeholder={placeholder ?? label} multiline={multiline} max={max} autoCapitalize={autoCapitalize} />
    </View>
  );
}

/** A date as YYYY-MM-DD, with "Today" and "Clear"; an invalid date is shown as such. */
export function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== '' && !cleanDate(value);
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption" tone={bad ? 'live' : 'secondary'}>
        {bad ? tx('{label}: use the format YYYY-MM-DD', { label: tx(label) }) : label}
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <AdminInput label={label} value={value} onChange={onChange} placeholder="YYYY-MM-DD" max={10} autoCapitalize="none" />
        </View>
        <Button size="sm" variant="ghost" label="Today" onPress={() => onChange(today())} />
        {value ? <Button size="sm" variant="ghost" label="Clear" onPress={() => onChange('')} /> : null}
      </View>
    </View>
  );
}

/** One choice among a few, as chips. */
export function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <View style={styles.wrap}>
        {options.map((o) => (
          <Chip key={o.value} size="sm" label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}

/** Filter chips with an "All" first. */
export function Filter<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | 'all'; onChange: (v: T | 'all') => void }) {
  return (
    <View style={styles.wrap}>
      <Chip size="sm" label="All" selected={value === 'all'} onPress={() => onChange('all')} />
      {options.map((o) => (
        <Chip key={o.value} size="sm" label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} />
      ))}
    </View>
  );
}

/** A small rounded tag (stage, status, priority). */
export function Tag({ label, tone = 'secondary', raw }: { label: string; tone?: 'secondary' | 'live' | 'positive' | 'accent' | 'tertiary'; raw?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: t.c.overlay }]}>
      <Text variant="caption" tone={tone} raw={raw}>
        {label}
      </Text>
    </View>
  );
}

/** A labelled horizontal bar: the reports' only chart, readable in both themes. */
export function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const t = useTheme();
  const w = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.row}>
        <Text variant="bodyS" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="bodyS" raw>
          {String(value)}
          {suffix ?? ''}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: t.c.overlay }]}>
        <View style={[styles.fill, { width: `${w}%`, backgroundColor: t.c.text }]} />
      </View>
    </View>
  );
}

/** 2026-10-26 → 26 Oct 2026, in the app's language. */
export function shortDate(d: string | null | undefined): string {
  if (!d) return '';
  const x = new Date(`${d.slice(0, 10)}T12:00:00`);
  return Number.isNaN(x.getTime()) ? d : x.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

export const money = (n: number | null, currency: string) => (n === null ? '' : `${n.toLocaleString(dateLocale(), { maximumFractionDigits: 2 })} ${currency}`);

/** A file to save: a download on the web, the share sheet on a phone. */
export async function saveText(name: string, text: string, mime = 'text/csv'): Promise<void> {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob(['﻿', text], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ message: text, title: name });
}

export const crmStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});

const styles = StyleSheet.create({
  row: crmStyles.row,
  wrap: crmStyles.wrap,
  tag: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  track: { height: 8, borderRadius: radius.lg, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.lg },
});
