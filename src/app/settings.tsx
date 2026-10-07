import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { registerPush, type PushState } from '@/features/push/push';
import { t as tx, useLang } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Safety = {
  profile_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  irl_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  activity_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  location_precision: 'area' | 'city' | 'hidden';
  show_active: boolean;
};
const DEFAULTS: Safety = { profile_visibility: 'everyone', irl_visibility: 'friends', activity_visibility: 'everyone', location_precision: 'area', show_active: false };

const GROUPS: { label: string; kinds: string[] }[] = [
  { label: 'Messages', kinds: ['MESSAGE_CREATED'] },
  { label: 'Likes', kinds: ['LIKE'] },
  { label: 'Comments and replies', kinds: ['COMMENT', 'COMMENT_REPLY', 'MENTION'] },
  { label: 'Friends', kinds: ['FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'IRLY_POST_CREATED'] },
  { label: 'Activities and events', kinds: ['ACTIVITY_JOINED', 'ACTIVITY_UPDATED', 'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER'] },
  { label: 'Communities', kinds: ['COMMUNITY_JOINED', 'COMMUNITY_INVITATION', 'COMMUNITY_POST'] },
  { label: 'IRLY Girl matches', kinds: ['MATCH_CREATED', 'MATCH_SUGGESTION'] },
  { label: 'Networking', kinds: ['PRO_CONNECT_REQUEST', 'PRO_CONNECT_ACCEPTED'] },
];

const AUDIENCE = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'friends', label: 'Friends' },
  { id: 'communities', label: 'My communities' },
  { id: 'nobody', label: 'Nobody' },
] as const;

/**
 * Privacy and notifications, stored on the server so they apply on every
 * device and are enforced there (search hides a profile set to Nobody, a
 * muted notification is never created).
 */
export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const uid = account?.userId;
  const [safety, setSafety] = useState<Safety>(DEFAULTS);
  const [muted, setMuted] = useState<string[]>([]);
  const [push, setPush] = useState(true);
  const [phone, setPhone] = useState<PushState | null>(null);
  const lang = useLang();
  // Saving before the server values arrive would write the defaults over them.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !uid) return null;
    const [s, n] = await Promise.all([
      supabase.from('safety_settings').select('profile_visibility, irl_visibility, activity_visibility, location_precision, show_active').eq('user_id', uid).maybeSingle(),
      supabase.from('notification_prefs').select('muted_kinds, push_enabled').eq('user_id', uid).maybeSingle(),
    ]);
    if (s.error || n.error) throw new Error(s.error?.message ?? n.error?.message);
    return { safety: { ...DEFAULTS, ...(s.data ?? {}) } as Safety, muted: (n.data?.muted_kinds as string[]) ?? [], push: (n.data?.push_enabled as boolean | undefined) ?? true };
  }, [uid]);

  const [failed, setFailed] = useState(false);
  const alive = useRef(true);
  // The latest values, read by queued saves so a slow save never sends a stale copy.
  const safetyNow = useRef(safety);
  const mutedNow = useRef(muted);
  // Saves run one after another, in the order they were made.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(() => {
    load()
      .then((r) => {
        if (!alive.current || !r) return;
        setFailed(false);
        safetyNow.current = r.safety;
        mutedNow.current = r.muted;
        setSafety(r.safety);
        setMuted(r.muted);
        setPush(r.push);
        setLoaded(true);
      })
      .catch(() => {
        if (!alive.current) return;
        setFailed(true);
        toast('Could not load your settings. Check your connection.', 'x', 'live');
      });
  }, [load]);

  useEffect(() => {
    alive.current = true;
    reload();
    return () => {
      alive.current = false;
    };
  }, [reload]);

  const notReady = () => {
    if (loaded) return false;
    toast(failed ? 'Your settings could not be loaded. Tap Try again' : 'Your settings are still loading', 'clock', 'brand');
    return true;
  };

  /** Queue a save of the latest state; on failure, show what the server really has. */
  const enqueue = (write: () => PromiseLike<{ error: unknown }>) => {
    queue.current = queue.current.then(async () => {
      const { error } = await write();
      if (error) {
        toast('Could not save', 'x', 'live');
        reload();
      }
    });
  };

  const saveSafety = (patch: Partial<Safety>) => {
    if (!supabase || !uid || notReady()) return;
    safetyNow.current = { ...safetyNow.current, ...patch };
    setSafety(safetyNow.current);
    enqueue(() => supabase!.from('safety_settings').upsert({ user_id: uid, ...safetyNow.current, updated_at: new Date().toISOString() }));
  };

  // Push on this account's phones; turning it on also asks this phone's permission.
  const togglePush = (on: boolean) => {
    if (!supabase || !uid || notReady()) return;
    setPush(on);
    enqueue(() => supabase!.from('notification_prefs').upsert({ user_id: uid, push_enabled: on, muted_kinds: mutedNow.current, updated_at: new Date().toISOString() }));
    if (on && Platform.OS !== 'web')
      registerPush(lang)
        .then((st) => {
          setPhone(st);
          if (st === 'denied') toast('Notifications are off for IRLY in your phone settings', 'bell', 'brand');
        })
        .catch(() => undefined);
  };

  const toggleGroup = (kinds: string[], on: boolean) => {
    if (!supabase || !uid || notReady()) return;
    const cur = mutedNow.current;
    mutedNow.current = on ? cur.filter((k) => !kinds.includes(k)) : [...new Set([...cur, ...kinds])];
    setMuted(mutedNow.current);
    enqueue(() => supabase!.from('notification_prefs').upsert({ user_id: uid, muted_kinds: mutedNow.current, updated_at: new Date().toISOString() }));
  };

  if (!account) {
    return (
      <Page overline="Profile" title="Privacy & notifications">
        <View style={styles.body}>
          <Text variant="body" tone="secondary">
            Sign in to choose who sees you and what you hear about.
          </Text>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );
  }

  return (
    <Page overline="Profile" title="Privacy & notifications" subtitle="Your exact location is never shared. At most, your neighbourhood.">
      <View style={styles.body}>
        {failed ? (
          <View style={{ gap: space[2] }}>
            <Text variant="body" tone="secondary">
              Your settings could not be loaded.
            </Text>
            <Button label="Try again" onPress={reload} />
          </View>
        ) : null}
        <Audience label="Who can find my profile" value={safety.profile_visibility} onChange={(v) => saveSafety({ profile_visibility: v })} />
        <Audience label="Who sees my IRL moments by default" value={safety.irl_visibility} onChange={(v) => saveSafety({ irl_visibility: v })} />
        <Audience label="Who sees which activities I join" value={safety.activity_visibility} onChange={(v) => saveSafety({ activity_visibility: v })} />
        <View style={{ gap: 8 }}>
          <Text variant="label">Location shown on my posts</Text>
          <View style={styles.wrap}>
            {(['area', 'city', 'hidden'] as const).map((p) => (
              <Chip key={p} size="sm" label={p === 'area' ? 'Neighbourhood' : p === 'city' ? 'City only' : 'Hidden'} selected={safety.location_precision === p} onPress={() => saveSafety({ location_precision: p })} />
            ))}
          </View>
        </View>
        <View style={[styles.group, { backgroundColor: t.c.surface }]}>
          <Row label="Show when I'm active" value={safety.show_active} onChange={(v) => saveSafety({ show_active: v })} />
        </View>

        <Text variant="titleM" style={{ marginTop: space[4] }}>
          Notifications
        </Text>
        <View style={[styles.group, { backgroundColor: t.c.surface }]}>
          <Row label="Notifications on my phone" value={push} onChange={togglePush} />
        </View>
        <Text variant="caption" tone="tertiary">
          {Platform.OS === 'web'
            ? tx('Phone notifications work in the IRLY app on iPhone and Android.')
            : phone === 'denied'
              ? tx('Notifications are off for IRLY in your phone settings.')
              : phone === 'not-configured'
                ? tx('This build of IRLY cannot receive notifications yet.')
                : tx('Messages, requests and your activities, even when IRLY is closed. Choose which below.')}
        </Text>
        <View style={[styles.group, { backgroundColor: t.c.surface }]}>
          {GROUPS.map((g, i) => (
            <View key={g.label}>
              {i ? <Divider inset={16} /> : null}
              <Row label={g.label} value={!g.kinds.every((k) => muted.includes(k))} onChange={(v) => toggleGroup(g.kinds, v)} />
            </View>
          ))}
        </View>
      </View>
    </Page>
  );
}

function Audience<V extends string>({ label, value, onChange }: { label: string; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">{label}</Text>
      <View style={styles.wrap}>
        {AUDIENCE.map((a) => (
          <Chip key={a.id} size="sm" label={a.label} selected={value === a.id} onPress={() => onChange(a.id as V)} />
        ))}
      </View>
    </View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="titleS" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
});
