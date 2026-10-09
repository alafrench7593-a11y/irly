import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Page } from '@/components/layout/Page';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Photo } from '@/components/visual/Photo';
import { useAccount } from '@/features/auth/account';
import { pickPhoto, uploadCover } from '@/features/server/covers';
import { createGroup } from '@/features/server/groups';
import { useSignedLinks } from '@/features/server/media';
import { a11y, t as tx } from '@/i18n';
import { hueOf } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { enter } from '@/motion/enter';
import { haptic } from '@/motion/haptics';
import { PressableScale } from '@/motion/PressableScale';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Candidate = { id: string; first_name: string; photo_path: string | null };

/**
 * New group: a name, an optional photo, and people you may add (friends,
 * people you follow or who follow you, people you talk to, as long as they
 * accept your messages; the server checks it again).
 */
export default function NewGroup() {
  const t = useTheme();
  const router = useRouter();
  const uid = useAccount()?.userId;
  const [people, setPeople] = useState<{ for: string; list: Candidate[]; error: string | null }>({ for: '', list: [], error: null });
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const faces = useSignedLinks('profile-photos', people.list.map((p) => p.photo_path));

  useEffect(() => {
    if (!supabase || !uid) return;
    let alive = true;
    supabase.rpc('group_candidates').then(({ data, error }) => alive && setPeople({ for: uid, list: (data as Candidate[] | null) ?? [], error: error?.message ?? null }));
    return () => {
      alive = false;
    };
  }, [uid]);

  const toggle = (id: string) => {
    haptic('select');
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  const create = async () => {
    if (!name.trim()) return toast('Give the group a name', 'x', 'live');
    if (!picked.length) return toast('Add at least one person', 'x', 'live');
    setBusy(true);
    try {
      const path = photo ? await uploadCover(photo) : null;
      const id = await createGroup(name, picked, path);
      haptic('success');
      router.replace(`/messages/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the group', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  if (!uid)
    return (
      <Page title="New group">
        <View style={{ padding: space.gutter, gap: 12 }}>
          <Text variant="body" tone="secondary">
            Sign in to create a group.
          </Text>
          <Button label="Sign in" onPress={() => router.push('/account')} />
        </View>
      </Page>
    );

  const loading = people.for !== uid;
  return (
    <Page title="New group" subtitle="A chat of its own, with a name and a photo.">
      <View style={styles.pad}>
        <View style={styles.head}>
          <PressableScale
            haptic="select"
            scaleTo={0.94}
            onPress={() => pickPhoto().then((u) => u && setPhoto(u)).catch(() => toast('Could not open your photos', 'x', 'live'))}
            style={[styles.photo, { backgroundColor: t.c.overlay }]}
            accessibilityLabel={photo ? 'Change the group photo' : 'Add a group photo'}
          >
            {photo ? <Photo visual={{ photo: 'meeting', uri: photo }} light="dubai" width={200} style={StyleSheet.absoluteFill} /> : <Icon name="camera" size={22} color={t.c.textSecondary} />}
          </PressableScale>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={60}
            placeholder={tx('Group name')}
            placeholderTextColor={t.c.textTertiary}
            style={[styles.name, { color: t.c.text, borderColor: t.c.line, backgroundColor: t.c.surface }]}
            accessibilityLabel={a11y('Group name')}
          />
        </View>
        <Text variant="overline" tone="tertiary" style={{ marginTop: space[6] }}>
          {tx('People · {n} chosen', { n: picked.length })}
        </Text>
      </View>
      <View style={[styles.pad, { gap: 2 }]}>
        {loading ? (
          <ActivityIndicator color={t.c.text} style={{ marginTop: space[5] }} />
        ) : people.error ? (
          <Text variant="body" tone="secondary">
            {people.error}
          </Text>
        ) : !people.list.length ? (
          <Animated.View entering={FadeIn} style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Icon name="users" size={20} color={t.c.textSecondary} />
            <Text variant="bodyS" tone="secondary" align="center">
              Nobody to add yet. Make friends, follow people or talk to them first: you can add people who accept your messages.
            </Text>
          </Animated.View>
        ) : (
          people.list.map((p, i) => {
            const on = picked.includes(p.id);
            return (
              <Animated.View key={p.id} entering={enter.rise(Math.min(i, 8), 20)}>
                <PressableScale onPress={() => toggle(p.id)} scaleTo={0.98} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={p.first_name} style={styles.row}>
                  <Avatar name={p.first_name} hue={hueOf(p.id)} size={46} photo={p.photo_path ? faces[p.photo_path] : undefined} />
                  <Text variant="titleS" style={{ flex: 1 }} raw>
                    {p.first_name}
                  </Text>
                  <View style={[styles.check, { borderColor: on ? t.c.text : t.c.lineStrong, backgroundColor: on ? t.c.text : 'transparent' }]}>{on ? <Icon name="check" size={14} color={t.c.bg} /> : null}</View>
                </PressableScale>
              </Animated.View>
            );
          })
        )}
      </View>
      <View style={[styles.pad, { marginTop: space[6] }]}>
        <Button label="Create the group" icon="users" full loading={busy} disabled={!name.trim() || !picked.length} onPress={create} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 64, height: 64, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: radius.xl },
});
