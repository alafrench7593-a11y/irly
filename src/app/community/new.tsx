import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Controls';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CATEGORIES } from '@/data/catalog/categories';
import { CITIES } from '@/data/destinations';
import { useAccount } from '@/features/auth/account';
import { createServerCommunity } from '@/features/server/activities';
import { haptic } from '@/motion/haptics';
import { useCityId, useStore } from '@/state/store';
import { font, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Create a community: a permanent group with its own chat. You become its
 * owner and land in the chat. Girls-only communities are offered to women
 * and enforced by the server.
 */
export default function NewCommunity() {
  const t = useTheme();
  const router = useRouter();
  const account = useAccount();
  const cityId = useCityId();
  const city = CITIES[cityId];
  const woman = useStore((s) => s.profile.gender === 'woman');
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [girlOnly, setGirlOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length >= 3;

  const create = async () => {
    if (!valid) return;
    if (!account) {
      toast('Sign in first: communities live on the IRLY server', 'user', 'brand');
      router.push('/account');
      return;
    }
    setBusy(true);
    try {
      const conv = await createServerCommunity({ name: name.trim(), cityId, tagline, description, categoryId: category, girlOnly });
      haptic('success');
      toast(`${name.trim()} is live. You're its owner`, 'users', 'brand');
      router.replace(conv ? `/messages/${conv}` : '/messages');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create the community', 'x', 'live');
    } finally {
      setBusy(false);
    }
  };

  const input = [styles.input, { color: t.c.text, backgroundColor: t.c.surface, borderColor: t.c.line }];

  return (
    <Page overline={city.name} title="New community" subtitle="A permanent group with its own chat. People who join are in the chat straight away.">
      <View style={styles.body}>
        {!account ? (
          <View style={[styles.note, { backgroundColor: t.c.surface }]}>
            <Icon name="user" size={18} color={t.c.text} />
            <Text variant="bodyS" style={{ flex: 1 }}>
              You need an IRLY account to create a community.
            </Text>
            <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
          </View>
        ) : null}
        <View style={{ gap: 6 }}>
          <Text variant="label">Name</Text>
          <TextInput value={name} onChangeText={(v) => setName(v.slice(0, 60))} placeholder={`French in ${city.name}`} placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel="Community name" />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="label">One line</Text>
          <TextInput value={tagline} onChangeText={(v) => setTagline(v.slice(0, 80))} placeholder="Apéros, padel and weekend trips" placeholderTextColor={t.c.textTertiary} style={input} accessibilityLabel="Tagline" />
        </View>
        <View style={{ gap: 6 }}>
          <Text variant="label">About</Text>
          <TextInput
            value={description}
            onChangeText={(v) => setDescription(v.slice(0, 600))}
            placeholder="Who it's for, how often you meet, the vibe."
            placeholderTextColor={t.c.textTertiary}
            multiline
            style={[input, styles.multi]}
            accessibilityLabel="Description"
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text variant="label">Category</Text>
          <View style={styles.wrap}>
            {CATEGORIES.map((c) => (
              <Chip key={c.id} size="sm" label={c.label} dot={c.color} selected={category === c.id} onPress={() => setCategory(category === c.id ? undefined : c.id)} />
            ))}
          </View>
        </View>
        {woman ? (
          <View style={[styles.toggle, { backgroundColor: t.c.surface }]}>
            <View style={{ flex: 1 }}>
              <Text variant="titleS">IRLY Girl community</Text>
              <Text variant="bodyS" tone="secondary">
                Only women can see and join it.
              </Text>
            </View>
            <Switch value={girlOnly} onValueChange={setGirlOnly} trackColor={{ true: t.c.brand, false: t.c.overlay }} thumbColor="#FFFFFF" accessibilityLabel="IRLY Girl community" />
          </View>
        ) : null}
        <Button label="Create community" icon="users" full loading={busy} disabled={!valid} onPress={create} />
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: space[5] },
  input: { height: 52, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14, fontFamily: font.medium, fontSize: 16 },
  multi: { height: 110, paddingTop: 12, textAlignVertical: 'top' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.xl },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.lg },
});
