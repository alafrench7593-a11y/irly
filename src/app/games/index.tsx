import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Field, SectionHeader, Segmented } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { createRoom, joinByCode, joinRoom, quickplay, useGamesOverview, useGamesPresence, useOpenRooms, useRecentGames, type RoomCard } from '@/features/games/api';
import { CARD_ORDER, cardOf } from '@/features/games/werewolf/cards';
import { wwCreate, wwTraining } from '@/features/games/werewolf/api';
import { t as tx, useLang } from '@/i18n';
import { hasBackend } from '@/lib/supabase';
import { timeAgo } from '@/lib/time';
import { useNow } from '@/lib/useNow';
import { PressableScale } from '@/motion/PressableScale';
import { useAppSpace } from '@/state/appSpace';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * IRLY Games: play Ludo now (or create a table), Loup-Garou online, in
 * person or in training against AI players, join a public table or a
 * private one with its code, find the people of your last games. Every
 * number is the server's.
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
  const { rooms: wwRooms } = useOpenRooms('werewolf');
  const [training, setTraining] = useState(false);
  const [wwCreating, setWwCreating] = useState(false);
  const recent = useRecentGames();
  const now = useNow();
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  useGamesPresence();
  const ludo = data?.games.find((g) => g.game === 'ludo');
  const wolves = data?.games.find((g) => g.game === 'werewolf');
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

        <View style={[styles.game, { backgroundColor: '#140F24', borderColor: '#3B2E63' }]}>
          <View style={styles.gameHead}>
            <Text style={styles.emoji} raw>
              🐺
            </Text>
            <View style={{ flex: 1 }}>
              <Text variant="titleM" color="#FFFFFF">
                Loup-Garou
              </Text>
              <Text variant="caption" color="#C9C2E8">
                Classic mode · 6 to 20 players · unranked
              </Text>
            </View>
          </View>
          <Button label="Train against AI players" icon="sparkles" onPress={() => setTraining(true)} full />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button label="Play online" icon="play" variant="secondary" disabled={busy} onPress={() => run(() => quickplay(appSpace, 'werewolf'))} full />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="New table" icon="plus" variant="secondary" onPress={() => setWwCreating(true)} full />
            </View>
          </View>
          {wolves ? (
            <Text variant="caption" color="#C9C2E8" raw>
              {[wolves.waiting ? tx('{n} games to join', { n: wolves.waiting }) : null, wolves.in_game ? tx('{n} playing now', { n: wolves.in_game }) : null].filter(Boolean).join(' · ') ||
                tx('No table yet: start one, or train while others arrive')}
            </Text>
          ) : null}
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

        {wwRooms && wwRooms.length > 0 ? (
          <>
            <SectionHeader title="Loup-Garou tables" style={styles.header} />
            {wwRooms.map((r) => (
              <RoomRow key={r.id} room={r} onOpen={() => (r.mine ? go(r.id) : run(() => joinRoom(r.id)))} />
            ))}
          </>
        ) : null}
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
      <TrainingSheet visible={training} onClose={() => setTraining(false)} onCreated={(id) => go(id)} />
      <WerewolfTableSheet visible={wwCreating} onClose={() => setWwCreating(false)} onCreated={(id) => go(id)} />
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
          {(room.game === 'werewolf' ? '🐺 ' : '') + (room.title ?? tx("{name}'s table", { name: room.host ?? tx('A member') }))}
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

/** Training against AI players (V3 §11): size, the role she plays, the difficulty. Never ranked. */
function TrainingSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const appSpace = useAppSpace();
  const [size, setSize] = useState<'6' | '8' | '10' | '12'>('8');
  const [role, setRole] = useState<string>('random');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'expert'>('intermediate');
  const [busy, setBusy] = useState(false);
  const start = () => {
    setBusy(true);
    wwTraining(appSpace, Number(size), role === 'random' ? null : role, difficulty)
      .then((id) => {
        onClose();
        onCreated(id);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="Train against AI players" subtitle="Learn to unmask the werewolves, try the powers, at your own pace.">
      <View style={styles.sheet}>
        <Text variant="caption" tone="tertiary">
          Training · unranked: never counted in the ranking.
        </Text>
        <Text variant="label" tone="secondary">
          Players
        </Text>
        <Segmented
          options={[
            { value: '6', label: '6' },
            { value: '8', label: '8' },
            { value: '10', label: '10' },
            { value: '12', label: '12' },
          ]}
          value={size}
          onChange={setSize}
        />
        <Text variant="label" tone="secondary">
          Difficulty
        </Text>
        <Segmented
          options={[
            { value: 'beginner', label: tx('Beginner') },
            { value: 'intermediate', label: tx('Intermediate') },
            { value: 'expert', label: tx('Expert') },
          ]}
          value={difficulty}
          onChange={setDifficulty}
        />
        <Text variant="label" tone="secondary">
          Your role
        </Text>
        <View style={styles.roles}>
          {['random', ...CARD_ORDER].map((id) => (
            <Button
              key={id}
              label={id === 'random' ? `🎲 ${tx('Random')}` : `${cardOf(id).emoji} ${tx(cardOf(id).name)}`}
              size="sm"
              variant={role === id ? 'primary' : 'secondary'}
              onPress={() => setRole(id)}
            />
          ))}
        </View>
        <Button label="Start" icon="play" disabled={busy} onPress={start} full />
      </View>
    </Sheet>
  );
}

/** A Loup-Garou table: online (public or with a code) or in person (QR code, no game master). */
function WerewolfTableSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const lang = useLang();
  const appSpace = useAppSpace();
  const [kind, setKind] = useState<'online' | 'irl'>('online');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [size, setSize] = useState<'8' | '10' | '12' | '20'>('10');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const create = () => {
    setBusy(true);
    wwCreate(appSpace, { kind, visibility, size: Number(size), title, lang: lang === 'fr' ? 'fr' : 'en' })
      .then((r) => {
        onClose();
        onCreated(r.id);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New Loup-Garou table">
      <View style={styles.sheet}>
        <Field placeholder="Name (optional)" value={title} onChangeText={(v) => setTitle(v.slice(0, 60))} maxLength={60} />
        <Segmented
          options={[
            { value: 'online', label: tx('Online') },
            { value: 'irl', label: tx('In person (QR code)') },
          ]}
          value={kind}
          onChange={setKind}
        />
        {kind === 'online' ? (
          <Segmented
            options={[
              { value: 'public', label: tx('Public') },
              { value: 'private', label: tx('Private, with a code') },
            ]}
            value={visibility}
            onChange={setVisibility}
          />
        ) : (
          <Text variant="caption" tone="tertiary">
            In person: everyone scans the QR code, gets a secret card on their phone and votes there. No game master needed.
          </Text>
        )}
        <Text variant="label" tone="secondary">
          Up to
        </Text>
        <Segmented
          options={[
            { value: '8', label: '8' },
            { value: '10', label: '10' },
            { value: '12', label: '12' },
            { value: '20', label: '20' },
          ]}
          value={size}
          onChange={setSize}
        />
        <Text variant="caption" tone="tertiary">
          The game starts from 6 players. Unranked.
        </Text>
        <Button label="Create the table" icon="check" disabled={busy} onPress={create} full />
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
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
