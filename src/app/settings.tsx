import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { isModerator, useStaffRole } from '@/features/admin/api';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
import { phonePermission, registerPush, type PushState } from '@/features/push/push';
import { t as tx, useLang, a11y } from '@/i18n';
import { changed } from '@/features/server/sync';
import { supabase } from '@/lib/supabase';
import { useAppSpace } from '@/state/appSpace';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { GirlHeaderMark } from '@/features/girl/GirlMark';
import { enter } from '@/motion/enter';
import { SpaceFlavor } from '@/theme/space';

type Safety = {
  profile_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  irl_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  activity_visibility: 'everyone' | 'friends' | 'communities' | 'nobody';
  location_precision: 'area' | 'city' | 'hidden';
  show_active: boolean;
};
/** Appearing on the map (IRLY, IRLY Girl): off until the member turns it on. Read apart, so an older server never blocks the page. */
type MapVisibility = { map_visible: boolean; map_visible_girl: boolean };
const DEFAULTS: Safety = { profile_visibility: 'everyone', irl_visibility: 'friends', activity_visibility: 'everyone', location_precision: 'area', show_active: false };

const GROUPS: { label: string; kinds: string[] }[] = [
  { label: 'Messages', kinds: ['MESSAGE_CREATED', 'GROUP_ADDED'] },
  { label: 'Likes', kinds: ['LIKE'] },
  { label: 'Comments and replies', kinds: ['COMMENT', 'COMMENT_REPLY', 'MENTION'] },
  { label: 'Friends and followers', kinds: ['FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'IRLY_POST_CREATED', 'NEW_FOLLOWER'] },
  { label: 'Activities and events', kinds: ['ACTIVITY_JOINED', 'ACTIVITY_UPDATED', 'ACTIVITY_INVITATION', 'ACTIVITY_REMINDER'] },
  { label: 'Communities', kinds: ['COMMUNITY_JOINED', 'COMMUNITY_INVITATION', 'COMMUNITY_POST', 'COMMUNITY_ANNOUNCEMENT'] },
  { label: 'IRLY Girl matches', kinds: ['MATCH_CREATED', 'MATCH_SUGGESTION', 'MATCH_REMOVED'] },
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
export default function SettingsRoute() {
  // Opened from IRLY Girl, the page wears the Girl look (cosmetic only, see theme/space).
  return (
    <SpaceFlavor>
      <SettingsScreen />
    </SpaceFlavor>
  );
}

function SettingsScreen() {
  const t = useTheme();
  // The IRLY Girl mark in the header when the page is opened from IRLY Girl.
  const mark = t.flavor === 'girl' ? <GirlHeaderMark size={14} /> : undefined;
  const staff = isModerator(useStaffRole());
  const router = useRouter();
  const account = useAccount();
  const uid = account?.userId;
  const [safety, setSafety] = useState<Safety>(DEFAULTS);
  const [mapVis, setMapVis] = useState<MapVisibility | null>(null);
  const girlSpace = useAppSpace() === 'girl';
  const [muted, setMuted] = useState<string[]>([]);
  const [push, setPush] = useState(true);
  const [previews, setPreviews] = useState(true);
  const [phone, setPhone] = useState<PushState | null>(null);
  const lang = useLang();
  // Saving before the server values arrive would write the defaults over them.
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !uid) return null;
    const [s, n] = await Promise.all([
      supabase.from('safety_settings').select('profile_visibility, irl_visibility, activity_visibility, location_precision, show_active').eq('user_id', uid).maybeSingle(),
      supabase.from('notification_prefs').select('muted_kinds, push_enabled, push_previews').eq('user_id', uid).maybeSingle(),
    ]);
    if (s.error || n.error) throw new Error(s.error?.message ?? n.error?.message);
    // Without these columns (server not updated yet) the map rows are simply not shown.
    const m = await supabase.from('safety_settings').select('map_visible, map_visible_girl').eq('user_id', uid).maybeSingle();
    const map: MapVisibility | null = m.error ? null : { map_visible: Boolean(m.data?.map_visible), map_visible_girl: Boolean(m.data?.map_visible_girl) };
    return { map, safety: { ...DEFAULTS, ...(s.data ?? {}) } as Safety, muted: (n.data?.muted_kinds as string[]) ?? [], push: (n.data?.push_enabled as boolean | undefined) ?? true, previews: (n.data?.push_previews as boolean | undefined) ?? true };
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
        setMapVis(r.map);
        setMuted(r.muted);
        setPush(r.push);
        setPreviews(r.previews);
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

  // What the phone itself allows: blocked in iOS Settings shows here, not as an error.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    phonePermission()
      .then((p) => setPhone(p === 'granted' ? 'on' : p === 'denied' ? 'denied' : p === 'unsupported' ? 'unsupported' : null))
      .catch(() => undefined);
  }, []);

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

  /**
   * Appear on the map, at neighbourhood level only. Turning it on needs the
   * location allowed on this device and « Neighbourhood » above (the server
   * shows nobody whose location is « City only » or « Hidden »).
   */
  const toggleMap = async (key: keyof MapVisibility, on: boolean) => {
    if (!supabase || !uid || notReady() || !mapVis) return;
    if (on) {
      if (safetyNow.current.location_precision !== 'area') {
        toast('Choose « Neighbourhood » for your location to appear on the map', 'pin', 'brand');
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      if (perm?.status !== 'granted') {
        toast('Allow location for IRLY to appear on the map', 'pin', 'brand');
        return;
      }
    }
    setMapVis((v) => (v ? { ...v, [key]: on } : v));
    enqueue(async () => {
      const res = await supabase!.from('safety_settings').upsert({ user_id: uid, [key]: on, updated_at: new Date().toISOString() });
      // The map (here and on the member's other screens) follows at once.
      if (!res.error) changed('people');
      return res;
    });
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

  // Message pushes with or without the text (who wrote is always shown).
  const togglePreviews = (on: boolean) => {
    if (!supabase || !uid || notReady()) return;
    setPreviews(on);
    enqueue(() => supabase!.from('notification_prefs').upsert({ user_id: uid, push_previews: on, muted_kinds: mutedNow.current, updated_at: new Date().toISOString() }));
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
      <Page overline="Profile" title="Privacy & notifications" right={mark}>
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
    <Page overline="Profile" title="Privacy & notifications" subtitle="Your exact location is never shared. At most, your neighbourhood." right={mark}>
      <View style={styles.body}>
        {failed ? (
          <View style={{ gap: space[2] }}>
            <Text variant="body" tone="secondary">
              Your settings could not be loaded.
            </Text>
            <Button label="Try again" onPress={reload} />
          </View>
        ) : null}
        <Animated.View entering={enter.rise(0, 60)} style={{ gap: 8 }}>
          <Button label="Verify my profile (for Match)" icon="shield" variant="secondary" full onPress={() => router.push('/verify')} />
          {staff ? <Button label="IRLY back office" icon="shield" variant="ghost" full onPress={() => router.push('/admin')} /> : null}
        </Animated.View>
        <Audience index={1} label="Who can find my profile" value={safety.profile_visibility} onChange={(v) => saveSafety({ profile_visibility: v })} />
        <Audience index={2} label="Who sees my IRL moments by default" value={safety.irl_visibility} onChange={(v) => saveSafety({ irl_visibility: v })} />
        <Audience index={3} label="Who sees which activities I join" value={safety.activity_visibility} onChange={(v) => saveSafety({ activity_visibility: v })} />
        <Animated.View entering={enter.rise(4, 60)} style={{ gap: 8 }}>
          <Text variant="label">Location shown on my posts</Text>
          <View style={styles.wrap}>
            {(['area', 'city', 'hidden'] as const).map((p) => (
              <Chip key={p} size="sm" label={p === 'area' ? 'Neighbourhood' : p === 'city' ? 'City only' : 'Hidden'} selected={safety.location_precision === p} onPress={() => saveSafety({ location_precision: p })} />
            ))}
          </View>
        </Animated.View>
        {mapVis ? (
          <Animated.View entering={enter.rise(5, 60)} style={{ gap: 8 }}>
            <View style={styles.group}>
              <GlassLayer radius={radius.xl} />
              <Row label="Show me on the IRLY map" value={mapVis.map_visible} onChange={(v) => toggleMap('map_visible', v)} />
              {girlSpace ? (
                <>
                  <Divider inset={16} />
                  <Row label="Show me on the IRLY Girl map" value={mapVis.map_visible_girl} onChange={(v) => toggleMap('map_visible_girl', v)} />
                </>
              ) : null}
            </View>
            <Text variant="caption" tone="secondary">
              Off unless you turn it on. Only your neighbourhood is shown, never your exact position, and only to members your profile settings allow.
            </Text>
          </Animated.View>
        ) : null}
        <Animated.View entering={enter.rise(5, 60)} style={styles.group}>
          <GlassLayer radius={radius.xl} />
          <Row label="Show when I'm active" value={safety.show_active} onChange={(v) => saveSafety({ show_active: v })} />
        </Animated.View>

        <Animated.View entering={enter.rise(6, 60)} style={{ marginTop: space[4] }}>
          <Text variant="titleM">Notifications</Text>
        </Animated.View>
        <Animated.View entering={enter.rise(7, 60)} style={styles.group}>
          <GlassLayer radius={radius.xl} />
          <Row label="Notifications on my phone" value={push} onChange={togglePush} />
          <Divider inset={16} />
          <Row label="Show message previews" value={previews} onChange={togglePreviews} />
        </Animated.View>
        <Text variant="caption" tone="tertiary">
          {Platform.OS === 'web'
            ? tx('Phone notifications work in the IRLY app on iPhone and Android.')
            : phone === 'denied'
              ? tx('Notifications are off for IRLY in your phone settings.')
              : phone === 'not-configured'
                ? tx("This version of IRLY can't receive notifications yet.")
                : tx('Messages, requests and your activities, even when IRLY is closed. Choose which below.')}
        </Text>
        <Animated.View entering={enter.rise(8, 60)} style={styles.group}>
          <GlassLayer radius={radius.xl} />
          {GROUPS.map((g, i) => (
            <View key={g.label}>
              {i ? <Divider inset={16} /> : null}
              <Row label={g.label} value={!g.kinds.every((k) => muted.includes(k))} onChange={(v) => toggleGroup(g.kinds, v)} />
            </View>
          ))}
        </Animated.View>
      </View>
    </Page>
  );
}

function Audience<V extends string>({ index, label, value, onChange }: { index: number; label: string; value: V; onChange: (v: V) => void }) {
  return (
    <Animated.View entering={enter.rise(index, 60)} style={{ gap: 8 }}>
      <Text variant="label">{label}</Text>
      <View style={styles.wrap}>
        {AUDIENCE.map((a) => (
          <Chip key={a.id} size="sm" label={a.label} selected={value === a.id} onPress={() => onChange(a.id as V)} />
        ))}
      </View>
    </Animated.View>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="titleS" style={{ flex: 1 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel={a11y(label)} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  group: { borderRadius: radius.xl, overflow: 'hidden', backgroundColor: 'transparent' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
});
