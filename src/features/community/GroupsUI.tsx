import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { a11y, t as tx } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { hueOf } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { haptic } from '@/motion/haptics';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import {
  addChannel,
  announce,
  communityPeople,
  deleteChannel,
  renameChannel,
  setCommunityPrefs,
  setRole,
  type Channel,
  type CommunityPrefs,
  type Person,
  type Rights,
} from './groups';
import { GlassLayer } from '@/components/ui/GlassLayer';

/** Notifications for this community: its posts, its announcements. */
export function NotifyPrefs({ communityId, prefs, onChanged }: { communityId: string; prefs: CommunityPrefs; onChanged: () => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(prefs);
  const save = (next: CommunityPrefs) => {
    setValue(next);
    setCommunityPrefs(communityId, next)
      .then(onChanged)
      .catch((e) => {
        setValue(value);
        toast(e instanceof Error ? e.message : 'Could not save', 'x', 'live');
      });
  };
  const off = !prefs.posts || !prefs.announcements || !prefs.activities;
  return (
    <>
      <Button
        label={off ? 'Notifications: custom' : 'Notifications'}
        icon={off ? 'bellOff' : 'bell'}
        variant="ghost"
        size="sm"
        onPress={() => {
          setValue(prefs);
          setOpen(true);
        }}
      />
      <Sheet visible={open} onClose={() => setOpen(false)} title="Notifications" subtitle="For this community only. Your other settings stay as they are.">
        <View style={{ paddingHorizontal: space.gutter, gap: space[3], paddingBottom: space[4] }}>
          {(
            [
              ['posts', 'New posts', 'Someone posts in this community.'],
              ['announcements', 'Announcements', 'Important news from its hosts (at most 3 a day).'],
              ['activities', 'New activities', 'A member proposes an activity in this community.'],
            ] as const
          ).map(([key, title, body]) => (
            <View key={key} style={[styles.toggle, { backgroundColor: 'transparent', overflow: 'hidden' }]}>
              <GlassLayer radius={radius.xl} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS">{title}</Text>
                <Text variant="bodyS" tone="secondary">
                  {body}
                </Text>
              </View>
              <Switch
                value={value[key]}
                onValueChange={(v) => save({ ...value, [key]: v })}
                trackColor={{ true: t.c.brand, false: t.c.overlay }}
                thumbColor="#FFFFFF"
                accessibilityLabel={a11y(title)}
              />
            </View>
          ))}
        </View>
      </Sheet>
    </>
  );
}

/** Hosts' tools: notify every member, name moderators. */
export function HostTools({ communityId, name, rights, onChanged }: { communityId: string; name: string; rights: Rights; onChanged: () => void }) {
  const t = useTheme();
  const [sheet, setSheet] = useState<'announce' | 'people' | null>(null);
  if (!rights.canModerate) return null;
  return (
    <View style={[styles.pad, styles.tools, { backgroundColor: 'transparent', overflow: 'hidden', borderColor: 'transparent' }]}>
      <GlassLayer radius={radius.xl} />
      <View style={styles.row}>
        <Icon name="shield" size={16} color={t.c.text} />
        <Text variant="titleS" style={{ flex: 1 }}>
          {rights.isAdmin ? 'IRLY admin tools' : 'Host tools'}
        </Text>
      </View>
      <View style={styles.wrap}>
        <Chip size="sm" icon="megaphone" label={tx('Notify all members')} onPress={() => setSheet('announce')} />
        {rights.isOwner ? <Chip size="sm" icon="users" label={tx('Moderators')} onPress={() => setSheet('people')} /> : null}
      </View>
      <AnnounceSheet visible={sheet === 'announce'} communityId={communityId} name={name} rights={rights} onClose={() => setSheet(null)} onSent={onChanged} />
      <PeopleSheet visible={sheet === 'people'} communityId={communityId} onClose={() => setSheet(null)} />
    </View>
  );
}

function AnnounceSheet({ visible, communityId, name, rights, onClose, onSent }: { visible: boolean; communityId: string; name: string; rights: Rights; onClose: () => void; onSent: () => void }) {
  const t = useTheme();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'announcement' | 'event' | 'info'>('announcement');
  const [pin, setPin] = useState(true);
  const [busy, setBusy] = useState(false);
  const now = useNow();
  const waitMin = rights.nextAnnouncementAt ? Math.max(0, Math.ceil((rights.nextAnnouncementAt - now) / 60000)) : 0;
  const blocked = rights.announcementsToday >= 3 || waitMin > 0;
  const send = async () => {
    if (busy || body.trim().length < 3) return;
    setBusy(true);
    try {
      const n = await announce(communityId, body, kind, pin);
      haptic('success');
      toast(tx('Sent to {n} members', { n }), 'megaphone', 'brand');
      setBody('');
      onSent();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Notify all members" subtitle={tx('A push and an in-app notification to every member of {name}, who can turn these off.', { name })} scroll>
      <View style={{ paddingHorizontal: space.gutter, gap: space[4], paddingBottom: space[2] }}>
        <View style={styles.wrap}>
          <Chip size="sm" label={tx('Announcement')} selected={kind === 'announcement'} onPress={() => setKind('announcement')} />
          <Chip size="sm" label={tx('Event')} selected={kind === 'event'} onPress={() => setKind('event')} />
          <Chip size="sm" label={tx('Practical info')} selected={kind === 'info'} onPress={() => setKind('info')} />
        </View>
        <TextInput
          value={body}
          onChangeText={(v) => setBody(v.slice(0, 500))}
          multiline
          placeholder={tx('What should everyone know?')}
          placeholderTextColor={t.c.textTertiary}
          style={[styles.input, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('Announcement')}
        />
        <Chip size="sm" icon="pinPost" label={tx('Pin it at the top')} selected={pin} onPress={() => setPin(!pin)} />
        <Text variant="caption" tone="tertiary">
          {blocked
            ? waitMin > 0
              ? tx('Next announcement possible in {n} min.', { n: waitMin })
              : tx('Three announcements a day at most: try again tomorrow.')
            : tx('At most 3 a day, one per hour, never the same text twice in a week. Sent today: {n}.', { n: rights.announcementsToday })}
        </Text>
        <Button label="Send to everyone" icon="megaphone" full loading={busy} disabled={blocked || body.trim().length < 3} onPress={send} />
      </View>
    </Sheet>
  );
}

function PeopleSheet({ visible, communityId, onClose }: { visible: boolean; communityId: string; onClose: () => void }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = (q: string) =>
    communityPeople(communityId, q)
      .then(setPeople)
      .catch((e) => toast(e instanceof Error ? e.message : 'Could not load', 'x', 'live'));
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setPeople(null);
        onClose();
      }}
      title="Moderators"
      subtitle="Moderators can remove posts, pin them and notify all members."
    >
      <View style={{ flexShrink: 1, paddingHorizontal: space.gutter, gap: space[3], paddingBottom: space[2] }}>
        <TextInput
          value={query}
          onChangeText={(v) => {
            setQuery(v);
            load(v.trim());
          }}
          onFocus={() => people === null && load('')}
          placeholder={tx('Search a member')}
          autoCorrect={false}
          returnKeyType="search"
          placeholderTextColor={t.c.textTertiary}
          style={[styles.line, { color: t.c.text, backgroundColor: t.c.overlay }]}
          accessibilityLabel={a11y('Search a member')}
        />
        {people === null ? <Button label="Show members" variant="secondary" onPress={() => load('')} /> : null}
        <ScrollView style={{ maxHeight: 360, flexShrink: 1 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {(people ?? []).map((p) => (
            <View key={p.userId} style={[styles.row, { paddingVertical: 4 }]}>
              <Avatar name={p.firstName} hue={hueOf(p.userId)} size={36} userId={p.userId} />
              <View style={{ flex: 1 }}>
                <Text variant="titleS" raw numberOfLines={1}>
                  {p.firstName}
                </Text>
                <Text variant="caption" tone="tertiary">
                  {p.role === 'owner' ? tx('Owner') : p.role === 'moderator' ? tx('Moderator') : tx('Member')}
                </Text>
              </View>
              {p.role === 'owner' ? null : (
                <Button
                  label={p.role === 'moderator' ? 'Remove' : 'Make moderator'}
                  size="sm"
                  variant="secondary"
                  loading={busy === p.userId}
                  onPress={() => {
                    setBusy(p.userId);
                    const next = p.role === 'moderator' ? 'member' : 'moderator';
                    setRole(communityId, p.userId, next)
                      .then(() => setPeople((list) => (list ?? []).map((x) => (x.userId === p.userId ? { ...x, role: next } : x))))
                      .catch((e) => toast(e instanceof Error ? e.message : 'Could not change the role', 'x', 'live'))
                      .finally(() => setBusy(null));
                  }}
                />
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    </Sheet>
  );
}

/* ───────── Discussion spaces: General + the community's categories ───────── */

/** "General · Good deals · Questions" chips above the posts; hosts can manage them. */
export function SpaceChips({
  channels,
  value,
  onChange,
  canManage,
  communityId,
}: {
  channels: Channel[];
  value: string | null;
  onChange: (slug: string | null) => void;
  canManage: boolean;
  communityId: string;
}) {
  const [open, setOpen] = useState(false);
  if (!channels.length && !canManage) return null;
  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.gutter, gap: 8 }}>
        <Chip size="sm" label={tx('General')} selected={value === null} onPress={() => onChange(null)} />
        {channels.map((c) => (
          <Chip key={c.id} size="sm" label={c.name} selected={value === c.slug} onPress={() => onChange(c.slug)} />
        ))}
        {canManage ? <Chip size="sm" icon="settings" label={tx('Categories')} onPress={() => setOpen(true)} /> : null}
      </ScrollView>
      {canManage ? <ChannelsSheet visible={open} communityId={communityId} channels={channels} onClose={() => setOpen(false)} onRemoved={(slug) => value === slug && onChange(null)} /> : null}
    </>
  );
}

function ChannelsSheet({ visible, communityId, channels, onClose, onRemoved }: { visible: boolean; communityId: string; channels: Channel[]; onClose: () => void; onRemoved: (slug: string) => void }) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  /** True once saved: the sheet only moves on (closes the row, clears the name, leaves the category) on success. */
  const run = async (key: string, action: () => Promise<void>, done: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(key);
    try {
      await action();
      haptic('success');
      toast(tx(done), 'check', 'brand');
      return true;
    } catch (e) {
      toast(e instanceof Error ? tx(e.message) : tx('Could not save'), 'x', 'live');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const input = [styles.line, { color: t.c.text, backgroundColor: t.c.overlay }];
  return (
    <Sheet visible={visible} onClose={onClose} title="Categories" subtitle="Themes inside this community (not groups): members choose one when they post. General always stays." scroll>
      <View style={{ paddingHorizontal: space.gutter, gap: space[3], paddingBottom: space[2] }}>
        {channels.map((c) =>
          edit?.id === c.id ? (
            <View key={c.id} style={styles.row}>
              <TextInput value={edit.name} onChangeText={(v) => setEdit({ id: c.id, name: v.slice(0, 40) })} style={[input, { flex: 1 }]} accessibilityLabel={a11y('Category name')} />
              <Button
                label="Save"
                size="sm"
                loading={busy === `r${c.id}`}
                onPress={() => run(`r${c.id}`, () => renameChannel(c.id, edit.name), 'Category renamed').then((ok) => ok && setEdit(null))}
              />
            </View>
          ) : (
            <View key={c.id} style={styles.row}>
              <Text variant="titleS" style={{ flex: 1 }} raw>
                {c.name}
              </Text>
              <Chip size="sm" icon="edit" label={tx('Rename')} onPress={() => setEdit({ id: c.id, name: c.name })} />
              <Chip
                size="sm"
                icon="x"
                label={tx('Delete')}
                onPress={() =>
                  confirm(tx('Delete this category? Its posts move to General.'), () => run(`d${c.id}`, () => deleteChannel(c.id), 'Category deleted').then((ok) => ok && onRemoved(c.slug)))
                }
              />
            </View>
          ),
        )}
        <TextInput
          value={name}
          onChangeText={(v) => setName(v.slice(0, 40))}
          placeholder={tx('Questions & advice, Good deals, Restaurants…')}
          placeholderTextColor={t.c.textTertiary}
          style={input}
          accessibilityLabel={a11y('New category')}
        />
        <Button
          label="Add the category"
          icon="plus"
          full
          loading={busy === 'add'}
          disabled={name.trim().length < 2}
          onPress={() => run('add', () => addChannel(communityId, name), 'Category added').then((ok) => ok && setName(''))}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  parent: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  group: { width: 168, padding: 14, gap: 6, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  tools: { marginHorizontal: space.gutter, paddingVertical: 14, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, gap: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.xl },
  input: { minHeight: 110, borderRadius: radius.lg, padding: 14, fontFamily: font.medium, fontSize: 16, textAlignVertical: 'top' },
  line: { height: 48, borderRadius: radius.lg, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 16 },
});
