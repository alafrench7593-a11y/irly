import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { GlassLayer } from '@/components/ui/GlassLayer';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useSignedLinks } from '@/features/server/media';
import { t as tx } from '@/i18n';
import { PressableScale } from '@/motion/PressableScale';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { CommunityPost } from './data';

const CARD_W = 236;

/**
 * Pinned posts, side by side at the top of Posts: what the team wants
 * everyone to see first. A tap opens the post with its comments.
 */
export function PinnedStrip({ posts }: { posts: CommunityPost[] }) {
  const t = useTheme();
  const pinned = useMemo(() => posts.filter((p) => p.pinnedAt && !p.pending), [posts]);
  const thumbs = useSignedLinks(
    'post-media',
    pinned.map((p) => (p.mediaKind === 'video' ? p.thumbPath : p.mediaPaths?.[0])),
  );
  if (!pinned.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={[styles.pad, styles.row]}>
        <Icon name="pinPost" size={14} color={t.c.textSecondary} />
        <Text variant="overline" tone="secondary">
          {pinned.length === 1 ? tx('Pinned') : tx('{n} pinned', { n: pinned.length })}
        </Text>
      </View>
      <FlatList
        horizontal
        data={pinned}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.pad, { gap: 10 }]}
        snapToInterval={CARD_W + 10}
        decelerationRate="fast"
        renderItem={({ item }) => <PinnedCard p={item} thumb={item.mediaKind === 'video' ? (item.thumbPath ? thumbs[item.thumbPath] : undefined) : item.mediaPaths?.[0] ? thumbs[item.mediaPaths[0]] : undefined} />}
      />
    </View>
  );
}

const PinnedCard = memo(function PinnedCard({ p, thumb }: { p: CommunityPost; thumb?: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <PressableScale
      haptic="select"
      scaleTo={0.97}
      onPress={() => router.push({ pathname: '/comments', params: { type: 'community_post', id: p.id, title: p.body.slice(0, 60) } })}
      style={styles.card}
      accessibilityLabel={tx('Open {title}', { title: p.body.slice(0, 60) || tx('Post') })}
    >
      <GlassLayer radius={radius.lg} />
      {thumb ? (
        <View style={styles.thumb}>
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          {p.mediaKind === 'video' ? (
            <View style={styles.play}>
              <Icon name="play" size={12} color="#fff" />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="caption" tone="tertiary" numberOfLines={1} raw>
          {p.kind === 'announcement' ? tx('Announcement') : p.mine ? tx('You') : p.firstName}
        </Text>
        <Text variant="bodyS" raw numberOfLines={3} style={{ color: t.c.text }}>
          {p.body || (p.mediaKind === 'video' ? tx('Video') : tx('Photo'))}
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  card: { width: CARD_W, minHeight: 84, flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg, overflow: 'hidden' },
  thumb: { width: 60, height: 60, borderRadius: radius.md, overflow: 'hidden', backgroundColor: 'rgba(127,127,127,0.12)' },
  play: { position: 'absolute', right: 4, bottom: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
});
