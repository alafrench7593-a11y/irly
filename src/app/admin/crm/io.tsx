import { useState } from 'react';
import { View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { AdminInput, adminStyles, Card } from '@/features/admin/ui';
import { saveContact } from '@/features/crm/api';
import { contactName, CSV_COLUMNS, duplicatesOf, parseContactsCsv, toCsv, today, type Contact } from '@/features/crm/model';
import { CrmGate, CrmLoad, saveText, useCrm } from '@/features/crm/ui';
import { t as tx } from '@/i18n';

/**
 * CSV import and export of contacts. Import is pasted text (works the same
 * on a phone and a computer): every line is checked first, duplicates are
 * skipped unless you choose otherwise, and nothing is saved before you
 * confirm.
 */
export default function ImportExport() {
  return (
    <Page overline="CRM" title="Import and export" subtitle="Contacts as a CSV file, for a spreadsheet or another tool.">
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
  const [text, setText] = useState('');
  const [withDupes, setWithDupes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <CrmLoad data={data} error={error} retry={reload}>
      {(d) => {
        const live = d.contacts.filter((c) => !c.archived_at);
        const parsed = text.trim() ? parseContactsCsv(text) : [];
        const ok = parsed.filter((r) => r.contact);
        const seen: Contact[] = [...d.contacts];
        const plan = ok.map((r) => {
          const dupes = duplicatesOf(r.contact!, seen);
          seen.push({ ...(r.contact as Contact), id: `new-${r.line}` });
          return { ...r, dupe: dupes.length > 0 };
        });
        const toAdd = plan.filter((r) => withDupes || !r.dupe);
        const bad = parsed.filter((r) => r.error);

        const run = async () => {
          if (busy || !toAdd.length) return;
          setBusy(true);
          let n = 0;
          const failed: number[] = [];
          for (const r of toAdd) {
            try {
              await saveContact(r.contact!);
              n++;
            } catch {
              failed.push(r.line);
            }
          }
          setBusy(false);
          setText('');
          const imported = n === 1 ? tx('1 contact imported') : tx('{n} contacts imported', { n });
          setDone(failed.length ? `${imported}. ${tx('Lines not saved: {lines}', { lines: failed.join(', ') })}` : imported);
          toast(imported, 'check', 'brand');
          reload();
        };

        return (
          <>
            <Card>
              <Text variant="label">Export</Text>
              <Text variant="bodyS" tone="secondary" raw>
                {tx('{n} current contacts, every column, in a CSV file.', { n: live.length })}
              </Text>
              <Button
                size="sm"
                variant="secondary"
                label="Export the contacts"
                onPress={() => saveText(`irly-crm-contacts-${today()}.csv`, toCsv(live)).catch(() => toast(tx('Could not export'), 'x', 'live'))}
              />
            </Card>
            <Card>
              <Text variant="label">Import</Text>
              <Text variant="bodyS" tone="secondary">
                Paste the content of a CSV file, its first line holding the column names. Known columns:
              </Text>
              <Text variant="caption" tone="tertiary" raw selectable>
                {CSV_COLUMNS.join(', ')}
              </Text>
              <AdminInput label="CSV content" value={text} onChange={setText} placeholder="first_name,last_name,company,email" multiline max={500000} autoCapitalize="none" />
              {parsed.length ? (
                <>
                  <Text variant="bodyS" raw>
                    {tx('{ok} lines ready, {dupes} possible duplicates, {bad} refused', { ok: ok.length, dupes: plan.filter((r) => r.dupe).length, bad: bad.length })}
                  </Text>
                  {bad.slice(0, 10).map((r) => (
                    <Text key={r.line} variant="caption" tone="live" raw>
                      {tx('Line {n}: {why}', { n: r.line, why: tx(r.error!) })}
                    </Text>
                  ))}
                  {plan
                    .filter((r) => r.dupe)
                    .slice(0, 10)
                    .map((r) => (
                      <Text key={r.line} variant="caption" tone="secondary" raw>
                        {tx('Line {n}: {name} may already be in the CRM', { n: r.line, name: contactName(r.contact as Contact) })}
                      </Text>
                    ))}
                  {plan.some((r) => r.dupe) ? <Chip size="sm" label="Import possible duplicates too" selected={withDupes} onPress={() => setWithDupes(!withDupes)} /> : null}
                  <Button label={toAdd.length === 1 ? tx('Import 1 contact') : tx('Import {n} contacts', { n: toAdd.length })} raw loading={busy} disabled={!toAdd.length} onPress={run} />
                </>
              ) : null}
              {done ? (
                <Text variant="bodyS" tone="positive" raw>
                  {done}
                </Text>
              ) : null}
            </Card>
          </>
        );
      }}
    </CrmLoad>
  );
}
