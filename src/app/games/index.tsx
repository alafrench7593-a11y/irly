import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Chip, Field, SectionHeader, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { createRoom, joinByCode, joinRoom, quickplay, useGamesOverview, useGamesPresence, useOpenRooms, useRecentGames, type RoomCard } from '@/features/games/api';
import { t as tx, useLang } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * IRLY Games: play Ludo now (or create a table), join a public table or a
 * private one with its code, find the people of your last games.
 * Loup-Garou opens later as scheduled game nights. Every number is the
 * server's.
 */
export default function GamesScreen() {
  const router = useRouter();
  const account = useAccount();
  if (!hasBackend || !account) {
    return (
      <Page title="IRLY Games" subtitle="Play together, meet in real life">
        <View style={styles.pad}>
          <Text tone="secondary">Sign in to play with other IRLY members.</Text>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }
  return <Games />;
}

const fail = (e: unknown) => toast(e instanceof Error ? e.message : 'Try again', 'x', 'live');

function Games() {
  const t = useTheme();
  const router = useRouter();
  const appSpace = useAppSpace();
  const { data } = useGamesOverview();
  const { rooms, failed, reload } = useOpenRooms('ludo');
  const recent = useRecentGames();
  const now = useNow();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  useGamesPresence();
  const ludo = data?.games.find((g) => g.game === 'ludo');
  const go = (id: string) => router.push(`/games/${id}`);

  const run = (fn: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    fn()
      .then(go)
      .catch(fail)
      .finally(() => setBusy(false));
  };

  return (
    <Page title="IRLY Games" subtitle="Play together, meet in real life">
      <View style={styles.body}>
        <View style={styles.stats}>
          <Stat icon="users" value={data?.online} label="online now" />
          <Stat icon="gamepad" value={ludo?.playing} label="games running" />
          <Stat icon="userPlus" value={ludo?.open_seats} label="free seats" />
        </View>

        <View style={[styles.game, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
          <View style={styles.gameHead}>
            <Text style={styles.emoji} raw>
              🎲
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="titleM">
                Ludo
              </Text>
              <Text variant="caption" tone="secondary">
                2 to 4 players · roll, race, capture
              </Text>
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label="Play now" icon="play" disabled={busy} onPress={() => run(() => quickplay(appSpace))} full />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="New table" icon="plus" variant="secondary" onPress={() => setCreating(true)} full />
            </View>
          </View>
        </View>

        <View style={[styles.game, { backgroundColor: t.c.surface, borderColor: t.c.line, opacity: 0.85 }]}>
          <View style={styles.gameHead}>
            <Text style={styles.emoji} raw>
              🐺
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="titleM">
                Loup-Garou
              </Text>
              <Text variant="caption" tone="secondary">
                Game nights in your communities, 6 to 20 players
              </Text>
            </View>
            <Chip label="Soon" size="sm" />
          </View>
        </View>

        <View style={styles.codeRow}>
          <View style={{ flex: 1 }}>
            <Field
              icon="lock"
              placeholder="Private game code"
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>
          <Button label="Join" size="md" disabled={code.length !== 6 || busy} onPress={() => run(() => joinByCode(code))} />
        </View>

        <SectionHeader title="Tables to join" action={failed ? 'Retry' : undefined} onAction={reload} style={styles.header} />
        {rooms === null ? (
          <Text tone="tertiary">{failed ? 'Could not load the games. Check your connection.' : 'Loading…'}</Text>
        ) : rooms.length === 0 ? (
          <Text tone="secondary">No table open right now. Tap Play now: you start one and others join you.</Text>
        ) : (
          rooms.map((r) => <RoomRow key={r.id} room={r} onOpen={() => (r.mine ? go(r.id) : run(() => joinRoom(r.id)))} />)
        )}

        {recent && recent.length > 0 ? (
          <>
            <SectionHeader title="Played recently" style={styles.header} />
            {recent.map((g) => (
              <View key={g.id} style={[styles.recent, { borderColor: t.c.line }]}>
                <Text variant="caption" tone="tertiary" raw>
                  {`🎲 Ludo · ${timeAgo((now - Date.parse(g.finished_at)) / 60_000)}`}
                </Text>
                <View style={styles.people}>
                  {(g.people ?? []).map((p) => (
                    <PressableScale key={p.id} onPress={() => router.push(`/person/${p.id}`)} accessibilityRole="button" accessibilityLabel={p.name ?? tx('A member')} style={styles.person}>
                      <Avatar name={p.name ?? '?'} hue={0} userId={p.id} size={40} />
                      <Text variant="caption" numberOfLines={1} raw>
                        {p.name ?? tx('A member')}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : null}
      </View>
      <CreateSheet visible={creating} onClose={() => setCreating(false)} onCreated={(id) => go(id)} />
    </Page>
  );
}

function Stat({ icon, value, label }: { icon: 'users' | 'gamepad' | 'userPlus'; value: number | undefined; label: string }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <Icon name={icon} size={16} color={t.c.textSecondary} />
      <Text variant="titleM" raw>
        {value === undefined ? '–' : String(value)}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

function RoomRow({ room, onOpen }: { room: RoomCard; onOpen: () => void }) {
  const t = useTheme();
  const full = room.players >= room.max;
  const label = room.mine ? 'Open' : room.status === 'playing' ? 'Playing' : full ? 'Full' : 'Join';
  return (
    <View style={[styles.room, { backgroundColor: t.c.surface, borderColor: t.c.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="titleS" numberOfLines={1} raw>
          {room.title ?? tx("{name}'s table", { name: room.host ?? tx('A member') })}
        </Text>
        <Text variant="caption" tone="secondary" raw>
          {[
            tx('{n}/{max} players', { n: room.players, max: room.max }),
            room.lang === 'fr' ? 'Français' : 'English',
            room.visibility === 'private' ? tx('Private') : tx('Public'),
            room.status === 'playing' ? tx('In progress') : tx('Waiting'),
          ].join(' · ')}
        </Text>
      </View>
      <Button label={label} size="sm" variant={room.mine ? 'primary' : 'secondary'} disabled={!room.mine && (full || room.status !== 'waiting')} onPress={onOpen} />
    </View>
  );
}

function CreateSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const lang = useLang();
  const appSpace = useAppSpace();
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [max, setMax] = useState<'2' | '3' | '4'>('4');
  const [roomLang, setRoomLang] = useState<'en' | 'fr'>(lang === 'fr' ? 'fr' : 'en');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const create = () => {
    setBusy(true);
    createRoom(appSpace, { visibility, max: Number(max), title, lang: roomLang })
      .then((r) => {
        onClose();
        onCreated(r.id);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New Ludo game">
      <View style={styles.sheet}>
        <Field placeholder="Name (optional)" value={title} onChangeText={(v) => setTitle(v.slice(0, 60))} maxLength={60} />
        <Text variant="label" tone="secondary">
          Who can join
        </Text>
        <Segmented
          options={[
            { value: 'public', label: tx('Public') },
            { value: 'private', label: tx('Private, with a code') },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
        <Text variant="label" tone="secondary">
          Players
        </Text>
        <Segmented
          options={[
            { value: '2', label: '2' },
            { value: '3', label: '3' },
            { value: '4', label: '4' },
          ]}
          value={max}
          onChange={setMax}
        />
        <Text variant="label" tone="secondary">
          Language of the table
        </Text>
        <Segmented
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ]}
          value={roomLang}
          onChange={setRoomLang}
        />
        <Button label="Create the game" icon="check" disabled={busy} onPress={create} full />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter, gap: space[5] },
  body: { paddingHorizontal: space.gutter, gap: space[5], paddingTop: space[3] },
  stats: { flexDirection: 'row', gap: space[3] },
  stat: { flex: 1, padding: space[4], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, gap: 2 },
  game: { padding: space[5], borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, gap: space[4] },
  gameHead: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  emoji: { fontSize: 36, lineHeight: 42 },
  row: { flexDirection: 'row', gap: space[3] },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  room: { flexDirection: 'row', alignItems: 'center', gap: space[4], padding: space[4], borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  recent: { gap: space[3], paddingVertical: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  people: { flexDirection: 'row', gap: space[4], flexWrap: 'wrap' },
  person: { alignItems: 'center', gap: 4, width: 64 },
  sheet: { gap: space[4], paddingBottom: space[6] },
  header: { paddingHorizontal: 0, marginTop: space[3] },
});
