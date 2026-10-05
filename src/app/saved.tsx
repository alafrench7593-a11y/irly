import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Controls';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { toggleSave, useSaved, type SavedItem, type TargetType } from '@/features/server/engage';
import { supabase } from '@/lib/supabase';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type Tab = 'all' | 'activity' | 'place' | 'community' | 'irl_post' | 'profile';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'activity', label: 'Plans' },
  { value: 'place', label: 'Places' },
  { value: 'community', label: 'Groups' },
  { value: 'irl_post', label: 'Posts' },
  { value: 'profile', label: 'People' },
];
const ICON: Partial<Record<TargetType, IconName>> = { activity: 'calendar', place: 'pin', community: 'users', irl_post: 'camera', profile: 'user', catalog: 'sparkles', community_post: 'message' };

/** Resolve titles in one query per type (saves only keep the canonical id). */
async function titlesFor(items: SavedItem[]): Promise<Record<string, string>> {
  if (!supabase) return {};
  const out: Record<string, string> = {};
  const ids = (type: TargetType) => items.filter((i) => i.type === type).map((i) => i.id);
  const [acts, places, comms, posts, people, cposts] = await Promise.all([
    ids('activity').length ? supabase.from('activities').select('id, title').in('id', ids('activity')) : null,
    ids('place').length ? supabase.from('places').select('slug, name').in('slug', ids('place')) : null,
    ids('community').length ? supabase.from('communities').select('id, name').in('id', ids('community')) : null,
    ids('irl_post').length ? supabase.from('irl_posts').select('id, body').in('id', ids('irl_post')) : null,
    ids('profile').length ? supabase.from('profiles_public').select('id, first_name').in('id', ids('profile')) : null,
    ids('community_post').length ? supabase.from('community_posts').select('id, body, community_id').in('id', ids('community_post')) : null,
  ]);
  acts?.data?.forEach((r) => (out[`activity:${r.id}`] = r.title));
  places?.data?.forEach((r) => (out[`place:${r.slug}`] = r.name));
  comms?.data?.forEach((r) => (out[`community:${r.id}`] = r.name));
  posts?.data?.forEach((r) => (out[`irl_post:${r.id}`] = r.body));
  people?.data?.forEach((r) => (out[`profile:${r.id}`] = r.first_name));
  cposts?.data?.forEach((r) => {
    out[`community_post:${r.id}`] = r.body;
    out[`community_post:${r.id}:community`] = r.community_id;
  });
  return out;
}

/** Profile → Saved: activities, events, places, communities, posts, people. */
export default function SavedScreen() {
  const t = useTheme();
  const router = useRouter();
  const { items, refresh, signedIn } = useSaved();
  const [tab, setTab] = useState<Tab>('all');
  const [titles, setTitles] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    if (!items.length) return;
    titlesFor(items).then((m) => alive && setTitles(m));
    return () => {
      alive = false;
    };
  }, [items]);

  const shown = items.filter((i) => tab === 'all' || i.type === tab || (tab === 'irl_post' && i.type === 'community_post'));

  const open = (i: SavedItem) => {
    const postCommunity = titles[`community_post:${i.id}:community`];
    if (i.type === 'activity') router.push(`/a/${i.id}`);
    else if (i.type === 'community') router.push(`/c/${i.id}`);
    else if (i.type === 'place') router.push(`/place/${i.id}`);
    else if (i.type === 'community_post' && postCommunity) router.push(`/c/${postCommunity}`);
    else if (i.type === 'irl_post') router.push('/live');
    else router.push(`/search?q=${encodeURIComponent(titles[`${i.type}:${i.id}`] ?? i.id)}`);
  };

  return (
    <Page overline="Profile" title="Saved" subtitle="Plans, places and people you kept for later.">
      <View style={styles.body}>
        {!signedIn ? (
          <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
            <Text variant="body" tone="secondary" align="center">
              Sign in to save things and find them on every device.
            </Text>
            <Button label="Sign in" size="sm" onPress={() => router.push('/account')} />
          </View>
        ) : (
          <>
            <Segmented options={TABS} value={tab} onChange={setTab} />
            {!shown.length ? (
              <View style={[styles.empty, { backgroundColor: t.c.surface }]}>
                <Icon name="bookmark" size={24} color={t.c.textSecondary} />
                <Text variant="body" tone="secondary" align="center">
                  Nothing saved here yet. Tap the bookmark on anything you like.
                </Text>
              </View>
            ) : (
              shown.map((i) => (
                <PressableScale key={`${i.type}-${i.id}`} onPress={() => open(i)} haptic="select" scaleTo={0.98} style={[styles.row, { backgroundColor: t.c.surface }]} accessibilityLabel={titles[`${i.type}:${i.id}`] ?? 'Saved item'}>
                  <Icon name={ICON[i.type] ?? 'bookmark'} size={20} color={t.c.text} />
                  <Text variant="titleS" numberOfLines={1} style={{ flex: 1 }}>
                    {titles[`${i.type}:${i.id}`] ?? i.id.replace(/-/g, ' ')}
                  </Text>
                  <PressableScale
                    onPress={() => toggleSave({ type: i.type, id: i.id }).then(refresh)}
                    haptic="select"
                    hitSlop={8}
                    accessibilityLabel="Remove from saved"
                  >
                    <Icon name="bookmark" size={20} color={t.c.text} fill={t.c.text} />
                  </PressableScale>
                </PressableScale>
              ))
            )}
          </>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg },
  empty: { alignItems: 'center', gap: 12, padding: 24, borderRadius: radius.xl },
});
