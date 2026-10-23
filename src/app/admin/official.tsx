import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { isContentStaff, loadOfficial, reorderOfficial, saveOfficialTexts, SPACE_LABEL, type OfficialTopic, type Space } from '@/features/admin/api';
import { AdminInput, adminStyles, Card, Loadable, NoAccess, useAdminRole, useLoad } from '@/features/admin/ui';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { useTheme } from '@/theme/useTheme';

const SPACES: Space[] = ['mixte', 'girl', 'mom'];

/**
 * IRLY's official communities, per space: their order in the community lists
 * and their tagline and description (every city at once). Content staff and
 * above; the server checks the list (each one once, none missing, none from
 * another space), refuses empty or too short texts and journals every change
 * with its reason. Names stay as the owner fixed them.
 */
export default function OfficialCommunities() {
  const role = useAdminRole();
  const [space, setSpace] = useState<Space>('mixte');
  const { data, error, reload } = useLoad<OfficialTopic[]>(loadOfficial, 'official');
  const saved = useMemo(() => (data ?? []).filter((x) => x.space === space).sort((a, b) => a.sort - b.sort), [data, space]);
  // The order being edited; null shows the saved one.
  const [draft, setDraft] = useState<string[] | null>(null);
  const order = draft ?? saved.map((x) => x.topic);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  if (role !== undefined && !isContentStaff(role)) {
    return (
      <Page title="Official communities">
        <View style={adminStyles.body}>
          <NoAccess />
        </View>
      </Page>
    );
  }

  const byTopic = new Map(saved.map((x) => [x.topic, x]));
  const moved = order.join(',') !== saved.map((x) => x.topic).join(',');
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setDraft(next);
  };
  const save = () => {
    if (busy) return;
    if (reason.trim().length < 3) return toast(tx('Give a reason (3 characters or more).'), 'x', 'live');
    setBusy(true);
    reorderOfficial(space, order, reason.trim())
      .then(() => {
        toast(tx('Order saved'), 'check', 'brand');
        setReason('');
        setDraft(null);
        reload();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };

  return (
    <Page title="Official communities" subtitle="Their order in the community lists and their texts, for every city. Names stay as they are.">
      <View style={adminStyles.body}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SPACES.map((s) => (
            <Chip key={s} size="sm" label={SPACE_LABEL[s]} selected={space === s} onPress={() => (busy ? null : (setSpace(s), setOpen(null), setDraft(null)))} />
          ))}
        </ScrollView>
        <Text variant="caption" tone="secondary">
          {tx('You are editing {space}.', { space: tx(SPACE_LABEL[space]) })}
        </Text>
        <Loadable data={data ? saved : null} error={error} retry={reload} empty="No official community in this space.">
          {() => (
            <>
              {order.map((topic, i) => {
                const x = byTopic.get(topic);
                if (!x) return null;
                return (
                  <Card index={i} key={topic}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text variant="titleS" style={{ flex: 1 }} raw numberOfLines={1}>
                        {i + 1}. {x.emoji ? `${x.emoji} ` : ''}
                        {x.name}
                      </Text>
                      <Arrow icon="chevronUp" label="Move up" disabled={i === 0 || busy} onPress={() => move(i, -1)} />
                      <Arrow icon="chevronDown" label="Move down" disabled={i === order.length - 1 || busy} onPress={() => move(i, 1)} />
                    </View>
                    <Text variant="caption" tone="secondary" raw>
                      {tx('{n} members', { n: x.members })}
                      {x.in_network ? ` · ${tx('Shown inside IRLY Network')}` : ''}
                    </Text>
                    {open === topic ? (
                      <Texts topic={x} onDone={() => (setOpen(null), reload())} />
                    ) : (
                      <Button size="sm" variant="ghost" label="Edit texts" onPress={() => setOpen(topic)} />
                    )}
                  </Card>
                );
              })}
              {moved ? (
                <Card>
                  <Text variant="label">Save the new order</Text>
                  <AdminInput value={reason} onChange={setReason} placeholder="Why this order (kept in the log)" label="Reason" max={300} />
                  <View style={adminStyles.row}>
                    <Button label="Save order" onPress={save} loading={busy} />
                    <Button label="Cancel" variant="ghost" onPress={() => setDraft(null)} disabled={busy} />
                  </View>
                </Card>
              ) : null}
            </>
          )}
        </Loadable>
      </View>
    </Page>
  );
}

function Arrow({ icon, label, disabled, onPress }: { icon: 'chevronUp' | 'chevronDown'; label: string; disabled: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <PressableScale onPress={disabled ? undefined : onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={20} color={disabled ? t.c.textTertiary : t.c.text} />
    </PressableScale>
  );
}

function Texts({ topic, onDone }: { topic: OfficialTopic; onDone: () => void }) {
  const [tagline, setTagline] = useState(topic.tagline ?? '');
  const [description, setDescription] = useState(topic.description ?? '');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const save = () => {
    if (busy) return;
    if (description.trim().length < 20) return toast(tx('A description has 20 to 1500 characters.'), 'x', 'live');
    if (reason.trim().length < 3) return toast(tx('Give a reason (3 characters or more).'), 'x', 'live');
    setBusy(true);
    saveOfficialTexts(topic.topic, tagline.trim(), description.trim(), reason.trim())
      .then(() => {
        toast(tx('Texts saved for every city'), 'check', 'brand');
        onDone();
      })
      .catch((e) => toast(tx(e instanceof Error ? e.message : 'Could not save'), 'x', 'live'))
      .finally(() => setBusy(false));
  };
  return (
    <View style={{ gap: 8 }}>
      <AdminInput value={tagline} onChange={setTagline} placeholder="Tagline (one line)" label="Tagline" max={140} />
      <AdminInput value={description} onChange={setDescription} placeholder="Description" label="Description" multiline max={1500} />
      <AdminInput value={reason} onChange={setReason} placeholder="Why this change (kept in the log)" label="Reason" max={300} />
      <Text variant="caption" tone="tertiary">
        The new texts show as written, in every language.
      </Text>
      <View style={adminStyles.row}>
        <Button size="sm" label="Save texts" onPress={save} loading={busy} />
        <Button size="sm" variant="ghost" label="Cancel" onPress={onDone} disabled={busy} />
      </View>
    </View>
  );
}
