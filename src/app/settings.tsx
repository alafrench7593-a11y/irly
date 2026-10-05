import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip, Divider } from '@/components/ui/Controls';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useAccount } from '@/features/auth/account';
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

  const load = useCallback(async () => {
    if (!supabase || !uid) return null;
    const [s, n] = await Promise.all([
      supabase.from('safety_settings').select('profile_visibility, irl_visibility, activity_visibility, location_precision, show_active').eq('user_id', uid).maybeSingle(),
      supabase.from('notification_prefs').select('muted_kinds').eq('user_id', uid).maybeSingle(),
    ]);
    return { safety: { ...DEFAULTS, ...(s.data ?? {}) } as Safety, muted: (n.data?.muted_kinds as string[]) ?? [] };
  }, [uid]);

  useEffect(() => {
    let alive = true;
    load().then((r) => {
      if (!alive || !r) return;
      setSafety(r.safety);
      setMuted(r.muted);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const saveSafety = async (patch: Partial<Safety>) => {
    if (!supabase || !uid) return;
    const next = { ...safety, ...patch };
    setSafety(next);
    const { error } = await supabase.from('safety_settings').upsert({ user_id: uid, ...next, updated_at: new Date().toISOString() });
    if (error) {
      setSafety(safety);
      toast('Could not save', 'x', 'live');
    }
  };

  const toggleGroup = async (kinds: string[], on: boolean) => {
    if (!supabase || !uid) return;
    const prev = muted;
    const next = on ? muted.filter((k) => !kinds.includes(k)) : [...new Set([...muted, ...kinds])];
    setMuted(next);
    const { error } = await supabase.from('notification_prefs').upsert({ user_id: uid, muted_kinds: next, updated_at: new Date().toISOString() });
    if (error) {
      setMuted(prev);
      toast('Could not save', 'x', 'live');
    }
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
